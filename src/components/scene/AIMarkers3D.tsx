/**
 * AI 标记 3D 渲染 — 工业级 HUD 标牌（参考 DJI FlightHub 2）
 *
 * 设计哲学：极简 + 像素级恒定 + 精确钉扎
 * - 锚点：小型十字标记 + 地面圆环（而非球体气泡）
 * - 指向线：细虚线
 * - 标牌：结构化三行，始终面向屏幕，屏幕恒定大小
 * - 水波纹：高危点中心同心圆扩散呼吸动效
 */
import { useRef, useState } from 'react';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSceneStore } from '../../store/useSceneStore';
import type { AIMarker } from '../../types';

const LEVEL_COLORS: Record<AIMarker['level'], string> = {
  danger: '#FF3B30',
  warning: '#FFCC00',
  info: '#58A6FF',
};

export function AIMarkers3D() {
  const markers = useSceneStore((s) => s.aiMarkers);

  if (markers.length === 0) return null;

  return (
    <>
      {markers.map((marker) => (
        <AIMarkerPin key={marker.id} marker={marker} />
      ))}
    </>
  );
}

/** 将 3D 坐标投影到屏幕坐标 — 用于显示对应标记列表 */
export function AIMarkerList() {
  const markers = useSceneStore((s) => s.aiMarkers);
  const flyTo = useSceneStore((s) => s.flyTo);

  if (markers.length === 0) return null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
      {markers.map((m) => (
        <div
          key={m.id}
          onClick={() => flyTo({ position: m.position, region: m.label, zoom: 'close' })}
          style={{
            cursor: 'pointer',
            padding: '6px 10px',
            borderRadius: '4px',
            background: 'rgba(255,255,255,0.06)',
            border: '1px solid rgba(255,255,255,0.12)',
            fontSize: '12px',
            transition: 'all 0.15s',
          }}
          onMouseEnter={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.14)')}
          onMouseLeave={(e) => (e.currentTarget.style.background = 'rgba(255,255,255,0.06)')}
        >
          <span style={{ color: LEVEL_COLORS[m.level], marginRight: '6px' }}>●</span>
          {m.label}
        </div>
      ))}
    </div>
  );
}

function AIMarkerPin({ marker }: { marker: AIMarker }) {
  const color = LEVEL_COLORS[marker.level];
  const flyTo = useSceneStore((s) => s.flyTo);
  const [hovered, setHovered] = useState(false);
  const ripple1Ref = useRef<THREE.Mesh>(null);
  const ripple2Ref = useRef<THREE.Mesh>(null);
  const ripple3Ref = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    // 水波纹呼吸动效 — 三个同心圆错位扩散
    const updateRipple = (ref: typeof ripple1Ref, phase: number) => {
      if (!ref.current) return;
      const cycle = (t + phase) % 3 / 3; // 3 秒周期
      const scale = 1 + cycle * 4;
      ref.current.scale.setScalar(scale);
      const mat = ref.current.material as THREE.MeshBasicMaterial;
      mat.opacity = (1 - cycle) * 0.35;
    };
    updateRipple(ripple1Ref, 0);
    updateRipple(ripple2Ref, 1);
    updateRipple(ripple3Ref, 2);
  });

  // 判断是否高危点（需要水波纹）
  const isDanger = marker.level === 'danger';

  // 标牌内容
  const detail = marker.detail || (marker.level === 'danger' ? '预测涌水量: >50m³/h' : '需要进一步监测');
  const source = marker.source || 'LLM 多维推理';

  return (
    <group position={marker.position}>
      {/* 地面锚点 — 小型十字标记而非球体 */}
      <mesh renderOrder={2}>
        <ringGeometry args={[0.25, 0.4, 4]} />
        <meshBasicMaterial color={color} side={THREE.DoubleSide} depthTest={true} depthWrite={false} />
      </mesh>

      {/* 中心实心小点 */}
      <mesh renderOrder={2}>
        <sphereGeometry args={[0.15, 8, 8]} />
        <meshBasicMaterial color={color} depthTest={true} depthWrite={false} />
      </mesh>

      {/* 水波纹动效 — 仅高危点显示 */}
      {isDanger && (
        <>
          <mesh ref={ripple1Ref} rotation={[Math.PI / 2, 0, 0]} renderOrder={2}>
            <ringGeometry args={[0.3, 0.4, 32]} />
            <meshBasicMaterial color={color} transparent opacity={0.35} side={THREE.DoubleSide} depthTest={true} depthWrite={false} />
          </mesh>
          <mesh ref={ripple2Ref} rotation={[Math.PI / 2, 0, 0]} renderOrder={2}>
            <ringGeometry args={[0.3, 0.4, 32]} />
            <meshBasicMaterial color={color} transparent opacity={0.35} side={THREE.DoubleSide} depthTest={true} depthWrite={false} />
          </mesh>
          <mesh ref={ripple3Ref} rotation={[Math.PI / 2, 0, 0]} renderOrder={2}>
            <ringGeometry args={[0.3, 0.4, 32]} />
            <meshBasicMaterial color={color} transparent opacity={0.35} side={THREE.DoubleSide} depthTest={true} depthWrite={false} />
          </mesh>
        </>
      )}

      {/* 细虚线指向标牌 */}
      <mesh position={[0, 2, 0]} renderOrder={2}>
        <cylinderGeometry args={[0.015, 0.015, 4, 6]} />
        <meshBasicMaterial color={color} transparent opacity={0.4} depthTest={true} depthWrite={false} />
      </mesh>

      {/* HUD 标牌 — 结构化三行，无 distanceFactor 保持屏幕恒定大小 */}
      <Html position={[0, 4.5, 0]} center occlude style={{ pointerEvents: 'auto' }}>
        <div
          onClick={() => flyTo({ position: marker.position, region: marker.label, zoom: 'close' })}
          onMouseEnter={() => setHovered(true)}
          onMouseLeave={() => setHovered(false)}
          style={{
            background: 'rgba(10,12,16,0.95)',
            backdropFilter: 'blur(8px)',
            border: `1px solid ${color}40`,
            borderLeft: `3px solid ${color}`,
            borderRadius: '2px',
            padding: '8px 12px',
            minWidth: '170px',
            fontSize: '11px',
            lineHeight: 1.5,
            color: '#E0E0E8',
            boxShadow: hovered ? `0 0 20px ${color}44` : `0 4px 12px rgba(0,0,0,0.6)`,
            cursor: 'pointer',
            transition: 'box-shadow 0.15s ease',
            userSelect: 'none',
            fontFamily: '-apple-system, "SF Mono", "Segoe UI", sans-serif',
          }}
        >
          {/* 第一行：风险等级 */}
          <div style={{ color, fontWeight: 700, fontSize: '11px', marginBottom: '4px', display: 'flex', alignItems: 'center', gap: '4px' }}>
            {marker.level === 'danger' ? '⚠' : marker.level === 'warning' ? '⚡' : 'ℹ'} {marker.label}
          </div>
          {/* 第二行：关键数据 */}
          <div style={{ color: '#B0B0C0', fontSize: '10px', marginBottom: '2px' }}>
            {detail}
          </div>
          {/* 第三行：来源 */}
          <div style={{ color: '#58A6FF', fontSize: '9px', opacity: 0.8 }}>
            来源: {source}
          </div>
        </div>
      </Html>
    </group>
  );
}
