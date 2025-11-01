# 后端与 Python 对接说明与完整业务流程

本文件说明本项目后端（Node.js, Express）如何与人脸识别 Python 脚本联动，并给出从“人脸注册”到“人脸识别自动签到”的完整业务流程、测试步骤与常见问题排查。

## 1. 架构与目录概览

- 后端服务：`back/app.js`
  - 提供接口：
    - `POST /api/face-register` 人脸注册（需调用 Python 实时识别）
    - `POST /api/face-recognition` 人脸识别（识别成功并校验签到任务后自动写入签到记录）
  - 通过子进程调用 Python：`runPythonRecognition(imagePath)`
- Python 脚本与模型：`opencv/face_get/`
  - 训练脚本：`trainner.py`（生成 `face_trainer/trainer.yml`）
  - 实时识别：`rec.py`（读取 `trainer.yml`，从 stdout 输出 JSON）
  - 训练数据：`Facedata/`（文件命名规则：`name.id.index.jpg`）
  - haar 模型路径：`opencv/face_get/settings.py` 使用 OpenCV 内置路径 `cv2.data.haarcascades`
- 上传目录：`back/public/`（multer 保存上传图片）

关系示意：
1) 前端上传图片 → 2) 后端保存图片 → 3) 后端以子进程调用 `rec.py 图片绝对路径` → 4) `rec.py` 从 stdout 打印 JSON（`recognized`、`userId` 等）→ 5) 后端解析 JSON 并执行业务（注册成功标记、识别后的自动签到）。

## 2. Python 运行时与依赖

建议在 Windows 安装官方 Python 3.10/3.11（x64），并安装以下依赖：

```powershell
py -3 -m pip install --upgrade pip
py -3 -m pip install opencv-contrib-python pillow numpy
```

如果网络受限可使用镜像：

```powershell
py -3 -m pip install -i https://pypi.tuna.tsinghua.edu.cn/simple opencv-contrib-python pillow numpy
```

可选：固定后端调用的解释器（避免多版本冲突）：

```powershell
setx PYTHON_EXE "C:\\Program Files\\Python311\\python.exe"
```

设置后需新开终端或重启后端服务生效。

## 3. 训练与识别脚本约定

### 3.1 训练脚本（一次性/按需）

- 命令：在 `opencv/face_get/` 目录运行

```powershell
cd opencv/face_get
py -3 trainner.py
```

- 输入：`Facedata/` 中的人脸样本，文件名规则 `name.id.index.jpg`：
  - `id` 必须与数据库中用户表 `user.id` 一致
  - 例如：`gpt.6.1.jpg` 表示 name=gpt, id=6
- 输出：`face_trainer/trainer.yml`

### 3.2 实时识别脚本（后端调用）

- 调用方式（后端与人工测试一致）：

```powershell
py -3 opencv/face_get/rec.py <image_abs_path>
```

- stdout 返回 JSON（约定字段）：
  - `recognized`: boolean 是否识别到已知人脸
  - `userId`: number 识别到的用户 id（仅在 recognized=true 时返回）
  - `userName`: string 可选，识别到的名称

示例：

```json
{"recognized": true, "userId": 6, "userName": "gpt"}
```

若未识别：

```json
{"recognized": false, "message": "unknown"}
```

## 3.3 Python 训练业务逻辑详解

### 训练流程步骤（trainner.py）

1. **数据准备阶段**
   - 扫描 `opencv/face_get/Facedata/` 目录下所有图片文件
   - 支持格式：`.jpg`, `.jpeg`, `.png`

2. **文件解析与 ID 提取**
   - 从文件名解析用户 ID：文件名格式为 `name.id.index.jpg`
   - 提取规则：`filename.split(".")[1]` 作为 `id`（整数）
   - 例如：`gpt.6.1.jpg` → `id = 6`
   - 建立 `id` → 训练样本列表的映射关系

3. **人脸检测与预处理**
   - 使用 Haar Cascade 分类器（`haarcascade_frontalface_default.xml`）检测每张图片中的人脸
   - 转换为灰度图（`PIL.Image.convert('L')`）
   - 提取人脸区域（`img_numpy[y:y+h, x:x+w]`）
   - 过滤无效样本：未检测到人脸或检测到多张人脸的情况会跳过（打印警告）

4. **模型训练**
   - 使用 LBPH（Local Binary Patterns Histogram）算法：`cv2.face.LBPHFaceRecognizer_create()`
   - 输入：所有提取的人脸样本数组（`faceSamples`）和对应的 ID 数组（`ids`）
   - 训练：`recognizer.train(faces, np.array(ids))`
   - 生成模型文件：`recognizer.write(trainer.yml)`

5. **训练输出与验证**
   - 输出文件：`opencv/face_get/face_trainer/trainer.yml`
   - 控制台输出：训练的人脸数量、训练集中实际涉及的 ID 列表
   - 训练成功后，`trainer.yml` 将包含所有已识别用户的人脸特征向量

### 训练数据命名约定（强制）

- **格式**：`<name>.<id>.<index>.<ext>`
  - `name`：用户名称（便于识别，仅用于辅助）
  - `id`：**必须与数据库 `user.id` 完全一致**（这是联通的关键）
  - `index`：同一用户的第几张样本（1, 2, 3...）
  - `ext`：图片扩展名（`.jpg`, `.jpeg`, `.png`）

- **示例**：
  - `gpt.6.1.jpg`、`gpt.6.2.jpg`、`gpt.6.3.jpg` → 用户 ID = 6
  - `zhangsan.1.1.jpg`、`zhangsan.1.2.jpg` → 用户 ID = 1

### 训练与后端的联通关系

1. **数据对齐是核心**
   - 训练集中图片文件名的 `id` 必须与数据库 `user` 表的 `id` 字段一致
   - 如不一致，后端识别出的 `userId` 将无法在数据库中匹配到用户，导致：
     - 人脸注册接口：返回“未识别到该用户的人脸”（即使识别成功）
     - 人脸识别接口：返回“用户信息查询失败”

2. **训练是离线操作**
   - `trainner.py` 不直接调用后端接口或数据库
   - 训练时机：
     - **初始部署**：在部署前完成训练，将 `trainer.yml` 一并部署
     - **新增用户**：当数据库新增用户后，需：
       1. 将该用户的人脸样本放入 `Facedata/`，命名规则：`name.<新用户id>.index.jpg`
       2. 重新运行 `trainner.py`，更新 `trainer.yml`

3. **识别脚本的联通桥梁**
   - `rec.py` 在运行时：
     - 读取 `trainer.yml`（训练阶段生成）
     - 从 `Facedata/` 目录扫描文件名，建立 `id → name` 映射（用于返回 `userName`）
     - 识别时，返回的 `userId` 必须与数据库中的 `user.id` 对齐

4. **完整数据流**

```
数据库 user 表
  ↓ (人工对齐)
Facedata/name.id.index.jpg
  ↓ (运行 trainner.py)
face_trainer/trainer.yml
  ↓ (rec.py 读取)
后端调用 rec.py <图片路径>
  ↓ (返回 JSON)
后端解析 userId → 查询数据库 user WHERE id = ?
```

### 训练后的验证步骤

1. **检查训练产物**
   ```powershell
   # 确认 trainer.yml 存在
   ls opencv/face_get/face_trainer/trainer.yml
   ```

2. **验证 ID 对齐**
   ```powershell
   # 检查训练集中的 ID
   py -3 -c "import os; files = [f for f in os.listdir('opencv/face_get/Facedata') if f.endswith('.jpg')]; ids = set([int(f.split('.')[1]) for f in files]); print('训练集ID:', sorted(ids))"
   
   # 数据库查询对应 ID（需连接数据库）
   # SELECT id FROM user WHERE id IN (...);
   ```

3. **测试识别**
   ```powershell
   # 使用训练集中的图片测试识别
   py -3 opencv/face_get/rec.py opencv/face_get/Facedata/gpt.6.1.jpg
   # 应返回 {"recognized": true, "userId": 6, "userName": "gpt"}
   ```

### 常见训练问题

- **训练后识别失败**
  - 检查 `trainer.yml` 是否成功生成（文件大小应 > 0）
  - 确认训练集中至少有 1 张图片能被检测到人脸
  - 确认训练集中的 `id` 与数据库 `user.id` 一致

- **新增用户后识别不到**
  - 新用户的人脸样本已放入 `Facedata/`，但未重新训练
  - 解决：重新运行 `trainner.py` 更新 `trainer.yml`

- **识别出的 userId 不在数据库中**
  - 训练集文件名中的 `id` 与数据库不一致
  - 解决：重命名训练样本文件，确保 `id` 与数据库对齐，然后重新训练

## 4. 后端如何调用 Python（关键信息）

- 代码位置：`back/app.js` 中的 `runPythonRecognition(imagePath)`
- 行为：
  1. 选择解释器顺序：`PYTHON_EXE` 环境变量（如设置） → `py -3` → `python` → `python3`
  2. 以子进程运行：`<python_exe> opencv/face_get/rec.py <abs_image_path>`
  3. 读取 stdout，解析为 JSON；非 0 退出码或非 JSON 输出将视为错误
- 后端接口将上传图片保存至 `back/public`，再把保存后的绝对路径传给 `runPythonRecognition`

## 5. 接口对接与业务流程

### 5.1 人脸注册 `POST /api/face-register`

- 入参（`multipart/form-data`）：
  - `userId`: number 必填
  - `imagefile`: file 必填
- 流程（已对接：保存样本并自动重训练，支持首次注册冷启动）：
  
  **首次注册（用户 `faceRegistered=0`）**：
  1. 接收并保存上传图片到 `back/public`
  2. 跳过识别校验（因为模型尚未包含该用户）
  3. 直接复制图片到 `opencv/face_get/Facedata/<name>.<userId>.<timestamp>.<ext>`
  4. 触发 `trainner.py` 重训练，更新 `face_trainer/trainer.yml`
  5. 更新 `user.faceRegistered=1`
  6. 返回 `{ success:true, message:'人脸注册成功（首次注册）', data: { userId, savedToDataset:true, retrained:true, coldStart:true } }`

  **非首次注册（用户 `faceRegistered=1`）**：
  1. 接收并保存上传图片到 `back/public`
  2. 调用 `runPythonRecognition(图片绝对路径)` 进行识别校验
  3. 若返回 `recognized=true` 且 `userId` 与入参一致：
     - 复制该图片到 `opencv/face_get/Facedata/<name>.<userId>.<timestamp>.<ext>`
     - 同步触发 `trainner.py` 重训练，更新 `face_trainer/trainer.yml`
     - 确保 `user.faceRegistered=1`
     - 返回 `{ success:true, data: { userId, savedToDataset:true, retrained:true, coldStart:false } }`
  4. 若识别失败或不匹配：返回 400 “未识别到该用户的人脸”（防止误将他人照片加入训练集）

### 5.2 人脸识别与自动签到 `POST /api/face-recognition`

- 入参（`multipart/form-data`）：
  - `imagefile`: file 必填
  - `taskId`: number 可选（签到任务 id）
- 流程：
  1. 接收并保存上传图片到 `back/public`
  2. 调用 `runPythonRecognition(图片绝对路径)`
  3. 若 `recognized=true`，查库获取该 `userId` 对应用户信息
  4. 如提供 `taskId`，校验任务是否属于该用户班级、状态为 active 且在时间窗内
  5. 校验通过则写入签到记录 `attendance_record`（状态 1 表示成功）
  6. 返回识别结果与签到状态

## 6. 测试步骤（命令行示例）

前置：后端启动在 `http://localhost:3000`，Python 依赖与训练已完成。

1) 独立测试 Python 脚本：

```powershell
py -3 opencv/face_get/rec.py back/public/<某测试图片文件名>
```

2) 测试人脸注册：

```powershell
# Windows PowerShell 下用 curl.exe，注意路径与 MIME
$img="F:\\code\\faceRecognition\\Face-Recognition\\opencv\\face_get\\test\\gpt.6.2.jpg"
curl.exe -X POST http://localhost:3000/api/face-register ^
  -F "userId=6" ^
  -F "imagefile=@$img;type=image/jpeg"
```

3) 测试人脸识别（可选 taskId）：

```powershell
$img="F:\\code\\faceRecognition\\Face-Recognition\\opencv\\face_get\\test\\gpt.6.2.jpg"
curl.exe -X POST http://localhost:3000/api/face-recognition ^
  -F "imagefile=@$img;type=image/jpeg"

# 或携带有效 taskId（需数据库存在处于有效时间窗的任务）
curl.exe -X POST http://localhost:3000/api/face-recognition ^
  -F "taskId=123" ^
  -F "imagefile=@$img;type=image/jpeg"
```

## 7. 数据与命名约定

- 训练数据文件名：`name.id.index.jpg`
  - `id` 必须与 `user` 表中的 `id` 对齐，否则识别出的 `userId` 将无法匹配正确用户
- 识别正确的判断（注册接口）：`recognized=true` 且 `返回 userId == 提交 userId`

## 8. 常见问题排查（Windows）

- 报错 `No module named 'encodings'`：
  - 说明 Python 安装损坏或环境变量干扰。卸载所有 Python 与 Python Launcher，清理残留目录，使用 python.org 官方安装包重装，并勾选 “Add Python to PATH / pip / venv”。
  - 重装后验证：
    - `py -0p`（列出现有安装）
    - `py -3 -V`（打印版本）
    - `py -3 -c "import encodings,sys;print(sys.executable);print(encodings.__file__)"`
- `cv2.face` 不存在：
  - 需安装 `opencv-contrib-python` 而非 `opencv-python`
- 识别总是失败：
  - 确认 `face_trainer/trainer.yml` 已生成且可读
  - 确认图片中有人脸且能被 `haarcascade_frontalface_default.xml` 检测
  - 确认训练集中的 `id` 与数据库用户 `id` 一致
- 后端无法找到 Python：
  - 设置 `PYTHON_EXE` 环境变量为 Python 可执行文件绝对路径，并重启后端

## 9. 部署建议

- 将 Python 与依赖放到固定路径，使用 `PYTHON_EXE` 指定解释器
- 训练（`trainner.py`）在部署前离线完成并携带 `trainer.yml`
- 运行账户需对 `back/public/` 有读写权限
- 开启后端日志以便快速定位子进程 stderr 与 stdout 解析问题

## 10. 参考文件

- 后端：`back/app.js`
- Python：`opencv/face_get/rec.py`, `opencv/face_get/trainner.py`, `opencv/face_get/settings.py`
- 训练输出：`opencv/face_get/face_trainer/trainer.yml`
- 上传目录：`back/public/`
- API 文档：`back/API_DOCUMENTATION.md`

## 11. 端到端（前端→后端→算法→数据库）联调时序与检查清单

### 11.1 时序（注册与识别共性）

1) 前端构造 `multipart/form-data`：
   - 注册：字段 `userId`、文件 `imagefile`
   - 识别：字段可选 `taskId`、文件 `imagefile`
2) 后端 `multer` 保存文件至 `back/public/<生成文件名>`
3) 后端调用 `runPythonRecognition(<abs_image_path>)`
4) Python `rec.py` 读取 `face_trainer/trainer.yml`，识别并从 stdout 返回 JSON
5) 后端解析 JSON：
   - 注册：校验 `recognized=true` 且 `返回的 userId == 入参 userId`
   - 识别：`recognized=true` 则查库拿用户信息；若携带 `taskId` 则校验任务并写入签到
6) 返回前端 JSON 响应

### 11.2 前端请求规范（UNIAPP 示例）

- 表单字段名必须是 `imagefile`，与后端 `upload.single('imagefile')` 对应
- UNIAPP 示例（H5/APP 同理，关键是传 `name: 'imagefile'` 且 `formData` 携带其他字段）：

```javascript
uni.uploadFile({
  url: 'http://localhost:3000/api/face-register',
  filePath: localImagePath,
  name: 'imagefile',
  formData: { userId: 6 },
  success: (res) => { /* 解析 JSON 并提示 */ },
  fail: (err) => { /* 错误处理 */ }
});
```

识别接口：

```javascript
uni.uploadFile({
  url: 'http://localhost:3000/api/face-recognition',
  filePath: localImagePath,
  name: 'imagefile',
  formData: { taskId: 123 }, // 可选
  success: (res) => { /* 识别与签到提示 */ },
  fail: (err) => { /* 错误处理 */ }
});
```

### 11.3 E2E 检查清单

- 环境与依赖
  - [ ] Python 3.10/3.11 可用；`PYTHON_EXE` 指向确定的解释器
  - [ ] 安装 `opencv-contrib-python`、`pillow`、`numpy`
  - [ ] 训练产物 `opencv/face_get/face_trainer/trainer.yml` 存在
- 数据一致性
  - [ ] 训练集文件名中的 `id` 与数据库 `user.id` 一致
  - [ ] 识别目标用户在库中真实存在（`SELECT * FROM user WHERE id=?`）
- 后端与存储
  - [ ] `back/public` 可写，能生成上传文件
  - [ ] 后端日志可见 `[Python exe]`、`[Python stdout]`、`[Python stderr]`
  - [ ] `runPythonRecognition` 只解析到一条 JSON（stdout 无其他干扰）
- 前端请求
  - [ ] `multipart/form-data` 字段名用 `imagefile`
  - [ ] 注册时随表单携带 `userId`
  - [ ] 识别签到时如需自动签到，携带有效 `taskId`

### 11.4 端到端验证步骤（建议顺序）

1) 独立验证 Python：
   ```powershell
   py -3 opencv/face_get/rec.py back/public/<某图片>
   ```
   看到 JSON 输出且 `recognized` 合理。

2) 后端本地 `curl` 验证注册：
   ```powershell
   curl.exe -X POST http://localhost:3000/api/face-register -F "userId=<真实id>" -F "imagefile=@<本地图片>;type=image/jpeg"
   ```
   期望返回注册成功，数据库 `faceRegistered=1`。

3) 后端本地 `curl` 验证识别：
   ```powershell
   curl.exe -X POST http://localhost:3000/api/face-recognition -F "imagefile=@<本地图片>;type=image/jpeg"
   ```
   期望返回 `recognized:true` 且用户信息存在。

4) 自动签到链路（可选）：
   - 先创建有效时间窗内的任务（老师账号）：`attendance_task` 有一条 `status='active'` 的记录
   - 调用：
     ```powershell
     curl.exe -X POST http://localhost:3000/api/face-recognition -F "taskId=<任务id>" -F "imagefile=@<本地图片>;type=image/jpeg"
     ```
   - 期望 `attendanceRecorded:true` 且 `attendance_record` 新增一条

### 11.5 常见端到端问题与快速修复

- 后端报 `Python exited with code 9009 (exe=python3)`：设置或在启动窗口临时导出 `PYTHON_EXE`，重启后端
- 注册返回“未识别到该用户的人脸”：识别出的 `userId` 与入参不一致；对齐训练集文件名的 `id` 与数据库 `user.id`
- 识别返回“用户信息查询失败”：数据库不存在识别到的 `userId`；插入用户或重训改名
- `cv2.face` 不存在：安装 `opencv-contrib-python`
- stdout 不是纯 JSON：`rec.py` 额外打印；已修正为传参场景仅输出一次 JSON 并退出

## 12. 后端⇄Python 业务流程（详细版）

下面按“人脸注册”和“人脸识别（含自动签到）”分别给出精细化步骤、关键入参与返回、数据库操作、失败分支与响应。

### 12.1 人脸注册 POST /api/face-register（详细）

输入：`multipart/form-data`
- `userId`: number（必填）
- `imagefile`: file（必填）

后端详细流程：
1) 接收与校验
   - 验证 `userId` 存在且为数字
   - 验证 `req.file` 存在，否则返回 400 `{ success:false, message:'未收到图片文件' }`
   - multer 规则：保存到 `back/public`，文件名 `imagefile-<timestamp>-<rand>.<ext>`
2) 组织 Python 调用
   - 组装图片绝对路径 `absImagePath = back/public/<filename>`
   - 选择 Python 解释器：优先 `process.env.PYTHON_EXE`，否则回退顺序 `py -3` → `python` → `python3`
   - 以子进程执行：`<exe> opencv/face_get/rec.py <absImagePath>`，`cwd=项目根`
3) Python 输出解析
   - 读取 stdout 并 `JSON.parse`，必须包含 `recognized`，当 `recognized=true` 时应含 `userId`
   - 任何非 0 退出码、JSON 解析失败、stdout 为空均视为算法调用失败（500）
4) 业务判定（注册成功条件）
   - `pyResult.recognized === true` 且 `String(pyResult.userId) === String(userId)`
5) 数据库写入
   - 成功：`UPDATE user SET faceRegistered=1 WHERE id=?`，返回 200 `{ success:true, message:'人脸注册成功', data:{ userId } }`
   - 否则：返回 400 `{ success:false, message:'人脸注册失败：未识别到该用户的人脸' }`
6) 文件留存
   - 上传图片默认保留在 `back/public` 作为审计证据（如需定期清理，可配合计划任务）

失败分支与响应映射：
- 缺少 `userId` 或 `imagefile` → 400 `{ message:'用户ID不能为空' | '未收到图片文件' }`
- Python 进程启动失败 / 不存在解释器 → 500 `{ message:'人脸注册失败，请重试', error:'spawn ... failed' }`
- Python 返回非 JSON / 解析失败 → 500 `{ message:'人脸注册失败，请重试', error:'Failed to parse ...' }`
- 识别成功但 userId 不匹配 → 400 `{ message:'人脸注册失败：未识别到该用户的人脸' }`

日志要点：
- 打印 `[Python exe]`、`[Python stdout]`、`[Python stderr]`，便于问题定位
- 建议在生产降噪：stderr 按级别记录（error/warn/info）

### 12.2 人脸识别（含自动签到）POST /api/face-recognition（详细）

输入：`multipart/form-data`
- `imagefile`: file（必填）
- `taskId`: number（可选）

后端详细流程：
1) 接收与校验
   - 验证 `req.file` 存在，否则 400 `{ success:false, message:'未收到图片文件' }`
2) 组织 Python 调用
   - 同注册流程第 2 步
3) Python 输出解析
   - 同注册流程第 3 步
4) 业务判定（识别）
   - 若 `recognized !== true`：返回 200 `{ success:true, message:'未识别到已知人脸', data:{ recognized:false, attendanceRecorded:false } }`
5) 用户信息查询
   - `SELECT * FROM user WHERE id = ?`（取 `pyResult.userId`）
   - 若未查到：500 `{ success:false, message:'用户信息查询失败' }`
6) 任务校验（仅当提供了 `taskId`）
   - `SELECT * FROM attendance_task WHERE id = ? AND classId = ? AND status='active' AND startTime<=NOW() AND endTime>=NOW()`
   - 若为空 → 任务无效，后续不写签到，但仍返回识别成功
7) 自动签到（当任务有效时）
   - `INSERT INTO attendance_record (userId, taskId, checkTime, status) VALUES (?, ?, NOW(), 1)`
   - 异常时仅记录日志，不影响识别成功响应
8) 响应
   - 任务有效：`{ success:true, message:'人脸识别成功，已自动签到', data:{ recognized:true, userId, userAccount, userName, attendanceRecorded:true, taskId } }`
   - 任务无效：`{ success:true, message:'人脸识别成功，但签到任务无效或已过期', data:{ recognized:true, userId, userAccount, userName, attendanceRecorded:false, taskId:null|原值 } }`

失败分支与响应映射：
- 未收到文件 → 400 `{ message:'未收到图片文件' }`
- Python 启动/解析异常 → 500 `{ message:'人脸识别失败', error:'...' }`
- 用户不存在（识别出的 id 不在库中） → 500 `{ message:'用户信息查询失败' }`

日志要点：
- 同注册；另在签到步骤打印“签到成功/失败原因（任务无效/过期）”

### 12.3 数据一致性与对齐策略（强制）

- 训练集命名 `name.id.index.jpg` 中的 `id` 必须与 `user.id` 对齐
- 识别出的 `userId` 将作为权威用户主键，用于查库与签到
- 如需变更某学生的 id：
  - 重新命名其训练样本并重训；或在数据库迁移时同步改动并重训

### 12.4 超时、重试与并发（建议）

- 超时：
  - 子进程可设置自定义超时（当前实现未设；如需，建议在 spawn 外包一层 Promise.race 与定时器）
  - 识别耗时容忍阈值根据场景（建议 < 3s）
- 重试：
  - 解释器多路尝试已内置（`PYTHON_EXE` → `py -3` → `python` → `python3`）
  - 不建议对同一图片重复调用算法（除非明确可幂等且有缓存）
- 并发：
  - Node 端并发处理上传图片；Python LBPH 单次调用无状态，理论可并发
  - 若高并发下 CPU 飙升，可引入队列或独立算法服务化

### 12.5 安全与合规（建议）

- 访问控制：
  - 注册与识别接口按业务场景可要求登录态（目前注册/识别未强制 `requireLogin`）
- 存储合规：
  - 上传图片包含个人生物信息，建议只做临时存储并定期清理
  - 严格限制 `back/public` 的访问范围（生产可改为私有目录+受控下载）
- 输入校验：
  - 限制文件大小（已限制 20MB）、MIME 与扩展名白名单
  - 对 `userId`/`taskId` 做数字校验与权限校验（例如学生只能识别为自己并签到自己班级的任务）




