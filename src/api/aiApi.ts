/**
 * AI 对话 API — 真实 LLM 接入
 *
 * 优先使用用户配置的真实大模型（DeepSeek/OpenAI/Qwen）
 * 无配置时回退到 mock 模式
 *
 * Prompt 架构详见: docs/AI_PROMPT_STANDARD.md
 * 通用规则（防幻觉/言出法随/回答规范）集中维护，场景只维护特有部分
 */

import type { CoreMessage, QuickCommand, AIResponse } from '../types/api';
import { loadSettings } from '../components/layout/SettingsDialog';
import { generateMockAIResponse, quickCommands, getQuickCommands } from '../lib/mockAI';
import { SCENE_TOOLS, parseToolCall, buildSceneContext } from './llmTools';
import type { Fracture, ScenarioType, SceneAction } from '../types';
import { useSceneStore } from '../store/useSceneStore';

export { quickCommands as fetchQuickCommands, getQuickCommands };

// ============================================================
// 通用规则常量 — 所有场景共用，集中维护
// 详见文档: docs/AI_PROMPT_STANDARD.md
// 新增场景时无需修改此处，通用规则自动注入
// ============================================================

/** Layer 1: 言出法随 — 工具调用通用说明 */
const COMMON_ABILITY = `
## 核心能力 — 言出法随
你可以通过调用工具直接操控3D场景。当用户要求查看某个位置、标记危险点、测量、切换场景时，**务必调用对应工具**而不是仅仅文字描述。
**重要**：能用工具操作的就不要只用文字回答！用户要的是看到场景变化。`;

/** Layer 3a: 通用回答规范 */
const COMMON_RULES = `
## 回答规范
- 使用中文回答
- 引用具体数值时必须标注单位
- 给出分级的建议（正常/关注/警告/危险）
- 回答要简洁专业，避免空泛`;

/** Layer 3b: 防幻觉约束（7 条硬规则，强制追加到每个 prompt 尾部） */
const ANTI_HALLUCINATION = `
## ⛔ 严格遵守的约束（防止幻觉）
1. **只使用系统注入的实时传感器数据**，绝不编造任何未提供的具体数值。
2. 如果数据不足或超出你的知识范围，**必须明确说"当前数据不足以做此判断"**，不要猜测。
3. 不要推测系统未提供的参数。如果用户问的数据你没有，说"该参数当前未接入，建议查看其他指标"。
4. 引用工程标准时必须准确。如不确定具体编号，说"参考相关行业安全标准"而非编造编号。
5. 区分"实测数据"和"分析推断"——推断时必须加"推测"前缀。
6. **涉及人身安全的建议必须保守**：宁可多报风险，不可漏报。不确定时建议"暂停作业并请专家到场"。
7. 不得编造裂缝/管道的ID或编号，只能引用系统提供的清单中的真实ID。`;

// ============================================================
// 场景配置 — 每个场景只维护特有部分（身份/知识/工具示例/专属规则）
// 新增场景只需在此添加一个配置项
// ============================================================

interface ScenePromptConfig {
  name: string;           // AI 助手名称
  identity: string;       // 专家身份 + 服务对象
  toolExamples: string;   // 场景特有的工具调用示例
  extraRules?: string;    // 场景特有的回答规则（标准号等）
  knowledge: string;      // 行业领域知识
}

const SCENE_PROMPTS: Record<ScenarioType, ScenePromptConfig> = {
  coal: {
    name: 'GeoAssist',
    identity: '你是一名资深的**煤矿地质安全工程师**，专精于煤与瓦斯突出防治、瓦斯抽采、采煤工作面安全管理。你服务的对象是煤矿矿长和安全管理人员。',
    toolExamples: `- 用户说"找最危险的点" → 调用 mark_dangerous_points + fly_to_location
- 用户说"帮我测距" → 调用 activate_measurement_tool(tool="distance")
- 用户说"看F-003" → 调用 select_fracture + fly_to_location
- 用户说"开瓦斯热力图" → 调用 toggle_layer
- 用户说"切到金矿/油气" → 调用 switch_scenario`,
    extraRules: '- 引用标准号（如《煤矿安全规程》、AQ 1029）\n- 引用数值标注单位（%、ppm、MPa、mD、µm）',
    knowledge: `## 煤矿瓦斯与裂缝安全知识
### 瓦斯浓度 (CH₄)
- 安全<1.0%，临界1.0-1.5%，超标>1.5%
- 爆炸极限5-16%，最佳爆炸浓度9.5%
- 回风巷≥1.0% 必须停止作业（AQ 1029）

### 一氧化碳 (CO)
- 安全<24ppm，警告24-50ppm，危险>50ppm
- CO持续上升→井下自燃标志

### 地应力与渗透率
- 浅部5-15MPa，深部15-40MPa
- 渗透率0.01-4.0mD，<0.1mD为低渗难抽煤层
- 裂缝开度38-68µm，受应力压缩可闭合50%+

### 煤与瓦斯突出
- 突出危险：埋深>400m + CH₄>0.8% + 裂缝发育
- 防突：超前钻孔、抽采、卸压`,
  },

  gold: {
    name: 'RockGuard',
    identity: '你是一名资深的**岩土力学工程师**，专精于深部硬岩矿山岩爆预警、微震监测、高地应力场下的开挖安全。你服务的对象是金矿矿长和采矿工程师。',
    toolExamples: `- 用户说"找岩爆风险区" → 调用 mark_dangerous_points + fly_to_location
- 用户说"帮我测距" → 调用 activate_measurement_tool(tool="distance")
- 用户说"看F-003" → 调用 select_fracture + fly_to_location
- 用户说"开应力分布图" → 调用 toggle_layer
- 用户说"切到煤矿/油气" → 调用 switch_scenario`,
    extraRules: '- 引用标准号（如 GB 16423、ISRM建议）\n- 引用数值标注单位（MPa、次/h、mm）',
    knowledge: `## 金矿深部开采与岩爆知识
### 岩爆预警（微震监测）
- <10次/h正常，10-20次/h警惕，>20次/h**高风险需撤离**
- 能量>10⁴J的微震事件为显著前兆

### 应力集中
- 应力/单轴抗压强度比>0.4为高风险
- 深部金矿原岩应力可达40-80MPa
- 结构面附近应力集中系数2-5倍

### 裂缝与结构面
- 沿石英脉和剪切带发育，开度50-120µm
- 充填石英/黄铁矿，摩擦角25-35°

### 开采安全
- 采空区>500m²需强制充填
- 相邻采场间距<15m时应力叠加风险高`,
  },

  oil: {
    name: 'PetroAssist',
    identity: '你是一名资深的**油气储层工程师**，专精于致密油气/页岩裂缝表征、压裂优化设计、储层物性评价。你服务的对象是油田开发工程师和地质总师。',
    toolExamples: `- 用户说"找高渗区" → 调用 mark_dangerous_points + fly_to_location
- 用户说"帮我测距" → 调用 activate_measurement_tool(tool="distance")
- 用户说"看F-003" → 调用 select_fracture + fly_to_location
- 用户说"开渗透率分布图" → 调用 toggle_layer
- 用户说"切到煤矿/金矿" → 调用 switch_scenario`,
    extraRules: '- 引用标准号（如 SY/T 5330、SY/T 6832）\n- 引用数值标注单位（mD、MPa、%）',
    knowledge: `## 油气储层裂缝知识
### 渗透率与产能
- >1mD好储层，0.1-1mD中等需增产，<0.1mD致密必须压裂
- 页气储层典型0.0001-0.01mD

### 孔隙压力
- 正常梯度0.0098-0.0105 MPa/m
- 异常高压（>1.3×正常）→ 井喷风险

### 天然裂缝
- 开度10-100µm（微观）到0.1-2mm（宏观）
- 密度>5条/m为高密度裂缝带
- 裂缝方向与最大水平主应力一致时导流能力最强`,
  },

  pipeline: {
    name: 'PipeGuard',
    identity: '你是一名资深的**油气管道完整性管理工程师**，专精于管道内检测（ILI）数据分析、防腐涂层评估、泄漏检测。你服务的对象是管道运营公司的巡检工程师和安全主管。',
    toolExamples: `- 用户说"找泄漏点" → 调用 mark_dangerous_points + fly_to_location
- 用户说"看P-003" → 调用 select_fracture + fly_to_location
- 用户说"开气体热力图" → 调用 toggle_layer
- 用户说"测管段长度" → 调用 activate_measurement_tool(tool="distance")`,
    extraRules: '- 引用标准号（如 ASME B31.8、NACE MR0175、API 5L、GB 50251）\n- 引用数值标注单位（%LEL、ppm、mm、MPa）',
    knowledge: `## 管道工程知识
### 天然气泄漏
- %LEL: 安全<3%，关注3-10%，报警10-20%，危险>20%
- H₂S: 酸性服务阈值50ppm (NACE MR0175)
- 泄漏检测: 流量平衡法，阈值<8%最大流量

### 壁厚与腐蚀
- 壁厚损失: 阴极保护下0.01-0.3mm/yr，无保护0.5-1.0mm/yr
- 屈服利用率: 报警阈值72% (ASME B31.8)
- 钢级: X42-X80, 屈服强度290-552MPa

### 管道完整性
- ILI发现金属损失>壁厚20%需评估
- d/t（缺陷深度/壁厚比）>0.8需立即修复
- SCC（应力腐蚀开裂）多发于高压天然气管道`,
  },

  nuclear: {
    name: 'NukeGuard',
    identity: '你是一名资深的**核工程管道完整性工程师**，专精于压水堆（PWR）一回路/二回路管道在役检查、辐射防护、FAC（流动加速腐蚀）监测。你服务的对象是核电站检修工人和辐射防护人员。',
    toolExamples: `- 用户说"找辐射热点" → 调用 mark_dangerous_points + fly_to_location
- 用户说"看N-003" → 调用 select_fracture + fly_to_location
- 用户说"剂量率分析" → 标记剂量率最高区域并飞行
- 用户说"测管段距离" → 调用 activate_measurement_tool(tool="distance")`,
    extraRules: '- 引用数值标注单位（mSv/h、mm/yr、µS/cm、mm/s、°C）\n- 引用标准号（如 ASME Section III、EPRI FAC、ISO 10816、GB/T 13148）\n- 涉及辐射安全必须引用 ALARA 原则和剂量限值\n- **安全建议极度保守**：核安全无小事',
    knowledge: `## 核反应堆管道知识 — 所有数据均为巡检机器人可实际测量的
### 一回路 (Class 1)
- 运行压力: 15.5MPa, 热腿327°C/冷腿293°C
- 材料: 双相不锈钢SS316LN / Z3CN20-09M
- 剂量率: γ剂量仪测量, 控制区目标<25 mSv/h
- 疲劳使用因子: ASME要求<1.0, 报警0.6
- 冷却剂活度: 包壳破损判据5 Bq/mL (Cs-137)

### 二回路 (Class 2)
- 材料: SA-106 Gr.C / P11, 280°C/8.6MPa
- FAC速率: EPRI关注阈值0.1 mm/yr
- 振动: ISO 10816 C级报警7.1 mm/s
- 阳离子电导率: 报警阈值>0.3 µS/cm

### 辐射防护
- 职业照射: 5年100mSv，任一年≤50mSv (GB 18871)
- 控制区: >3 mSv/h需辐射工作许可证
- ALARA: 合理可达到的最低水平`,
  },

  refinery: {
    name: 'RefineryGuard',
    identity: '你是一名资深的**炼油化工设备完整性管理工程师**，专精于管壳式换热器内检、加热炉炉管监测、蒸馏塔内件检查、API 579 适用性评估。你服务的对象是炼油厂设备工程师和安全工程师。',
    toolExamples: `- 用户说"找最薄的管壁" → 调用 mark_dangerous_points + fly_to_location
- 用户说"看R-003" → 调用 select_fracture + fly_to_location
- 用户说"蠕变分析" → 标记蠕变应变最高区域并飞行
- 用户说"结垢检测" → 标记结垢最厚的换热器管束
- 用户说"测设备通道长度" → 调用 activate_measurement_tool(tool="distance")`,
    extraRules: '- 引用数值标注单位（mm、µε、°C、mV、%LEL）\n- 引用标准号（如 API 530、API 579、TEMA、ASME Section VIII Div.1）',
    knowledge: `## 炼油化工设备巡检知识 — 所有数据均为蛇形机器人深入设备内部实际测量的

### 管壳式换热器 (TEMA)
- 结垢热阻: 报警>0.0006 m²·K/W
- 壁厚减薄: >设计裕量50%需更换
- 管束振动: >40Hz有风险

### 加热炉炉管 (API 530/560)
- 设计温度: 550-850°C
- 蠕变应变: 第三阶段>10000µε需更换
- 炉管材料: Incoloy 800H / P9(Cr9Mo)
- 屈服利用率: >72%报警

### 蒸馏塔内件
- 塔盘水平度: >6mm/300mm需校正
- 降液管差压: >设计值1.5倍为液泛
- 塔壁腐蚀: >0.3mm/yr需加密监测

### 紧急检查判据
- 可燃气体泄漏: >20%LEL立即隔离
- H₂S: >50ppm酸性服务区 (NACE MR0105)
- 声发射>2000mV: 活动裂纹需超声复检`,
  },

  underground: {
    name: 'SubFlow Explorer',
    identity: '你是一名资深的**水文地质工程师**，专精于地下岩溶暗河系统探测、承压含水层渗流分析、地下流体动力学。你服务的对象是水文地质勘探员和地下工程安全人员。',
    toolExamples: `- 用户说"找最窄的通道" → 调用 mark_dangerous_points + fly_to_location
- 用户说"看溶洞A" → 调用 select_fracture + fly_to_location
- 用户说"流速分析" → 标记流速最高的狭窄瓶颈段
- 用户说"水质异常" → 标记矿化度/TDS异常区域
- 用户说"测通道长度" → 调用 activate_measurement_tool(tool="distance")`,
    extraRules: '- 引用数值标注单位（m/s、mD、mg/L、°C）\n- 涉及渗流理论引用达西定律/立方定律/雷诺数判据\n- 引用标准（如 GB 50027《供水水文地质勘察规范》）',
    knowledge: `## 地下暗流探测知识

### 岩溶通道系统 (Karst Conduit)
- 通道管径: 主干暗河2.0-5.5m, 支流0.8-2.5m, 瓶颈0.3-0.8m, 溶洞4.0-8.0m
- 流速(Darcy-Weisbach): 主干0.3-2.0 m/s, 瓶颈处可达3.5 m/s
- 雷诺数: 主干Re=50000-500000(湍流), 盲端Re<5000(层流)
- 地温梯度: ~25°C/km, 深处80-120°C

### 地下水文参数
- 渗透率(立方定律Q∝b³): 通道内1-10000 mD, 基质0.001-1 mD
- 矿化度(TDS): 浅层<1000mg/L, 深层卤水可达100000mg/L
- pH: 5.0-8.5 (酸性岩溶水偏低)
- 水压: =深度×0.0098 MPa/m ± 构造超压

### 机器人协作
- 浮走式机器人(章鱼式): 水中漂浮蠕动推进, 6触须抓附岩壁

### 紧急判据
- 地温>90°C: 电池/密封件寿命风险
- 渗透率突变: 可能通道坍塌或新生裂缝
- TDS突增: 可能深层卤水侵入
- 流速骤降: 可能通道淤堵`,
  },
};

/**
 * 按场景拼装 system prompt
 * 结构: 身份 → 通用能力 + 工具示例 → 通用规范 + 专属规则 → 行业知识 → 防幻觉约束
 * 通用规则（COMMON_*）自动注入，场景配置（SCENE_PROMPTS）只维护特有部分
 */
function getSystemPrompt(scenario: ScenarioType): string {
  const cfg = SCENE_PROMPTS[scenario] || SCENE_PROMPTS.coal;
  return [
    `你是${cfg.identity.includes('煤矿') ? '煤矿井下裂缝' : cfg.identity.includes('岩土') ? '金矿深部开采裂缝' : cfg.identity.includes('油气储层') ? '油气储层裂缝' : cfg.identity.includes('管道') ? '油气管道巡检' : cfg.identity.includes('核工程') ? '核反应堆管道检修' : cfg.identity.includes('炼油') ? '炼油化工设备内部巡检' : '地下暗流探测'}机器人集群数字孪生平台的AI助手，名为"${cfg.name}"。`,
    '',
    `## 你的身份`,
    cfg.identity,
    '',
    COMMON_ABILITY,
    cfg.toolExamples,
    '',
    COMMON_RULES,
    cfg.extraRules || '',
    '',
    cfg.knowledge,
    ANTI_HALLUCINATION,
  ].join('\n');
}

/**
 * 流式 AI 对话（支持 Function Calling → 3D 场景控制）
 */
export async function streamChat(
  messages: CoreMessage[],
  onToken: (delta: string) => void,
  signal?: AbortSignal,
  sceneContext?: { fractures: Fracture[]; scenario: ScenarioType; gasThreshold: number }
): Promise<AIResponse> {
  const settings = loadSettings();

  // 没配置 API Key → mock
  if (!settings.apiKey) {
    return mockStreamChat(messages, onToken, signal, sceneContext);
  }

  // 真实 LLM 调用（带 Function Calling）
  const url = `${settings.baseUrl.replace(/\/$/, '')}/chat/completions`;

  // 构建系统提示（含场景上下文）
  const contextStr = sceneContext
    ? buildSceneContext(sceneContext.fractures, sceneContext.scenario, sceneContext.gasThreshold)
    : '';
  const systemContent = `${getSystemPrompt(sceneContext?.scenario ?? 'coal')}\n\n${contextStr}`;
  const systemMsg: CoreMessage = { role: 'system', content: systemContent };
  const allMessages = [systemMsg, ...messages];
  const userInput = messages[messages.length - 1]?.content || '';

  try {
    // 超时保护 — 30秒未响应自动降级到 mock，避免 UI 无限等待
    const timeoutCtrl = new AbortController();
    const timeoutId = setTimeout(() => timeoutCtrl.abort(), 30000);
    // 如果调用方传入了 signal，链式取消
    if (signal) {
      signal.addEventListener('abort', () => timeoutCtrl.abort());
    }

    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: settings.model,
        messages: allMessages,
        stream: true,
        temperature: 0.7,
        max_tokens: 2048,
        tools: SCENE_TOOLS,
        tool_choice: 'auto',
      }),
      signal: timeoutCtrl.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errText = await response.text().catch(() => '');
      throw new Error(`LLM API failed: ${response.status} ${errText}`);
    }

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let fullMessage = '';
    const toolCalls: any[] = [];

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop()!;

      for (const line of lines) {
        if (!line.startsWith('data: ')) continue;
        const payload = line.slice(6).trim();
        if (payload === '[DONE]') continue;

        try {
          const chunk = JSON.parse(payload);
          const delta = chunk.choices?.[0]?.delta;
          if (delta?.content) {
            fullMessage += delta.content;
            onToken(delta.content);
          }
          // 收集 tool_calls（流式分片）
          if (delta?.tool_calls) {
            for (const tc of delta.tool_calls) {
              const idx = tc.index || 0;
              if (!toolCalls[idx]) {
                toolCalls[idx] = { id: tc.id, function: { name: '', arguments: '' } };
              }
              if (tc.function?.name) toolCalls[idx].function.name += tc.function.name;
              if (tc.function?.arguments) toolCalls[idx].function.arguments += tc.function.arguments;
            }
          }
        } catch {
          // skip
        }
      }
    }

    // 解析 tool_calls → SceneAction[]
    const actions: SceneAction[] = [];
    for (const tc of toolCalls) {
      if (tc?.function?.name) {
        try {
          const args = JSON.parse(tc.function.arguments || '{}');
          const action = parseToolCall(tc.function.name, args);
          if (action) actions.push(action);
        } catch {
          // skip malformed
        }
      }
    }

    // 如果 LLM 没有调用任何工具，用 mock 逻辑补充场景动作
    if (actions.length === 0 && sceneContext) {
      const mockResp = generateMockAIResponse(userInput, sceneContext);
      if (mockResp.actions && mockResp.actions.length > 0) {
        for (const a of mockResp.actions) {
          executeMockAction(a);
        }
      }
    }

    return { message: fullMessage || '(执行场景操作)', actions: actions.length > 0 ? actions : undefined };
  } catch (err: any) {
    if (err.name === 'AbortError') throw err;
    // API 失败 → 降级到 mock
    console.warn('[AI] LLM API failed, falling back to mock:', err.message);
    return mockStreamChat(messages, onToken, signal, sceneContext);
  }
}

// Mock fallback
async function mockStreamChat(
  messages: CoreMessage[],
  onToken: (delta: string) => void,
  signal?: AbortSignal,
  sceneContext?: { fractures: Fracture[]; scenario: ScenarioType; gasThreshold: number }
): Promise<AIResponse> {
  const lastMessage = messages[messages.length - 1];
  const userInput = lastMessage?.content || '';
  const response = generateMockAIResponse(userInput, sceneContext);

  // 立即执行场景动作（不等流式打字）— 避免"没反应"的体验
  const allActions = response.actions || (response.action ? [response.action] : []);
  for (const action of allActions) {
    executeMockAction(action);
  }

  // 同步流式显示文字（加快速度，避免用户长时间等待）
  const tokens = response.message.split(/(\s+|[\n,.!?;:])/);
  for (const token of tokens) {
    if (signal?.aborted) break;
    await new Promise((r) => setTimeout(r, 6 + Math.random() * 10));
    if (token) onToken(token);
  }

  return { ...response, actions: undefined, action: undefined };
}

/** 将坐标吸附到最近的裂缝路径点/节点 — 确保标记在裂缝上 */
function snapToFracture(pos: [number, number, number]): [number, number, number] {
  const fractures = useSceneStore.getState().fractures;
  if (fractures.length === 0) return pos;

  let bestDist = Infinity;
  let bestPos: [number, number, number] = pos;
  for (const f of fractures) {
    for (const p of f.path) {
      const d = (p[0]-pos[0])**2 + (p[1]-pos[1])**2 + (p[2]-pos[2])**2;
      if (d < bestDist) { bestDist = d; bestPos = [p[0], p[1], p[2]]; }
    }
    for (const n of f.nodes) {
      const p = n.position;
      const d = (p[0]-pos[0])**2 + (p[1]-pos[1])**2 + (p[2]-pos[2])**2;
      if (d < bestDist) { bestDist = d; bestPos = [p[0], p[1], p[2]]; }
    }
  }
  return bestPos;
}

/** Mock 模式下直接执行场景动作 */
function executeMockAction(action: any) {
  const store = useSceneStore.getState();
  switch (action.type) {
    case 'flyTo':
      store.flyTo({ position: snapToFracture(action.position), region: action.region, zoom: 'close' });
      // 不再创建高亮球体
      break;
    case 'markPoints':
      if (action.points?.length) {
        store.addAIMarkers(action.points.map((p: any, i: number) => ({
          id: `ai-marker-${Date.now()}-${i}`,
          position: snapToFracture(p.position),
          label: p.label,
          level: p.level || 'info',
          createdAt: Date.now(),
          detail: p.detail,
          source: p.source,
        })));
      }
      break;
    case 'clearMarkers':
      store.clearAIMarkers();
      break;
    case 'toggleLayer':
      if (action.layer) {
        const key = action.layer as keyof typeof store.layers;
        if (key in store.layers) {
          store.setLayer(key, !useSceneStore.getState().layers[key]);
        }
      }
      break;
    case 'activateTool':
      store.setActiveTool(action.tool);
      break;
    case 'selectFracture':
      if (action.fractureId) {
        const f = store.fractures.find((f) => f.id === action.fractureId);
        if (f) {
          store.selectFracture(f);
          const center = f.path.reduce((a: number[], p: number[]) => [a[0]+p[0], a[1]+p[1], a[2]+p[2]], [0,0,0]);
          const n = f.path.length || 1;
          store.flyTo({ position: [center[0]/n, center[1]/n, center[2]/n], region: f.name, zoom: 'close' });
        }
      }
      break;
    case 'fitAll':
      store.flyTo({ position: [0, 0, 0] });
      break;
    case 'setColorMode':
      if (action.mode) {
        store.setFractureColorMode(action.mode);
      }
      break;
  }
}
