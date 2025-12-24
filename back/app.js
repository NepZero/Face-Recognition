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
 * Socket.IO 实时通信：
 * - 学生接收签到任务推送
 * - 实时签到状态更新
 * 
 * 数据库表：
 * - user: 用户信息表
 * - attendance_record: 签到记录表
 * 
 * 注意：人脸特征值由算法组保存，后端只负责传递图片
 */

const fs = require('fs');
const path = require('path');
const http = require('http');

const express = require('express');
// const { formidable } = require('formidable');
const multer = require('multer');
const bcrypt = require('bcrypt');
const session = require('express-session');
const cookieParser = require('cookie-parser');
const mysql = require('mysql2/promise');
const axios = require('axios');
const { Server } = require('socket.io');
const app = express();
const { spawn } = require('child_process');
const jwt = require('jsonwebtoken');

// JWT 配置
const JWT_SECRET = process.env.JWT_SECRET || 'face-recognition-jwt-secret-CHANGE_ME';
const ACCESS_TOKEN_EXPIRES_IN = process.env.ACCESS_TOKEN_EXPIRES_IN || '2h';

// 中间件
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// 如需兼容旧版，可保留 session 中间件，但后续鉴权改为 JWT
const sessionMiddleware = session({
    secret: 'my-course-project-secret-key-12345',
    resave: false,
    saveUninitialized: false,
    cookie: {
        maxAge: 24 * 60 * 60 * 1000
    }
});
app.use(sessionMiddleware);

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
const faceDataDir = path.join(__dirname, '..', 'opencv', 'face_get', 'Facedata');
// 运行 Python 脚本以生成/更新算法 mock 数据
async function runPythonMockGenerator() {
    return new Promise((resolve, reject) => {
        const scriptPath = path.join(__dirname, '..', 'opencv', 'face_get', 'rec.py');
        const py = spawn('python', [scriptPath], {
            cwd: path.join(__dirname, '..')
        });

        let stderr = '';
        py.stderr.on('data', (d) => { stderr += d.toString(); });
        py.on('close', (code) => {
            if (code !== 0) {
                return reject(new Error(stderr || `Python exited with code ${code}`));
            }
            resolve();
        });
    });
}

// 运行 Python 实时识别并从 stdout 解析 JSON（带详细日志与多解释器兼容）
async function runPythonRecognition(imagePath) {
    // 支持通过环境变量覆盖 Python 解释器（如 C:\\Python39\\python.exe 或 py）
    const envPython = process.env.PYTHON_EXE && process.env.PYTHON_EXE.trim();
    const interpreters = [
        envPython ? { exe: envPython, args: [] } : null,
        { exe: 'py', args: ['-3'] },
        { exe: 'python', args: [] },
        { exe: 'python3', args: [] }
    ].filter(Boolean);
    const scriptPath = path.join(__dirname, '..', 'opencv', 'face_get', 'rec.py');
    const cwd = path.join(__dirname, '..');

    const trySpawn = (opt) => new Promise((resolve, reject) => {
        const exe = opt.exe;
        const baseArgs = Array.isArray(opt.args) ? opt.args : [];
        const args = [...baseArgs, scriptPath, imagePath];
        const py = spawn(exe, args, { cwd });
        let stdout = '';
        let stderr = '';
        py.stdout.on('data', (d) => { const s = d.toString(); stdout += s; });
        py.stderr.on('data', (d) => { const s = d.toString(); stderr += s; });
        py.on('error', (e) => reject(new Error(`spawn ${exe} failed: ${e.message}`)));
        py.on('close', (code) => {
            console.log(`[Python exe]: ${exe} ${args.join(' ')}`);
            console.log('[Python stdout]:', stdout);
            if (stderr) console.error('[Python stderr]:', stderr);
            if (code !== 0) {
                return reject(new Error(stderr || `Python exited with code ${code} (exe=${exe})`));
            }
            try {
                const parsed = JSON.parse(stdout.trim());
                resolve(parsed);
            } catch (e) {
                reject(new Error(`Failed to parse Python stdout as JSON: ${stdout}\n${e.message}`));
            }
        });
    });

    let lastErr = null;
    for (const opt of interpreters) {
        try {
            return await trySpawn(opt);
        } catch (e) {
            lastErr = e;
        }
    }
    throw lastErr || new Error('No Python interpreter found');
}

// 运行 Python 训练脚本，生成/更新 trainer.yml（可选触发）
async function runPythonTraining() {
    const envPython = process.env.PYTHON_EXE && process.env.PYTHON_EXE.trim();
    const interpreters = [
        envPython ? { exe: envPython, args: [] } : null,
        { exe: 'py', args: ['-3'] },
        { exe: 'python', args: [] },
        { exe: 'python3', args: [] }
    ].filter(Boolean);
    const scriptPath = path.join(__dirname, '..', 'opencv', 'face_get', 'trainner.py');
    const cwd = path.join(__dirname, '..');

    const trySpawn = (opt) => new Promise((resolve, reject) => {
        const exe = opt.exe;
        const baseArgs = Array.isArray(opt.args) ? opt.args : [];
        const args = [...baseArgs, scriptPath];
        const py = spawn(exe, args, { cwd });
        let stderr = '';
        py.stderr.on('data', (d) => { stderr += d.toString(); });
        py.on('close', (code) => {
            console.log(`[Python train exe]: ${exe} ${args.join(' ')}`);
            if (stderr) console.error('[Python train stderr]:', stderr);
            if (code !== 0) {
                return reject(new Error(stderr || `Python training exited with code ${code} (exe=${exe})`));
            }
            resolve();
        });
        py.on('error', (e) => reject(new Error(`spawn ${exe} failed: ${e.message}`)));
    });

    let lastErr = null;
    for (const opt of interpreters) {
        try {
            await trySpawn(opt);
            return;
        } catch (e) {
            lastErr = e;
        }
    }
    throw lastErr || new Error('No Python interpreter found for training');
}

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

// JWT 工具
function signAccessToken(user) {
    const payload = {
        id: user.id,
        userAccount: user.userAccount,
        userName: user.userName,
        userRole: user.userRole,
        classId: user.classId,
        className: user.className || null,
        faceRegistered: user.faceRegistered
    };
    return jwt.sign(payload, JWT_SECRET, { expiresIn: ACCESS_TOKEN_EXPIRES_IN });
}

function extractTokenFromRequest(req) {
    const header = req.headers && (req.headers.authorization || req.headers.Authorization);
    if (header && header.startsWith('Bearer ')) {
        return header.substring(7);
    }
    if (req.headers && req.headers['x-access-token']) {
        return req.headers['x-access-token'];
    }
    if (req.cookies && req.cookies.access_token) {
        return req.cookies.access_token;
    }
    return null;
}

// 中间件：JWT 鉴权
const requireLogin = (req, res, next) => {
    const token = extractTokenFromRequest(req);
    if (!token) {
        return res.status(401).json({ success: false, message: '未携带访问令牌' });
    }
    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        next();
    } catch (e) {
        return res.status(401).json({ success: false, message: '访问令牌无效或已过期' });
    }
};

// 1. 用户注册接口
app.post('/api/register', async (req, res) => {
    try {
        const { userAccount, userPassword, userName, classId } = req.body;

        // 验证输入
        if (!userAccount || !userPassword) {
            return res.status(400).json({
                success: false,
                message: '账号和密码不能为空'
            });
        }

        // 学生注册必须选择班级
        if (!classId) {
            return res.status(400).json({
                success: false,
                message: '学生注册时必须选择班级'
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
                'SELECT id FROM user WHERE userAccount = ? ',
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

            // 验证班级是否存在并获取班级名称
            const [classRows] = await connection.execute(
                'SELECT id, className FROM class WHERE id = ?',
                [classId]
            );
            if (classRows.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: '选择的班级不存在'
                });
            }

            const classInfo = classRows[0];

            // 插入新用户（固定为学生角色）
            const [result] = await connection.execute(
                'INSERT INTO user (userAccount, userPassword, userName, userRole, classId) VALUES (?, ?, ?, ?, ?)',
                [userAccount, hashedPassword, userName, 'student', classId]
            );

            res.json({
                success: true,
                message: '注册成功',
                data: {
                    userId: result.insertId,
                    userAccount: userAccount,
                    userName: userName,
                    userRole: 'student',
                    classId: classId,
                    className: classInfo.className
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
            // 查找用户并关联班级信息获取班级名称
            const [rows] = await connection.execute(
                `SELECT u.*, c.className 
                 FROM user u 
                 LEFT JOIN class c ON u.classId = c.id 
                 WHERE u.userAccount = ?`,
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

            const accessToken = signAccessToken(user);
            res.json({
                success: true,
                message: '登录成功',
                data: {
                    accessToken,
                    expiresIn: ACCESS_TOKEN_EXPIRES_IN,
                    user: {
                        userId: user.id,
                        userAccount: user.userAccount,
                        userName: user.userName,
                        userRole: user.userRole,
                        classId: user.classId,
                        className: user.className || null,
                        faceRegistered: user.faceRegistered
                    }
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

        // 判断是否冷启动：faceRegistered = 0 时跳过识别校验，直接入库并重训
        const connection = await pool.getConnection();
        try {
            const [userRows] = await connection.execute(
                'SELECT id, userAccount, userName, faceRegistered FROM user WHERE id = ? ',
                [userId]
            );
            if (userRows.length === 0) {
                return res.status(404).json({ success: false, message: '用户不存在' });
            }

            const user = userRows[0];
            const absImagePath = path.join(publicDir, req.file.filename);
            const baseName = (user.userAccount || user.userName || `user_${userId}`)
                .toString()
                .replace(/[^a-zA-Z0-9_\-\u4e00-\u9fa5]/g, '_');

            // 冷启动：首次注册不做识别匹配，直接入库并重训
            if (!user.faceRegistered) {
                try {
                    const ext = path.extname(req.file.originalname || '').toLowerCase() || '.jpg';
                    const index = Date.now();
                    const targetName = `${baseName}.${userId}.${index}${ext}`;
                    const targetPath = path.join(faceDataDir, targetName);
                    fs.mkdirSync(faceDataDir, { recursive: true });
                    fs.copyFileSync(absImagePath, targetPath);
                    await connection.execute('UPDATE user SET faceRegistered = 1 WHERE id = ?', [userId]);
                    await runPythonTraining();
                    return res.json({
                        success: true,
                        message: '人脸注册成功（首次注册）',
                        data: { userId, savedToDataset: true, retrained: true, coldStart: true }
                    });
                } catch (e) {
                    console.error('首次注册入库/训练失败:', e);
                    return res.status(500).json({ success: false, message: '人脸注册失败，请重试' });
                }
            }

            // 非首次：执行识别校验 → 保存样本 → 重训
            try {
                const pyResult = await runPythonRecognition(absImagePath);
                const isMatchUser = pyResult && pyResult.recognized && String(pyResult.userId) === String(userId);
                if (!isMatchUser) {
                    return res.status(400).json({ success: false, message: '人脸注册失败：未识别到该用户的人脸' });
                }

                // 保存样本到训练集
                try {
                    const ext = path.extname(req.file.originalname || '').toLowerCase() || '.jpg';
                    const index = Date.now();
                    const targetName = `${baseName}.${userId}.${index}${ext}`;
                    const targetPath = path.join(faceDataDir, targetName);
                    fs.mkdirSync(faceDataDir, { recursive: true });
                    fs.copyFileSync(absImagePath, targetPath);
                } catch (copyErr) {
                    console.error('复制样本到训练集失败:', copyErr);
                }

                // 重训
                try {
                    await runPythonTraining();
                } catch (trainErr) {
                    console.error('训练失败:', trainErr);
                }

                // 确保状态为已注册
                await connection.execute('UPDATE user SET faceRegistered = 1 WHERE id = ?', [userId]);
                return res.json({
                    success: true,
                    message: '人脸注册成功',
                    data: { userId, savedToDataset: true, retrained: true, coldStart: false }
                });
            } catch (algorithmError) {
                console.error('算法组接口调用失败:', algorithmError);
                return res.status(500).json({ success: false, message: '人脸注册失败，请重试' });
            }
        } finally {
            connection.release();
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
app.post('/api/face-recognition', requireLogin, upload.single('imagefile'), async (req, res) => {
    try {
        const { taskId } = req.body; // 可选的签到任务ID
        const currentUserId = req.user.id; // 当前登录用户ID
        const currentUserRole = req.user.userRole; // 当前登录用户角色

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: '未收到图片文件'
            });
        }

		// 实时调用 Python 识别当前上传图片
		try {
			const absImagePath = path.join(publicDir, req.file.filename);
			const recognitionResult = await runPythonRecognition(absImagePath);

            if (recognitionResult && recognitionResult.recognized) {
                // 识别成功，说明识别到了已知人脸
                // 对于学生：以当前登录用户为准，避免因多用户使用同一张照片导致识别错误
                // 对于老师：可以使用识别出的用户ID（用于管理场景）
                const connection = await pool.getConnection();
                try {
                    // 确定要使用的用户ID
                    let targetUserId;
                    if (currentUserRole === 'student') {
                        // 学生：始终使用当前登录的用户ID
                        targetUserId = currentUserId;
                        // 如果识别出的用户ID与当前用户不一致，记录日志但不阻止
                        if (Number(recognitionResult.userId) !== Number(currentUserId)) {
                            console.log(`[人脸识别] 识别出用户ID ${recognitionResult.userId}，但以当前登录用户 ${currentUserId} 为准`);
                        }
                    } else {
                        // 老师：使用识别出的用户ID（可以识别任何人）
                        targetUserId = recognitionResult.userId;
                    }

                    // 查找用户信息
                    const [rows] = await connection.execute(
                        'SELECT * FROM user WHERE id = ? ',
                        [targetUserId]
                    );

                    if (rows.length === 0) {
                        return res.status(500).json({
                            success: false,
                            message: '用户信息查询失败'
                        });
                    }

                    const user = rows[0];

                    // 验证签到任务（如果提供了taskId）
                    let validTask = true;
                    if (taskId) {
                        // 验证任务是否存在、是否有效，以及学生是否明确选择了该课程
                        const [taskRows] = await connection.execute(
                            `SELECT at.* FROM attendance_task at
                             WHERE at.id = ? AND at.status = 'active' 
                             AND at.startTime <= NOW() AND at.endTime >= NOW()
                             AND EXISTS (
                                 SELECT 1 FROM student_course sc 
                                 WHERE sc.courseId = at.courseId AND sc.studentId = ?
                             )`,
                            [taskId, user.id]
                        );

                        if (taskRows.length === 0) {
                            validTask = false;
                        }
                    }

                    // 自动记录签到
                    try {
                        if (validTask) {
                            await connection.execute(
                                'INSERT INTO attendance_record (userId, taskId, checkTime, status) VALUES (?, ?, NOW(), ?)',
                                [user.id, taskId || null, 1] // 1表示签到成功
                            );
                            console.log(`用户 ${user.userAccount} 签到成功`);
                        } else {
                            console.log(`用户 ${user.userAccount} 签到失败：任务无效或已过期`);
                        }
                    } catch (attendanceError) {
                        console.error('签到记录失败:', attendanceError);
                        // 签到记录失败不影响识别结果
                    }

                    res.json({
                        success: true,
                        message: validTask ? '人脸识别成功，已自动签到' : '人脸识别成功，但签到任务无效或已过期',
                        data: {
                            recognized: true,
                            userId: user.id,
                            userAccount: user.userAccount,
                            userName: user.userName,
                            attendanceRecorded: validTask,
                            taskId: taskId || null
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
                message: '人脸识别失败',
                error: String(algorithmError && algorithmError.message || algorithmError)
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
    // JWT 无状态退出：前端删除令牌即可
    res.json({ success: true, message: '登出成功' });
});

// ==================== 课程管理接口 ====================

// 1. 创建课程接口（老师）
app.post('/api/courses', requireLogin, async (req, res) => {
    try {
        const teacherId = req.user.id;
        const userRole = req.user.userRole;

        // 验证用户是否为老师
        if (userRole !== 'teacher') {
            return res.status(403).json({
                success: false,
                message: '只有老师可以创建课程'
            });
        }

        const { courseName, courseCode, description } = req.body;

        // 验证必填字段
        if (!courseName || !courseCode) {
            return res.status(400).json({
                success: false,
                message: '课程名称和课程代码不能为空'
            });
        }

        // 验证格式
        if (courseName.length > 100) {
            return res.status(400).json({
                success: false,
                message: '课程名称长度不能超过100个字符'
            });
        }

        if (courseCode.length > 50) {
            return res.status(400).json({
                success: false,
                message: '课程代码长度不能超过50个字符'
            });
        }

        const connection = await pool.getConnection();

        try {
            // 检查课程代码是否已存在
            const [existingRows] = await connection.execute(
                'SELECT id FROM course WHERE courseCode = ?',
                [courseCode]
            );

            if (existingRows.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: '课程代码已存在'
                });
            }

            // 创建课程
            const [result] = await connection.execute(
                'INSERT INTO course (courseName, courseCode, teacherId, description) VALUES (?, ?, ?, ?)',
                [courseName, courseCode, teacherId, description || null]
            );

            const courseId = result.insertId;

            // 获取创建的课程信息
            const [courseRows] = await connection.execute(
                'SELECT * FROM course WHERE id = ?',
                [courseId]
            );

            res.json({
                success: true,
                message: '课程创建成功',
                data: courseRows[0]
            });

        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('创建课程错误:', error);
        res.status(500).json({
            success: false,
            message: '服务器错误'
        });
    }
});

// 2. 获取课程列表接口
app.get('/api/courses', requireLogin, async (req, res) => {
    try {
        const userRole = req.user.userRole;
        const userId = req.user.id;
        const { teacherId } = req.query;

        const connection = await pool.getConnection();

        try {
            let query = '';
            let params = [];

            if (userRole === 'teacher') {
                // 老师查看自己创建的课程
                query = `
                    SELECT c.*, u.userName as teacherName
                    FROM course c
                    LEFT JOIN user u ON c.teacherId = u.id
                    WHERE c.teacherId = ?
                    ORDER BY c.createTime DESC
                `;
                params = [userId];
            } else if (userRole === 'student') {
                // 学生查看所有课程（包括班级关联的和自己选课的）
                query = `
                    SELECT DISTINCT c.*, u.userName as teacherName,
                           CASE WHEN sc.id IS NOT NULL THEN 1 ELSE 0 END as isSelected,
                           CASE WHEN EXISTS (
                               SELECT 1 FROM course_class cc 
                               INNER JOIN user student ON student.classId = cc.classId
                               WHERE cc.courseId = c.id AND student.id = ?
                           ) THEN 1 ELSE 0 END as isClassRelated
                    FROM course c
                    LEFT JOIN user u ON c.teacherId = u.id
                    LEFT JOIN student_course sc ON c.id = sc.courseId AND sc.studentId = ?
                    ORDER BY isSelected DESC, isClassRelated DESC, c.createTime DESC
                `;
                params = [userId, userId];
            } else {
                return res.status(403).json({
                    success: false,
                    message: '权限不足'
                });
            }

            // 如果指定了teacherId，添加筛选条件（仅老师可用）
            if (teacherId && userRole === 'teacher') {
                query = query.replace('WHERE c.teacherId = ?', 'WHERE c.teacherId = ? AND c.teacherId = ?');
                params.push(teacherId);
            }

            const [rows] = await connection.execute(query, params);

            res.json({
                success: true,
                message: '获取课程列表成功',
                data: rows
            });

        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('获取课程列表错误:', error);
        res.status(500).json({
            success: false,
            message: '服务器错误'
        });
    }
});

// 3. 获取课程详情接口（包含关联的班级）
app.get('/api/courses/:id', requireLogin, async (req, res) => {
    try {
        const courseId = req.params.id;
        const userRole = req.user.userRole;
        const userId = req.user.id;

        const connection = await pool.getConnection();

        try {
            // 获取课程基本信息
            const [courseRows] = await connection.execute(
                `SELECT c.*, u.userName as teacherName
                 FROM course c
                 LEFT JOIN user u ON c.teacherId = u.id
                 WHERE c.id = ?`,
                [courseId]
            );

            if (courseRows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: '课程不存在'
                });
            }

            const course = courseRows[0];

            // 权限验证：学生可以查看自己选课的课程或班级关联的课程，老师只能查看自己创建的课程
            if (userRole === 'student') {
                // 检查学生是否选课或班级是否关联
                const [studentCourseRows] = await connection.execute(
                    `SELECT 1 FROM (
                        SELECT 1 FROM student_course WHERE courseId = ? AND studentId = ?
                        UNION
                        SELECT 1 FROM course_class cc
                        INNER JOIN user student ON student.classId = cc.classId
                        WHERE cc.courseId = ? AND student.id = ?
                    ) AS t LIMIT 1`,
                    [courseId, userId, courseId, userId]
                );
                // 学生可以查看所有课程，不需要权限限制（但实际使用中可能需要）
                // 这里允许学生查看所有课程详情
            } else if (userRole === 'teacher') {
                if (Number(course.teacherId) !== Number(userId)) {
                    return res.status(403).json({
                        success: false,
                        message: '无权查看此课程'
                    });
                }
            }

            // 获取关联的班级列表
            const [classRows] = await connection.execute(
                `SELECT c.id, c.className, c.classCode
                 FROM class c
                 INNER JOIN course_class cc ON c.id = cc.classId
                 WHERE cc.courseId = ?
                 ORDER BY c.className`,
                [courseId]
            );

            course.classes = classRows;

            res.json({
                success: true,
                message: '获取课程详情成功',
                data: course
            });

        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('获取课程详情错误:', error);
        res.status(500).json({
            success: false,
            message: '服务器错误'
        });
    }
});

// 4. 更新课程接口（老师）
app.put('/api/courses/:id', requireLogin, async (req, res) => {
    try {
        const courseId = req.params.id;
        const teacherId = req.user.id;
        const userRole = req.user.userRole;

        // 验证用户是否为老师
        if (userRole !== 'teacher') {
            return res.status(403).json({
                success: false,
                message: '只有老师可以更新课程'
            });
        }

        const { courseName, courseCode, description } = req.body;

        const connection = await pool.getConnection();

        try {
            // 验证课程是否存在且属于当前老师
            const [courseRows] = await connection.execute(
                'SELECT * FROM course WHERE id = ? AND teacherId = ?',
                [courseId, teacherId]
            );

            if (courseRows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: '课程不存在或无权修改'
                });
            }

            // 如果更新了课程代码，检查是否重复
            if (courseCode && courseCode !== courseRows[0].courseCode) {
                const [existingRows] = await connection.execute(
                    'SELECT id FROM course WHERE courseCode = ? AND id != ?',
                    [courseCode, courseId]
                );

                if (existingRows.length > 0) {
                    return res.status(400).json({
                        success: false,
                        message: '课程代码已存在'
                    });
                }
            }

            // 更新课程
            const updateFields = [];
            const updateValues = [];

            if (courseName !== undefined) {
                updateFields.push('courseName = ?');
                updateValues.push(courseName);
            }
            if (courseCode !== undefined) {
                updateFields.push('courseCode = ?');
                updateValues.push(courseCode);
            }
            if (description !== undefined) {
                updateFields.push('description = ?');
                updateValues.push(description);
            }

            if (updateFields.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: '没有需要更新的字段'
                });
            }

            updateValues.push(courseId);

            await connection.execute(
                `UPDATE course SET ${updateFields.join(', ')} WHERE id = ?`,
                updateValues
            );

            // 获取更新后的课程信息
            const [updatedRows] = await connection.execute(
                'SELECT * FROM course WHERE id = ?',
                [courseId]
            );

            res.json({
                success: true,
                message: '课程更新成功',
                data: updatedRows[0]
            });

        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('更新课程错误:', error);
        res.status(500).json({
            success: false,
            message: '服务器错误'
        });
    }
});

// 5. 删除课程接口（老师）
app.delete('/api/courses/:id', requireLogin, async (req, res) => {
    try {
        const courseId = req.params.id;
        const teacherId = req.user.id;
        const userRole = req.user.userRole;

        // 验证用户是否为老师
        if (userRole !== 'teacher') {
            return res.status(403).json({
                success: false,
                message: '只有老师可以删除课程'
            });
        }

        const connection = await pool.getConnection();

        try {
            // 验证课程是否存在且属于当前老师
            const [courseRows] = await connection.execute(
                'SELECT * FROM course WHERE id = ? AND teacherId = ?',
                [courseId, teacherId]
            );

            if (courseRows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: '课程不存在或无权删除'
                });
            }

            // 检查是否有签到任务关联此课程
            const [taskRows] = await connection.execute(
                'SELECT COUNT(*) as count FROM attendance_task WHERE courseId = ?',
                [courseId]
            );

            if (taskRows[0].count > 0) {
                return res.status(400).json({
                    success: false,
                    message: '该课程下存在签到任务，无法删除'
                });
            }

            // 删除课程（级联删除会同时删除course_class关联）
            await connection.execute(
                'DELETE FROM course WHERE id = ?',
                [courseId]
            );

            res.json({
                success: true,
                message: '课程删除成功'
            });

        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('删除课程错误:', error);
        res.status(500).json({
            success: false,
            message: '服务器错误'
        });
    }
});

// 6. 为课程添加班级接口（老师）
app.post('/api/courses/:id/classes', requireLogin, async (req, res) => {
    try {
        const courseId = req.params.id;
        const teacherId = req.user.id;
        const userRole = req.user.userRole;
        const { classIds } = req.body; // 数组，可以一次添加多个班级

        // 验证用户是否为老师
        if (userRole !== 'teacher') {
            return res.status(403).json({
                success: false,
                message: '只有老师可以为课程添加班级'
            });
        }

        if (!Array.isArray(classIds) || classIds.length === 0) {
            return res.status(400).json({
                success: false,
                message: '请提供有效的班级ID数组'
            });
        }

        const connection = await pool.getConnection();

        try {
            // 验证课程是否存在且属于当前老师
            const [courseRows] = await connection.execute(
                'SELECT * FROM course WHERE id = ? AND teacherId = ?',
                [courseId, teacherId]
            );

            if (courseRows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: '课程不存在或无权操作'
                });
            }

            // 验证所有班级是否存在
            const placeholders = classIds.map(() => '?').join(',');
            const [classRows] = await connection.execute(
                `SELECT id FROM class WHERE id IN (${placeholders})`,
                classIds
            );

            if (classRows.length !== classIds.length) {
                return res.status(400).json({
                    success: false,
                    message: '部分班级不存在'
                });
            }

            // 批量插入关联关系（忽略已存在的）
            const insertPromises = classIds.map(classId =>
                connection.execute(
                    'INSERT IGNORE INTO course_class (courseId, classId) VALUES (?, ?)',
                    [courseId, classId]
                )
            );

            await Promise.all(insertPromises);

            // 获取更新后的班级列表
            const [updatedClassRows] = await connection.execute(
                `SELECT c.id, c.className, c.classCode
                 FROM class c
                 INNER JOIN course_class cc ON c.id = cc.classId
                 WHERE cc.courseId = ?
                 ORDER BY c.className`,
                [courseId]
            );

            res.json({
                success: true,
                message: '班级添加成功',
                data: updatedClassRows
            });

        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('添加班级错误:', error);
        res.status(500).json({
            success: false,
            message: '服务器错误'
        });
    }
});

// 7. 学生选课接口
app.post('/api/courses/:id/select', requireLogin, async (req, res) => {
    try {
        const courseId = req.params.id;
        const studentId = req.user.id;
        const userRole = req.user.userRole;

        // 验证用户是否为学生
        if (userRole !== 'student') {
            return res.status(403).json({
                success: false,
                message: '只有学生可以选课'
            });
        }

        const connection = await pool.getConnection();

        try {
            // 验证课程是否存在
            const [courseRows] = await connection.execute(
                'SELECT * FROM course WHERE id = ?',
                [courseId]
            );

            if (courseRows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: '课程不存在'
                });
            }

            // 检查是否已经选过该课程
            const [existingRows] = await connection.execute(
                'SELECT * FROM student_course WHERE studentId = ? AND courseId = ?',
                [studentId, courseId]
            );

            if (existingRows.length > 0) {
                return res.status(400).json({
                    success: false,
                    message: '您已经选过该课程了'
                });
            }

            // 添加选课记录
            try {
                await connection.execute(
                    'INSERT INTO student_course (studentId, courseId) VALUES (?, ?)',
                    [studentId, courseId]
                );

                res.json({
                    success: true,
                    message: '选课成功'
                });
            } catch (insertError) {
                console.error('插入选课记录失败:', insertError);
                // 如果是重复键错误，说明已经选过课了
                if (insertError.code === 'ER_DUP_ENTRY') {
                    return res.status(400).json({
                        success: false,
                        message: '您已经选过该课程了'
                    });
                }
                // 如果是表不存在错误
                if (insertError.code === 'ER_NO_SUCH_TABLE') {
                    return res.status(500).json({
                        success: false,
                        message: '数据库表不存在，请先执行数据库迁移脚本创建student_course表'
                    });
                }
                throw insertError; // 重新抛出其他错误
            }

        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('选课错误:', error);
        console.error('错误详情:', {
            code: error.code,
            errno: error.errno,
            sqlMessage: error.sqlMessage,
            sql: error.sql
        });
        
        // 根据错误类型返回更具体的错误信息
        let errorMessage = '服务器错误';
        if (error.code === 'ER_NO_SUCH_TABLE') {
            errorMessage = '数据库表不存在，请先执行数据库迁移脚本';
        } else if (error.code === 'ER_DUP_ENTRY') {
            errorMessage = '您已经选过该课程了';
        } else if (error.code === 'ER_NO_REFERENCED_ROW_2') {
            errorMessage = '课程不存在';
        } else if (error.sqlMessage) {
            errorMessage = `数据库错误: ${error.sqlMessage}`;
        }
        
        res.status(500).json({
            success: false,
            message: errorMessage,
            error: process.env.NODE_ENV === 'development' ? error.message : undefined
        });
    }
});

// 8. 学生退课接口
app.delete('/api/courses/:id/select', requireLogin, async (req, res) => {
    try {
        const courseId = req.params.id;
        const studentId = req.user.id;
        const userRole = req.user.userRole;

        // 验证用户是否为学生
        if (userRole !== 'student') {
            return res.status(403).json({
                success: false,
                message: '只有学生可以退课'
            });
        }

        const connection = await pool.getConnection();

        try {
            // 删除选课记录
            const [result] = await connection.execute(
                'DELETE FROM student_course WHERE studentId = ? AND courseId = ?',
                [studentId, courseId]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    message: '您未选择该课程'
                });
            }

            res.json({
                success: true,
                message: '退课成功'
            });

        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('退课错误:', error);
        res.status(500).json({
            success: false,
            message: '服务器错误'
        });
    }
});

// 9. 从课程移除班级接口（老师）
app.delete('/api/courses/:id/classes/:classId', requireLogin, async (req, res) => {
    try {
        const courseId = req.params.id;
        const classId = req.params.classId;
        const teacherId = req.user.id;
        const userRole = req.user.userRole;

        // 验证用户是否为老师
        if (userRole !== 'teacher') {
            return res.status(403).json({
                success: false,
                message: '只有老师可以从课程移除班级'
            });
        }

        const connection = await pool.getConnection();

        try {
            // 验证课程是否存在且属于当前老师
            const [courseRows] = await connection.execute(
                'SELECT * FROM course WHERE id = ? AND teacherId = ?',
                [courseId, teacherId]
            );

            if (courseRows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: '课程不存在或无权操作'
                });
            }

            // 删除关联关系
            const [result] = await connection.execute(
                'DELETE FROM course_class WHERE courseId = ? AND classId = ?',
                [courseId, classId]
            );

            if (result.affectedRows === 0) {
                return res.status(404).json({
                    success: false,
                    message: '该班级未关联到此课程'
                });
            }

            res.json({
                success: true,
                message: '班级移除成功'
            });

        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('移除班级错误:', error);
        res.status(500).json({
            success: false,
            message: '服务器错误'
        });
    }
});

// ==================== 签到任务管理接口 ====================

// 老师发布签到任务接口（针对课程发布，推送给课程关联的所有班级）
app.post('/api/attendance-task', requireLogin, async (req, res) => {
    try {
        const teacherId = req.user.id;
        const userRole = req.user.userRole;

        // 验证用户是否为老师
        if (userRole !== 'teacher') {
            return res.status(403).json({
                success: false,
                message: '只有老师可以发布签到任务'
            });
        }

        // 从请求体读取课程ID和持续时间
        const { courseId, duration } = req.body || {};

        if (!courseId) {
            return res.status(400).json({
                success: false,
                message: '请提供课程ID（courseId）'
            });
        }

        if (typeof duration !== 'number' || !(duration > 0)) {
            return res.status(400).json({
                success: false,
                message: '请提供有效的持续时长（duration，单位：分钟）'
            });
        }
        const durationMs = Math.floor(duration) * 60 * 1000;

        // 限制最小时长（可按产品调整），不限制最大时长
        const MIN_MS = 60 * 1000;      // 1 分钟
        if (durationMs < MIN_MS) {
            return res.status(400).json({
                success: false,
                message: '持续时长不能小于 1 分钟'
            });
        }

        // 计算开始与结束时间（以服务器时间为准）
        const now = new Date();

        const formatDateTimeLocal = (date) => {
            const y = date.getFullYear();
            const m = String(date.getMonth() + 1).padStart(2, '0');
            const d = String(date.getDate()).padStart(2, '0');
            const hh = String(date.getHours()).padStart(2, '0');
            const mm = String(date.getMinutes()).padStart(2, '0');
            const ss = String(date.getSeconds()).padStart(2, '0');
            return `${y}-${m}-${d} ${hh}:${mm}:${ss}`;
        };

        const startTime = formatDateTimeLocal(now);
        const endTime = formatDateTimeLocal(new Date(now.getTime() + durationMs));

        // 任务名称自动生成（可被前端将来覆盖）
        const taskName = `签到任务-${formatDateTimeLocal(now)}`;

        const connection = await pool.getConnection();

        try {
            // 验证课程是否存在且属于当前老师
            const [courseRows] = await connection.execute(
                `SELECT c.*, u.userName as teacherName
                 FROM course c
                 LEFT JOIN user u ON c.teacherId = u.id
                 WHERE c.id = ? AND c.teacherId = ?`,
                [courseId, teacherId]
            );

            if (courseRows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: '课程不存在或无权操作'
                });
            }

            const course = courseRows[0];

            // 获取课程关联的所有班级
            const [classRows] = await connection.execute(
                `SELECT c.id, c.className, c.classCode
                 FROM class c
                 INNER JOIN course_class cc ON c.id = cc.classId
                 WHERE cc.courseId = ?`,
                [courseId]
            );

            if (classRows.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: '该课程未关联任何班级，请先为课程添加班级'
                });
            }

            // 创建签到任务（关联课程）
            const [result] = await connection.execute(
                'INSERT INTO attendance_task (taskName, teacherId, courseId, startTime, endTime) VALUES (?, ?, ?, ?, ?)',
                [taskName, teacherId, courseId, startTime, endTime]
            );

            const taskId = result.insertId;

            // 通过 Socket.IO 实时推送给课程关联的所有班级的学生
            if (global.io) {
                const taskInfo = {
                        id: taskId,
                        taskName: taskName,
                    courseId: courseId,
                    courseName: course.courseName,
                    courseCode: course.courseCode,
                        teacherId: teacherId,
                    teacherName: course.teacherName,
                        startTime: startTime,
                        endTime: endTime,
                    createTime: formatDateTimeLocal(now),
                        status: 'active'
                };

                // 推送给每个关联的班级
                classRows.forEach(classInfo => {
                    const roomName = `class-${classInfo.id}`;
                    global.io.to(roomName).emit('new-task', {
                        success: true,
                        message: '收到新的签到任务',
                        task: {
                            ...taskInfo,
                            classId: classInfo.id,
                            className: classInfo.className
                    }
                });
                console.log(`[Socket.IO] 签到任务已推送给房间: ${roomName}, 任务ID: ${taskId}`);
                });
            }

            res.json({
                success: true,
                message: '签到任务发布成功',
                data: {
                    taskId: taskId,
                    taskName: taskName,
                    courseId: courseId,
                    courseName: course.courseName,
                    startTime: startTime,
                    endTime: endTime,
                    affectedClasses: classRows.map(c => ({ id: c.id, className: c.className }))
                }
            });

        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('发布签到任务错误:', error);
        res.status(500).json({
            success: false,
            message: '服务器错误'
        });
    }
});

// 获取签到任务列表接口（支持按课程筛选）
app.get('/api/attendance-tasks', requireLogin, async (req, res) => {
    try {
        const userRole = req.user.userRole;
        const userId = req.user.id;
        const { courseId } = req.query;

        const connection = await pool.getConnection();

        try {
            let query = '';
            let params = [];

            if (userRole === 'teacher') {
                // 老师查看自己发布的任务（基于课程）
                query = `
                    SELECT at.*, co.courseName, co.courseCode, u.userName as teacherName
                    FROM attendance_task at
                    LEFT JOIN course co ON at.courseId = co.id
                    LEFT JOIN user u ON at.teacherId = u.id
                    WHERE at.teacherId = ?
                `;
                params = [userId];

                if (courseId) {
                    query += ' AND at.courseId = ?';
                    params.push(courseId);
                }
            } else if (userRole === 'student') {
                // 学生只查看自己明确选择的课程的签到任务
                query = `
                    SELECT at.*, co.courseName, co.courseCode, u.userName as teacherName,
                           CASE WHEN EXISTS (
                               SELECT 1
                               FROM attendance_record ar
                               WHERE ar.taskId = at.id AND ar.userId = ? AND ar.status = 1
                           ) THEN 1 ELSE 0 END AS hasCheckedIn
                    FROM attendance_task at
                    LEFT JOIN course co ON at.courseId = co.id
                    LEFT JOIN user u ON at.teacherId = u.id
                    WHERE EXISTS (
                        SELECT 1 FROM student_course sc 
                        WHERE sc.courseId = co.id AND sc.studentId = ?
                    )
                `;
                params = [userId, userId];

                if (courseId) {
                    query += ' AND at.courseId = ?';
                    params.push(courseId);
                }
            } else {
                return res.status(403).json({
                    success: false,
                    message: '权限不足'
                });
            }

            query += ' ORDER BY at.createTime DESC';

            const [rows] = await connection.execute(query, params);
            const now = new Date();

            const processedRows = rows.map(row => {
                const endTime = row.endTime ? new Date(row.endTime) : null;
                const isExpired = endTime ? endTime < now : false;

                if (userRole === 'student') {
                    const hasCheckedIn = Boolean(row.hasCheckedIn);
                    let statusValue = 'active';

                    if (hasCheckedIn) {
                        statusValue = 'completed';
                    } else if (isExpired) {
                        statusValue = 'inactive';
                    }

                    row.status = statusValue;
                    delete row.hasCheckedIn;
                } else {
                    row.status = isExpired ? 'inactive' : 'active';
                }

                return row;
            });

            res.json({
                success: true,
                message: '获取签到任务列表成功',
                data: processedRows
            });

        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('获取签到任务列表错误:', error);
        res.status(500).json({
            success: false,
            message: '服务器错误'
        });
    }
});

// 获取签到统计接口（老师专用）
app.get('/api/attendance-stats', requireLogin, async (req, res) => {
    try {
        const userRole = req.user.userRole;
        const { taskId } = req.query;

        if (userRole !== 'teacher') {
            return res.status(403).json({
                success: false,
                message: '只有老师可以查看签到统计'
            });
        }

        if (!taskId) {
            return res.status(400).json({
                success: false,
                message: '请提供任务ID'
            });
        }

        const connection = await pool.getConnection();

        try {
            // 获取任务信息
            const [taskRows] = await connection.execute(
                'SELECT * FROM attendance_task WHERE id = ?',
                [taskId]
            );

            if (taskRows.length === 0) {
                return res.status(404).json({
                    success: false,
                    message: '签到任务不存在'
                });
            }

            const task = taskRows[0];

            // 获取课程的所有学生总数（只统计明确选课的学生）
            const [studentRows] = await connection.execute(
                `SELECT COUNT(DISTINCT u.id) as total
                 FROM user u
                 INNER JOIN student_course sc ON u.id = sc.studentId
                 WHERE u.userRole = 'student'
                 AND sc.courseId = ?`,
                [task.courseId]
            );

            // 获取已签到学生数（只统计明确选课的学生）
            // 注意：签到记录可能已经存在，但需要确保该学生确实选课了
            const [attendanceRows] = await connection.execute(
                `SELECT COUNT(DISTINCT ar.userId) as checked 
                 FROM attendance_record ar
                 INNER JOIN user u ON ar.userId = u.id
                 INNER JOIN student_course sc ON u.id = sc.studentId AND sc.courseId = ?
                 WHERE ar.taskId = ? AND ar.status = 1
                 AND u.userRole = 'student'`,
                [task.courseId, taskId]
            );

            // 获取所有学生信息（只统计明确选课的学生）
            // 使用LEFT JOIN attendance_record来显示所有选课学生，包括已签到和未签到的
            const [detailRows] = await connection.execute(
                `SELECT DISTINCT u.id as userId, u.userName, u.userAccount, u.classId, c.className,
                        ar.checkTime, 
                        CASE WHEN ar.id IS NOT NULL AND ar.status = 1 THEN 1 ELSE 0 END as status
                 FROM user u
                 INNER JOIN student_course sc ON u.id = sc.studentId AND sc.courseId = ?
                 LEFT JOIN class c ON u.classId = c.id
                 LEFT JOIN attendance_record ar ON u.id = ar.userId AND ar.taskId = ? AND ar.status = 1
                 WHERE u.userRole = 'student'
                 ORDER BY status DESC, ar.checkTime DESC, u.userAccount ASC`,
                [task.courseId, taskId]
            );

            res.json({
                success: true,
                message: '获取签到统计成功',
                data: {
                    task: task,
                    totalStudents: studentRows[0].total,
                    checkedStudents: attendanceRows[0].checked,
                    attendanceRate: studentRows[0].total > 0 ?
                        (attendanceRows[0].checked / studentRows[0].total * 100).toFixed(2) + '%' : '0%',
                    details: detailRows
                }
            });

        } finally {
            connection.release();
        }

    } catch (error) {
        console.error('获取签到统计错误:', error);
        res.status(500).json({
            success: false,
            message: '服务器错误'
        });
    }
});

// 获取班级列表接口
app.get('/api/classes', async (req, res) => {
    try {
        const connection = await pool.getConnection();

        try {
            const [rows] = await connection.execute(
                'SELECT id, className, classCode FROM class ORDER BY className'
            );

            res.json({
                success: true,
                message: '获取班级列表成功',
                data: rows
            });
        } finally {
            connection.release();
        }
    } catch (error) {
        console.error('获取班级列表错误:', error);
        res.status(500).json({
            success: false,
            message: '服务器错误'
        });
    }
});

// 获取当前用户信息接口
app.get('/api/user-info', requireLogin, (req, res) => {
    res.json({
        success: true,
        message: '获取用户信息成功',
        data: {
            userId: req.user.id,
            userAccount: req.user.userAccount,
            userName: req.user.userName,
            userRole: req.user.userRole,
            classId: req.user.classId,
            className: req.user.className || null,
            faceRegistered: req.user.faceRegistered
        }
    });
});


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

// ==================== Socket.IO 配置 ====================
// 创建 HTTP 服务器
const httpServer = http.createServer(app);

// 创建 Socket.IO 服务器
const io = new Server(httpServer, {
    cors: {
        origin: "*",
        methods: ["GET", "POST"],
        credentials: true
    },
    transports: ['websocket', 'polling']
});

// Socket.IO 中间件：使用 JWT 进行身份验证
io.use((socket, next) => {
    try {
        const auth = socket.handshake && socket.handshake.auth || {};
        const headers = socket.handshake && socket.handshake.headers || {};
        let token = auth.token;
        const headerAuth = headers.authorization || headers.Authorization;
        if (!token && headerAuth && headerAuth.startsWith('Bearer ')) {
            token = headerAuth.substring(7);
        }
        if (!token) {
            return next(new Error('未提供访问令牌'));
        }
        const decoded = jwt.verify(token, JWT_SECRET);
        socket.userId = decoded.id;
        socket.userAccount = decoded.userAccount;
        socket.userName = decoded.userName;
        socket.userRole = decoded.userRole;
        socket.classId = decoded.classId;
        socket.className = decoded.className;
        return next();
    } catch (e) {
        return next(new Error('访问令牌无效或已过期'));
    }
});

// 用于存储 Socket.IO 的全局变量，供其他模块使用
global.io = io;

// Socket.IO 连接处理
io.on('connection', (socket) => {
    console.log(`[Socket.IO] 用户连接: ${socket.userAccount} (ID: ${socket.userId}, 角色: ${socket.userRole})`);

    // 学生加入班级房间
    if (socket.userRole === 'student' && socket.classId) {
        const roomName = `class-${socket.classId}`;
        socket.join(roomName);
        console.log(`[Socket.IO] 学生 ${socket.userAccount} 加入房间: ${roomName}`);
        
        // 通知客户端连接成功
        socket.emit('connected', {
            success: true,
            message: '连接成功',
            room: roomName,
            userInfo: {
                userId: socket.userId,
                userAccount: socket.userAccount,
                userName: socket.userName,
                classId: socket.classId
            }
        });
    } else if (socket.userRole === 'teacher') {
        // 老师连接
        console.log(`[Socket.IO] 老师 ${socket.userAccount} 已连接`);
        socket.emit('connected', {
            success: true,
            message: '连接成功',
            userInfo: {
                userId: socket.userId,
                userAccount: socket.userAccount,
                userName: socket.userName,
                role: 'teacher'
            }
        });
    }

    // 处理断开连接
    socket.on('disconnect', () => {
        console.log(`[Socket.IO] 用户断开连接: ${socket.userAccount}`);
    });

    // 处理心跳
    socket.on('ping', () => {
        socket.emit('pong', { timestamp: Date.now() });
    });

    // 学生请求签到任务列表（通过 Socket）
    socket.on('get-tasks', async () => {
        if (socket.userRole !== 'student' || !socket.classId) {
            socket.emit('tasks-response', {
                success: false,
                message: '权限不足'
            });
            return;
        }

        try {
            const connection = await pool.getConnection();
            try {
                const [rows] = await connection.execute(
                    `SELECT at.*, co.courseName, co.courseCode, u.userName as teacherName,
                            CASE WHEN EXISTS (
                                SELECT 1
                                FROM attendance_record ar
                                WHERE ar.taskId = at.id AND ar.userId = ? AND ar.status = 1
                            ) THEN 1 ELSE 0 END AS hasCheckedIn
                     FROM attendance_task at
                     LEFT JOIN course co ON at.courseId = co.id
                     LEFT JOIN user u ON at.teacherId = u.id
                     INNER JOIN course_class cc ON co.id = cc.courseId
                     WHERE cc.classId = ?
                     ORDER BY at.createTime DESC`,
                    [socket.userId, socket.classId]
                );

                const now = new Date();
                const processedRows = rows.map(row => {
                    const endTime = row.endTime ? new Date(row.endTime) : null;
                    const isExpired = endTime ? endTime < now : false;
                    const hasCheckedIn = Boolean(row.hasCheckedIn);

                    if (hasCheckedIn) {
                        row.status = 'completed';
                    } else if (isExpired) {
                        row.status = 'inactive';
                    } else {
                        row.status = 'active';
                    }

                    delete row.hasCheckedIn;
                    return row;
                });

                socket.emit('tasks-response', {
                    success: true,
                    data: processedRows
                });
            } finally {
                connection.release();
            }
        } catch (error) {
            console.error('获取签到任务列表错误:', error);
            socket.emit('tasks-response', {
                success: false,
                message: '获取任务列表失败'
            });
        }
    });
});

// ==================== 修改签到任务发布接口，添加 Socket 推送 ====================

// 启动服务器
const PORT = 3000;
httpServer.listen(PORT, () => {
    console.log(`服务器已启动，HTTP 端口: ${PORT}`);
    console.log(`Socket.IO 已启用，WebSocket 端口: ${PORT}`);
})