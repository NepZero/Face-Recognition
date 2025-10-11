if (typeof Promise !== "undefined" && !Promise.prototype.finally) {
  Promise.prototype.finally = function(callback) {
    const promise = this.constructor;
    return this.then(
      (value) => promise.resolve(callback()).then(() => value),
      (reason) => promise.resolve(callback()).then(() => {
        throw reason;
      })
    );
  };
}
;
if (typeof uni !== "undefined" && uni && uni.requireGlobal) {
  const global = uni.requireGlobal();
  ArrayBuffer = global.ArrayBuffer;
  Int8Array = global.Int8Array;
  Uint8Array = global.Uint8Array;
  Uint8ClampedArray = global.Uint8ClampedArray;
  Int16Array = global.Int16Array;
  Uint16Array = global.Uint16Array;
  Int32Array = global.Int32Array;
  Uint32Array = global.Uint32Array;
  Float32Array = global.Float32Array;
  Float64Array = global.Float64Array;
  BigInt64Array = global.BigInt64Array;
  BigUint64Array = global.BigUint64Array;
}
;
if (uni.restoreGlobal) {
  uni.restoreGlobal(Vue, weex, plus, setTimeout, clearTimeout, setInterval, clearInterval);
}
(function(vue) {
  "use strict";
  const ON_LOAD = "onLoad";
  function formatAppLog(type, filename, ...args) {
    if (uni.__log__) {
      uni.__log__(type, filename, ...args);
    } else {
      console[type].apply(console, [...args, filename]);
    }
  }
  const createLifeCycleHook = (lifecycle, flag = 0) => (hook, target = vue.getCurrentInstance()) => {
    !vue.isInSSRComponentSetup && vue.injectHook(lifecycle, hook, target);
  };
  const onLoad = /* @__PURE__ */ createLifeCycleHook(
    ON_LOAD,
    2
    /* HookFlags.PAGE */
  );
  const _export_sfc = (sfc, props) => {
    const target = sfc.__vccOpts || sfc;
    for (const [key, val] of props) {
      target[key] = val;
    }
    return target;
  };
  const _sfc_main$1 = {
    __name: "index",
    setup(__props, { expose: __expose }) {
      __expose();
      const ip = vue.ref("192.168.31.65:3000");
      const url = vue.computed(() => "http://" + ip.value + "/send");
      const connection_flag = vue.ref(false);
      const screenHeight = vue.ref();
      onLoad(() => {
        screenHeight.value = uni.getSystemInfoSync().windowHeight;
      });
      function uploadimg() {
        uni.chooseImage({
          count: 1,
          //默认9
          sizeType: ["original", "compressed"],
          //可以指定是原图还是压缩图，默认二者都有
          sourceType: ["camera", "album"],
          success: function(res) {
            formatAppLog("log", "at pages/index/index.vue:29", JSON.stringify(res.tempFilePaths));
            const path = res.tempFilePaths[0];
            formatAppLog("log", "at pages/index/index.vue:31", path);
            uni.uploadFile({
              url: url.value,
              //仅为示例，非真实的接口地址
              filePath: path,
              name: "imagefile",
              formData: {
                "user": "test"
              },
              success: (res2) => {
                uni.showToast({
                  title: "上传成功",
                  icon: "success"
                });
              },
              fail: (res2) => {
                uni.showToast({
                  title: "上传失败",
                  icon: "fail"
                });
              },
              complete: () => {
                formatAppLog("log", "at pages/index/index.vue:52", "buzhidao");
              }
            });
          }
        });
      }
      function testConnection() {
        connection_flag.value = true;
        uni.request({
          url: url.value,
          // 替换为你的电脑IP
          method: "POST",
          success: (res) => {
            formatAppLog("log", "at pages/index/index.vue:65", "连接测试成功:", res.data);
            uni.showToast({
              title: "连接成功",
              icon: "success"
            });
          },
          fail: (err) => {
            formatAppLog("error", "at pages/index/index.vue:72", "连接测试失败:", err);
            uni.showModal({
              title: "连接失败",
              content: `无法连接到服务器
请检查:
1. IP地址是否正确
2. 端口是否开放
3. 防火墙设置`,
              showCancel: false
            });
          },
          complete: () => {
            connection_flag.value = false;
          }
        });
      }
      function ipconfig() {
        uni.showModal({
          title: ip.value,
          content: "",
          editable: true,
          placeholderText: "输入ip",
          success: (res) => {
            if (res.confirm) {
              ip.value = res.content;
            }
          }
        });
      }
      const __returned__ = { ip, url, connection_flag, screenHeight, uploadimg, testConnection, ipconfig, get onLoad() {
        return onLoad;
      }, ref: vue.ref, computed: vue.computed };
      Object.defineProperty(__returned__, "__isScriptSetup", { enumerable: false, value: true });
      return __returned__;
    }
  };
  function _sfc_render(_ctx, _cache, $props, $setup, $data, $options) {
    return vue.openBlock(), vue.createElementBlock(
      "view",
      {
        class: "layout",
        onTouchmove: vue.withModifiers(() => {
        }, ["stop", "prevent"]),
        style: vue.normalizeStyle("height:" + $setup.screenHeight + "px!important")
      },
      [
        vue.createElementVNode("button", {
          class: "loadbutton",
          size: "default",
          onClick: $setup.uploadimg
        }, "点击拍照"),
        vue.createElementVNode("button", {
          size: "default",
          onClick: $setup.testConnection,
          loading: $setup.connection_flag
        }, "网络测试", 8, ["loading"]),
        vue.createElementVNode("button", {
          size: "default",
          onClick: $setup.ipconfig
        }, "网络配置")
      ],
      36
      /* STYLE, NEED_HYDRATION */
    );
  }
  const PagesIndexIndex = /* @__PURE__ */ _export_sfc(_sfc_main$1, [["render", _sfc_render], ["__scopeId", "data-v-1cf27b2a"], ["__file", "C:/Users/Nepnep/Desktop/uniapp/pages/index/index.vue"]]);
  __definePage("pages/index/index", PagesIndexIndex);
  const _sfc_main = {
    onLaunch: function() {
      formatAppLog("log", "at App.vue:4", "App Launch");
    },
    onShow: function() {
      formatAppLog("log", "at App.vue:7", "App Show");
    },
    onHide: function() {
      formatAppLog("log", "at App.vue:10", "App Hide");
    }
  };
  const App = /* @__PURE__ */ _export_sfc(_sfc_main, [["__file", "C:/Users/Nepnep/Desktop/uniapp/App.vue"]]);
  function createApp() {
    const app = vue.createVueApp(App);
    return {
      app
    };
  }
  const { app: __app__, Vuex: __Vuex__, Pinia: __Pinia__ } = createApp();
  uni.Vuex = __Vuex__;
  uni.Pinia = __Pinia__;
  __app__.provide("__globalStyles", __uniConfig.styles);
  __app__._component.mpType = "app";
  __app__._component.render = () => {
  };
  __app__.mount("#app");
})(Vue);
