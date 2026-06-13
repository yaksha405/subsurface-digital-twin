import { Badge } from '../ui/badge';
import { useQuickCommands } from '../../hooks/useQuickCommands';

interface QuickCommandsProps {
  onSend: (text: string) => void;
}

export function QuickCommands({ onSend }: QuickCommandsProps) {
  const { data: quickCommands } = useQuickCommands();

  return (
    <div className="px-3 py-2 border-t border-white/5">
      <div className="text-[9px] text-[#A0A0B0]/50 tracking-wider uppercase mb-1.5">快捷指令</div>
      <div className="flex flex-wrap gap-1">
        {quickCommands.map((cmd) => (
          <Badge
            key={cmd.command}
            variant="neutral"
            className="cursor-pointer hover:border-[#FFE600]/30 hover:bg-[#FFE600]/10 hover:text-[#FFE600] transition-all"
            onClick={() => onSend(cmd.command)}
          >
            {cmd.label}
          </Badge>
        ))}
      </div>
    </div>
  );
}
