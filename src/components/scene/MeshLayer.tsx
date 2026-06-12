import { useMemo } from 'react';
import * as THREE from 'three';
import { useFrame } from '@react-three/fiber';
import { useRef } from 'react';
import { useSceneNodes } from '../../hooks/useSceneNodes';

export function MeshLayer() {
  const meshRef = useRef<THREE.Mesh>(null);
  const { data: nodes, loading } = useSceneNodes();

  const geometry = useMemo(() => {
    if (!nodes) return null;

    // Build a tube-like tunnel surface from node centers
    const positions: number[] = [];
    const indices: number[] = [];

    // Sort nodes by Z for tunnel cross-sections
    const sorted = [...nodes].sort((a, b) => a.geometry.center.z - b.geometry.center.z);

    // Sample cross-sections at regular intervals
    const sections: THREE.Vector3[][] = [];
    const sectionInterval = 40; // nodes per section
    const pointsPerSection = 24;

    for (let i = 0; i < sorted.length; i += sectionInterval) {
      const section: THREE.Vector3[] = [];
      // Average center for this section
      let avgX = 0, avgY = 0, avgZ = 0;
      let count = 0;
      for (let j = i; j < Math.min(i + sectionInterval, sorted.length); j++) {
        avgX += sorted[j].geometry.center.x;
        avgY += sorted[j].geometry.center.y;
        avgZ += sorted[j].geometry.center.z;
        count++;
      }
      avgX /= count; avgY /= count; avgZ /= count;

      // Create cross-section ring
      for (let k = 0; k < pointsPerSection; k++) {
        const angle = (k / pointsPerSection) * Math.PI * 2;
        const radius = 4.5 + Math.sin(angle * 3 + avgZ * 0.1) * 0.5 + Math.cos(angle * 5) * 0.3;
        section.push(new THREE.Vector3(
          avgX + Math.cos(angle) * radius,
          avgY + Math.sin(angle) * radius * 0.8,
          avgZ
        ));
      }
      sections.push(section);
    }

    // Build vertices and faces
    for (const section of sections) {
      for (const v of section) {
        positions.push(v.x, v.y, v.z);
      }
    }

    // Connect adjacent sections with quads (2 triangles)
    for (let s = 0; s < sections.length - 1; s++) {
      for (let k = 0; k < pointsPerSection; k++) {
        const k2 = (k + 1) % pointsPerSection;
        const a = s * pointsPerSection + k;
        const b = s * pointsPerSection + k2;
        const c = (s + 1) * pointsPerSection + k;
        const d = (s + 1) * pointsPerSection + k2;
        indices.push(a, c, b, b, c, d);
      }
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    return geo;
  }, [nodes]);

  // Rock-like procedural material
  const material = useMemo(() => {
    return new THREE.MeshStandardMaterial({
      color: 0x2a2a30,
      roughness: 0.92,
      metalness: 0.08,
      flatShading: true,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85,
    });
  }, []);

  useFrame(() => {
    // Material doesn't need per-frame updates
  });

  // 数据未就绪时不渲染
  if (loading || !geometry) return null;

  return (
    <mesh ref={meshRef} geometry={geometry} material={material} />
  );
}
