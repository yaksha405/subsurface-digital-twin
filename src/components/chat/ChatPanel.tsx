import { useRef, useEffect, useState } from 'react';
import { useSceneStore } from '../../store/useSceneStore';
import { ChatMessage } from './ChatMessage';
import { ChatInput } from './ChatInput';
import { QuickCommands } from './QuickCommands';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { Bot, ChevronRight } from 'lucide-react';
import type { ChatMessage as ChatMessageType, SceneAction } from '../../types';
import type { CoreMessage } from '../../types/api';
import { streamChat } from '../../api/aiApi';
import { loadSettings } from '../layout/SettingsDialog';

export function ChatPanel() {
  const messages = useSceneStore((s) => s.messages);
  const collapsed = useSceneStore((s) => s.chatCollapsed);
  const toggleCollapsed = useSceneStore((s) => s.toggleChatCollapsed);
  const scrollRef = useRef<HTMLDivElement>(null);
  const [streamingText, setStreamingText] = useState<string | null>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, streamingText]);

  const handleSend = async (text: string) => {
    // 1. 添加用户消息
    const userMsg: ChatMessageType = {
      id: `msg-${Date.now()}`,
      role: 'user',
      content: text,
      timestamp: Date.now(),
    };
    useSceneStore.setState((state) => ({ messages: [...state.messages, userMsg] }));

    // 2. 通过 API 层流式获取 AI 响应（含场景上下文 + Function Calling）
    const coreMessages: CoreMessage[] = [
      ...messages.map((m) => ({ role: m.role, content: m.content } as CoreMessage)),
      { role: 'user', content: text },
    ];

    let streamed = '';
    setStreamingText('');

    const state = useSceneStore.getState();
    const response = await streamChat(
      coreMessages,
      (delta) => {
        streamed += delta;
        setStreamingText(streamed);
      },
      undefined,
      {
        fractures: state.fractures,
        scenario: state.scenario,
        gasThreshold: state.gasThreshold,
      }
    );

    // 3. 添加完整 AI 消息
    const aiMsg: ChatMessageType = {
      id: `msg-${Date.now()}-ai`,
      role: 'assistant',
      content: response.message,
      timestamp: Date.now(),
      action: response.action,
      actions: response.actions,
    };
    useSceneStore.setState((state) => ({ messages: [...state.messages, aiMsg] }));
    setStreamingText(null);

    // 4. 执行空间联动（言出法随）
    const allActions = response.actions || (response.action ? [response.action] : []);
    for (const action of allActions) {
      executeActions(action);
    }
  };

  if (collapsed) {
    return (
      <div className="h-full bg-[#121218]/90 flex items-center justify-center">
        <button
          onClick={toggleCollapsed}
          className="flex items-center gap-2 text-xs text-[#A0A0B0] hover:text-[#FFE600] transition-colors"
        >
          <Bot className="w-4 h-4" />
          <span>展开AI对话</span>
        </button>
      </div>
    );
  }

  return (
    <div className="h-full bg-[#121218]/90 backdrop-blur-md flex flex-col overflow-hidden">
      <div className="px-3 py-1.5 border-b border-white/5 flex items-center gap-2">
        <div className="w-5 h-5 rounded-full bg-[#FFE600]/15 border border-[#FFE600]/20 flex items-center justify-center">
          <Bot className="w-3 h-3 text-[#FFE600]" />
        </div>
        <div className="flex-1">
          <div className="text-xs font-semibold text-[#E0E0E8]">地质裂缝分析AI助手</div>
          <div className="flex items-center gap-1 text-[8px] text-[#A0A0B0]">
            <span className="w-1 h-1.5 rounded-full bg-[#FFE600] animate-pulse" />
            {loadSettings().apiKey ? 'DeepSeek Live' : 'Mock 模式 · 请在设置中配置API Key'}
          </div>
        </div>
        <Badge variant="neutral">{loadSettings().apiKey ? 'LIVE' : 'MOCK'}</Badge>
        <button onClick={toggleCollapsed} className="text-[#A0A0B0] hover:text-[#FFE600] transition-colors">
          <ChevronRight className="w-3.5 h-3.5 rotate-90" />
        </button>
      </div>

      <ScrollArea className="flex-1">
        <div ref={scrollRef} className="p-3 space-y-3 min-h-full">
          {messages.map((msg) => (
            <ChatMessage key={msg.id} message={msg} />
          ))}
          {streamingText !== null && (
            <div className="flex justify-start">
              <div className="flex gap-2 max-w-[90%]">
                <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#2A2D3A] border border-[#FFE600]/20 flex items-center justify-center mt-0.5">
                  <Bot className="w-3 h-3 text-[#FFE600]" />
                </div>
                <div className="bg-[#1A1D2A]/60 border border-white/5 rounded-lg rounded-tl-none px-3 py-2">
                  <div className="text-xs text-[#E0E0E8] [&>p]:my-1 [&>h2]:text-sm [&>h2]:text-[#FFE600] [&>h2]:font-semibold [&>ul]:my-1 [&>ul]:ml-3 [&>li]:my-0.5 [&>blockquote]:border-l-2 [&>blockquote]:border-[#FFE600]/40 [&>blockquote]:pl-2 [&_code]:text-[#FFE600] [&_code]:bg-[#2A2D3A] [&_code]:px-1 [&_code]:rounded">
                    <StreamingMarkdown content={streamingText} />
                    <span className="inline-block w-2 h-3 bg-[#FFE600] animate-pulse ml-0.5" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </ScrollArea>

      <QuickCommands onSend={handleSend} />
      <ChatInput onSend={handleSend} />
    </div>
  );
}

function StreamingMarkdown({ content }: { content: string }) {
  // During streaming, render as plain text to avoid partial Markdown issues
  return <div className="whitespace-pre-wrap">{content}</div>;
}

function executeActions(action: SceneAction) {
  const store = useSceneStore.getState();

  switch (action.type) {
    case 'flyTo': {
      if (action.position) {
        store.flyTo({ position: action.position, region: action.region });
        // 自动高亮
        setTimeout(() => {
          store.setHighlightRegion({ position: action.position!, radius: action.radius || 12, active: true });
          setTimeout(() => {
            const cur = useSceneStore.getState().highlightRegion;
            store.setHighlightRegion({ ...cur, active: false });
          }, 4500);
        }, 1800);
      }
      break;
    }

    case 'highlight': {
      if (action.position) {
        store.setHighlightRegion({ position: action.position, radius: action.radius || 12, active: true });
        setTimeout(() => {
          const cur = useSceneStore.getState().highlightRegion;
          store.setHighlightRegion({ ...cur, active: false });
        }, 5000);
      }
      break;
    }

    case 'markPoints': {
      if (action.points && action.points.length > 0) {
        const markers = action.points.map((p, i) => ({
          id: `ai-marker-${Date.now()}-${i}`,
          position: p.position,
          label: p.label,
          level: p.level || 'info',
          createdAt: Date.now(),
        }));
        store.addAIMarkers(markers);
      }
      break;
    }

    case 'clearMarkers': {
      store.clearAIMarkers();
      break;
    }

    case 'toggleLayer': {
      if (action.layer) {
        const key = action.layer as keyof typeof store.layers;
        const current = useSceneStore.getState().layers;
        if (key in current) {
          store.setLayer(key, !current[key]);
        }
      }
      break;
    }

    case 'activateTool': {
      if (action.tool) {
        store.setActiveTool(action.tool);
      }
      break;
    }

    case 'selectFracture': {
      if (action.fractureId) {
        const fracture = useSceneStore.getState().fractures.find((f) => f.id === action.fractureId);
        if (fracture) {
          store.selectFracture(fracture);
          // 同时飞到裂缝中心
          const center = fracture.path.reduce(
            (acc, p) => [acc[0] + p[0], acc[1] + p[1], acc[2] + p[2]],
            [0, 0, 0]
          );
          const n = fracture.path.length || 1;
          store.flyTo({
            position: [center[0] / n, center[1] / n, center[2] / n],
            region: fracture.name,
          });
        }
      }
      break;
    }

    case 'setGasThreshold': {
      if (action.threshold !== undefined) {
        store.setGasThreshold(action.threshold);
      }
      break;
    }

    case 'switchScenario': {
      if (action.scenario) {
        store.setScenario(action.scenario);
        // 重新生成裂缝数据
        import('../../data/fractureDataGenerator').then(({ generateFractureNetwork }) => {
          const newFractures = generateFractureNetwork(action.scenario!);
          useSceneStore.getState().setFractures(newFractures);
        });
      }
      break;
    }

    case 'fitAll': {
      store.flyTo({ position: [0, 0, 0] });
      break;
    }
  }
}
