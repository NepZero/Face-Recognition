<template>
	<view class="container">
		<!-- 课程列表 -->
		<scroll-view class="course-list" scroll-y="true">
			<view class="course-item" v-for="(course, index) in courses" :key="course.id" @click="viewCourseDetail(course)">
				<view class="course-header">
					<view class="course-name">{{ course.courseName }}</view>
					<view class="course-code">{{ course.courseCode }}</view>
				</view>
				<view class="course-info" v-if="course.description">
					<text>{{ course.description }}</text>
				</view>
				<view class="course-actions">
					<button class="action-btn edit-btn" @click.stop="editCourse(course)">编辑</button>
					<button class="action-btn delete-btn" @click.stop="deleteCourse(course)">删除</button>
					<button class="action-btn manage-btn" @click.stop="manageClasses(course)">管理班级</button>
				</view>
			</view>
			
			<!-- 空状态 -->
			<view class="empty-state" v-if="courses.length === 0 && !loading">
				<text class="empty-text">暂无课程，请创建第一个课程</text>
			</view>
		</scroll-view>
		
		<!-- 底部操作按钮 -->
		<view class="bottom-actions">
			<button class="create-btn" @click="showCreateModal">创建课程</button>
		</view>
		
		<!-- 创建/编辑课程弹窗 -->
		<view class="modal" v-if="showModal" @click.stop>
			<view class="modal-content" @click.stop>
				<view class="modal-header">
					<text class="modal-title">{{ editingCourse ? '编辑课程' : '创建课程' }}</text>
					<text class="modal-close" @click="closeModal">×</text>
				</view>
				<view class="modal-body">
					<view class="form-item">
						<text class="form-label">课程名称</text>
						<input class="form-input" v-model="formData.courseName" placeholder="请输入课程名称" maxlength="100" />
					</view>
					<view class="form-item">
						<text class="form-label">课程代码</text>
						<input class="form-input" v-model="formData.courseCode" placeholder="请输入课程代码" maxlength="50" />
					</view>
					<view class="form-item">
						<text class="form-label">课程描述</text>
						<textarea class="form-textarea" v-model="formData.description" placeholder="请输入课程描述（可选）" maxlength="500" />
					</view>
				</view>
				<view class="modal-footer">
					<button class="modal-btn cancel-btn" @click="closeModal">取消</button>
					<button class="modal-btn confirm-btn" @click="saveCourse" :loading="saving">保存</button>
				</view>
			</view>
		</view>
		
		<!-- 管理班级弹窗 -->
		<view class="modal" v-if="showClassModal" @click.stop>
			<view class="modal-content class-modal" @click.stop>
				<view class="modal-header">
					<text class="modal-title">管理班级 - {{ currentCourse.courseName }}</text>
					<text class="modal-close" @click="closeClassModal">×</text>
				</view>
				<view class="modal-body">
					<view class="class-list">
						<view 
							class="class-item" 
							v-for="(cls, index) in allClasses" 
							:key="cls.id" 
							@click="toggleClassItem(cls.id)"
						>
							<view class="class-label">
								<view class="custom-checkbox" :class="{'checked': isClassSelected(cls.id)}">
									<text class="checkbox-icon" v-if="isClassSelected(cls.id)">✓</text>
								</view>
								<text class="class-name">{{ cls.className }}</text>
								<text class="class-code">({{ cls.classCode }})</text>
							</view>
						</view>
					</view>
				</view>
				<view class="modal-footer">
					<button class="modal-btn cancel-btn" @click="closeClassModal">取消</button>
					<button class="modal-btn confirm-btn" @click="saveClasses" :loading="saving">保存</button>
				</view>
			</view>
		</view>
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
	const saving = ref(false);
	const showModal = ref(false);
	const showClassModal = ref(false);
	const editingCourse = ref(null);
	const currentCourse = ref({});
	const allClasses = ref([]);
	const selectedClassIds = ref([]);
	
	const formData = ref({
		courseName: '',
		courseCode: '',
		description: ''
	});
	
	onLoad(() => {
		getCourses();
		getAllClasses();
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
	
	function getAllClasses() {
		uni.request({
			url: 'http://' + proxy.$config.get('ip') + '/api/classes',
			method: 'GET',
			timeout: 5000,
			success: (res) => {
				const response = res.data || res;
				if (response.success && response.data) {
					allClasses.value = response.data;
				}
			},
			fail: (err) => {
				console.error('获取班级列表失败:', err);
			}
		});
	}
	
	function showCreateModal() {
		editingCourse.value = null;
		formData.value = {
			courseName: '',
			courseCode: '',
			description: ''
		};
		showModal.value = true;
	}
	
	function editCourse(course) {
		editingCourse.value = course;
		formData.value = {
			courseName: course.courseName,
			courseCode: course.courseCode,
			description: course.description || ''
		};
		showModal.value = true;
	}
	
	function closeModal() {
		showModal.value = false;
		editingCourse.value = null;
		formData.value = {
			courseName: '',
			courseCode: '',
			description: ''
		};
	}
	
	function saveCourse() {
		if (!formData.value.courseName || !formData.value.courseCode) {
			uni.showToast({
				title: '请填写课程名称和课程代码',
				icon: 'error'
			});
			return;
		}
		
		saving.value = true;
		const url = editingCourse.value 
			? `http://${proxy.$config.get('ip')}/api/courses/${editingCourse.value.id}`
			: `http://${proxy.$config.get('ip')}/api/courses`;
		const method = editingCourse.value ? 'PUT' : 'POST';
		
		uni.request({
			url: url,
			method: method,
			data: formData.value,
			timeout: 5000,
			header: { 'Authorization': tokenGet() },
			success: (res) => {
				const response = res.data || res;
				if (response.success) {
					uni.showToast({
						title: editingCourse.value ? '更新成功' : '创建成功',
						icon: 'success'
					});
					closeModal();
					getCourses();
				} else {
					uni.showToast({
						title: response.message || '操作失败',
						icon: 'error'
					});
				}
			},
			fail: (err) => {
				uni.showToast({
					title: '操作失败',
					icon: 'error'
				});
			},
			complete: () => {
				saving.value = false;
			}
		});
	}
	
	function deleteCourse(course) {
		uni.showModal({
			title: '确认删除',
			content: `确定要删除课程"${course.courseName}"吗？删除后无法恢复。`,
			success: (res) => {
				if (res.confirm) {
					uni.request({
						url: `http://${proxy.$config.get('ip')}/api/courses/${course.id}`,
						method: 'DELETE',
						timeout: 5000,
						header: { 'Authorization': tokenGet() },
						success: (res) => {
							const response = res.data || res;
							if (response.success) {
								uni.showToast({
									title: '删除成功',
									icon: 'success'
								});
								getCourses();
							} else {
								uni.showToast({
									title: response.message || '删除失败',
									icon: 'error'
								});
							}
						},
						fail: (err) => {
							uni.showToast({
								title: '删除失败',
								icon: 'error'
							});
						}
					});
				}
			}
		});
	}
	
	function manageClasses(course) {
		currentCourse.value = course;
		selectedClassIds.value = [];
		// 获取课程已关联的班级
		uni.request({
			url: `http://${proxy.$config.get('ip')}/api/courses/${course.id}`,
			method: 'GET',
			timeout: 5000,
			header: { 'Authorization': tokenGet() },
			success: (res) => {
				const response = res.data || res;
				if (response.success && response.data && response.data.classes) {
					// 确保ID是数字类型
					selectedClassIds.value = response.data.classes.map(c => parseInt(c.id));
					console.log('加载的已选班级ID:', selectedClassIds.value);
				} else {
					selectedClassIds.value = [];
				}
				showClassModal.value = true;
			},
			fail: (err) => {
				uni.showToast({
					title: '获取课程信息失败',
					icon: 'error'
				});
			}
		});
	}
	
	function closeClassModal() {
		showClassModal.value = false;
		currentCourse.value = {};
		selectedClassIds.value = [];
	}
	
	function toggleClassItem(classId) {
		// 切换选中状态
		const id = parseInt(classId);
		const index = selectedClassIds.value.indexOf(id);
		if (index > -1) {
			// 已选中，取消选中
			selectedClassIds.value.splice(index, 1);
		} else {
			// 未选中，添加到选中列表
			selectedClassIds.value.push(id);
		}
		// 强制触发响应式更新
		selectedClassIds.value = [...selectedClassIds.value];
		console.log('切换班级', id, '当前选中的ID:', selectedClassIds.value);
	}
	
	function isClassSelected(classId) {
		const id = parseInt(classId);
		const isSelected = selectedClassIds.value.includes(id);
		return isSelected;
	}
	
	function saveClasses() {
		console.log('=== 保存班级开始 ===');
		console.log('selectedClassIds:', selectedClassIds.value);
		console.log('selectedClassIds类型:', typeof selectedClassIds.value);
		console.log('是否为数组:', Array.isArray(selectedClassIds.value));
		console.log('数组长度:', selectedClassIds.value?.length);
		
		// 确保selectedClassIds是数组且有内容
		if (!Array.isArray(selectedClassIds.value)) {
			console.error('错误：selectedClassIds不是数组，重置为空数组');
			selectedClassIds.value = [];
		}
		
		if (selectedClassIds.value.length === 0) {
			console.error('验证失败：selectedClassIds为空');
			uni.showToast({
				title: '请至少选择一个班级',
				icon: 'error',
				duration: 2000
			});
			return;
		}
		
		console.log('验证通过，准备发送请求，选中的班级ID:', selectedClassIds.value);
		saving.value = true;
		uni.request({
			url: `http://${proxy.$config.get('ip')}/api/courses/${currentCourse.value.id}/classes`,
			method: 'POST',
			data: { classIds: selectedClassIds.value },
			timeout: 5000,
			header: { 'Authorization': tokenGet() },
			success: (res) => {
				const response = res.data || res;
				if (response.success) {
					uni.showToast({
						title: '保存成功',
						icon: 'success'
					});
					closeClassModal();
				} else {
					uni.showToast({
						title: response.message || '保存失败',
						icon: 'error'
					});
				}
			},
			fail: (err) => {
				uni.showToast({
					title: '保存失败',
					icon: 'error'
				});
			},
			complete: () => {
				saving.value = false;
			}
		});
	}
	
	function viewCourseDetail(course) {
		// 可以跳转到课程详情页面，暂时不实现
	}
</script>

<style lang="scss" scoped>
	.container {
		width: 100%;
		height: 100vh;
		background-color: #f5f5f5;
		display: flex;
		flex-direction: column;
	}
	
	.course-list {
		flex: 1;
		padding: 30rpx;
	}
	
	.course-item {
		background-color: #fff;
		border-radius: 15rpx;
		padding: 30rpx;
		margin-bottom: 20rpx;
		box-shadow: 0 2rpx 10rpx rgba(0, 0, 0, 0.1);
	}
	
	.course-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		margin-bottom: 15rpx;
	}
	
	.course-name {
		font-size: 32rpx;
		font-weight: bold;
		color: #333;
		flex: 1;
	}
	
	.course-code {
		font-size: 24rpx;
		color: #999;
		background-color: #f0f0f0;
		padding: 5rpx 15rpx;
		border-radius: 10rpx;
	}
	
	.course-info {
		font-size: 28rpx;
		color: #666;
		margin-bottom: 20rpx;
		line-height: 1.6;
	}
	
	.course-actions {
		display: flex;
		gap: 15rpx;
	}
	
	.action-btn {
		flex: 1;
		height: 60rpx;
		line-height: 60rpx;
		font-size: 24rpx;
		border-radius: 10rpx;
		border: none;
		padding: 0;
		margin: 0;
	}
	
	.edit-btn {
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: #fff;
	}
	
	.delete-btn {
		background: linear-gradient(135deg, #f093fb 0%, #f5576c 100%);
		color: #fff;
	}
	
	.manage-btn {
		background: linear-gradient(135deg, #4facfe 0%, #00f2fe 100%);
		color: #fff;
	}
	
	.empty-state {
		text-align: center;
		padding: 100rpx 0;
	}
	
	.empty-text {
		font-size: 28rpx;
		color: #999;
	}
	
	.bottom-actions {
		padding: 30rpx;
		background-color: #fff;
		border-top: 1rpx solid #eee;
	}
	
	.create-btn {
		width: 100%;
		height: 80rpx;
		line-height: 80rpx;
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: #fff;
		border-radius: 15rpx;
		font-size: 32rpx;
		border: none;
	}
	
	.modal {
		position: fixed;
		top: 0;
		left: 0;
		right: 0;
		bottom: 0;
		background-color: rgba(0, 0, 0, 0.5);
		display: flex;
		justify-content: center;
		align-items: center;
		z-index: 999;
	}
	
	.modal-content {
		width: 90%;
		max-width: 600rpx;
		background-color: #fff;
		border-radius: 20rpx;
		max-height: 80vh;
		display: flex;
		flex-direction: column;
	}
	
	.class-modal {
		max-height: 70vh;
	}
	
	.modal-header {
		display: flex;
		justify-content: space-between;
		align-items: center;
		padding: 30rpx;
		border-bottom: 1rpx solid #eee;
	}
	
	.modal-title {
		font-size: 32rpx;
		font-weight: bold;
		color: #333;
	}
	
	.modal-close {
		font-size: 50rpx;
		color: #999;
		line-height: 1;
	}
	
	.modal-body {
		flex: 1;
		padding: 30rpx;
		overflow-y: auto;
	}
	
	.form-item {
		margin-bottom: 30rpx;
	}
	
	.form-label {
		display: block;
		font-size: 28rpx;
		color: #333;
		margin-bottom: 15rpx;
	}
	
	.form-input {
		width: 100%;
		height: 80rpx;
		padding: 0 20rpx;
		border: 1rpx solid #ddd;
		border-radius: 10rpx;
		font-size: 28rpx;
		box-sizing: border-box;
	}
	
	.form-textarea {
		width: 100%;
		min-height: 150rpx;
		padding: 20rpx;
		border: 1rpx solid #ddd;
		border-radius: 10rpx;
		font-size: 28rpx;
		box-sizing: border-box;
	}
	
	.modal-footer {
		display: flex;
		gap: 20rpx;
		padding: 30rpx;
		border-top: 1rpx solid #eee;
	}
	
	.modal-btn {
		flex: 1;
		height: 80rpx;
		line-height: 80rpx;
		border-radius: 10rpx;
		font-size: 28rpx;
		border: none;
	}
	
	.cancel-btn {
		background-color: #f0f0f0;
		color: #666;
	}
	
	.confirm-btn {
		background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
		color: #fff;
	}
	
	.class-list {
		max-height: 400rpx;
		overflow-y: auto;
	}
	
	.class-item {
		padding: 25rpx 0;
		border-bottom: 1rpx solid #eee;
		transition: background-color 0.2s;
		&:active {
			background-color: #f5f5f5;
		}
	}
	
	.class-label {
		display: flex;
		align-items: center;
		font-size: 28rpx;
		color: #333;
	}
	
	.custom-checkbox {
		width: 40rpx;
		height: 40rpx;
		border: 2rpx solid #ddd;
		border-radius: 8rpx;
		display: flex;
		align-items: center;
		justify-content: center;
		margin-right: 20rpx;
		background-color: #fff;
		transition: all 0.3s;
		&.checked {
			background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
			border-color: #667eea;
		}
	}
	
	.checkbox-icon {
		color: #fff;
		font-size: 28rpx;
		font-weight: bold;
	}
	
	.class-name {
		flex: 1;
	}
	
	.class-code {
		font-size: 24rpx;
		color: #999;
		margin-left: 10rpx;
	}
</style>

