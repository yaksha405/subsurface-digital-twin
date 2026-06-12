import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { Bot } from 'lucide-react';
import type { ChatMessage as ChatMessageType } from '../../types';

export function ChatMessage({ message }: { message: ChatMessageType }) {
  const isUser = message.role === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end animate-fade-in">
        <div className="max-w-[85%] bg-[#FFE600]/12 border border-[#FFE600]/20 rounded-lg rounded-tr-none px-3 py-2">
          <div className="text-xs text-[#E0E0E8]">{message.content}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex justify-start animate-fade-in">
      <div className="flex gap-2 max-w-[90%]">
        <div className="flex-shrink-0 w-6 h-6 rounded-full bg-[#2A2D3A] border border-[#FFE600]/20 flex items-center justify-center mt-0.5">
          <Bot className="w-3 h-3 text-[#FFE600]" />
        </div>
        <div className="bg-[#1A1D2A]/60 border border-white/5 rounded-lg rounded-tl-none px-3 py-2">
          <div className="text-xs text-[#E0E0E8] prose-chat [&>p]:my-1 [&>p:first-child]:mt-0 [&>p:last-child]:mb-0 [&>h2]:text-sm [&>h2]:text-[#FFE600] [&>h2]:font-semibold [&>h2]:mb-1 [&>h2]:mt-2 [&>ul]:my-1 [&>ul]:ml-3 [&>li]:my-0.5 [&>table]:my-2 [&>blockquote]:border-l-2 [&>blockquote]:border-[#FFE600]/40 [&>blockquote]:pl-2 [&>blockquote]:text-[#A0A0B0] [&_code]:text-[#FFE600] [&_code]:bg-[#2A2D3A] [&_code]:px-1 [&_code]:rounded [&_code]:text-[10px] [&_td]:border [&_td]:border-white/10 [&_td]:px-1.5 [&_td]:py-0.5 [&_th]:border [&_th]:border-white/10 [&_th]:px-1.5 [&_th]:py-0.5 [&_th]:text-[#FFE600]">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{message.content}</ReactMarkdown>
          </div>
          {message.action && (
            <div className="mt-1.5 flex items-center gap-1 text-[9px] text-[#FFE600]/60">
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20" />
                <path d="M2 12h20" />
              </svg>
              Generative UI 已触发：视角飞行 + 区域高亮
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
