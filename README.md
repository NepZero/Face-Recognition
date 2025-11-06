# 仓库介绍
一个基于uniapp前端和后端结合的软件文档需求分析的人脸识别的大作业
uniapp文件夹为前端app代码，back为后端代码

# 仓库使用
下载并安装app，打开后端nodejs服务器，确保设备在同一网络下，打开命令行用ipconfig查看ip。在app的个人中心的网络设置中输入ip加上/send即可上传图片

# 服务端启动
1. 下载安装Nodejs，详细看此[B站视频](https://www.bilibili.com/video/BV19F411t7zX/?share_source=copy_web&vd_source=3e9e72ed2a403a7c4db67b5165334887).
 + 安装Nodejs安装包
 + 在安装好的根目录下建立两个文件夹node_cache和node_global
 + 将此根目录和上面两个文件夹添加到环境变量中
 + 命令行输入node -v和npm -v，有显示则成功
2. 安装本项目所需的依赖库，在项目根目录命令行依次输入`npm i` , `npm i -g nodemon`(可能因为权限问题报错，以管理员身份运行cmd)
3. 安装Mysql数据库和数据库可视化软件mysqlworkbench，参考此[文章](https://blog.csdn.net/weixin_39289696/article/details/128850498),端口号默认3306,密码设置为123456(不然要去后端自行修改数据库配置).在服务中有Mysql的服务则成功。
4. 执行back文件夹下的database_schema.sql中的sql语句
5. 在back同级目录下执行 `node app.js`


# App测试
下载安装HbuilderX,用此软件打开uniapp文件夹,依次点击运行->运行到浏览器

