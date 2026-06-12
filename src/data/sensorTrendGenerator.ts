/**
 * 传感器时序趋势 mock 数据生成器
 * 从裂缝节点传感器聚合多个区域的趋势数据
 * 每个区域包含 CH4 / 温度 / 压力时序，体现不同位置的差异
 */

export interface RegionTrend {
  regionId: string;
  regionName: string;
  timestamps: number[];
  ch4: number[];
  temperature: number[];
  pressure: number[];
  /** 该区域包含的机器人/节点数 */
  nodeCount: number;
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

// 区域配置 — 模拟不同空间位置的传感器差异
const REGION_CONFIGS = [
  { id: 'north', name: '北部裂缝带', baseCh4: 1.8, baseTemp: 35, basePressure: 108, nodeRatio: 0.3 },
  { id: 'central', name: '中央交叉区', baseCh4: 2.6, baseTemp: 40, basePressure: 112, nodeRatio: 0.25 },
  { id: 'south', name: '南部深部区', baseCh4: 0.6, baseTemp: 28, basePressure: 103, nodeRatio: 0.25 },
  { id: 'east', name: '东部分支带', baseCh4: 1.2, baseTemp: 32, basePressure: 106, nodeRatio: 0.2 },
];

let cachedTrend: SensorTrend | null = null;

export function generateMockSensorTrend(totalNodes: number = 100): SensorTrend {
  if (cachedTrend) return cachedTrend;

  const now = Date.now();
  const timestamps: number[] = [];

  // 30 data points, 5 minutes apart
  for (let i = 29; i >= 0; i--) {
    timestamps.push(now - i * 5 * 60 * 1000);
  }

  // 为每个区域生成趋势
  const regions: RegionTrend[] = REGION_CONFIGS.map((cfg) => {
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
