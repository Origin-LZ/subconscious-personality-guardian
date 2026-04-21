---
name: subconscious-personality-guardian
version: 2.1.0
description: 适配OpenClaw最新Context Engine，人格守护与演化插件（内置网关重启测试）
hookVersion: 2.0.0
contextEngine: true
compatible:
  openclaw: ">=3.0.0"
hooks:
  - event: init
    handler: subconscious-personality-guardian.js#init
    context: full
  - event: beforeTurn
    handler: subconscious-personality-guardian.js#beforeTurn
    context: full
  - event: afterTurn
    handler: subconscious-personality-guardian.js#afterTurn
    context: full
---

# 潜意识人格守护与演化插件
## 适配说明
基于 OpenClaw 最新 Context Engine 开发，支持全生命周期钩子、标准化工具调用、官方日志/文件系统，内置网关重启自动测试。
## 核心功能
- 人格防篡改注入（beforeTurn）
- 分层人格演化（长期倾向/短期风格）
- 历史记忆检索（memory_search 工具）
- 人格快照与一键回滚
- 稳定人格同步至 MEMORY.md
- 人格漂移防护 + LLM 异常降级
- 网关重启自动测试（日志全记录+隔离测试）

## 指令支持
- 回滚人格 / 恢复人格：恢复至最新快照版本
