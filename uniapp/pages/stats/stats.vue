<template>
	<view class="stats-container">
		<view class="stats-header" v-if="statsData">
			<view class="task-info">
				<text class="task-name">{{ statsData.task.taskName }}</text>
				<text class="task-time">{{ formatTime(statsData.task.startTime) }} - {{ formatTime(statsData.task.endTime) }}</text>
			</view>
			<view class="stats-overview">
				<view class="stat-item">
					<text class="stat-label">总人数</text>
					<text class="stat-value">{{ statsData.totalStudents }}</text>
				</view>
				<view class="stat-item">
					<text class="stat-label">已签到</text>
					<text class="stat-value checked">{{ statsData.checkedStudents }}</text>
				</view>
				<view class="stat-item">
					<text class="stat-label">签到率</text>
					<text class="stat-value rate">{{ statsData.attendanceRate }}</text>
				</view>
			</view>
		</view>
		
		<view class="stats-content">
			<view class="details-title">签到详情</view>
			<view class="details-summary" v-if="statsData">
				<text class="summary-text">
					课程学生 {{ statsData.totalStudents }} 人，
					已签到 {{ statsData.checkedStudents }} 人，
					未签到 {{ statsData.totalStudents - statsData.checkedStudents }} 人
				</text>
			</view>
			
			<view class="filter-bar" v-if="statsData && statsData.totalStudents">
				<view 
					class="filter-chip" 
					:class="{'active': filterType === 'all'}"
					@click="filterType = 'all'"
				>
					全部 ({{ statsData.totalStudents }})
				</view>
				<view 
					class="filter-chip" 
					:class="{'active success': filterType === 'checked'}"
					@click="filterType = 'checked'"
				>
					已签到 ({{ statsData.checkedStudents }})
				</view>
				<view 
					class="filter-chip" 
					:class="{'active warning': filterType === 'unchecked'}"
					@click="filterType = 'unchecked'"
				>
					未签到 ({{ statsData.totalStudents - statsData.checkedStudents }})
				</view>
			</view>
			<view class="loading" v-if="loading">
				<text>加载中...</text>
			</view>
			<view class="empty" v-else-if="!statsData || !statsData.details || statsData.details.length === 0">
				<text>暂无学生信息</text>
			</view>
			<scroll-view class="details-list" scroll-y="true" v-else>
				<view class="detail-item" v-for="(detail, index) in displayDetails" :key="detail.userId || index" 
					:class="{'not-checked': detail.status === 0}">
					<view class="detail-header">
						<view class="detail-main">
							<text class="student-name">{{ detail.userName || '未设置姓名' }}</text>
							<text class="student-account">{{ detail.userAccount }}</text>
						</view>
						<view class="status-badge" :class="{'status-success': detail.status === 1, 'status-failed': detail.status === 0}">
							{{ detail.status === 1 ? '已签到' : '未签到' }}
						</view>
					</view>
					<text class="check-time" v-if="detail.checkTime">签到时间：{{ formatTime(detail.checkTime) }}</text>
					<text class="check-time no-time" v-else>签到时间：未签到</text>
				</view>
			</scroll-view>
		</view>
	</view>
</template>

<script setup>
	import { onLoad } from '@dcloudio/uni-app';
	import { ref, computed } from 'vue';
	import { getCurrentInstance } from 'vue';
	import { tokenGet } from '../../utils/utils';
	
	const { proxy } = getCurrentInstance();
	const statsData = ref(null);
	const loading = ref(true);
	const taskId = ref(null);
	// 过滤类型：all / checked / unchecked
	const filterType = ref('all');
	
	// 对详情列表进行排序：已签到的在前，未签到的在后；已签到的按时间倒序，未签到的按账号排序
	const sortedDetails = computed(() => {
		if (!statsData.value || !statsData.value.details) return [];
		const details = [...statsData.value.details];
		return details.sort((a, b) => {
			// 先按签到状态排序：已签到的在前
			if (a.status !== b.status) {
				return b.status - a.status;
			}
			// 如果都是已签到，按签到时间倒序
			if (a.status === 1 && b.status === 1) {
				if (a.checkTime && b.checkTime) {
					return new Date(b.checkTime) - new Date(a.checkTime);
				}
				return 0;
			}
			// 如果都是未签到，按账号排序
			return (a.userAccount || '').localeCompare(b.userAccount || '');
		});
	});
	
	// 根据筛选条件返回最终要展示的列表
	const displayDetails = computed(() => {
		const list = sortedDetails.value;
		if (filterType.value === 'checked') {
			return list.filter(item => item.status === 1);
		}
		if (filterType.value === 'unchecked') {
			return list.filter(item => item.status === 0);
		}
		return list;
	});
	
	onLoad((options) => {
		if (options.taskId) {
			taskId.value = options.taskId;
			getStats();
		} else {
			uni.showToast({
				title: '缺少任务ID',
				icon: 'error'
			});
			setTimeout(() => {
				uni.navigateBack();
			}, 1500);
		}
	});
	
	function getStats() {
		loading.value = true;
		uni.request({
			url: 'http://' + proxy.$config.get('ip') + '/api/attendance-stats',
			method: 'GET',
			data: {
				taskId: taskId.value
			},
			header: {
				'Authorization': tokenGet()
			},
			timeout: 5000,
			success: (res) => {
				const response = res.data || res;
				if (response.success && response.data) {
					statsData.value = response.data;
				} else {
					uni.showToast({
						title: response.message || '获取统计失败',
						icon: 'error'
					});
				}
			},
			fail: (res) => {
				console.error('获取统计失败:', res);
				uni.showToast({
					title: '获取统计失败',
					icon: 'error'
				});
			},
			complete: () => {
				loading.value = false;
			}
		});
	}
	
	function formatTime(timeStr) {
		if (!timeStr) return '';
		const date = new Date(timeStr);
		const year = date.getFullYear();
		const month = (date.getMonth() + 1).toString().padStart(2, '0');
		const day = date.getDate().toString().padStart(2, '0');
		const hours = date.getHours().toString().padStart(2, '0');
		const minutes = date.getMinutes().toString().padStart(2, '0');
		return `${year}-${month}-${day} ${hours}:${minutes}`;
	}
</script>

<style lang='scss' scoped>
	.stats-container {
		min-height: 100vh;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		padding: 30rpx;
	}
	
	.stats-header {
		background-color: rgba(255, 255, 255, 0.95);
		border-radius: 20rpx;
		padding: 40rpx;
		margin-bottom: 30rpx;
		box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.1);
	}
	
	.task-info {
		margin-bottom: 30rpx;
		.task-name {
			display: block;
			font-size: 36rpx;
			font-weight: bold;
			color: #333;
			margin-bottom: 15rpx;
		}
		.task-time {
			display: block;
			font-size: 28rpx;
			color: #666;
		}
	}
	
	.stats-overview {
		display: flex;
		justify-content: space-around;
		padding-top: 30rpx;
		border-top: 1rpx solid #eee;
	}
	
	.stat-item {
		display: flex;
		flex-direction: column;
		align-items: center;
		.stat-label {
			font-size: 24rpx;
			color: #999;
			margin-bottom: 10rpx;
		}
		.stat-value {
			font-size: 40rpx;
			font-weight: bold;
			color: #333;
			&.checked {
				color: #4caf50;
			}
			&.rate {
				color: #2196f3;
			}
		}
	}
	
	.stats-content {
		background-color: rgba(255, 255, 255, 0.95);
		border-radius: 20rpx;
		padding: 30rpx;
		box-shadow: 0 4rpx 20rpx rgba(0, 0, 0, 0.1);
		flex: 1;
		display: flex;
		flex-direction: column;
	}
	
	.details-title {
		font-size: 32rpx;
		font-weight: bold;
		color: #333;
		margin-bottom: 20rpx;
	}
	
	.details-summary {
		margin-bottom: 16rpx;
	}
	.summary-text {
		font-size: 26rpx;
		color: #666;
	}
	.summary-text.warning {
		color: #ff9800;
	}
	.summary-split {
		margin: 0 12rpx;
		color: #ccc;
	}
	
	.filter-bar {
		display: flex;
		flex-direction: row;
		flex-wrap: nowrap;
		align-items: center;
		margin-bottom: 16rpx;
		overflow-x: auto;
	}
	
	.filter-chip {
		padding: 8rpx 18rpx;
		border-radius: 30rpx;
		border: 1rpx solid #ddd;
		font-size: 24rpx;
		color: #666;
		margin-right: 12rpx;
		background-color: #fff;
	}
	
	.filter-chip.active {
		border-color: #667eea;
		color: #667eea;
		background-color: #e8eafc;
	}
	
	.filter-chip.active.success {
		border-color: #4caf50;
		color: #4caf50;
		background-color: #e8f5e9;
	}
	
	.filter-chip.active.warning {
		border-color: #ff9800;
		color: #ff9800;
		background-color: #fff3e0;
	}
	
	.loading, .empty {
		text-align: center;
		padding: 100rpx 0;
		color: #999;
		font-size: 28rpx;
	}
	
	.details-list {
		flex: 1;
		max-height: 60vh;
	}
	
	.detail-item {
		background-color: #f8f9fa;
		border-radius: 15rpx;
		padding: 25rpx;
		margin-bottom: 20rpx;
		&.not-checked {
			background-color: #fff3e0;
			border: 1rpx solid #ffcc80;
		}
	}
	
	.detail-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 10rpx;
	}
	
	.detail-main {
		display: flex;
		flex-direction: column;
		.student-name {
			font-size: 30rpx;
			font-weight: bold;
			color: #333;
		}
		.check-time {
			font-size: 24rpx;
			color: #999;
			&.no-time {
				color: #ff9800;
			}
		}
	}
	
	.student-account {
		display: block;
		font-size: 26rpx;
		color: #666;
		margin-top: 6rpx;
	}
	
	.status-badge {
		font-size: 22rpx;
		padding: 5rpx 15rpx;
		border-radius: 10rpx;
		background-color: #f0f0f0;
		color: #999;
		&.status-success {
			background-color: #e8f5e9;
			color: #4caf50;
		}
		&.status-failed {
			background-color: #ffebee;
			color: #f44336;
		}
	}
</style>
