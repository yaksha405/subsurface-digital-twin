/**
 * AI 标记 3D 渲染 — LLM 在场景中放置的危险/关键点标记
 *
 * 显示为脉冲球体 + 文字标签，按等级着色：
 * - danger: 红色脉冲
 * - warning: 橙色脉冲
 * - info: 蓝色脉冲
 */
import { useRef } from 'react';
import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSceneStore } from '../../store/useSceneStore';
import type { AIMarker } from '../../types';

const LEVEL_COLORS: Record<AIMarker['level'], string> = {
  danger: '#FF3333',
  warning: '#FFA500',
  info: '#44AAFF',
};

export function AIMarkers3D() {
  const markers = useSceneStore((s) => s.aiMarkers);
  const clearAIMarkers = useSceneStore((s) => s.clearAIMarkers);

  if (markers.length === 0) return null;

  return (
    <>
      {markers.map((marker) => (
        <AIMarkerPin key={marker.id} marker={marker} />
      ))}
      {/* 清除按钮（HTML overlay inside Canvas via drei Html） */}
      <Html position={[0, 0, 0]} center transform={false} style={{ pointerEvents: 'none' }}>
        <div style={{ position: 'absolute', top: '-200px', right: '-200px', pointerEvents: 'auto' }}>
          <button
            onClick={() => clearAIMarkers()}
            style={{
              padding: '4px 10px',
              fontSize: '10px',
              background: 'rgba(20,20,30,0.85)',
              color: '#FF6666',
              border: '1px solid rgba(255,50,50,0.3)',
              borderRadius: '6px',
              cursor: 'pointer',
              backdropFilter: 'blur(8px)',
            }}
          >
            ✕ 清除AI标记 ({markers.length})
          </button>
        </div>
      </Html>
    </>
  );
}

function AIMarkerPin({ marker }: { marker: AIMarker }) {
  const ringRef = useRef<THREE.Mesh>(null);
  const ring2Ref = useRef<THREE.Mesh>(null);
  const sphereRef = useRef<THREE.Mesh>(null);
  const color = LEVEL_COLORS[marker.level];

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    // 脉冲缩放
    if (ringRef.current) {
      const s = 1 + Math.sin(t * 3) * 0.3;
      ringRef.current.scale.setScalar(s);
      const mat = ringRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.6 - Math.sin(t * 3) * 0.3;
    }
    if (ring2Ref.current) {
      const s = 1.5 + ((t * 0.8) % 1.5);
      ring2Ref.current.scale.setScalar(s);
      const mat = ring2Ref.current.material as THREE.MeshBasicMaterial;
      mat.opacity = Math.max(0, 0.4 - ((t * 0.8) % 1.5) * 0.3);
    }
    if (sphereRef.current) {
      const s = 1 + Math.sin(t * 4) * 0.15;
      sphereRef.current.scale.setScalar(s);
    }
  });

  return (
    <group position={marker.position}>
      {/* 核心球体 */}
      <mesh ref={sphereRef}>
        <sphereGeometry args={[0.8, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.9} />
      </mesh>

      {/* 发光层 */}
      <mesh>
        <sphereGeometry args={[1.2, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.25} />
      </mesh>

      {/* 脉冲环 1 */}
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.5, 1.8, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>

      {/* 扩散环 2 */}
      <mesh ref={ring2Ref} rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[1.5, 1.7, 32]} />
        <meshBasicMaterial color={color} transparent opacity={0.3} side={THREE.DoubleSide} />
      </mesh>

      {/* 指向线（从地面向上） */}
      <mesh position={[0, 3, 0]}>
        <cylinderGeometry args={[0.06, 0.06, 6, 8]} />
        <meshBasicMaterial color={color} transparent opacity={0.4} />
      </mesh>

      {/* 文字标签 */}
      <Html position={[0, 7, 0]} center distanceFactor={40} style={{ pointerEvents: 'none' }}>
        <div
          style={{
            background: 'rgba(15,15,22,0.92)',
            backdropFilter: 'blur(8px)',
            border: `1px solid ${color}66`,
            borderRadius: '8px',
            padding: '6px 12px',
            whiteSpace: 'nowrap',
            fontSize: '12px',
            fontWeight: 600,
            color: '#E0E0E8',
            boxShadow: `0 0 16px ${color}33`,
            transform: 'translateY(-50%)',
          }}
        >
          <span style={{ color, marginRight: '6px' }}>●</span>
          {marker.label}
        </div>
      </Html>
    </group>
  );
}
