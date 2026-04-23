// 适配 OpenClaw >=3.0.0 / Context Engine >=1.0.0
import { definePluginEntry } from "openclaw/plugin-sdk/plugin-entry";
import plugin from './subconscious-personality-guardian.js';

export default definePluginEntry({
  id: "subconscious-personality-guardian",
  name: "潜意识人格守护与演化插件",
  description: "人格防篡改、分层固化、记忆检索、快照回滚、MEMORY.md同步",

  register(api) {
    // 注册生命周期钩子
    if (!plugin) {
      console.error('Plugin not loaded correctly');
      return;
    }
    api.registerHook('init', plugin.init.bind(plugin), { name: "personality_init" });
    api.registerHook('before_prompt_build', plugin.beforeTurn.bind(plugin), { name: "personality_beforeTurn" });
    api.registerHook('afterTurn', plugin.afterTurn.bind(plugin), { name: "personality_afterTurn" });
  },
});