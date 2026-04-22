// 适配 OpenClaw >=3.0.0 / Context Engine >=1.0.0
const plugin = require('./subconscious-personality-guardian.js');

// 新版引擎要求导出 register 和 activate 函数
function register(api) {
    // 注册生命周期钩子 - 这是关键！
    api.registerHook('init', plugin.init.bind(plugin));
    api.registerHook('beforeTurn', plugin.beforeTurn.bind(plugin));
    api.registerHook('afterTurn', plugin.afterTurn.bind(plugin));
    
    // 如果你的插件提供了任何工具，也在这里注册
    // api.registerTool({ name: '...', ... });
    return plugin;
}

async function activate(context) {
    // 初始化插件
    await plugin.init(context);
    return plugin;
}

module.exports = {
    register,
    activate,
};