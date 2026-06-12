import { Html } from '@react-three/drei';
import { useFrame } from '@react-three/fiber';
import { useRef, useState } from 'react';
import * as THREE from 'three';
import { useAllRobots } from '../../hooks/useRobots';
import { useSceneStore } from '../../store/useSceneStore';
import type { Robot, RobotStatus } from '../../types';

const STATUS_COLORS: Record<RobotStatus, string> = {
  online: '#00FF66',
  offline: '#444444',
  low_battery: '#FFA500',
  error: '#FF3333',
  maintenance: '#4DA6FF',
};

function RobotMarker({ robot, isFocused, onClick }: { robot: Robot; isFocused: boolean; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  const color = STATUS_COLORS[robot.status];
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (ringRef.current && isFocused) {
      const t = state.clock.elapsedTime;
      const scale = 1 + Math.sin(t * 4) * 0.3;
      ringRef.current.scale.setScalar(scale);
      const mat = ringRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.5 + Math.sin(t * 4) * 0.3;
    }
  });

  const baseSize = isFocused ? 0.7 : (hovered ? 0.6 : 0.35);

  return (
    <group position={robot.position}>
      {/* 选中时的脉冲光环 */}
      {isFocused && (
        <>
          <mesh ref={ringRef}>
            <ringGeometry args={[1.2, 1.8, 24]} />
            <meshBasicMaterial color="#FFE600" transparent opacity={0.7} side={THREE.DoubleSide} />
          </mesh>
          <mesh>
            <sphereGeometry args={[0.9, 16, 16]} />
            <meshBasicMaterial color="#FFE600" transparent opacity={0.12} />
          </mesh>
        </>
      )}

      {/* 小光点 */}
      <mesh
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto'; }}
      >
        <sphereGeometry args={[baseSize, 12, 12]} />
        <meshBasicMaterial color={color} transparent opacity={robot.status === 'offline' ? 0.25 : 0.9} />
      </mesh>

      {(hovered || isFocused) && (
        <Html distanceFactor={30} style={{ pointerEvents: 'none' }}>
          <div style={{
            background: 'rgba(10,10,18,0.95)',
            border: `1px solid ${isFocused ? '#FFE600' : color}40`,
            borderRadius: '6px',
            padding: '4px 8px',
            whiteSpace: 'nowrap',
            fontSize: '10px',
            color: isFocused ? '#FFE600' : '#E0E0E8',
            fontFamily: 'monospace',
          }}>
            {robot.id}
          </div>
        </Html>
      )}
    </group>
  );
}

export function RobotMarkers() {
  const { data: robots, loading } = useAllRobots();
  const flyTo = useSceneStore((s) => s.flyTo);
  const openRobotDetail = useSceneStore((s) => s.openRobotDetail);
  const focusedRobotId = useSceneStore((s) => s.focusedRobotId);

  if (loading || !robots) return null;

  const handleRobotClick = (robot: Robot) => {
    // 放大聚焦到该机器人 — 不用大球高亮，相机贴近视即可看清
    flyTo({ position: robot.position, region: `robot-${robot.id}`, zoom: 'close' });
    openRobotDetail(robot);
  };

  return (
    <group>
      {robots.map((robot) => (
        <RobotMarker
          key={robot.id}
          robot={robot}
          isFocused={focusedRobotId === robot.id}
          onClick={() => handleRobotClick(robot)}
        />
      ))}
    </group>
  );
}
