import { useEffect, useState } from 'react';
import { useSceneStore } from '../../store/useSceneStore';
import { ScenarioSelector } from './ScenarioSelector';
import { MeasurementToolbar } from './MeasurementToolbar';
import { SettingsDialog } from './SettingsDialog';
import { ExportHub } from './ExportHub';

export function TopBar() {
  const [time, setTime] = useState(new Date());
  const [exportHubOpen, setExportHubOpen] = useState(false);

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="h-12 glass-panel rounded-none flex items-center px-4 gap-4 border-l-0 border-r-0 border-t-0 border-b-primary-yellow/10 relative z-[200]">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <div className="w-8 h-8 rounded bg-gradient-to-br from-primary-yellow to-primary-orange flex items-center justify-center">
          <svg className="w-5 h-5 text-background" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <rect x="3" y="11" width="18" height="10" rx="2" />
            <circle cx="12" cy="5" r="2" />
            <path d="M12 7v4M8 16h.01M16 16h.01" />
          </svg>
        </div>
        <div>
          <div className="text-sm font-bold text-text tracking-wide leading-none">HIVE 群智数字孪生主控舱</div>
          <div className="text-[9px] text-text-muted/60 tracking-widest mt-0.5">DIGITAL TWIN CONTROL CABIN v1.0</div>
        </div>
      </div>

      {/* Center: scenario + tools */}
      <div className="flex-1 flex items-center justify-center gap-6">
        <ScenarioSelector />
        <div className="w-px h-5 bg-white/10" />
        <MeasurementToolbar />
      </div>

      {/* Right: clock + export */}
      <div className="flex items-center gap-3">
        <div className="text-right">
          <div className="text-xs font-mono text-primary-yellow leading-none">
            {time.toLocaleTimeString('zh-CN', { hour12: false })}
          </div>
          <div className="text-[9px] text-text-muted mt-0.5">
            {time.toLocaleDateString('zh-CN')}
          </div>
        </div>
        <button
          onClick={() => setExportHubOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-yellow/10 border border-primary-yellow/30 text-primary-yellow rounded text-[10px] font-medium hover:bg-primary-yellow/20 transition-all"
        >
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
          数据导出
        </button>
        <SettingsDialog />
      </div>

      <ExportHub open={exportHubOpen} onClose={() => setExportHubOpen(false)} />
    </div>
  );
}
