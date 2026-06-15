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
import { useCanvasInteraction } from './useCanvasInteraction';
import { useAllRobots } from '../../hooks/useRobots';
import { snapMeasurementPoint } from '../../lib/measurementPicking';
import type { Robot } from '../../types';

interface OrbitControlsLike {
  target: THREE.Vector3;
  enabled: boolean;
  update: () => void;
}

function asOrbitControls(value: unknown): OrbitControlsLike | null {
  if (
    value &&
    typeof value === 'object' &&
    'target' in value &&
    'enabled' in value &&
    'update' in value
  ) {
    return value as OrbitControlsLike;
  }
  return null;
}

function DevProjectionBridge() {
  const { camera, gl } = useThree();
  const dataSource = useSceneStore((s) => s.dataSource);
  const scenario = useSceneStore((s) => s.scenario);
  const fractures = useSceneStore((s) => s.fractures);
  const { data: robots } = useAllRobots(dataSource, scenario);
  const lastSerialized = useRef('');

  useEffect(() => {
    if (!import.meta.env.DEV) return;

    const win = window as Window & {
      __HIVE_DEV_VIEW__?: {
        projectPoint: (point: [number, number, number]) => { x: number; y: number; visible: boolean };
      };
    };

    win.__HIVE_DEV_VIEW__ = {
      projectPoint: (point) => projectWorldToScreen(point, camera, gl.domElement),
    };

    return () => {
      delete win.__HIVE_DEV_VIEW__;
    };
  }, [camera, gl]);

  useFrame(() => {
    if (!import.meta.env.DEV) return;
    const beacon = document.querySelector('[data-testid="dev-interactions"]');
    if (!(beacon instanceof HTMLElement)) return;

    const rect = gl.domElement.getBoundingClientRect();
    const center = { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 };
    const distSq = (point: { x: number; y: number }) => {
      const dx = point.x - center.x;
      const dy = point.y - center.y;
      return dx * dx + dy * dy;
    };

    const visibleRobots = (robots ?? [])
      .map((robot) => ({
        id: robot.id,
        label: robot.task,
        point: robot.position,
        screen: projectWorldToScreen(robot.position, camera, gl.domElement),
      }))
      .filter((target) => target.screen.visible)
      .sort((a, b) => distSq(a.screen) - distSq(b.screen));

    const visibleFractureNodes = fractures
      .flatMap((fracture) => fracture.nodes
        .filter((node) => node.robotId)
        .map((node) => ({
          id: node.id,
          label: fracture.name,
          point: node.position,
          screen: projectWorldToScreen(node.position, camera, gl.domElement),
      })))
      .filter((target) => target.screen.visible)
      .sort((a, b) => distSq(a.screen) - distSq(b.screen));

    const visibleFracturePaths = fractures
      .flatMap((fracture) => fracture.path
        .filter((_, index) => index % 2 === 0)
        .map((point, index) => ({
          id: `${fracture.id}-path-${index}`,
          label: fracture.name,
          point,
          screen: projectWorldToScreen(point, camera, gl.domElement),
      })))
      .filter((target) => target.screen.visible)
      .sort((a, b) => distSq(a.screen) - distSq(b.screen));

    const payload = JSON.stringify({
      robots: visibleRobots,
      fractureNodes: visibleFractureNodes,
      fracturePaths: visibleFracturePaths,
    });

    if (payload === lastSerialized.current) return;
    lastSerialized.current = payload;

    beacon.dataset.robots = JSON.stringify(visibleRobots);
    beacon.dataset.fractureNodes = JSON.stringify(visibleFractureNodes);
    beacon.dataset.fracturePaths = JSON.stringify(visibleFracturePaths);
  });

  return null;
}

export function Scene3DCanvas() {
  const layers = useSceneStore((s) => s.layers);
  const dataSource = useSceneStore((s) => s.dataSource);
  const setCaptureScreenshot = useSceneStore((s) => s.setCaptureScreenshot);
  const activeTool = useSceneStore((s) => s.activeTool);
  const highlightActive = useSceneStore((s) => s.highlightRegion.active);
  const aiMarkerCount = useSceneStore((s) => s.aiMarkers.length);
  const clearHighlight = useSceneStore((s) => s.clearHighlight);
  const clearAIMarkers = useSceneStore((s) => s.clearAIMarkers);
  const resetSceneView = useSceneStore((s) => s.resetSceneView);
  const locale = useSceneStore((s) => s.locale);

  return (
    <div className="relative w-full h-full grid-bg overflow-hidden">
      <SceneErrorBoundary>
        <Canvas
          camera={{ position: [30, 42, 50], fov: 50, near: 0.1, far: 3000 }}
          gl={{ preserveDrawingBuffer: true, antialias: true }}
          dpr={[1, 1.5]}
          onCreated={({ gl }) => {
            gl.setClearColor('#080812');
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
          <SceneSelectionController />
          <CameraTracker />
          <DevProjectionBridge />
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
          title={locale === 'zh-CN' ? '重置视角 · 清除所有标记和高亮' : 'Reset camera and clear markers'}
          className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] bg-[#1A1D2A]/85 backdrop-blur-md text-[#E0E0E8] hover:text-[#FFE600] rounded-lg border border-white/10 hover:border-[#FFE600]/30 transition-all shadow-lg"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 12l9-9 9 9M5 10v10h14V10" />
          </svg>
          {locale === 'zh-CN' ? '全景' : 'Overview'}
        </button>

        {highlightActive && (
          <button
            onClick={() => clearHighlight()}
            title={locale === 'zh-CN' ? '关闭高亮球体' : 'Clear highlight'}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] bg-[#1A1D2A]/85 backdrop-blur-md text-[#FFE600] hover:text-[#FFF] rounded-lg border border-[#FFE600]/30 hover:border-[#FFE600]/50 transition-all shadow-lg animate-fade-in"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <circle cx="12" cy="12" r="9" />
              <path d="M9 9l6 6M15 9l-6 6" />
            </svg>
            {locale === 'zh-CN' ? '取消高亮' : 'Clear Highlight'}
          </button>
        )}

        {aiMarkerCount > 0 && (
          <button
            onClick={() => clearAIMarkers()}
            title={locale === 'zh-CN' ? '清除AI分析标记' : 'Clear AI markers'}
            className="flex items-center gap-1.5 px-2.5 py-1.5 text-[10px] bg-[#1A1D2A]/85 backdrop-blur-md text-[#FF6666] hover:text-[#FF9999] rounded-lg border border-[#FF3333]/30 hover:border-[#FF3333]/50 transition-all shadow-lg animate-fade-in"
          >
            <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M12 2v6m0 0l-3-3m3 3l3-3M5 14v6h14v-6M3 14h18" />
            </svg>
            {locale === 'zh-CN' ? `清除标记 (${aiMarkerCount})` : `Clear Markers (${aiMarkerCount})`}
          </button>
        )}
      </div>
    </div>
  );
}

function squaredDistance3D(a: [number, number, number], b: [number, number, number]) {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return dx * dx + dy * dy + dz * dz;
}

function projectWorldToScreen(
  point: [number, number, number],
  camera: THREE.Camera,
  dom: HTMLCanvasElement,
): { x: number; y: number; visible: boolean } {
  const rect = dom.getBoundingClientRect();
  const vector = new THREE.Vector3(point[0], point[1], point[2]).project(camera);
  const x = ((vector.x + 1) / 2) * rect.width + rect.left;
  const y = ((-vector.y + 1) / 2) * rect.height + rect.top;
  const visible =
    vector.z >= -1 &&
    vector.z <= 1 &&
    x >= rect.left &&
    x <= rect.right &&
    y >= rect.top &&
    y <= rect.bottom;
  return {
    x,
    y,
    visible,
  };
}

function squaredDistance2D(a: { x: number; y: number }, b: { x: number; y: number }) {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  return dx * dx + dy * dy;
}

function findNearestRobot(
  point: [number, number, number],
  robots: Robot[],
  maxDistance = 3.5
): Robot | null {
  const maxDistanceSq = maxDistance * maxDistance;
  let best: Robot | null = null;
  let bestSq = maxDistanceSq;

  for (const robot of robots) {
    const distSq = squaredDistance3D(point, robot.position);
    if (distSq <= bestSq) {
      bestSq = distSq;
      best = robot;
    }
  }

  return best;
}

function findNearestRobotByScreen(
  screen: { x: number; y: number },
  robots: Robot[],
  camera: THREE.Camera,
  dom: HTMLCanvasElement,
  maxDistancePx = 90,
): { robot: Robot; distanceSq: number } | null {
  const maxDistanceSq = maxDistancePx * maxDistancePx;
  let best: Robot | null = null;
  let bestSq = maxDistanceSq;

  for (const robot of robots) {
    const projected = projectWorldToScreen(robot.position, camera, dom);
    if (!projected.visible) continue;
    const distSq = squaredDistance2D(screen, projected);
    if (distSq <= bestSq) {
      bestSq = distSq;
      best = robot;
    }
  }

  return best ? { robot: best, distanceSq: bestSq } : null;
}

function findNearestFractureSelectionByScreen(
  screen: { x: number; y: number },
  fractures: ReturnType<typeof useSceneStore.getState>['fractures'],
  camera: THREE.Camera,
  dom: HTMLCanvasElement,
  maxDistancePx = 70,
): { fractureId: string; nodeId: string | null; point: [number, number, number]; distanceSq: number } | null {
  const nodeMaxDistanceSq = Math.max(maxDistancePx, 92) ** 2;
  const pathMaxDistanceSq = maxDistancePx * maxDistancePx;
  let bestNode: { fractureId: string; nodeId: string; point: [number, number, number]; distanceSq: number } | null = null;
  let bestNodeSq = nodeMaxDistanceSq;
  let bestPath: { fractureId: string; nodeId: null; point: [number, number, number]; distanceSq: number } | null = null;
  let bestPathSq = pathMaxDistanceSq;

  for (const fracture of fractures) {
    for (const node of fracture.nodes) {
      if (!node.robotId) continue;
      const projected = projectWorldToScreen(node.position, camera, dom);
      if (!projected.visible) continue;
      const distSq = squaredDistance2D(screen, projected);
      if (distSq <= bestNodeSq) {
        bestNodeSq = distSq;
        bestNode = { fractureId: fracture.id, nodeId: node.id, point: node.position, distanceSq: distSq };
      }
    }

    for (let i = 0; i < fracture.path.length; i += 2) {
      const point = fracture.path[i];
      const projected = projectWorldToScreen(point, camera, dom);
      if (!projected.visible) continue;
      const distSq = squaredDistance2D(screen, projected);
      if (distSq <= bestPathSq) {
        bestPathSq = distSq;
        bestPath = { fractureId: fracture.id, nodeId: null, point, distanceSq: distSq };
      }
    }
  }

  const nodePreferenceSq = 42 ** 2;
  if (bestNode && (!bestPath || bestNode.distanceSq <= bestPath.distanceSq + nodePreferenceSq)) {
    return bestNode;
  }

  return bestPath;
}

function SceneSelectionController() {
  const { camera, gl } = useThree();
  const activeTool = useSceneStore((s) => s.activeTool);
  const dataSource = useSceneStore((s) => s.dataSource);
  const scenario = useSceneStore((s) => s.scenario);
  const fractures = useSceneStore((s) => s.fractures);
  const flyTo = useSceneStore((s) => s.flyTo);
  const openRobotDetail = useSceneStore((s) => s.openRobotDetail);
  const selectFracture = useSceneStore((s) => s.selectFracture);
  const selectFractureNode = useSceneStore((s) => s.selectFractureNode);
  const highlightWithTimer = useSceneStore((s) => s.highlightWithTimer);
  const closeRobotDetail = useSceneStore((s) => s.closeRobotDetail);
  const clearSelection = useSceneStore((s) => s.clearSelection);
  const clearHighlight = useSceneStore((s) => s.clearHighlight);
  const { data: robots } = useAllRobots(dataSource, scenario);
  const downRef = useRef<{ x: number; y: number } | null>(null);
  const writeDebug = (patch: Record<string, string>) => {
    if (!import.meta.env.DEV) return;
    const beacon = document.querySelector('[data-testid="dev-selection-debug"]');
    if (!(beacon instanceof HTMLElement)) return;
    Object.entries(patch).forEach(([key, value]) => {
      beacon.dataset[key] = value;
    });
  };

  useCanvasInteraction(activeTool === 'none', {
    onPointerDown: (_point, e) => {
      downRef.current = { x: e.clientX, y: e.clientY };
      writeDebug({
        lastDown: JSON.stringify({ x: e.clientX, y: e.clientY }),
        lastSelection: 'pointer-down',
      });
    },
    onPointerUpDetail: (detail, e) => {
      const down = downRef.current;
      downRef.current = null;
      if (!down) return;

      const delta = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      writeDebug({
        lastUp: JSON.stringify({ x: e.clientX, y: e.clientY }),
        lastDelta: delta.toFixed(2),
      });
      if (delta > 6) return;

      const screenPoint = { x: e.clientX, y: e.clientY };
      const nearestRobotByScreen = robots
        ? findNearestRobotByScreen(screenPoint, robots, camera, gl.domElement)
        : null;
      const screenSelection = findNearestFractureSelectionByScreen(screenPoint, fractures, camera, gl.domElement);
      const robotDistanceSq = nearestRobotByScreen?.distanceSq ?? Number.POSITIVE_INFINITY;
      const fractureDistanceSq = screenSelection?.distanceSq ?? Number.POSITIVE_INFINITY;
      const directPreferencePx = 18;
      const directPreferenceSq = directPreferencePx * directPreferencePx;
      const robotClickPrioritySq = 38 ** 2;
      const preciseNodeClickSq = 12 ** 2;
      const directHit = detail.hit;
      const shouldPreferDirectFractureNode =
        directHit?.kind === 'robot' &&
        Boolean(screenSelection?.nodeId) &&
        fractureDistanceSq <= preciseNodeClickSq &&
        fractureDistanceSq + directPreferenceSq < robotDistanceSq;
      const shouldPreferDirectRobot =
        directHit?.kind === 'fracture' &&
        (!directHit.nodeId || fractureDistanceSq > preciseNodeClickSq) &&
        Boolean(nearestRobotByScreen) &&
        robotDistanceSq <= robotClickPrioritySq;
      const shouldSelectScreenNodeFirst =
        Boolean(screenSelection?.nodeId) &&
        (!directHit || (directHit.kind === 'fracture' && !directHit.nodeId)) &&
        (!nearestRobotByScreen || (
          fractureDistanceSq <= preciseNodeClickSq &&
          fractureDistanceSq + directPreferenceSq < robotDistanceSq
        ));

      if (directHit?.kind === 'robot' && robots && !shouldPreferDirectFractureNode) {
        const directRobot = robots.find((robot) => robot.id === directHit.robotId);
        if (directRobot) {
          flyTo({ position: directRobot.position, region: `robot-${directRobot.id}`, zoom: 'close' });
          openRobotDetail(directRobot);
          writeDebug({
            lastSelection: `direct-robot:${directRobot.id}`,
          });
          return;
        }
      }

      const shouldSelectNearbyRobotFirst =
        Boolean(nearestRobotByScreen) &&
        robotDistanceSq <= robotClickPrioritySq &&
        !(directHit?.kind === 'fracture' && Boolean(directHit.nodeId) && fractureDistanceSq <= preciseNodeClickSq);

      if (shouldSelectNearbyRobotFirst && nearestRobotByScreen) {
        flyTo({ position: nearestRobotByScreen.robot.position, region: `robot-${nearestRobotByScreen.robot.id}`, zoom: 'close' });
        openRobotDetail(nearestRobotByScreen.robot);
        writeDebug({
          lastSelection: `robot:${nearestRobotByScreen.robot.id}`,
        });
        return;
      }

      if (shouldSelectScreenNodeFirst && screenSelection) {
        const fracture = fractures.find((item) => item.id === screenSelection.fractureId);
        if (fracture) {
          selectFracture(fracture);
          selectFractureNode(screenSelection.nodeId);
          closeRobotDetail();
          flyTo({ position: screenSelection.point, region: screenSelection.nodeId ?? fracture.id, zoom: 'close' });
          setTimeout(() => highlightWithTimer(screenSelection.point, screenSelection.nodeId ? 1.6 : 2.4, 4000), 1800);
          writeDebug({
            lastSelection: `screen-fracture:${screenSelection.fractureId}:${screenSelection.nodeId ?? 'path'}`,
          });
          return;
        }
      }

      if (directHit?.kind === 'fracture' && !shouldPreferDirectRobot) {
        const directFracture = fractures.find((item) => item.id === directHit.fractureId);
        if (directFracture) {
          const directPoint =
            directHit.nodeId
              ? directFracture.nodes.find((node) => node.id === directHit.nodeId)?.position ?? detail.snap.point
              : detail.snap.point;
          selectFracture(directFracture);
          selectFractureNode(directHit.nodeId);
          closeRobotDetail();
          flyTo({ position: directPoint, region: directHit.nodeId ?? directFracture.id, zoom: 'close' });
          setTimeout(() => highlightWithTimer(directPoint, directHit.nodeId ? 1.6 : 2.4, 4000), 1800);
          writeDebug({
            lastSelection: `direct-fracture:${directFracture.id}:${directHit.nodeId ?? 'path'}`,
          });
          return;
        }
      }

      const nearestRobot = nearestRobotByScreen?.robot ?? (robots ? findNearestRobot(detail.snap.point, robots) : null);
      writeDebug({
        lastNearestRobot: nearestRobot?.id ?? '',
      });

      writeDebug({
        lastScreenFracture: screenSelection?.fractureId ?? '',
      });
      const shouldPreferFracture =
        Boolean(screenSelection) &&
        (!nearestRobotByScreen || (screenSelection?.distanceSq ?? Number.POSITIVE_INFINITY) <= nearestRobotByScreen.distanceSq);

      if (nearestRobot && !shouldPreferFracture) {
        flyTo({ position: nearestRobot.position, region: `robot-${nearestRobot.id}`, zoom: 'close' });
        openRobotDetail(nearestRobot);
        writeDebug({
          lastSelection: `robot:${nearestRobot.id}`,
        });
        return;
      }

      if (screenSelection) {
        const fracture = fractures.find((item) => item.id === screenSelection.fractureId);
        if (fracture) {
          selectFracture(fracture);
          selectFractureNode(screenSelection.nodeId);
          closeRobotDetail();
          flyTo({ position: screenSelection.point, region: screenSelection.nodeId ?? fracture.id, zoom: 'close' });
          setTimeout(() => highlightWithTimer(screenSelection.point, screenSelection.nodeId ? 1.6 : 2.4, 4000), 1800);
          writeDebug({
            lastSelection: `screen-fracture:${screenSelection.fractureId}:${screenSelection.nodeId ?? 'path'}`,
          });
          return;
        }
      }

      const snap = snapMeasurementPoint(detail.snap.point, fractures, 4);
      writeDebug({
        lastSnapTarget: snap.targetType === 'raw' ? 'raw' : `${snap.targetType}:${snap.targetId ?? ''}`,
      });
      if (snap.snapped && snap.targetType === 'node' && snap.targetId) {
        const fracture = fractures.find((item) => item.nodes.some((node) => node.id === snap.targetId));
        if (fracture) {
          selectFracture(fracture);
          selectFractureNode(snap.targetId);
          closeRobotDetail();
          flyTo({ position: snap.point, region: snap.targetId, zoom: 'close' });
          setTimeout(() => highlightWithTimer(snap.point, 1.6, 4000), 1800);
          writeDebug({
            lastSelection: `snap-node:${snap.targetId}`,
          });
          return;
        }
      }

      if (snap.snapped && snap.targetType === 'path' && snap.targetId) {
        const fracture = fractures.find((item) => item.id === snap.targetId);
        if (fracture) {
          selectFracture(fracture);
          selectFractureNode(null);
          closeRobotDetail();
          flyTo({ position: snap.point, region: fracture.id, zoom: 'close' });
          setTimeout(() => highlightWithTimer(snap.point, 2.4, 3500), 1800);
          writeDebug({
            lastSelection: `snap-path:${snap.targetId}`,
          });
          return;
        }
      }

      clearSelection();
      clearHighlight();
      writeDebug({
        lastSelection: 'cleared',
      });
    },
  });

  return null;
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
    const orbitControls = asOrbitControls(controls);
    if (orbitControls) {
      startTarget.current.copy(orbitControls.target);
      orbitControls.enabled = false;
    }

    startTime.current = performance.now();
    animating.current = true;

    const timeout = setTimeout(() => {
      animating.current = false;
      const orbitControls = asOrbitControls(controls);
      if (orbitControls) {
        orbitControls.target.copy(endTarget.current);
        orbitControls.enabled = true;
        orbitControls.update();
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
    const orbitControls = asOrbitControls(controls);
    if (orbitControls) {
      orbitControls.target.lerpVectors(startTarget.current, endTarget.current, eased);
      orbitControls.update();
    } else {
      camera.lookAt(endTarget.current);
    }
  });

  return null;
}
