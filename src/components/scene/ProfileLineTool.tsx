import { useState, useCallback, useEffect, useRef, useMemo } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useSceneStore } from '../../store/useSceneStore';
import { useCanvasInteraction } from './useCanvasInteraction';
import type { Annotation, FractureNode } from '../../types';

const SCENE_Y_MIN = -20;
const SCENE_Y_MAX = 20;
/** 剖面"厚度"：距剖面线多少米内的裂缝节点算入截面 */
const SLICE_WIDTH = 5;

/**
 * 剖面线工具 — 点击两点画线，生成垂直截面图
 *
 * 专业用途（对标 Leapfrog Geo / Surpac / GoCAD 的剖面功能）：
 * 1. 在岩体表面点击两点定义剖面线
 * 2. 沿这条线垂直切开岩体，生成 2D 截面图
 * 3. 截面图展示该切面附近的裂缝节点分布，按传感器值着色
 * 4. 用于分析特定位置的裂缝密度、瓦斯分布、应力集中等
 */
export function ProfileLineTool() {
  const activeTool = useSceneStore((s) => s.activeTool);
  const setActiveTool = useSceneStore((s) => s.setActiveTool);
  const addAnnotation = useSceneStore((s) => s.addAnnotation);

  const isActive = activeTool === 'profile';

  const [points, setPoints] = useState<THREE.Vector3[]>([]);
  const [previewPoint, setPreviewPoint] = useState<THREE.Vector3 | null>(null);

  const pointsRef = useRef<THREE.Vector3[]>([]);

  useEffect(() => {
    if (isActive) {
      pointsRef.current = [];
      setPoints([]);
      setPreviewPoint(null);
    }
  }, [isActive]);

  useEffect(() => {
    if (!isActive) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        pointsRef.current = [];
        setPoints([]);
        setPreviewPoint(null);
        setActiveTool('none');
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isActive, setActiveTool]);

  useCanvasInteraction(isActive, {
    onPointerDown: useCallback((pt: THREE.Vector3) => {
      const pts = pointsRef.current;
      if (pts.length === 0) {
        pointsRef.current = [pt];
        setPoints([pt]);
      } else if (pts.length === 1) {
        const next = [pts[0], pt];
        pointsRef.current = next;
        setPoints(next);
        setPreviewPoint(null);
      }
    }, []),
    onPointerMove: useCallback((pt: THREE.Vector3) => {
      if (pointsRef.current.length === 1) {
        setPreviewPoint(pt);
      }
    }, []),
  });

  pointsRef.current = points;

  const handleFinish = useCallback(() => {
    if (points.length === 2) {
      const p0 = points[0];
      const p1 = points[1];
      const length = p0.distanceTo(p1);
      const annotation: Annotation = {
        id: `anno-profile-${Date.now()}`,
        type: 'profile',
        points: [
          [p0.x, p0.y, p0.z] as [number, number, number],
          [p1.x, p1.y, p1.z] as [number, number, number],
        ],
        label: `剖面 ${length.toFixed(1)}m`,
        createdAt: Date.now(),
      };
      addAnnotation(annotation);
    }
    pointsRef.current = [];
    setPoints([]);
    setPreviewPoint(null);
    setActiveTool('none');
  }, [points, addAnnotation, setActiveTool]);

  const handleReset = useCallback(() => {
    pointsRef.current = [];
    setPoints([]);
    setPreviewPoint(null);
  }, []);

  if (!isActive && points.length === 0) return null;

  const linePoints: THREE.Vector3[] = [];
  if (points.length >= 1) linePoints.push(points[0]);
  if (previewPoint && points.length === 1) linePoints.push(previewPoint);
  if (points.length === 2) linePoints.push(points[1]);

  return (
    <>
      {/* 剖面线 */}
      {linePoints.length === 2 && (
        <group>
          {(() => {
            const start = linePoints[0];
            const end = linePoints[1];
            const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
            const dir = new THREE.Vector3().subVectors(end, start);
            const len = dir.length();
            dir.normalize();
            const quat = new THREE.Quaternion().setFromUnitVectors(
              new THREE.Vector3(0, 1, 0), dir
            );
            return (
              <>
                <mesh position={mid} quaternion={quat} userData={{ noRaycast: true }}>
                  <cylinderGeometry args={[0.2, 0.2, len, 8]} />
                  <meshBasicMaterial color="#FF8800" transparent opacity={0.95} />
                </mesh>
                <mesh position={mid} quaternion={quat} userData={{ noRaycast: true }}>
                  <cylinderGeometry args={[0.45, 0.45, len, 8]} />
                  <meshBasicMaterial color="#FF8800" transparent opacity={0.12} depthWrite={false} />
                </mesh>
              </>
            );
          })()}

          {/* 竖直剖面半透明面 */}
          {points.length === 2 && (
            <ProfilePlane p0={points[0]} p1={points[1]} />
          )}

          {/* 端点标记 */}
          {linePoints.map((p, i) => (
            <group key={i} position={p}>
              <mesh userData={{ noRaycast: true }}>
                <sphereGeometry args={[0.5, 16, 16]} />
                <meshBasicMaterial color={i === 0 ? '#00FF88' : '#FF4400'} />
              </mesh>
            </group>
          ))}
        </group>
      )}

      {/* 截面图面板 — 两点确定后显示 */}
      {points.length === 2 && (
        <ProfileCrossSection
          p0={points[0]}
          p1={points[1]}
          onFinish={handleFinish}
          onReset={handleReset}
        />
      )}

      {/* 引导提示 */}
      {isActive && points.length === 0 && (
        <Html position={[0, 0, 0]} center>
          <div className="glass-panel px-3 py-2 text-[10px] text-[#FF8800] animate-pulse whitespace-nowrap" style={{ pointerEvents: 'none' }}>
            F1 剖面线 · 点击两点定义切面 · 查看截面裂缝分布（右键旋转·ESC取消）
          </div>
        </Html>
      )}
      {isActive && points.length === 1 && (
        <Html position={[0, 5, 0]} center>
          <div className="glass-panel px-3 py-2 text-[10px] text-[#FF8800] animate-pulse whitespace-nowrap" style={{ pointerEvents: 'none' }}>
            移动鼠标预览 → 点击设置终点 → 生成截面图
          </div>
        </Html>
      )}
    </>
  );
}

/** 竖直剖面半透明面 */
function ProfilePlane({ p0, p1 }: { p0: THREE.Vector3; p1: THREE.Vector3 }) {
  const height = SCENE_Y_MAX - SCENE_Y_MIN;
  const midX = (p0.x + p1.x) / 2;
  const midZ = (p0.z + p1.z) / 2;
  const width = Math.max(0.1, p0.distanceTo(p1));
  const dir = new THREE.Vector3().subVectors(p1, p0).normalize();
  const angle = Math.atan2(dir.x, dir.z);
  const hw = width / 2;
  const hh = height / 2;
  const positions = new Float32Array([
    -hw, -hh, 0,  hw, -hh, 0,  hw, hh, 0,
    -hw, -hh, 0,  hw, hh, 0,  -hw, hh, 0,
  ]);
  const edgePositions = new Float32Array([
    -hw, -hh, 0,  hw, -hh, 0,
     hw, -hh, 0,  hw, hh, 0,
     hw,  hh, 0, -hw, hh, 0,
    -hw,  hh, 0, -hw, -hh, 0,
  ]);
  return (
    <group position={[midX, 0, midZ]} rotation={[0, -angle, 0]}>
      <mesh userData={{ noRaycast: true }}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={6} array={positions} itemSize={3} />
        </bufferGeometry>
        <meshBasicMaterial color="#FF8800" transparent opacity={0.08} side={THREE.DoubleSide} depthWrite={false} />
      </mesh>
      <lineSegments userData={{ noRaycast: true }}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={8} array={edgePositions} itemSize={3} />
        </bufferGeometry>
        <lineBasicMaterial color="#FF8800" transparent opacity={0.4} />
      </lineSegments>
    </group>
  );
}

/** 截面图 — SVG 2D 投影展示 */
function ProfileCrossSection({
  p0, p1, onFinish, onReset
}: {
  p0: THREE.Vector3;
  p1: THREE.Vector3;
  onFinish: () => void;
  onReset: () => void;
}) {
  const fractures = useSceneStore((s) => s.fractures);
  const scenario = useSceneStore((s) => s.scenario);
  const gasThreshold = useSceneStore((s) => s.gasThreshold);
  const profileLen = p0.distanceTo(p1);

  // 主传感器字段名（按场景）
  const sensorKey = scenario === 'coal' ? 'ch4_pct' : scenario === 'gold' ? 'stress_mpa' : 'pore_pressure_mpa';
  const sensorLabel = scenario === 'coal' ? 'CH4%' : scenario === 'gold' ? '应力MPa' : '孔压MPa';

  // 投影裂缝节点到剖面平面 + 分段密度 + RQD
  const { projected, maxVal, dangerous, segmentDensity, rqd, avgVal } = useMemo(() => {
    const lineDir = new THREE.Vector3().subVectors(p1, p0);
    const lineLen = lineDir.length();
    if (lineLen < 0.01) return { projected: [], maxVal: 1, dangerous: 0, segmentDensity: [] as number[], rqd: 100, avgVal: 0 };
    lineDir.normalize();

    const normal = new THREE.Vector3(-lineDir.z, 0, lineDir.x);

    const pts: { x: number; y: number; val: number; nodeId: string; fractureName: string }[] = [];
    let mx = 0.01;
    let sumVal = 0;
    let dCount = 0;

    // 分段密度统计
    const SEGMENTS = 10;
    const segCounts = new Array(SEGMENTS).fill(0);

    for (const f of fractures) {
      for (const n of f.nodes) {
        const np = new THREE.Vector3(n.position[0], n.position[1], n.position[2]);
        const toNode = new THREE.Vector3().subVectors(np, p0);
        const along = toNode.dot(lineDir);
        if (along < -2 || along > lineLen + 2) continue;
        const lateral = Math.abs(toNode.dot(normal));
        if (lateral > SLICE_WIDTH) continue;

        const val = (n.sensors as Record<string, number>)[sensorKey] || 0;
        mx = Math.max(mx, val);
        sumVal += val;

        const isDangerous = scenario === 'coal'
          ? val > gasThreshold
          : scenario === 'gold'
          ? val > 15
          : val > 20;
        if (isDangerous) dCount++;

        pts.push({ x: Math.max(0, Math.min(lineLen, along)), y: n.position[1], val, nodeId: n.id, fractureName: f.name });

        const segIdx = Math.min(SEGMENTS - 1, Math.floor((along / lineLen) * SEGMENTS));
        if (segIdx >= 0) segCounts[segIdx]++;
      }
    }

    // RQD 估算：基于节点间距
    const sorted = [...pts].sort((a, b) => a.x - b.x);
    let intactCount = 0;
    for (let i = 0; i < sorted.length; i++) {
      if (i === 0 || (sorted[i].x - sorted[i - 1].x) > lineLen * 0.1) intactCount++;
    }
    const rqdVal = sorted.length > 0 ? Math.min(100, (intactCount / sorted.length) * 100) : 100;

    return { projected: pts, maxVal: mx, dangerous: dCount, segmentDensity: segCounts, rqd: rqdVal, avgVal: pts.length > 0 ? sumVal / pts.length : 0 };
  }, [fractures, p0, p1, sensorKey, scenario, gasThreshold]);

  const lineLen = profileLen;

  // SVG 尺寸
  const svgW = 300;
  const svgH = 180;
  const padL = 32, padR = 8, padT = 8, padB = 28;
  const plotW = svgW - padL - padR;
  const plotH = svgH - padT - padB;
  const densityBandH = 14;

  // 坐标映射
  const xScale = (x: number) => padL + (x / Math.max(0.1, lineLen)) * plotW;
  const yScale = (y: number) => padT + (1 - (y - SCENE_Y_MIN) / (SCENE_Y_MAX - SCENE_Y_MIN)) * plotH;

  // 颜色映射：蓝→青→黄→红
  const getColor = (val: number) => {
    const t = Math.min(1, val / Math.max(0.01, maxVal));
    if (t < 0.25) return '#4488FF';
    if (t < 0.5) return '#00CCAA';
    if (t < 0.75) return '#FFCC00';
    return '#FF4422';
  };

  // 阈值线 Y 像素位置
  const thresholdVal = scenario === 'coal' ? gasThreshold : scenario === 'gold' ? 15 : 20;

  return (
    <Html
      position={[(p0.x + p1.x) / 2, SCENE_Y_MAX + 5, (p0.z + p1.z) / 2]}
      center
    >
      <div className="glass-panel p-3 min-w-[320px]" style={{ pointerEvents: 'auto' }}>
        {/* 标题栏 + 风险等级 */}
        <div className="flex items-center justify-between mb-2">
          <span className="text-[#FF8800] font-bold text-[11px]">剖面截面分析</span>
          <span className="px-1.5 py-0.5 rounded text-[8px] font-bold" style={{
            background: `${dangerous === 0 ? '#00CC66' : dangerous <= projected.length * 0.2 ? '#FFCC00' : dangerous <= projected.length * 0.5 ? '#FF8800' : '#FF3333'}20`,
            color: dangerous === 0 ? '#00CC66' : dangerous <= projected.length * 0.2 ? '#FFCC00' : dangerous <= projected.length * 0.5 ? '#FF8800' : '#FF3333'
          }}>
            {dangerous === 0 ? '安全' : dangerous <= projected.length * 0.2 ? '低风险' : dangerous <= projected.length * 0.5 ? '中风险' : '高风险'}
          </span>
        </div>

        {/* SVG 截面图 */}
        <svg width={svgW} height={svgH} className="block">
          {/* 背景 */}
          <rect x={padL} y={padT} width={plotW} height={plotH} fill="#0A0C14" stroke="#1A1D2A" strokeWidth={0.5} />

          {/* Y 轴刻度 */}
          {[SCENE_Y_MIN, -10, 0, 10, SCENE_Y_MAX].map((y) => (
            <g key={y}>
              <line x1={padL} y1={yScale(y)} x2={svgW - padR} y2={yScale(y)} stroke="#1A1D2A" strokeWidth={0.3} />
              <text x={padL - 4} y={yScale(y) + 3} fill="#606070" fontSize={7} textAnchor="end">{y}</text>
            </g>
          ))}

          {/* X 轴刻度 */}
          {[0, lineLen * 0.25, lineLen * 0.5, lineLen * 0.75, lineLen].map((x) => (
            <text key={x} x={xScale(x)} y={svgH - padB + densityBandH + 10} fill="#606070" fontSize={7} textAnchor="middle">{x.toFixed(0)}</text>
          ))}

          {/* 底部分段密度热力带 */}
          <text x={padL - 4} y={svgH - padB + 8} fill="#808890" fontSize={6} textAnchor="end">密度</text>
          {segmentDensity.length > 0 && (() => {
            const maxSeg = Math.max(1, ...segmentDensity);
            return segmentDensity.map((count, i) => {
              const segW = plotW / segmentDensity.length;
              const segX = padL + i * segW;
              const t = count / maxSeg;
              const color = t < 0.25 ? 'rgba(0,204,170,0.5)' : t < 0.5 ? 'rgba(255,204,0,0.6)' : t < 0.75 ? 'rgba(255,136,0,0.7)' : 'rgba(255,68,34,0.8)';
              return <rect key={i} x={segX} y={svgH - padB + 2} width={segW - 0.5} height={densityBandH - 2} fill={color} rx={1}><title>{`段${i + 1}: ${count}个`}</title></rect>;
            });
          })()}

          {/* 阈值线 */}
          {thresholdVal <= maxVal && (
            <text x={svgW - padR - 2} y={padT + 8} fill="#FF4422" fontSize={6.5} textAnchor="end">
              ⚠ 阈值 {thresholdVal}
            </text>
          )}

          {/* 裂缝节点 */}
          {projected.map((p, i) => {
            const color = getColor(p.val);
            const isDangerous = scenario === 'coal'
              ? p.val > gasThreshold
              : scenario === 'gold'
              ? p.val > 15
              : p.val > 20;
            return (
              <g key={i}>
                {isDangerous && (
                  <circle cx={xScale(p.x)} cy={yScale(p.y)} r={4} fill={color} opacity={0.2}>
                    <animate attributeName="r" values="3;6;3" dur="1.5s" repeatCount="indefinite" />
                  </circle>
                )}
                <circle
                  cx={xScale(p.x)} cy={yScale(p.y)}
                  r={isDangerous ? 3 : 2}
                  fill={color}
                  opacity={0.85}
                />
              </g>
            );
          })}

          {/* 轴标签 */}
          <text x={padL + plotW / 2} y={svgH - 4} fill="#808090" fontSize={7} textAnchor="middle">沿线距离 (m)</text>
          <text x={8} y={padT + plotH / 2} fill="#808090" fontSize={7} textAnchor="middle"
            transform={`rotate(-90, 8, ${padT + plotH / 2})`}>深度 (m)</text>
        </svg>

        {/* 统计栏 — 6列：节点/超阈值/峰值/均值/RQD/岩质 */}
        <div className="grid grid-cols-6 gap-1 mt-2 text-[8px]">
          <div className="text-center px-0.5 py-1 bg-[#0F0F16]/60 rounded">
            <div className="text-[#A0A0B0]">节点</div>
            <div className="text-[#E0E0E8] font-mono font-bold">{projected.length}</div>
          </div>
          <div className="text-center px-0.5 py-1 bg-[#0F0F16]/60 rounded">
            <div className="text-[#A0A0B0]">超阈值</div>
            <div className={`font-mono font-bold ${dangerous > 0 ? 'text-[#FF4422]' : 'text-[#00CCAA]'}`}>{dangerous}</div>
          </div>
          <div className="text-center px-0.5 py-1 bg-[#0F0F16]/60 rounded">
            <div className="text-[#A0A0B0]">峰值</div>
            <div className="text-[#FFCC00] font-mono font-bold">{maxVal.toFixed(1)}</div>
          </div>
          <div className="text-center px-0.5 py-1 bg-[#0F0F16]/60 rounded">
            <div className="text-[#A0A0B0]">均值</div>
            <div className="text-[#88AAFF] font-mono font-bold">{avgVal.toFixed(1)}</div>
          </div>
          <div className="text-center px-0.5 py-1 bg-[#0F0F16]/60 rounded">
            <div className="text-[#A0A0B0]">RQD</div>
            <div className="font-mono font-bold" style={{ color: rqd > 75 ? '#00CC66' : rqd > 50 ? '#88CC00' : rqd > 25 ? '#FFA500' : '#FF3333' }}>{rqd.toFixed(0)}</div>
          </div>
          <div className="text-center px-0.5 py-1 bg-[#0F0F16]/60 rounded">
            <div className="text-[#A0A0B0]">岩质</div>
            <div className="font-mono font-bold" style={{ color: rqd > 75 ? '#00CC66' : rqd > 50 ? '#88CC00' : rqd > 25 ? '#FFA500' : '#FF3333' }}>
              {rqd > 75 ? 'Ⅰ优' : rqd > 50 ? 'Ⅱ良' : rqd > 25 ? 'Ⅲ差' : 'Ⅳ劣'}
            </div>
          </div>
        </div>

        {/* 色标 */}
        <div className="flex items-center gap-1.5 mt-1.5 text-[7px] text-[#606070]">
          <span>低</span>
          <div className="flex-1 h-1.5 rounded-full" style={{ background: 'linear-gradient(90deg, #4488FF, #00CCAA, #FFCC00, #FF4422)' }} />
          <span>高</span>
          <span className="ml-1">{sensorLabel}</span>
        </div>

        <div className="flex gap-2 mt-2 pt-2 border-t border-white/5">
          <button
            className="flex-1 px-2 py-1.5 text-[10px] bg-[#FF8800]/20 text-[#FF8800] rounded hover:bg-[#FF8800]/30 transition-all"
            onClick={onFinish}
          >确认并保存</button>
          <button
            className="px-2 py-1.5 text-[10px] bg-white/5 text-[#A0A0B0] rounded hover:text-[#E0E0E8] hover:bg-white/10 transition-all"
            onClick={onReset}
          >重选</button>
        </div>
      </div>
    </Html>
  );
}
