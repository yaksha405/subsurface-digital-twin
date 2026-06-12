import { useState, useEffect } from 'react';
import type { SensorTrend } from '../data/sensorTrendGenerator';
import { useSceneStore } from '../store/useSceneStore';

let cachedTrend: SensorTrend | null = null;
let cachedFractureKey = '';

export function useSensorTrend() {
  const [data, setData] = useState<SensorTrend | null>(cachedTrend);
  const [loading, setLoading] = useState(!cachedTrend);
  const fractures = useSceneStore((s) => s.fractures);

  useEffect(() => {
    // 当裂缝数据变化时重新计算
    const fractureKey = fractures.map((f) => f.id).join(',');
    if (cachedTrend && fractureKey === cachedFractureKey) return;

    let cancelled = false;
    setLoading(true);
    import('../data/sensorTrendGenerator')
      .then(({ generateMockSensorTrend }) => {
        if (!cancelled) {
          cachedTrend = generateMockSensorTrend(fractures.length * 4, fractures);
          cachedFractureKey = fractureKey;
          setData(cachedTrend);
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [fractures]);

  return { data: data ?? cachedTrend, loading };
}
