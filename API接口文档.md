# 人脸识别系统 API 文档

## 接口概览

本系统提供完整的用户管理、角色权限、班级管理和签到功能。支持学生和老师两种角色，老师可以发布签到任务，学生通过人脸识别进行签到。

**通信方式**：
- **RESTful API**：用于数据查询、提交操作（签到提交、统计查询等）
- **Socket.IO 实时通信**：用于任务实时推送，学生无需轮询即可收到新任务通知

**推荐使用方式**：
- 实时任务推送：使用 Socket.IO（避免频繁轮询）
- 数据查询和提交：使用 REST API

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
        "classId": 1,
        "className": "计算机科学与技术2023级1班"
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
| data.className | string | 班级名称 |

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
        "className": "计算机科学与技术2023级1班",
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
| data.className | string/null | 班级名称，老师可能为null |
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
        "className": "计算机科学与技术2023级1班",
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
        "className": "计算机科学与技术2023级1班",
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
| data.className | string/null | 班级名称，可能为null |
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

**权限要求：** 无需登录（但建议在生产环境添加认证）

**行为摘要：**
- 接收用户上传的人脸图片
- 根据用户 `faceRegistered` 状态决定是否进行识别校验
- 首次注册（冷启动）：跳过识别，直接保存样本并触发训练
- 非首次注册：先识别校验，通过后保存样本并触发训练
- 自动更新数据库 `user.faceRegistered=1`

**请求参数：**
- `userId`: 用户ID（必需）
- `imagefile`: 人脸图片文件（必需）

**字段类型：**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| userId | number | 是 | 待注册的用户 ID，必须与数据库 `user.id` 一致 |
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
| data.savedToDataset | boolean | 是否已保存到训练集 `Facedata/` |
| data.retrained | boolean | 是否已重新训练（更新 `trainer.yml`） |
| data.coldStart | boolean | 是否为首次注册（首次注册跳过识别校验） |

**状态码说明：**

| HTTP 状态码 | 场景 | 响应示例 |
| --- | --- | --- |
| 200 | 注册成功 | `{ "success": true, "message": "人脸注册成功", "data": {...} }` |
| 400 | 参数错误 | `{ "success": false, "message": "用户ID不能为空" }` |
| 400 | 非首次注册识别失败 | `{ "success": false, "message": "人脸注册失败：未识别到该用户的人脸" }` |
| 404 | 用户不存在 | `{ "success": false, "message": "用户不存在" }` |
| 500 | 服务器错误 | `{ "success": false, "message": "人脸注册失败，请重试" }` |

**错误说明与映射：**

| 错误信息 | HTTP 状态码 | 可能原因 | 解决方案 |
| --- | --- | --- | --- |
| `用户ID不能为空` | 400 | 未提供 `userId` 字段 | 在 `formData` 中携带 `userId` |
| `未收到图片文件` | 400 | `imagefile` 字段缺失或为空 | 检查前端上传代码，确保字段名为 `imagefile` |
| `用户不存在` | 404 | 提供的 `userId` 在数据库不存在 | 验证用户 ID，确保数据库中存在该用户 |
| `人脸注册失败：未识别到该用户的人脸` | 400 | 非首次注册时，算法识别出的人脸 ID 与提交的 `userId` 不一致 | 1. 检查训练集文件名的 `id` 是否与数据库对齐<br>2. 确认上传的图片确实是该用户的人脸<br>3. 重新训练模型 |
| `人脸注册失败，请重试` | 500 | Python 脚本调用失败或解析错误 | 查看后端日志的 `[Python stderr]`，检查 Python 环境和依赖 |

**业务逻辑：**

1. **首次注册（coldStart: true）**：
   - 当用户 `faceRegistered=0` 时，跳过识别校验（冷启动）
   - 直接将上传图片保存到训练集 `opencv/face_get/Facedata/<name>.<userId>.<timestamp>.<ext>`
   - 立即触发训练脚本 `trainner.py`，更新模型 `face_trainer/trainer.yml`
   - 更新数据库：`UPDATE user SET faceRegistered=1 WHERE id=?`
   - 返回成功响应（`coldStart: true`）

2. **非首次注册（coldStart: false）**：
   - 先调用 Python 识别脚本 `rec.py` 进行人脸识别校验
   - 只有当识别结果 `recognized=true` 且 `返回的 userId == 入参 userId` 时，才保存样本并重训练
   - 用于追加更多训练样本，提高识别准确率
   - 若识别失败或不匹配，返回 400 错误，防止误将他人照片加入训练集

**实现要点：**
- 上传字段名必须为 `imagefile`（与后端 `upload.single('imagefile')` 对应）
- 算法使用 Python 子进程调用，必要时可通过环境变量 `PYTHON_EXE` 指定解释器路径
- 首次注册自动跳过识别校验，直接入库并重训练（适合初始部署场景）
- 非首次注册需要识别校验通过后才保存样本（防止数据污染）
- 每次注册成功后都会触发训练脚本，更新 `face_trainer/trainer.yml`
- 训练脚本触发机制：
  - **离线训练**：部署前手动运行 `py -3 opencv/face_get/trainner.py`
  - **在线训练**：注册接口成功后自动调用 `runPythonTraining()`（子进程执行 `trainner.py`）

**训练与识别脚本的离线与在线触发机制：**

1. **离线训练**（初始部署）：
   - 在部署前，手动准备训练数据到 `Facedata/` 目录
   - 运行命令：`py -3 opencv/face_get/trainner.py`
   - 生成初始 `trainer.yml` 模型文件
   - 部署时将该模型文件一并打包

2. **在线训练**（运行时自动触发）：
   - 每次人脸注册成功后，后端自动调用 `runPythonTraining()`
   - 该函数通过子进程执行 `trainner.py`，更新模型
   - 识别脚本 `rec.py` 每次调用时读取最新的 `trainer.yml`

**数据命名规则与触发时机：**

- **训练数据命名规则**：`<name>.<id>.<index>.<ext>`
  - `name`：用户名称（便于识别，仅用于辅助）
  - `id`：**必须与数据库 `user.id` 完全一致**（这是联通的关键）
  - `index`：时间戳或序号（用于区分同一用户的多张样本）
  - `ext`：图片扩展名（`.jpg`, `.jpeg`, `.png`）
  - 示例：`gpt.6.1759567764706.jpg` 表示用户 ID=6

- **触发时机**：
  - **首次注册**：注册接口检测到 `faceRegistered=0`，直接保存样本并触发训练
  - **非首次注册**：注册接口检测到 `faceRegistered=1`，先识别校验，通过后保存样本并触发训练
  - **新增用户后识别不到**：需手动将用户的人脸样本放入 `Facedata/` 并重新训练

**数据对齐的重要性：**

- **核心原则**：训练集文件名中的 `id` 必须与数据库 `user.id` 一致
- **对齐流程**：
  1. 数据库中新增用户，获得 `user.id`（如 6）
  2. 将用户的人脸样本命名为 `name.6.index.jpg`，放入 `Facedata/`
  3. 运行训练脚本生成/更新 `trainer.yml`
  4. 识别时，算法返回 `userId=6`，后端通过 `WHERE id=6` 查询用户信息
- **数据不一致的后果**：
  - 识别出的 `userId` 无法在数据库中匹配到用户
  - 人脸注册接口返回"未识别到该用户的人脸"（即使识别成功）
  - 人脸识别接口返回"用户信息查询失败"

## 6. 人脸识别接口（包含自动签到，已对接算法）

**接口地址：** `POST /api/face-recognition`

**请求方式：** `multipart/form-data`

**权限要求：** 无需登录（但建议在生产环境添加认证）

**行为摘要：**
- 接收上传的人脸图片
- 调用 Python 识别脚本 `rec.py` 进行人脸识别
- 识别成功后查询用户信息
- 若提供 `taskId` 且任务有效，自动写入签到记录
- 返回识别结果与签到状态

**功能说明：**
- 上传人脸图片进行识别
- 识别成功后自动记录签到（如果提供了有效的 `taskId`）
- 返回用户信息和签到状态

**请求参数：**
- `imagefile`: 待识别的人脸图片文件（必需）
- `taskId`: 签到任务ID（可选）

**字段类型：**

| 字段 | 类型 | 必填 | 说明 |
| --- | --- | --- | --- |
| imagefile | file | 是 | 字段名固定为 `imagefile`，待识别人脸图片（二进制，<= 20MB） |
| taskId | number | 否 | 若提供，则在有效时间窗内自动签到（任务需属于用户班级且状态为 active） |

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

**状态码说明：**

| HTTP 状态码 | 场景 | 响应示例 |
| --- | --- | --- |
| 200 | 识别成功或失败（正常响应） | `{ "success": true, "message": "人脸识别成功，已自动签到", "data": {...} }` |
| 200 | 未识别到已知人脸（正常响应） | `{ "success": true, "message": "未识别到已知人脸", "data": { "recognized": false } }` |
| 400 | 参数错误 | `{ "success": false, "message": "未收到图片文件" }` |
| 500 | 服务器错误 | `{ "success": false, "message": "用户信息查询失败" }` |
| 500 | 算法调用失败 | `{ "success": false, "message": "人脸识别失败", "error": "..." }` |

**错误说明与映射：**

| 错误信息 | HTTP 状态码 | 可能原因 | 解决方案 |
| --- | --- | --- | --- |
| `未收到图片文件` | 400 | `imagefile` 字段缺失或为空 | 检查前端上传代码，确保字段名为 `imagefile` |
| `用户信息查询失败` | 500 | 算法识别出的 `userId` 在数据库不存在 | 1. 检查训练集文件名的 `id` 是否与数据库对齐<br>2. 确认数据库中是否存在该用户<br>3. 重新训练模型 |
| `人脸识别失败` | 500 | Python 脚本调用失败或解析错误 | 查看后端日志的 `[Python stderr]`，检查 Python 环境和依赖 |

**业务逻辑：**

1. **接收与保存**：
   - 接收 `multipart/form-data` 请求
   - multer 保存文件到 `back/public/imagefile-<timestamp>-<rand>.<ext>`
   - 生成图片绝对路径

2. **调用识别算法**：
   - 后端调用 `runPythonRecognition(absImagePath)`
   - Python 子进程执行：`py -3 opencv/face_get/rec.py <图片路径>`
   - `rec.py` 读取 `trainer.yml`，进行 LBPH 人脸识别
   - 从 stdout 返回 JSON：`{"recognized": true, "userId": 6, "userName": "gpt"}` 或 `{"recognized": false}`

3. **识别成功处理**：
   - 若 `recognized=true`，查询数据库获取用户信息：`SELECT * FROM user WHERE id = ?`
   - 若用户不存在，返回 500 "用户信息查询失败"
   - 若提供了 `taskId`，校验签到任务：
     - 查询任务：`SELECT * FROM attendance_task WHERE id = ? AND classId = ? AND status='active' AND startTime<=NOW() AND endTime>=NOW()`
     - 若任务有效，自动写入签到记录：`INSERT INTO attendance_record (userId, taskId, checkTime, status) VALUES (?, ?, NOW(), 1)`
     - 若任务无效，`attendanceRecorded=false`（不影响识别成功响应）

4. **识别失败处理**：
   - 若 `recognized=false`，返回 `{"recognized": false, "attendanceRecorded": false}`
   - 不进行签到记录

**实现要点：**
- 上传字段名必须为 `imagefile`（与后端 `upload.single('imagefile')` 对应）
- 算法使用 Python 子进程调用，必要时可通过环境变量 `PYTHON_EXE` 指定解释器路径
- 若提供 `taskId`，后端将校验任务属于该用户班级、状态为 active 且在有效时间窗内
- 校验通过自动写入 `attendance_record`，失败仅影响 `attendanceRecorded` 字段，不影响识别结果返回
- 识别失败（`recognized=false`）不是错误，正常返回 200 状态码

**前端集成要点：**
- 使用 `multipart/form-data` 格式
- 字段名必须为 `imagefile`（固定，不能修改）
- 文件大小限制：<= 20MB
- 支持格式：`.jpg`, `.jpeg`, `.png`
- `taskId` 为可选参数，number 类型

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

## 8. 老师发布签到任务接口（含实时推送）

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
- **任务发布成功后，系统会立即通过 Socket.IO 推送给对应班级的所有在线学生**

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

**Socket.IO 实时推送说明**：

当任务发布成功后，系统会自动通过 Socket.IO 向目标班级的房间推送新任务。所有在该班级房间的在线学生都会收到 `new-task` 事件（事件数据结构见"11. Socket.IO 实时通信接口"）。

学生前端只需监听 `new-task` 事件，即可实时收到新任务，无需轮询 API。

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

## 9. 获取签到任务列表接口（支持 Socket.IO）

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

**Socket.IO 方式（推荐）**：
学生也可以通过 Socket.IO 请求任务列表，发送 `get-tasks` 事件，监听 `tasks-response` 响应（详见"11. Socket.IO 实时通信接口"）。

**推荐使用方式**：
- **实时接收新任务**：使用 Socket.IO 监听 `new-task` 事件（自动推送）
- **查询任务列表**：使用 REST API 或 Socket.IO 的 `get-tasks` 事件（按需查询）

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

## 11. Socket.IO 实时通信接口

**连接地址：** `ws://your-server:3000` 或 `http://your-server:3000`

**权限要求：** 需要登录（通过 Session Cookie 认证）

### 连接说明

Socket.IO 连接时会自动验证用户的 Session，只有已登录的用户才能连接。连接成功后，学生会自动加入对应班级的房间。

### 连接建立流程

#### 步骤1：用户登录（必须先登录）

客户端必须先通过 REST API 登录，获取 Session Cookie：

```javascript
// 1. 调用登录接口
const response = await fetch('http://localhost:3000/api/login', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json'
    },
    credentials: 'include',  // 重要：携带 Cookie
    body: JSON.stringify({
        userAccount: 'student001',
        userPassword: '123456'
    })
});

const result = await response.json();
// 登录成功后，浏览器会自动保存 Session Cookie
```

#### 步骤2：建立 Socket.IO 连接

登录成功后，客户端建立 Socket.IO 连接：

```javascript
import io from 'socket.io-client';

// 连接 Socket.IO（使用与 REST API 相同的地址）
const socket = io('http://localhost:3000', {
    withCredentials: true,  // 重要：自动携带 Cookie
    transports: ['websocket', 'polling']  // 支持两种传输方式
});
```

#### 步骤3：监听连接成功事件

```javascript
// 监听 Socket 连接成功
socket.on('connect', () => {
    console.log('Socket 连接已建立');
});

// 监听身份验证成功事件
socket.on('connected', (data) => {
    if (data.success) {
        console.log('身份验证成功');
        console.log('加入房间:', data.room);  // 例如：class-1
        console.log('用户信息:', data.userInfo);
    }
});
```

#### 步骤4：处理连接错误

```javascript
// 监听连接错误
socket.on('connect_error', (error) => {
    console.error('Socket 连接失败:', error);
    // 可能的原因：
    // 1. 未登录（没有 Session Cookie）
    // 2. Session 已过期
    // 3. 服务器未启动
});
```

### 完整连接示例代码

```javascript
// 完整的连接流程示例

// 步骤1：登录获取 Session
async function login() {
    const response = await fetch('http://localhost:3000/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({
            userAccount: 'student001',
            userPassword: '123456'
        })
    });
    
    const result = await response.json();
    if (result.success) {
        console.log('登录成功');
        return true;
    }
    return false;
}

// 步骤2：连接 Socket.IO
function connectSocket() {
    const socket = io('http://localhost:3000', {
        withCredentials: true,
        transports: ['websocket', 'polling']
    });
    
    // 连接成功
    socket.on('connect', () => {
        console.log('Socket 连接成功');
    });
    
    // 身份验证成功
    socket.on('connected', (data) => {
        if (data.success) {
            console.log('身份验证成功');
            console.log('房间:', data.room);
            console.log('用户信息:', data.userInfo);
            
            // 可以开始监听其他事件了
            setupEventListeners(socket);
        }
    });
    
    // 连接错误
    socket.on('connect_error', (error) => {
        console.error('连接失败:', error.message);
        // 提示：可能需要重新登录
    });
    
    // 断开连接
    socket.on('disconnect', (reason) => {
        console.log('连接断开:', reason);
    });
    
    return socket;
}

// 步骤3：设置事件监听
function setupEventListeners(socket) {
    // 监听新任务推送
    socket.on('new-task', (data) => {
        if (data.success && data.task) {
            console.log('收到新任务:', data.task);
        }
    });
}

// 使用示例
async function init() {
    // 先登录
    const loginSuccess = await login();
    if (loginSuccess) {
        // 登录成功后再连接 Socket
        const socket = connectSocket();
    } else {
        console.error('登录失败，无法连接 Socket');
    }
}

init();
```

### 客户端事件

#### 1. `connected` - 连接成功事件
当 Socket 连接成功并通过身份验证后触发。

**事件数据：**
```json
{
    "success": true,
    "message": "连接成功",
    "room": "class-1",
    "userInfo": {
        "userId": 1,
        "userAccount": "student001",
        "userName": "张三",
        "classId": 1
    }
}
```

#### 2. `new-task` - 新签到任务推送
当老师发布新的签到任务时，该班级的所有在线学生都会收到此事件。

**事件数据：**
```json
{
    "success": true,
    "message": "收到新的签到任务",
    "task": {
        "id": 1,
        "taskName": "上午签到",
        "classId": 1,
        "className": "计算机科学与技术2023级1班",
        "teacherId": 6,
        "teacherName": "张老师",
        "startTime": "2024-01-01 08:00:00",
        "endTime": "2024-01-01 09:00:00",
        "createTime": "2024-01-01 07:30:00",
        "status": "active"
    }
}
```

#### 3. `tasks-response` - 任务列表响应
响应客户端 `get-tasks` 请求。

**事件数据：**
```json
{
    "success": true,
    "data": [
        {
            "id": 1,
            "taskName": "上午签到",
            "teacherId": 6,
            "classId": 1,
            "startTime": "2024-01-01 08:00:00",
            "endTime": "2024-01-01 09:00:00",
            "status": "active",
            "className": "计算机科学与技术2023级1班",
            "teacherName": "张老师"
        }
    ]
}
```

#### 4. `pong` - 心跳响应
响应客户端 `ping` 心跳请求。

**事件数据：**
```json
{
    "timestamp": 1705285800000
}
```

### 客户端发送的事件

#### 1. `get-tasks` - 请求任务列表
学生可以通过 Socket 请求任务列表。

**发送方式：** 客户端调用 `socket.emit('get-tasks')`，详见 Socket.IO 客户端文档。

**响应事件：** `tasks-response`

#### 2. `ping` - 心跳检测
客户端可以定期发送心跳以保持连接。

**发送方式：** 客户端调用 `socket.emit('ping')`，详见 Socket.IO 客户端文档。

**响应事件：** `pong`

### 注意事项

1. **Session 共享**：Socket.IO 通过 Cookie 共享 Express Session，需要确保 Cookie 正确传递
2. **跨域配置**：Socket.IO 已配置 CORS，允许跨域访问
3. **房间管理**：学生连接后自动加入 `class-{classId}` 房间
4. **自动重连**：Socket.IO 客户端默认支持自动重连
5. **降级方案**：如果 Socket.IO 不可用，系统仍保留 REST API 作为备用

### 与 REST API 的关系

- **Socket.IO**：用于实时推送（任务通知）
- **REST API**：用于数据查询、提交（签到提交、统计查询）

两者可以并存使用，Socket.IO 负责实时通信，REST API 负责数据操作。