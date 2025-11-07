<template>
	<view class="layout" @touchmove.stop.prevent="() => {}" :style="'height:'+screenHeight+'px!important'">
		<button class='loadbutton' size="default" @click="uploadimg">
			<text>拍照签到</text>
			<view class="dot" v-if="task_flag"></view>
		</button>
		<button size="default" @click="testConnection" :loading=connection_flag>网络测试</button>
		<button size="default" @click="ipconfig">网络配置</button>
		<button size="default" @click="checkClick" v-if="!studentFlag">发布签到</button>
		<!-- <button size="default" @click="testClick">用户信息</button> -->
	</view>
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
	
	
	onLoad(()=>{
		screenHeight.value=uni.getSystemInfoSync().windowHeight;
		studentFlag.value=isStudent();
	})
	onShow(()=>{
	})
	setInterval(getTasks, 5000);
	
	
	
	
	function uploadimg() //拍照签到event
	{
		uni.chooseImage({
			count: 1, //默认9
			sizeType: ['original', 'compressed'], //可以指定是原图还是压缩图，默认二者都有
			sourceType: ['camera'], 
			success: function (res) {
				console.log(tokenGet())
				const path=res.tempFilePaths[0];
				console.log(path);
				uni.uploadFile({
							url: 'http://'+proxy.$config.get('ip')+'/api/face-recognition', //仅为示例，非真实的接口地址
							filePath: path,
							header:{'Authorization':tokenGet()},
							// formData:{'Authorization':tokenGet()},
							name: 'imagefile',
							timeout:10000,
							success: (res) => {
								console.log(res)
								if(res.success)
								{
									uni.showToast({
									    title: '签到成功',
									    icon: 'success'
									});
								}
								else
								{
									res.data=JSON.parse(res.data)
									uni.showModal({
										title: '签到失败',
										content: res.data['message'],
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
								console.log('buzhidao');
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
				if(res.success)
				{
					uni.showToast({
						title:"发布签到成功",
						icon:success
					})
				}
				else
				{
					uni.showToast({
						title:"发布签到失败",
						icon:success
					})
				}
			},
			fail: (res) => {
				uni.showToast({
					title:"发布签到失败",
					icon:success
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
			method:'POST',
			timeout:5000,
			header:{'Authorization':tokenGet()},
			success: (res) => {
				if(res.success)
				{
					task_flag.value=true;
				}
			},
			fail: (res) => {
			}
		})
	}
</script>

<style lang='scss' scoped>
	.layout{
		position: absolute;
		width: 100%;
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
	}
</style>
