import { useEffect, useState } from 'react';
import { useSceneStore } from '../../store/useSceneStore';
import { exportPDF } from '../../lib/pdfExport';
import { ScenarioSelector } from './ScenarioSelector';
import { MeasurementToolbar } from './MeasurementToolbar';
import { SettingsDialog } from './SettingsDialog';
import { useAllRobots, useRobotStats } from '../../hooks/useRobots';
import { useAlerts } from '../../hooks/useAlerts';
import { useSceneStats } from '../../hooks/useSceneStats';
import { usePOIs } from '../../hooks/usePOIs';

export function TopBar() {
  const [time, setTime] = useState(new Date());
  const [exporting, setExporting] = useState(false);
  const captureScreenshot = useSceneStore((s) => s.captureScreenshot);
  const gasThreshold = useSceneStore((s) => s.gasThreshold);
  const confidenceFilter = useSceneStore((s) => s.confidenceFilter);
  const layers = useSceneStore((s) => s.layers);
  const scenario = useSceneStore((s) => s.scenario);
  const dataSource = useSceneStore((s) => s.dataSource);
  const fractures = useSceneStore((s) => s.fractures);
  const annotations = useSceneStore((s) => s.annotations);
  const messages = useSceneStore((s) => s.messages);
  const cameraInfo = useSceneStore((s) => s.cameraInfo);
  // hooks 有模块级缓存，不会重复请求
  const { data: robots } = useAllRobots();
  const { data: robotStats } = useRobotStats();
  const { data: alerts } = useAlerts(dataSource);
  const { data: stats } = useSceneStats();
  const { data: pois } = usePOIs();

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const handleExport = async () => {
    setExporting(true);
    try {
      await exportPDF(captureScreenshot, {
        gasThreshold, confidenceFilter, layers, scenario,
        stats, robots, robotStats, alerts, fractures, pois, annotations, messages, cameraInfo,
      });
    } catch (e) {
      console.error('PDF export failed', e);
    }
    setExporting(false);
  };

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
          <div className="text-[8px] text-text-muted/60 tracking-widest mt-0.5">DIGITAL TWIN CONTROL CABIN v1.0</div>
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
          <div className="text-[8px] text-text-muted mt-0.5">
            {time.toLocaleDateString('zh-CN')}
          </div>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-yellow/10 border border-primary-yellow/30 text-primary-yellow rounded text-[10px] font-medium hover:bg-primary-yellow/20 transition-all disabled:opacity-50"
        >
          {exporting ? (
            <>
              <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              导出中...
            </>
          ) : (
            <>
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
              导出报告
            </>
          )}
        </button>
        <SettingsDialog />
      </div>
    </div>
  );
}
