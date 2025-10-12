/**
 * 人脸识别系统后端API
 * 
 * 主要接口：
 * 1. POST /api/register - 用户注册
 * 2. POST /api/login - 用户登录
 * 3. POST /api/face-register - 人脸注册（调用算法组接口）
 * 4. POST /api/face-recognition - 人脸识别（调用算法组接口）
 * 5. POST /api/attendance - 签到记录
 * 
 * 数据库表：
 * - user: 用户信息表
 * - attendance_record: 签到记录表
 * 
 * 注意：人脸特征值由算法组保存，后端只负责传递图片
 */

const express = require('express');
// const { formidable } = require('formidable');
const multer = require('multer');
const path = require('path');
const bcrypt = require('bcrypt');
const session = require('express-session');
const mysql = require('mysql2/promise');
const axios = require('axios');
const app = express();

// 中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Session配置
app.use(session({
    secret: 'my-course-project-secret-key-12345',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000 // 24小时
    }
}));

// MySQL数据库配置
// 请根据实际环境修改以下配置
const dbConfig = {
    host: 'localhost',           // 数据库服务器地址
    user: 'root',                // 数据库用户名
    password: '123456',         // 数据库密码
    database: 'face_recognition', // 数据库名称
    charset: 'utf8mb4',          // 字符集
    port: 3306,                  // 端口号（可选，默认3306）
    connectionLimit: 10,          // 连接池最大连接数
    acquireTimeout: 60000,        // 获取连接超时时间（毫秒）
    timeout: 60000,               // 查询超时时间（毫秒）
    reconnect: true              // 自动重连
};

// 创建数据库连接池
const pool = mysql.createPool(dbConfig);


const publicDir = path.join(__dirname, './public');
console.log(publicDir);
// 配置 multer
const storage = multer.diskStorage({
    destination: (req, file, cb) => {
        cb(null, publicDir);
    },
    filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
        cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
    }
});

const upload = multer({
    storage: storage,
    limits: {
        fileSize: 20 * 1024 * 1024 // 10MB
    }
});

// CORS 中间件
app.use((req, res, next) => {
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS') {
        return res.sendStatus(200);
    }
    next();
});

// 1. 用户注册接口
app.post('/api/register', async (req, res) => {
    try {
        const { userAccount, userPassword, userName } = req.body;

        // 验证输入
        if (!userAccount || !userPassword) {
            return res.status(400).json({
                success: false,
                message: '账号和密码不能为空'
            });
        }

        // 账号格式校验
        const accountRegex = /^[a-zA-Z0-9_]{3,20}$/;
        if (!accountRegex.test(userAccount)) {
            return res.status(400).json({
                success: false,
                message: '账号格式不正确，只能包含字母、数字、下划线，长度3-20位'
            });
        }

        // 密码格式校验
        const passwordRegex = /^(?=.*[a-zA-Z])(?=.*\d)[a-zA-Z\d@$!%*?&]{6,20}$/;
        if (!passwordRegex.test(userPassword)) {
            return res.status(400).json({
                success: false,
                message: '密码格式不正确，必须包含字母和数字，长度6-20位'
            });
        }

        // 用户名格式校验（可选）
        if (userName && userName.length > 50) {
            return res.status(400).json({
                success: false,
                message: '用户名长度不能超过50个字符'
            });
        }

        const connection = await pool.getConnection();

        try {
            // 检查用户是否已存在
            const [rows] = await connection.execute(
                'SELECT id FROM user WHERE userAccount = ? AND isDelete = 0',
                [userAccount]
            );

            if (rows.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: '账号已存在'
                });
            }

            // 加密密码
            const saltRounds = 10;
            const hashedPassword = await bcrypt.hash(userPassword, saltRounds);

            // 插入新用户
            const [result] = await connection.execute(
                'INSERT INTO user (userAccount, userPassword, userName) VALUES (?, ?, ?)',
                [userAccount, hashedPassword, userName]
            );

            res.json({
                success: true,
                message: '注册成功',
                data: {
                    userId: result.insertId,
                    userAccount: userAccount,
                    userName: userName
                }
            });

        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('注册错误:', error);
        res.status(500).json({
            success: false,
            message: '服务器错误'
        });
    }
});

// 2. 用户登录接口
app.post('/api/login', async (req, res) => {
    try {
        const { userAccount, userPassword } = req.body;

        if (!userAccount || !userPassword) {
            return res.status(400).json({
                success: false,
                message: '账号和密码不能为空'
            });
        }

        const connection = await pool.getConnection();

        try {
            // 查找用户
            const [rows] = await connection.execute(
                'SELECT * FROM user WHERE userAccount = ? AND isDelete = 0',
                [userAccount]
            );

            if (rows.length === 0) {
                return res.status(401).json({
                    success: false,
                    message: '账号或密码错误'
                });
            }

            const user = rows[0];

            // 验证密码
            const isValidPassword = await bcrypt.compare(userPassword, user.userPassword);
            if (!isValidPassword) {
                return res.status(401).json({
                    success: false,
                    message: '账号或密码错误'
                });
            }

            // 将用户信息存储到session
            req.session.userId = user.id;
            req.session.userAccount = user.userAccount;
            req.session.userName = user.userName;
            req.session.faceRegistered = user.faceRegistered;

            res.json({
                success: true,
                message: '登录成功',
                data: {
                    userId: user.id,
                    userAccount: user.userAccount,
                    userName: user.userName,
                    faceRegistered: user.faceRegistered
                }
            });

        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('登录错误:', error);
        res.status(500).json({
            success: false,
            message: '服务器错误'
        });
    }
});

// 3. 人脸注册接口
app.post('/api/face-register', upload.single('imagefile'), async (req, res) => {
    try {
        const { userId } = req.body;

        if (!userId) {
            return res.status(400).json({
                success: false,
                message: '用户ID不能为空'
            });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: '未收到图片文件'
            });
        }

        // TODO: 调用算法组接口进行人脸特征提取和保存
        // 算法组负责保存人脸特征值，后端只传递图片
        try {
            // TODO: 替换为真实的算法组接口地址
            const algorithmResponse = await axios.post('http://algorithm-service/api/face-register', {
                imagePath: req.file.path,
                userId: userId
            });

            if (algorithmResponse.data.success) {
                // 更新用户的人脸注册状态
                const connection = await pool.getConnection();
                try {
                    await connection.execute(
                        'UPDATE user SET faceRegistered = 1 WHERE id = ?',
                        [userId]
                    );

                    res.json({
                        success: true,
                        message: '人脸注册成功',
                        data: {
                            userId: userId
                        }
                    });
                } finally {
                    connection.release();
                }
            } else {
                res.status(400).json({
                    success: false,
                    message: algorithmResponse.data.message || '人脸注册失败'
                });
            }

        } catch (algorithmError) {
            console.error('算法组接口调用失败:', algorithmError);
            res.status(500).json({
                success: false,
                message: '人脸注册失败，请重试'
            });
        }

    } catch (error) {
        console.error('人脸注册错误:', error);
        res.status(500).json({
            success: false,
            message: '服务器错误'
        });
    }
});

// 4. 人脸识别接口（包含签到记录）
app.post('/api/face-recognition', upload.single('imagefile'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: '未收到图片文件'
            });
        }

        // TODO: 调用算法组接口进行人脸识别
        try {
            // TODO: 替换为真实的算法组接口地址
            const algorithmResponse = await axios.post('http://algorithm-service/api/face-recognition', {
                imagePath: req.file.path
            });

            const recognitionResult = algorithmResponse.data;

            if (recognitionResult.recognized) {
                // 查找用户信息
                const connection = await pool.getConnection();
                try {
                    const [rows] = await connection.execute(
                        'SELECT * FROM user WHERE id = ? AND isDelete = 0',
                        [recognitionResult.userId]
                    );

                    if (rows.length === 0) {
                        return res.status(500).json({
                            success: false,
                            message: '用户信息查询失败'
                        });
                    }

                    const user = rows[0];

                    // 自动记录签到
                    try {
                        await connection.execute(
                            'INSERT INTO attendance_record (userId, checkTime, status) VALUES (?, NOW(), ?)',
                            [user.id, 1] // 1表示签到成功
                        );
                        console.log(`用户 ${user.userAccount} 签到成功`);
                    } catch (attendanceError) {
                        console.error('签到记录失败:', attendanceError);
                        // 签到记录失败不影响识别结果
                    }

                    res.json({
                        success: true,
                        message: '人脸识别成功，已自动签到',
                        data: {
                            recognized: true,
                            userId: user.id,
                            userAccount: user.userAccount,
                            userName: user.userName,
                            attendanceRecorded: true
                        }
                    });
                } finally {
                    connection.release();
                }
            } else {
                res.json({
                    success: true,
                    message: '未识别到已知人脸',
                    data: {
                        recognized: false,
                        attendanceRecorded: false
                    }
                });
            }

        } catch (algorithmError) {
            console.error('算法组接口调用失败:', algorithmError);
            res.status(500).json({
                success: false,
                message: '人脸识别失败'
            });
        }

    } catch (error) {
        console.error('人脸识别错误:', error);
        res.status(500).json({
            success: false,
            message: '服务器错误'
        });
    }
});


// 用户登出接口
app.post('/api/logout', (req, res) => {
    req.session.destroy((err) => {
        if (err) {
            return res.status(500).json({
                success: false,
                message: '登出失败'
            });
        }
        res.json({
            success: true,
            message: '登出成功'
        });
    });
});

// 获取当前用户信息接口
app.get('/api/user-info', (req, res) => {
    if (!req.session.userId) {
        return res.status(401).json({
            success: false,
            message: '未登录'
        });
    }

    res.json({
        success: true,
        message: '获取用户信息成功',
        data: {
            userId: req.session.userId,
            userAccount: req.session.userAccount,
            userName: req.session.userName,
            faceRegistered: req.session.faceRegistered
        }
    });
});

// 中间件：验证用户登录状态
const requireLogin = (req, res, next) => {
    if (!req.session.userId) {
        return res.status(401).json({
            success: false,
            message: '请先登录'
        });
    }
    next();
};

app.get('/home', (req, res) => {
    res.json({
        message: 'Hello',
        status: 'success',
        data: {
            text: 'Hello from server!',
            timestamp: new Date()
        }
    });
})
app.get('', (req, res) => {
    res.send('Hello');
})

app.post('/send', upload.single('imagefile'), (req, res) => {
    try {
        console.log('收到上传请求');
        console.log('文件:', req.file);
        console.log('表单数据:', req.body);

        if (!req.file) {
            return res.status(400).json({
                error: '未收到文件'
            });
        }

        res.json({
            message: '上传成功',
            filename: req.file.filename,
            originalname: req.file.originalname,
            size: req.file.size,
            mimetype: req.file.mimetype,
            user: req.body.user // 从 formData 中获取
        });
    } catch (error) {
        console.error('上传错误:', error);
        res.status(500).json({
            error: '文件上传失败',
            message: error.message
        });
    }
})

app.listen(3000, () => {
    console.log('服务器已经执行');
})