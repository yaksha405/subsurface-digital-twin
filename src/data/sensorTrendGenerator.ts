/**
 * 传感器时序趋势 mock 数据生成器
 * 从裂缝节点传感器聚合多个区域的趋势数据
 * 每个区域包含 主指标 / 温度 / 辅助指标时序，体现不同位置的差异
 * 区域坐标从实际裂缝数据动态计算
 */

import type { Fracture, ScenarioType } from '../types';

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
  /** 该区域包含的裂缝 ID 列表 — 点击区域时高亮这些裂缝 */
  fractureIds: string[];
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

/** 场景特定的趋势配置 — 三条曲线的含义随场景变化 */
interface TrendScenarioConfig {
  /** 区域命名前缀 */
  regionPrefix: string;
  /** 主指标(ch4字段) */
  primaryLabel: string; primaryUnit: string; primaryBase: number[]; primaryThreshold: number;
  /** 温度 */
  tempLabel: string; tempBase: number[];
  /** 辅助指标(pressure字段) */
  auxLabel: string; auxUnit: string; auxBase: number[];
}

const TREND_CONFIG: Record<string, TrendScenarioConfig> = {
  coal: {
    regionPrefix: '裂缝带',
    primaryLabel: 'CH₄ 浓度', primaryUnit: '%', primaryBase: [1.8, 2.6, 0.6, 1.2], primaryThreshold: 1.5,
    tempLabel: '环境温度', tempBase: [35, 40, 28, 32],
    auxLabel: '大气压力', auxUnit: 'kPa', auxBase: [108, 112, 103, 106],
  },
  gold: {
    regionPrefix: '采区',
    primaryLabel: '微震频率', primaryUnit: '次/h', primaryBase: [8, 16, 4, 10], primaryThreshold: 15,
    tempLabel: '岩温', tempBase: [32, 38, 26, 30],
    auxLabel: '应力', auxUnit: 'MPa', auxBase: [12, 18, 8, 14],
  },
  oil: {
    regionPrefix: '储层',
    primaryLabel: '孔隙压力', primaryUnit: 'MPa', primaryBase: [18, 28, 12, 22], primaryThreshold: 30,
    tempLabel: '地层温度', tempBase: [65, 80, 50, 70],
    auxLabel: '渗透率', auxUnit: 'mD', auxBase: [1.2, 2.8, 0.5, 1.8],
  },
  pipeline: {
    regionPrefix: '站场',
    primaryLabel: '天然气泄漏', primaryUnit: '%LEL', primaryBase: [3, 18, 1, 8], primaryThreshold: 20,
    tempLabel: '管道温度', tempBase: [15, 35, 8, 22],
    auxLabel: '运行压力', auxUnit: 'MPa', auxBase: [6.5, 8.2, 4.0, 7.0],
  },
  nuclear: {
    regionPrefix: '环路',
    primaryLabel: '剂量率', primaryUnit: 'mSv/h', primaryBase: [0.8, 12, 0.2, 3.5], primaryThreshold: 25,
    tempLabel: '冷却剂温度', tempBase: [293, 327, 280, 305],
    auxLabel: '运行压力', auxUnit: 'MPa', auxBase: [15.5, 15.5, 12, 15.5],
  },
  refinery: {
    regionPrefix: '设备区',
    primaryLabel: '壁厚减薄', primaryUnit: '%', primaryBase: [1.2, 4.5, 0.5, 2.8], primaryThreshold: 3,
    tempLabel: '操作温度', tempBase: [180, 650, 80, 350],
    auxLabel: '腐蚀速率', auxUnit: 'mm/yr', auxBase: [0.08, 0.45, 0.03, 0.22],
  },
};

const REGION_DIRS = ['north', 'central', 'south', 'east'];
const REGION_NAMES = ['北部', '中央', '南部', '东部'];

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

/** 按象限将裂缝分为4个区域，每个区域计算实际中心 + 记录裂缝ID */
function divideFracturesIntoRegions(fractures: Fracture[], cfg: TrendScenarioConfig) {
  if (fractures.length === 0) {
    // 无数据时用默认坐标
    return REGION_DIRS.map((id, i) => ({
      id,
      name: `${REGION_NAMES[i]}${cfg.regionPrefix}`,
      baseCh4: cfg.primaryBase[i],
      baseTemp: cfg.tempBase[i],
      basePressure: cfg.auxBase[i],
      nodeRatio: [0.3, 0.25, 0.25, 0.2][i],
      center: [[-25, 0, -25], [0, 0, 0], [25, -10, 25], [35, 0, -10]][i] as [number, number, number],
      radius: 15,
      fractureIds: [] as string[],
    }));
  }

  // 计算全局中心
  const allPoints = fractures.flatMap((f) => f.path);
  const cx = allPoints.reduce((s, p) => s + p[0], 0) / allPoints.length;
  const cz = allPoints.reduce((s, p) => s + p[2], 0) / allPoints.length;

  // 按象限分组
  const groups: { fractures: Fracture[]; ids: string[] }[] = [
    { fractures: [], ids: [] },
    { fractures: [], ids: [] },
    { fractures: [], ids: [] },
    { fractures: [], ids: [] },
  ];
  for (const f of fractures) {
    const fCenter = f.path.reduce((a, p) => [a[0]+p[0], a[1]+p[1], a[2]+p[2]], [0,0,0]);
    const fx = fCenter[0] / f.path.length;
    const fz = fCenter[2] / f.path.length;
    const dx = fx - cx;
    const dz = fz - cz;
    const dist = Math.sqrt(dx*dx + dz*dz);

    if (dist < 15) {
      groups[1].fractures.push(f); groups[1].ids.push(f.id);
    } else if (dz < -5) {
      groups[0].fractures.push(f); groups[0].ids.push(f.id);
    } else if (dx > 10) {
      groups[3].fractures.push(f); groups[3].ids.push(f.id);
    } else {
      groups[2].fractures.push(f); groups[2].ids.push(f.id);
    }
  }

  return REGION_DIRS.map((id, i) => {
    const cluster = computeFractureCluster(groups[i].fractures);
    return {
      id,
      name: `${REGION_NAMES[i]}${cfg.regionPrefix}`,
      baseCh4: cfg.primaryBase[i],
      baseTemp: cfg.tempBase[i],
      basePressure: cfg.auxBase[i],
      nodeRatio: [0.3, 0.25, 0.25, 0.2][i],
      ...cluster,
      fractureIds: groups[i].ids,
    };
  });
}

export function generateMockSensorTrend(totalNodes: number = 100, fractures?: Fracture[], scenario: ScenarioType = 'coal'): SensorTrend {
  const cfg = TREND_CONFIG[scenario] || TREND_CONFIG.coal;

  const now = Date.now();
  const timestamps: number[] = [];

  // 30 data points, 5 minutes apart
  for (let i = 29; i >= 0; i--) {
    timestamps.push(now - i * 5 * 60 * 1000);
  }

  // 动态计算区域边界
  const regionConfigs = divideFracturesIntoRegions(fractures || [], cfg);

  // 为每个区域生成趋势
  const regions: RegionTrend[] = regionConfigs.map((cfg_r: any) => {
    const rCh4: number[] = [];
    const rTemp: number[] = [];
    const rPressure: number[] = [];

    for (let i = 29; i >= 0; i--) {
      const phase = i * 0.3;
      const spike = cfg_r.baseCh4 > cfg.primaryThreshold * 0.6 && i > 18 && i < 24 ? cfg_r.baseCh4 * 0.5 : 0;
      rCh4.push(Math.max(0.01, Math.round((cfg_r.baseCh4 + Math.sin(phase) * cfg_r.baseCh4 * 0.15 + spike + (Math.random() - 0.5) * cfg_r.baseCh4 * 0.1) * 100) / 100));

      rTemp.push(Math.round((cfg_r.baseTemp + (29 - i) * 0.2 + Math.sin(i * 0.5) * cfg_r.baseTemp * 0.03 + (Math.random() - 0.5) * 0.8) * 10) / 10);

      rPressure.push(Math.round((cfg_r.basePressure + Math.sin(i * 0.4) * cfg_r.basePressure * 0.02 + (Math.random() - 0.5) * 0.8) * 10) / 10);
    }

    return {
      regionId: cfg_r.id,
      regionName: cfg_r.name,
      timestamps,
      ch4: rCh4,
      temperature: rTemp,
      pressure: rPressure,
      nodeCount: Math.round(totalNodes * cfg_r.nodeRatio),
      center: cfg_r.center,
      radius: cfg_r.radius,
      fractureIds: cfg_r.fractureIds,
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

  return {
    timestamps,
    ch4: aggCh4,
    temperature: aggTemp,
    pressure: aggPressure,
    regions,
    source: `${totalNodes} 个节点加权聚合 · 4 个${cfg.regionPrefix}`,
  };
}
