import { useSceneStore } from '../../store/useSceneStore';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Button } from '../ui/button';
import { Box, Eye, Ruler, Type, PenLine } from 'lucide-react';
import type { AnnotationTool } from '../../types';

export function ToolActions() {
  const activeTool = useSceneStore((s) => s.activeTool);
  const setActiveTool = useSceneStore((s) => s.setActiveTool);
  const physicalTruthMode = useSceneStore((s) => s.setPhysicalTruthMode);
  const isPhysicalTruth = useSceneStore((s) => s.physicalTruthMode);
  const annotations = useSceneStore((s) => s.annotations);
  const clearAnnotations = useSceneStore((s) => s.clearAnnotations);

  const tools: { key: AnnotationTool; label: string; Icon: any; shortcut: string }[] = [
    { key: 'profile', label: '剖面线', Icon: Ruler, shortcut: 'F1' },
    { key: 'area', label: '区域框选', Icon: Box, shortcut: 'F2' },
    { key: 'text', label: '文字标注', Icon: Type, shortcut: 'F3' },
    { key: 'distance', label: '测距', Icon: PenLine, shortcut: 'F4' },
  ];

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>测量标注工具</CardTitle>
          {annotations.length > 0 && (
            <button
              onClick={clearAnnotations}
              className="text-[9px] text-[#FF6644] hover:underline"
            >
              清除({annotations.length})
            </button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-2">
        {tools.map(({ key, label, Icon, shortcut }) => (
          <Button
            key={key}
            variant={activeTool === key ? 'default' : 'outline'}
            className="w-full justify-start"
            onClick={() => setActiveTool(activeTool === key ? 'none' : key)}
          >
            <Icon className="w-3.5 h-3.5" />
            <span className="flex-1 text-left">{label}</span>
            <kbd className="text-[8px] px-1 py-0.5 rounded bg-white/5 text-[#A0A0B0] border border-white/10">{shortcut}</kbd>
          </Button>
        ))}

        <div className="pt-2 border-t border-white/5">
          <Button
            variant={isPhysicalTruth ? 'destructive' : 'outline'}
            className="w-full justify-start"
            onClick={() => physicalTruthMode(!isPhysicalTruth)}
          >
            <Eye className="w-3.5 h-3.5" />
            <span className="flex-1 text-left">
              {isPhysicalTruth ? '退出物理真实模式' : '还原物理真实面貌'}
            </span>
          </Button>
        </div>

        {isPhysicalTruth && (
          <div className="text-[9px] text-[#FF3333]/80 flex items-start gap-1 animate-fade-in pt-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full bg-[#FF3333] animate-pulse mt-0.5 flex-shrink-0" />
            合规审计模式：仅显示原始雷达回波
          </div>
        )}
      </CardContent>
    </Card>
  );
}
