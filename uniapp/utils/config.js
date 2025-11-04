// utils/ConfigManager.js
import { ref } from 'vue'

class ConfigManager {
  constructor() {
    // 默认配置
    this.defaultConfig = {
      url: '192.168.15.1:3000',
	  id: 0,
	  name: '游客',
	  classid: 0,
	  class: '软件231',
	  accout: '000000',
	  face: 0,
	  userRole: 'student',
	  isLogin: false
    }
    
    // 响应式配置对象
    this.config = ref({ ...this.defaultConfig })
    
    // 初始化时加载保存的配置
    this.loadFromStorage()
  }
  
  // 加载本地存储的配置
	loadFromStorage() {
	  uni.getStorage({
		key: 'app_config',
		success: (res) => {  // 箭头函数，保持 this 指向
		  this.config.value = res.data;
		  console.log('配置加载成功:', this.config.value);
		},
		fail: () => {  // 这里也用箭头函数
		  console.log('加载配置失败，使用默认配置');
		}
	  });
	}
  
  // 保存配置到本地存储
  saveToStorage() {
    try {
      uni.setStorageSync('app_config', this.config.value)
      return true
    } catch (error) {
      console.error('保存配置失败:', error)
      return false
    }
  }
  
  // 获取单个配置值
  get(key) {
    return this.config.value[key]
  }
  
  // 设置配置值（自动保存）
  set(key, value) {
    this.config.value[key] = value
    this.saveToStorage()
    return this
  }
  
  // 批量更新配置
  update(updates) {
    Object.assign(this.config.value, updates)
    this.saveToStorage()
    return this
  }
  
  // 重置为默认值
  reset() {
    this.config.value = { ...this.defaultConfig }
    this.saveToStorage()
    return this
  }
  
  // 获取整个配置对象（响应式）
  getConfig() {
    return this.config
  }
  
}

// 创建单例实例
export const configManager = new ConfigManager()