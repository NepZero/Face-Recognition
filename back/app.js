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

const fs = require('fs');
const path = require('path');


const express = require('express');
// const { formidable } = require('formidable');
const multer = require('multer');
const bcrypt = require('bcrypt');
const session = require('express-session');
const mysql = require('mysql2/promise');
const axios = require('axios');
const app = express();
const { spawn } = require('child_process');

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

            // 将用户信息存储到session
            req.session.userId = user.id;
            req.session.userAccount = user.userAccount;
            req.session.userName = user.userName;
            req.session.userRole = user.userRole;
            req.session.classId = user.classId;
            req.session.className = user.className || null;
            req.session.faceRegistered = user.faceRegistered;

            res.json({
                success: true,
                message: '登录成功',
                data: {
                    userId: user.id,
                    userAccount: user.userAccount,
                    userName: user.userName,
                    userRole: user.userRole,
                    classId: user.classId,
                    className: user.className || null,
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
app.post('/api/face-recognition', upload.single('imagefile'), async (req, res) => {
    try {
        const { taskId } = req.body; // 可选的签到任务ID

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
                // 查找用户信息
                const connection = await pool.getConnection();
                try {
                    const [rows] = await connection.execute(
                        'SELECT * FROM user WHERE id = ? ',
                        [recognitionResult.userId]
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
                        const [taskRows] = await connection.execute(
                            'SELECT * FROM attendance_task WHERE id = ? AND classId = ? AND status = "active" AND startTime <= NOW() AND endTime >= NOW()',
                            [taskId, user.classId]
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

// 老师发布签到任务接口
app.post('/api/attendance-task', requireLogin, async (req, res) => {
    try {
        const { taskName, classId, startTime, endTime } = req.body;
        const teacherId = req.session.userId;
        const userRole = req.session.userRole;

        // 验证用户是否为老师
        if (userRole !== 'teacher') {
            return res.status(403).json({
                success: false,
                message: '只有老师可以发布签到任务'
            });
        }

        // 验证输入
        if (!taskName || !classId || !startTime || !endTime) {
            return res.status(400).json({
                success: false,
                message: '任务名称、班级、开始时间和结束时间不能为空'
            });
        }

        // 验证时间格式和逻辑
        const start = new Date(startTime);
        const end = new Date(endTime);
        const now = new Date();

        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return res.status(400).json({
                success: false,
                message: '时间格式不正确'
            });
        }

        if (start >= end) {
            return res.status(400).json({
                success: false,
                message: '开始时间必须早于结束时间'
            });
        }

        if (end <= now) {
            return res.status(400).json({
                success: false,
                message: '结束时间必须晚于当前时间'
            });
        }

        const connection = await pool.getConnection();

        try {
            // 验证班级是否存在
            const [classRows] = await connection.execute(
                'SELECT id FROM class WHERE id = ?',
                [classId]
            );
            if (classRows.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: '选择的班级不存在'
                });
            }

            // 验证教师是否有权限为该班级发布签到任务
            const [teacherRows] = await connection.execute(
                'SELECT classId FROM user WHERE id = ? AND userRole = ?',
                [teacherId, 'teacher']
            );
            if (teacherRows.length === 0) {
                return res.status(403).json({
                    success: false,
                    message: '教师信息不存在'
                });
            }

            const teacherClassId = teacherRows[0].classId;
            if (teacherClassId !== parseInt(classId)) {
                return res.status(403).json({
                    success: false,
                    message: '您只能为自己所在的班级发布签到任务'
                });
            }

            // 创建签到任务
            const [result] = await connection.execute(
                'INSERT INTO attendance_task (taskName, teacherId, classId, startTime, endTime) VALUES (?, ?, ?, ?, ?)',
                [taskName, teacherId, classId, startTime, endTime]
            );

            res.json({
                success: true,
                message: '签到任务发布成功',
                data: {
                    taskId: result.insertId,
                    taskName: taskName,
                    classId: classId,
                    startTime: startTime,
                    endTime: endTime
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

// 获取签到任务列表接口
app.get('/api/attendance-tasks', requireLogin, async (req, res) => {
    try {
        const userRole = req.session.userRole;
        const userId = req.session.userId;
        const { status, classId } = req.query;

        const connection = await pool.getConnection();

        try {
            let query = '';
            let params = [];

            if (userRole === 'teacher') {
                // 老师查看自己发布的任务
                query = `
                    SELECT at.*, c.className, u.userName as teacherName
                    FROM attendance_task at
                    LEFT JOIN class c ON at.classId = c.id
                    LEFT JOIN user u ON at.teacherId = u.id
                    WHERE at.teacherId = ?
                `;
                params = [userId];

                if (status) {
                    query += ' AND at.status = ?';
                    params.push(status);
                }
                if (classId) {
                    query += ' AND at.classId = ?';
                    params.push(classId);
                }
            } else if (userRole === 'student') {
                // 学生查看自己班级的任务
                query = `
                    SELECT at.*, c.className, u.userName as teacherName
                    FROM attendance_task at
                    LEFT JOIN class c ON at.classId = c.id
                    LEFT JOIN user u ON at.teacherId = u.id
                    LEFT JOIN user student ON student.id = ?
                    WHERE at.classId = student.classId
                `;
                params = [userId];

                if (status) {
                    query += ' AND at.status = ?';
                    params.push(status);
                }
            } else {
                return res.status(403).json({
                    success: false,
                    message: '权限不足'
                });
            }

            query += ' ORDER BY at.createTime DESC';

            const [rows] = await connection.execute(query, params);

            res.json({
                success: true,
                message: '获取签到任务列表成功',
                data: rows
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
        const userRole = req.session.userRole;
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

            // 获取班级学生总数
            const [studentRows] = await connection.execute(
                'SELECT COUNT(*) as total FROM user WHERE classId = ? AND userRole = "student"',
                [task.classId]
            );

            // 获取已签到学生数
            const [attendanceRows] = await connection.execute(
                'SELECT COUNT(DISTINCT userId) as checked FROM attendance_record WHERE taskId = ? AND status = 1',
                [taskId]
            );

            // 获取签到详情
            const [detailRows] = await connection.execute(
                `SELECT u.userName, u.userAccount, ar.checkTime, ar.status
                 FROM attendance_record ar
                 LEFT JOIN user u ON ar.userId = u.id
                 WHERE ar.taskId = ?
                 ORDER BY ar.checkTime DESC`,
                [taskId]
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
            userRole: req.session.userRole,
            classId: req.session.classId,
            className: req.session.className || null,
            faceRegistered: req.session.faceRegistered
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

app.listen(3000, () => {
    console.log('服务器已经执行');
})