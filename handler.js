// 适配 OpenClaw >=3.0.0 / Context Engine >=1.0.0
const plugin = require('./subconscious-personality-guardian.js');

// 新版引擎要求导出 register 和 activate 函数
function register(api) {
    // 注册钩子标识
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
    // 保留原有属性，确保兼容
    name: plugin.name,
    version: plugin.version,
    description: plugin.description,
    author: plugin.author,
    contextEngine: plugin.contextEngine,
    hooks: {
        beforeTurn: plugin.beforeTurn.bind(plugin),
        afterTurn: plugin.afterTurn.bind(plugin),
        init: plugin.init.bind(plugin)
    }
};