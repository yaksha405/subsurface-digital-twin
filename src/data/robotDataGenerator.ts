import type { Robot, RobotModel, RobotStatus, MeshRole } from '../types';
import { getAllPathPoints, generateFractureNetwork } from './fractureDataGenerator';

// Seeded random
let seed = 7777;
function sr(): number {
  seed = (seed * 16807) % 2147483647;
  return seed / 2147483647;
}
function rand(min: number, max: number): number {
  return min + sr() * (max - min);
}
function pick<T>(arr: T[]): T {
  return arr[Math.floor(sr() * arr.length)];
}

const TOTAL_ROBOTS = 200;

// 型号权重分布（地下狭窄裂缝场景：全部蛇形机器人）
const MODEL_WEIGHTS: { model: RobotModel; weight: number }[] = [
  { model: 'snake', weight: 100 },    // 蛇形（唯一能钻进地下裂缝的型号）
];

// 任务池（地下裂缝场景）
const TASKS = [
  '裂缝精细探测',
  '瓦斯浓度巡检',
  '三维扫描建图',
  'Mesh 中继转发',
  '深部取样分析',
  '顶板位移监测',
  '温度梯度测绘',
  '待命中',
  '狭窄裂缝爬行',
  '夹层结构成像',
  '气体泄漏排查',
  '裂隙扩张监测',
  '声发射信号采集',
  '水文参数探查',
];

// 状态权重（地下恶劣环境，故障率偏高）
const STATUS_WEIGHTS: { status: RobotStatus; weight: number }[] = [
  { status: 'online', weight: 60 },
  { status: 'low_battery', weight: 15 },
  { status: 'offline', weight: 12 },
  { status: 'maintenance', weight: 8 },
  { status: 'error', weight: 5 },
];

function weightedPick<T extends { weight: number }>(items: T[]): T {
  const total = items.reduce((s, i) => s + i.weight, 0);
  let r = sr() * total;
  for (const item of items) {
    r -= item.weight;
    if (r <= 0) return item;
  }
  return items[0];
}

/**
 * 获取机器人在裂缝网络中的部署位置
 * - 使用裂缝路径点（密集），确保机器人始终在裂缝线上
 * - 偏移 ±0.5 以内，视觉上紧贴裂缝
 */
function getRobotPosition(index: number): [number, number, number] {
  const pathPoints = getAllPathPoints();

  if (pathPoints.length > 0) {
    // 沿裂缝路径均匀分布（加少量抖动避免完全重叠）
    const idx = index % pathPoints.length;
    const jitter = Math.floor(index / pathPoints.length); // 循环时叠加偏移
    const basePos = pathPoints[(idx + jitter * 7) % pathPoints.length];
    // 极小偏移 — 机器人贴着裂缝壁，不漂到岩层里
    return [
      Math.round((basePos[0] + rand(-0.5, 0.5)) * 10) / 10,
      Math.round((basePos[1] + rand(-0.3, 0.3)) * 10) / 10,
      Math.round((basePos[2] + rand(-0.5, 0.5)) * 10) / 10,
    ];
  }

  // 兜底
  return [
    Math.round(rand(-45, 45) * 10) / 10,
    Math.round(rand(-15, 15) * 10) / 10,
    Math.round(rand(-35, 35) * 10) / 10,
  ];
}

function generateRobot(index: number): Robot {
  const position = getRobotPosition(index);
  const model = weightedPick(MODEL_WEIGHTS).model;
  const status = weightedPick(STATUS_WEIGHTS).status;

  const meshRoll = sr();
  const meshRole: MeshRole =
    meshRoll < 0.05 ? 'gateway' :
    meshRoll < 0.20 ? 'relay' :
    meshRoll < 0.55 ? 'edge' : 'leaf';

  const meshConnected = status === 'online' || status === 'low_battery'
    ? sr() > 0.05
    : sr() > 0.7;

  let battery: number;
  if (status === 'low_battery') battery = Math.floor(rand(3, 20));
  else if (status === 'offline') battery = Math.floor(rand(0, 15));
  else if (status === 'maintenance') battery = Math.floor(rand(50, 100));
  else battery = Math.floor(rand(25, 100));

  // 深度 = 距岩体表面的距离
  const distFromSurface = Math.min(
    Math.abs(position[0] - 50), Math.abs(position[0] + 50),
    Math.abs(position[2] - 40), Math.abs(position[2] + 40),
  );
  const depth = Math.round(distFromSurface * 10) / 10;

  // 信号强度（越深越弱）
  const signalStrength = Math.round(-40 - depth * 0.4 + rand(-10, 10));

  // 传感器读数
  const ch4 = Math.round(rand(0.1, 3.5) * 100) / 100;
  const temperature = Math.round((22 + depth * 0.15 + rand(-3, 8)) * 10) / 10;
  const humidity = Math.round(rand(45, 95));

  return {
    id: `R-${String(index + 1).padStart(3, '0')}`,
    model,
    status,
    position,
    battery,
    meshRole,
    meshConnected,
    task: pick(TASKS),
    depth,
    signalStrength,
    sensors: { ch4, temperature, humidity },
    lastUpdate: Date.now() - Math.floor(rand(0, 300000)),
  };
}

let cachedRobots: Robot[] | null = null;

export function generateMockRobots(): Robot[] {
  if (cachedRobots) return cachedRobots;
  // 确保裂缝网络先生成（机器人位置依赖裂缝节点）
  generateFractureNetwork('coal');
  seed = 7777;
  cachedRobots = [];
  for (let i = 0; i < TOTAL_ROBOTS; i++) {
    cachedRobots.push(generateRobot(i));
  }
  return cachedRobots;
}

export function getMockRobotStats() {
  const robots = generateMockRobots();
  const online = robots.filter(r => r.status === 'online').length;
  const offline = robots.filter(r => r.status === 'offline').length;
  const lowBattery = robots.filter(r => r.status === 'low_battery').length;
  const error = robots.filter(r => r.status === 'error').length;
  const maintenance = robots.filter(r => r.status === 'maintenance').length;
  const meshConnected = robots.filter(r => r.meshConnected).length;
  const avgBattery = Math.round(robots.reduce((s, r) => s + r.battery, 0) / robots.length);
  return { total: robots.length, online, offline, lowBattery, error, maintenance, meshConnected, avgBattery };
}
