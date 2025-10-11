<template>
	<view class="layout" @touchmove.stop.prevent="() => {}" :style="'height:'+screenHeight+'px!important'">
		<view class="avater"></view>
		<view class="name">Nepnep</view>
		<view class="ip">192.10.11.2</view>
		<view class="sections">
			<view class="login section">
				<uni-icons type="right" size="25"></uni-icons>
				<view class="text">切换账号</view>
			</view>
			<view class="net section" @click="netclick">
				<uni-icons type="gear-filled" size="25"></uni-icons>
				<view class="text">网络设置</view>
			</view>
			<view class="set section">
				<uni-icons type="gear-filled" size="25"></uni-icons>
				<view class="text">设置</view>
			</view>
		</view>
	</view>
</template>

<script setup>
	import { onLoad,onShow} from '@dcloudio/uni-app';
	import {ref,computed} from 'vue';
	const screenHeight=ref();
	const ip=ref('192.168.31.65:3000/send');
	const url=computed(()=> 'http://'+ip.value);
	
	
	onLoad(()=>{
		screenHeight.value=uni.getSystemInfoSync().windowHeight;
		get_ip();
	})
	onShow(()=>{
		get_ip();
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
				console.log(res.data);
				ip.value=res.data;
			}
		});
	}
	
</script>

<style lang='scss' scoped>
	.layout{
		height: 100%;
		width: 100%;
		/* background-color: red; */
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
				background-color: white;
				align-items: center;
			}
			.section{
				margin-top: 20rpx;
				box-shadow: 0 0 30rpx rgba(0, 0, 0, 0.1);
			}
		}
	}
</style>
