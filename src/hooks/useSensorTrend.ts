import { useState, useEffect } from 'react';
import type { SensorTrend } from '../data/sensorTrendGenerator';
import { useSceneStore } from '../store/useSceneStore';

let cachedTrend: SensorTrend | null = null;
let cachedFractureKey = '';
let cachedScenario = '';
let cachedDataSource = '';

export function useSensorTrend() {
  const [data, setData] = useState<SensorTrend | null>(cachedTrend);
  const [loading, setLoading] = useState(!cachedTrend);
  const fractures = useSceneStore((s) => s.fractures);
  const scenario = useSceneStore((s) => s.scenario);
  const dataSource = useSceneStore((s) => s.dataSource);

  useEffect(() => {
    // 当裂缝数据或场景变化时重新计算
    const fractureKey = fractures.map((f) => f.id).join(',');
    const totalNodes = fractures.reduce((sum, fracture) => sum + fracture.nodes.length, 0);
    if (
      cachedTrend &&
      fractureKey === cachedFractureKey &&
      scenario === cachedScenario &&
      dataSource === cachedDataSource
    ) return;

    let cancelled = false;
    setLoading(true);
    import('../data/sensorTrendGenerator')
      .then(({ generateMockSensorTrend }) => {
        if (!cancelled) {
          cachedTrend = generateMockSensorTrend(totalNodes, fractures, scenario);
          cachedFractureKey = fractureKey;
          cachedScenario = scenario;
          cachedDataSource = dataSource;
          setData(cachedTrend);
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [dataSource, fractures, scenario]);

  const totalNodes = fractures.reduce((sum, fracture) => sum + fracture.nodes.length, 0);
  return { data: data ?? cachedTrend, loading, totalNodes };
}
