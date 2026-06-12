import { useState, useEffect } from 'react';
import type { AlertEvent } from '../data/alertDataGenerator';

// Module-level cache
let cachedAlerts: AlertEvent[] | null = null;

export function useAlerts() {
  const [data, setData] = useState<AlertEvent[] | null>(cachedAlerts);
  const [loading, setLoading] = useState(!cachedAlerts);

  useEffect(() => {
    if (cachedAlerts) return;
    let cancelled = false;
    setLoading(true);
    // Alerts depend on robot data, so we import both
    (async () => {
      const { generateMockRobots } = await import('../data/robotDataGenerator');
      const { generateMockAlerts } = await import('../data/alertDataGenerator');
      const robots = generateMockRobots();
      const alerts = generateMockAlerts(robots);
      if (!cancelled) {
        cachedAlerts = alerts;
        setData(alerts);
      }
    })().finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { data, loading };
}
