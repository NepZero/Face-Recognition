const express = require('express');
// const { formidable } = require('formidable');
const multer = require('multer');
const path = require('path');
const app = express();


const publicDir = path.join(__dirname, './public');
console.log(publicDir);
// 配置 multer
const storage = multer.diskStorage({
    destination: (req, file, cb) =>
    {
        cb(null, publicDir);
    },
    filename: (req, file, cb) =>
    {
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
app.use((req, res, next) =>
{
    res.header('Access-Control-Allow-Origin', '*');
    res.header('Access-Control-Allow-Headers', '*');
    res.header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    if (req.method === 'OPTIONS')
    {
        return res.sendStatus(200);
    }
    next();
});

app.get('/home', (req, res) =>
{
    res.json({
        message: 'Hello',
        status: 'success',
        data: {
            text: 'Hello from server!',
            timestamp: new Date()
        }
    });
})
app.get('', (req, res) =>
{
    res.send('Hello');
})

app.post('/send', upload.single('imagefile'), (req, res) =>
{
    try
    {
        console.log('收到上传请求');
        console.log('文件:', req.file);
        console.log('表单数据:', req.body);

        if (!req.file)
        {
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
    } catch (error)
    {
        console.error('上传错误:', error);
        res.status(500).json({
            error: '文件上传失败',
            message: error.message
        });
    }
})

app.listen(3000, () =>
{
    console.log('服务器已经执行');
})