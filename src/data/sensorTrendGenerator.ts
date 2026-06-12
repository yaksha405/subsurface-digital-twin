/**
 * 传感器时序趋势 mock 数据生成器
 * 从裂缝节点传感器聚合多个区域的趋势数据
 * 每个区域包含 CH4 / 温度 / 压力时序，体现不同位置的差异
 * 区域坐标从实际裂缝数据动态计算
 */

import type { Fracture } from '../types';

export interface RegionTrend {
  regionId: string;
  regionName: string;
  timestamps: number[];
  ch4: number[];
  temperature: number[];
  pressure: number[];
  /** 该区域包含的机器人/节点数 */
  nodeCount: number;
  /** 3D 场景中心坐标，用于点击区域时相机飞过去 */
  center: [number, number, number];
  /** 区域包围球半径 */
  radius: number;
}

export interface SensorTrend {
  timestamps: number[];
  ch4: number[];
  temperature: number[];
  pressure: number[];
  /** 各区域分项趋势 */
  regions: RegionTrend[];
  /** 数据来源说明 */
  source: string;
}

// 区域配置 — 基于裂缝分布动态划分
// 使用象限法：按 X/Z 坐标分为四个象限
const REGION_DEFS = [
  { id: 'north', name: '北部裂缝带', baseCh4: 1.8, baseTemp: 35, basePressure: 108, nodeRatio: 0.3 },
  { id: 'central', name: '中央交叉区', baseCh4: 2.6, baseTemp: 40, basePressure: 112, nodeRatio: 0.25 },
  { id: 'south', name: '南部深部区', baseCh4: 0.6, baseTemp: 28, basePressure: 103, nodeRatio: 0.25 },
  { id: 'east', name: '东部分支带', baseCh4: 1.2, baseTemp: 32, basePressure: 106, nodeRatio: 0.2 },
];

/** 计算裂缝群的中心点和包围球半径 */
function computeFractureCluster(
  fractures: Fracture[]
): { center: [number, number, number]; radius: number } {
  if (fractures.length === 0) {
    return { center: [0, 0, 0], radius: 4 };
  }
  const allPoints = fractures.flatMap((f) => f.path);
  if (allPoints.length === 0) return { center: [0, 0, 0], radius: 4 };

  const cx = allPoints.reduce((s, p) => s + p[0], 0) / allPoints.length;
  const cy = allPoints.reduce((s, p) => s + p[1], 0) / allPoints.length;
  const cz = allPoints.reduce((s, p) => s + p[2], 0) / allPoints.length;

  // 半径 = 最远点到中心，但上限 5（传感器区域是局部概念，不应覆盖全场景）
  let maxDist = 0;
  for (const p of allPoints) {
    const d = Math.sqrt((p[0]-cx)**2 + (p[1]-cy)**2 + (p[2]-cz)**2);
    if (d > maxDist) maxDist = d;
  }

  return {
    center: [+cx.toFixed(1), +cy.toFixed(1), +cz.toFixed(1)],
    radius: Math.min(5, Math.max(3, +(maxDist * 0.3).toFixed(1))),
  };
}

/** 按象限将裂缝分为4个区域，每个区域计算实际中心 */
function divideFracturesIntoRegions(fractures: Fracture[]) {
  if (fractures.length === 0) {
    // 无数据时用默认坐标
    return REGION_DEFS.map((def, i) => ({
      ...def,
      center: [[-25, 0, -25], [0, 0, 0], [25, -10, 25], [35, 0, -10]][i] as [number, number, number],
      radius: 15,
    }));
  }

  // 计算全局中心
  const allPoints = fractures.flatMap((f) => f.path);
  const cx = allPoints.reduce((s, p) => s + p[0], 0) / allPoints.length;
  const cz = allPoints.reduce((s, p) => s + p[2], 0) / allPoints.length;

  // 按象限分组：北(z<cz, x<cx), 中央(x近cx, z近cz), 南(z>cz, x>cx), 东(x>cx)
  const groups: Fracture[][] = [[], [], [], []];
  for (const f of fractures) {
    const fCenter = f.path.reduce((a, p) => [a[0]+p[0], a[1]+p[1], a[2]+p[2]], [0,0,0]);
    const fx = fCenter[0] / f.path.length;
    const fz = fCenter[2] / f.path.length;
    const dx = fx - cx;
    const dz = fz - cz;
    const dist = Math.sqrt(dx*dx + dz*dz);

    if (dist < 15) {
      groups[1].push(f); // 中央
    } else if (dz < -5) {
      groups[0].push(f); // 北
    } else if (dx > 10) {
      groups[3].push(f); // 东
    } else {
      groups[2].push(f); // 南
    }
  }

  return REGION_DEFS.map((def, i) => {
    const cluster = computeFractureCluster(groups[i] || []);
    return { ...def, ...cluster };
  });
}

let cachedTrend: SensorTrend | null = null;

export function generateMockSensorTrend(totalNodes: number = 100, fractures?: Fracture[]): SensorTrend {
  if (cachedTrend) return cachedTrend;

  const now = Date.now();
  const timestamps: number[] = [];

  // 30 data points, 5 minutes apart
  for (let i = 29; i >= 0; i--) {
    timestamps.push(now - i * 5 * 60 * 1000);
  }

  // 动态计算区域边界
  const regionConfigs = divideFracturesIntoRegions(fractures || []);

  // 为每个区域生成趋势
  const regions: RegionTrend[] = regionConfigs.map((cfg) => {
    const rCh4: number[] = [];
    const rTemp: number[] = [];
    const rPressure: number[] = [];

    for (let i = 29; i >= 0; i--) {
      const phase = i * 0.3;
      // CH4：基础值 + 正弦波动 + 历史尖峰
      const spike = cfg.baseCh4 > 1.5 && i > 18 && i < 24 ? 1.5 : 0;
      rCh4.push(Math.max(0.05, Math.round((cfg.baseCh4 + Math.sin(phase) * 0.4 + spike + (Math.random() - 0.5) * 0.2) * 100) / 100));

      // 温度：缓升 + 波动
      rTemp.push(Math.round((cfg.baseTemp + (29 - i) * 0.2 + Math.sin(i * 0.5) * 1.5 + (Math.random() - 0.5) * 0.8) * 10) / 10);

      // 压力：稳定 + 微波动
      rPressure.push(Math.round((cfg.basePressure + Math.sin(i * 0.4) * 2 + (Math.random() - 0.5) * 0.8) * 10) / 10);
    }

    return {
      regionId: cfg.id,
      regionName: cfg.name,
      timestamps,
      ch4: rCh4,
      temperature: rTemp,
      pressure: rPressure,
      nodeCount: Math.round(totalNodes * cfg.nodeRatio),
      center: cfg.center,
      radius: cfg.radius,
    };
  });

  // 加权聚合为全局趋势
  const aggCh4: number[] = [];
  const aggTemp: number[] = [];
  const aggPressure: number[] = [];

  for (let i = 0; i < 30; i++) {
    let weightedCh4 = 0, weightedTemp = 0, weightedPressure = 0, totalWeight = 0;
    for (const r of regions) {
      const w = r.nodeCount;
      weightedCh4 += r.ch4[i] * w;
      weightedTemp += r.temperature[i] * w;
      weightedPressure += r.pressure[i] * w;
      totalWeight += w;
    }
    aggCh4.push(Math.round((weightedCh4 / totalWeight) * 100) / 100);
    aggTemp.push(Math.round((weightedTemp / totalWeight) * 10) / 10);
    aggPressure.push(Math.round((weightedPressure / totalWeight) * 10) / 10);
  }

  cachedTrend = {
    timestamps,
    ch4: aggCh4,
    temperature: aggTemp,
    pressure: aggPressure,
    regions,
    source: `${totalNodes} 个节点加权聚合 · 4 个区域`,
  };
  return cachedTrend;
}
