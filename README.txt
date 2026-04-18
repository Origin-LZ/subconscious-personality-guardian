# subconscious-personality-guardian v2.2.0

**状态：测试中**
> 
> 本插件正在积极测试中，功能可能不稳定，欢迎反馈问题。
> 稳定版本发布后，此提示将移除。

**STATUS: TESTING**
>
> This plugin is under active testing. Features may be unstable. Feedback and issue reports are welcome.
> This notice will be removed once stable.




OpenClaw 人格守护与潜意识演化插件

## 更新说明（v2.2.0）
- 新增 **记忆差异分析** 机制
- 每次人格保存时自动另存 **记忆快照**
- 人格演化改为双条件触发：
  1. 记忆差异达到设定阈值
  2. 时间间隔达到设定时长
- 完全保留原有稳定逻辑，beforeTurn 无任何修改
- 日志更完整，可追踪差异变化

## 设计思想说明
本插件的核心设计：**人格不由智能体自主控制，由独立潜意识模块后台维护与演化**，该思想在 Claude 相关代码泄露之前已完整形成并实现。与目前常见的“做梦/记忆整理”仅表层相似，底层设计哲学完全不同。
