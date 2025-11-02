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
		<view class="classid_box">
			<view class="text">选择班级:</view>
			<!-- <input class="uni-input account" focus placeholder="请输入班级ID" v-model="classid_value" /> -->
			<picker :value="index" :range="classArray" class="pickerbox" @change="pickerClick">
				<view class="uni-input">{{classArray[index]}}</view>
			</picker>
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
	// const classid_value=ref();
	const password_again_value=ref();
	const register_url=computed(()=> 'http://'+ip.value+'/api/register');
	const classInfo=ref([{'id':1,'className':'软件231','classCode':'CS2023-1'}]);
	const index=ref(0);
	const classArray = computed(() => classInfo.value.map(item => item.className));
	// const array=ref(['1','2','3']);
	
	onLoad(()=>{
		screenHeight.value=uni.getSystemInfoSync().windowHeight;
		get_ip();
		getClass();
	})
	
	function login_click()
	{
		uni.redirectTo({
		url: '../login/login'
		});
	}
	function register_match() //账号标准化检验
	{
		if(password_again_value.value!=password_value.value)
		{
			uni.showToast({
			    title: '密码不一致',
			    icon: 'error'
			});
			return true;
		}
	}
	
	function register_click() //注册按钮
	{
		if(password_again_value.value && password_value.value)
		{
			if(register_match())
			{
				return;
			}
		}
		uni.showLoading({
			title:'正在注册',
			mask:true
		})
		uni.request({
		    url: register_url.value, 
		    method: 'POST',
			timeout:5000,
			data:{"userAccount":account_value.value,"userPassword":password_value.value,"userName":username_value.value,"classId":index.value+1},
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
					uni.showModal({
						title: '注册失败',
						content: res.data.message,
						showCancel:false
					});
				}
		    },
		    fail: (err) => {
				uni.showModal({
					title: '注册失败',
					content: res.data.message,
					showCancel:false
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
	
	function getClass() //获取班级列表
	{
		uni.request({
		    url: 'http://'+ip.value+'/api/classes', // 
		    method: 'GET',
		    success: (res) => {
				if(res.data.success)
				{
					classInfo.value=res.data.data;
					console.log('获取班级列表成功');
				}
				else
				{
					console.log('获取班级列表失败')
				}
		    },
			
		    fail: (err) => {
				console.log('获取班级列表失败')
				}
		});
				
	}
	
	function pickerClick(e,x)
	{
		console.log(e);
		index.value=e.detail.value;
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
		.classid_box{
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
		.pickerbox{
			margin-left: 10rpx;
		}
	}
</style>
