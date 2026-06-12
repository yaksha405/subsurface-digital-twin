/**
 * 场景数据 API
 *
 * Mock 模式：从内置 mockDataGenerator 获取
 * Live 模式：从后端 GET /scene/* 获取
 *
 * 后端接口定义：
 *   GET /scene/nodes     → SceneNode[]
 *   GET /scene/geometry  → FlatGeometryData (JSON 序列化)
 *   GET /scene/stats     → SceneStats
 */

import type { SceneNode } from '../types';
import type { SceneStats, FlatGeometryData } from '../types/api';
import { isMockMode } from './config';
import { httpClient, ApiError } from './httpClient';

// Mock 实现延迟导入，仅在 mock 模式下加载
async function getMockNodes(): Promise<SceneNode[]> {
  const { generateMockNodes } = await import('../data/mockDataGenerator');
  return generateMockNodes();
}

async function getMockFlatGeometry(): Promise<FlatGeometryData> {
  const { getFlatGeometryData } = await import('../data/mockDataGenerator');
  return getFlatGeometryData();
}

async function getMockStats(): Promise<SceneStats> {
  const { getStats } = await import('../data/mockDataGenerator');
  return getStats();
}

/**
 * 获取全部场景节点
 * GET /scene/nodes
 */
export async function fetchSceneNodes(signal?: AbortSignal): Promise<SceneNode[]> {
  if (isMockMode) {
    return getMockNodes();
  }
  return httpClient.get<SceneNode[]>('/scene/nodes', { signal });
}

/**
 * 获取预计算的扁平几何数据（用于 Three.js BufferGeometry）
 * GET /scene/geometry
 *
 * Live 模式下后端返回 JSON，前端需将 number[] 转为 Float32Array
 */
export async function fetchFlatGeometry(signal?: AbortSignal): Promise<FlatGeometryData> {
  if (isMockMode) {
    return getMockFlatGeometry();
  }

  // 后端返回 JSON 格式（Float32Array 无法直接 JSON 序列化）
  const raw = await httpClient.get<{
    positions: number[];
    confidences: number[];
    gasValues: number[];
    tempValues: number[];
    intensities: number[];
    count: number;
  }>('/scene/geometry', { signal });

  return {
    positions: new Float32Array(raw.positions),
    confidences: new Float32Array(raw.confidences),
    gasValues: new Float32Array(raw.gasValues),
    tempValues: new Float32Array(raw.tempValues),
    intensities: new Float32Array(raw.intensities),
    count: raw.count,
  };
}

/**
 * 获取场景统计信息
 * GET /scene/stats
 */
export async function fetchSceneStats(signal?: AbortSignal): Promise<SceneStats> {
  if (isMockMode) {
    return getMockStats();
  }
  return httpClient.get<SceneStats>('/scene/stats', { signal });
}

export { ApiError };
