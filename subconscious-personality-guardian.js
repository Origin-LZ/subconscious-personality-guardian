// ==============================
// 适配 OpenClaw >=3.0.0 / Context Engine >=1.0.0
// 潜意识人格守护与演化插件 v2.2.0（已修复3个核心问题）
// 核心：人格不由智能体控制，由独立潜意识模块维护
// 设计思想在 Claude 代码泄露前已完整形成
// ==============================
const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const config = require('./module_config.json');

const plugin = {
    name: 'subconscious-personality-guardian',
    version: config.version,
    description: '潜意识人格守护与演化插件 2.4.0-beta.1',
    author: 'your-name',
    contextEngine: true,
    compatible: config.compatible,

    agentCaches: new Map(),

    formatTime() {
        const d = new Date();
        const y = d.getFullYear();
        const m = String(d.getMonth() + 1).padStart(2, '0');
        const dStr = String(d.getDate()).padStart(2, '0');
        const hh = String(d.getHours()).padStart(2, '0');
        const mm = String(d.getMinutes()).padStart(2, '0');
        const ss = String(d.getSeconds()).padStart(2, '0');
        return `${y}-${m}-${dStr} ${hh}:${mm}:${ss}`;
    },

    generateFileName(prefix) {
        const now = new Date();
        const y = now.getFullYear();
        const m = String(now.getMonth() + 1).padStart(2, '0');
        const d = String(now.getDate()).padStart(2, '0');
        const hh = String(now.getHours()).padStart(2, '0');
        const mm = String(now.getMinutes()).padStart(2, '0');
        const ss = String(now.getSeconds()).padStart(2, '0');
        return `${prefix}_${y}${m}${d}_${hh}${mm}${ss}.md`;
    },

    simpleSimilarity(a, b) {
        if (!a || !b) return 0;
        const setA = new Set(a.split(/\s+/).filter(wd => wd.length > 1));
        const setB = new Set(b.split(/\s+/).filter(wd => wd.length > 1));
        const intersect = [...setA].filter(x => setB.has(x)).length;
        const union = setA.size + setB.size - intersect;
        return union === 0 ? 0 : parseFloat((intersect / union).toFixed(4));
    },

    calcMemoryDiff(lastMemory, currentMemory) {
        if (!lastMemory) return 1.0;
        if (!currentMemory) return 1.0;
        const sim = this.simpleSimilarity(lastMemory, currentMemory);
        return parseFloat((1 - sim).toFixed(4));
    },

    saveMemorySnapshot(context, memoryContent) {
        if (!context || !memoryContent) return false;
        const { workspace } = context.agent;
        try {
            const folder = path.join(workspace, 'memory_snapshots');
            if (!fsSync.existsSync(folder)) {
                fsSync.mkdirSync(folder, { recursive: true, mode: 0o755 });
            }
            const file = path.join(folder, this.generateFileName('memory'));
            fsSync.writeFileSync(file, memoryContent, 'utf8');
            this.cleanupOldMemorySnapshots(context);
            this.writeOpLog(context, 'info', `✅ 记忆快照已保存：${path.basename(file)}`);
            return true;
        } catch (e) {
            this.writeOpLog(context, 'error', `❌ 记忆快照保存失败：${e.message}`);
            return false;
        }
    },

    cleanupOldMemorySnapshots(context) {
        if (!context) return;
        const { workspace } = context.agent;
        const keep = config.log_config.memory_snapshot_keep_count || 30;
        try {
            const folder = path.join(workspace, 'memory_snapshots');
            if (!fsSync.existsSync(folder)) return;
            const files = fsSync.readdirSync(folder)
                .filter(f => f.startsWith('memory_') && f.endsWith('.md'))
                .sort((a, b) => fsSync.statSync(path.join(folder, b)).mtimeMs - fsSync.statSync(path.join(folder, a)).mtimeMs);
            if (files.length > keep) {
                const delFiles = files.slice(keep);
                delFiles.forEach(f => fsSync.unlinkSync(path.join(folder, f)));
                this.writeOpLog(context, 'info', `🧹 记忆快照清理完成，保留最新 ${keep} 个`);
            }
        } catch (e) {
            this.writeOpLog(context, 'error', `❌ 记忆快照清理失败：${e.message}`);
        }
    },

    getFallbackPersonality(userMsg = '') {
        if (/开心|高兴|太棒|超赞/.test(userMsg)) return { long: '积极亲和，语气轻松', short: '有活力、热情回应' };
        if (/难过|伤心|失望|委屈/.test(userMsg)) return { long: '温和包容，共情陪伴', short: '轻声安慰、耐心倾听' };
        if (/问题|错误|失败|报错/.test(userMsg)) return { long: '理性严谨，逻辑清晰', short: '简洁专业、聚焦解决方案' };
        if (/感谢|谢谢|麻烦你/.test(userMsg)) return { long: '礼貌谦和，友好回应', short: '客气大方、不敷衍' };
        return { long: '稳定自然，语气平和', short: '温和友好、连贯一致' };
    },

    writeOpLog(context, level, msg) {
        if (!context || !context.logger) return;
        const { id: agentId } = context.agent;
        const logMsg = `[${this.formatTime()}] [${agentId}] ${config.log_prefix}：${msg}`;
        switch (level) {
            case 'info': context.logger.info(logMsg); break;
            case 'warn': context.logger.warn(logMsg); break;
            case 'error': context.logger.error(logMsg); break;
            default: context.logger.info(logMsg); break;
        }
        try {
            const logFile = path.join(context.agent.workspace, 'personality_operation.log');
            const line = `${logMsg}\n`;
            fsSync.appendFileSync(logFile, line, 'utf8');
        } catch (e) {}
    },

    writeIterationLog(context, source, long, short, current) {
        if (!context) return;
        const { workspace } = context.agent;
        try {
            const folder = path.join(workspace, config.log_config.iteration_folder);
            if (!fsSync.existsSync(folder)) fsSync.mkdirSync(folder, { recursive: true, mode: 0o755 });
            const file = path.join(folder, this.generateFileName('iter'));
            const content = `# 源人格\n${source || '未设置'}\n\n# 长期倾向\n${long || '未生成'}\n\n# 短期风格\n${short || '未生成'}\n\n# 现行人格\n${current || '未生成'}\n\n# 生成时间\n${this.formatTime()}`;
            fsSync.writeFileSync(file, content, 'utf8');
            this.writeOpLog(context, 'info', `📝 人格迭代日志已生成`);
        } catch (e) {}
    },

    saveSnapshot(context, content) {
        if (!context || !content) return false;
        const { workspace } = context.agent;
        try {
            const folder = path.join(workspace, 'personality_snapshots');
            if (!fsSync.existsSync(folder)) fsSync.mkdirSync(folder, { recursive: true, mode: 0o755 });
            const file = path.join(folder, this.generateFileName('snapshot'));
            fsSync.writeFileSync(file, content, 'utf8');
            this.cleanupOldSnapshots(context);
            this.writeOpLog(context, 'info', `📸 人格快照已保存`);
            return true;
        } catch (e) {
            return false;
        }
    },

    cleanupOldSnapshots(context) {
        if (!context) return;
        const { workspace } = context.agent;
        const keep = config.log_config.snapshot_keep_count || 20;
        try {
            const folder = path.join(workspace, 'personality_snapshots');
            if (!fsSync.existsSync(folder)) return;
            const files = fsSync.readdirSync(folder)
                .filter(f => f.startsWith('snapshot_') && f.endsWith('.md'))
                .sort((a, b) => fsSync.statSync(path.join(folder, b)).mtimeMs - fsSync.statSync(path.join(folder, a)).mtimeMs);
            if (files.length > keep) {
                const delFiles = files.slice(keep);
                delFiles.forEach(f => fsSync.unlinkSync(path.join(folder, f)));
            }
        } catch (e) {}
    },

    async loadLatestSnapshot(context) {
        if (!context) return null;
        const { workspace } = context.agent;
        try {
            const folder = path.join(workspace, 'personality_snapshots');
            if (!fsSync.existsSync(folder)) return null;
            const files = fsSync.readdirSync(folder)
                .filter(f => f.startsWith('snapshot_') && f.endsWith('.md'))
                .sort((a, b) => fsSync.statSync(path.join(folder, b)).mtimeMs - fsSync.statSync(path.join(folder, a)).mtimeMs);
            if (!files.length) return null;
            return fsSync.readFileSync(path.join(folder, files[0]), 'utf8');
        } catch (e) {
            return null;
        }
    },

    syncStableToMemory(context, longTerm) {
        if (!context || !longTerm) return;
        const { workspace } = context.agent;
        try {
            const memoryFile = path.join(workspace, 'MEMORY.md');
            const syncContent = `\n---\n## 稳定人格特征 [${this.formatTime()}]\n${longTerm.trim()}\n`;
            if (!fsSync.existsSync(memoryFile)) {
                fsSync.writeFileSync(memoryFile, `# AI 人格记忆档案\n${syncContent}`, 'utf8');
            } else {
                fsSync.appendFileSync(memoryFile, syncContent, 'utf8');
            }
            this.writeOpLog(context, 'info', `🔗 稳定人格已同步至 MEMORY.md`);
        } catch (e) {}
    },

    async searchRelatedMemory(context, query) {
        if (!context || !query || !context.callTool) return '';
        try {
            const res = await context.callTool('memory_search', {
                query: query, limit: 3, type: 'text', scoreThreshold: 0.5
            });
            const list = res?.data || res?.results || [];
            if (!list.length) return '';
            return list.map(i => i.text || i.content).filter(Boolean).join('\n---\n');
        } catch (e) {
            return '';
        }
    },

    async getFullMemoryContent(context) {
        if (!context || !context.agent) return '';
        const { workspace } = context.agent;
        const memoryFile = path.join(workspace, 'MEMORY.md');
        try {
            await fs.access(memoryFile);
            return await fs.readFile(memoryFile, 'utf8');
        } catch (e) {
            return '';
        }
    },

    async generateCurrentPersonality(context, cache, memoryText) {
        if (!context || !cache || !context.llm?.chat) return cache.sourcePersonality;
        const { userMessage = '', botReply = '' } = context;
        const { current_personality_prompt, evolution_llm, evolution_temperature } = config.prompt_config;
        const model = evolution_llm?.trim() || context.llm.getDefaultModel?.() || 'default';

        const prompt = `${current_personality_prompt}
【源人格】${cache.sourcePersonality}
【长期倾向】${cache.targetLongTerm}
【短期风格】${cache.targetShortTerm}
【相关记忆】${memoryText || '无'}
【用户输入】${userMessage}
【助手回复】${botReply}`;

        try {
            const res = await context.llm.chat({
                model, temperature: Number(evolution_temperature) || 0.1, max_tokens: 500,
                messages: [{ role: 'user', content: prompt }]
            });
            return res?.content?.trim() || cache.sourcePersonality;
        } catch (e) {
            return cache.sourcePersonality;
        }
    },

    async splitLongAndShort(context, currentPersonality) {
        if (!context || !currentPersonality || !context.llm?.chat) {
            return this.getFallbackPersonality(context.userMessage);
        }
        const { new_target_prompt, evolution_llm, evolution_temperature } = config.prompt_config;
        const model = evolution_llm?.trim() || context.llm.getDefaultModel?.() || 'default';

        const prompt = `${new_target_prompt}
输出格式严格：
长期倾向：xxx
短期风格：xxx
人格内容：
${currentPersonality}`;

        try {
            const res = await context.llm.chat({
                model, temperature: Math.min(Number(evolution_temperature) || 0.1, 0.3), max_tokens: 200,
                messages: [{ role: 'user', content: prompt }]
            });
            const text = res?.content?.trim() || '';
            const long = (text.match(/长期倾向[：:]\s*([^\n]+)/) || [])[1]?.trim() || '';
            const short = (text.match(/短期风格[：:]\s*([^\n]+)/) || [])[1]?.trim() || '';
            return long && short ? { long, short } : this.getFallbackPersonality(context.userMessage);
        } catch (e) {
            return this.getFallbackPersonality(context.userMessage);
        }
    },

    async init(context) {
        if (!context || !context.agent) return;
        const { id: agentId, workspace } = context.agent;
        const soulPath = path.join(workspace, 'soul.md');
        this.agentCaches.set(agentId, {
            soulPath,
            sourcePersonality: '',
            targetLongTerm: '',
            targetShortTerm: '',
            evolveCount: 0,
            lastEvolveTime: 0, // 修复：初始化为0，第一次可快速演化
            lastSyncMemory: 0,
            failCount: 0,
            lastMemoryContent: ''
        });
        try {
            await fs.access(soulPath);
            const c = await fs.readFile(soulPath, 'utf8');
            if (c.trim()) this.agentCaches.get(agentId).sourcePersonality = c.trim();
        } catch {
            await fs.writeFile(soulPath, '稳定自然，温和友好，连贯一致的AI交互风格', 'utf8', { mode: 0o755 });
        }
        this.writeOpLog(context, 'info', `🚀 插件初始化完成 v${config.version}`);

        if (config.test_config?.enableGatewayRestartTest) {
            this.runGatewayRestartTest(context).catch(err => {
                this.writeOpLog(context, 'error', `❌ 网关测试失败：${err.message}`);
            });
        }
    },

    // ==============================
    // beforeTurn 修复：只清理自己注入的块，不破坏原生 prompt
    // ==============================
    async beforeTurn(context) {
        if (!context || !context.agent) return;
        const { id: agentId } = context.agent;
        const cache = this.agentCaches.get(agentId);
        if (!cache) { await this.init(context); return; }
        try {
            const soulContent = await fs.readFile(cache.soulPath, 'utf8');
            const trimContent = soulContent.trim();
            if (!trimContent) {
                cache.sourcePersonality = '稳定自然，温和友好，连贯一致的AI交互风格';
                return;
            }
            cache.sourcePersonality = trimContent;
            const tag = config.prompt_config.lock_tag;

            // 修复：只清理上一次插件注入的人格块，保留系统原有prompt
            if (context.systemPrompt) {
                const regex = new RegExp(`\\n?\\s*${tag}[\\s\\S]*?${tag}`, 'g');
                context.systemPrompt = context.systemPrompt.replace(regex, '').trim();
            }

            // 安全追加
            context.systemPrompt = (context.systemPrompt || '') + `\n\n${tag}\n# AI 人格规范\n${trimContent}\n${tag}`;
            this.writeOpLog(context, 'info', '✅ 人格防篡改注入成功');
        } catch (e) {
            this.writeOpLog(context, 'error', `❌ 人格注入失败：${e.message}`);
        }
    },

    // ==============================
    // afterTurn 修复：记忆差异使用完整 MEMORY.md
    // ==============================
    async afterTurn(context) {
        if (!context || !context.agent || !context.userMessage || !context.botReply) return;
        const { id: agentId } = context.agent;
        const cache = this.agentCaches.get(agentId);
        if (!cache || !cache.sourcePersonality) return;

        const userMsg = context.userMessage.trim();
        if (/回滚人格|恢复人格|还原人格/.test(userMsg)) {
            const snap = await this.loadLatestSnapshot(context);
            if (snap) {
                await fs.writeFile(cache.soulPath, snap, 'utf8');
                cache.sourcePersonality = snap;
                this.writeOpLog(context, 'info', `✅ 人格已回滚至最新快照`);
            }
            return;
        }

        // 修复：获取完整记忆，而非片段记忆
        const currentMemory = await this.getFullMemoryContent(context);
        const lastMemory = cache.lastMemoryContent || '';
        const memoryDiff = this.calcMemoryDiff(lastMemory, currentMemory);

        this.writeOpLog(context, 'info', `📊 整体记忆差异：${memoryDiff}`);
        this.saveMemorySnapshot(context, currentMemory);
        cache.lastMemoryContent = currentMemory;

        const now = Date.now();
        const minMinutes = config.evolve.minIntervalMinutes || 120;
        const diffThreshold = config.evolve.memoryDiffThreshold || 0.4;
        const timeCondition = now - cache.lastEvolveTime >= minMinutes * 60 * 1000;
        const diffCondition = memoryDiff >= diffThreshold;

        if (!timeCondition || !diffCondition) {
            this.writeOpLog(context, 'info', `⏳ 未满足演化条件：时间(${timeCondition}) 差异(${diffCondition})`);
            return;
        }

        this.writeOpLog(context, 'info', `🟢 双条件满足，开始人格演化`);
        try {
            const relatedMem = await this.searchRelatedMemory(context, userMsg);
            const current = await this.generateCurrentPersonality(context, cache, relatedMem);
            const { long, short } = await this.splitLongAndShort(context, current);

            const sim = this.simpleSimilarity(cache.sourcePersonality, current);
            const threshold = config.evolve.similarityThreshold || 0.3;
            const final = sim < threshold ? cache.sourcePersonality : current;

            this.saveSnapshot(context, cache.sourcePersonality);
            await fs.writeFile(cache.soulPath, final, 'utf8', { mode: 0o755 });
            this.writeIterationLog(context, cache.sourcePersonality, long, short, final);

            if (now - cache.lastSyncMemory > 24 * 60 * 60 * 1000) {
                this.syncStableToMemory(context, long);
                cache.lastSyncMemory = now;
            }

            cache.targetLongTerm = long;
            cache.targetShortTerm = short;
            cache.lastEvolveTime = now;
            cache.failCount = 0;

            this.writeOpLog(context, 'info', `✅ 人格演化完成，已固化`);
        } catch (e) {
            cache.failCount++;
            const fb = this.getFallbackPersonality(userMsg);
            cache.targetLongTerm = fb.long;
            cache.targetShortTerm = fb.short;
            this.writeOpLog(context, 'error', `❌ 演化失败：${e.message}`);
        }
    },

    async runGatewayRestartTest(context) {
        const testCfg = config.test_config;
        const testWs = path.join(__dirname, testCfg.testWorkspace);
        const testP = testCfg.testPersonality;

        this.writeOpLog(context, 'info', `🔍 网关重启测试启动`);
        const mock = {
            ...context, agent: { ...context.agent, workspace: testWs },
            userMessage: '你好', botReply: '你好呀',
            llm: {
                getDefaultModel: () => 'test',
                chat: async () => ({
                    content: `长期倾向：${testP}\n短期风格：温和耐心`
                })
            },
            callTool: async () => ({
                data: [{ text: '测试记忆' }]
            }),
            systemPrompt: 'test'
        };

        try {
            if (!fsSync.existsSync(testWs)) fsSync.mkdirSync(testWs, { recursive: true });
            await fs.writeFile(path.join(testWs, 'soul.md'), testP, 'utf8');
            await this.beforeTurn(mock);
            const cache = this.agentCaches.get(context.agent.id);
            cache.sourcePersonality = testP;
            const mem = await this.searchRelatedMemory(mock, mock.userMessage);
            const cur = await this.generateCurrentPersonality(mock, cache, mem);
            await this.splitLongAndShort(mock, cur);
            this.saveSnapshot(mock, cur);
            this.saveMemorySnapshot(mock, mem);
            this.writeIterationLog(mock, testP, 'long', 'short', cur);
            this.writeOpLog(context, 'info', `🎉 网关重启测试全部通过`);
        } catch (e) {
            this.writeOpLog(context, 'error', `❌ 测试失败：${e.message}`);
        }
    }
};

module.exports = plugin;
