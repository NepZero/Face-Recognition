export function loginSet(flag) //是否登录设置 flag==1设置成登录状态
{
	if(flag==1)
	{
		uni.setStorageSync('isLogin', true)
	}
	else
	{
		uni.removeStorageSync('isLogin')
	}
}

export function isLogin()
{
	const flag = uni.getStorageSync('isLogin');
	if(flag)
	{
		return true;
	}
	else
	{
		return false;
	}
}

export function logOut(url)
{
	uni.request({
	    url: url, // 
	    method: 'POST',
	    success: (res) => {
			if(res.data.success)
			{
				uni.showToast({
				    title: '登出成功',
				    icon: 'success'
				});
				loginSet(0);
				uni.removeStorageSync('userInfo');
			}
			else
			{
				console.log(res)
				uni.showToast({
				    title: '登出失败',
				    icon: 'error'
				});
			}
	    },
	    fail: (err) => {
			uni.showToast({
			    title: '登出失败',
			    icon: 'error'
			});
	    }
	});
}