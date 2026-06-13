import { TopBar } from './TopBar';
import { ComplianceBar } from './ComplianceBar';
import { FractureDetailPanel } from '../control-panel/FractureDetailPanel';
import { useSceneStore } from '../../store/useSceneStore';

interface MainLayoutProps {
  controlPanel: React.ReactNode;
  scene3D: React.ReactNode;
  chatPanel: React.ReactNode;
  watermark?: React.ReactNode;
}

export function MainLayout({ controlPanel, scene3D, chatPanel, watermark }: MainLayoutProps) {
  const cameraInfo = useSceneStore((s) => s.cameraInfo);
  const scenario = useSceneStore((s) => s.scenario);
  const dataSource = useSceneStore((s) => s.dataSource);

  // M3: 根据相机方位角旋转指南针
  // cameraInfo.x/z 可用于估算方位角（atan2）
  const compassAngle = Math.atan2(cameraInfo.x, cameraInfo.z) * (180 / Math.PI);

  // 场景标签随数据源变化
  const sceneLabels: Record<string, { name: string; en: string }> = {
    coal: { name: '煤矿裂缝体', en: 'COAL-FRACTURE' },
    gold: { name: '金矿裂缝体', en: 'GOLD-FRACTURE' },
    oil: { name: '油气裂缝体', en: 'OIL-FRACTURE' },
    pipeline: { name: '油气管线', en: 'PIPELINE' },
    nuclear: { name: '核反应堆', en: 'REACTOR' },
    refinery: { name: '炼油化工', en: 'REFINERY' },
    underground: { name: '地下暗流', en: 'UNDERGROUND' },
  };
  const ds = dataSource === 'fracture' ? scenario : dataSource;
  const sceneLabel = sceneLabels[ds] || sceneLabels.coal;

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

            {/* M3: 动态指南针 — 跟随相机旋转 */}
            <div className="absolute top-3 left-3 glass-panel px-2 py-1.5 z-20 pointer-events-none">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full border border-primary-yellow/20 flex items-center justify-center relative">
                  <span className="text-[9px] text-primary-yellow absolute top-0">N</span>
                  <span className="text-[9px] text-text-muted absolute bottom-0">S</span>
                  <div
                    className="w-0.5 h-3 bg-primary-yellow absolute top-1 left-1/2 -translate-x-1/2 origin-bottom transition-transform duration-100"
                    style={{ transform: `translateX(-50%) rotate(${compassAngle}deg)` }}
                  />
                </div>
                <div>
                  <div className="text-[9px] text-primary-yellow font-semibold">{sceneLabel.name}</div>
                  <div className="text-[9px] text-text-muted">{sceneLabel.en}</div>
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
            <span className="text-xs font-semibold text-[#E0E0E8]">
              {dataSource === 'fracture' ? '裂缝详情' : '元素详情'}
            </span>
          </div>
          <FractureDetailPanel />
        </div>
      </div>

      <ComplianceBar />
    </div>
  );
}
