import { TopBar } from './TopBar';
import { ComplianceBar } from './ComplianceBar';
import { FractureDetailPanel } from '../control-panel/FractureDetailPanel';

interface MainLayoutProps {
  controlPanel: React.ReactNode;
  scene3D: React.ReactNode;
  chatPanel: React.ReactNode;
  watermark?: React.ReactNode;
}

export function MainLayout({ controlPanel, scene3D, chatPanel, watermark }: MainLayoutProps) {
  return (
    <div className="w-full h-full flex flex-col bg-background overflow-hidden">
      <TopBar />

      {/* Three-column layout */}
      <div className="flex-1 flex overflow-hidden min-h-0">
        {/* Left panel - 控制台 */}
        <div className="w-[18%] min-w-[240px] max-w-[320px] flex-shrink-0 border-r border-white/5">
          {controlPanel}
        </div>

        {/* Center: 3D scene + bottom chat */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* 3D Scene - 70% height */}
          <div className="flex-[7] relative overflow-hidden">
            {scene3D}
            {watermark}

            {/* Mini compass */}
            <div className="absolute top-3 left-3 glass-panel px-2 py-1.5 z-20 pointer-events-none">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full border border-primary-yellow/20 flex items-center justify-center relative">
                  <span className="text-[8px] text-primary-yellow absolute top-0">N</span>
                  <span className="text-[8px] text-text-muted absolute bottom-0">S</span>
                  <div className="w-0.5 h-3 bg-primary-yellow absolute top-1 left-1/2 -translate-x-1/2" />
                </div>
                <div>
                  <div className="text-[9px] text-primary-yellow font-semibold">裂缝地质体</div>
                  <div className="text-[8px] text-text-muted">FRACTURE-ZONE</div>
                </div>
              </div>
            </div>

            <div className="scan-overlay" />
          </div>

          {/* Bottom: Chat panel - 30% height */}
          <div className="flex-[3] border-t border-white/5 overflow-hidden min-h-[120px]">
            {chatPanel}
          </div>
        </div>

        {/* Right panel - 裂缝详情 */}
        <div className="w-[20%] min-w-[260px] max-w-[360px] flex-shrink-0 border-l border-white/5 bg-[#121218]/90">
          <div className="p-2 border-b border-white/5 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[#44AAFF] animate-pulse" />
            <span className="text-xs font-semibold text-[#E0E0E8]">裂缝详情</span>
          </div>
          <FractureDetailPanel />
        </div>
      </div>

      <ComplianceBar />
    </div>
  );
}
