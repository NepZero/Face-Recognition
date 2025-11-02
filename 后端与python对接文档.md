# 后端与 Python 对接说明与完整业务流程

本文件说明本项目后端（Node.js, Express）如何与人脸识别 Python 脚本联动，并给出从"人脸注册"到"人脸识别自动签到"的完整业务流程、测试步骤与常见问题排查。

## 0. 环境与配置总览

### 0.1 运行环境要求

- **操作系统**：Windows 10/11（本项目在 Windows 环境下开发与测试）
- **Node.js**：建议 14.x 或更高版本（本项目使用 Express 5.x）
- **Python**：3.10 或 3.11（x64），官方安装包
- **数据库**：MySQL 5.7+ 或 MariaDB 10.3+
- **依赖管理**：pip（Python 包管理器），npm（Node.js 包管理器）

### 0.2 目录结构说明

```
Face-Recognition/
├── back/                          # 后端服务目录
│   ├── app.js                     # Express 主程序（包含接口与 Python 调用逻辑）
│   ├── package.json               # Node.js 依赖配置
│   ├── public/                    # 上传图片存储目录（multer 自动创建）
│   │   └── imagefile-*.jpg        # 上传的图片文件（时间戳命名）
│   └── algorithm_mock/            # Python 算法 mock 数据目录（可选）
│       ├── face-recognition.json  # 识别接口 mock（rec.py 生成）
│       └── face-register.json     # 注册接口 mock（rec.py 生成）
│
└── opencv/                        # Python 人脸识别算法目录
    └── face_get/
        ├── rec.py                 # 实时识别脚本（后端调用）
        ├── trainner.py            # 训练脚本（离线运行）
        ├── settings.py            # 配置文件（Haar Cascade 路径）
        ├── Facedata/              # 训练数据目录（必须存在）
        │   └── name.id.index.jpg  # 训练样本文件（命名规则见 3.1）
        └── face_trainer/           # 训练输出目录（trainner.py 自动创建）
            └── trainer.yml         # LBPH 模型文件（训练产物）
```

### 0.3 关键配置项

#### 后端配置（`back/app.js`）

| 配置项 | 位置 | 说明 | 默认值 |
| --- | --- | --- | --- |
| `publicDir` | 第 65 行 | 上传文件存储目录 | `./public` |
| `faceDataDir` | 第 66 行 | 训练数据目录路径 | `../opencv/face_get/Facedata` |
| `fileSizeLimit` | 第 193 行 | 单文件上传大小限制 | `20MB` |
| `PYTHON_EXE` | 环境变量 | Python 解释器路径（可选） | `null`（自动探测） |
| 数据库连接 | 第 48-59 行 | MySQL 连接池配置 | 需手动配置 |

#### Python 脚本配置（`opencv/face_get/settings.py`）

| 配置项 | 说明 | 默认值 |
| --- | --- | --- |
| `src` | Haar Cascade 分类器路径 | `cv2.data.haarcascades`（OpenCV 内置） |

#### 识别脚本参数（`rec.py`）

| 参数 | 位置 | 说明 | 可调范围 |
| --- | --- | --- | --- |
| `conf < 100` | 第 52 行 | 识别置信度阈值 | 建议 80-120（越小越严格） |
| 人脸检测参数 | 第 42 行 | `detectMultiScale(..., 1.2, 5)` | `scaleFactor`: 1.1-1.5, `minNeighbors`: 3-7 |

### 0.4 首次部署前检查清单

- [ ] 创建训练数据目录：`opencv/face_get/Facedata/`（必须存在，否则训练脚本会报错）
- [ ] 创建训练输出目录：`opencv/face_get/face_trainer/`（trainner.py 会自动创建，但建议提前创建）
- [ ] 确认 `back/public/` 目录存在或有写入权限（multer 会在首次上传时创建）
- [ ] 配置数据库连接（修改 `back/app.js` 中的 `dbConfig`）
- [ ] 安装 Python 依赖：`opencv-contrib-python`, `pillow`, `numpy`
- [ ] 安装 Node.js 依赖：在 `back/` 目录运行 `npm install`
- [ ] 可选：设置 `PYTHON_EXE` 环境变量以固定 Python 解释器

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

### 2.1 Shell 使用注意事项（Windows）

在 Windows 环境下，**PowerShell** 和 **CMD** 在变量引用、续行符号等语法上存在差异，需要注意：

#### 变量引用差异

| 操作 | PowerShell | CMD |
| --- | --- | --- |
| 定义变量 | `$var = "value"` | `set var=value` |
| 引用变量 | `$var` | `%var%` |
| 环境变量 | `$env:VAR` 或 `$env:VAR = "value"` | `%VAR%` 或 `set VAR=value` |

**示例：设置 Python 解释器环境变量**

```powershell
# PowerShell（当前会话有效）
$env:PYTHON_EXE = "C:\Program Files\Python311\python.exe"

# PowerShell（永久设置，需管理员权限）
[System.Environment]::SetEnvironmentVariable("PYTHON_EXE", "C:\Program Files\Python311\python.exe", "User")

# CMD（当前会话有效）
set PYTHON_EXE=C:\Program Files\Python311\python.exe

# CMD（永久设置）
setx PYTHON_EXE "C:\Program Files\Python311\python.exe"
```

#### 续行符号差异

| 场景 | PowerShell | CMD |
| --- | --- | --- |
| 续行符 | 反引号 `` ` ``（位于行末） | `^`（位于行末） |
| 多行命令 | 使用 `` ` `` 连接 | 使用 `^` 连接 |

**示例：curl 多行命令（用于测试接口）**

```powershell
# PowerShell：使用反引号 ` 续行
$img = "F:\code\faceRecognition\Face-Recognition\opencv\face_get\test\gpt.6.2.jpg"
curl.exe -X POST http://localhost:3000/api/face-register `
  -F "userId=6" `
  -F "imagefile=@$img;type=image/jpeg"
```

```cmd
REM CMD：使用 ^ 续行
set img=F:\code\faceRecognition\Face-Recognition\opencv\face_get\test\gpt.6.2.jpg
curl.exe -X POST http://localhost:3000/api/face-register ^
  -F "userId=6" ^
  -F "imagefile=@%img%;type=image/jpeg"
```

**注意**：PowerShell 中，如果路径包含空格，变量引用可能需要用引号包裹：`"$img"`。

#### 路径分隔符

- **PowerShell** 和 **CMD** 都支持 `/` 和 `\`，但建议在脚本中使用反斜杠 `\` 或使用 `path.join()`（Node.js）自动处理。
- Python 脚本中推荐使用 `os.path.join()` 自动适配不同操作系统。

#### 推荐实践

1. **开发环境**：使用 PowerShell（功能更强大，支持现代语法）
2. **生产部署**：明确指定 Shell 类型，避免混用
3. **脚本编写**：尽量使用跨平台路径处理（如 Node.js 的 `path` 模块）
4. **测试命令**：优先使用 PowerShell，如遇到兼容性问题再改用 CMD 语法

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

#### 5.1.1 非首次注册的识别校验机制详解

**校验目的**：确保用户上传的人脸图片确实是该用户本人，防止数据污染（误将他人照片加入训练集）。

**校验流程**：

1. **模型识别阶段**（不是直接比对照片）：
   ```
   已有训练照片 → 训练模型 → trainer.yml（包含所有人脸特征）
                                             ↓
   新上传照片 → 通过模型识别 → 识别出用户ID
   ```
   - 已有照片通过 `trainner.py` 训练生成 `trainer.yml` 模型文件
   - 模型包含所有人脸的特征数据（不是存储原图）
   - 新上传照片通过 `rec.py` 加载模型进行识别
   - 模型输出识别结果：`{recognized: true, userId: 6}`

2. **身份匹配校验**：
   ```javascript
   // 后端 app.js 第 463 行
   const isMatchUser = pyResult.recognized && 
                       String(pyResult.userId) === String(userId);
   ```
   - 校验条件1：`recognized === true`（成功识别到已知人脸）
   - 校验条件2：`识别出的 userId === 提交的 userId`（身份一致）

3. **校验结果处理**：
   - ✅ **校验通过**：保存样本并触发重训练
   - ❌ **校验失败**：返回 400 错误，拒绝保存

**校验失败的情况**：

| 失败场景 | 识别结果 | 校验结果 | 原因 |
| --- | --- | --- | --- |
| 图片中无人脸 | `{recognized: false}` | 失败 | 图片质量问题或非人脸图片 |
| 识别置信度过低 | `{recognized: false}` | 失败 | 图片质量差，模型无法准确识别 |
| 识别成其他人 | `{recognized: true, userId: 7}`（提交的是 userId=6） | 失败 | 上传了他人照片，身份不匹配 |
| 模型中没有该用户 | `{recognized: false}` | 失败 | 模型文件问题或训练不完整 |

**实际校验示例**：

```
场景：用户张三（ID=6，已注册）要追加训练样本

✅ 成功场景：
1. 前端提交：userId = 6，上传张三本人照片
2. 后端识别：调用 rec.py，通过 trainer.yml 模型识别
   识别结果：{recognized: true, userId: 6}
3. 后端校验：6 === 6 → 校验通过 ✅
4. 保存样本并重训练

❌ 失败场景1（上传他人照片）：
1. 前端提交：userId = 6，但上传了李四（ID=7）的照片
2. 后端识别：识别结果：{recognized: true, userId: 7}
3. 后端校验：7 !== 6 → 校验失败 ❌
4. 返回：400 "人脸注册失败：未识别到该用户的人脸"

❌ 失败场景2（图片质量差）：
1. 前端提交：userId = 6，上传模糊照片
2. 后端识别：识别结果：{recognized: false}
3. 后端校验：recognized === false → 校验失败 ❌
4. 返回：400 "人脸注册失败：未识别到该用户的人脸"
```

**为什么不是直接比对照片**：

- ❌ **不是**：新照片 === 已有照片（像素级比对）
- ✅ **而是**：新照片 → 模型识别 → 比对识别出的用户ID
- **原因**：
  1. 效率更高：模型文件（几MB）比大量原图（可能几百MB）小
  2. 特征匹配：模型提取的是人脸特征，而非像素级比对
  3. 容错性强：能处理光照、角度、表情等变化
  4. 可扩展：新增用户只需重新训练，不用遍历所有照片

**总结**：非首次注册的校验是通过机器学习模型识别新上传照片中的人脸，然后比对模型识别出的用户ID与用户提交的用户ID是否一致，从而确保身份一致性并防止数据污染。

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

#### 5.2.1 Python 识别逻辑详解（`rec.py`）

**调用流程**：

```
后端 app.js（第 526 行）
  ↓
runPythonRecognition(图片绝对路径)
  ↓
子进程执行：py -3 rec.py <图片绝对路径>
  ↓
rec.py 处理并输出 JSON 到 stdout
  ↓
后端解析 stdout 中的 JSON
  ↓
根据识别结果进行后续业务处理
```

**详细代码逻辑**：

**阶段1：初始化与 ID→名字映射建立**（`rec.py` 第 7-24 行）

```python
# 建立 ID→名字映射（从训练数据文件名提取）
FACE_DATA_DIR = os.path.join(os.path.dirname(__file__), 'Facedata')
id2name = {}
for fname in os.listdir(FACE_DATA_DIR):
    if fname.endswith(('.jpg', '.jpeg', '.png')):
        # 从文件名 gpt.6.1.jpg 提取
        id_part = fname.split(".")[1]      # ID = 6
        name_part = fname.split(".")[0]    # name = "gpt"
        id2name[int(id_part)] = name_part  # {6: "gpt"}
```

**作用**：扫描 `Facedata/` 目录，从文件名建立用户ID与名字的映射，用于返回用户名。

**阶段2：图片读取**（`rec.py` 第 31-37 行）

```python
# 从命令行参数获取图片路径
img_path = sys.argv[1] if len(sys.argv) > 1 else None

if img_path:
    img = cv2.imread(img_path)  # 读取图片
    result = {"recognized": False, "message": "unknown"}
    
    if img is None:
        # 图片读取失败，直接返回未识别
        print(json.dumps(result, ensure_ascii=False))
```

**作用**：读取后端传入的图片文件。如果读取失败（文件不存在、格式错误等），直接返回未识别。

**阶段3：模型加载**（`rec.py` 第 39-43 行）

```python
# 加载 LBPH 人脸识别模型（训练好的）
recognizer = cv2.face.LBPHFaceRecognizer_create()
trainer_path = os.path.join(os.path.dirname(__file__), 'face_trainer', 'trainer.yml')
recognizer.read(trainer_path)  # 读取训练好的模型

# 加载 Haar Cascade 人脸检测器（用于检测图片中的人脸位置）
face_cascade = cv2.CascadeClassifier(os.path.join(src, 'haarcascade_frontalface_default.xml'))
```

**作用**：
- 加载已训练的 LBPH 模型（`trainer.yml` 包含所有人脸特征数据）
- 加载 Haar Cascade 分类器用于检测人脸位置

**阶段4：人脸检测**（`rec.py` 第 45-49 行）

```python
# 转换为灰度图（人脸检测需要灰度图）
gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)

# 检测图片中的人脸位置
# 参数：scaleFactor=1.2（缩放因子），minNeighbors=5（最小邻居数）
faces = face_cascade.detectMultiScale(gray, 1.2, 5)

if len(faces) == 0:
    # 未检测到人脸，返回未识别
    print(json.dumps(result, ensure_ascii=False))
```

**作用**：在图片中检测人脸区域。如果未检测到人脸（可能是风景照、物品照等），直接返回未识别。

**阶段5：人脸识别**（`rec.py` 第 50-63 行）

```python
else:
    # 提取第一张人脸区域（如果有多张人脸，只识别第一张）
    x, y, w, h = faces[0]
    face = gray[y:y+h, x:x+w]  # 裁剪出人脸区域
    
    # 使用 LBPH 模型进行识别
    # idnum: 识别出的用户ID
    # conf: 置信度（越小表示越相似，0表示完全匹配）
    idnum, conf = recognizer.predict(face)
    
    # 置信度阈值判断（conf < 100 认为识别成功）
    if conf < 100:
        name = id2name.get(idnum, f"id_{idnum}")  # 从映射中获取名字
        result = {
            "recognized": True,
            "userId": int(idnum),
            "userName": name
        }
    # 如果 conf >= 100，result 保持为 {"recognized": False}
    
    # 输出 JSON 结果到 stdout（后端从这里读取）
    print(json.dumps(result, ensure_ascii=False))
```

**作用**：
- 裁剪出人脸区域（从检测到的位置提取）
- 使用 LBPH 模型识别，得到用户ID和置信度
- 判断识别是否成功（置信度 < 100）
- 输出 JSON 结果到 stdout，供后端解析

**阶段6：退出**（`rec.py` 第 65 行）

```python
sys.exit(0)  # 正常退出，确保只输出一次 JSON
```

**作用**：确保脚本只输出一次 JSON，后端能正确解析，不会被其他输出干扰。

**完整识别流程图**：

```
后端调用：runPythonRecognition("back/public/imagefile-xxx.jpg")
  ↓
执行命令：py -3 rec.py back/public/imagefile-xxx.jpg
  ↓
rec.py 执行流程：
  ├─ [1] 初始化：扫描 Facedata/ 目录，建立 id→name 映射
  │     {6: "gpt", 7: "zhang", ...}
  │
  ├─ [2] 读取图片
  │     img = cv2.imread("back/public/imagefile-xxx.jpg")
  │     if img is None: return {"recognized": false}
  │
  ├─ [3] 加载模型
  │     recognizer.read("face_trainer/trainer.yml")  # LBPH模型
  │     face_cascade = Haar Cascade  # 人脸检测器
  │
  ├─ [4] 转换为灰度图
  │     gray = cv2.cvtColor(img, COLOR_BGR2GRAY)
  │
  ├─ [5] 检测人脸位置
  │     faces = face_cascade.detectMultiScale(gray, 1.2, 5)
  │     if len(faces) == 0:
  │         return {"recognized": false}
  │
  ├─ [6] 提取人脸区域
  │     x, y, w, h = faces[0]  # 取第一张人脸
  │     face = gray[y:y+h, x:x+w]  # 裁剪人脸区域
  │
  ├─ [7] LBPH 模型识别
  │     idnum, conf = recognizer.predict(face)
  │     if conf < 100:
  │         return {"recognized": true, "userId": idnum, "userName": name}
  │     else:
  │         return {"recognized": false}
  │
  └─ [8] 输出 JSON 到 stdout 并退出
        print(json.dumps(result))
        sys.exit(0)
  ↓
后端接收 stdout，解析 JSON：
  {"recognized": true, "userId": 6, "userName": "gpt"}
  ↓
后端根据识别结果处理：
  - 如果 recognized=true：
  │   → 查询用户信息（SELECT * FROM user WHERE id = 6）
  │   → 验证签到任务（如果提供了taskId）
  │   → 写入签到记录（如果任务有效）
  │   → 返回识别成功与签到状态
  │
  - 如果 recognized=false：
      → 返回未识别信息
```

**关键参数说明**：

| 参数 | 代码位置 | 说明 | 默认值 | 可调范围 | 作用 |
| --- | --- | --- | --- | --- | --- |
| `scaleFactor` | 第 46 行 | 人脸检测缩放因子 | 1.2 | 1.1 - 1.5 | 控制检测尺度，越小检测越精确但越慢 |
| `minNeighbors` | 第 46 行 | 最小邻居数 | 5 | 3 - 7 | 过滤误检，越大误检越少但可能漏检 |
| `conf < 100` | 第 56 行 | 识别置信度阈值 | 100 | 60 - 150 | 判断识别是否成功，越小越严格 |

**识别结果示例**：

**识别成功**：
```json
{"recognized": true, "userId": 6, "userName": "gpt"}
```

**识别失败（未检测到人脸）**：
```json
{"recognized": false, "message": "unknown"}
```

**识别失败（置信度过高，识别不可靠）**：
```json
{"recognized": false, "message": "unknown"}
```
（实际上如果 `conf >= 100`，不会设置 `recognized: true`，所以返回默认的未识别结果）

**与注册接口校验的区别**：

- **注册接口校验**：
  - 调用相同的 `rec.py` 识别脚本
  - **额外步骤**：校验识别出的 `userId` 与用户提交的 `userId` 是否一致
  - 目的：防止误将他人照片加入训练集

- **识别接口**：
  - 调用相同的 `rec.py` 识别脚本
  - **直接使用**：识别出的 `userId` 查询用户信息
  - 目的：识别用户身份并进行签到

**总结**：Python 识别脚本的核心是通过训练好的 LBPH 模型进行人脸识别，整个流程包括：加载模型 → 检测人脸 → 提取特征 → 模型识别 → 返回结果。识别过程与注册接口的校验逻辑使用相同的模型和识别脚本，保证了识别的一致性。

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

### 11.1 人脸注册流程时序（详细）

```
时序图（人脸注册，非首次注册场景）：

前端 (UNIAPP)
  │
  ├─[1] 构造 multipart/form-data
  │      - userId: 6
  │      - imagefile: <二进制图片>
  │
  └─[2] POST /api/face-register
       │
       ▼
后端 (Express + multer)
  │
  ├─[3] 接收请求，multer 保存文件
  │     保存至: back/public/imagefile-1759567764706-328347642.jpg
  │     生成绝对路径: absImagePath
  │
  ├─[4] 查询数据库 user 表
  │     SELECT id, userAccount, userName, faceRegistered FROM user WHERE id = 6
  │
  ├─[5] 判断 faceRegistered 状态
  │     ├─ 首次注册 (faceRegistered=0):
  │     │   └─[5.1] 跳过识别校验
  │     │   └─[5.2] 复制图片到 Facedata/<name>.<userId>.<timestamp>.<ext>
  │     │   └─[5.3] 触发 trainner.py 重训练
  │     │   └─[5.4] UPDATE user SET faceRegistered=1 WHERE id=6
  │     │   └─[5.5] 返回成功（coldStart: true）
  │     │
  │     └─ 非首次注册 (faceRegistered=1):
  │         │
  │         ├─[6] 调用 runPythonRecognition(absImagePath)
  │         │     生成子进程: spawn('py', ['-3', 'rec.py', absImagePath])
  │         │
  │         ▼
  │     Python (rec.py)
  │         │
  │         ├─[7] 读取 trainer.yml
  │         │     recognizer.read('face_trainer/trainer.yml')
  │         │
  │         ├─[8] 加载 Haar Cascade
  │         │     face_cascade.detectMultiScale(gray, 1.2, 5)
  │         │
  │         ├─[9] 检测人脸
  │         │     if len(faces) == 0: return {"recognized": false}
  │         │
  │         ├─[10] LBPH 识别
  │         │      idnum, conf = recognizer.predict(face)
  │         │      if conf < 100: recognized = true, userId = idnum
  │         │
  │         └─[11] stdout 输出 JSON
  │              {"recognized": true, "userId": 6, "userName": "gpt"}
  │              sys.exit(0)
  │         │
  │         ▼
  │     后端接收 stdout
  │         │
  │         ├─[12] 解析 JSON
  │         │      pyResult = JSON.parse(stdout)
  │         │
  │         ├─[13] 校验识别结果
  │         │      if (pyResult.recognized && pyResult.userId == 6):
  │         │          └─ 校验通过
  │         │      else:
  │         │          └─ 返回 400 "未识别到该用户的人脸"
  │         │
  │         ├─[14] 保存样本到训练集
  │         │      copyFile(absImagePath, Facedata/<name>.6.<timestamp>.jpg)
  │         │
  │         ├─[15] 触发重训练
  │         │      await runPythonTraining()
  │         │      spawn('py', ['-3', 'trainner.py'])
  │         │
  │         └─[16] 更新数据库
  │              UPDATE user SET faceRegistered=1 WHERE id=6
  │
  └─[17] 返回前端 JSON 响应
        {
          "success": true,
          "message": "人脸注册成功",
          "data": {
            "userId": 6,
            "savedToDataset": true,
            "retrained": true,
            "coldStart": false
          }
        }
       │
       ▼
前端接收响应
  └─[18] 显示提示：注册成功/失败
```

### 11.2 人脸识别与自动签到流程时序（详细）

```
时序图（人脸识别 + 自动签到场景）：

前端 (UNIAPP)
  │
  ├─[1] 构造 multipart/form-data
  │      - imagefile: <二进制图片>
  │      - taskId: 123 (可选)
  │
  └─[2] POST /api/face-recognition
       │
       ▼
后端 (Express + multer)
  │
  ├─[3] 接收请求，multer 保存文件
  │     保存至: back/public/imagefile-1759567764706-328347642.jpg
  │
  ├─[4] 调用 runPythonRecognition(absImagePath)
  │     生成子进程: spawn('py', ['-3', 'rec.py', absImagePath])
  │
  ▼
Python (rec.py) [步骤 7-11 同注册流程]
  │
  └─[5] stdout 输出 JSON
       {"recognized": true, "userId": 6, "userName": "gpt"}
       │
       ▼
后端接收 stdout
  │
  ├─[6] 解析 JSON
  │      pyResult = JSON.parse(stdout)
  │
  ├─[7] 判断识别结果
  │     if (!pyResult.recognized):
  │         └─ 返回 {"recognized": false, "attendanceRecorded": false}
  │
  ├─[8] 查询用户信息
  │     SELECT * FROM user WHERE id = 6
  │     if (rows.length === 0):
  │         └─ 返回 500 "用户信息查询失败"
  │
  ├─[9] 校验签到任务（如果提供了 taskId）
  │     SELECT * FROM attendance_task
  │     WHERE id = 123
  │       AND classId = <user.classId>
  │       AND status = 'active'
  │       AND startTime <= NOW()
  │       AND endTime >= NOW()
  │     if (taskRows.length === 0):
  │         └─ validTask = false
  │
  ├─[10] 自动写入签到记录（当 validTask = true）
  │      INSERT INTO attendance_record
  │      (userId, taskId, checkTime, status)
  │      VALUES (6, 123, NOW(), 1)
  │
  └─[11] 返回前端 JSON 响应
        {
          "success": true,
          "message": "人脸识别成功，已自动签到",
          "data": {
            "recognized": true,
            "userId": 6,
            "userAccount": "gpt",
            "userName": "gpt",
            "attendanceRecorded": true,
            "taskId": 123
          }
        }
       │
       ▼
前端接收响应
  └─[12] 显示识别结果与签到状态
```

### 11.3 时序关键点说明

1. **首次注册冷启动**：当 `faceRegistered=0` 时，跳过识别校验，直接保存样本并重训练，适合初始部署场景。
2. **非首次注册校验**：已有人脸记录时，必须先通过识别校验（返回的 `userId` 必须匹配），防止误将他人照片加入训练集。
3. **训练触发时机**：
   - **离线训练**：部署前手动运行 `trainner.py`，生成初始 `trainer.yml`
   - **在线训练**：每次注册成功后自动触发 `runPythonTraining()`，更新模型
4. **识别脚本输出约定**：`rec.py` 仅输出一次 JSON 到 stdout，确保后端能正确解析。
5. **数据库操作时机**：注册接口在识别校验通过后才更新数据库和保存训练样本，避免数据不一致。

### 11.4 前端请求规范（UNIAPP 示例）

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

### 11.5 E2E 检查清单（快速验证）

#### 环境与依赖检查

- [ ] Python 3.10/3.11 可用；`PYTHON_EXE` 指向确定的解释器
  ```powershell
  py -3 -V  # 应显示 Python 3.10.x 或 3.11.x
  ```
- [ ] 安装 `opencv-contrib-python`、`pillow`、`numpy`
  ```powershell
  py -3 -c "import cv2; import PIL; import numpy; print('Dependencies OK')"
  ```
- [ ] 训练产物 `opencv/face_get/face_trainer/trainer.yml` 存在且文件大小 > 0
- [ ] 训练数据目录 `opencv/face_get/Facedata/` 存在（至少包含一张训练样本）

#### 数据一致性检查

- [ ] 训练集文件名中的 `id` 与数据库 `user.id` 一致
  ```sql
  -- 数据库查询示例
  SELECT id FROM user ORDER BY id;
  -- 对比训练集文件名中的 id（通过 Python 脚本提取）
  ```
- [ ] 识别目标用户在库中真实存在
  ```sql
  SELECT * FROM user WHERE id = 6;  -- 替换为实际用户 ID
  ```

#### 后端与存储检查

- [ ] `back/public/` 可写，能生成上传文件
- [ ] 后端日志可见 `[Python exe]`、`[Python stdout]`、`[Python stderr]`
- [ ] `runPythonRecognition` 只解析到一条 JSON（stdout 无其他干扰）
- [ ] 数据库连接配置正确（`back/app.js` 第 48-59 行）

#### 前端请求检查

- [ ] `multipart/form-data` 字段名用 `imagefile`（与后端 `upload.single('imagefile')` 对应）
- [ ] 注册时随表单携带 `userId`（number 类型）
- [ ] 识别签到时如需自动签到，携带有效 `taskId`（且任务在有效时间窗内）

#### 快速验证命令（按顺序执行）

```powershell
# 1. 验证 Python 环境
py -3 -V
py -3 -c "import cv2; print(cv2.__version__)"

# 2. 验证训练数据目录
ls opencv/face_get/Facedata/

# 3. 验证训练产物
ls opencv/face_get/face_trainer/trainer.yml

# 4. 独立测试 Python 识别脚本（需先有训练数据）
py -3 opencv/face_get/rec.py opencv/face_get/Facedata/<某训练图片文件名>
# 应返回 JSON：{"recognized": true, "userId": X, "userName": "..."}

# 5. 测试后端接口（需后端已启动在 localhost:3000）
curl.exe -X POST http://localhost:3000/api/face-recognition `
  -F "imagefile=@<测试图片路径>;type=image/jpeg"
```

### 11.6 端到端验证步骤（建议顺序）

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

## 13. 错误映射与排错对照表

### 13.1 Python 环境相关错误

| 错误信息 | 可能原因 | 排查步骤 | 解决方案 |
| --- | --- | --- | --- |
| `No module named 'encodings'` | Python 安装损坏或环境变量干扰 | 1. 运行 `py -0p` 查看所有 Python 安装<br>2. 运行 `py -3 -V` 验证版本<br>3. 检查 `PATH` 环境变量 | 卸载所有 Python 与 Python Launcher，清理残留目录，使用官方安装包重装，并勾选 "Add Python to PATH / pip / venv" |
| `Python exited with code 9009` | Python 解释器未找到 | 1. 检查 `PYTHON_EXE` 环境变量<br>2. 验证 `py -3` 或 `python` 命令可用 | 设置 `PYTHON_EXE` 环境变量为 Python 可执行文件绝对路径，并重启后端 |
| `cv2.face` 不存在 / `AttributeError: module 'cv2' has no attribute 'face'` | 安装了错误的 OpenCV 包 | 运行 `py -3 -c "import cv2; print(cv2.__file__)"` 查看安装路径 | 卸载 `opencv-python`，安装 `opencv-contrib-python`：<br>`py -3 -m pip uninstall opencv-python`<br>`py -3 -m pip install opencv-contrib-python` |
| `Failed to parse Python stdout as JSON` | `rec.py` 输出包含非 JSON 内容 | 查看后端日志的 `[Python stdout]` 和 `[Python stderr]` | 确认 `rec.py` 在传参场景仅输出一次 JSON 并退出（已修正，如仍有问题检查脚本版本） |

### 13.2 识别与训练相关错误

| 错误信息 | 可能原因 | 排查步骤 | 解决方案 |
| --- | --- | --- | --- |
| `trainer.yml` 不存在 | 训练脚本未运行或训练失败 | 1. 检查 `opencv/face_get/face_trainer/trainer.yml` 是否存在<br>2. 查看训练脚本输出日志 | 运行 `py -3 opencv/face_get/trainner.py`，确认无错误输出 |
| 识别总是失败（`recognized: false`） | 1. 训练数据不足<br>2. 图片质量差<br>3. 置信度阈值过严 | 1. 检查训练集中样本数量<br>2. 验证图片中是否检测到人脸<br>3. 调整 `rec.py` 第 52 行的 `conf < 100` 阈值 | 1. 增加训练样本（每人至少 3-5 张）<br>2. 确保图片清晰、正面、光线充足<br>3. 适当放宽阈值（如改为 `conf < 120`） |
| `未识别到该用户的人脸`（注册接口） | 识别出的 `userId` 与入参不一致 | 1. 检查训练集文件名中的 `id` 是否与数据库对齐<br>2. 查看后端日志的 `[Python stdout]` | 对齐训练集文件名的 `id` 与数据库 `user.id`，重新训练 |
| `用户信息查询失败`（识别接口） | 识别出的 `userId` 在数据库不存在 | 1. 查询数据库：`SELECT * FROM user WHERE id = ?`<br>2. 检查训练集文件命名 | 插入用户或重命名训练样本文件，重新训练 |

### 13.3 文件系统与权限错误

| 错误信息 | 可能原因 | 排查步骤 | 解决方案 |
| --- | --- | --- | --- |
| `ENOENT: no such file or directory, mkdir '...\Facedata'` | 训练数据目录不存在 | 检查 `opencv/face_get/Facedata/` 目录 | 手动创建目录：`mkdir opencv\face_get\Facedata` |
| `EACCES: permission denied` | 文件或目录权限不足 | 1. 检查 `back/public/` 写入权限<br>2. 检查 `Facedata/` 写入权限 | 修改目录权限或使用管理员权限运行后端 |
| `File too large` | 上传文件超过限制 | 查看 `back/app.js` 第 193 行的 `fileSizeLimit` | 调整 `limits.fileSize` 或压缩图片 |

### 13.4 数据库相关错误

| 错误信息 | 可能原因 | 排查步骤 | 解决方案 |
| --- | --- | --- | --- |
| `ECONNREFUSED` / `getaddrinfo ENOTFOUND` | 数据库连接失败 | 1. 检查 MySQL 服务是否运行<br>2. 验证 `dbConfig` 中的连接参数 | 启动 MySQL 服务，确认 `host`、`port`、`user`、`password` 配置正确 |
| `Table 'face_recognition.user' doesn't exist` | 数据库表不存在 | 运行 `SHOW TABLES;` 查看表列表 | 执行 `database_schema.sql` 创建表结构 |

### 13.5 网络与接口错误

| 错误信息 | HTTP 状态码 | 可能原因 | 解决方案 |
| --- | --- | --- | --- |
| `未收到图片文件` | 400 | `imagefile` 字段缺失或为空 | 检查前端请求是否携带 `imagefile` 字段，字段名必须为 `imagefile` |
| `用户ID不能为空` | 400 | 注册接口未提供 `userId` | 在 `formData` 中携带 `userId` 字段 |
| `未识别到已知人脸` | 200（识别接口） | 算法未识别到匹配的人脸 | 正常情况，无需修复（识别失败不是错误） |

## 14. 配置项与可调参数说明

### 14.1 后端配置项（`back/app.js`）

| 配置项 | 代码位置 | 说明 | 默认值 | 可调范围 | 调整建议 |
| --- | --- | --- | --- | --- | --- |
| `fileSizeLimit` | 第 193 行 | 单文件上传大小限制（字节） | `20 * 1024 * 1024` (20MB) | 1MB - 100MB | 根据业务需求调整，过大可能影响上传性能 |
| `connectionLimit` | 第 55 行 | MySQL 连接池最大连接数 | 10 | 5 - 50 | 高并发场景可适当增加，但不超过数据库最大连接数 |
| `acquireTimeout` | 第 56 行 | 获取数据库连接超时时间（毫秒） | 60000 (60秒) | 30000 - 120000 | 网络不稳定时可适当增加 |
| `timeout` | 第 57 行 | 数据库查询超时时间（毫秒） | 60000 (60秒) | 30000 - 120000 | 复杂查询场景可适当增加 |
| `PYTHON_EXE` | 环境变量 | Python 解释器绝对路径（可选） | `null`（自动探测） | 任意有效路径 | 多版本共存时建议固定，避免版本冲突 |

### 14.2 Python 脚本可调参数（`opencv/face_get/rec.py`）

| 参数 | 代码位置 | 说明 | 默认值 | 可调范围 | 调整建议 |
| --- | --- | --- | --- | --- | --- |
| `conf < 100` | 第 52 行 | 识别置信度阈值（越小越严格） | 100 | 60 - 150 | 误识别率高时减小（如 80），漏识别率高时增大（如 120） |
| `scaleFactor` | 第 42 行 | 人脸检测缩放因子 | 1.2 | 1.1 - 1.5 | 人脸较小或较远时可适当减小（如 1.1） |
| `minNeighbors` | 第 42 行 | 人脸检测最小邻居数 | 5 | 3 - 7 | 误检多时增大，漏检多时减小 |

### 14.3 训练脚本参数（`opencv/face_get/trainner.py`）

| 参数 | 说明 | 默认值 | 调整建议 |
| --- | --- | --- | --- |
| LBPH 算法参数 | `cv2.face.LBPHFaceRecognizer_create()` | OpenCV 默认 | 通常无需调整，LBPH 为无参数训练 |

### 14.4 超时配置说明

**当前实现未设置子进程超时**，如需添加，可在 `runPythonRecognition` 函数中包装 `Promise.race`：

```javascript
// 示例：添加 10 秒超时
const timeoutPromise = new Promise((_, reject) => {
  setTimeout(() => reject(new Error('Python script timeout')), 10000);
});
const result = await Promise.race([
  trySpawn(opt),
  timeoutPromise
]);
```

**建议超时阈值**：
- 识别脚本（`rec.py`）：建议 < 3 秒（正常情况 1-2 秒）
- 训练脚本（`trainner.py`）：根据训练数据量，一般 10-60 秒

### 14.5 上传限制说明

- **文件大小限制**：当前为 20MB，可通过 `multer` 的 `limits.fileSize` 调整
- **支持格式**：由 `multer` 自动识别，建议限制为图片格式（需在代码中添加 MIME 类型校验）
- **并发上传**：Node.js 默认支持并发，但建议在生产环境添加限流（如使用 `express-rate-limit`）

## 15. 常见端到端问题与快速修复（精简版）

参考第 13 节“错误映射与排错对照表”，以下为最常遇到的问题：

- 后端报 `Python exited with code 9009`：设置 `PYTHON_EXE` 环境变量，重启后端
- 注册返回"未识别到该用户的人脸"：对齐训练集文件名的 `id` 与数据库 `user.id`，重新训练
- 识别返回"用户信息查询失败"：数据库不存在识别到的 `userId`；插入用户或重训改名
- `cv2.face` 不存在：安装 `opencv-contrib-python` 而非 `opencv-python`
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




