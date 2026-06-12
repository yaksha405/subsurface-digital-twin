/**
 * AI 对话 API — 真实 LLM 接入
 *
 * 优先使用用户配置的真实大模型（DeepSeek/OpenAI/Qwen）
 * 无配置时回退到 mock 模式
 */

import type { CoreMessage, QuickCommand, AIResponse } from '../types/api';
import { loadSettings } from '../components/layout/SettingsDialog';
import { generateMockAIResponse, quickCommands } from '../lib/mockAI';
import { SCENE_TOOLS, parseToolCall, buildSceneContext } from './llmTools';
import type { Fracture, ScenarioType, SceneAction } from '../types';

export { quickCommands as fetchQuickCommands };

const SYSTEM_PROMPT = `你是地下裂缝探测机器人集群数字孪生平台的AI助手，名为"GeoAssist"。

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
  const systemContent = `${SYSTEM_PROMPT}\n\n${contextStr}`;
  const systemMsg: CoreMessage = { role: 'system', content: systemContent };
  const allMessages = [systemMsg, ...messages];

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

  const tokens = response.message.split(/(\s+|[\n,.!?;:])/);
  for (const token of tokens) {
    if (signal?.aborted) break;
    await new Promise((r) => setTimeout(r, 12 + Math.random() * 20));
    if (token) onToken(token);
  }

  return response;
}
