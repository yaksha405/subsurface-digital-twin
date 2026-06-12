import { useState, useEffect, useMemo } from 'react';
import { fetchRobots, fetchRobotStats } from '../api/robotApi';
import type { Robot } from '../types';
import type { RobotFleetStats } from '../types/api';

// 模块级缓存（避免重复请求）
let cachedAllRobots: Robot[] | null = null;
let cachedStats: RobotFleetStats | null = null;

export interface RobotFilter {
  status: string;
  model: string;
  meshRole: string;
  q: string;
}

export const defaultFilter: RobotFilter = {
  status: 'all',
  model: 'all',
  meshRole: 'all',
  q: '',
};

/**
 * 获取全部机器人列表（带模块缓存）
 */
export function useAllRobots() {
  const [data, setData] = useState<Robot[] | null>(cachedAllRobots);
  const [loading, setLoading] = useState(!cachedAllRobots);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (cachedAllRobots) return;
    const ctrl = new AbortController();
    setLoading(true);
    fetchRobots(undefined, ctrl.signal)
      .then((robots) => {
        cachedAllRobots = robots;
        setData(robots);
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e);
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, []);

  return { data, loading, error };
}

/**
 * 获取集群统计（带模块缓存）
 */
export function useRobotStats() {
  const [data, setData] = useState<RobotFleetStats | null>(cachedStats);
  const [loading, setLoading] = useState(!cachedStats);

  useEffect(() => {
    if (cachedStats) return;
    const ctrl = new AbortController();
    setLoading(true);
    fetchRobotStats(ctrl.signal)
      .then((stats) => {
        cachedStats = stats;
        setData(stats);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, []);

  return { data, loading };
}

/**
 * 带过滤的机器人列表 Hook
 * 客户端过滤（数据量 200 台，无需每次都打后端）
 */
export function useFilteredRobots(filter: RobotFilter) {
  const { data: allRobots, loading } = useAllRobots();

  const filtered = useMemo(() => {
    if (!allRobots) return [];
    return allRobots.filter((r) => {
      if (filter.q && !r.id.toLowerCase().includes(filter.q.toLowerCase())) return false;
      if (filter.status !== 'all' && r.status !== filter.status) return false;
      if (filter.model !== 'all' && r.model !== filter.model) return false;
      if (filter.meshRole !== 'all' && r.meshRole !== filter.meshRole) return false;
      return true;
    });
  }, [allRobots, filter]);

  return { data: filtered, loading, total: allRobots?.length ?? 0 };
}
