import { useMemo } from 'react';
import * as THREE from 'three';
import { useSceneStore } from '../../store/useSceneStore';

/**
 * 岩层/土层 — 真实的地质体渲染
 *
 * 使用程序化噪声生成不规则岩体表面，多层半透明渲染出地层质感。
 * 裂缝网络嵌在岩体内部，像是岩层中开裂的真实效果。
 */
export function RockMass() {
  const visible = useSceneStore((s) => s.layers.rockMass);

  const { outerShell, innerShell, strata1, strata2, strata3 } = useMemo(() => {
    // 岩体尺寸 100×40×80
    const w = 100, h = 40, d = 80;

    // 外壳 — 不规则表面
    const outerGeo = createRockGeometry(w, h, d, 20, 8, 16, 1.5);
    // 内壳 — 稍小
    const innerGeo = createRockGeometry(w * 0.92, h * 0.88, d * 0.92, 16, 6, 12, 1.0);

    // 三层地层（模拟不同岩层）
    const s1 = createStratumLayer(w, h, d, -4, 1.5, 0x4A3C2A); // 深色下层
    const s2 = createStratumLayer(w, h, d, 4, 1.2, 0x5C4D3A);  // 中色中层
    const s3 = createStratumLayer(w, h, d, 12, 1.0, 0x6B5D4A);  // 浅色上层

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
 * 创建不规则岩体几何 — 顶点加噪声偏移
 */
function createRockGeometry(
  w: number, h: number, d: number,
  segW: number, segH: number, segD: number,
  noiseScale: number
): THREE.BufferGeometry {
  const geo = new THREE.BoxGeometry(w, h, d, segW, segH, segD);
  const pos = geo.getAttribute('position');

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const y = pos.getY(i);
    const z = pos.getZ(i);

    // 简单噪声：用 sin/cos 组合模拟不规则表面
    const nx = Math.sin(x * 0.15 + z * 0.1) * noiseScale * 0.5;
    const ny = Math.cos(y * 0.2 + x * 0.08) * noiseScale * 0.3;
    const nz = Math.sin(z * 0.12 + y * 0.15) * noiseScale * 0.5;

    // 只对表面顶点偏移（不在内部的）
    const isEdge = Math.abs(x) > w * 0.45 || Math.abs(y) > h * 0.45 || Math.abs(z) > d * 0.45;
    if (isEdge) {
      pos.setX(i, x + nx);
      pos.setY(i, y + ny);
      pos.setZ(i, z + nz);
    }
  }

  geo.computeVertexNormals();
  return geo;
}

/**
 * 创建水平地层薄层 — 模拟不同深度的岩层
 */
function createStratumLayer(
  w: number, h: number, d: number,
  yOffset: number,
  thickness: number,
  _color: number
): THREE.BufferGeometry {
  // 用不规则平面模拟地层界面
  const geo = new THREE.PlaneGeometry(w * 0.9, d * 0.9, 20, 16);
  const pos = geo.getAttribute('position');

  for (let i = 0; i < pos.count; i++) {
    const x = pos.getX(i);
    const z = pos.getY(i); // PlaneGeometry 默认在 XY 平面

    // 地层起伏
    const undulation =
      Math.sin(x * 0.08) * 2 +
      Math.cos(z * 0.06) * 1.5 +
      Math.sin(x * 0.2 + z * 0.15) * 0.8;

    pos.setZ(i, undulation); // Z 在旋转后变成 Y 方向
  }

  geo.computeVertexNormals();
  return geo;
}
