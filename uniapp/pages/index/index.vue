<template>
	<scroll-view class="layout" scroll-y="true" :style="'height:'+screenHeight+'px!important'">
		<button class='loadbutton' size="default" @click="uploadimg">
			<text>拍照签到</text>
			<view class="dot" v-if="task_flag"></view>
		</button>
		<button size="default" @click="testConnection" :loading=connection_flag>网络测试</button>
		<button size="default" @click="ipconfig">网络配置</button>
		<button size="default" @click="checkClick" v-if="!studentFlag">发布签到</button>
		<!-- <button size="default" @click="testClick">用户信息</button> -->
		
		<!-- 签到任务列表 -->
		<view class="task-list" v-if="tasks.length > 0">
			<view class="task-title">签到任务</view>
			<view class="task-item" v-for="(task, index) in tasks" :key="task.id" @click="selectTask(task)">
				<view class="task-name">{{ task.taskName }}</view>
				<view class="task-info">
					<text class="task-time">{{ formatTime(task.startTime) }} - {{ formatTime(task.endTime) }}</text>
					<text class="task-status" :class="{'status-active': task.status === 'active', 'status-completed': task.status === 'completed'}">
						{{ task.status === 'active' ? '进行中' : task.status === 'completed' ? '已完成' : '已结束' }}
					</text>
				</view>
				<view class="task-teacher" v-if="task.teacherName">发布人：{{ task.teacherName }}</view>
			</view>
		</view>
	</scroll-view>
</template>

<script setup>
	import { onLoad,onShow} from '@dcloudio/uni-app';
	import {ref,computed} from 'vue';
	import { isStudent } from '../../utils/utils';
	import { getCurrentInstance } from 'vue'
	import { tokenGet } from '../../utils/utils';
	
	const {proxy}=getCurrentInstance();
	const connection_flag=ref(false);
	const screenHeight=ref();
	const studentFlag=ref(true);
	const task_flag=ref(false);
	const tasks=ref([]); // 存储任务列表
	const selectedTask=ref(null); // 当前选中的任务
	
	
	onLoad(()=>{
		screenHeight.value=uni.getSystemInfoSync().windowHeight;
		studentFlag.value=isStudent();
		getTasks(); // 页面加载时立即获取一次任务列表
	})
	onShow(()=>{
		// 页面显示时重新检查用户角色（可能在另一个页面登录了）
		studentFlag.value=isStudent();
		getTasks(); // 页面显示时也获取一次任务列表
	})
	setInterval(getTasks, 5000); // 每5秒轮询一次
	
	
	
	
	function uploadimg() //拍照签到event
	{
		// 如果有选中的任务，使用任务ID，否则不传taskId
		const taskId = selectedTask.value ? selectedTask.value.id : null;
		
		uni.chooseImage({
			count: 1, //默认9
			sizeType: ['original', 'compressed'], //可以指定是原图还是压缩图，默认二者都有
			sourceType: ['camera'], 
			success: function (res) {
				console.log(tokenGet())
				const path=res.tempFilePaths[0];
				console.log(path);
				
				// 构建表单数据
				const formData = {};
				if(taskId) {
					formData.taskId = taskId;
				}
				
				uni.uploadFile({
							url: 'http://'+proxy.$config.get('ip')+'/api/face-recognition', //仅为示例，非真实的接口地址
							filePath: path,
							header:{'Authorization':tokenGet()},
							formData: formData, // 如果有taskId，会自动添加到请求中
							name: 'imagefile',
							timeout:10000,
							success: (res) => {
								console.log(res)
								// uni.uploadFile 返回的 res.data 是字符串，需要解析
								let responseData;
								try {
									responseData = typeof res.data === 'string' ? JSON.parse(res.data) : res.data;
								} catch(e) {
									responseData = res.data;
								}
								
								if(responseData.success)
								{
									uni.showToast({
									    title: '签到成功',
									    icon: 'success'
									});
									setTimeout(() => {
										getTasks();
									}, 1000);
								}
								else
								{
									uni.showModal({
										title: '签到失败',
										content: responseData.message || '签到失败，请重试',
										showCancel:false
									});
								}
							},
							fail:(res)=>{
								uni.showToast({
									title:'签到失败',
									icon:'error'
								})
							},
							complete:()=>{
								console.log('上传完成');
							}
				});
			}
		});
	}
	
	function testConnection() {		//网络测试
		connection_flag.value=true;
	    uni.request({ 
			url:'http://'+proxy.$config.get('ip')+'/send',// 替换为你的电脑IP
	        method: 'POST',
			timeout:5000,
	        success: (res) => {
	            console.log('连接测试成功:', res.data);
	            uni.showToast({
	                title: '连接成功',
	                icon: 'success'
	            });
	        },
	        fail: (err) => {
	            console.error('连接测试失败:', err);
	            uni.showModal({
	                title: '连接失败',
	                content: `无法连接到服务器\n请检查:\n1. IP地址是否正确\n2. 端口是否开放\n3. 防火墙设置`,
	                showCancel: false
	            });
	        },
			complete:()=>{
				connection_flag.value=false;
			}
	    });
	}
	
	function ipconfig()
	{
		uni.showModal({
			title: proxy.$config.get('ip'),
			content:'',
			editable: true,
			placeholderText:'输入ip',
			success: (res) => {
				if(res.confirm)
				{
					proxy.$config.set('ip',res.content);
				}
			},
		})
	}
	
	function checkClick()		//老师发布签到按钮
	{
		uni.request({
			url:'http://'+proxy.$config.get('ip')+'/api/attendance-task',
			method:'POST',
			timeout:5000,
			data:{'duration':10},
			header:{'Authorization':tokenGet()},
			success: (res) => {
				const response = res.data || res;
				if(response.success)
				{
					uni.showToast({
						title:"发布签到成功",
						icon:'success'
					});
					// 发布成功后刷新任务列表
					setTimeout(() => {
						getTasks();
					}, 500);
				}
				else
				{
					uni.showToast({
						title: response.message || "发布签到失败",
						icon:'error'
					})
				}
			},
			fail: (res) => {
				uni.showToast({
					title:"发布签到失败",
					icon:'error'
				})
			}
		})
	}
	
	// function testClick()
	// {
	// 	uni.request({
	// 		url:'http://'+proxy.$config.get('ip')+'/api/user-info',
	// 		method:'POST',
	// 		timeout:5000,
	// 	})
	// }
	function getTasks()		//获取签到消息
	{
		uni.request({
			url:'http://'+proxy.$config.get('ip')+'/api/attendance-tasks',
			method:'GET',
			timeout:5000,
			header:{'Authorization':tokenGet()},
			success: (res) => {
				// uni.request 返回的数据在 res.data 中
				const response = res.data || res;
				if(response.success && response.data)
				{
					tasks.value = response.data;
					task_flag.value = response.data.length > 0;
					console.log('获取任务列表成功:', response.data);
				}
				else
				{
					tasks.value = [];
					task_flag.value = false;
				}
			},
			fail: (res) => {
				console.log('获取任务列表失败:', res);
				tasks.value = [];
				task_flag.value = false;
			}
		})
	}
	
	function selectTask(task) {
		// 选择任务后，可以用于后续签到操作
		selectedTask.value = task;
		console.log('选中任务:', task);
		uni.showModal({
			title: task.taskName,
			content: `任务时间：${formatTime(task.startTime)} - ${formatTime(task.endTime)}\n状态：${task.status === 'active' ? '进行中' : task.status === 'completed' ? '已完成' : '已结束'}`,
			showCancel: true,
			confirmText: '去签到',
			success: (res) => {
				if(res.confirm && task.status === 'active') {
					// 点击确认后触发拍照签到
					uploadimg();
				}
			}
		});
	}
	
	function formatTime(timeStr) {
		if(!timeStr) return '';
		// 将时间字符串格式化为更易读的格式
		const date = new Date(timeStr);
		const month = (date.getMonth() + 1).toString().padStart(2, '0');
		const day = date.getDate().toString().padStart(2, '0');
		const hours = date.getHours().toString().padStart(2, '0');
		const minutes = date.getMinutes().toString().padStart(2, '0');
		return `${month}-${day} ${hours}:${minutes}`;
	}
</script>

<style lang='scss' scoped>
	.layout{
		width: 100%;
		height: 100%;
		background-image: url('~@/static/background.png');
		background-size: cover;
		background-position: center;
		button{
			width: 250rpx;
			height: 200rpx;
			display: flex;
			justify-content: center;
			align-items: center;
			margin-top: 100rpx;
			font-size: 30rpx;
		}
		.loadbutton{
			margin-top: 300rpx;
			.dot{
				position: absolute;
				top: 70rpx;
				right: 45rpx;
				width: 20rpx;
				height: 20rpx;
				background-color: #FF3B30;
				border-radius: 50%;
			}
		}
		
		.task-list{
			margin-top: 50rpx;
			padding: 0 30rpx;
			max-height: 60vh;
			overflow-y: auto;
		}
		
		.task-title{
			font-size: 36rpx;
			font-weight: bold;
			color: #333;
			margin-bottom: 30rpx;
			text-align: center;
		}
		
		.task-item{
			background-color: rgba(255, 255, 255, 0.9);
			border-radius: 15rpx;
			padding: 30rpx;
			margin-bottom: 20rpx;
			box-shadow: 0 2rpx 10rpx rgba(0, 0, 0, 0.1);
		}
		
		.task-name{
			font-size: 32rpx;
			font-weight: bold;
			color: #333;
			margin-bottom: 15rpx;
		}
		
		.task-info{
			display: flex;
			justify-content: space-between;
			align-items: center;
			margin-bottom: 10rpx;
		}
		
		.task-time{
			font-size: 28rpx;
			color: #666;
		}
		
		.task-status{
			font-size: 24rpx;
			padding: 5rpx 15rpx;
			border-radius: 10rpx;
			background-color: #f0f0f0;
			color: #999;
		}
		
		.task-status.status-active{
			background-color: #e8f5e9;
			color: #4caf50;
		}
		
		.task-status.status-completed{
			background-color: #e3f2fd;
			color: #2196f3;
		}
		
		.task-teacher{
			font-size: 24rpx;
			color: #999;
			margin-top: 10rpx;
		}
	}
</style>
