<template>
	<view class="layout" @touchmove.stop.prevent="() => {}" :style="'height:'+screenHeight+'px!important'">
		<button class='loadbutton' size="default" @click="uploadimg">点击拍照</button>
		<button size="default" @click="testConnection" :loading=connection_flag>网络测试</button>
		<button size="default" @click="ipconfig">网络配置</button>
		<button size="default" @click="checkClick" v-if="!studentFlag">发布签到</button>
	</view>
</template>

<script setup>
	import { onLoad,onShow} from '@dcloudio/uni-app';
	import {ref,computed} from 'vue';
	import { isStudent } from '../../utils/utils';
	
	const ip=ref('192.168.31.65:3000');
	const url=computed(()=> 'http://'+ip.value+'/send');
	const connection_flag=ref(false);
	const screenHeight=ref();
	const studentFlag=ref(true);
	
	
	onLoad(()=>{
		screenHeight.value=uni.getSystemInfoSync().windowHeight;
		get_ip();
		studentFlag.value=isStudent();
	})
	onShow(()=>{
		get_ip();
	})
	
	function uploadimg()
	{
		uni.chooseImage({
			count: 1, //默认9
			sizeType: ['original', 'compressed'], //可以指定是原图还是压缩图，默认二者都有
			sourceType: ['camera','album'], 
			success: function (res) {
				console.log(JSON.stringify(res.tempFilePaths));
				const path=res.tempFilePaths[0];
				console.log(path);
				uni.uploadFile({
							url: url.value, //仅为示例，非真实的接口地址
							filePath: path,
							name: 'imagefile',
							formData: {
								'user': 'test'
							},
							success: (res) => {
								console.log(res)
								uni.showToast({
								    title: '上传成功',
								    icon: 'success'
								});
							},
							fail:(res)=>{
								uni.showToast({
								    title: '上传失败',
								    icon: 'fail'
								});
							},
							complete:()=>{
								console.log('buzhidao');
							}
				});
			}
		});
	}
	
	function testConnection() {
		connection_flag.value=true;
	    uni.request({
	        url: url.value, // 替换为你的电脑IP
	        method: 'POST',
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
			title: ip.value,
			content:'',
			editable: true,
			placeholderText:'输入ip',
			success: (res) => {
				if(res.confirm)
				{
					ip.value=res.content;
					uni.setStorage({
						key: 'upload_ip',
						data: ip.value,
						success: function () {
							console.log('success');
						}
					});
				}
			},
		})
	}
	function get_ip()
	{
		uni.getStorage({
			key: 'upload_ip',
			success: function (res) {
				ip.value=res.data;
			}
		});
	}
	
	function checkClick()
	{
		console.log(111);
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
		}
	}
</style>
