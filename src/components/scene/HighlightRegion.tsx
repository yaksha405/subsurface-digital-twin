import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useSceneStore } from '../../store/useSceneStore';

export function HighlightRegion() {
  const meshRef = useRef<THREE.Mesh>(null);
  const matRef = useRef<THREE.MeshBasicMaterial>(null);
  const highlightRegion = useSceneStore((s) => s.highlightRegion);

  useFrame((state) => {
    if (meshRef.current && matRef.current) {
      meshRef.current.position.set(...highlightRegion.position);
      if (highlightRegion.active) {
        const pulse = Math.sin(state.clock.elapsedTime * 6) * 0.5 + 0.5;
        meshRef.current.scale.setScalar(
          highlightRegion.radius * (0.8 + pulse * 0.4)
        );
        matRef.current.opacity = 0.15 + pulse * 0.25;
      } else {
        matRef.current.opacity = 0;
      }
    }
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[1, 32, 32]} />
      <meshBasicMaterial
        ref={matRef}
        color="#FFE600"
        transparent
        opacity={0}
        wireframe={false}
        side={THREE.BackSide}
      />
    </mesh>
  );
}
