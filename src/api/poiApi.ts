/**
 * POI（兴趣点）数据 API
 *
 * Mock 模式：从内置 poiData 获取
 * Live 模式：从后端 GET /pois 获取
 *
 * 后端接口定义：
 *   GET /pois → POI[]
 */

import type { POI } from '../types';
import { isMockMode } from './config';
import { httpClient } from './httpClient';

/**
 * 获取全部 POI 标记点
 * GET /pois
 */
export async function fetchPOIs(signal?: AbortSignal): Promise<POI[]> {
  if (isMockMode) {
    const { poiData } = await import('../data/poiData');
    return poiData;
  }
  return httpClient.get<POI[]>('/pois', { signal });
}
