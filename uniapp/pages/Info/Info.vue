<template>
	<view class="layout" @touchmove.stop.prevent="() => {}" :style="'height:'+screenHeight+'px!important'">
		<view class="avater"></view>
		<view class="name">{{userInfo['name']}}</view>
		<view class="ip">{{userInfo['class']}}</view>
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
			<view class="faceUpload section" v-if="login_flag" @click="faceClick">
				<uni-icons type="gear-filled" size="25"></uni-icons>
				<view class="text">上传照片</view>
			</view>
			<view class="loginOut section" v-if="login_flag" @click="logOutClick">
				<uni-icons type="gear-filled" size="25"></uni-icons>
				<view class="text">登出</view>
			</view>
		</view>
	</view>
</template>

<script setup>
	import { onLoad,onShow} from '@dcloudio/uni-app';
	import {ref,computed} from 'vue';
	import { isLogin,logOut} from '../../utils/utils';
	
	const screenHeight=ref();
	const ip=ref('192.168.31.65:3000');
	const url=computed(()=> 'http://'+ip.value+'/send');
	const login_flag=ref(isLogin() ? true :false);
	// const login_flag=ref(true);
	const login_text=computed(()=> login_flag.value ? '切换账号' : '登录/注册');
	const userInfo=ref({'name':'游客'});
	const name_text=ref('游客');
	
	
	onLoad(()=>{
		screenHeight.value=uni.getSystemInfoSync().windowHeight;
		get_ip();
	})
	onShow(()=>{
		get_ip();
		login_flag.value=isLogin() ? true :false;
		userInfo_update(login_flag.value);
	})
	
	function netclick()
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
	
	function userInfo_update(flag)	//更新用户信息,flag==1为登录状态 flag==0为登出状态
	{
		if(flag)
		{
			uni.getStorage({
				key: 'userInfo',
				success: function (res) {
					userInfo.value={
						'name':res.data['name'],
						'id':res.data['id'],
						'classid':res.data['classid'],
						'face':res.data['face'],
						'class':res.data['class']
					}
				}
			});
		}
		else
		{
			userInfo.value={'name':'游客'};
		}
	}
	
	function login_click()	//登录event
	{
		uni.navigateTo({
		url: '../login/login'
		});
	}
	
	function logOutClick()	//登出event
	{
		logOut('http://'+ip.value+'/api/logout');
		login_flag.value=false;
		userInfo_update(0);
	}
	
	function faceClick()
	{
		uni.chooseImage({
			count: 1, //默认9
			sizeType: ['original', 'compressed'], //可以指定是原图还是压缩图，默认二者都有
			sourceType: ['camera','album'], 
			success: function (res) {
				const path=res.tempFilePaths[0];
				uni.uploadFile({
							url: 'http://'+ip.value+'/api/face-recognition',
							filePath: path,
							name: 'imagefile',
							formData: {
								'userId':userInfo.id
							},
							success: (res) => {
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
