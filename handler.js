// 适配 OpenClaw >=3.0.0 / Context Engine >=1.0.0
const plugin = require('./subconscious-personality-guardian.js');

// 新版引擎要求导出插件元数据+方法
module.exports = {
  ...plugin,
  // 新版引擎注册钩子标识
  registerHooks: true,
  contextEngine: true
};
