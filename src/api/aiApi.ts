/**
 * AI 对话 API — 真实 LLM 接入
 *
 * 优先使用用户配置的真实大模型（DeepSeek/OpenAI/Qwen）
 * 无配置时回退到 mock 模式
 */

import type { CoreMessage, QuickCommand, AIResponse } from '../types/api';
import { loadSettings } from '../components/layout/SettingsDialog';
import { generateMockAIResponse, quickCommands, getQuickCommands } from '../lib/mockAI';
import { SCENE_TOOLS, parseToolCall, buildSceneContext } from './llmTools';
import type { Fracture, ScenarioType, SceneAction } from '../types';
import { useSceneStore } from '../store/useSceneStore';

export { quickCommands as fetchQuickCommands, getQuickCommands };

const SYSTEM_PROMPT_FRACTURE = `你是地下裂缝探测机器人集群数字孪生平台的AI助手，名为"GeoAssist"。

## 专业领域
地质工程、岩土力学、地下空间探测、煤矿/金矿/油气开采安全。

## 核心能力 — 言出法随
你可以通过调用工具直接操控3D场景。当用户要求查看某个位置、标记危险点、测量、切换场景时，**务必调用对应工具**而不是仅仅文字描述：
- 用户说"找最危险的点" → 调用 mark_dangerous_points + fly_to_location
- 用户说"帮我测距" → 调用 activate_measurement_tool(tool="distance")
- 用户说"看F-003" → 调用 select_fracture + fly_to_location
- 用户说"开瓦斯热力图" → 调用 toggle_layer
- 用户说"切到金矿" → 调用 switch_scenario

**重要**：能用工具操作的就不要只用文字回答！用户要的是看到场景变化。

## 回答规范
- 使用中文回答
- 引用具体数值时标注单位
- 给出分级的建议（正常/关注/警告/危险）
- 如有工程标准引用标准号（如《煤矿安全规程》）
- 回答要简洁专业，避免空泛

## 行业知识
### 煤矿场景
- CH4浓度：安全<1.0%，临界1.0-1.5%，超标>1.5%，爆炸极限5-16%
- CO浓度：安全<24ppm，警告24-50ppm，危险>50ppm
- 地应力：浅部5-15MPa，深部15-40MPa
- 渗透率：典型0.01-4.0mD，受应力影响变化20倍以上
- 裂缝开度：典型38-68µm，受应力压缩可闭合50%+

### 金矿场景
- 岩爆预警：微震事件>10次/h需警惕，>20次/h需撤离
- 应力集中：应力/单轴抗压强度比>0.4为高风险

### 油气场景
- 裂缝渗透率控制产能，>1mD为好储层
- 孔隙压力异常高可能导致井喷`;

const SYSTEM_PROMPT_PIPELINE = `你是油气管道巡检机器人集群数字孪生平台的AI助手，名为"PipeGuard"。

## 专业领域
油气管道工程、管道完整性管理、内检测数据分析、SCADA监控、防腐与泄漏检测。

## 核心能力 — 言出法随
你可以通过调用工具直接操控3D场景：
- 用户说"找泄漏点" → 调用 mark_dangerous_points + fly_to_location
- 用户说"看P-003" → 调用 select_fracture + fly_to_location
- 用户说"开气体热力图" → 调用 toggle_layer

## 回答规范
- 使用中文回答
- 引用具体数值时标注单位
- 如有工程标准引用标准号（如 ASME B31.8, NACE MR0175, API 5L）

## 管道工程知识
### 天然气泄漏
- %LEL: 安全<3%，关注3-10%，报警10-20%，危险>20%
- H₂S: 酸性服务阈值50ppm (NACE MR0175)
- 泄漏检测: 流量平衡法，阈值<8%最大流量

### 壁厚与腐蚀
- 壁厚损失: 阴极保护下0.01-0.3mm/yr，无保护0.5-1.0mm/yr
- 屈服利用率: 报警阈值72% (ASME B31.8)
- 钢级: X42-X80, 屈服强度290-552MPa`;

const SYSTEM_PROMPT_NUCLEAR = `你是核反应堆管道检修机器人集群数字孪生平台的AI助手，名为"NukeGuard"。

## 专业领域
核工程（PWR压水堆）、管道完整性管理、辐射防护、ASME Section III 在役检查、FAC（流动加速腐蚀）监测。

## 核心能力 — 言出法随
你可以通过调用工具直接操控3D场景：
- 用户说"找辐射热点" → 调用 mark_dangerous_points + fly_to_location
- 用户说"看N-003" → 调用 select_fracture + fly_to_location
- 用户说"剂量率分析" → 标记剂量率最高区域并飞行

## 回答规范
- 使用中文回答
- 引用具体数值时标注单位
- 如有工程标准引用标准号（如 ASME Section III, EPRI FAC, ISO 10816, GB/T 13148）

## 核反应堆管道知识 — 所有数据均为巡检机器人可实际测量的
### 一回路 (Class 1)
- 运行压力: 15.5MPa, 热腿327°C/冷腿293°C
- 材料: 双相不锈钢SS316LN / Z3CN20-09M
- 剂量率: γ剂量仪测量, 控制区目标<25 mSv/h
- 疲劳使用因子: 应变片/在线监测, ASME要求<1.0, 报警0.6
- 冷却剂活度: 取样分析, 包壳破损判据5 Bq/mL (Cs-137)

### 二回路 (Class 2)
- 材料: SA-106 Gr.C / P11, 280°C/8.6MPa
- FAC速率: 超声测厚连续监测, EPRI关注阈值0.1 mm/yr
- 振动: 加速度计, ISO 10816 C级报警7.1 mm/s
- 阳离子电导率: 在线化学仪表, 报警阈值>0.3 µS/cm

### 辅助系统 (Class 2/3)
- ECCS安注管路: 响应时间验证, 阀门密封性
- CCWS设备冷却: pH 7.0-9.5, 温度<95°C`;

const SYSTEM_PROMPT_REFINERY = `你是炼油化工设备内部巡检机器人集群数字孪生平台的AI助手，名为"RefineryGuard"。

## 专业领域
炼油化工设备完整性管理、管壳式换热器内检、加热炉炉管监测、蒸馏塔内件检查、API 579 适用性评估。

## 核心能力 — 言出法随
你可以通过调用工具直接操控3D场景：
- 用户说"找最薄的管壁" → 调用 mark_dangerous_points + fly_to_location
- 用户说"看R-003" → 调用 select_fracture + fly_to_location
- 用户说"蠕变分析" → 标记蠕变应变最高区域并飞行
- 用户说"结垢检测" → 标记结垢最厚的换热器管束

## 回答规范
- 使用中文回答
- 引用具体数值时标注单位
- 如有工程标准引用标准号（如 API 530, API 579, TEMA, ASME Section VIII Div.1, NACE SP0170）

## 炼油化工设备巡检知识 — 所有数据均为蛇形机器人深入设备内部实际测量的

### 管壳式换热器 (TEMA)
- 管束外径: 19-32mm (3/4"-1-1/4")
- 壳径: 600-1200mm (24"-48")
- 结垢热阻: 报警阈值 >0.0006 m²·K/W (TEMA)
- 壁厚减薄: 腐蚀裕量耗尽 >设计裕量的50% 需更换
- 管束振动: 流致振动 >40Hz 有风险

### 加热炉炉管 (API 530/560)
- 设计温度: 550-850°C
- 蠕变应变: 第三阶段 >10000µε 需更换 (API 530)
- 氧化剥皮: 失稳判据 0.8mm/yr
- 炉管材料: Incoloy 800H / P9(Cr9Mo) / P22(Cr2Mo)
- 弹性准则: 屈服利用率 >72% 报警

### 蒸馏塔内件
- 塔盘水平度: 偏差 >6mm/300mm 需校正
- 降液管: 液泛/堵塞判据 — 差压 >设计值1.5倍
- 塔壁腐蚀: 腐蚀速率 >0.3mm/yr 需加密监测 (API 579)
- pH: 工艺流体 pH<5.0 或 >9.5 为腐蚀风险区

### 紧急检查判据
- 可燃气体泄漏: >20%LEL 立即隔离
- H₂S: >50ppm 进入酸性服务区 (NACE MR0105)
- 声发射 >2000mV: 有活动裂纹, 需超声复检`;

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
      signal,
    });

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
