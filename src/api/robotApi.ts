/**
 * 集群机器人 API
 *
 * Mock 模式：从内置 robotDataGenerator 获取
 * Live 模式：从后端 GET /robots 获取
 *
 * 后端接口定义：
 *   GET /robots              → Robot[]（支持 query 参数过滤）
 *   GET /robots/:id          → Robot
 *   GET /robots/stats        → RobotFleetStats
 */

import type { Robot } from '../types';
import type { RobotQuery, RobotFleetStats } from '../types/api';
import { isMockMode } from './config';
import { httpClient } from './httpClient';

async function getMockRobots(query?: RobotQuery): Promise<Robot[]> {
  const { generateMockRobots } = await import('../data/robotDataGenerator');
  let robots = generateMockRobots();

  if (query?.q) {
    const q = query.q.toLowerCase();
    robots = robots.filter(r => r.id.toLowerCase().includes(q));
  }
  if (query?.status && query.status !== 'all') {
    robots = robots.filter(r => r.status === query.status);
  }
  if (query?.model && query.model !== 'all') {
    robots = robots.filter(r => r.model === query.model);
  }
  if (query?.meshRole && query.meshRole !== 'all') {
    robots = robots.filter(r => r.meshRole === query.meshRole);
  }
  return robots;
}

async function getMockRobotStats(): Promise<RobotFleetStats> {
  const { getMockRobotStats } = await import('../data/robotDataGenerator');
  return getMockRobotStats();
}

/**
 * 获取机器人列表（支持过滤）
 * GET /robots?status=&model=&mesh_role=&q=
 */
export async function fetchRobots(query?: RobotQuery, signal?: AbortSignal): Promise<Robot[]> {
  if (isMockMode) {
    return getMockRobots(query);
  }

  const params = new URLSearchParams();
  if (query?.status && query.status !== 'all') params.set('status', query.status);
  if (query?.model && query.model !== 'all') params.set('model', query.model);
  if (query?.meshRole && query.meshRole !== 'all') params.set('mesh_role', query.meshRole);
  if (query?.q) params.set('q', query.q);

  const qs = params.toString();
  return httpClient.get<Robot[]>(`/robots${qs ? `?${qs}` : ''}`, { signal });
}

/**
 * 获取单个机器人详情
 * GET /robots/:id
 */
export async function fetchRobotById(id: string, signal?: AbortSignal): Promise<Robot> {
  if (isMockMode) {
    const { generateMockRobots } = await import('../data/robotDataGenerator');
    return generateMockRobots().find(r => r.id === id)!;
  }
  return httpClient.get<Robot>(`/robots/${id}`, { signal });
}

/**
 * 获取机器人集群统计
 * GET /robots/stats
 */
export async function fetchRobotStats(signal?: AbortSignal): Promise<RobotFleetStats> {
  if (isMockMode) {
    return getMockRobotStats();
  }
  return httpClient.get<RobotFleetStats>('/robots/stats', { signal });
}
