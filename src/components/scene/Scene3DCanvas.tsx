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
import { FractureNetwork } from './FractureNetwork';
import { PotreeViewer, PotreeCameraSync } from './PotreeViewer';
import { DeckGlHeatmap } from './DeckGlHeatmap';

export function Scene3DCanvas() {
  const layers = useSceneStore((s) => s.layers);
  const physicalTruthMode = useSceneStore((s) => s.physicalTruthMode);
  const setCaptureScreenshot = useSceneStore((s) => s.setCaptureScreenshot);
  const activeTool = useSceneStore((s) => s.activeTool);

  return (
    <div className="relative w-full h-full grid-bg overflow-hidden">
      <SceneErrorBoundary>
        <Canvas
          camera={{ position: [30, 42, 50], fov: 50, near: 0.1, far: 3000 }}
          gl={{ preserveDrawingBuffer: true, antialias: true }}
          dpr={[1, 1.5]}
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
          <FractureNetwork />

          {/* Potree 相机同步（R3F → Potree，每帧更新） */}
          {layers.pointCloud && <PotreeCameraSync />}

          {layers.robots && <RobotMarkers />}
          {layers.poi && <POIMarkers />}
          <AIMarkers3D />
          <HighlightRegion />
          <VolumeMeasure />
          <ProfileLineTool />
          <DistanceMeasureTool />
          <TextAnnotationTool />
          <AnnotationOverlay />

          <CameraFlyToHandler />
          <CameraTracker />
          <OrbitControls
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

      {/* deck.gl 热力图叠加层（瓦斯/温度，独立 WebGL context） */}
      <DeckGlHeatmap />

      {/* Potree 工业级点云渲染（独立 WebGL context，八叉树 LOD） */}
      <PotreeViewer />

      {/* Tech stack badges */}
      <div className="absolute bottom-3 left-3 z-20 flex gap-1 pointer-events-none">
        <span className="text-[8px] px-1.5 py-0.5 bg-[#1A1D2A]/80 text-[#A0A0B0] rounded border border-white/5">Three.js R3F</span>
        <span className="text-[8px] px-1.5 py-0.5 bg-[#1A1D2A]/80 text-[#44AAFF]/70 rounded border border-white/5">Potree LOD</span>
        <span className="text-[8px] px-1.5 py-0.5 bg-[#1A1D2A]/80 text-[#FF8800]/70 rounded border border-white/5">Open3D Backend</span>
        <span className="text-[8px] px-1.5 py-0.5 bg-[#1A1D2A]/80 text-[#FFE600]/70 rounded border border-white/5">DeepSeek AI</span>
      </div>
    </div>
  );
}

function CameraFlyToHandler() {
  const { camera } = useThree();
  const targetRef = useRef<THREE.Vector3 | null>(null);
  const animating = useRef(false);
  const startTime = useRef(0);
  const startPos = useRef(new THREE.Vector3());
  const cameraTarget = useSceneStore((s) => s.cameraTarget);
  const clearCameraTarget = useSceneStore((s) => s.clearCameraTarget);

  useEffect(() => {
    if (cameraTarget) {
      const target = cameraTarget.position;
      targetRef.current = new THREE.Vector3(target[0] + 15, target[1] + 8, target[2] + 15);
      startPos.current.copy(camera.position);
      startTime.current = performance.now();
      animating.current = true;
      setTimeout(() => clearCameraTarget(), 2500);
    }
  }, [cameraTarget, camera, clearCameraTarget]);

  useFrame(() => {
    if (animating.current && targetRef.current) {
      const elapsed = (performance.now() - startTime.current) / 1000;
      const duration = 2.0;
      const t = Math.min(elapsed / duration, 1);
      const eased = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      camera.position.lerpVectors(startPos.current, targetRef.current, eased);
      const lookAt = new THREE.Vector3(
        targetRef.current.x - 15,
        targetRef.current.y - 8,
        targetRef.current.z - 15
      );
      camera.lookAt(lookAt);
      if (t >= 1) {
        animating.current = false;
      }
    }
  });

  return null;
}
