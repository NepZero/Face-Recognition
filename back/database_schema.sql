
-- 数据库: MySQL 5.7+
-- 创建数据库（如果不存在）
CREATE DATABASE IF NOT EXISTS face_recognition CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
-- 使用数据库
USE face_recognition;
-- 1. 用户信息表 (user)
CREATE TABLE user (
  id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '用户ID，主键',
  userAccount VARCHAR(50) NOT NULL COMMENT '用户账号',
  userPassword VARCHAR(100) NOT NULL COMMENT '用户密码，加密存储',
  userName VARCHAR(50) NULL COMMENT '用户姓名，可选',
  faceRegistered TINYINT DEFAULT 0 COMMENT '人脸是否已注册，0-未注册，1-已注册',
  createTime DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  updateTime DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  -- 唯一约束
  UNIQUE KEY uk_userAccount (userAccount)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '用户信息表';
-- 2. 签到记录表 (attendance_record)
CREATE TABLE attendance_record (
  id BIGINT AUTO_INCREMENT PRIMARY KEY COMMENT '记录ID，主键',
  userId BIGINT NOT NULL COMMENT '用户ID，外键关联user表',
  checkTime DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '签到时间',
  status TINYINT DEFAULT 1 COMMENT '签到状态，1-成功，0-失败',
  createTime DATETIME DEFAULT CURRENT_TIMESTAMP COMMENT '记录创建时间',
  -- 外键约束
  FOREIGN KEY (userId) REFERENCES user(id) ON DELETE CASCADE ON UPDATE CASCADE,
  -- 索引
  INDEX idx_time (checkTime),
  INDEX idx_user_time (userId, checkTime)
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci COMMENT = '签到记录表';
-- 显示表结构
SHOW TABLES;
