import App from './App'

// #ifndef VUE3
import Vue from 'vue'
import './uni.promisify.adaptor'
Vue.config.productionTip = false
App.mpType = 'app'
const app = new Vue({
  ...App
})
app.$mount()
// #endif

// #ifdef VUE3
import { createSSRApp } from 'vue'
import { configManager } from './utils/config'
export function createApp() {
	const app = createSSRApp(App)
	//提供配置管理器给所有组件
	app.provide('configManager', configManager)
    
    // 也可以挂载到全局属性
    app.config.globalProperties.$config = configManager
	app.config.globalProperties.$a='okkkkkkkk'
	return {
		app
	}
}
// #endif