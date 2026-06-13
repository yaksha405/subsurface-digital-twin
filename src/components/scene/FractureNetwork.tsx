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

// 渗透率颜色映射：蓝(低) → 绿 → 黄 → 红(高)
function permeabilityColor(perm: number): THREE.Color {
  const t = Math.max(0, Math.min(1, perm / 4.0)); // 0~4 mD
  const color = new THREE.Color();
  if (t < 0.25) {
    const lt = t / 0.25;
    color.setRGB(0.1 + lt * 0.1, 0.2 + lt * 0.4, 0.9 - lt * 0.3);
  } else if (t < 0.5) {
    const lt = (t - 0.25) / 0.25;
    color.setRGB(0.2 + lt * 0.2, 0.6 + lt * 0.3, 0.6 - lt * 0.4);
  } else if (t < 0.75) {
    const lt = (t - 0.5) / 0.25;
    color.setRGB(0.4 + lt * 0.6, 0.9 - lt * 0.1, 0.2);
  } else {
    const lt = (t - 0.75) / 0.25;
    color.setRGB(1.0, 0.8 - lt * 0.6, 0.1);
  }
  return color;
}

// 应力颜色映射：绿(低) → 黄 → 红(高)
function stressColor(stress: number): THREE.Color {
  const t = Math.max(0, Math.min(1, (stress - 5) / 20)); // 5~25 MPa
  const color = new THREE.Color();
  if (t < 0.5) {
    const lt = t / 0.5;
    color.setRGB(lt * 1.0, 0.7 + lt * 0.2, 0.1);
  } else {
    const lt = (t - 0.5) / 0.5;
    color.setRGB(1.0, 0.9 - lt * 0.7, 0.1);
  }
  return color;
}

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
  if (scenario === 'pipeline') return { value: sensors.ch4_pct, min: 0, max: 40, threshold: 20 };
  if (scenario === 'nuclear') return { value: sensors.ch4_pct, min: 0, max: 100, threshold: 25 };
  if (scenario === 'refinery') return { value: sensors.rock_strength_mpa, min: 0, max: 10, threshold: 3 };
  if (scenario === 'underground') return { value: sensors.ch4_pct, min: 0, max: 8, threshold: 4 };
  return { value: sensors.pore_pressure_mpa, min: 5, max: 35, threshold: 30 };
}

export function FractureNetwork() {
  const visible = useSceneStore((s) => s.layers.fractures);
  const fractures = useSceneStore((s) => s.fractures);
  const selectedFracture = useSceneStore((s) => s.selectedFracture);
  const selectFracture = useSceneStore((s) => s.selectFracture);
  const selectFractureNode = useSceneStore((s) => s.selectFractureNode);
  const scenario = useSceneStore((s) => s.scenario);
  const highlightedFractureIds = useSceneStore((s) => s.highlightedFractureIds);

  if (!visible || fractures.length === 0) return null;

  const isPipeMode = scenario === 'pipeline' || scenario === 'nuclear' || scenario === 'refinery' || scenario === 'underground';

  return (
    <group>
      {fractures.map((fracture) =>
        isPipeMode ? (
          <PipeMesh
            key={fracture.id}
            fracture={fracture}
            isSelected={selectedFracture?.id === fracture.id}
            isHighlighted={
              highlightedFractureIds === null ? null : highlightedFractureIds.includes(fracture.id)
            }
            onSelect={selectFracture}
            scenario={scenario}
          />
        ) : (
          <FractureSurface
            key={fracture.id}
            fracture={fracture}
            isSelected={selectedFracture?.id === fracture.id}
            isHighlighted={
              highlightedFractureIds === null ? null : highlightedFractureIds.includes(fracture.id)
            }
            onSelect={selectFracture}
            scenario={scenario}
          />
        )
      )}
      {/* 入口标记 */}
      {fractures.filter(f => f.type === 'main').map((fracture) => (
        isPipeMode ? (
          <PipeEntrance key={`entrance-${fracture.id}`} position={fracture.path[0]} name={fracture.name} />
        ) : (
          <FractureEntrance key={`entrance-${fracture.id}`} position={fracture.path[0]} name={fracture.name} />
        )
      ))}
      {/* 测点标记 */}
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

// ==================== 管道渲染 ====================

/** 计算管道颜色（基于传感器数据） */
function getPipeColor(fracture: Fracture, scenario: string): string {
  const sr = fracture.sensorReading;
  if (scenario === 'pipeline') {
    if (sr.ch4_pct > 20 || sr.h2s_ppm > 50) return '#FF2222';
    if (sr.ch4_pct > 10 || sr.h2s_ppm > 20) return '#FF8844';
    if (sr.permeability_md > 0.25) return '#FFAA00';
    return '#4488CC'; // 正常 — 钢管蓝
  }
  if (scenario === 'nuclear') {
    if (sr.ch4_pct > 25 || sr.h2s_ppm > 5) return '#FF2222';
    if (sr.ch4_pct > 10 || sr.h2s_ppm > 2) return '#FF8844';
    if (sr.permeability_md > 0.1) return '#FFAA00';
    return '#4499AA'; // 正常 — 不锈钢青
  }
  if (scenario === 'refinery') {
    if (sr.ch4_pct > 20 || sr.rock_strength_mpa > 5 || sr.acoustic_emission_mv > 2000) return '#FF2222';
    if (sr.ch4_pct > 10 || sr.rock_strength_mpa > 3 || sr.acoustic_emission_mv > 1000) return '#FF8844';
    if (sr.permeability_md > 0.3 || sr.humidity_pct < 70) return '#FFAA00';
    return '#CC8844'; // 正常 — 高温合金琥珀色
  }
  if (scenario === 'underground') {
    if (sr.ch4_pct > 4 || sr.h2s_ppm > 500) return '#FF2222';
    if (sr.ch4_pct > 2 || sr.h2s_ppm > 100) return '#FF8844';
    if (sr.permeability_md > 5 || sr.temperature_c > 90) return '#44DD88';
    return '#2288CC'; // 正常 — 地下水蓝
  }
  return '#4488CC';
}

/** 3D 管道渲染 — TubeGeometry，管径基于 porosity（实际管径 m） */
function PipeMesh({
  fracture,
  isSelected,
  isHighlighted,
  onSelect,
  scenario,
}: {
  fracture: Fracture;
  isSelected: boolean;
  isHighlighted: boolean | null;
  onSelect: (f: Fracture) => void;
  scenario: string;
}) {
  const [hovered, setHovered] = useState(false);

  const { tubeGeo, joints } = useMemo(() => {
    const points = fracture.path.map((p) => new THREE.Vector3(...p));
    if (points.length < 2) return { tubeGeo: null as THREE.TubeGeometry | null, joints: [] as { pos: THREE.Vector3; r: number }[] };

    const curve = new THREE.CatmullRomCurve3(points);
    // porosity 存储的是管径(m)，直接缩放为场景半径
    const baseR = Math.max(0.2, fracture.porosity * 1.1);
    const radius = fracture.type === 'main' ? baseR : baseR * 0.6;
    const segments = Math.max(16, Math.min(60, points.length * 2));
    const geo = new THREE.TubeGeometry(curve, segments, radius, 14, false);

    // 球形接头（管端连接点）— 替代法兰环，使管道看起来像有连接节点而非封堵
    const jointR = radius * 1.3;
    const joints = [
      { pos: points[0], r: jointR },
      { pos: points[points.length - 1], r: jointR },
    ];
    return { tubeGeo: geo, joints };
  }, [fracture]);

  const handleClick = useCallback(
    (e: any) => { e.stopPropagation(); onSelect(fracture); },
    [fracture, onSelect]
  );

  if (!tubeGeo) return null;

  const baseColor = getPipeColor(fracture, scenario);
  const inRegion = isHighlighted === true;
  const filtered = isHighlighted !== null;

  const opacity = filtered ? (inRegion ? 0.95 : 0.15) : (isSelected ? 0.95 : hovered ? 0.85 : 0.75);
  const emissive = isSelected ? '#FFE600' : hovered ? '#FFCC00' : (filtered && inRegion) ? '#FFE600' : '#000000';
  const emissiveIntensity = isSelected ? 0.3 : hovered ? 0.15 : (filtered && inRegion) ? 0.25 : 0;
  const flangeColor = isSelected || hovered ? '#FFE600' : '#888899';
  const jointColor = isSelected || hovered ? '#FFE600' : '#555566';

  return (
    <group
      onClick={handleClick}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      {/* 管体 */}
      <mesh geometry={tubeGeo}>
        <meshStandardMaterial
          color={baseColor}
          transparent
          opacity={opacity}
          emissive={emissive}
          emissiveIntensity={emissiveIntensity}
          roughness={0.45}
          metalness={0.65}
          depthWrite={opacity > 0.5}
        />
      </mesh>
      {/* 球形接头（管端连接节点） */}
      {joints.map((j, i) => (
        <mesh key={`joint-${i}`} position={j.pos}>
          <sphereGeometry args={[j.r, 12, 10]} />
          <meshStandardMaterial color={jointColor} roughness={0.5} metalness={0.7} transparent opacity={opacity} />
        </mesh>
      ))}
    </group>
  );
}

/** 管道入口标记 — 红色法兰+标签 */
function PipeEntrance({ position, name }: { position: [number, number, number]; name: string }) {
  const [hovered, setHovered] = useState(false);
  return (
    <group position={position} onPointerOver={() => setHovered(true)} onPointerOut={() => setHovered(false)}>
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[hovered ? 1.5 : 1.0, 0.15, 8, 20]} />
        <meshBasicMaterial color="#FF6600" transparent opacity={hovered ? 0.9 : 0.5} />
      </mesh>
      <mesh>
        <sphereGeometry args={[0.3, 8, 8]} />
        <meshBasicMaterial color="#FF6600" />
      </mesh>
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
  isHighlighted,
  onSelect,
  scenario,
}: {
  fracture: Fracture;
  isSelected: boolean;
  isHighlighted: boolean | null;
  onSelect: (f: Fracture) => void;
  scenario: string;
}) {
  const [hovered, setHovered] = useState(false);
  const gasThreshold = useSceneStore((s) => s.gasThreshold);
  const colorMode = useSceneStore((s) => s.fractureColorMode);

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
      // 颜色：根据着色模式决定
      const metric = nodeSensors.length > 0 ? nodeSensors[0] : getSensorMetric(fracture.sensorReading, scenario);
      const threshold = scenario === 'coal' ? gasThreshold : metric.threshold;
      let c: THREE.Color;
      if (colorMode === 'permeability') {
        // 渗透率着色 — 用裂缝自身渗透率
        c = permeabilityColor(fracture.sensorReading.permeability_md);
      } else if (colorMode === 'stress') {
        // 应力着色
        c = stressColor(fracture.sensorReading.stress_mpa);
      } else {
        // 默认：gas/传感器值着色
        c = valueToColor(value, metric.min, metric.max, threshold);
      }
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
  }, [fracture, isSelected, hovered, scenario, gasThreshold, colorMode]);

  const handleClick = useCallback(
    (e: any) => { e.stopPropagation(); onSelect(fracture); },
    [fracture, onSelect]
  );

  if (!surfaceGeo) return null;

  const emissiveColor = isSelected ? '#FFE600' : hovered ? '#FFE600' : '#000000';
  const emissiveIntensity = isSelected ? 0.4 : hovered ? 0.2 : 0;
  const edgeColor = isSelected ? '#FFE600' : hovered ? '#FFCC00' : '#8B7355';

  // 传感器区域筛选：在区域内 → 高亮加亮 + 发光；不在区域 → 变暗
  const inRegion = isHighlighted === true;
  const filtered = isHighlighted !== null;
  const baseOpacity = isSelected ? 0.85 : hovered ? 0.75 : 0.65;
  const finalOpacity = filtered
    ? (inRegion ? 0.95 : 0.12)  // 区域内高亮，区域外变暗
    : baseOpacity;
  const finalEmissive = filtered && inRegion ? '#FFE600' : emissiveColor;
  const finalEmissiveIntensity = filtered && inRegion ? 0.35 : emissiveIntensity;
  const finalEdgeColor = filtered && inRegion ? '#FFE600' : edgeColor;
  const finalEdgeOpacity = filtered ? (inRegion ? 0.9 : 0.1) : (isSelected ? 0.9 : 0.5);

  return (
    <group
      onClick={handleClick}
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      {/* 裂缝面 */}
      <mesh geometry={surfaceGeo}>
        <meshStandardMaterial
          vertexColors
          side={THREE.DoubleSide}
          transparent
          opacity={finalOpacity}
          emissive={finalEmissive}
          emissiveIntensity={finalEmissiveIntensity}
          roughness={0.8}
          depthWrite={false}
        />
      </mesh>

      {/* 裂缝两侧轮廓线 */}
      <line geometry={leftEdgeGeo}>
        <lineBasicMaterial color={finalEdgeColor} transparent opacity={finalEdgeOpacity} linewidth={1} />
      </line>
      <line geometry={rightEdgeGeo}>
        <lineBasicMaterial color={finalEdgeColor} transparent opacity={finalEdgeOpacity} linewidth={1} />
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
    if (scenario === 'pipeline') {
      if (node.sensors.ch4_pct > 20 || node.sensors.h2s_ppm > 50) return '#FF2222';
      if (node.sensors.ch4_pct > 10 || node.sensors.h2s_ppm > 20) return '#FF8844';
    }
    if (scenario === 'nuclear') {
      if (node.sensors.ch4_pct > 25 || node.sensors.water_pressure_mpa > 60) return '#FF2222';
      if (node.sensors.ch4_pct > 10 || node.sensors.water_pressure_mpa > 40) return '#FF8844';
    }
    if (scenario === 'refinery') {
      if (node.sensors.ch4_pct > 20 || node.sensors.rock_strength_mpa > 5 || node.sensors.acoustic_emission_mv > 2000) return '#FF2222';
      if (node.sensors.ch4_pct > 10 || node.sensors.rock_strength_mpa > 3 || node.sensors.acoustic_emission_mv > 1000) return '#FF8844';
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
