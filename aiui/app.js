// 应用入口。
//
// 只留 globalData，不写 App({...})——AIUI 要求默认导出。
// 也不声明没人验证过的 App 生命周期回调：官方参考只确认了 Page / Widget /
// Agent Worker 的回调名，凭空加一个不存在的只会让「没跑」看起来像「跑了」。
export default {
  globalData: {
    // 引擎由 adapter/engine-runtime.js 按需取，不放这里：
    // 放全局会让「没加载起来」变成没人负责的状态
    ready: true,
  },
};
