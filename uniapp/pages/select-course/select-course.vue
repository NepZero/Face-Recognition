<template>
	<view class="container">
		<!-- 课程列表 -->
		<scroll-view class="course-list" scroll-y="true">
			<view class="course-item" v-for="(course, index) in courses" :key="course.id">
				<view class="course-header">
					<view class="course-info">
						<view class="course-name">{{ course.courseName }}</view>
						<view class="course-code">{{ course.courseCode }}</view>
					</view>
					<view class="course-status">
						<view class="status-tag class-related" v-if="course.isClassRelated">班级课程</view>
						<view class="status-tag selected" v-if="course.isSelected">已选课</view>
					</view>
				</view>
				<view class="course-details">
					<view class="detail-item" v-if="course.teacherName">
						<text class="detail-label">授课老师：</text>
						<text class="detail-value">{{ course.teacherName }}</text>
					</view>
					<view class="detail-item" v-if="course.description">
						<text class="detail-label">课程描述：</text>
						<text class="detail-value">{{ course.description }}</text>
					</view>
				</view>
				<view class="course-actions">
					<button 
						class="action-btn select-btn" 
						v-if="!course.isSelected" 
						@click="selectCourse(course)"
						:loading="loadingCourseId === course.id"
					>
						选课
					</button>
					<button 
						class="action-btn cancel-btn" 
						v-else 
						@click="cancelCourse(course)"
						:loading="loadingCourseId === course.id"
					>
						退课
					</button>
				</view>
			</view>
			
			<!-- 空状态 -->
			<view class="empty-state" v-if="courses.length === 0 && !loading">
				<text class="empty-text">暂无课程</text>
			</view>
		</scroll-view>
	</view>
</template>

<script setup>
	import { onLoad, onShow } from '@dcloudio/uni-app';
	import { ref } from 'vue';
	import { getCurrentInstance } from 'vue';
	import { tokenGet } from '../../utils/utils';
	
	const { proxy } = getCurrentInstance();
	const courses = ref([]);
	const loading = ref(false);
	const loadingCourseId = ref(null);
	
	onLoad(() => {
		getCourses();
	});
	
	onShow(() => {
		getCourses();
	});
	
	function getCourses() {
		loading.value = true;
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
				uni.showToast({
					title: '获取课程列表失败',
					icon: 'error'
				});
			},
			complete: () => {
				loading.value = false;
			}
		});
	}
	
	function selectCourse(course) {
		loadingCourseId.value = course.id;
		uni.request({
			url: `http://${proxy.$config.get('ip')}/api/courses/${course.id}/select`,
			method: 'POST',
			timeout: 5000,
			header: { 'Authorization': tokenGet() },
			success: (res) => {
				console.log('选课响应:', res);
				const response = res.data || res;
				if (response.success) {
					uni.showToast({
						title: '选课成功',
						icon: 'success'
					});
					// 更新本地状态
					course.isSelected = 1;
					getCourses(); // 刷新列表
				} else {
					console.error('选课失败:', response);
					uni.showModal({
						title: '选课失败',
						content: response.message || '选课失败，请重试',
						showCancel: false
					});
				}
			},
			fail: (err) => {
				console.error('选课请求失败:', err);
				uni.showModal({
					title: '选课失败',
					content: '网络请求失败，请检查网络连接',
					showCancel: false
				});
			},
			complete: () => {
				loadingCourseId.value = null;
			}
		});
	}
	
	function cancelCourse(course) {
		uni.showModal({
			title: '确认退课',
			content: `确定要退出课程"${course.courseName}"吗？`,
			success: (res) => {
				if (res.confirm) {
					loadingCourseId.value = course.id;
					uni.request({
						url: `http://${proxy.$config.get('ip')}/api/courses/${course.id}/select`,
						method: 'DELETE',
						timeout: 5000,
						header: { 'Authorization': tokenGet() },
						success: (res) => {
							const response = res.data || res;
							if (response.success) {
								uni.showToast({
									title: '退课成功',
									icon: 'success'
								});
								// 更新本地状态
								course.isSelected = 0;
								getCourses(); // 刷新列表
							} else {
								uni.showToast({
									title: response.message || '退课失败',
									icon: 'error'
								});
							}
						},
						fail: (err) => {
							uni.showToast({
								title: '退课失败',
								icon: 'error'
							});
						},
						complete: () => {
							loadingCourseId.value = null;
						}
					});
				}
			}
		});
	}
</script>

<style lang="scss" scoped>
	.container {
		width: 100%;
		height: 100vh;
		background-color: #f5f5f5;
	}
	
	.course-list {
		height: 100%;
		padding: 30rpx;
	}
	
	.course-item {
		background-color: #fff;
		border-radius: 20rpx;
		padding: 30rpx;
		margin-bottom: 25rpx;
		box-shadow: 0 4rpx 15rpx rgba(0, 0, 0, 0.08);
	}
	
	.course-header {
		display: flex;
		justify-content: space-between;
		align-items: flex-start;
		margin-bottom: 20rpx;
	}
	
	.course-info {
		flex: 1;
	}
	
	.course-name {
		font-size: 32rpx;
		font-weight: bold;
		color: #333;
		margin-bottom: 10rpx;
	}
	
	.course-code {
		font-size: 24rpx;
		color: #999;
		background-color: #f0f0f0;
		padding: 5rpx 15rpx;
		border-radius: 10rpx;
		display: inline-block;
	}
	
	.course-status {
		display: flex;
		flex-direction: column;
		gap: 10rpx;
		align-items: flex-end;
	}
	
	.status-tag {
		font-size: 22rpx;
		padding: 6rpx 15rpx;
		border-radius: 15rpx;
		white-space: nowrap;
	}
	
	.status-tag.class-related {
		background-color: #e3f2fd;
		color: #2196f3;
	}
	
	.status-tag.selected {
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: #fff;
	}
	
	.course-details {
		margin-bottom: 25rpx;
		padding-top: 20rpx;
		border-top: 1rpx solid #f0f0f0;
	}
	
	.detail-item {
		display: flex;
		margin-bottom: 15rpx;
		font-size: 26rpx;
		&:last-child {
			margin-bottom: 0;
		}
	}
	
	.detail-label {
		color: #666;
		margin-right: 10rpx;
		white-space: nowrap;
	}
	
	.detail-value {
		color: #333;
		flex: 1;
		line-height: 1.6;
	}
	
	.course-actions {
		display: flex;
		justify-content: flex-end;
	}
	
	.action-btn {
		min-width: 140rpx;
		height: 70rpx;
		line-height: 70rpx;
		padding: 0 30rpx;
		border-radius: 15rpx;
		font-size: 28rpx;
		border: none;
	}
	
	.select-btn {
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: #fff;
		box-shadow: 0 4rpx 15rpx rgba(102, 126, 234, 0.3);
		&:active {
			transform: scale(0.98);
		}
	}
	
	.cancel-btn {
		background-color: #f5f5f5;
		color: #666;
		border: 1rpx solid #ddd;
		&:active {
			background-color: #e0e0e0;
		}
	}
	
	.empty-state {
		text-align: center;
		padding: 150rpx 0;
	}
	
	.empty-text {
		font-size: 28rpx;
		color: #999;
	}
</style>

