/**
 * 告警事件 API
 *
 * Mock 模式：从内置 alertDataGenerator 获取
 * Live 模式：从后端 GET /alerts 获取
 *
 * 后端接口定义：
 *   GET /alerts          → AlertEvent[]
 *   GET /alerts?level=   → AlertEvent[]（按级别过滤）
 */

import type { AlertEvent, AlertLevel } from '../data/alertDataGenerator';
import { isMockMode } from './config';
import { httpClient } from './httpClient';

// Mock 实现：延迟导入
async function getMockAlerts(): Promise<AlertEvent[]> {
  const { generateMockRobots } = await import('../data/robotDataGenerator');
  const { generateMockAlerts } = await import('../data/alertDataGenerator');
  const robots = generateMockRobots();
  return generateMockAlerts(robots);
}

/**
 * 获取告警事件列表
 * GET /alerts
 */
export async function fetchAlerts(signal?: AbortSignal): Promise<AlertEvent[]> {
  if (isMockMode) {
    return getMockAlerts();
  }
  return httpClient.get<AlertEvent[]>('/alerts', { signal });
}

/**
 * 按级别过滤告警
 * GET /alerts?level=critical
 */
export async function fetchAlertsByLevel(
  level: AlertLevel,
  signal?: AbortSignal
): Promise<AlertEvent[]> {
  if (isMockMode) {
    const all = await getMockAlerts();
    return all.filter((a) => a.level === level);
  }
  return httpClient.get<AlertEvent[]>(`/alerts?level=${level}`, { signal });
}
