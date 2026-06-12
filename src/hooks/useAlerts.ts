import { useState, useEffect } from 'react';
import type { AlertEvent } from '../data/alertDataGenerator';
import { fetchAlerts } from '../api/alertApi';
import type { DataSourceType } from '../types';

// Module-level cache (per dataSource)
const alertCache: Record<string, AlertEvent[] | null> = {};

export function useAlerts(dataSource: DataSourceType = 'fracture') {
  const key = dataSource;
  const [data, setData] = useState<AlertEvent[] | null>(alertCache[key]);
  const [loading, setLoading] = useState(!alertCache[key]);

  useEffect(() => {
    if (alertCache[key]) { setData(alertCache[key]); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const alerts = await fetchAlerts(undefined, dataSource);
      if (!cancelled) {
        alertCache[key] = alerts;
        setData(alerts);
      }
    })().finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [key]);

  return { data, loading };
}
