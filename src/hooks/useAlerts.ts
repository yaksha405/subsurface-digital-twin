import { useState, useEffect } from 'react';
import type { AlertEvent } from '../data/alertDataGenerator';
import { fetchAlerts } from '../api/alertApi';

// Module-level cache
let cachedAlerts: AlertEvent[] | null = null;

export function useAlerts() {
  const [data, setData] = useState<AlertEvent[] | null>(cachedAlerts);
  const [loading, setLoading] = useState(!cachedAlerts);

  useEffect(() => {
    if (cachedAlerts) return;
    let cancelled = false;
    setLoading(true);
    // 通过 API 层获取告警数据（mock 模式用生成器，live 模式请求后端）
    (async () => {
      const alerts = await fetchAlerts();
      if (!cancelled) {
        cachedAlerts = alerts;
        setData(alerts);
      }
    })().finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  return { data, loading };
}
