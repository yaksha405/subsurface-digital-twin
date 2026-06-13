import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { useThree, useFrame } from '@react-three/fiber';
import { useEffect, useRef } from 'react';
import * as THREE from 'three';
import { useSceneStore } from '../../store/useSceneStore';
import { RobotMarkers } from './RobotMarkers';
import { CameraInfo, CameraTracker } from './CameraInfo';
import { HighlightRegion } from './HighlightRegion';
import { VolumeMeasure } from './VolumeMeasure';
import { ProfileLineTool } from './ProfileLineTool';
import { DistanceMeasureTool } from './DistanceMeasureTool';
import { TextAnnotationTool } from './TextAnnotationTool';
import { AnnotationOverlay } from './AnnotationOverlay';
import { POIMarkers } from './POIMarkers';
import { AIMarkers3D } from './AIMarkers3D';
import { SceneErrorBoundary } from './SceneErrorBoundary';
import { RockMass } from './RockMass';
import { ReactorContainment } from './ReactorContainment';
import { FractureNetwork } from './FractureNetwork';
import { PotreeViewer, PotreeCameraSync } from './PotreeViewer';
import { DeckGlHeatmap } from './DeckGlHeatmap';
import { PlaybackEngine, PlaybackBar } from './PlaybackController';

export function Scene3DCanvas() {
  const layers = useSceneStore((s) => s.layers);
  const dataSource = useSceneStore((s) => s.dataSource);
  const physicalTruthMode = useSceneStore((s) => s.physicalTruthMode);
  const setCaptureScreenshot = useSceneStore((s) => s.setCaptureScreenshot);
  const activeTool = useSceneStore((s) => s.activeTool);
  const highlightActive = useSceneStore((s) => s.highlightRegion.active);
  const aiMarkerCount = useSceneStore((s) => s.aiMarkers.length);
  const clearHighlight = useSceneStore((s) => s.clearHighlight);
  const clearAIMarkers = useSceneStore((s) => s.clearAIMarkers);
  const resetSceneView = useSceneStore((s) => s.resetSceneView);

  return (
    <div className="relative w-full h-full grid-bg overflow-hidden">
      <SceneErrorBoundary>
        <Canvas
          camera={{ position: [30, 42, 50], fov: 50, near: 0.1, far: 3000 }}
          gl={{ preserveDrawingBuffer: true, antialias: true }}
          dpr={[1, 1.5]}
          onPointerMissed={() => {
            // 点击空白处取消高亮 + 关闭机器人详情
            const store = useSceneStore.getState();
            if (store.highlightRegion.active) {
              store.clearHighlight();
            }
            if (store.robotDetailOpen) {
              store.closeRobotDetail();
            }
          }}
          onCreated={({ gl, scene, camera }) => {
            gl.setClearColor('#080812');
            console.log('[Scene3D] WebGL context created OK');
            console.log('[Scene3D] Camera position:', camera.position);
            setCaptureScreenshot(() => {
              try {
                return gl.domElement.toDataURL('image/png');
              } catch (e) {
                console.error('Screenshot failed', e);
                return null;
              }
            });
          }}
        >
          {/* Lighting */}
          <ambientLight intensity={0.6} />
          <directionalLight position={[50, 50, 50]} intensity={0.8} />
          <pointLight position={[-30, -10, 0]} intensity={0.5} color="#1E3A5F" />
          <pointLight position={[0, 20, 0]} intensity={0.4} color="#FFE600" />

          {/* Reference grid for spatial awareness */}
          <gridHelper args={[200, 40, '#1A1D2A', '#0A0C14']} position={[0, -22, 0]} />

          {/* 岩体 + 裂缝网络 — 核心场景 */}
          <RockMass />
          <ReactorContainment />
          <FractureNetwork />
          {/* R3F 原生热力图（瓦斯/温度）— 跟随场景旋转/平移 */}
          <DeckGlHeatmap />

          {/* Potree 相机同步（R3F → Potree，每帧更新） */}
          {layers.pointCloud && <PotreeCameraSync />}

          {layers.robots && <RobotMarkers />}
          {/* POI 标记仅用于地下裂缝场景（煤矿/金矿/油气），管线/核反应堆/炼油厂场景不显示 */}
          {layers.poi && dataSource === 'fracture' && <POIMarkers />}
          <AIMarkers3D />
          <HighlightRegion />
          <VolumeMeasure />
          <ProfileLineTool />
          <DistanceMeasureTool />
          <TextAnnotationTool />
          <AnnotationOverlay />

          <CameraFlyToHandler />
          <PlaybackEngine />
          <CameraTracker />
          <OrbitControls
            makeDefault
            enableDamping
            dampingFactor={0.08}
            rotateSpeed={0.6}
            panSpeed={0.6}
            zoomSpeed={0.8}
            target={[0, 0, 0]}
            minDistance={5}
            maxDistance={300}
            mouseButtons={{
              LEFT: activeTool === 'none' ? THREE.MOUSE.ROTATE : undefined,
              MIDDLE: THREE.MOUSE.DOLLY,
              RIGHT: activeTool === 'none' ? THREE.MOUSE.PAN : THREE.MOUSE.ROTATE,
            }}
          />
        </Canvas>
      </SceneErrorBoundary>

      {/* HTML overlays outside Canvas */}
      <CameraInfo />

      {/* Potree 工业级点云渲染（独立 WebGL context，八叉树 LOD） */}
      <PotreeViewer />

      {/* 任务回放控制条 */}
      <PlaybackBar />

      {/* 右下角坐标信息（替代原来的开发者标签） */}
      <div className="absolute bottom-3 left-3 z-20 pointer-events-none">
        <span className="text-[9px] px-1.5 py-0.5 bg-[#1A1D2A]/80 text-[#3FB950]/70 rounded border border-white/5 font-mono">
          ● LIVE
        </span>
      </div>

      {/* 浮动场景控制工具栏 — 右上角 */}
      <div className="absolute top-3 right-3 z-30 flex flex-col gap-1.5">
        <button
          onClick={() => resetSceneView()}
          title="重置视角 · 清除所有标记和高亮"
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] bg-[#1A1D2A]/85 backdrop-blur-md text-[#E0E0E8] hover:text-[#FFE600] rounded-lg border border-white/10 hover:border-[#FFE600]/30 transition-all shadow-lg"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12l9-9 9 9M5 10v10h14V10" />
          </svg>
          全景
        </button>

        {highlightActive && (
          <button
            onClick={() => clearHighlight()}
            title="关闭高亮球体"
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] bg-[#1A1D2A]/85 backdrop-blur-md text-[#FFE600] hover:text-[#FFF] rounded-lg border border-[#FFE600]/30 hover:border-[#FFE600]/50 transition-all shadow-lg animate-fade-in"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9" />
              <path d="M9 9l6 6M15 9l-6 6" />
            </svg>
            取消高亮
          </button>
        )}

        {aiMarkerCount > 0 && (
          <button
            onClick={() => clearAIMarkers()}
            title="清除AI分析标记"
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] bg-[#1A1D2A]/85 backdrop-blur-md text-[#FF6666] hover:text-[#FF9999] rounded-lg border border-[#FF3333]/30 hover:border-[#FF3333]/50 transition-all shadow-lg animate-fade-in"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v6m0 0l-3-3m3 3l3-3M5 14v6h14v-6M3 14h18" />
            </svg>
            清除标记 ({aiMarkerCount})
          </button>
        )}
      </div>
    </div>
  );
}

function CameraFlyToHandler() {
  const { camera, controls } = useThree();
  const animating = useRef(false);
  const startTime = useRef(0);
  const startPos = useRef(new THREE.Vector3());
  const endPos = useRef(new THREE.Vector3());
  const startTarget = useRef(new THREE.Vector3());
  const endTarget = useRef(new THREE.Vector3());
  const cameraTarget = useSceneStore((s) => s.cameraTarget);
  const clearCameraTarget = useSceneStore((s) => s.clearCameraTarget);

  useEffect(() => {
    if (!cameraTarget) return;
    const target = cameraTarget.position;
    const zoom = cameraTarget.zoom || 'normal';

    // 根据缩放级别确定相机偏移
    const offsets = {
      close: [4, 2.5, 4],     // 贴近看单个机器人/节点
      normal: [15, 8, 15],    // 默认
      wide: [30, 18, 30],     // 远景
    };
    const [ox, oy, oz] = offsets[zoom];

    // Camera end position: offset from target
    endPos.current.set(target[0] + ox, target[1] + oy, target[2] + oz);
    // OrbitControls target: look at the target position
    endTarget.current.set(target[0], target[1], target[2]);

    startPos.current.copy(camera.position);
    // Save current controls target and disable user input during animation
    if (controls && 'target' in controls) {
      startTarget.current.copy((controls as any).target);
      (controls as any).enabled = false;
    }

    startTime.current = performance.now();
    animating.current = true;

    const timeout = setTimeout(() => {
      animating.current = false;
      if (controls && 'target' in controls) {
        (controls as any).target.copy(endTarget.current);
        (controls as any).enabled = true;
        (controls as any).update();
      }
      clearCameraTarget();
    }, 2100);

    return () => clearTimeout(timeout);
  }, [cameraTarget, camera, controls, clearCameraTarget]);

  useFrame(() => {
    if (!animating.current) return;
    const elapsed = (performance.now() - startTime.current) / 1000;
    const duration = 2.0;
    const t = Math.min(elapsed / duration, 1);
    const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;

    // Animate camera position
    camera.position.lerpVectors(startPos.current, endPos.current, eased);

    // Animate controls target in sync so zoom/rotate/pan stay correct after animation
    if (controls && 'target' in controls) {
      (controls as any).target.lerpVectors(startTarget.current, endTarget.current, eased);
      (controls as any).update();
    } else {
      camera.lookAt(endTarget.current);
    }
  });

  return null;
}
