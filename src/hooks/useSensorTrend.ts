import { useState, useEffect } from 'react';
import type { SensorTrend } from '../data/sensorTrendGenerator';

let cachedTrend: SensorTrend | null = null;

export function useSensorTrend() {
  const [data, setData] = useState<SensorTrend | null>(cachedTrend);
  const [loading, setLoading] = useState(!cachedTrend);

  useEffect(() => {
    if (cachedTrend) return;
    let cancelled = false;
    setLoading(true);
    import('../data/sensorTrendGenerator')
      .then(({ generateMockSensorTrend }) => {
        if (!cancelled) {
          cachedTrend = generateMockSensorTrend();
          setData(cachedTrend);
        }
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { data, loading };
}
