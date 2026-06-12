import { useMemo } from 'react';
import * as THREE from 'three';
import { createNoise3D } from 'simplex-noise';
import { useSceneStore } from '../../store/useSceneStore';

/**
 * 岩层/土层 — 真实的地质体渲染
 *
 * 使用 simplex-noise 库生成高质量程序化噪声，替代手搓 sin/cos 组合。
 * 多层半透明渲染出地层质感。裂缝网络嵌在岩体内部。
 */
export function RockMass() {
  const visible = useSceneStore((s) => s.layers.rockMass);

  const { outerShell, innerShell, strata1, strata2, strata3 } = useMemo(() => {
    // 使用 simplex-noise 替代手搓 sin/cos
    const noise3D = createNoise3D(() => 0.42); // 固定种子保证一致

    const w = 100, h = 40, d = 80;

    const outerGeo = createRockGeometry(w, h, d, 20, 8, 16, noise3D, 2.5);
    const innerGeo = createRockGeometry(w * 0.92, h * 0.88, d * 0.92, 16, 6, 12, noise3D, 1.8);

    const s1 = createStratumLayer(w, h, d, -4, noise3D);
    const s2 = createStratumLayer(w, h, d, 4, noise3D);
    const s3 = createStratumLayer(w, h, d, 12, noise3D);

    return { outerShell: outerGeo, innerShell: innerGeo, strata1: s1, strata2: s2, strata3: s3 };
  }, []);

  if (!visible) return null;

  return (
    <group>
      {/* 外层岩壳 — DoubleSide 确保外部可见 */}
      <mesh geometry={outerShell}>
        <meshStandardMaterial
          color="#6B5635"
          roughness={0.9}
          metalness={0.02}
          transparent
          opacity={0.55}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* 内层岩壳 */}
      <mesh geometry={innerShell}>
        <meshStandardMaterial
          color="#7D6645"
          roughness={0.85}
          metalness={0.05}
          transparent
          opacity={0.42}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* 地层分界线 — 3 条水平岩层 */}
      <mesh geometry={strata1} rotation={[-Math.PI / 2, 0, 0]} position={[0, -4, 0]}>
        <meshStandardMaterial
          color="#3A2E1E"
          transparent
          opacity={0.35}
          side={THREE.DoubleSide}
          depthWrite={false}
          roughness={1}
        />
      </mesh>
      <mesh geometry={strata2} rotation={[-Math.PI / 2, 0, 0]} position={[0, 4, 0]}>
        <meshStandardMaterial
          color="#4D3E2C"
          transparent
          opacity={0.28}
          side={THREE.DoubleSide}
          depthWrite={false}
          roughness={1}
        />
      </mesh>
      <mesh geometry={strata3} rotation={[-Math.PI / 2, 0, 0]} position={[0, 12, 0]}>
        <meshStandardMaterial
          color="#5A4B38"
          transparent
          opacity={0.22}
          side={THREE.DoubleSide}
          depthWrite={false}
          roughness={1}
        />
      </mesh>

      {/* 底部岩床 */}
      <mesh position={[0, -20, 0]}>
        <boxGeometry args={[100, 1, 80]} />
        <meshStandardMaterial
          color="#2A2218"
          roughness={1}
          metalness={0}
          transparent
          opacity={0.4}
        />
      </mesh>
    </group>
  );
}

/**
 * 创建不规则岩体几何 — simplex-noise 顶点位移
 */
function createRockGeometry(
  w: number, h: number, d: number,
  segW: number, segH: number, segD: number,
  noise3D: (x: number, y: number, z: number) => number,
  noiseScale: number
): THREE.BufferGeometry {
  const geo = new THREE.BoxGeometry(w, h, d, segW, segH, segD);
  const pos = geo.getAttribute('position');

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);

    // simplex-noise：多倍频叠加（fBm），效果比 sin/cos 自然得多
    const nx = noise3D(x * 0.05, y * 0.05, z * 0.05) * noiseScale * 0.6
             + noise3D(x * 0.12, y * 0.12, z * 0.12) * noiseScale * 0.25
             + noise3D(x * 0.25, y * 0.25, z * 0.25) * noiseScale * 0.1;

    const isEdge = Math.abs(x) > w * 0.45 || Math.abs(y) > h * 0.45 || Math.abs(z) > d * 0.45;
    if (isEdge) {
      pos.setX(i, x + nx);
      pos.setY(i, y + nx * 0.6);
      pos.setZ(i, z + nx * 0.8);
    }
  }

  geo.computeVertexNormals();
  return geo;
}

/**
 * 创建水平地层薄层 — simplex-noise 起伏
 */
function createStratumLayer(
  w: number, h: number, d: number,
  yOffset: number,
  noise3D: (x: number, y: number, z: number) => number
): THREE.BufferGeometry {
  const geo = new THREE.PlaneGeometry(w * 0.9, d * 0.9, 20, 16);
  const pos = geo.getAttribute('position');

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getY(i);

    // simplex-noise 地层起伏（fBm 多倍频）
    const undulation =
      noise3D(x * 0.03, z * 0.03, yOffset * 0.1) * 3 +
      noise3D(x * 0.08, z * 0.08, yOffset * 0.1) * 1.2 +
      noise3D(x * 0.2, z * 0.2, yOffset * 0.1) * 0.5;

    pos.setZ(i, undulation);
  }

  geo.computeVertexNormals();
  return geo;
}
