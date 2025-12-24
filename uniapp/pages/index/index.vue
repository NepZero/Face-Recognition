<template>
	<scroll-view class="layout" scroll-y="true" :style="'height:'+screenHeight+'px!important;padding-top:'+(showFaceTip ? '80rpx' : '0')+';'">
		<!-- 人脸注册提示条 -->
		<view class="face-tip" v-if="showFaceTip" @click="goToRegister">
			<text class="tip-text">⚠️ 您还未注册人脸，请先前往个人中心注册</text>
			<text class="tip-btn">去注册</text>
		</view>
		<button class='loadbutton' size="default" @click="uploadimg">
			<text>拍照签到</text>
			<view class="dot" v-if="task_flag"></view>
		</button>
		<button size="default" @click="testConnection" :loading=connection_flag>网络测试</button>
		<button size="default" @click="ipconfig">网络配置</button>
		<button size="default" @click="goToCourses" v-if="!studentFlag">课程管理</button>
		<button size="default" @click="checkClick" v-if="!studentFlag">发布签到</button>
		<!-- <button size="default" @click="testClick">用户信息</button> -->
		
		<!-- 发布签到弹窗 -->
		<view class="publish-modal" v-if="showPublishModal" @click.stop="closePublishModal">
			<view class="publish-modal-content" @click.stop>
				<view class="publish-modal-header">
					<text class="publish-modal-title">发布签到</text>
					<text class="publish-modal-close" @click="closePublishModal">×</text>
				</view>
				<view class="publish-modal-body">
					<view class="publish-course-info">
						<view class="course-info-item">
							<text class="course-info-label">课程名称</text>
							<text class="course-info-value">{{ selectedCourseForPublish?.courseName || '' }}</text>
						</view>
						<view class="course-info-item" v-if="selectedCourseForPublish?.courseCode">
							<text class="course-info-label">课程代码</text>
							<text class="course-info-value">{{ selectedCourseForPublish.courseCode }}</text>
						</view>
					</view>
					<view class="publish-duration-input">
						<text class="duration-label">持续时长（分钟）</text>
						<input 
							class="duration-input" 
							type="number" 
							v-model="publishDuration" 
							placeholder="请输入时长，如：10" 
							maxlength="3"
							@input="validateDuration"
						/>
						<view class="duration-tips">
							<text class="tip-item" @click="setDuration(5)">5分钟</text>
							<text class="tip-item" @click="setDuration(10)">10分钟</text>
							<text class="tip-item" @click="setDuration(15)">15分钟</text>
							<text class="tip-item" @click="setDuration(30)">30分钟</text>
						</view>
					</view>
				</view>
				<view class="publish-modal-footer">
					<button class="publish-btn cancel-btn" @click="closePublishModal">取消</button>
					<button class="publish-btn confirm-btn" @click="confirmPublish" :disabled="!canPublish">发布</button>
				</view>
			</view>
		</view>
		
		<!-- 签到任务列表 -->
		<view class="task-list">
			<view class="task-title">签到任务</view>
			<view v-if="tasks.length > 0">
				<view class="task-item" v-for="(task, index) in tasks" :key="task.id">
					<view class="task-content" @click="selectTask(task)">
						<view class="task-name">{{ task.taskName }}</view>
						<view class="task-course" v-if="task.courseName">
							<text class="course-label">课程：</text>
							<text class="course-name">{{ task.courseName }}</text>
							<text class="course-code" v-if="task.courseCode">({{ task.courseCode }})</text>
						</view>
						<view class="task-info">
							<text class="task-time">{{ formatTime(task.startTime) }} - {{ formatTime(task.endTime) }}</text>
							<text class="task-status" :class="{'status-active': task.status === 'active', 'status-completed': task.status === 'completed'}">
								{{ task.status === 'active' ? '进行中' : task.status === 'completed' ? '已完成' : '已结束' }}
							</text>
						</view>
						<view class="task-teacher" v-if="task.teacherName">发布人：{{ task.teacherName }}</view>
					</view>
					<view class="task-actions" v-if="!studentFlag">
						<button class="stats-btn" @click.stop="viewStats(task)">查看统计</button>
					</view>
				</view>
			</view>
			<view class="task-empty" v-else>
				<text class="empty-text">{{ studentFlag ? '暂无签到任务' : '您还没有发布签到任务' }}</text>
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
	const hasShownFaceTip=ref(false); // 是否已显示过人脸注册提示
	const showFaceTip=ref(false); // 是否显示人脸注册提示条
	const courses=ref([]); // 存储课程列表
	const showCoursePicker=ref(false); // 是否显示课程选择器
	const selectedCourse=ref(null); // 当前选中的课程
	const showPublishModal=ref(false); // 是否显示发布签到弹窗
	const selectedCourseForPublish=ref(null); // 用于发布的课程
	const publishDuration=ref(''); // 发布签到的持续时长
	
	
	onLoad(()=>{
		screenHeight.value=uni.getSystemInfoSync().windowHeight;
		studentFlag.value=isStudent();
		getTasks(); // 页面加载时立即获取一次任务列表
		updateFaceTipStatus(); // 检查人脸注册状态
		if(!studentFlag.value) {
			getCourses(); // 老师用户加载课程列表
		}
	})
	onShow(()=>{
		// 页面显示时重新检查用户角色（可能在另一个页面登录了）
		studentFlag.value=isStudent();
		getTasks(); // 页面显示时也获取一次任务列表
		// 只有学生用户才需要检查人脸注册状态
		updateFaceTipStatus();
		if(!studentFlag.value) {
			getCourses(); // 老师用户加载课程列表
		}
	})
	
	function updateFaceTipStatus() {
		if(studentFlag.value && proxy.$config.get('isLogin')) {
			// 立即检查人脸注册状态
			const faceRegistered = proxy.$config.get('face');
			console.log('检查人脸注册状态:', {
				isStudent: studentFlag.value,
				isLogin: proxy.$config.get('isLogin'),
				faceRegistered: faceRegistered
			});
			// 判断是否已注册：faceRegistered 为 true、1 或 'true' 都视为已注册
			const isFaceRegistered = faceRegistered === true || faceRegistered === 1 || faceRegistered === 'true';
			showFaceTip.value = !isFaceRegistered; // 未注册时显示提示条
			if(isFaceRegistered) {
				// 如果已注册，重置提示标记
				hasShownFaceTip.value = false;
			} else {
				// 如果未注册且已登录，延迟2秒后显示弹窗提示，避免干扰用户
				setTimeout(() => {
					checkFaceRegistered(false, true);
				}, 2000);
			}
		} else {
			showFaceTip.value = false;
		}
	}
	
	function goToRegister() {
		// 跳转到个人中心页面
		uni.switchTab({
			url: '/pages/Info/Info'
		});
	}
	setInterval(getTasks, 5000); // 每5秒轮询一次
	
	
	
	
	function uploadimg() //拍照签到event
	{
		// 检查是否已注册人脸
		if(!checkFaceRegistered(true)) {
			return; // 如果未注册，checkFaceRegistered 已经显示了提示，直接返回
		}
		
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
				
				// 显示加载动画
				uni.showLoading({
					title: '正在识别中...',
					mask: true
				});
				
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
									uni.hideLoading();
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
									uni.hideLoading();
									uni.showModal({
										title: '签到失败',
										content: responseData.message || '签到失败，请重试',
										showCancel:false
									});
								}
							},
							fail:(res)=>{
								uni.hideLoading();
								uni.showToast({
									title:'签到失败',
									icon:'error'
								})
							},
							complete:()=>{
								// 确保在完成时隐藏加载动画
								uni.hideLoading();
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
	
	function getCourses() {
		uni.request({
			url: 'http://' + proxy.$config.get('ip') + '/api/courses',
			method: 'GET',
			timeout: 5000,
			header: { 'Authorization': tokenGet() },
			success: (res) => {
				const response = res.data || res;
				if (response.success && response.data) {
					courses.value = response.data;
				} else {
					courses.value = [];
				}
			},
			fail: (err) => {
				console.error('获取课程列表失败:', err);
			}
		});
	}
	
	function goToCourses() {
		uni.navigateTo({
			url: '/pages/courses/courses'
		});
	}
	
	function checkClick()		//老师发布签到按钮
	{
		// 如果没有课程，提示先创建课程
		if(courses.value.length === 0) {
			uni.showModal({
				title: '提示',
				content: '您还没有创建课程，请先创建课程后再发布签到任务。',
				showCancel: true,
				confirmText: '去创建',
				cancelText: '取消',
				success: (res) => {
					if(res.confirm) {
						goToCourses();
					}
				}
			});
			return;
		}
		
		// 如果只有一个课程，直接使用；如果有多个，让用户选择
		if(courses.value.length === 1) {
			openPublishModal(courses.value[0]);
		} else {
			// 显示课程选择器
			const courseNames = courses.value.map(c => c.courseName);
			uni.showActionSheet({
				itemList: courseNames,
				success: (res) => {
					const selectedCourse = courses.value[res.tapIndex];
					// 选择课程后，打开发布弹窗
					openPublishModal(selectedCourse);
				},
				fail: (err) => {
					console.log('取消选择');
				}
			});
		}
	}
	
	function openPublishModal(course) {
		selectedCourseForPublish.value = course;
		publishDuration.value = '';
		showPublishModal.value = true;
	}
	
	function closePublishModal() {
		showPublishModal.value = false;
		selectedCourseForPublish.value = null;
		publishDuration.value = '';
	}
	
	function setDuration(minutes) {
		publishDuration.value = String(minutes);
	}
	
	function validateDuration() {
		// 确保输入的是正整数
		const value = publishDuration.value.replace(/[^\d]/g, '');
		if(value !== publishDuration.value) {
			publishDuration.value = value;
		}
	}
	
	const canPublish = computed(() => {
		const duration = parseInt(publishDuration.value);
		return !isNaN(duration) && duration > 0 && duration <= 1440; // 最多24小时
	});
	
	function confirmPublish() {
		if(!canPublish.value) {
			uni.showToast({
				title: '请输入有效的时长（1-1440分钟）',
				icon: 'error'
			});
			return;
		}
		
		const duration = parseInt(publishDuration.value);
		publishTask(selectedCourseForPublish.value.id, duration);
		closePublishModal();
	}
	
	function publishTask(courseId, duration) {
		uni.showLoading({
			title: '发布中...',
			mask: true
		});
		uni.request({
			url: 'http://' + proxy.$config.get('ip') + '/api/attendance-task',
			method: 'POST',
			timeout: 5000,
			data: {
				courseId: courseId,
				duration: duration
			},
			header: { 'Authorization': tokenGet() },
			success: (res) => {
				const response = res.data || res;
				if(response.success)
				{
					uni.showToast({
						title: "发布签到成功",
						icon: 'success'
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
						icon: 'error'
					})
				}
			},
			fail: (res) => {
				uni.showToast({
					title: "发布签到失败",
					icon: 'error'
				})
			},
			complete: () => {
				uni.hideLoading();
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
				console.log('获取任务列表响应:', response);
				if(response.success)
				{
					if(response.data && Array.isArray(response.data))
					{
						tasks.value = response.data;
						task_flag.value = response.data.length > 0;
						console.log('获取任务列表成功，任务数量:', response.data.length);
					}
					else
					{
						tasks.value = [];
						task_flag.value = false;
						console.log('任务列表为空');
					}
				}
				else
				{
					tasks.value = [];
					task_flag.value = false;
					console.error('获取任务列表失败:', response.message);
					if(response.message) {
						uni.showToast({
							title: response.message,
							icon: 'none',
							duration: 2000
						});
					}
				}
			},
			fail: (err) => {
				console.error('获取任务列表请求失败:', err);
				tasks.value = [];
				task_flag.value = false;
				// 不显示错误提示，避免频繁弹窗
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
	
	function viewStats(task) {
		// 跳转到统计页面
		uni.navigateTo({
			url: `/pages/stats/stats?taskId=${task.id}`
		});
	}
	
	function checkFaceRegistered(showModal = false, isDelayedTip = false) {
		// 只有学生用户才需要检查人脸注册状态
		if(!studentFlag.value) {
			console.log('非学生用户，跳过人脸检查');
			return true; // 非学生用户不需要检查
		}
		
		// 检查用户是否已登录
		if(!proxy.$config.get('isLogin')) {
			console.log('用户未登录，跳过人脸检查');
			return true; // 未登录时不检查人脸注册状态
		}
		
		// 检查是否已注册人脸
		const faceRegistered = proxy.$config.get('face');
		console.log('人脸注册检查:', {
			faceRegistered: faceRegistered,
			isDelayedTip: isDelayedTip,
			hasShownFaceTip: hasShownFaceTip.value
		});
		
		// 判断是否已注册：faceRegistered 为 true、1 或 'true' 都视为已注册
		const isFaceRegistered = faceRegistered === true || faceRegistered === 1 || faceRegistered === 'true';
		
		if(!isFaceRegistered) {
			// 如果是延迟提示且已经提示过，则不再提示
			if(isDelayedTip && hasShownFaceTip.value) {
				console.log('已提示过，不再重复提示');
				return false;
			}
			
			// 未注册人脸，显示提示
			if(isDelayedTip) {
				hasShownFaceTip.value = true;
			}
			
			console.log('显示人脸注册提示');
			uni.showModal({
				title: '提示',
				content: '您还未注册人脸，无法进行签到。请先前往个人中心注册人脸。',
				showCancel: true,
				confirmText: '去注册',
				cancelText: '稍后',
				success: (res) => {
					if(res.confirm) {
						// 跳转到个人中心页面
						uni.switchTab({
							url: '/pages/Info/Info'
						});
					}
				}
			});
			return false; // 返回 false 表示未注册
		}
		// 如果已注册，重置提示标记和提示条
		hasShownFaceTip.value = false;
		showFaceTip.value = false;
		return true; // 返回 true 表示已注册
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
		
		.task-empty{
			text-align: center;
			padding: 60rpx 0;
		}
		
		.empty-text{
			font-size: 28rpx;
			color: #999;
		}
		
		.task-item{
			background-color: rgba(255, 255, 255, 0.9);
			border-radius: 15rpx;
			padding: 30rpx;
			margin-bottom: 20rpx;
			box-shadow: 0 2rpx 10rpx rgba(0, 0, 0, 0.1);
			display: flex;
			justify-content: space-between;
			align-items: center;
		}
		
		.task-content{
			flex: 1;
		}
		
		.task-actions{
			margin-left: 20rpx;
		}
		
		.stats-btn{
			width: 140rpx;
			height: 60rpx;
			line-height: 60rpx;
			padding: 0;
			margin: 0;
			font-size: 24rpx;
			background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
			color: #fff;
			border-radius: 10rpx;
			border: none;
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
		
		.task-course{
			font-size: 26rpx;
			color: #666;
			margin-bottom: 10rpx;
			display: flex;
			align-items: center;
		}
		
		.course-label{
			color: #999;
			margin-right: 5rpx;
		}
		
		.course-name{
			color: #667eea;
			font-weight: 500;
			margin-right: 10rpx;
		}
		
		.course-code{
			font-size: 22rpx;
			color: #999;
		}
		
		.task-teacher{
			font-size: 24rpx;
			color: #999;
			margin-top: 10rpx;
		}
		
		.face-tip{
			position: fixed;
			top: 0;
			left: 0;
			right: 0;
			background: linear-gradient(135deg, #ff6b6b 0%, #ee5a6f 100%);
			color: #fff;
			padding: 20rpx 30rpx;
			display: flex;
			justify-content: space-between;
			align-items: center;
			z-index: 999;
			box-shadow: 0 2rpx 10rpx rgba(0, 0, 0, 0.2);
			height: 80rpx;
			box-sizing: border-box;
			.tip-text{
				font-size: 28rpx;
				flex: 1;
			}
			.tip-btn{
				background-color: rgba(255, 255, 255, 0.3);
				padding: 10rpx 20rpx;
				border-radius: 20rpx;
				font-size: 24rpx;
				margin-left: 20rpx;
			}
		}
		
		/* 发布签到弹窗样式 */
		.publish-modal{
			position: fixed;
			top: 0;
			left: 0;
			right: 0;
			bottom: 0;
			background-color: rgba(0, 0, 0, 0.5);
			display: flex;
			justify-content: center;
			align-items: center;
			z-index: 1000;
			backdrop-filter: blur(5rpx);
		}
		
		.publish-modal-content{
			width: 85%;
			max-width: 600rpx;
			background: linear-gradient(135deg, #ffffff 0%, #f8f9fa 100%);
			border-radius: 30rpx;
			box-shadow: 0 20rpx 60rpx rgba(0, 0, 0, 0.3);
			overflow: hidden;
			animation: modalSlideIn 0.3s ease-out;
		}
		
		@keyframes modalSlideIn {
			from {
				opacity: 0;
				transform: translateY(-50rpx) scale(0.9);
			}
			to {
				opacity: 1;
				transform: translateY(0) scale(1);
			}
		}
		
		.publish-modal-header{
			background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
			padding: 40rpx 30rpx 30rpx;
			display: flex;
			justify-content: space-between;
			align-items: center;
		}
		
		.publish-modal-title{
			font-size: 36rpx;
			font-weight: bold;
			color: #fff;
		}
		
		.publish-modal-close{
			font-size: 50rpx;
			color: rgba(255, 255, 255, 0.9);
			line-height: 1;
			width: 50rpx;
			height: 50rpx;
			display: flex;
			align-items: center;
			justify-content: center;
			border-radius: 50%;
			background-color: rgba(255, 255, 255, 0.2);
		}
		
		.publish-modal-body{
			padding: 40rpx 30rpx;
		}
		
		.publish-course-info{
			background: linear-gradient(135deg, #f0f4ff 0%, #e8f0ff 100%);
			border-radius: 20rpx;
			padding: 30rpx;
			margin-bottom: 40rpx;
			border: 2rpx solid #667eea;
		}
		
		.course-info-item{
			display: flex;
			justify-content: space-between;
			align-items: center;
			margin-bottom: 20rpx;
			&:last-child{
				margin-bottom: 0;
			}
		}
		
		.course-info-label{
			font-size: 28rpx;
			color: #666;
		}
		
		.course-info-value{
			font-size: 30rpx;
			font-weight: bold;
			color: #667eea;
		}
		
		.publish-duration-input{
			.duration-label{
				display: block;
				font-size: 28rpx;
				color: #333;
				margin-bottom: 20rpx;
				font-weight: 500;
			}
			
			.duration-input{
				width: 100%;
				height: 90rpx;
				padding: 0 30rpx;
				background-color: #fff;
				border: 2rpx solid #e0e0e0;
				border-radius: 15rpx;
				font-size: 32rpx;
				color: #333;
				box-sizing: border-box;
				transition: all 0.3s;
				&:focus{
					border-color: #667eea;
					box-shadow: 0 0 0 4rpx rgba(102, 126, 234, 0.1);
				}
			}
			
			.duration-tips{
				display: flex;
				gap: 15rpx;
				margin-top: 25rpx;
				flex-wrap: wrap;
			}
			
			.tip-item{
				padding: 12rpx 25rpx;
				background: linear-gradient(135deg, #f0f4ff 0%, #e8f0ff 100%);
				border-radius: 20rpx;
				font-size: 24rpx;
				color: #667eea;
				border: 1rpx solid #667eea;
				transition: all 0.3s;
				&:active{
					background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
					color: #fff;
					transform: scale(0.95);
				}
			}
		}
		
		.publish-modal-footer{
			display: flex;
			gap: 20rpx;
			padding: 30rpx;
			border-top: 1rpx solid #eee;
			background-color: #fafafa;
		}
		
		.publish-btn{
			flex: 1;
			height: 90rpx;
			line-height: 90rpx;
			border-radius: 15rpx;
			font-size: 32rpx;
			border: none;
			font-weight: 500;
			transition: all 0.3s;
		}
		
		.cancel-btn{
			background-color: #f5f5f5;
			color: #666;
			&:active{
				background-color: #e0e0e0;
				transform: scale(0.98);
			}
		}
		
		.confirm-btn{
			background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
			color: #fff;
			box-shadow: 0 4rpx 15rpx rgba(102, 126, 234, 0.4);
			&:active{
				transform: scale(0.98);
				box-shadow: 0 2rpx 8rpx rgba(102, 126, 234, 0.3);
			}
			&:disabled{
				background: #ccc;
				box-shadow: none;
				color: #999;
			}
		}
	}
</style>
