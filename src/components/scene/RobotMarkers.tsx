import { useState } from 'react';
import { Html } from '@react-three/drei';
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

function RobotMarker({ robot, onClick }: { robot: Robot; onClick: () => void }) {
  const [hovered, setHovered] = useState(false);
  const color = STATUS_COLORS[robot.status];

  return (
    <group position={robot.position}>
      {/* 小光点 — 简洁 */}
      <mesh
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer'; }}
        onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto'; }}
      >
        <sphereGeometry args={[hovered ? 0.6 : 0.35, 8, 8]} />
        <meshBasicMaterial color={color} transparent opacity={robot.status === 'offline' ? 0.25 : 0.85} />
      </mesh>

      {hovered && (
        <Html distanceFactor={30} style={{ pointerEvents: 'none' }}>
          <div style={{
            background: 'rgba(10,10,18,0.95)',
            border: `1px solid ${color}40`,
            borderRadius: '6px',
            padding: '4px 8px',
            whiteSpace: 'nowrap',
            fontSize: '10px',
            color: '#E0E0E8',
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
  const [visibleCount, setVisibleCount] = useState(100);
  const flyTo = useSceneStore((s) => s.flyTo);
  const highlightWithTimer = useSceneStore((s) => s.highlightWithTimer);
  const openRobotDetail = useSceneStore((s) => s.openRobotDetail);

  if (loading || !robots) return null;
  const visible = robots.slice(0, visibleCount);

  const handleRobotClick = (robot: Robot) => {
    flyTo({ position: robot.position, region: `robot-${robot.id}` });
    highlightWithTimer(robot.position, 8, 5000);
    openRobotDetail(robot);
  };

  return (
    <group>
      {visible.map((robot) => (
        <RobotMarker key={robot.id} robot={robot} onClick={() => handleRobotClick(robot)} />
      ))}
      {visibleCount < robots.length && (
        <Html position={[0, 10, 0]} center style={{ pointerEvents: 'auto' }}>
          <button
            onClick={() => setVisibleCount((c) => Math.min(c + 50, robots.length))}
            style={{
              background: 'rgba(26,29,42,0.9)',
              border: '1px solid rgba(255,230,0,0.2)',
              borderRadius: '4px',
              padding: '4px 12px',
              color: '#FFE600',
              fontSize: '10px',
              cursor: 'pointer',
              fontFamily: 'monospace',
            }}
          >
            +{robots.length - visibleCount} 台未显示
          </button>
        </Html>
      )}
    </group>
  );
}
