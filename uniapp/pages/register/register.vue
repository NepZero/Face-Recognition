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
		<view class="password_box password_again_box">
			<view class="text">密码</view>
			<input class="uni-input password" password placeholder="再次输入密码确认" v-model="password_again_value" />
		</view>
		<view class="username_box">
			<view class="text">用户名</view>
			<input class="uni-input account" focus placeholder="请输入用户名" v-model="username_value" />
		</view>
		<button size="default" @click="register_click" class="register_button">注册</button>
		<view class="login_box">
			<view class="text" @click="login_click">账号密码登录</view>
			<uni-icons color="gray" type="right" size="20"></uni-icons>
		</view>
	</view>
</template>

<script setup>
	import { onLoad,onShow} from '@dcloudio/uni-app';
	import {ref,computed} from 'vue';
	const ip=ref('192.168.31.65:3000');
	const screenHeight=ref();
	const username_value=ref();
	const account_value=ref();
	const password_value=ref();
	const password_again_value=ref();
	const register_url=computed(()=> 'http://'+ip.value+'/api/register');
	
	
	onLoad(()=>{
		screenHeight.value=uni.getSystemInfoSync().windowHeight;
		get_ip();
	})
	
	function login_click()
	{
		uni.redirectTo({
		url: '../login/login'
		});
	}
	function register_match()
	{
		if(!account_value.value)
		{
			uni.showToast({
			    title: '账号不能为空',
			    icon: 'error'
			});
			return true;
		}
		else if(!password_value.value || !password_again_value.value)
		{
			uni.showToast({
			    title: '密码不能为空',
			    icon: 'error'
			});
			return true;
		}
		else if(!username_value.value)
		{
			uni.showToast({
			    title: '用户名不能为空',
			    icon: 'error'
			});
			return true;
		}
		
		if(password_again_value.value!=password_value.value)
		{
			uni.showToast({
			    title: '密码不一致',
			    icon: 'error'
			});
			return true;
		}
	}
	
	function register_click()
	{
		if(register_match())
		{
			return;
		}
		uni.showLoading({
			title:'正在注册',
			mask:true
		})
		uni.request({
		    url: register_url.value, // 
		    method: 'POST',
			data:{"userAccount":account_value.value,"userPassword":password_value.value,"userName":username_value.value},
		    success: (res) => {
				if(res.data.success)
				{
					uni.showToast({
					    title: '注册成功',
					    icon: 'success'
					});
					uni.redirectTo({
					url: '../login/login'
					});
				}
				else
				{
					console.log(res)
					uni.showToast({
					    title: '注册失败',
					    icon: 'error'
					});
				}
		    },
		    fail: (err) => {
				uni.showToast({
				    title: '注册失败',
				    icon: 'error'
				});
		    },
			complete:()=>{
				uni.hideLoading();
			}
		});
	}
	function get_ip()
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
		
		.username_box{
			padding-top: 20rpx;
			margin-left: 50rpx;
			display: flex;
			border-bottom: 1rpx solid gray;
		}
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
		.register_button{
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
		.login_box{
			margin-top: 20rpx;
			display: flex;
			justify-content: center;
			align-items: center;
			font-size: 35rpx;
			color: gray;
			
		}
	}
</style>
