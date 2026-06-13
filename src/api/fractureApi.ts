/**
 * 裂缝网络 API
 *
 * Mock 模式：从内置 fractureDataGenerator 获取
 * Live 模式：从后端 GET /fractures?scenario= 获取
 *
 * 后端接口定义：
 *   GET /fractures?scenario=coal|gold|oil  → Fracture[]
 *   GET /fractures/:id                     → Fracture
 */

import type { Fracture, ScenarioType } from '../types';
import { isMockMode } from './config';
import { httpClient } from './httpClient';

// Mock 实现：延迟导入，仅 mock 模式加载
async function getMockFractures(scenario: ScenarioType): Promise<Fracture[]> {
  if (scenario === 'pipeline') {
    const { generatePipelineNetwork } = await import('../data/pipelineDataGenerator');
    return generatePipelineNetwork();
  }
  if (scenario === 'nuclear') {
    const { generateNuclearNetwork } = await import('../data/nuclearDataGenerator');
    return generateNuclearNetwork();
  }
  if (scenario === 'refinery') {
    const { generateRefineryNetwork } = await import('../data/refineryDataGenerator');
    return generateRefineryNetwork();
  }
  if (scenario === 'underground') {
    const { generateUndergroundNetwork } = await import('../data/undergroundDataGenerator');
    return generateUndergroundNetwork();
  }
  const { generateFractureNetwork } = await import('../data/fractureDataGenerator');
  return generateFractureNetwork(scenario);
}

/**
 * 获取裂缝网络数据
 * GET /fractures?scenario=coal|gold|oil
 */
export async function fetchFractures(
  scenario: ScenarioType = 'coal',
  signal?: AbortSignal
): Promise<Fracture[]> {
  if (isMockMode) {
    return getMockFractures(scenario);
  }
  return httpClient.get<Fracture[]>(`/fractures?scenario=${scenario}`, { signal });
}

/**
 * 获取单条裂缝详情
 * GET /fractures/:id
 */
export async function fetchFractureById(
  id: string,
  signal?: AbortSignal
): Promise<Fracture | undefined> {
  if (isMockMode) {
    const fractures = await getMockFractures('coal');
    return fractures.find((f) => f.id === id);
  }
  return httpClient.get<Fracture>(`/fractures/${id}`, { signal });
}
