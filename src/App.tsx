import { MainLayout } from './components/layout/MainLayout';
import { ControlPanel } from './components/control-panel/ControlPanel';
import { Scene3DCanvas } from './components/scene/Scene3DCanvas';
import { ChatPanel } from './components/chat/ChatPanel';
import { WatermarkOverlay } from './components/scene/WatermarkOverlay';
import { RobotDetailDialog } from './components/scene/RobotDetailDialog';
import { useSceneStore } from './store/useSceneStore';

export default function App() {
  const selectedRobot = useSceneStore((s) => s.selectedRobot);
  const detailOpen = useSceneStore((s) => s.robotDetailOpen);
  const closeRobotDetail = useSceneStore((s) => s.closeRobotDetail);

  return (
    <>
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
