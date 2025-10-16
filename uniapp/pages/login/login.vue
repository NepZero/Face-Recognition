<template>
	<view class="layout" @touchmove.stop.prevent="() => {}" :style="'height:'+screenHeight+'px!important'">
		<view class="account_box">
			<view class="text">账号</view>
			<input class="uni-input account" focus placeholder="请输入账号" v-model="account_value" />
		</view>
		<view class="password_box">
			<view class="text">密码</view>
			<input class="uni-input password" password placeholder="请输入密码" v-model="password_value" />
		</view>
		<button size="default" @click="login_click" class="login_button">登录</button>
		<view class="register_box">
			<view class="text" @click="register_click">账号密码注册</view>
			<uni-icons color="gray" type="right" size="20"></uni-icons>
		</view>
	</view>
</template>

<script setup>
	import { onLoad,onShow} from '@dcloudio/uni-app';
	import {ref,computed} from 'vue';
	import { loginSet } from '../../utils/utils';
	
	const ip=ref('192.168.31.65:3000');
	const screenHeight=ref();
	const login_url=computed(()=> 'http://'+ip.value+'/api/login');
	const account_value=ref();
	const password_value=ref();
	
	onLoad(()=>{
		screenHeight.value=uni.getSystemInfoSync().windowHeight;
		get_ip();
	})
	
	function login_match()	//登录账号密码检测是否合法
	{
		if(!account_value.value)
		{
			uni.showToast({
			    title: '用户名不能为空',
			    icon: 'error'
			});
			return true;
		}
		else if(!password_value.value)
		{
			uni.showToast({
			    title: '密码不能为空',
			    icon: 'error'
			});
			return true;
		}
	}
	
	function login_click()	//登录按钮event
	{
		if(login_match())
		{
			return;
		}
		uni.showLoading({
			title:'正在登录',
			mask:true
		})
		uni.request({
		    url: login_url.value, // 
		    method: 'POST',
			data:{"userAccount":account_value.value,"userPassword":password_value.value},
		    success: (res) => {
				res=res.data;
				if(res.success)
				{
					uni.setStorage({
						key: 'userInfo',
						data: {'name':res.data.userName,'id':res.data.userId,'account':res.data.userAccount,'face':res.data.faceRegistered,'classid':res.data.classId,'userRole':res.data.userRole},
						success: function () {
							console.log('setStorage success');
						}
					});
					loginSet(1);
					uni.showToast({
					    title: '登录成功',
					    icon: 'success'
					});
					uni.switchTab({
					url: '../Info/Info'
					});
				}
				else
				{
					uni.showToast({
					    title: '登录失败',
					    icon: 'error'
					});
				}
		    },
		    fail: (err) => {
				uni.showToast({
				    title: '登录失败',
				    icon: 'error'
				});
		    },
			complete:()=>{
				uni.hideLoading();
			}
		});
	}
	
	function register_click()	//跳转到注册页面
	{
		uni.redirectTo({
		url: '../register/register'
		});
	}
	function get_ip()	//获取服务器ip
	{
		uni.getStorage({
			key: 'upload_ip',
			success: function (res) {
				console.log(res.data);
				ip.value=res.data;
			}
		});
	}
</script>

<style lang='scss' scoped>
	.layout{
		width: 100%;
		.account_box{
			margin-top: 100rpx;
			margin-left: 50rpx;
			display: flex;
			border-bottom: 1px solid gray;
		}
		.password_box{
			padding-top: 20rpx;
			margin-left: 50rpx;
			display: flex;
			border-bottom: 1rpx solid gray;
		}
		input{
			margin-left: 50rpx;
		}
		.login_button{
			background-color: pink;
			width: 500rpx;
			height: 80rpx;
			display: flex;
			justify-content: center;
			align-items: center;
			border-radius: 25px;	
			color: white;
			margin-top: 50rpx;
		}
		.register_box{
			margin-top: 20rpx;
			display: flex;
			justify-content: center;
			align-items: center;
			font-size: 35rpx;
			/* background-color: green; */
			color: gray;
			
		}
	}
</style>
