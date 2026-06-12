import { useState, useCallback, useEffect, useRef } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useSceneStore } from '../../store/useSceneStore';
import { useCanvasInteraction } from './useCanvasInteraction';
import type { Annotation } from '../../types';

/**
 * 测距工具 — 点击两点测量 3D 直线距离
 *
 * 专业测量输出（对标 Surpac/Vulcan 量测功能）：
 * - 直线距离（3D斜距）
 * - 水平距离（XY 投影）
 * - 垂直高差
 * - 坡角（俯仰角）
 * - 方位角（罗盘方位）
 */
export function DistanceMeasureTool() {
  const activeTool = useSceneStore((s) => s.activeTool);
  const setActiveTool = useSceneStore((s) => s.setActiveTool);
  const addAnnotation = useSceneStore((s) => s.addAnnotation);

  const isActive = activeTool === 'distance';

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

  // === 专业测量计算 ===
  const calcMeasurements = (p0: THREE.Vector3, p1: THREE.Vector3) => {
    const dx = p1.x - p0.x;
    const dy = p1.y - p0.y;
    const dz = p1.z - p0.z;
    const slope3D = Math.sqrt(dx * dx + dy * dy + dz * dz); // 3D斜距
    const horizontal = Math.sqrt(dx * dx + dz * dz);         // 水平距离
    const slopeAngle = horizontal > 0.01 ? Math.atan2(Math.abs(dy), horizontal) * 180 / Math.PI : 0;
    // 方位角（0=北/Z+，顺时针）
    let azimuth = Math.atan2(dx, dz) * 180 / Math.PI;
    if (azimuth < 0) azimuth += 360;

    // 方位文字
    const compass = azimuth < 22.5 || azimuth >= 337.5 ? '北' :
      azimuth < 67.5 ? '东北' : azimuth < 112.5 ? '东' :
      azimuth < 157.5 ? '东南' : azimuth < 202.5 ? '南' :
      azimuth < 247.5 ? '西南' : azimuth < 292.5 ? '西' : '西北';

    return { slope3D, horizontal, dy, slopeAngle, azimuth, compass };
  };

  const handleFinish = useCallback(() => {
    if (points.length === 2) {
      const p0 = points[0];
      const p1 = points[1];
      const dist = p0.distanceTo(p1);
      const annotation: Annotation = {
        id: `anno-dist-${Date.now()}`,
        type: 'distance',
        points: [
          [p0.x, p0.y, p0.z] as [number, number, number],
          [p1.x, p1.y, p1.z] as [number, number, number],
        ],
        label: `${dist.toFixed(1)}m`,
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

  const renderLine = (start: THREE.Vector3, end: THREE.Vector3, color: string, opacity: number) => {
    const mid = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    const dir = new THREE.Vector3().subVectors(end, start);
    const len = dir.length();
    if (len < 0.01) return null;
    dir.normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    return (
      <mesh position={mid} quaternion={quat} userData={{ noRaycast: true }}>
        <cylinderGeometry args={[0.2, 0.2, len, 8]} />
        <meshBasicMaterial color={color} transparent opacity={opacity} />
      </mesh>
    );
  };

  const previewLine = points.length === 1 && previewPoint ? renderLine(points[0], previewPoint, '#44AAFF', 0.6) : null;
  const finalLine = points.length === 2 ? renderLine(points[0], points[1], '#44AAFF', 0.9) : null;

  const currentDist = points.length === 2
    ? points[0].distanceTo(points[1])
    : points.length === 1 && previewPoint
    ? points[0].distanceTo(previewPoint)
    : 0;

  const m = points.length === 2 ? calcMeasurements(points[0], points[1])
    : points.length === 1 && previewPoint ? calcMeasurements(points[0], previewPoint)
    : null;

  return (
    <>
      {previewLine}
      {finalLine}

      {points.map((p, i) => (
        <mesh key={i} position={p} userData={{ noRaycast: true }}>
          <sphereGeometry args={[0.4, 16, 16]} />
          <meshBasicMaterial color={i === 0 ? '#00FF88' : '#FF6644'} />
        </mesh>
      ))}

      {points.length === 1 && previewPoint && (
        <Html position={previewPoint} center>
          <div className="glass-panel px-2 py-1 text-[10px] text-[#44AAFF] font-mono whitespace-nowrap" style={{ pointerEvents: 'none' }}>
            {currentDist.toFixed(1)} m
          </div>
        </Html>
      )}

      {points.length === 2 && m && (
        <Html
          position={[(points[0].x + points[1].x) / 2, (points[0].y + points[1].y) / 2 + 2, (points[0].z + points[1].z) / 2]}
          center
        >
          <div className="glass-panel px-4 py-3 text-xs min-w-[200px]" style={{ pointerEvents: 'auto' }}>
            <div className="text-[#44AAFF] font-bold mb-1.5 text-[11px]">测量报告</div>
            <div className="space-y-1 text-[10px]">
              <div className="flex justify-between">
                <span className="text-[#A0A0B0]">3D 斜距</span>
                <span className="text-[#44AAFF] font-mono font-bold text-[12px]">{m.slope3D.toFixed(2)} m</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#A0A0B0]">水平距离</span>
                <span className="text-[#E0E0E8] font-mono">{m.horizontal.toFixed(2)} m</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#A0A0B0]">垂直高差</span>
                <span className="font-mono" style={{ color: m.dy >= 0 ? '#00CC66' : '#FF8844' }}>
                  {m.dy >= 0 ? '↑' : '↓'} {Math.abs(m.dy).toFixed(2)} m
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#A0A0B0]">坡角</span>
                <span className="text-[#FFCC00] font-mono">{m.slopeAngle.toFixed(1)}°</span>
              </div>
              <div className="flex justify-between">
                <span className="text-[#A0A0B0]">方位角</span>
                <span className="text-[#E0E0E8] font-mono">{m.azimuth.toFixed(0)}° {m.compass}</span>
              </div>
            </div>
            <div className="flex gap-2 mt-2.5 pt-2 border-t border-white/5">
              <button className="flex-1 px-2 py-1.5 text-[10px] bg-[#44AAFF]/20 text-[#44AAFF] rounded hover:bg-[#44AAFF]/30 transition-all" onClick={handleFinish}>确认并保存</button>
              <button className="px-2 py-1.5 text-[10px] bg-white/5 text-[#A0A0B0] rounded hover:text-[#E0E0E8] hover:bg-white/10 transition-all" onClick={handleReset}>重选</button>
            </div>
          </div>
        </Html>
      )}

      {isActive && points.length === 0 && (
        <Html position={[0, 0, 0]} center>
          <div className="glass-panel px-3 py-2 text-[10px] text-[#44AAFF] animate-pulse whitespace-nowrap" style={{ pointerEvents: 'none' }}>
            F4 测距 · 点击设置起点 · 右键拖拽可旋转视角（ESC取消）
          </div>
        </Html>
      )}
      {isActive && points.length === 1 && (
        <Html position={[0, 5, 0]} center>
          <div className="glass-panel px-3 py-2 text-[10px] text-[#44AAFF] animate-pulse whitespace-nowrap" style={{ pointerEvents: 'none' }}>
            移动鼠标预览距离 → 点击设置终点
          </div>
        </Html>
      )}
    </>
  );
}
