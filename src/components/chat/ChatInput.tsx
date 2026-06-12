import { useState } from 'react';
import { Button } from '../ui/button';
import { Send } from 'lucide-react';

interface ChatInputProps {
  onSend: (text: string) => void;
}

export function ChatInput({ onSend }: ChatInputProps) {
  const [input, setInput] = useState('');

  const handleSubmit = () => {
    if (input.trim()) {
      onSend(input.trim());
      setInput('');
    }
  };

  return (
    <div className="p-3 border-t border-white/5">
      <div className="flex gap-2 items-end">
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
          placeholder="输入指令..."
          className="flex-1 bg-[#2A2D3A] border border-white/5 rounded-lg px-3 py-2 text-xs text-[#E0E0E8] placeholder:text-[#A0A0B0]/40 focus:outline-none focus:border-[#FFE600]/30 transition-colors"
        />
        <Button
          size="icon"
          onClick={handleSubmit}
          disabled={!input.trim()}
        >
          <Send className="w-3.5 h-3.5" />
        </Button>
      </div>
    </div>
  );
}
