import { useSceneStore } from '../../store/useSceneStore';
import type { AnnotationTool } from '../../types';
import { useEffect } from 'react';

const TOOLS: { key: AnnotationTool; label: string; icon: string; shortcut: string }[] = [
  { key: 'profile', label: '剖面线', icon: '📏', shortcut: 'F1' },
  { key: 'area', label: '区域框选', icon: '⬜', shortcut: 'F2' },
  { key: 'text', label: '文字标注', icon: '🏷', shortcut: 'F3' },
  { key: 'distance', label: '测距', icon: '📐', shortcut: 'F4' },
];

const SHORTCUT_MAP: Record<string, AnnotationTool> = {
  F1: 'profile',
  F2: 'area',
  F3: 'text',
  F4: 'distance',
};

export function MeasurementToolbar() {
  const activeTool = useSceneStore((s) => s.activeTool);
  const setActiveTool = useSceneStore((s) => s.setActiveTool);
  const annotations = useSceneStore((s) => s.annotations);
  const clearAnnotations = useSceneStore((s) => s.clearAnnotations);

  // 全局键盘快捷键 F1-F4
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const tool = SHORTCUT_MAP[e.key];
      if (!tool) return;
      // 忽略输入框中的按键
      const target = e.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;
      e.preventDefault();
      setActiveTool(activeTool === tool ? 'none' : tool);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [activeTool, setActiveTool]);

  return (
    <div className="flex items-center gap-1">
      {TOOLS.map(({ key, label, icon, shortcut }) => (
        <button
          key={key}
          onClick={() => setActiveTool(activeTool === key ? 'none' : key)}
          className={`group flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-all relative ${
            activeTool === key
              ? 'bg-[#FFE600]/20 text-[#FFE600] border border-[#FFE600]/40 shadow-[0_0_8px_rgba(255,230,0,0.15)]'
              : 'text-[#A0A0B0] border border-transparent hover:bg-white/5 hover:text-[#E0E0E8]'
          }`}
          title={`${label} (${shortcut})`}
        >
          <span>{icon}</span>
          <span className="hidden sm:inline">{label}</span>
          {/* 快捷键标签 */}
          <span className={`text-[8px] px-0.5 rounded ${
            activeTool === key ? 'bg-[#FFE600]/20 text-[#FFE600]/80' : 'bg-white/5 text-[#A0A0B0]/50'
          }`}>{shortcut}</span>
        </button>
      ))}
      {annotations.length > 0 && (
        <button
          onClick={clearAnnotations}
          className="ml-2 px-2 py-1 rounded text-[10px] text-[#FF6644] hover:bg-[#FF6644]/10 transition-all"
          title="清除所有标注"
        >
          清除({annotations.length})
        </button>
      )}
      {activeTool !== 'none' && (
        <span className="ml-2 text-[9px] text-[#FFE600]/60 animate-pulse">
          按 ESC 取消
        </span>
      )}
    </div>
  );
}
