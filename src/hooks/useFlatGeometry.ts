/**
 * useFlatGeometry — 点云扁平几何数据 Hook
 *
 * 调用 API 获取扁平化的点云数据，内部缓存避免重复请求。
 * 被以下组件共享：PointCloudLayer, DeckGlHeatmap
 */

import { useEffect, useState } from 'react';
import { fetchFlatGeometry } from '../api/sceneApi';
import type { FlatGeometryData } from '../types/api';

// 模块级缓存：多个组件共享同一份数据
let cached: FlatGeometryData | null = null;
let fetching: Promise<FlatGeometryData> | null = null;

export interface UseFlatGeometryResult {
  data: FlatGeometryData | null;
  loading: boolean;
  error: string | null;
}

export function useFlatGeometry(): UseFlatGeometryResult {
  const [data, setData] = useState<FlatGeometryData | null>(cached);
  const [loading, setLoading] = useState(!cached);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (cached) return;

    let cancelled = false;

    // 复用正在进行的请求
    if (!fetching) {
      fetching = fetchFlatGeometry();
    }

    fetching
      .then((d) => {
        if (cancelled) return;
        cached = d;
        setData(d);
        setLoading(false);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e.message || '加载点云数据失败');
        setLoading(false);
        fetching = null; // 允许重试
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { data, loading, error };
}
