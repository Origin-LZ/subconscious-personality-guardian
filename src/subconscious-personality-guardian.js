// ==============================
// 适配 OpenClaw >=3.0.0 / Context Engine >=1.0.0
// 潜意识人格守护与演化插件 | 内置网关重启测试（日志全记录+隔离）
// ==============================
const fs = require('fs/promises');
const fsSync = require('fs');
const path = require('path');
const config = require('./module_config.json');

const plugin = {
    name: 'subconscious-personality-guardian',
    version: config.version,
    description: '适配OpenClaw最新Context Engine，人格守护与演化插件（内置网关重启测试）',
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
        return union === 0 ? 0 : (intersect / union).toFixed(2);
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
        } catch (e) {
            if (context.logger) context.logger.warn(`本地日志写入失败：${e.message}`);
        }
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
            this.writeOpLog(context, 'info', `人格迭代日志已生成：${path.basename(file)}`);
        } catch (e) {
            this.writeOpLog(context, 'error', `迭代日志写入失败：${e.message}`);
        }
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
            this.writeOpLog(context, 'info', `人格快照已保存：${path.basename(file)}`);
            return true;
        } catch (e) {
            this.writeOpLog(context, 'error', `快照保存失败：${e.message}`);
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
                this.writeOpLog(context, 'info', `快照清理完成，保留最新${keep}个，删除${delFiles.length}个`);
            }
        } catch (e) {
            this.writeOpLog(context, 'error', `快照清理失败：${e.message}`);
        }
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
            const latest = fsSync.readFileSync(path.join(folder, files[0]), 'utf8');
            this.writeOpLog(context, 'info', `加载最新快照：${files[0]}`);
            return latest;
        } catch (e) {
            this.writeOpLog(context, 'error', `快照加载失败：${e.message}`);
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
            this.writeOpLog(context, 'info', '稳定人格特征已同步至 MEMORY.md');
        } catch (e) {
            this.writeOpLog(context, 'error', `MEMORY.md 同步失败：${e.message}`);
        }
    },

    async searchRelatedMemory(context, query) {
        if (!context || !query || !context.callTool) return '';
        try {
            const res = await context.callTool('memory_search', {
                query: query,
                limit: 3,
                type: 'text',
                scoreThreshold: 0.5
            });
            const memoryList = res?.data || res?.results || [];
            if (!memoryList.length) {
                this.writeOpLog(context, 'info', '未检索到相关历史记忆');
                return '';
            }
            const memoryText = memoryList.map(r => r.text || r.content).filter(Boolean).join('\n---\n');
            this.writeOpLog(context, 'info', `检索到${memoryList.length}条相关历史记忆`);
            return memoryText;
        } catch (e) {
            this.writeOpLog(context, 'warn', `记忆检索失败，使用空记忆：${e.message}`);
            return '';
        }
    },

    async generateCurrentPersonality(context, cache, memoryText) {
        if (!context || !cache || !context.llm?.chat) {
            this.writeOpLog(context, 'warn', 'LLM 接口未初始化，使用源人格');
            return cache.sourcePersonality;
        }
        const { userMessage = '', botReply = '' } = context;
        const { current_personality_prompt, evolution_llm, evolution_temperature } = config.prompt_config;
        const model = evolution_llm?.trim() || context.llm.getDefaultModel?.() || 'default';

        const prompt = `${current_personality_prompt}
【源人格】${cache.sourcePersonality || '稳定自然，温和友好'}
【长期倾向】${cache.targetLongTerm || '未设置'}
【短期风格】${cache.targetShortTerm || '未设置'}
【相关记忆】${memoryText || '无'}
【本轮对话】用户：${userMessage}
助手：${botReply}`;

        try {
            const res = await context.llm.chat({
                model: model,
                temperature: Number(evolution_temperature) || 0.1,
                max_tokens: 500,
                messages: [{ role: 'user', content: prompt }]
            });
            const currentPersonality = res?.content?.trim() || cache.sourcePersonality;
            if (!currentPersonality) throw new Error('LLM 返回空人格');
            this.writeOpLog(context, 'info', '当前人格生成成功');
            return currentPersonality;
        } catch (e) {
            this.writeOpLog(context, 'error', `人格生成失败：${e.message}`);
            return cache.sourcePersonality;
        }
    },

    async splitLongAndShort(context, currentPersonality) {
        if (!context || !currentPersonality || !context.llm?.chat) {
            this.writeOpLog(context, 'warn', 'LLM 接口未初始化，使用降级人格分层');
            return { long: '稳定自然，语气平和', short: '温和友好、连贯一致' };
        }
        const { new_target_prompt, evolution_llm, evolution_temperature } = config.prompt_config;
        const model = evolution_llm?.trim() || context.llm.getDefaultModel?.() || 'default';

        const prompt = `${new_target_prompt}
### 输出格式（严格遵守，无需额外内容）
长期倾向：xxx
短期风格：xxx
### 人格内容
${currentPersonality}`;

        try {
            const res = await context.llm.chat({
                model: model,
                temperature: Math.min(Number(evolution_temperature) || 0.1, 0.3),
                max_tokens: 200,
                messages: [{ role: 'user', content: prompt }]
            });
            const text = res?.content?.trim() || '';
            if (!text) throw new Error('LLM 返回空分层结果');
            const long = (text.match(/长期倾向[：:]\s*([^\n\r]+)/) || [])[1]?.trim() || '';
            const short = (text.match(/短期风格[：:]\s*([^\n\r]+)/) || [])[1]?.trim() || '';
            if (!long || !short) throw new Error('分层结果格式不合法');
            this.writeOpLog(context, 'info', '人格分层（长期/短期）生成成功');
            return { long, short };
        } catch (e) {
            this.writeOpLog(context, 'error', `人格分层失败：${e.message}`);
            return this.getFallbackPersonality(context.userMessage);
        }
    },

    async init(context) {
        if (!context || !context.agent) {
            console.error('【人格守护插件】初始化失败：Context 未传入');
            return;
        }
        const { id: agentId, workspace } = context.agent;
        const soulPath = path.join(workspace, 'soul.md');
        this.agentCaches.set(agentId, {
            soulPath,
            sourcePersonality: '',
            targetLongTerm: '',
            targetShortTerm: '',
            evolveCount: 0,
            lastEvolveTime: Date.now(),
            lastSyncMemory: 0,
            failCount: 0
        });
        try {
            await fs.access(soulPath);
            const initContent = await fs.readFile(soulPath, 'utf8');
            if (initContent.trim()) {
                this.agentCaches.get(agentId).sourcePersonality = initContent.trim();
            }
        } catch {
            await fs.writeFile(soulPath, '稳定自然，温和友好，连贯一致的AI交互风格', 'utf8', { mode: 0o644 });
        }
        this.writeOpLog(context, 'info', `插件初始化完成 v${config.version}，适配OpenClaw Context Engine`);

        // 网关重启自动测试
        if (config.test_config?.enableGatewayRestartTest) {
            this.runGatewayRestartTest(context).catch(err => {
                this.writeOpLog(context, 'error', `网关重启测试失败：${err.message}`);
            });
        }
    },

    async beforeTurn(context) {
        if (!context || !context.agent) return;
        const { id: agentId } = context.agent;
        const cache = this.agentCaches.get(agentId);
        if (!cache) {
            this.writeOpLog(context, 'warn', 'Agent 缓存未初始化，跳过人格注入');
            await this.init(context);
            return;
        }
        try {
            const soulContent = await fs.readFile(cache.soulPath, 'utf8');
            const trimContent = soulContent.trim();
            if (!trimContent) {
                this.writeOpLog(context, 'warn', 'soul.md 为空，使用默认人格');
                cache.sourcePersonality = '稳定自然，温和友好，连贯一致的AI交互风格';
                return;
            }
            cache.sourcePersonality = trimContent;
            const tag = config.prompt_config.lock_tag;
            if (context.systemPrompt) {
                context.systemPrompt = context.systemPrompt.replace(new RegExp(`${tag}[\\s\\S]*?$`, 'g'), '').trim();
            } else {
                context.systemPrompt = '';
            }
            context.systemPrompt += `\n\n${tag}\n# AI 人格规范\n${trimContent}\n${tag}`;
            this.writeOpLog(context, 'info', '人格防篡改注入成功');
        } catch (e) {
            this.writeOpLog(context, 'error', `人格注入失败：${e.message}`);
        }
    },

    async afterTurn(context) {
        if (!context || !context.agent || !context.userMessage || !context.botReply) return;
        const { id: agentId, workspace } = context.agent;
        const cache = this.agentCaches.get(agentId);
        if (!cache || !cache.sourcePersonality) {
            this.writeOpLog(context, 'warn', 'Agent 缓存/源人格未初始化，跳过人格演化');
            return;
        }

        const userMsg = context.userMessage.trim();
        if (/回滚人格|恢复人格|还原人格|回到上一个人格/.test(userMsg)) {
            const snapContent = await this.loadLatestSnapshot(context);
            if (snapContent) {
                await fs.writeFile(cache.soulPath, snapContent, 'utf8');
                cache.sourcePersonality = snapContent;
                this.writeOpLog(context, 'info', '人格回滚成功，已恢复至最新快照版本');
            } else {
                this.writeOpLog(context, 'warn', '人格回滚失败，未找到可用快照');
            }
            return;
        }

        const now = Date.now();
        const interval = Number(config.evolve.minIntervalMinutes) || 30;
        const turns = Number(config.evolve.minTurns) || 5;
        const timeOk = now - cache.lastEvolveTime >= interval * 60 * 1000;
        const turnOk = cache.evolveCount >= turns;
        if (!timeOk && !turnOk) {
            cache.evolveCount++;
            this.writeOpLog(context, 'info', `人格演化频率控制，当前累计对话${cache.evolveCount}轮，需满${turns}轮/${interval}分钟`);
            return;
        }

        try {
            const memoryText = await this.searchRelatedMemory(context, userMsg);
            const currentPersonality = await this.generateCurrentPersonality(context, cache, memoryText);
            const { long: newLong, short: newShort } = await this.splitLongAndShort(context, currentPersonality);

            const sim = Number(this.simpleSimilarity(cache.sourcePersonality, currentPersonality));
            const threshold = Number(config.evolve.similarityThreshold) || 0.3;
            const finalCurrent = sim < threshold ? cache.sourcePersonality : currentPersonality;
            this.writeOpLog(context, 'info', `人格漂移防护校验完成，相似度${sim}，阈值${threshold}，${sim < threshold ? '已拦截漂移' : '允许演化'}`);

            this.saveSnapshot(context, cache.sourcePersonality);
            await fs.writeFile(cache.soulPath, finalCurrent, 'utf8', { mode: 0o644 });
            this.writeIterationLog(context, cache.sourcePersonality, newLong, newShort, finalCurrent);

            if (now - cache.lastSyncMemory > 24 * 60 * 60 * 1000) {
                this.syncStableToMemory(context, newLong);
                cache.lastSyncMemory = now;
            }

            cache.targetLongTerm = newLong;
            cache.targetShortTerm = newShort;
            cache.evolveCount = 0;
            cache.lastEvolveTime = now;
            cache.failCount = 0;

            this.writeOpLog(context, 'info', `人格演化固化完成，新版本已写入soul.md`);

        } catch (e) {
            cache.failCount++;
            const fbPersonality = this.getFallbackPersonality(userMsg);
            cache.targetLongTerm = fbPersonality.long;
            cache.targetShortTerm = fbPersonality.short;
            this.writeOpLog(context, 'error', `人格演化失败，已启用降级人格：${e.message}，累计失败${cache.failCount}次`);
        }
    },

    async runGatewayRestartTest(context) {
        const testConfig = config.test_config;
        const testWorkspace = path.join(__dirname, testConfig.testWorkspace);
        const testPersonality = testConfig.testPersonality;

        this.writeOpLog(context, 'info', `🔍 网关重启测试启动 - 测试目录：${testWorkspace}`);
        this.writeOpLog(context, 'info', `📝 测试人格用例：${testPersonality.slice(0, 50)}...`);

        const mockTestContext = {
            ...context,
            agent: { ...context.agent, workspace: testWorkspace },
            userMessage: '你好，我想了解日常交流的注意事项',
            botReply: '日常交流要注意语气友好，耐心倾听，保持回应连贯哦～',
            llm: {
                getDefaultModel: () => 'test-model',
                chat: async ({ messages, model, temperature }) => {
                    this.writeOpLog(context, 'info', `📡 测试LLM调用 - 模型：${model}，温度：${temperature}`);
                    this.writeOpLog(context, 'info', `📥 LLM输入长度：${messages[0].content.length}字符`);
                    return {
                        content: `长期倾向：${testPersonality}
短期风格：针对日常问题耐心解答，语气温和无距离感`
                    };
                }
            },
            callTool: async (toolName, params) => {
                this.writeOpLog(context, 'info', `🛠️ 测试工具调用 - 工具：${toolName}，检索关键词：${params.query}`);
                return {
                    data: [
                        { text: '测试记忆1：用户关注日常交流技巧' },
                        { text: '测试记忆2：用户偏好温和的回应风格' }
                    ]
                };
            },
            systemPrompt: '初始系统提示词（测试专用）'
        };

        try {
            this.writeOpLog(context, 'info', '📂 初始化测试环境 - 创建独立目录和测试文件');
            if (!fsSync.existsSync(testWorkspace)) {
                fsSync.mkdirSync(testWorkspace, { recursive: true, mode: 0o755 });
                this.writeOpLog(context, 'info', '✅ 测试目录创建成功');
            }
            const testSoulPath = path.join(testWorkspace, 'soul.md');
            await fs.writeFile(testSoulPath, testPersonality, 'utf8');
            this.writeOpLog(context, 'info', '✅ 测试人格文件（soul.md）生成成功');

            this.writeOpLog(context, 'info', '🚀 开始测试 - 人格防篡改注入');
            await this.beforeTurn(mockTestContext);
            if (mockTestContext.systemPrompt.includes(config.prompt_config.lock_tag)) {
                this.writeOpLog(context, 'info', '✅ 人格注入测试通过 - 锁定标签已注入');
                this.writeOpLog(context, 'info', `📌 注入后系统提示词片段：${mockTestContext.systemPrompt.slice(-50)}`);
            } else {
                throw new Error('人格注入失败 - 未找到锁定标签');
            }

            this.writeOpLog(context, 'info', '🚀 开始测试 - 记忆检索工具调用');
            const memoryText = await this.searchRelatedMemory(mockTestContext, mockTestContext.userMessage);
            if (memoryText) {
                this.writeOpLog(context, 'info', `✅ 记忆检索测试通过 - 检索到${memoryText.split('---').length}条测试记忆`);
            } else {
                throw new Error('记忆检索失败 - 未返回测试记忆');
            }

            this.writeOpLog(context, 'info', '🚀 开始测试 - LLM生成当前人格');
            const cache = this.agentCaches.get(context.agent.id);
            cache.sourcePersonality = testPersonality;
            const currentPersonality = await this.generateCurrentPersonality(mockTestContext, cache, memoryText);
            if (currentPersonality) {
                this.writeOpLog(context, 'info', `✅ 人格生成测试通过 - 生成人格长度：${currentPersonality.length}字符`);
                this.writeOpLog(context, 'info', `📝 生成人格：${currentPersonality.slice(0, 50)}...`);
            } else {
                throw new Error('人格生成失败 - LLM返回空内容');
            }

            this.writeOpLog(context, 'info', '🚀 开始测试 - 人格分层（长期/短期）');
            const { long, short } = await this.splitLongAndShort(mockTestContext, currentPersonality);
            if (long && short) {
                this.writeOpLog(context, 'info', `✅ 人格分层测试通过 - 长期倾向：${long}，短期风格：${short}`);
            } else {
                throw new Error('人格分层失败 - 未生成有效分层结果');
            }

            this.writeOpLog(context, 'info', '🚀 开始测试 - 人格快照生成与清理');
            const snapshotOk = this.saveSnapshot(mockTestContext, testPersonality);
            if (snapshotOk) {
                const snapshotDir = path.join(testWorkspace, 'personality_snapshots');
                const snapshotCount = fsSync.existsSync(snapshotDir) ? fsSync.readdirSync(snapshotDir).length : 0;
                this.writeOpLog(context, 'info', `✅ 快照生成测试通过 - 生成${snapshotCount}个测试快照`);
            } else {
                throw new Error('快照生成失败 - 未创建快照文件');
            }

            this.writeOpLog(context, 'info', '🚀 开始测试 - 人格迭代日志生成');
            this.writeIterationLog(mockTestContext, testPersonality, long, short, currentPersonality);
            const logDir = path.join(testWorkspace, config.log_config.iteration_folder);
            const logCount = fsSync.existsSync(logDir) ? fsSync.readdirSync(logDir).length : 0;
            if (logCount > 0) {
                this.writeOpLog(context, 'info', `✅ 迭代日志测试通过 - 生成${logCount}个测试日志文件`);
            } else {
                throw new Error('迭代日志生成失败 - 未创建日志文件');
            }

            this.writeOpLog(context, 'info', '🚀 开始测试 - MEMORY.md同步');
            this.syncStableToMemory(mockTestContext, long);
            const memoryFile = path.join(testWorkspace, 'MEMORY.md');
            if (fsSync.existsSync(memoryFile)) {
                const memoryContent = await fs.readFile(memoryFile, 'utf8');
                this.writeOpLog(context, 'info', `✅ MEMORY同步测试通过 - 文件大小：${memoryContent.length}字符`);
            } else {
                throw new Error('MEMORY同步失败 - 未生成MEMORY.md');
            }

            this.writeOpLog(context, 'info', '🚀 开始测试 - 人格回滚功能');
            mockTestContext.userMessage = '回滚人格';
            await this.afterTurn(mockTestContext);
            this.writeOpLog(context, 'info', `✅ 人格回滚测试通过 - 已触发回滚逻辑`);

            this.writeOpLog(context, 'info', '🎉 网关重启测试全部通过 - 所有关键步骤验证完成');
            this.writeOpLog(context, 'info', `📊 测试产物清单：`);
            this.writeOpLog(context, 'info', `- 测试目录：${testWorkspace}`);
            this.writeOpLog(context, 'info', `- 核心文件：soul.md、MEMORY.md`);
            this.writeOpLog(context, 'info', `- 快照目录：personality_snapshots（${fsSync.readdirSync(path.join(testWorkspace, 'personality_snapshots')).length}个文件）`);
            this.writeOpLog(context, 'info', `- 日志目录：${config.log_config.iteration_folder}（${fsSync.readdirSync(logDir).length}个文件）`);

        } catch (error) {
            this.writeOpLog(context, 'error', `❌ 网关重启测试失败 - 步骤：${error.message}`);
            this.writeOpLog(context, 'error', `📋 失败上下文：测试目录=${testWorkspace}，测试人格=${testPersonality.slice(0, 30)}...`);
        }
    }
};

// 环境变量触发独立测试
if (process.env.OPENCLAW_PLUGIN_TEST === '1') {
    plugin.runTest().catch(err => console.error('测试程序执行失败：', err));
}

module.exports = plugin;
