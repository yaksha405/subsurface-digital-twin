import { Badge } from '../ui/badge';
import { useQuickCommands } from '../../hooks/useQuickCommands';
import { useSceneStore } from '../../store/useSceneStore';

interface QuickCommandsProps {
  onSend: (text: string) => void;
}

export function QuickCommands({ onSend }: QuickCommandsProps) {
  const { data: quickCommands } = useQuickCommands();
  const locale = useSceneStore((s) => s.locale);

  return (
    <div className="px-3 py-2 border-t border-[#D9E1EA]">
      <div className="text-[9px] text-[#667085] tracking-wider uppercase mb-1.5">{locale === 'zh-CN' ? '快捷指令' : 'Quick Commands'}</div>
      <div className="flex flex-wrap gap-1">
        {quickCommands.map((cmd) => (
          <Badge
            key={cmd.command}
            variant="neutral"
            className="cursor-pointer hover:border-[#B7C3D0] hover:bg-[#EEF2F6] hover:text-[#182230] transition-all"
            onClick={() => onSend(cmd.command)}
          >
            {cmd.label}
          </Badge>
        ))}
      </div>
    </div>
  );
}
