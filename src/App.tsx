import { MainLayout } from './components/layout/MainLayout';
import { ControlPanel } from './components/control-panel/ControlPanel';
import { Scene3DCanvas } from './components/scene/Scene3DCanvas';
import { ChatPanel } from './components/chat/ChatPanel';
import { WatermarkOverlay } from './components/scene/WatermarkOverlay';
import { RobotDetailDialog } from './components/scene/RobotDetailDialog';
import { useSceneStore } from './store/useSceneStore';

/** C4: 小屏幕提示 — 宽度不足时引导用户使用桌面端 */
function MobileWarning() {
  return (
    <div className="fixed inset-0 z-[9999] bg-[#080812] flex flex-col items-center justify-center p-8 text-center md:hidden">
      <div className="text-5xl mb-4">🖥️</div>
      <h1 className="text-lg font-bold text-[#FFE600] mb-3">建议使用桌面端访问</h1>
      <p className="text-sm text-[#A0A0B0] leading-relaxed max-w-xs">
        HIVE 数字孪生主控舱为专业工业应用，需要较大屏幕以展示 3D 场景和多项监控面板。
        <br /><br />
        请在宽度 ≥ 768px 的设备上访问（推荐 1920×1080 及以上分辨率）。
      </p>
    </div>
  );
}

export default function App() {
  const selectedRobot = useSceneStore((s) => s.selectedRobot);
  const detailOpen = useSceneStore((s) => s.robotDetailOpen);
  const closeRobotDetail = useSceneStore((s) => s.closeRobotDetail);

  return (
    <>
      <MobileWarning />
      <MainLayout
        controlPanel={<ControlPanel />}
        scene3D={<Scene3DCanvas />}
        chatPanel={<ChatPanel />}
        watermark={<WatermarkOverlay />}
      />
      <RobotDetailDialog robot={selectedRobot} open={detailOpen} onClose={closeRobotDetail} />
    </>
  );
}
