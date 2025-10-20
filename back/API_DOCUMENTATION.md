# 人脸识别系统 API 文档

## 接口概览

本系统提供完整的用户管理、角色权限、班级管理和签到功能。支持学生和老师两种角色，老师可以发布签到任务，学生通过人脸识别进行签到。

## 系统角色

- **学生 (student)**: 注册时必须选择班级，可以查看自己班级的签到任务并进行签到
- **老师 (teacher)**: 预置账号，可以发布签到任务、查看签到统计

## 数据库表结构

- `class`: 班级表
- `user`: 用户表（包含角色和班级关联）
- `attendance_task`: 签到任务表
- `attendance_record`: 签到记录表

## 1. 用户注册接口

**接口地址：** `POST /api/register`

**请求参数：**
```json
{
    "userAccount": "账号（3-20位，字母数字下划线）",
    "userPassword": "密码（6-20位，必须包含字母和数字）",
    "userName": "用户姓名（可选，最多50字符）",
    "classId": "班级ID（学生注册必填）"
}
```

**功能说明：**
- 只支持学生注册，角色固定为 `student`
- 学生注册时必须选择班级
- 老师账号已预置在数据库中，无需注册

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
        "userAccount": "student001",
        "userName": "张三",
        "userRole": "student",
        "classId": 1
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

学生登录成功：
```json
{
    "success": true,
    "message": "登录成功",
    "data": {
        "userId": 1,
        "userAccount": "student001",
        "userName": "张三",
        "userRole": "student",
        "classId": 1,
        "faceRegistered": 0
    }
}
```

老师登录成功：
```json
{
    "success": true,
    "message": "登录成功",
    "data": {
        "userId": 6,
        "userAccount": "teacher001",
        "userName": "张老师",
        "userRole": "teacher",
        "classId": 1,
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
        "userAccount": "student001",
        "userName": "张三",
        "userRole": "student",
        "classId": 1,
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
   - 验证签到任务（如果提供了taskId）
   - 自动记录签到到数据库
   - 返回用户信息和签到状态
4. 如果识别失败：
   - 返回未识别信息
   - 不进行签到记录

## 7. 获取班级列表接口

**接口地址：** `GET /api/classes`

**请求参数：** 无需参数

**功能说明：** 获取所有班级信息，供学生注册时选择

**响应示例：**
```json
{
    "success": true,
    "message": "获取班级列表成功",
    "data": [
        {
            "id": 1,
            "className": "计算机科学与技术2023级1班",
            "classCode": "CS2021-1"
        },
        {
            "id": 2,
            "className": "计算机科学与技术2023级2班",
            "classCode": "CS2021-2"
        }
    ]
}
```

## 8. 老师发布签到任务接口

**接口地址：** `POST /api/attendance-task`

**权限要求：** 需要老师登录

**请求参数：**
```json
{
    "taskName": "签到任务名称",
    "classId": "目标班级ID",
    "startTime": "2024-01-01 08:00:00",
    "endTime": "2024-01-01 09:00:00"
}
```

**参数说明：**
- `taskName`: 签到任务名称，最多100字符
- `classId`: 目标班级ID，必须是存在的班级，且必须是该老师所在的班级
- `startTime`: 签到开始时间，格式：YYYY-MM-DD HH:mm:ss
- `endTime`: 签到结束时间，必须晚于开始时间

**业务规则：**
- 只有老师可以发布签到任务
- 老师只能为自己所在的班级发布签到任务
- 任务名称最多100字符
- 开始时间必须早于结束时间
- 结束时间必须晚于当前时间
- 目标班级必须存在且老师必须属于该班级

**响应示例：**

成功发布：
```json
{
    "success": true,
    "message": "签到任务发布成功",
    "data": {
        "taskId": 1,
        "taskName": "上午签到",
        "classId": 1,
        "startTime": "2024-01-01 08:00:00",
        "endTime": "2024-01-01 09:00:00"
    }
}
```

权限错误示例：
```json
{
    "success": false,
    "message": "只有老师可以发布签到任务"
}
```

```json
{
    "success": false,
    "message": "您只能为自己所在的班级发布签到任务"
}
```

参数错误示例：
```json
{
    "success": false,
    "message": "任务名称、班级、开始时间和结束时间不能为空"
}
```

```json
{
    "success": false,
    "message": "选择的班级不存在"
}
```

```json
{
    "success": false,
    "message": "开始时间必须早于结束时间"
}
```

```json
{
    "success": false,
    "message": "结束时间必须晚于当前时间"
}
```

## 9. 获取签到任务列表接口

**接口地址：** `GET /api/attendance-tasks`

**权限要求：** 需要登录

**请求参数：**
- `status`: 可选，任务状态筛选（active/inactive/completed）
- `classId`: 可选，班级ID筛选（仅老师可用）

**功能说明：**
- 老师：查看自己发布的任务
- 学生：查看自己班级的任务

**响应示例：**
```json
{
    "success": true,
    "message": "获取签到任务列表成功",
    "data": [
        {
            "id": 1,
            "taskName": "上午签到",
            "teacherId": 6,
            "classId": 1,
            "startTime": "2024-01-01 08:00:00",
            "endTime": "2024-01-01 09:00:00",
            "status": "active",
            "className": "计算机科学与技术2021级1班",
            "teacherName": "张老师"
        }
    ]
}
```

## 10. 获取签到统计接口

**接口地址：** `GET /api/attendance-stats`

**权限要求：** 需要老师登录

**请求参数：**
- `taskId`: 签到任务ID（必需）

**功能说明：** 获取指定签到任务的统计信息，包括签到率、学生详情等

**响应示例：**
```json
{
    "success": true,
    "message": "获取签到统计成功",
    "data": {
        "task": {
            "id": 1,
            "taskName": "上午签到",
            "classId": 1,
            "startTime": "2024-01-01 08:00:00",
            "endTime": "2024-01-01 09:00:00",
            "status": "active"
        },
        "totalStudents": 30,
        "checkedStudents": 25,
        "attendanceRate": "83.33%",
        "details": [
            {
                "userName": "张三",
                "userAccount": "student001",
                "checkTime": "2024-01-01 08:15:30",
                "status": 1
            }
        ]
    }
}
```

## 预置数据

### 班级数据
- 计算机科学与技术2023级1班 (CS2023-1)
- 计算机科学与技术2023级2班 (CS2023-2)
- 软件工程2023级1班 (SE2023-1)
- 软件工程2023级2班 (SE2023-2)
- 人工智能2023级1班 (AI2023-1)

### 老师账号
- teacher001 (张老师) - 密码: 123456
- teacher002 (李老师) - 密码: 123456
- teacher003 (王老师) - 密码: 123456
- teacher004 (赵老师) - 密码: 123456
- teacher005 (刘老师) - 密码: 123456
