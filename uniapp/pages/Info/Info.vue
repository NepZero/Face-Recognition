<template>
	<view class="layout" @touchmove.stop.prevent="() => {}" :style="'height:'+screenHeight+'px!important'">
		<view class="avater"></view>
		<!-- <view class="name">{{userInfo['name']}}</view> -->
		<view class="name">{{proxy.$config.get('name')}}</view>
		<!-- <view class="ip">{{userInfo['class']}}</view> -->
		<view class="ip">{{proxy.$config.get('class')}}</view>
		<view class="sections">
			<view class="login section" @click="login_click">
				<uni-icons type="right" size="25"></uni-icons>
				<view class="text">{{login_text}}</view>
			</view>
			<view class="net section" @click="netclick">
				<uni-icons type="gear-filled" size="25"></uni-icons>
				<view class="text">网络配置</view>
			</view>
			<view class="set section">
				<uni-icons type="gear-filled" size="25"></uni-icons>
				<view class="text">设置</view>
			</view>
			<view class="faceUpload section" v-if="proxy.$config.get('isLogin')" @click="faceClick">
				<uni-icons type="gear-filled" size="25"></uni-icons>
				<view class="text">上传照片</view>
			</view>
			<view class="loginOut section" v-if="proxy.$config.get('isLogin')" @click="logOutClick">
				<uni-icons type="gear-filled" size="25"></uni-icons>
				<view class="text">登出</view>
			</view>
		</view>
	</view>
</template>

<script setup>
	import { onLoad,onShow} from '@dcloudio/uni-app';
	import {ref,computed} from 'vue';
	import {logOut} from '../../utils/utils';
	import { getCurrentInstance } from 'vue'
	
	const {proxy}=getCurrentInstance();
	const screenHeight=ref();
	const login_text=computed(()=> proxy.$config.get('isLogin') ? '切换账号' : '登录/注册');
	
	
	onLoad(()=>{
		screenHeight.value=uni.getSystemInfoSync().windowHeight;
	})
	onShow(()=>{
	})
	
	function netclick() //配置网络按钮
	{
		uni.showModal({
			title: proxy.$config.get('ip'),
			content:'',
			editable: true,
			placeholderText:'输入ip',
			success: (res) => {
				if(res.confirm)
				{
					proxy.$config.set('ip',res.content)
				}
			},
		})
	}
	
	
	function login_click()	//登录event
	{
		uni.navigateTo({
		url: '../login/login'
		});
	}
	
	function logOutClick()	//登出event
	{
		logOut('http://'+proxy.$config.get('ip')+'/api/logout');
		// proxy.$config.set('isLogin',false);
		proxy.$config.reset();
		// userInfo_update(0);
	}
	
	function faceClick()	//人脸注册上传
	{
		uni.chooseImage({
			count: 1, //默认9
			sizeType: ['original', 'compressed'], //可以指定是原图还是压缩图，默认二者都有
			sourceType: ['camera','album'], 
			success: function (res) {
				const path=res.tempFilePaths[0];
				uni.uploadFile({
							url: 'http://'+proxy.$config.get('ip')+'/api/face-register',
							filePath: path,
							name: 'imagefile',
							formData: {
								'userId':userInfo.value.id
							},
							success: (res) => {
								if(res.statusCode==200)
								{
									uni.showToast({
									    title: '注册人脸成功',
									    icon: 'success'
									});
								}
								else
								{
									res.data=JSON.parse(res.data)
									uni.showModal({
										title: '注册人脸失败',
										content: res.data['message'],
										showCancel:false
									});
								}
								
							},
							fail:(res)=>{
								uni.showModal({
									title: '注册人脸失败',
									content: '请检查网络配置',
									showCancel:false
								});
							},
							complete:()=>{
							}
				});
			}
		});
	}
</script>

<style lang='scss' scoped>
	.layout{
		position: absolute;
		width: 100%;
		background-image: url('~@/static/background.png');
		background-size: cover;
		background-position: center;
		display: flex;
		justify-content: center;
		.avater{
			position: absolute;
			top: 100rpx;
			width: 350rpx;
			height: 350rpx;
			border-radius: 50%;
			background-image: url('/common/avater.png');
			background-size: cover;
			background-position: cover;
			box-shadow: 2px 2px 2px 1px rgba(0, 0, 0, 0.2);
		}
		.name{
			position: absolute;
			font-size: 50rpx;
			top: 450rpx;
		}
		.ip{
			position: absolute;
			font-size: 30prx;
			top: 530rpx;
		}
		.sections{
			position: absolute;
			top: 600rpx;
			/* background-color: blue; */
			width: 100%;
			height: 400rpx;
			view{
				font-size: 40rpx;
				padding-left: 20rpx;
				display: flex;
				background-color: rgba(255, 255, 255, 0.5);
				align-items: center;
			}
			.section{
				margin-top: 20rpx;
				box-shadow: 0 0 30rpx rgba(0, 0, 0, 0.1);
			}
		}
	}
</style>
