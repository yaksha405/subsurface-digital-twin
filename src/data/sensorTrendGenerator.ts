/**
 * 传感器时序趋势 mock 数据生成器
 * 生成最近30个时间点的 CH4 / 温度 / 压力趋势数据
 */

export interface SensorTrend {
  timestamps: number[];
  ch4: number[];
  temperature: number[];
  pressure: number[];
}

let cachedTrend: SensorTrend | null = null;

export function generateMockSensorTrend(): SensorTrend {
  if (cachedTrend) return cachedTrend;

  const now = Date.now();
  const timestamps: number[] = [];
  const ch4: number[] = [];
  const temperature: number[] = [];
  const pressure: number[] = [];

  // 30 data points, 5 minutes apart
  for (let i = 29; i >= 0; i--) {
    const t = now - i * 5 * 60 * 1000;
    timestamps.push(t);

    // CH4: mostly stable around 1.0 with some spikes
    const baseCh4 = 0.8 + Math.sin(i * 0.3) * 0.4;
    const spike = i > 20 && i < 24 ? 2.5 : 0; // historical spike
    ch4.push(Math.max(0.1, Math.round((baseCh4 + spike + (Math.random() - 0.5) * 0.2) * 100) / 100));

    // Temperature: gradual increase with fluctuation
    const baseTemp = 28 + (29 - i) * 0.3 + Math.sin(i * 0.5) * 2;
    temperature.push(Math.round((baseTemp + (Math.random() - 0.5) * 1) * 10) / 10);

    // Pressure: relatively stable around 105 kPa
    pressure.push(Math.round((105 + Math.sin(i * 0.4) * 3 + (Math.random() - 0.5) * 1) * 10) / 10);
  }

  cachedTrend = { timestamps, ch4, temperature, pressure };
  return cachedTrend;
}
