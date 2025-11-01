import cv2
import os
import sys
from settings import src
import json

# 0. 建立 ID→名字
FACE_DATA_DIR = os.path.join(os.path.dirname(__file__), 'Facedata')
# 确保训练数据目录存在（若不存在则创建空目录，便于后续运行与训练）
if not os.path.isdir(FACE_DATA_DIR):
    os.makedirs(FACE_DATA_DIR, exist_ok=True)

id2name = {}
for fname in os.listdir(FACE_DATA_DIR):
    if not fname.lower().endswith(('.jpg', '.jpeg', '.png')):
        continue
    try:
        id_part = fname.split(".")[1]
        name_part = fname.split(".")[0]
        id2name[int(id_part)] = name_part
    except (ValueError, IndexError):
        continue

print("最终映射：", id2name, file=sys.stderr)   # 调试信息输出到 stderr，避免干扰 stdout JSON

# ---------- 1. 读图（可选，从命令行参数传入） ----------
# 为了与后端保持一致：
# - 如果提供了图片路径参数（argv[1]），执行一次实时识别（stdout 打印结果）
# - 无参数时，仅生成算法 mock JSON 文件，供后端读取

img_path = sys.argv[1] if len(sys.argv) > 1 else None

if img_path:
    img = cv2.imread(img_path)
    result = {"recognized": False, "message": "unknown"}
    if img is None:
        print(json.dumps(result, ensure_ascii=False))
    else:
        # ---------- 2. 加载模型 ----------
        recognizer = cv2.face.LBPHFaceRecognizer_create()
        trainer_path = os.path.join(os.path.dirname(__file__), 'face_trainer', 'trainer.yml')
        recognizer.read(trainer_path)
        face_cascade = cv2.CascadeClassifier(os.path.join(src, 'haarcascade_frontalface_default.xml'))

        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        faces = face_cascade.detectMultiScale(gray, 1.2, 5)

        if len(faces) == 0:
            print(json.dumps(result, ensure_ascii=False))
        else:
            # ---------- 3. 识别 ----------
            x, y, w, h = faces[0]
            face = gray[y:y+h, x:x+w]
            idnum, conf = recognizer.predict(face)

            if conf < 100:
                name = id2name.get(idnum, f"id_{idnum}")
                result = {
                    "recognized": True,
                    "userId": int(idnum),
                    "userName": name
                }
            print(json.dumps(result, ensure_ascii=False))
    # 后端调用场景：当提供了图片路径参数时，仅输出一次 JSON 并正常退出
    sys.exit(0)

# 仅在未传入图片路径时，生成/更新本地 mock JSON 文件
# === 生成 JSON 文件 ===
# 生成 face-recognition.json
mock_data = {
    "matchBy": "originalname",
    "cases": []
}

for uid, name in id2name.items():
    # 默认文件命名规则类似 zhangsan.101.1.jpg
    for i in range(1, 4):  # 假设每人3张样本图，可根据实际修改
        mock_data["cases"].append({
            "filename": f"{name}.{uid}.{i}.jpg",
            "recognized": True,
            "userId": uid,
            "userAccount": f"stu{uid:03d}",
            "userName": name
        })
        # 再添加一个 startsWith 规则
        mock_data["cases"].append({
            "startsWith": f"{name}.",
            "recognized": True,
            "userId": uid
        })

mock_data["fallback"] = {
    "recognized": False,
    "message": "未识别到已知人脸"
}

# 将算法 mock 输出到后端读取的目录 back/algorithm_mock
save_dir = os.path.normpath(os.path.join(os.path.dirname(__file__), "..", "..", "back", "algorithm_mock"))
os.makedirs(save_dir, exist_ok=True)
save_path = os.path.join(save_dir, "face-recognition.json")

with open(save_path, "w", encoding="utf-8") as f:
    json.dump(mock_data, f, ensure_ascii=False, indent=4)

print(f"✅ 已生成 {save_path}")

# === 可选：生成 face-register.json ===
register_data = {
    "allowAll": False,
    "users": [{"userId": uid, "message": "人脸注册成功"} for uid in id2name.keys()],
    "default": {"success": False, "message": "未检测到人脸或图片质量过低"}
}
with open(os.path.join(save_dir, "face-register.json"), "w", encoding="utf-8") as f:
    json.dump(register_data, f, ensure_ascii=False, indent=4)
print("✅ 已生成 face-register.json")