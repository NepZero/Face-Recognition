# 后端接口自测指南（Windows PowerShell / CMD）

- 目录: `back`
- 端口: `3000`
- 数据库: MySQL，需先按 `back/database_schema.sql` 初始化库表，并在 `back/app.js` 中调整 `dbConfig`

## 1. 启动服务

PowerShell 推荐（避开执行策略限制）：

```powershell
cd back
node app.js
```

若需用 npm 启动且遇到执行策略限制，可在当前会话放开策略：

```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
cd back
npm start
```

健康检查：

```powershell
curl.exe http://localhost:3000/home
```

## 2. 接口测试速查

说明：
- PowerShell 的 `curl` 是 `Invoke-WebRequest` 的别名，参数语法差异较大；建议使用 `curl.exe`。
- 涉及登录态的接口使用 Cookie 维持会话（PowerShell 用 `-SessionVariable`，curl 用 `--cookie-jar/--cookie`）。

### 2.1 用户注册 POST `/api/register`

请求体（JSON）：

```json
{"userAccount":"user123","userPassword":"Passw0rd","userName":"测试用户"}
```

PowerShell：

```powershell
$body = @{ userAccount="user$(Get-Random)"; userPassword="Passw0rd"; userName="测试用户" } | ConvertTo-Json
Invoke-WebRequest -Uri http://localhost:3000/api/register -Method POST -Body $body -ContentType 'application/json' -UseBasicParsing | Select-Object -ExpandProperty Content
```

curl.exe：

```bat
curl.exe -s -X POST "http://localhost:3000/api/register" ^
  -H "Content-Type: application/json" ^
  -d "{\"userAccount\":\"user123\",\"userPassword\":\"Passw0rd\",\"userName\":\"测试用户\"}"
```

期望成功：

```json
{"success":true,"message":"注册成功","data":{"userId":1,"userAccount":"user123","userName":"测试用户"}}
```

### 2.2 用户登录 POST `/api/login`（保存会话）

PowerShell：

```powershell
$login = @{ userAccount="user123"; userPassword="Passw0rd" } | ConvertTo-Json
Invoke-WebRequest -Uri http://localhost:3000/api/login -Method POST -Body $login -ContentType 'application/json' -UseBasicParsing -SessionVariable sess | Select-Object -ExpandProperty Content
```

curl.exe（保存到 cookies.txt）：

```bat
curl.exe -s -X POST "http://localhost:3000/api/login" ^
  -H "Content-Type: application/json" ^
  -d "{\"userAccount\":\"user123\",\"userPassword\":\"Passw0rd\"}" ^
  --cookie-jar cookies.txt
```

### 2.3 获取用户信息 GET `/api/user-info`

PowerShell（已登录态）：

```powershell
Invoke-WebRequest -Uri http://localhost:3000/api/user-info -Method GET -UseBasicParsing -WebSession $sess | Select-Object -ExpandProperty Content
```

curl.exe：

```bat
curl.exe -s "http://localhost:3000/api/user-info" --cookie cookies.txt
```

未登录期望：`{"success":false,"message":"未登录"}`

### 2.4 登出 POST `/api/logout`

PowerShell：

```powershell
Invoke-WebRequest -Uri http://localhost:3000/api/logout -Method POST -UseBasicParsing -WebSession $sess | Select-Object -ExpandProperty Content
```

curl.exe：

```bat
curl.exe -s -X POST "http://localhost:3000/api/logout" --cookie cookies.txt
```

### 2.5 普通上传 POST `/send`（multipart/form-data）

PowerShell：

```powershell
$FilePath = "F:\\code\\faceRecognition\\Face-Recognition\\back\\public\\imagefile-1760177453649-984597973.jpg"
$Form = @{ imagefile = Get-Item $FilePath; user = "tester" }
Invoke-WebRequest -Uri "http://localhost:3000/send" -Method POST -Form $Form -UseBasicParsing | Select-Object -ExpandProperty Content
```

curl.exe：

```bat
curl.exe -s -X POST "http://localhost:3000/send" ^
  -F "imagefile=@F:\\code\\faceRecognition\\Face-Recognition\\back\\public\\imagefile-1760177453649-984597973.jpg;type=image/jpeg" ^
  -F "user=tester"
```

### 2.6 人脸注册 POST `/api/face-register`（multipart/form-data）

说明：算法服务未连通时，预期返回失败或 500；本测试用于验证上传与参数校验。

PowerShell：

```powershell
$FilePath = "F:\\code\\faceRecognition\\Face-Recognition\\back\\public\\imagefile-1760177453649-984597973.jpg"
$Form = @{ imagefile = Get-Item $FilePath; userId = "1" }
Invoke-WebRequest -Uri "http://localhost:3000/api/face-register" -Method POST -Form $Form -UseBasicParsing | Select-Object -ExpandProperty Content
```

curl.exe：

```bat
curl.exe -s -X POST "http://localhost:3000/api/face-register" ^
  -F "imagefile=@F:\\code\\faceRecognition\\Face-Recognition\\back\\public\\imagefile-1760177453649-984597973.jpg;type=image/jpeg" ^
  -F "userId=1"
```

### 2.7 人脸识别 POST `/api/face-recognition`（multipart/form-data）

PowerShell：

```powershell
$FilePath = "F:\\code\\faceRecognition\\Face-Recognition\\back\\public\\imagefile-1760177453649-984597973.jpg"
$Form = @{ imagefile = Get-Item $FilePath }
Invoke-WebRequest -Uri "http://localhost:3000/api/face-recognition" -Method POST -Form $Form -UseBasicParsing | Select-Object -ExpandProperty Content
```

curl.exe：

```bat
curl.exe -s -X POST "http://localhost:3000/api/face-recognition" ^
  -F "imagefile=@F:\\code\\faceRecognition\\Face-Recognition\\back\\public\\imagefile-1760177453649-984597973.jpg;type=image/jpeg"
```

## 3. 常见问题

- PowerShell 阻止 npm 脚本：使用 `node app.js` 启动，或 `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`
- `curl` 参数异常：改用 `curl.exe` 或使用 `Invoke-WebRequest`
- 端口占用：修改 `app.listen(3000, ...)` 或释放占用进程
- MySQL 连接失败：检查 `dbConfig`、数据库服务与表结构
- 人脸接口失败：算法服务未连接属预期

---

如需我帮你批量生成测试账号/脚本，请告知数量和前缀。
