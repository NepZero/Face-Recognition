-- 数据库: MySQL 5.7+
-- 创建数据库（如果不存在）
CREATE DATABASE IF NOT EXISTS face_recognition CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- 使用数据库
USE face_recognition;
-- 删除已存在的表（按依赖关系逆序删除）
DROP TABLE IF EXISTS attendance_record;
DROP TABLE IF EXISTS attendance_task;
DROP TABLE IF EXISTS user;
DROP TABLE IF EXISTS class;
-- 0. 班级表 (class) - 需要在用户表之前创建
CREATE TABLE class (
  id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '班级ID，主键',
  className VARCHAR(100) NOT NULL COMMENT '班级名称',
  classCode VARCHAR(20) NOT NULL COMMENT '班级代码，唯一标识',
  createTime DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updateTime DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  -- 唯一约束
  UNIQUE KEY uk_classCode (classCode)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '班级信息表';
-- 1. 用户信息表 (user)
CREATE TABLE user (
  id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '用户ID，主键',
  userAccount VARCHAR(50) NOT NULL COMMENT '用户账号',
  userPassword VARCHAR(100) NOT NULL COMMENT '用户密码，加密存储',
  userName VARCHAR(50) NULL COMMENT '用户姓名，可选',
  userRole ENUM('student', 'teacher') NOT NULL DEFAULT 'student' COMMENT '用户角色，student-学生，teacher-老师',
  classId BIGINT NULL COMMENT '班级ID，外键关联class表，学生必填，老师可为空',
  faceRegistered TINYINT DEFAULT 0 COMMENT '人脸是否已注册，0-未注册，1-已注册',
  createTime DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updateTime DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  -- 唯一约束
  UNIQUE KEY uk_userAccount (userAccount),
  -- 外键约束
  FOREIGN KEY (classId) REFERENCES class(id) ON DELETE
  SET NULL ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '用户信息表';
-- 2. 签到任务表 (attendance_task)
CREATE TABLE attendance_task (
  id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '任务ID，主键',
  taskName VARCHAR(100) NOT NULL COMMENT '签到任务名称',
  teacherId BIGINT NOT NULL COMMENT '发布老师ID，外键关联user表',
  classId BIGINT NOT NULL COMMENT '目标班级ID，外键关联class表',
  startTime DATETIME NOT NULL COMMENT '签到开始时间',
  endTime DATETIME NOT NULL COMMENT '签到结束时间',
  status ENUM('active', 'inactive', 'completed') DEFAULT 'active' COMMENT '任务状态，active-进行中，inactive-已结束，completed-已完成',
  createTime DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '任务创建时间',
  updateTime DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '任务更新时间',
  -- 外键约束
  FOREIGN KEY (teacherId) REFERENCES user(id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (classId) REFERENCES class(id) ON DELETE CASCADE ON UPDATE CASCADE,
  -- 索引
  INDEX idx_teacher (teacherId),
  INDEX idx_class (classId),
  INDEX idx_time (startTime, endTime)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '签到任务表';
-- 3. 签到记录表 (attendance_record)
CREATE TABLE attendance_record (
  id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '记录ID，主键',
  userId BIGINT NOT NULL COMMENT '用户ID，外键关联user表',
  taskId BIGINT NULL COMMENT '签到任务ID，外键关联attendance_task表',
  checkTime DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '签到时间',
  status TINYINT DEFAULT 1 COMMENT '签到状态，1-成功，0-失败',
  createTime DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
  -- 外键约束
  FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE ON UPDATE CASCADE,
  FOREIGN KEY (taskId) REFERENCES attendance_task(id) ON DELETE
  SET NULL ON UPDATE CASCADE,
    -- 索引
    INDEX idx_time (checkTime),
    INDEX idx_user_time (userId, checkTime),
    INDEX idx_task (taskId)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '签到记录表';
-- 预置班级数据
INSERT INTO class (className, classCode)
VALUES ('计算机科学与技术2023级1班', 'CS2023-1'),
  ('计算机科学与技术2023级2班', 'CS2023-2'),
  ('软件工程2023级1班', 'SE2023-1'),
  ('软件工程2023级2班', 'SE2023-2'),
  ('人工智能2023级1班', 'AI2023-1');
-- 预置老师数据（密码为123456的bcrypt加密结果）
INSERT INTO user (
    userAccount,
    userPassword,
    userName,
    userRole,
    classId
  )
VALUES (
    'teacher001',
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    '张老师',
    'teacher',
    1
  ),
  (
    'teacher002',
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    '李老师',
    'teacher',
    2
  ),
  (
    'teacher003',
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    '王老师',
    'teacher',
    3
  ),
  (
    'teacher004',
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    '赵老师',
    'teacher',
    4
  ),
  (
    'teacher005',
    '$2b$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
    '刘老师',
    'teacher',
    5
  );
-- 显示表结构
SHOW TABLES;
-- 显示各表结构
DESCRIBE class;
DESCRIBE user;
DESCRIBE attendance_task;
DESCRIBE attendance_record;
