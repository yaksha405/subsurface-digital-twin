import type { DataSourceType, Fracture, ScenarioType } from '../types';
import type { SceneStats, RobotFleetStats } from '../types/api';
import { buildSceneMetricSummary } from './sceneMetricSummary';
import { generateFractureNetwork } from '../data/fractureDataGenerator';
import { generatePipelineNetwork } from '../data/pipelineDataGenerator';
import { generateNuclearNetwork } from '../data/nuclearDataGenerator';
import { generateRefineryNetwork } from '../data/refineryDataGenerator';
import { generateUndergroundNetwork } from '../data/undergroundDataGenerator';
import { generateMockRobots } from '../data/robotDataGenerator';
import { generateMockAlerts, type AlertEvent } from '../data/alertDataGenerator';

export interface SceneDataset {
  dataSource: DataSourceType;
  scenario: ScenarioType;
  fractures: Fracture[];
  robots: ReturnType<typeof generateMockRobots>;
  alerts: AlertEvent[];
  summary: {
    scene: SceneStats;
    robotFleet: RobotFleetStats;
    alerts: {
      total: number;
      danger: number;
      warning: number;
      info: number;
      unacknowledged: number;
    };
  };
}

const datasetCache = new Map<string, SceneDataset>();

function getFractures(dataSource: DataSourceType, scenario: ScenarioType): Fracture[] {
  switch (dataSource) {
    case 'pipeline':
      return generatePipelineNetwork();
    case 'nuclear':
      return generateNuclearNetwork();
    case 'refinery':
      return generateRefineryNetwork();
    case 'underground':
      return generateUndergroundNetwork();
    case 'fracture':
    default:
      return generateFractureNetwork(scenario);
  }
}

function buildRobotFleetSummary(robots: ReturnType<typeof generateMockRobots>): RobotFleetStats {
  const total = robots.length;
  const online = robots.filter((robot) => robot.status === 'online').length;
  const offline = robots.filter((robot) => robot.status === 'offline').length;
  const lowBattery = robots.filter((robot) => robot.status === 'low_battery').length;
  const error = robots.filter((robot) => robot.status === 'error').length;
  const maintenance = robots.filter((robot) => robot.status === 'maintenance').length;
  const meshConnected = robots.filter((robot) => robot.meshConnected).length;
  const avgBattery = total === 0
    ? 0
    : Math.round(robots.reduce((sum, robot) => sum + robot.battery, 0) / total);

  return { total, online, offline, lowBattery, error, maintenance, meshConnected, avgBattery };
}

function buildAlertSummary(alerts: AlertEvent[]) {
  return {
    total: alerts.length,
    danger: alerts.filter((alert) => alert.level === 'danger').length,
    warning: alerts.filter((alert) => alert.level === 'warning').length,
    info: alerts.filter((alert) => alert.level === 'info').length,
    unacknowledged: alerts.filter((alert) => !alert.acknowledged).length,
  };
}

function buildSceneSummary(fractures: Fracture[], scenario: ScenarioType): SceneStats {
  const metricSummary = buildSceneMetricSummary(fractures, scenario);

  return {
    totalNodes: metricSummary.totalNodes,
    avgGas: metricSummary.avgPrimary,
    avgTemp: metricSummary.avgTemperature,
    avgConf: fractures.length === 0 ? 0 : 60,
    overThreshold: metricSummary.overThreshold,
    onlineSensors: metricSummary.totalNodes,
    lastUpdate: Date.now(),
  };
}

export function buildSceneDataset(
  dataSource: DataSourceType,
  scenario: ScenarioType,
): SceneDataset {
  const key = dataSource === 'fracture' ? `${dataSource}:${scenario}` : dataSource;
  const cached = datasetCache.get(key);
  if (cached) return cached;

  const fractures = getFractures(dataSource, scenario);
  const robots = generateMockRobots(dataSource, scenario);
  const alerts = generateMockAlerts(robots, dataSource, scenario);
  const dataset: SceneDataset = {
    dataSource,
    scenario,
    fractures,
    robots,
    alerts,
    summary: {
      scene: buildSceneSummary(fractures, scenario),
      robotFleet: buildRobotFleetSummary(robots),
      alerts: buildAlertSummary(alerts),
    },
  };

  datasetCache.set(key, dataset);
  return dataset;
}

export function clearSceneDatasetCache() {
  datasetCache.clear();
}
