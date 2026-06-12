/**
 * 管线网络数据生成器
 * 基于真实油气管道工程参数生成 mock 数据
 *
 * 核心规则：
 * - 每条管道必须从地表入口（井口/采油树/检测孔）出发
 * - 管网是连通图——所有管段都从入口可达，不存在漂浮孤立段
 * - 蛛型巡检机器人从入口进入，沿管道内部爬行巡检
 * - 管道参数基于 API 5L / ASME B31.4/B31.8 真实工程数据
 *
 * 参考资料（网络检索 2026-06）：
 * - Wikipedia Pipeline: 管径 4"-48"(100-1220mm), 压力 2-15MPa, 埋深 0.9-1.8m
 * - PipeFlow: 天然气管道 6"-56"(168-1422mm), 运行压力 4-15MPa, 壁厚 6-25mm
 * - API 5L: 钢级 X42-X80, 屈服强度 290-552 MPa
 * - Smart-Spider (DHRTC): 自驱适应管径, 无缆自主, 压力反馈调控
 * - NACE MR0175: H₂S 酸性服务阈值 50 ppm
 * - SCADA: 每 5s 评估压力/流量, 泄漏检测阈值 <8% 最大流量
 * - 腐蚀速率: 阴极保护 0.01-0.3 mm/yr, 无保护 0.5-1.0 mm/yr
 */

import type { Fracture, FractureNode, SensorReading } from '../types';

// 固定种子随机
let _seed = 42;
function sr(): number {
  _seed = (_seed * 16807) % 2147483647;
  return _seed / 2147483647;
}
function rand(min: number, max: number): number {
  return min + sr() * (max - min);
}
function randInt(min: number, max: number): number {
  return Math.floor(rand(min, max + 1));
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(sr() * arr.length)];
}

// ==================== 真实管道参数 ====================

/** 管道等级规格 — 基于 API 5L / ASME B31.4 / B31.8 */
const PIPE_SPECS = {
  trunk: {
    // 主管线（输气干线）DN800-DN1200
    diameter_mm: [813, 1220],       // 外径 32"-48"
    wall_thickness_mm: [9.5, 19.1],  // 壁厚 Sch 40-80
    steel_grade: ['X65', 'X70', 'X80'],
    yield_strength_mpa: [448, 552],   // X65=448, X70=483, X80=552
    design_pressure_mpa: [8, 15],     // 设计压力
    operating_pressure_mpa: [6, 12],  // 运行压力
    flow_rate_m3h: [50000, 300000],   // 天然气 m³/h
    temperature_c: [15, 55],
    corrosion_rate_mmyear: [0.02, 0.15],
  },
  distribution: {
    // 分配管线 DN300-DN600
    diameter_mm: [324, 610],          // 外径 12"-24"
    wall_thickness_mm: [6.4, 12.7],
    steel_grade: ['X52', 'X60', 'X65'],
    yield_strength_mpa: [359, 448],
    design_pressure_mpa: [4, 10],
    operating_pressure_mpa: [3, 8],
    flow_rate_m3h: [5000, 50000],
    temperature_c: [10, 50],
    corrosion_rate_mmyear: [0.03, 0.25],
  },
  service: {
    // 支线/采气支管 DN100-DN250
    diameter_mm: [114, 273],          // 外径 4"-10"
    wall_thickness_mm: [4.0, 9.5],
    steel_grade: ['X42', 'X52', 'X60'],
    yield_strength_mpa: [290, 414],
    design_pressure_mpa: [2, 6],
    operating_pressure_mpa: [1.5, 5],
    flow_rate_m3h: [500, 8000],
    temperature_c: [8, 45],
    corrosion_rate_mmyear: [0.05, 0.35],
  },
};

type PipeClass = 'trunk' | 'distribution' | 'service';

function getPipeSpec(pipeClass: PipeClass) {
  return PIPE_SPECS[pipeClass];
}

// ==================== 管道传感器读数 ====================

function genPipelineSensorReading(pipeClass: PipeClass): SensorReading {
  const spec = getPipeSpec(pipeClass);
  const operatingPressure = +rand(...spec.operating_pressure_mpa).toFixed(2);
  const wallThickness = +rand(...spec.wall_thickness_mm).toFixed(1);
  const corrosionRate = +rand(...spec.corrosion_rate_mmyear).toFixed(3);
  const temperature = +rand(...spec.temperature_c).toFixed(1);

  // H₂S: 酸性气田 0-500 ppm, NACE MR0175 阈值 50 ppm
  const h2s = +(sr() > 0.7 ? rand(20, 500) : rand(0, 30)).toFixed(1);

  // 天然气泄漏浓度 %LEL (爆炸下限百分比, 报警阈值 20%LEL)
  const gasLeak = +(sr() > 0.85 ? rand(5, 35) : rand(0, 3)).toFixed(1);

  // CO: 燃烧产物, 正常 0-10 ppm
  const co = +(sr() > 0.9 ? rand(20, 100) : rand(0, 8)).toFixed(1);

  // 流量 (m³/h)
  const flowRate = +rand(...spec.flow_rate_m3h).toFixed(0);

  // 壁厚损失百分比
  const wallLossPct = +(corrosionRate * rand(5, 20)).toFixed(1); // 累积腐蚀

  // 振动频率 (Hz) — 管道流致振动, 异常时 >50Hz
  const vibration = randInt(5, 60);

  // 管道位移/沉降 (mm) — 地质活动导致
  const displacement = +rand(0, 8).toFixed(2);

  // 屈服强度利用率 (实际应力/屈服强度, 报警阈值 72%)
  const yieldUtilization = +(rand(0.3, 0.85)).toFixed(2);

  // 把管道参数映射到 SensorReading 字段（复用现有类型）
  return {
    ch4_pct: gasLeak,                        // 天然气泄漏 %LEL
    co_ppm: co,                              // CO (ppm)
    h2s_ppm: h2s,                            // H₂S (ppm)
    temperature_c: temperature,              // 管道温度 °C
    stress_mpa: operatingPressure,           // 运行压力 MPa
    stress_sigma1: yieldUtilization * 100,   // 屈服利用率 %
    stress_sigma2: flowRate / 1000,          // 流量 (千 m³/h, 存为副值)
    stress_sigma3: +rand(...spec.yield_strength_mpa).toFixed(0), // 钢材屈服强度 MPa
    permeability_md: corrosionRate,          // 腐蚀速率 mm/yr
    water_pressure_mpa: +rand(0.1, 0.8).toFixed(2), // 外部土压 MPa
    microseismic_count: vibration,           // 振动频率 Hz
    acoustic_emission_mv: randInt(0, 8000),  // 声发射信号 (焊缝缺陷检测)
    humidity_pct: +rand(30, 80).toFixed(1),  // 管道内部湿度 %
    fracture_aperture_um: wallThickness * 1000, // 壁厚 µm (mm×1000)
    displacement_mm: displacement,           // 管道沉降位移 mm
    rock_strength_mpa: wallLossPct,          // 壁厚损失 %
    pore_pressure_mpa: +rand(0.1, 0.5).toFixed(2), // 阴极保护电位
    porosity_pct: +rand(85, 99).toFixed(1),  // 壁厚完整度 % (100 - loss)
    fluid_ph: +rand(5.5, 8.5).toFixed(1),    // 输送介质 pH
    water_saturation_pct: +rand(40, 95).toFixed(1), // 涂层完整性 %
  };
}

// ==================== 管道路径生成 ====================

/**
 * 生成管道中心线路径
 * 管道从入口点开始, 沿指定方向延伸, 可以有弯头和坡度变化
 * 
 * @param entryPoint 地表入口 [x, y, z], y≈18-20 (地表)
 * @param targetPoint 目标终点 [x, y, z]
 * @param pipeClass 管道等级
 */
function generatePipePath(
  entryPoint: [number, number, number],
  targetPoint: [number, number, number],
  pipeClass: PipeClass
): [number, number, number][] {
  const points: [number, number, number][] = [[...entryPoint]];

  // 管道首先竖直下钻（井口段）, 然后转弯水平延伸
  const verticalDepth = rand(12, 20); // 垂直下钻深度
  const bendPoint: [number, number, number] = [
    entryPoint[0],
    entryPoint[1] - verticalDepth,
    entryPoint[2],
  ];
  points.push([...bendPoint.map(v => +v.toFixed(1)) as [number, number, number]]);

  // 弯头后水平延伸到目标点, 中间加入微小弯曲（管道不可能是完美直线）
  const dx = targetPoint[0] - bendPoint[0];
  const dy = targetPoint[1] - bendPoint[1]; // 通常接近 0
  const dz = targetPoint[2] - bendPoint[2];
  const totalDist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const segments = Math.max(8, Math.floor(totalDist / 4));

  for (let i = 1; i <= segments; i++) {
    const t = i / segments;
    // 线性插值 + 弯曲噪声（管道蛇形弯）
    const sway = Math.sin(t * Math.PI * 2 + entryPoint[0] * 0.1) * 1.5;
    const verticalDip = Math.sin(t * Math.PI) * 1.0; // 管道因自重微下垂
    points.push([
      +(bendPoint[0] + dx * t + sway).toFixed(1),
      +(bendPoint[1] + dy * t - verticalDip).toFixed(1),
      +(bendPoint[2] + dz * t).toFixed(1),
    ]);
  }

  return points;
}

/**
 * 生成分支管道路径 — 从主管某点分出
 */
function generateBranchPath(
  origin: [number, number, number],
  direction: [number, number, number],
  length: number
): [number, number, number][] {
  const points: [number, number, number][] = [[...origin]];
  const segments = Math.max(6, Math.floor(length / 3));

  let [x, y, z] = origin;
  const mag = Math.sqrt(direction[0] ** 2 + direction[1] ** 2 + direction[2] ** 2);
  let dx = direction[0] / mag;
  let dy = direction[1] / mag;
  let dz = direction[2] / mag;

  for (let i = 1; i <= segments; i++) {
    const step = length / segments;
    // 管道方向微调（弯头/弯管）
    dx += rand(-0.1, 0.1);
    dy += rand(-0.05, 0.05);
    dz += rand(-0.1, 0.1);
    const m = Math.sqrt(dx * dx + dy * dy + dz * dz);
    dx /= m; dy /= m; dz /= m;

    x += dx * step;
    y += dy * step;
    z += dz * step;
    // 钳制在岩体范围内
    y = Math.min(15, Math.max(-19, y));
    points.push([+x.toFixed(1), +y.toFixed(1), +z.toFixed(1)]);
  }
  return points;
}

// ==================== 管道实体构建 ====================

const PIPELINE_NAMES = [
  // 井口立管
  '井口-W1立管', '井口-W2立管', '井口-W3立管', '井口-W4立管',
  '井口-W5立管', '井口-W6立管',
  // 采气汇集管
  '采气汇集管-A', '采气汇集管-B',
  // 主管线（外输干线）
  '外输干线-北', '外输干线-中', '外输干线-南',
  // 分配管线
  '分配管线-D1', '分配管线-D2', '分配管线-D3', '分配管线-D4',
  '分配管线-D5', '分配管线-D6',
  // 计量站支线
  '计量支线-M1', '计量支线-M2', '计量支线-M3', '计量支线-M4',
  // 清管站/阀室支线
  '阀室支线-V1', '阀室支线-V2', '阀室支线-V3',
];

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

function buildPipeline(
  id: number,
  path: [number, number, number][],
  pipeClass: PipeClass,
  isMain: boolean,
  parentId: string | null,
  customName?: string
): Fracture {
  const spec = getPipeSpec(pipeClass);
  const diameter = +rand(...spec.diameter_mm).toFixed(0);
  const wallThickness = +rand(...spec.wall_thickness_mm).toFixed(1);
  const grade = pick(spec.steel_grade);

  const fracture: Fracture = {
    id: `P-${String(id).padStart(3, '0')}`,
    name: customName || PIPELINE_NAMES[id % PIPELINE_NAMES.length],
    type: isMain ? 'main' : 'branch',
    path,
    length: +pathLength(path).toFixed(1),
    aperture_um: wallThickness * 1000,   // 壁厚 µm
    porosity: +(diameter / 1000).toFixed(3), // 管径 m
    fractal_dim: +(rand(2.03, 2.35)).toFixed(4),
    tortuosity: +(rand(1.01, 1.15)).toFixed(4), // 管道比裂缝更直
    dip_angle: +rand(0, 15).toFixed(1),  // 管道倾角较小
    azimuth_angle: +rand(0, 360).toFixed(1),
    roughness_coeff: +rand(0.005, 0.05).toFixed(3), // 管道内壁粗糙度很低
    connectivity: randInt(2, 6),
    sensorReading: genPipelineSensorReading(pipeClass),
    nodes: [],
    parentFractureId: parentId,
  };

  // 在路径上生成传感器测点（每隔几个路径点放一个）
  const nodeCount = Math.max(3, Math.floor(path.length / 3));
  for (let i = 0; i < nodeCount; i++) {
    const pathIdx = Math.floor((i / nodeCount) * (path.length - 1));
    fracture.nodes.push({
      id: `${fracture.id}-N${i}`,
      position: path[pathIdx],
      sensors: genPipelineSensorReading(pipeClass),
      timestamp: Date.now() - randInt(0, 300000),
      robotId: null,
    });
  }

  return fracture;
}

// ==================== 管网生成 ====================

/** 缓存 */
let cachedPipelines: Fracture[] | null = null;
let cachedNodePositions: [number, number, number][] = [];
let cachedPathPoints: [number, number, number][] = [];

/**
 * 生成竖直管道路径（井口立管）
 * 从地表竖直下钻到指定深度，底部加一个 90° 弯头转向
 */
function generateVerticalRiser(
  top: [number, number, number],
  depth: number,
  turnDir: [number, number, number]
): [number, number, number][] {
  const points: [number, number, number][] = [[...top]];
  // 竖直段
  const bottom: [number, number, number] = [top[0], top[1] - depth, top[2]];
  const steps = Math.max(4, Math.floor(depth / 3));
  for (let i = 1; i < steps; i++) {
    const t = i / steps;
    points.push([top[0], +(top[1] - depth * t).toFixed(1), top[2]]);
  }
  // 弯头（90° 弧，用 3 个点模拟）
  const elbowRadius = 3;
  const elbowEnd: [number, number, number] = [
    +(bottom[0] + turnDir[0] * elbowRadius).toFixed(1),
    bottom[1],
    +(bottom[2] + turnDir[2] * elbowRadius).toFixed(1),
  ];
  points.push(
    [+(bottom[0] + turnDir[0] * elbowRadius * 0.3).toFixed(1), bottom[1], +(bottom[2] + turnDir[2] * elbowRadius * 0.3).toFixed(1)],
    [+(bottom[0] + turnDir[0] * elbowRadius * 0.7).toFixed(1), +(bottom[1] + 0.5).toFixed(1), +(bottom[2] + turnDir[2] * elbowRadius * 0.7).toFixed(1)],
    elbowEnd,
  );
  return points;
}

/**
 * 生成水平管道路径（管廊）
 * 从 start 到 end，沿直线走，加入微小弯曲模拟管段焊接偏移
 */
function generateHorizontalPipe(
  start: [number, number, number],
  end: [number, number, number]
): [number, number, number][] {
  const dx = end[0] - start[0];
  const dy = end[1] - start[1];
  const dz = end[2] - start[2];
  const dist = Math.sqrt(dx * dx + dy * dy + dz * dz);
  const segs = Math.max(10, Math.floor(dist / 4));
  const points: [number, number, number][] = [];
  for (let i = 0; i <= segs; i++) {
    const t = i / segs;
    // 微小弯曲（管道自重下垂 + 焊接偏移）
    const sag = Math.sin(t * Math.PI) * 0.3;
    const jitter_x = Math.sin(t * Math.PI * 3) * 0.15;
    const jitter_z = Math.cos(t * Math.PI * 2.5) * 0.15;
    points.push([
      +(start[0] + dx * t + jitter_x).toFixed(1),
      +(start[1] + dy * t - sag).toFixed(1),
      +(start[2] + dz * t + jitter_z).toFixed(1),
    ]);
  }
  return points;
}

/**
 * 生成 L 型弯管路径（主管到分配管的连接弯头）
 */
function generateElbowPipe(
  start: [number, number, number],
  end: [number, number, number],
  midOffset: number
): [number, number, number][] {
  // start → corner → end 的 L 型路径
  const corner: [number, number, number] = [end[0], start[1], end[2]];
  const pts1 = generateHorizontalPipe(start, corner);
  const pts2 = generateHorizontalPipe(corner, end);
  // 去掉重复的角点
  return [...pts1, ...pts2.slice(1)];
}

let _pipeIdCounter = 0;
function nextPipeId(): number {
  return _pipeIdCounter++;
}

/**
 * 生成完整管网 — 真实油气管道站场布局
 *
 * 布局结构（俯视）：
 *
 *  西(x=-45)                         东(x=45)
 *  ┌──────────────────────────────────────────┐ z=-35
 *  │ W1  W2  W3     ← 采气井排（6 口井）       │
 *  │ │  │  │  │  │  │  ← 竖直立管             │ z=-30
 *  │ └──┴──┴──┴──┴──┘  ← 采气汇集管（A组）    │
 *  │        ║                                    │
 *  │  ═════╬═════  ← 外输干线-北                │ z=-18
 *  │        ║                                    │
 *  │  ═════╬═════  ← 外输干线-中                │ z=0
 *  │        ║                                    │
 *  │  ═════╬═════  ← 外输干线-南                │ z=18
 *  │                                              │
 *  │  ├──┤├──┤├──┤  ← 分配+计量支线             │ z=30
 *  └──────────────────────────────────────────┘ z=35
 *
 *  Y 轴：地表 y≈19，管廊层 y≈-5~-8
 */
export function generatePipelineNetwork(): Fracture[] {
  if (cachedPipelines) return cachedPipelines;

  _seed = 42;
  _pipeIdCounter = 0;
  const pipelines: Fracture[] = [];

  // === 参数 ===
  const surfaceY = 19;       // 地表高度
  const pipeLayerY = -6;     // 水平管廊层高度
  const wellZ = -30;         // 采气井排 Z 坐标
  const wellStartX = -38;    // 第一口井 X
  const wellSpacing = 14;    // 井距
  const wellCount = 6;

  // ========================================================
  // 1. 井口立管（6 口竖直管，从地表下钻到管廊层）
  // ========================================================
  const wellheadBottoms: [number, number, number][] = [];
  const trunkZs = [-16, 0, 16]; // 三条干线 Z 坐标
  const trunkNames = ['外输干线-北', '外输干线-中', '外输干线-南'];

  for (let i = 0; i < wellCount; i++) {
    const wx = wellStartX + i * wellSpacing;
    const top: [number, number, number] = [wx, surfaceY, wellZ];
    const bottom: [number, number, number] = [wx, pipeLayerY, wellZ];
    wellheadBottoms.push(bottom);
    // 立管朝东（+X方向）弯出
    const path = generateVerticalRiser(top, surfaceY - pipeLayerY, [1, 0, 0]);
    pipelines.push(buildPipeline(nextPipeId(), path, 'trunk', true, null, `井口-W${i + 1}立管`));
  }

  // ========================================================
  // 2. 采气汇集管（水平，连接所有井口底部，沿 X 轴）
  // ========================================================
  const headerY = pipeLayerY;
  const headerStart: [number, number, number] = [wellheadBottoms[0][0] + 3, headerY, wellZ];
  const headerEnd: [number, number, number] = [wellheadBottoms[wellCount - 1][0] + 3, headerY, wellZ];
  const headerPath = generateHorizontalPipe(headerStart, headerEnd);
  pipelines.push(buildPipeline(nextPipeId(), headerPath, 'trunk', true, null, '采气汇集管'));

  // ========================================================
  // 3. 外输干线（3 条平行大管，从汇集管中点向东延伸）
  // ========================================================
  const trunkEndX = 42;
  const headerMidX = (headerStart[0] + headerEnd[0]) / 2;

  for (let t = 0; t < trunkZs.length; t++) {
    const tz = trunkZs[t];
    const trunkY = headerY + t * 1.5; // 管廊分层叠放
    // 从汇集管中点引出 L 型弯管到干线起点
    const connectStart: [number, number, number] = [headerMidX, headerY, wellZ];
    const trunkStart: [number, number, number] = [headerMidX + 2, trunkY, tz];
    const connectPath = generateElbowPipe(connectStart, trunkStart, 0);
    // 干线主体
    const trunkEnd: [number, number, number] = [trunkEndX, trunkY, tz];
    const trunkPath = generateHorizontalPipe(trunkStart, trunkEnd);

    // 合并连接弯 + 干线主体
    pipelines.push(buildPipeline(nextPipeId(), [...connectPath, ...trunkPath.slice(1)], 'trunk', true, null, trunkNames[t]));
  }

  // ========================================================
  // 4. 分配管线（从干线引出，向北/南分支）
  // ========================================================
  const distributionXs = [-10, 5, 20, 35]; // 4 个分支 X 位置
  let distCount = 0;

  for (const dx of distributionXs) {
    for (let ti = 0; ti < trunkZs.length; ti++) {
      if (distCount >= 6) break;
      const tz = trunkZs[ti];
      const trunkY = headerY + ti * 1.5;

      // 分配管从干线垂直引出
      const branchDir = ti === 1 ? (distCount % 2 === 0 ? 1 : -1) : (ti === 0 ? 1 : -1);
      const branchLen = rand(14, 22);
      const branchStart: [number, number, number] = [dx, trunkY, tz];
      const branchEnd: [number, number, number] = [
        dx + rand(-3, 3),
        trunkY + rand(-1, 1),
        +(tz + branchDir * branchLen).toFixed(1),
      ];
      const branchPath = generateHorizontalPipe(branchStart, branchEnd);
      pipelines.push(buildPipeline(nextPipeId(), branchPath, 'distribution', false, null, `分配管线-D${distCount + 1}`));
      distCount++;
    }
  }

  // ========================================================
  // 5. 计量站/阀室支线（在干线远端引出短支管）
  // ========================================================
  const valveXs = [25, 32, 39];
  let valveCount = 0;

  for (const vx of valveXs) {
    for (let ti = 0; ti < trunkZs.length; ti++) {
      if (valveCount >= 7) break;
      // 隔一条干线引出
      if ((vx + ti) % 2 === 0) continue;
      const tz = trunkZs[ti];
      const trunkY = headerY + ti * 1.5;

      const valveStart: [number, number, number] = [vx, trunkY, tz];
      const valveDir = ti === 1 ? -1 : (ti === 0 ? 1 : -1);
      const valveEnd: [number, number, number] = [
        +(vx + rand(-2, 2)).toFixed(1),
        trunkY,
        +(tz + valveDir * rand(6, 12)).toFixed(1),
      ];
      const valvePath = generateHorizontalPipe(valveStart, valveEnd);
      pipelines.push(buildPipeline(nextPipeId(), valvePath, 'service', false, null, `计量支线-M${valveCount + 1}`));
      valveCount++;
    }
  }

  // ========================================================
  // 6. 采气支管（从汇集管引出短支管到两侧）
  // ========================================================
  for (let i = 1; i < wellCount; i += 2) {
    const wx = wellStartX + i * wellSpacing;
    const branchStart: [number, number, number] = [wx + 3, headerY, wellZ];
    const branchEnd: [number, number, number] = [
      +(wx + 3 + rand(-2, 2)).toFixed(1),
      headerY,
      +(wellZ + (i % 4 === 1 ? 1 : -1) * rand(8, 14)).toFixed(1),
    ];
    const servicePath = generateHorizontalPipe(branchStart, branchEnd);
    const svcIdx = Math.floor(i / 2) + 1;
    pipelines.push(buildPipeline(nextPipeId(), servicePath, 'service', false, null, `阀室支线-V${svcIdx}`));
  }

  // === 分配蛛型机器人到管道节点 ===
  assignRobotsToNodes(pipelines);

  // 缓存
  cachedPipelines = pipelines;
  cachedNodePositions = pipelines.flatMap((p) => p.nodes.map((n) => n.position));
  cachedPathPoints = pipelines.flatMap((p) => p.path);

  return pipelines;
}

/** 将机器人 ID 分配到管道节点上 */
function assignRobotsToNodes(pipelines: Fracture[]): void {
  let robotIdx = 0;
  for (const pipeline of pipelines) {
    for (const node of pipeline.nodes) {
      if (robotIdx < 150) {
        // 75% 的节点分配机器人（管线场景机器人密度更高）
        node.robotId = sr() > 0.25
          ? `R-${String(++robotIdx).padStart(3, '0')}`
          : null;
      }
    }
  }
}

/** 获取所有管道节点位置 */
export function getAllPipelineNodePositions(): [number, number, number][] {
  return cachedNodePositions;
}

/** 获取所有管道路径点（供机器人精确部署） */
export function getAllPipelinePathPoints(): [number, number, number][] {
  return cachedPathPoints;
}

/** 获取管网传感器概况（用于 AI prompt） */
export function getPipelineSensorSummary(): string {
  return `当前数据源: 模拟数据二·管线
管道类型: API 5L 输气干线 (DN800-1200, X65-X80) + 分配管线 (DN300-600, X52-X65) + 采气支管 (DN100-250, X42-X60)
运行参数:
- 运行压力: 1.5-12 MPa (设计压力 2-15 MPa)
- 流量: 500-300000 m³/h
- 壁厚: 4.0-19.1 mm
- 温度: 8-55 °C
- 腐蚀速率: 0.02-0.35 mm/yr
安全阈值:
- H₂S: 50 ppm (NACE MR0175 酸性服务)
- 天然气泄漏: 20% LEL
- 壁厚损失: 50% (临界)
- 屈服利用率: 72% (ASME B31.8)
机器人: 蛛型 (Spider), 适配管径 152-1219mm, 自驱无缆`;
}
