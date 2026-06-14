/**
 * 裂缝网络数据生成器
 * 基于论文真实数据参数生成 mock 数据
 *
 * 核心规则：
 * - 主裂缝从岩体表面有入口，向内部延伸
 * - 分支从主裂缝节点分叉（蛛网状连通）
 * - 机器人部署在裂缝网络中（不是随机散布）
 * - 岩体范围: x[-50,50], y[-20,20], z[-40,40]
 *
 * 参考文献：
 * - Huang et al. 2024 (Frontiers in Earth Science) — 裂缝开度38-68µm, 渗透率0.01-4mD
 * - 煤矿安全规程 — CH4安全阈值1.0%, CO安全阈值24ppm
 * - 井下实测典型温度22-45°C, 地应力5-40MPa
 */

import type { Fracture, SensorReading, ScenarioType } from '../types';

type GeologicalScenario = 'coal' | 'gold' | 'oil';

// 随机工具
const rand = (min: number, max: number) => min + Math.random() * (max - min);
const randInt = (min: number, max: number) => Math.floor(rand(min, max + 1));
const pick = <T>(arr: T[]): T => arr[Math.floor(Math.random() * arr.length)];
const randRange = (range: readonly [number, number]) => rand(range[0], range[1]);
const randIntRange = (range: readonly [number, number]) => randInt(range[0], range[1]);
const toGeologicalScenario = (scenario: ScenarioType): GeologicalScenario =>
  scenario === 'gold' || scenario === 'oil' ? scenario : 'coal';

// 场景传感器范围（基于论文数据）
const SCENARIO_RANGES: Record<GeologicalScenario, Record<string, readonly [number, number]>> = {
  coal: {
    ch4_pct: [0.1, 4.5],
    co_ppm: [0, 50],
    h2s_ppm: [0, 15],
    temperature_c: [22, 45],
    stress_mpa: [5, 25],
    stress_sigma1: [9, 17],
    stress_sigma2: [6, 14],
    stress_sigma3: [8, 16],
    permeability_md: [0.01, 4.0],
    water_pressure_mpa: [0.5, 8.0],
    microseismic_count: [0, 25],
    acoustic_emission_mv: [0, 5000],
    humidity_pct: [40, 95],
    fracture_aperture_um: [38, 68],
  },
  gold: {
    stress_mpa: [8, 35],
    stress_sigma1: [12, 30],
    stress_sigma2: [8, 20],
    stress_sigma3: [6, 15],
    temperature_c: [25, 50],
    displacement_mm: [0, 12],
    microseismic_count: [0, 30],
    acoustic_emission_mv: [0, 8000],
    permeability_md: [0.001, 2.0],
    rock_strength_mpa: [30, 120],
    fracture_aperture_um: [20, 55],
    humidity_pct: [35, 85],
    water_pressure_mpa: [0.2, 5.0],
    ch4_pct: [0, 0.1],
    co_ppm: [0, 2],
    h2s_ppm: [0, 1],
  },
  oil: {
    pore_pressure_mpa: [5, 35],
    permeability_md: [0.01, 100],
    porosity_pct: [2, 25],
    fracture_aperture_um: [10, 300],
    temperature_c: [30, 90],
    stress_mpa: [10, 45],
    stress_sigma1: [15, 40],
    stress_sigma2: [10, 25],
    stress_sigma3: [8, 18],
    fluid_ph: [5.5, 8.5],
    salinity_ppm: [5000, 80000],
    gas_oil_ratio: [100, 5000],
    water_saturation_pct: [10, 60],
    humidity_pct: [20, 70],
    ch4_pct: [0, 0.1],
    co_ppm: [0, 2],
    h2s_ppm: [0, 5],
    water_pressure_mpa: [2, 30],
    microseismic_count: [0, 5],
    acoustic_emission_mv: [0, 500],
    displacement_mm: [0, 2],
    rock_strength_mpa: [20, 80],
  },
};

function genSensorReading(scenario: GeologicalScenario): SensorReading {
  const ranges = SCENARIO_RANGES[scenario];
  return {
    ch4_pct: +randRange(ranges.ch4_pct || [0, 0]).toFixed(2),
    co_ppm: +randRange(ranges.co_ppm || [0, 2]).toFixed(1),
    h2s_ppm: +randRange(ranges.h2s_ppm || [0, 1]).toFixed(1),
    temperature_c: +randRange(ranges.temperature_c).toFixed(1),
    stress_mpa: +randRange(ranges.stress_mpa).toFixed(2),
    stress_sigma1: +randRange(ranges.stress_sigma1 || ranges.stress_mpa).toFixed(2),
    stress_sigma2: +randRange(ranges.stress_sigma2 || ranges.stress_mpa).toFixed(2),
    stress_sigma3: +randRange(ranges.stress_sigma3 || ranges.stress_mpa).toFixed(2),
    permeability_md: +randRange(ranges.permeability_md).toFixed(4),
    water_pressure_mpa: +randRange(ranges.water_pressure_mpa || [0, 1]).toFixed(2),
    microseismic_count: randIntRange(ranges.microseismic_count || [0, 2]),
    acoustic_emission_mv: +randRange(ranges.acoustic_emission_mv || [0, 100]).toFixed(0),
    humidity_pct: +randRange(ranges.humidity_pct).toFixed(1),
    fracture_aperture_um: +randRange(ranges.fracture_aperture_um).toFixed(1),
    displacement_mm: +randRange(ranges.displacement_mm || [0, 0.5]).toFixed(2),
    rock_strength_mpa: +randRange(ranges.rock_strength_mpa || [50, 80]).toFixed(1),
    pore_pressure_mpa: +randRange(ranges.pore_pressure_mpa || [0, 1]).toFixed(2),
    porosity_pct: +randRange(ranges.porosity_pct || [0, 5]).toFixed(1),
    fluid_ph: +randRange(ranges.fluid_ph || [7, 7.5]).toFixed(1),
    water_saturation_pct: +randRange(ranges.water_saturation_pct || [0, 10]).toFixed(1),
  };
}

// ==================== 路径生成器 ====================

/** 从岩体表面出发、朝指定方向延伸的裂缝路径 */
function generateSurfacePath(
  surfacePoint: [number, number, number],
  dirInward: [number, number, number],
  length: number,
  roughness: number
): [number, number, number][] {
  const points: [number, number, number][] = [[...surfacePoint]];
  const segments = Math.max(10, Math.floor(length / 2));
  let [x, y, z] = surfacePoint;

  const mag = Math.sqrt(dirInward[0] ** 2 + dirInward[1] ** 2 + dirInward[2] ** 2);
  let dx = dirInward[0] / mag;
  let dy = dirInward[1] / mag;
  let dz = dirInward[2] / mag;

  for (let i = 1; i <= segments; i++) {
    const step = length / segments;
    dx += rand(-0.08, 0.08);
    dy += rand(-0.04, 0.04);
    dz += rand(-0.08, 0.08);
    const m = Math.sqrt(dx * dx + dy * dy + dz * dz);
    dx /= m; dy /= m; dz /= m;

    x += dx * step + rand(-roughness, roughness) * step * 0.2;
    y += dy * step + rand(-roughness, roughness) * step * 0.1;
    z += dz * step + rand(-roughness, roughness) * step * 0.2;
    // 钳制：裂缝不超过地表 (Y ≤ 18) 且不低于岩体底部 (Y ≥ -19)
    y = Math.min(18, Math.max(-19, y));
    points.push([+x.toFixed(1), +y.toFixed(1), +z.toFixed(1)]);
  }
  return points;
}

/** 从某个内部点出发的自由延伸路径（分支用） */
function generateBranchPath(
  origin: [number, number, number],
  length: number,
  roughness: number
): [number, number, number][] {
  const points: [number, number, number][] = [[...origin]];
  const segments = Math.max(6, Math.floor(length / 2));
  let [x, y, z] = origin;

  // 分支方向总体向下偏（避免裂缝浮到地表之上）
  const dirX = rand(-1, 1);
  const dirY = rand(-0.8, -0.1); // 始终向下
  const dirZ = rand(-1, 1);
  const mag = Math.sqrt(dirX * dirX + dirY * dirY + dirZ * dirZ);

  for (let i = 1; i <= segments; i++) {
    const step = length / segments;
    x += (dirX / mag) * step + rand(-roughness, roughness) * step * 0.3;
    y += (dirY / mag) * step + rand(-roughness, roughness) * step * 0.15;
    z += (dirZ / mag) * step + rand(-roughness, roughness) * step * 0.3;
    // 钳制：裂缝不超过地表 (Y ≤ 17) 且不低于岩体底部 (Y ≥ -19)
    y = Math.min(17, Math.max(-19, y));
    points.push([+x.toFixed(1), +y.toFixed(1), +z.toFixed(1)]);
  }
  return points;
}

// ==================== 裂缝构建 ====================

const FRACTURE_NAMES = [
  'F-1', 'F-2', 'F-3', 'F-4', 'F-5', 'F-6', 'F-7', 'F-8', 'F-9', 'F-10',
  'F-11', 'F-12', 'F-A1', 'F-A2', 'F-B1', 'F-B2', 'F-C1', 'F-C2',
];

/** 从已有路径构建裂缝实体 */
function buildFracture(
  id: number,
  path: [number, number, number][],
  scenario: GeologicalScenario,
  isMain: boolean,
  parentId: string | null
): Fracture {
  const ranges = SCENARIO_RANGES[scenario];
  const fracture: Fracture = {
    id: `F-${String(id).padStart(3, '0')}`,
    name: FRACTURE_NAMES[id % FRACTURE_NAMES.length],
    type: isMain ? 'main' : 'branch',
    path,
    length: +pathLength(path).toFixed(1),
    aperture_um: +randRange(ranges.fracture_aperture_um).toFixed(1),
    porosity: +(rand(0.005, 0.035)).toFixed(4),
    fractal_dim: +(rand(2.03, 2.35)).toFixed(4),
    tortuosity: +(rand(1.05, 1.25)).toFixed(4),
    dip_angle: +rand(2, 38).toFixed(1),
    azimuth_angle: +rand(0, 360).toFixed(1),
    roughness_coeff: +rand(0.1, 0.6).toFixed(2),
    connectivity: randInt(1, 6),
    sensorReading: genSensorReading(scenario),
    nodes: [],
    parentFractureId: parentId,
  };

  // 在路径上生成测点（每隔几个路径点放一个传感器节点）
  const nodeCount = Math.max(3, Math.floor(path.length / 3));
  for (let i = 0; i < nodeCount; i++) {
    const pathIdx = Math.floor((i / nodeCount) * (path.length - 1));
    fracture.nodes.push({
      id: `${fracture.id}-N${i}`,
      position: path[pathIdx],
      sensors: genSensorReading(scenario),
      timestamp: Date.now() - randInt(0, 300000),
      robotId: null, // 稍后统一分配
    });
  }

  return fracture;
}

/** 计算路径总长度 */
function pathLength(path: [number, number, number][]): number {
  let len = 0;
  for (let i = 1; i < path.length; i++) {
    const dx = path[i][0] - path[i - 1][0];
    const dy = path[i][1] - path[i - 1][1];
    const dz = path[i][2] - path[i - 1][2];
    len += Math.sqrt(dx * dx + dy * dy + dz * dz);
  }
  return len;
}

// ==================== 裂缝网络 + 机器人统一生成 ====================

/** 缓存（按场景分别缓存，切换场景时重新生成） */
const cache: Partial<Record<ScenarioType, Fracture[]>> = {};
let cachedNodePositions: [number, number, number][] = [];

/** 生成完整裂缝网络（主裂缝从地表 Y≈20 向下延伸，分支从主裂缝分叉） */
export function generateFractureNetwork(scenario: ScenarioType): Fracture[] {
  if (cache[scenario]) return cache[scenario]!;
  const geologicalScenario = toGeologicalScenario(scenario);

  const fractures: Fracture[] = [];

  // === 6 条主裂缝：起点都在岩体顶部地表(Y≈18~20)，向下延伸 ===
  // 每个裂缝入口在地表的不同XZ位置，方向总体向下
  const surfaceEntries: { origin: [number, number, number]; dirInward: [number, number, number] }[] = [
    { origin: [-35, 18, -20], dirInward: [0.3, -1, 0.2] },
    { origin: [10, 19, -15], dirInward: [-0.2, -1, -0.1] },
    { origin: [-10, 20, 20], dirInward: [0.1, -1, -0.3] },
    { origin: [30, 18, 5], dirInward: [-0.3, -1, 0.1] },
    { origin: [-40, 19, 10], dirInward: [0.2, -1, -0.2] },
    { origin: [20, 20, -30], dirInward: [-0.1, -1, 0.3] },
  ];

  for (let i = 0; i < surfaceEntries.length; i++) {
    const { origin, dirInward } = surfaceEntries[i];
    const path = generateSurfacePath(origin, dirInward, rand(25, 65), rand(0.3, 1.2));
    fractures.push(buildFracture(i, path, geologicalScenario, true, null));
  }

  // === 12 条分支裂缝：从主裂缝的测点分叉 ===
  for (let i = 0; i < 12; i++) {
    const parent = pick(fractures.slice(0, 6));
    const branchOrigin = pick(parent.nodes).position;
    const path = generateBranchPath(branchOrigin as [number, number, number], rand(5, 25), rand(0.3, 1.0));
    fractures.push(buildFracture(6 + i, path, geologicalScenario, false, parent.id));
  }

  // === 分配机器人到裂缝节点 ===
  assignRobotsToNodes(fractures);

  // 收集所有节点位置供外部使用
  cachedNodePositions = fractures.flatMap((f) => f.nodes.map((n) => n.position));
  // 收集所有路径点（更密集，供机器人精确部署在裂缝线上）
  cachedPathPoints = fractures.flatMap((f) => f.path);

  cache[scenario] = fractures;
  return fractures;
}

/** 获取所有裂缝节点的位置（供其他数据生成器使用） */
export function getAllNodePositions(): [number, number, number][] {
  return cachedNodePositions;
}

/** 缓存所有裂缝路径点（比节点更密集） */
let cachedPathPoints: [number, number, number][] = [];

/** 获取所有裂缝路径上的所有点（供机器人部署用，密度远高于节点） */
export function getAllPathPoints(): [number, number, number][] {
  return cachedPathPoints;
}

/** 将机器人 ID 分配到裂缝节点上 */
function assignRobotsToNodes(fractures: Fracture[]): void {
  let robotIdx = 0;
  for (const fracture of fractures) {
    for (const node of fracture.nodes) {
      if (robotIdx < 200) {
        // 70% 的节点分配机器人
        node.robotId = Math.random() > 0.3
          ? `R-${String(++robotIdx).padStart(3, '0')}`
          : null;
      }
    }
  }
}

/**
 * 获取场景传感器范围描述（用于 AI prompt）
 */
export function getScenarioSensorSummary(scenario: ScenarioType): string {
  const ranges = SCENARIO_RANGES[toGeologicalScenario(scenario)];
  const labels: Record<string, string> = {
    ch4_pct: 'CH4浓度(%)',
    co_ppm: 'CO浓度(ppm)',
    temperature_c: '温度(°C)',
    stress_mpa: '地应力(MPa)',
    permeability_md: '渗透率(mD)',
    water_pressure_mpa: '水压(MPa)',
    microseismic_count: '微震事件(次/h)',
    fracture_aperture_um: '裂缝开度(µm)',
  };

  const lines = Object.entries(labels)
    .filter(([k]) => ranges[k])
    .map(([k, label]) => `- ${label}: ${ranges[k][0]} ~ ${ranges[k][1]}`);

  return `当前场景类型: ${scenario === 'coal' ? '煤矿' : scenario === 'gold' ? '金矿' : '油气'}\n传感器参数范围:\n${lines.join('\n')}`;
}

export { SCENARIO_RANGES };
