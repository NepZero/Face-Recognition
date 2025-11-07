export function loginSet(flag) //登录状态设置 flag==1设置成登录状态
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

export function isLogin()	//是否登录
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

export function logOut(url)		//登出请求
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

export function isStudent()	//是否是学生
{
	const userInfo = uni.getStorageSync('userInfo');
	if(userInfo && userInfo.userRole!='student')
	{
		return false;
	}
	else
	{
		return true;
	}
}

export function tokenSave(token)
{
	try {
	// 将数据存储到本地缓存
		uni.setStorageSync('token', token);
		console.log('token存储成功');
	} catch (e) {
		console.error('存储失败：', e);
	}
}

export function tokenGet()
{
	return 'Bearer ' + uni.getStorageSync('token');
}