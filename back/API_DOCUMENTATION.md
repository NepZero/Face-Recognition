# 人脸识别系统 API 文档

## 接口概览

本系统提供六个核心接口，支持用户管理和人脸识别功能。人脸识别接口集成了自动签到功能，简化了业务流程。

## 1. 用户注册接口

**接口地址：** `POST /api/register`

**请求参数：**
```json
{
    "userAccount": "账号（3-20位，字母数字下划线）",
    "userPassword": "密码（6-20位，必须包含字母和数字）",
    "userName": "用户姓名（可选，最多50字符）"
}
```

**参数校验规则：**
- `userAccount`: 只能包含字母、数字、下划线，长度3-20位
- `userPassword`: 必须包含字母和数字，长度6-20位，可包含特殊字符@$!%*?&
- `userName`: 可选字段，最多50个字符

**响应示例：**

注册成功：
```json
{
    "success": true,
    "message": "注册成功",
    "data": {
        "userId": 1,
        "userAccount": "testuser",
        "userName": "测试用户"
    }
}
```

校验失败示例：
```json
{
    "success": false,
    "message": "账号格式不正确，只能包含字母、数字、下划线，长度3-20位"
}
```

```json
{
    "success": false,
    "message": "密码格式不正确，必须包含字母和数字，长度6-20位"
}
```

## 2. 用户登录接口

**接口地址：** `POST /api/login`

**请求参数：**
```json
{
    "userAccount": "账号",
    "userPassword": "密码"
}
```

**响应示例：**
```json
{
    "success": true,
    "message": "登录成功",
    "data": {
        "userId": 1,
        "userAccount": "testuser",
        "userName": "测试用户",
        "faceRegistered": 0
    }
}
```

**注意**：登录成功后，系统会自动创建Session，浏览器会保存Session Cookie，后续请求会自动携带，无需手动处理认证信息。

## 3. 用户登出接口

**接口地址：** `POST /api/logout`

**请求参数：** 无需参数，使用Session认证

**响应示例：**
```json
{
    "success": true,
    "message": "登出成功"
}
```

**注意**：登出后Session会被销毁，需要重新登录才能访问需要认证的接口。

## 4. 获取用户信息接口

**接口地址：** `GET /api/user-info`

**请求参数：** 无需参数，使用Session认证

**响应示例：**

成功获取：
```json
{
    "success": true,
    "message": "获取用户信息成功",
    "data": {
        "userId": 1,
        "userAccount": "testuser",
        "userName": "测试用户",
        "faceRegistered": 1
    }
}
```

未登录：
```json
{
    "success": false,
    "message": "未登录"
}
```

## 5. 人脸注册接口(暂时无法使用，需等待算法组接口开发)

**接口地址：** `POST /api/face-register`

**请求方式：** `multipart/form-data`

**请求参数：**
- `userId`: 用户ID（必需）
- `imagefile`: 人脸图片文件（必需）

**响应示例：**
```json
{
    "success": true,
    "message": "人脸注册成功",
    "data": {
        "userId": 1
    }
}
```

## 6. 人脸识别接口（包含自动签到）(暂时无法使用，需等待算法组接口开发)

**接口地址：** `POST /api/face-recognition`

**请求方式：** `multipart/form-data`

**功能说明：**
- 上传人脸图片进行识别
- 识别成功后自动记录签到
- 返回用户信息和签到状态

**请求参数：**
- `imagefile`: 待识别的人脸图片文件（必需）

**响应示例：**

识别成功（自动签到）：
```json
{
    "success": true,
    "message": "人脸识别成功，已自动签到",
    "data": {
        "recognized": true,
        "userId": 1,
        "userAccount": "testuser",
        "userName": "测试用户",
        "attendanceRecorded": true
    }
}
```

识别失败：
```json
{
    "success": true,
    "message": "未识别到已知人脸",
    "data": {
        "recognized": false,
        "attendanceRecorded": false
    }
}
```

**业务逻辑：**
1. 接收人脸图片文件
2. 调用算法组接口进行人脸识别
3. 如果识别成功：
   - 查询用户详细信息
   - 自动记录签到到数据库
   - 返回用户信息和签到状态
4. 如果识别失败：
   - 返回未识别信息
   - 不进行签到记录
