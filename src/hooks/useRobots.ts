import { useState, useEffect, useMemo } from 'react';
import { fetchRobots, fetchRobotStats } from '../api/robotApi';
import type { Robot, DataSourceType, ScenarioType } from '../types';
import type { RobotFleetStats } from '../types/api';

// 模块级缓存（按数据源分别缓存）
const robotCache: Record<string, Robot[] | null> = {};
const statsCache: Record<string, RobotFleetStats | null> = {};

function cacheKey(dataSource: DataSourceType, scenario: ScenarioType): string {
  return dataSource === 'fracture' ? `${dataSource}:${scenario}` : dataSource;
}

/** 清除指定数据源的缓存（切换数据源时调用） */
export function clearRobotCache(dataSource: DataSourceType) {
  for (const key of Object.keys(robotCache)) {
    if (key === dataSource || key.startsWith(`${dataSource}:`)) robotCache[key] = null;
  }
  for (const key of Object.keys(statsCache)) {
    if (key === dataSource || key.startsWith(`${dataSource}:`)) statsCache[key] = null;
  }
}

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
 * 获取全部机器人列表（带模块缓存，按数据源区分）
 */
export function useAllRobots(dataSource: DataSourceType = 'fracture', scenario: ScenarioType = 'coal') {
  const key = cacheKey(dataSource, scenario);
  const [data, setData] = useState<Robot[] | null>(robotCache[key]);
  const [loading, setLoading] = useState(!robotCache[key]);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (robotCache[key]) { setData(robotCache[key]); return; }
    const ctrl = new AbortController();
    setLoading(true);
    fetchRobots(undefined, ctrl.signal, dataSource, scenario)
      .then((robots) => {
        robotCache[key] = robots;
        setData(robots);
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setError(e);
      })
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [dataSource, key, scenario]);

  return { data, loading, error };
}

/**
 * 获取集群统计（带模块缓存，按数据源区分）
 */
export function useRobotStats(dataSource: DataSourceType = 'fracture', scenario: ScenarioType = 'coal') {
  const key = cacheKey(dataSource, scenario);
  const [data, setData] = useState<RobotFleetStats | null>(statsCache[key]);
  const [loading, setLoading] = useState(!statsCache[key]);

  useEffect(() => {
    if (statsCache[key]) { setData(statsCache[key]); return; }
    const ctrl = new AbortController();
    setLoading(true);
    fetchRobotStats(ctrl.signal, dataSource, scenario)
      .then((stats) => {
        statsCache[key] = stats;
        setData(stats);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
    return () => ctrl.abort();
  }, [dataSource, key, scenario]);

  return { data, loading };
}

/**
 * 带过滤的机器人列表 Hook
 */
export function useFilteredRobots(filter: RobotFilter, dataSource: DataSourceType = 'fracture', scenario: ScenarioType = 'coal') {
  const { data: allRobots, loading } = useAllRobots(dataSource, scenario);

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
