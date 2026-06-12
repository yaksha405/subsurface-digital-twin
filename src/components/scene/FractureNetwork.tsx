import { useMemo, useState, useCallback } from 'react';
import * as THREE from 'three';
import { useSceneStore } from '../../store/useSceneStore';
import type { Fracture } from '../../types';

/**
 * 裂缝网络 — 逼真岩层裂缝渲染
 *
 * 真实裂缝特征：
 * - 扁平不规则裂面（不是圆管）
 * - 两侧岩壁有错动（位移）
 * - 裂面有粗糙纹理
 * - 从岩体表面有明确入口
 * - 分支从主裂缝节点分出
 *
 * 渲染方式：每条裂缝 = 两个不规则面（上下盘）+ 边缘线
 */

// 颜色映射
function valueToColor(
  value: number, min: number, max: number, threshold?: number
): THREE.Color {
  const t = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const color = new THREE.Color();
  if (threshold !== undefined && value >= threshold) {
    color.setRGB(1, 0.2 + (1 - t) * 0.3, 0.1);
  } else if (t < 0.33) {
    color.setRGB(0.1, 0.5 + t * 1.5, 0.9 - t * 0.5);
  } else if (t < 0.66) {
    const lt = (t - 0.33) / 0.33;
    color.setRGB(lt * 1.0, 0.85, 0.3);
  } else {
    const lt = (t - 0.66) / 0.34;
    color.setRGB(1.0, 0.85 - lt * 0.65, 0.1);
  }
  return color;
}

function getSensorMetric(
  sensors: any, scenario: string
): { value: number; min: number; max: number; threshold?: number } {
  if (scenario === 'coal') return { value: sensors.ch4_pct, min: 0, max: 5, threshold: 1.5 };
  if (scenario === 'gold') return { value: sensors.microseismic_count, min: 0, max: 30, threshold: 15 };
  return { value: sensors.pore_pressure_mpa, min: 5, max: 35, threshold: 30 };
}

export function FractureNetwork() {
  const visible = useSceneStore((s) => s.layers.fractures);
  const fractures = useSceneStore((s) => s.fractures);
  const selectedFracture = useSceneStore((s) => s.selectedFracture);
  const selectFracture = useSceneStore((s) => s.selectFracture);
  const selectFractureNode = useSceneStore((s) => s.selectFractureNode);
  const scenario = useSceneStore((s) => s.scenario);

  if (!visible || fractures.length === 0) return null;

  return (
    <group>
      {fractures.map((fracture) => (
        <FractureSurface
          key={fracture.id}
          fracture={fracture}
          isSelected={selectedFracture?.id === fracture.id}
          onSelect={selectFracture}
          scenario={scenario}
        />
      ))}
      {/* 主裂缝地表入口标记 */}
      {fractures.filter(f => f.type === 'main').map((fracture) => (
        <FractureEntrance
          key={`entrance-${fracture.id}`}
          position={fracture.path[0]}
          name={fracture.name}
        />
      ))}
      {/* 裂缝测点标记 */}
      {fractures.map((fracture) =>
        fracture.nodes.map((node) => (
          <FractureNodeMarker
            key={node.id}
            node={node}
            fractureId={fracture.id}
            scenario={scenario}
            onSelect={selectFractureNode}
          />
        ))
      )}
    </group>
  );
}

/** 裂缝地表入口标记 — 黄色圆环 + 小球 */
function FractureEntrance({
  position,
  name,
}: {
  position: [number, number, number];
  name: string;
}) {
  const [hovered, setHovered] = useState(false);
  return (
    <group
      position={position}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[hovered ? 1.8 : 1.2, 0.12, 8, 16]} />
        <meshBasicMaterial color="#FFE600" transparent opacity={hovered ? 0.9 : 0.5} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.35, 8, 8]} />
        <meshBasicMaterial color="#FFE600" />
      </mesh>
    </group>
  );
}

/**
 * 单条裂缝 — 扁平不规则裂面
 * 沿裂缝路径生成一个扁平的"隙缝"几何体：
 *   - 两条不平行的边界曲线定义裂面宽度
 *   - 上下盘各一个面，中间有缝隙
 *   - 带有 vertex colors 热力着色
 */
function FractureSurface({
  fracture,
  isSelected,
  onSelect,
  scenario,
}: {
  fracture: Fracture;
  isSelected: boolean;
  onSelect: (f: Fracture) => void;
  scenario: string;
}) {
  const [hovered, setHovered] = useState(false);
  const gasThreshold = useSceneStore((s) => s.gasThreshold);

  const { surfaceGeo, leftEdgeGeo, rightEdgeGeo } = useMemo(() => {
    const points = fracture.path.map((p) => new THREE.Vector3(...p));
    if (points.length < 2) return { surfaceGeo: null, leftEdgeGeo: null, rightEdgeGeo: null };

    // 裂缝宽度：主裂缝宽，分支窄
    const width = fracture.type === 'main' ? 4.5 : 2.5;

    // 沿路径计算法线方向（用于展宽裂缝面）
    const curve = new THREE.CatmullRomCurve3(points);
    const segments = Math.max(12, fracture.path.length * 4);
    const framePoints = curve.getPoints(segments);

    // 计算每个点的局部坐标系（切线 + 法线）
    const upVec = new THREE.Vector3(0, 1, 0);
    const surfaceVerts: number[] = [];
    const leftEdgeVerts: number[] = [];
    const rightEdgeVerts: number[] = [];
    const surfaceColors: number[] = [];

    // 传感器数据插值
    const nodeSensors = fracture.nodes.map((n) => getSensorMetric(n.sensors, scenario));

    for (let i = 0; i < framePoints.length; i++) {
      const p = framePoints[i];
      const t = i / (framePoints.length - 1);

      // 切线
      let tangent: THREE.Vector3;
      if (i === 0) tangent = framePoints[1].clone().sub(framePoints[0]);
      else if (i === framePoints.length - 1) tangent = framePoints[i].clone().sub(framePoints[i - 1]);
      else tangent = framePoints[i + 1].clone().sub(framePoints[i - 1]);
      tangent.normalize();

      // 侧向（法线的近似）
      let side = new THREE.Vector3().crossVectors(tangent, upVec);
      if (side.lengthSq() < 0.001) side = new THREE.Vector3().crossVectors(tangent, new THREE.Vector3(1, 0, 0));
      side.normalize();

      // 不规则宽度噪声
      const noiseW =
        Math.sin(p.x * 0.3 + p.z * 0.2) * 0.4 +
        Math.cos(p.y * 0.25 + p.x * 0.15) * 0.3;
      const halfW = width * (0.6 + noiseW * 0.4);

      // 不规则起伏（粗糙面）— 单面微偏移，不再产生双层
      const roughness =
        Math.sin(p.x * 0.8 + p.z * 0.5) * 0.3 +
        Math.cos(p.y * 0.6 + p.x * 0.4) * 0.2;

      // 单一裂缝面顶点（不再分上盘/下盘）
      const yOff = roughness * 0.3;
      const lx = p.x - side.x * halfW;
      const lz = p.z - side.z * halfW;
      const rx = p.x + side.x * halfW;
      const rz = p.z + side.z * halfW;

      surfaceVerts.push(lx, p.y + yOff, lz, rx, p.y - yOff, rz);
      leftEdgeVerts.push(lx, p.y + yOff, lz);
      rightEdgeVerts.push(rx, p.y - yOff, rz);

      // 颜色插值
      let value: number;
      if (nodeSensors.length === 0) {
        value = getSensorMetric(fracture.sensorReading, scenario).value;
      } else {
        const idx = t * (nodeSensors.length - 1);
        const lo = Math.floor(idx);
        const hi = Math.min(lo + 1, nodeSensors.length - 1);
        const frac = idx - lo;
        value = nodeSensors[lo].value * (1 - frac) + nodeSensors[hi].value * frac;
      }
      const metric = nodeSensors.length > 0 ? nodeSensors[0] : getSensorMetric(fracture.sensorReading, scenario);
      const threshold = scenario === 'coal' ? gasThreshold : metric.threshold;
      const c = valueToColor(value, metric.min, metric.max, threshold);
      surfaceColors.push(c.r, c.g, c.b, c.r, c.g, c.b);
    }

    // 构建 BufferGeometry
    const surfaceGeo = buildSurfaceGeo(surfaceVerts, surfaceColors, framePoints.length);

    // 双侧边缘线
    const leftEdgeGeo = new THREE.BufferGeometry();
    leftEdgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(leftEdgeVerts, 3));
    const rightEdgeGeo = new THREE.BufferGeometry();
    rightEdgeGeo.setAttribute('position', new THREE.Float32BufferAttribute(rightEdgeVerts, 3));

    return { surfaceGeo, leftEdgeGeo, rightEdgeGeo };
  }, [fracture, isSelected, hovered, scenario, gasThreshold]);

  const handleClick = useCallback(
    (e: any) => { e.stopPropagation(); onSelect(fracture); },
    [fracture, onSelect]
  );

  if (!surfaceGeo) return null;

  const emissiveColor = isSelected ? '#FFE600' : hovered ? '#FFE600' : '#000000';
  const emissiveIntensity = isSelected ? 0.4 : hovered ? 0.2 : 0;
  const edgeColor = isSelected ? '#FFE600' : hovered ? '#FFCC00' : '#8B7355';

  return (
    <group
      onClick={handleClick}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      {/* 裂缝面 — 单一表面，消除重影 */}
      <mesh geometry={surfaceGeo}>
        <meshStandardMaterial
          vertexColors
          side={THREE.DoubleSide}
          transparent
          opacity={isSelected ? 0.85 : hovered ? 0.75 : 0.65}
          emissive={emissiveColor}
          emissiveIntensity={emissiveIntensity}
          roughness={0.8}
          depthWrite={false}
        />
      </mesh>

      {/* 裂缝两侧轮廓线 */}
      <line geometry={leftEdgeGeo}>
        <lineBasicMaterial color={edgeColor} transparent opacity={isSelected ? 0.9 : 0.5} linewidth={1} />
      </line>
      <line geometry={rightEdgeGeo}>
        <lineBasicMaterial color={edgeColor} transparent opacity={isSelected ? 0.9 : 0.5} linewidth={1} />
      </line>
    </group>
  );
}

/**
 * 构建三角面片几何体（从三角带构建）
 */
function buildSurfaceGeo(
  verts: number[], colors: number[], pointCount: number
): THREE.BufferGeometry {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));

  // 索引：三角带
  const indices: number[] = [];
  for (let i = 0; i < pointCount - 1; i++) {
    const a = i * 2;
    const b = i * 2 + 1;
    const c = (i + 1) * 2;
    const d = (i + 1) * 2 + 1;
    indices.push(a, c, b);
    indices.push(b, c, d);
  }
  geo.setIndex(indices);
  geo.computeVertexNormals();
  return geo;
}

/** 裂缝测点标记 — 只显示有机器人的节点 */
function FractureNodeMarker({
  node,
  fractureId,
  scenario,
  onSelect,
}: {
  node: any;
  fractureId: string;
  scenario: string;
  onSelect: (id: string) => void;
}) {
  const [hovered, setHovered] = useState(false);

  const color = useMemo(() => {
    if (scenario === 'coal') {
      const ch4 = node.sensors.ch4_pct;
      if (ch4 > 3.0) return '#FF2222';
      if (ch4 > 1.5) return '#FF8844';
      if (ch4 > 1.0) return '#FFAA00';
    }
    if (scenario === 'gold') {
      if (node.sensors.microseismic_count > 15) return '#FF2222';
      if (node.sensors.microseismic_count > 8) return '#FF8844';
    }
    if (scenario === 'oil') {
      if (node.sensors.pore_pressure_mpa > 30) return '#FF2222';
      if (node.sensors.pore_pressure_mpa > 20) return '#FF8844';
    }
    return '#44FF88';
  }, [node.sensors, scenario]);

  const handleClick = useCallback(
    (e: any) => { e.stopPropagation(); onSelect(node.id); },
    [node.id, onSelect]
  );

  if (!node.robotId) return null;

  return (
    <group position={node.position}>
      <mesh
        onClick={handleClick}
        onPointerOver={() => setHovered(true)}
        onPointerOut={() => setHovered(false)}
      >
        <sphereGeometry args={[hovered ? 0.55 : 0.3, 6, 6]} />
        <meshBasicMaterial color={color} transparent opacity={0.7} />
      </mesh>
    </group>
  );
}
