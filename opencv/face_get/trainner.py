import numpy as np
from PIL import Image
import os
import cv2
from settings import src
# 人脸数据路径（改为项目相对路径）
path = os.path.join(os.path.dirname(__file__), 'Facedata')

out_dir = os.path.join(os.path.dirname(__file__), 'face_trainer')
try:
    os.makedirs(out_dir, exist_ok=True)
except Exception:
    pass

recognizer = cv2.face.LBPHFaceRecognizer_create()
detector = cv2.CascadeClassifier(os.path.join(src, "haarcascade_frontalface_default.xml"))

def getImagesAndLabels(path):
    imagePaths = [os.path.join(path, f) for f in os.listdir(path)]
    faceSamples = []
    ids = []
    for imagePath in imagePaths:
        PIL_img = Image.open(imagePath).convert('L')   # convert it to grayscale
        img_numpy = np.array(PIL_img, 'uint8')
        id = int(os.path.split(imagePath)[-1].split(".")[1])
        faces = detector.detectMultiScale(img_numpy)
        if len(faces) == 0:
            print('未检测到人脸：', os.path.basename(imagePath))
            continue
        elif len(faces) == 1:
            print('检测到人脸：', os.path.basename(imagePath))
        elif len(faces) > 1:
            print(os.path.basename(imagePath))
        for (x, y, w, h) in faces:
            faceSamples.append(img_numpy[y:y + h, x: x + w])
            ids.append(id)
    return faceSamples, ids


print('训练需要一定时间，请耐心等待....')
faces, ids = getImagesAndLabels(path)
recognizer.train(faces, np.array(ids))

recognizer.write(os.path.join(out_dir, 'trainer.yml'))
print("{0} faces trained. Exiting Program".format(len(np.unique(ids))))
print("训练集实际ID：", sorted(set(ids)))
print('训练目录：', os.path.abspath(path))