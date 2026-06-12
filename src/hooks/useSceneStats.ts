/**
 * useSceneStats — 场景统计数据 Hook
 *
 * 调用 API 获取聚合统计（节点数、平均瓦斯、超标区域等）。
 * 支持 refetch 重新获取。
 */

import { useCallback, useEffect, useState } from 'react';
import { fetchSceneStats } from '../api/sceneApi';
import type { SceneStats } from '../types/api';

let cached: SceneStats | null = null;

export interface UseSceneStatsResult {
  data: SceneStats | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export function useSceneStats(): UseSceneStatsResult {
  const [data, setData] = useState<SceneStats | null>(cached);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);
  const [refetchFlag, setRefetchFlag] = useState(0);

  const refetch = useCallback(() => {
    cached = null;
    setRefetchFlag((f) => f + 1);
  }, []);

  useEffect(() => {
    if (cached) return;

    let cancelled = false;
    setLoading(true);
    setError(null);

    fetchSceneStats()
      .then((d) => {
        if (cancelled) return;
        cached = d;
        setData(d);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e.message || '加载统计数据失败');
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [refetchFlag]);

  return { data, loading, error, refetch };
}
