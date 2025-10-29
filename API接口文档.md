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

**字段类型：**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| userAccount | string | 是 | 3-20 位，字母/数字/下划线 |
| userPassword | string | 是 | 6-20 位，需包含字母和数字 |
| userName | string | 否 | 最多 50 字符 |
| classId | number | 是 | 目标班级 ID |

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

**响应字段类型：**

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| success | boolean | 是否成功 |
| message | string | 提示信息 |
| data.userId | number | 新用户 ID |
| data.userAccount | string | 账号 |
| data.userName | string | 姓名 |
| data.userRole | string | 角色：student |
| data.classId | number | 班级 ID |

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

**字段类型：**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| userAccount | string | 是 | 登录账号 |
| userPassword | string | 是 | 登录密码 |

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

**响应字段类型：**

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| success | boolean | 是否成功 |
| message | string | 提示信息 |
| data.userId | number | 用户 ID |
| data.userAccount | string | 账号 |
| data.userName | string | 姓名 |
| data.userRole | string | 角色：student/teacher |
| data.classId | number | 班级 ID |
| data.faceRegistered | number | 是否注册人脸：0/1 |

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

（字段类型同上）

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

**响应字段类型：**

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| success | boolean | 是否成功 |
| message | string | 提示信息 |

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

**响应字段类型：**

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| success | boolean | 是否成功 |
| message | string | 提示信息 |
| data.userId | number | 用户 ID |
| data.userAccount | string | 账号 |
| data.userName | string | 姓名 |
| data.userRole | string | 角色 |
| data.classId | number | 班级 ID |
| data.faceRegistered | number | 是否注册人脸：0/1 |

未登录：
```json
{
    "success": false,
    "message": "未登录"
}
```

## 5. 人脸注册接口（已对接算法，自动保存样本并重训练）

**接口地址：** `POST /api/face-register`

**请求方式：** `multipart/form-data`

**请求参数：**
- `userId`: 用户ID（必需）
- `imagefile`: 人脸图片文件（必需）

**字段类型：**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| userId | number | 是 | 待注册的用户 ID |
| imagefile | file | 是 | 字段名固定为 `imagefile`，人脸图片（二进制，<= 20MB） |

**响应示例：**

首次注册（冷启动）：
```json
{
    "success": true,
    "message": "人脸注册成功（首次注册）",
    "data": {
        "userId": 1,
        "savedToDataset": true,
        "retrained": true,
        "coldStart": true
    }
}
```

非首次注册（已有人脸记录）：
```json
{
    "success": true,
    "message": "人脸注册成功",
    "data": {
        "userId": 1,
        "savedToDataset": true,
        "retrained": true,
        "coldStart": false
    }
}
```

**响应字段说明：**

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| success | boolean | 是否成功 |
| message | string | 提示信息 |
| data.userId | number | 用户 ID |
| data.savedToDataset | boolean | 是否已保存到训练集 |
| data.retrained | boolean | 是否已重新训练 |
| data.coldStart | boolean | 是否为首次注册（首次注册跳过识别校验） |

（标准错误响应同样包含字段：success:boolean, message:string）

**业务逻辑：**

1. **首次注册（coldStart: true）**：
   - 当用户 `faceRegistered=0` 时，跳过识别校验
   - 直接将上传图片保存到训练集 `opencv/face_get/Facedata/<name>.<userId>.<timestamp>.<ext>`
   - 立即触发训练脚本更新模型
   - 更新用户状态为已注册

2. **非首次注册（coldStart: false）**：
   - 先调用 Python 识别脚本校验人脸
   - 只有当识别结果与 `userId` 匹配时，才保存样本并重训练
   - 用于追加更多训练样本，提高识别准确率

**错误说明与映射：**
- `用户不存在`：提供的 `userId` 在数据库中不存在
- `未收到图片文件`：未携带 `imagefile` 字段或为空
- `人脸注册失败：未识别到该用户的人脸`：非首次注册时，算法识别到的人脸与 `userId` 不一致
- `人脸注册失败，请重试`：算法调用或解析失败（可查看后端日志的 `[Python stderr]`）

**实现要点：**
- 上传字段名必须为 `imagefile`
- 算法使用 Python 子进程调用，必要时可通过环境变量 `PYTHON_EXE` 指定解释器路径
- 首次注册自动跳过识别校验，直接入库并重训练
- 非首次注册需要识别校验通过后才保存样本
- 每次注册成功后都会触发训练脚本，更新 `face_trainer/trainer.yml`

## 6. 人脸识别接口（包含自动签到，已对接算法）

**接口地址：** `POST /api/face-recognition`

**请求方式：** `multipart/form-data`

**功能说明：**
- 上传人脸图片进行识别
- 识别成功后自动记录签到
- 返回用户信息和签到状态

**请求参数：**
- `imagefile`: 待识别的人脸图片文件（必需）
 - `taskId`: 签到任务ID（可选）

**字段类型：**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| imagefile | file | 是 | 字段名固定为 `imagefile`，待识别人脸图片（二进制，<= 20MB） |
| taskId | number | 否 | 若提供，则在有效时间窗内自动签到 |

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

**响应字段类型（识别成功）：**

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| success | boolean | 是否成功 |
| message | string | 提示信息 |
| data.recognized | boolean | 是否识别到已知人脸 |
| data.userId | number | 用户 ID |
| data.userAccount | string | 账号 |
| data.userName | string | 姓名 |
| data.attendanceRecorded | boolean | 是否记录签到 |
| data.taskId | number/null | 绑定的任务 ID |

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

**响应字段类型（识别失败）：** 同上，但 `data.recognized=false`，无用户信息，`attendanceRecorded=false`。

**错误说明与映射：**
- `未收到图片文件`：未携带 `imagefile` 字段或为空
- `用户信息查询失败`：算法识别出的 `userId` 在数据库不存在
- `人脸识别失败`：算法调用或解析失败（可查看后端日志的 `[Python stderr]`）

**实现要点：**
- 若提供 `taskId`，后端将校验任务属于该用户班级、状态为 active 且在有效时间窗内
- 校验通过自动写入 `attendance_record`，失败仅影响 `attendanceRecorded` 字段，不影响识别结果返回

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
            "classCode": "CS2023-1"
        },
        {
            "id": 2,
            "className": "计算机科学与技术2023级2班",
            "classCode": "CS2023-2"
        }
    ]
}
```

**响应字段类型（列表项）：**

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| success | boolean | 是否成功 |
| message | string | 提示信息 |
| data[].id | number | 班级 ID |
| data[].className | string | 班级名称 |
| data[].classCode | string | 班级编码 |

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

**字段类型：**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| taskName | string | 是 | 最多 100 字符 |
| classId | number | 是 | 老师所属班级 ID |
| startTime | string(datetime) | 是 | 开始时间，YYYY-MM-DD HH:mm:ss |
| endTime | string(datetime) | 是 | 结束时间，需晚于开始时间 |

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

**响应字段类型：**

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| success | boolean | 是否成功 |
| message | string | 提示信息 |
| data.taskId | number | 新任务 ID |
| data.taskName | string | 任务名 |
| data.classId | number | 班级 ID |
| data.startTime | string(datetime) | 开始时间 |
| data.endTime | string(datetime) | 结束时间 |

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

**字段类型：**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| status | string | 否 | active/inactive/completed |
| classId | number | 否 | 仅老师可用的筛选条件 |

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

**响应字段类型（列表项）：**

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| success | boolean | 是否成功 |
| message | string | 提示信息 |
| data[].id | number | 任务 ID |
| data[].taskName | string | 任务名 |
| data[].teacherId | number | 发布老师 ID |
| data[].classId | number | 班级 ID |
| data[].startTime | string(datetime) | 开始时间 |
| data[].endTime | string(datetime) | 结束时间 |
| data[].status | string | 任务状态 |
| data[].className | string | 班级名 |
| data[].teacherName | string | 老师名 |

## 10. 获取签到统计接口

**接口地址：** `GET /api/attendance-stats`

**权限要求：** 需要老师登录

**请求参数：**
- `taskId`: 签到任务ID（必需）

**字段类型：**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| taskId | number | 是 | 目标签到任务 ID |

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

**响应字段类型：**

| 字段 | 类型 | 说明 |
| --- | --- | --- |
| success | boolean | 是否成功 |
| message | string | 提示信息 |
| data.task.id | number | 任务 ID |
| data.task.taskName | string | 任务名 |
| data.task.classId | number | 班级 ID |
| data.task.startTime | string(datetime) | 开始时间 |
| data.task.endTime | string(datetime) | 结束时间 |
| data.task.status | string | 任务状态 |
| data.totalStudents | number | 班级总人数 |
| data.checkedStudents | number | 已签到人数 |
| data.attendanceRate | string | 百分比字符串 |
| data.details[].userName | string | 学生姓名 |
| data.details[].userAccount | string | 学号/账号 |
| data.details[].checkTime | string(datetime) | 签到时间 |
| data.details[].status | number | 签到状态（1成功） |

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