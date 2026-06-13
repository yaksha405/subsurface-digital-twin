import { useSceneStore } from '../../store/useSceneStore';
import type { AnnotationTool } from '../../types';
import { useEffect } from 'react';

const TOOLS: { key: AnnotationTool; label: string; icon: string; shortcut: string; guide: string }[] = [
  { key: 'profile', label: '剖面线', icon: '📏', shortcut: 'F1', guide: '点击 3D 场景中两点，自动生成剖面线和深度图' },
  { key: 'area', label: '区域框选', icon: '⬜', shortcut: 'F2', guide: '拖拽鼠标框选一个矩形区域，统计内部裂缝密度' },
  { key: 'text', label: '文字标注', icon: '🏷', shortcut: 'F3', guide: '点击 3D 场景中任意位置，输入标注文字' },
  { key: 'distance', label: '测距', icon: '📐', shortcut: 'F4', guide: '依次点击两个点，自动计算三维空间距离' },
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

  const activeToolInfo = TOOLS.find(t => t.key === activeTool);

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
      {TOOLS.map(({ key, label, icon, shortcut, guide }) => (
        <button
          key={key}
          onClick={() => setActiveTool(activeTool === key ? 'none' : key)}
          className={`group flex items-center gap-1 px-2 py-1 rounded text-[10px] font-medium transition-all relative ${
            activeTool === key
              ? 'bg-[#FFE600]/20 text-[#FFE600] border border-[#FFE600]/40 shadow-[0_0_8px_rgba(255,230,0,0.15)]'
              : 'text-[#A0A0B0] border border-transparent hover:bg-white/5 hover:text-[#E0E0E8]'
          }`}
          title={`${label} (${shortcut}) — ${guide}`}
        >
          <span>{icon}</span>
          <span className="hidden sm:inline">{label}</span>
          {/* 快捷键标签 */}
          <span className={`text-[9px] px-0.5 rounded ${
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

      {/* C3: 操作指引提示 — 工具激活时显示 */}
      {activeToolInfo && (
        <div className="ml-2 flex items-center gap-1.5 px-2 py-1 rounded bg-[#FFE600]/8 border border-[#FFE600]/20 text-[#FFE600] animate-fade-in">
          <svg className="w-3 h-3 flex-shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="12" cy="12" r="10" />
            <path d="M12 16v-4M12 8h.01" />
          </svg>
          <span className="text-[9px] leading-tight">{activeToolInfo.guide}</span>
          <button
            onClick={() => setActiveTool('none')}
            className="text-[9px] text-[#A0A0B0] hover:text-[#FFE600] ml-1 underline"
          >
            ESC 退出
          </button>
        </div>
      )}
    </div>
  );
}
