import type { Robot, RobotModel, RobotStatus, MeshRole, DataSourceType, ScenarioType } from '../types';
import { getAllPathPoints, generateFractureNetwork } from './fractureDataGenerator';
import { getAllPipelinePathPoints, generatePipelineNetwork } from './pipelineDataGenerator';
import { getAllNuclearPathPoints, generateNuclearNetwork } from './nuclearDataGenerator';
import { getAllRefineryPathPoints, generateRefineryNetwork } from './refineryDataGenerator';
import { getAllUndergroundPathPoints, generateUndergroundNetwork } from './undergroundDataGenerator';

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
const MODEL_WEIGHTS_FRACTURE: { model: RobotModel; weight: number }[] = [
  { model: 'snake', weight: 100 },    // 蛇形（唯一能钻进地下裂缝的型号）
];

// 管线场景：全部蛛型巡检机器人
const MODEL_WEIGHTS_PIPELINE: { model: RobotModel; weight: number }[] = [
  { model: 'spider', weight: 100 },   // 蛛型（自适应管径, 管道内部爬行）
];

// 核反应堆场景：全部耐辐照蛛型机器人
const MODEL_WEIGHTS_NUCLEAR: { model: RobotModel; weight: number }[] = [
  { model: 'spider', weight: 100 },   // 蛛型（耐辐照设计, 管道内壁爬行）
];

// 炼油化工场景：全部蛇形机器人（穿越换热器管束/炉管/塔内件狭窄通道）
const MODEL_WEIGHTS_REFINERY: { model: RobotModel; weight: number }[] = [
  { model: 'snake', weight: 100 },    // 蛇形（多关节柔性体, 穿越管内通道）
];

// 地下暗流场景：全部浮走式(章鱼)机器人 — 水中漂浮蠕动推进
const MODEL_WEIGHTS_UNDERGROUND: { model: RobotModel; weight: number }[] = [
  { model: 'floatwalker', weight: 100 }, // 浮走/章鱼式（水中漂浮蠕动，暗流通道主战）
];

// 任务池（地下裂缝场景）
const TASKS_FRACTURE = [
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

const TASKS_GOLD = [
  '微震活动监测',
  '岩爆风险复核',
  '应力异常巡测',
  '采空区稳定性评估',
  '矿脉追踪成像',
  '裂隙扩张监测',
  '岩温梯度测绘',
  '待命中',
  '空区边界扫描',
  '声发射信号采集',
];

const TASKS_OIL = [
  '孔隙压力监测',
  '储层连通性评估',
  '渗透率原位测试',
  '含水率巡检',
  '地层温度测绘',
  '压裂风险复核',
  '储层裂缝扫描',
  '待命中',
  '压差异常排查',
  '采收率辅助分析',
];

// 任务池（管线场景）
const TASKS_PIPELINE = [
  '管道壁厚超声检测',
  '腐蚀区域标记',
  '焊缝探伤扫查',
  '泄漏点精确定位',
  '管道内部三维扫描',
  'Mesh 中继转发',
  '阴极保护电位测量',
  '待命中',
  '支管入口巡检',
  'H₂S浓度监测',
  '流量计校验',
  '管道沉降监测',
  '阀门密封检测',
  '管壁高清晰度成像',
];

// 任务池（核反应堆场景）
const TASKS_NUCLEAR = [
  '主管道焊缝超声检测',
  '一回路剂量率巡测',
  'SG传热管涡流探伤',
  '壁厚超声测厚',
  'FAC敏感区监测',
  'Mesh 中继转发',
  '阀门动作可靠性测试',
  '待命中',
  '主泵密封泄漏检测',
  '稳压器波动管巡检',
  '安注管路畅通性验证',
  '辐射热点三维成像',
  '疲劳累积在线监测',
  '冷态/热态功能试验辅助',
];

// 任务池（地下暗流场景 — 浮走/蛇形/履带/蛛形协作探测）
const TASKS_UNDERGROUND = [
  '暗流通道三维扫描',
  '水质取样分析',
  '溶洞沉积物探测',
  'Mesh 中继转发',
  '狭窄瓶颈穿行',
  '水文参数探查',
  '暗流漂浮巡游',
  '待命中',
  '盲端溶洞成像',
  '岩壁裂缝巡检',
  '流量速率测量',
  '温度梯度测绘',
  '矿化度检测',
  '渗透率原位测试',
];

// 任务池（炼油化工场景 — 蛇形机器人内部巡检）
const TASKS_REFINERY = [
  '换热器管束内窥检测',
  '炉管壁厚超声测厚',
  '炉管蠕变区域标记',
  '蒸馏塔塔盘变形检测',
  '结垢厚度红外测量',
  'Mesh 中继转发',
  '焊缝裂纹探伤',
  '待命中',
  '降液管堵塞排查',
  '对流管束声发射监测',
  '塔内件腐蚀评估',
  '出入口法兰密封检测',
  '管程差压异常排查',
  '塔顶腐蚀在线监测',
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
 * 获取机器人在裂缝/管线/核反应堆网络中的部署位置
 * - 使用路径点（密集），确保机器人始终在管道/裂缝线上
 * - 偏移 ±0.5 以内，视觉上紧贴
 */
function getRobotPosition(index: number, dataSource: DataSourceType): [number, number, number] {
  const pathPoints =
    dataSource === 'pipeline' ? getAllPipelinePathPoints() :
    dataSource === 'nuclear' ? getAllNuclearPathPoints() :
    dataSource === 'refinery' ? getAllRefineryPathPoints() :
    dataSource === 'underground' ? getAllUndergroundPathPoints() :
    getAllPathPoints();

  if (pathPoints.length > 0) {
    // 沿路径均匀分布（加少量抖动避免完全重叠）
    const idx = index % pathPoints.length;
    const jitter = Math.floor(index / pathPoints.length); // 循环时叠加偏移
    const basePos = pathPoints[(idx + jitter * 7) % pathPoints.length];
    // 极小偏移 — 机器人贴着管壁/裂缝壁
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

function round(value: number, digits: number): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

function generateRobot(index: number, dataSource: DataSourceType, scenario: ScenarioType = 'coal'): Robot {
  const position = getRobotPosition(index, dataSource);
  const modelWeights =
    dataSource === 'pipeline' ? MODEL_WEIGHTS_PIPELINE :
    dataSource === 'nuclear' ? MODEL_WEIGHTS_NUCLEAR :
    dataSource === 'refinery' ? MODEL_WEIGHTS_REFINERY :
    dataSource === 'underground' ? MODEL_WEIGHTS_UNDERGROUND :
    MODEL_WEIGHTS_FRACTURE;
  const tasks =
    dataSource === 'pipeline' ? TASKS_PIPELINE :
    dataSource === 'nuclear' ? TASKS_NUCLEAR :
    dataSource === 'refinery' ? TASKS_REFINERY :
    dataSource === 'underground' ? TASKS_UNDERGROUND :
    scenario === 'gold' ? TASKS_GOLD :
    scenario === 'oil' ? TASKS_OIL :
    TASKS_FRACTURE;
  const model = weightedPick(modelWeights).model;
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

  // 深度/距离 — 按场景计算不同物理含义
  let depth: number;
  if (dataSource === 'nuclear') {
    // 距反应堆压力容器中心[0,-14,0]的距离(m)
    depth = Math.round(Math.sqrt(position[0] ** 2 + (position[1] + 14) ** 2 + position[2] ** 2) * 10) / 10;
  } else if (dataSource === 'refinery') {
    // 距设备区入口的距离(m)
    depth = Math.round(Math.sqrt(position[0] ** 2 + position[1] ** 2 + position[2] ** 2) * 10) / 10;
  } else if (dataSource === 'pipeline') {
    // 距管道入口的距离(m)
    depth = Math.round(Math.sqrt(position[0] ** 2 + position[1] ** 2 + position[2] ** 2) * 10) / 10;
  } else if (dataSource === 'underground') {
    // 地下深度(m) — y 轴负方向，每单位 = 10m 实际深度
    depth = Math.max(0, Math.round(-Math.min(position[1], 0) * 10));
  } else {
    // 地下裂缝：距岩体表面深度(m)
    const distFromSurface = Math.min(
      Math.abs(position[0] - 50), Math.abs(position[0] + 50),
      Math.abs(position[2] - 40), Math.abs(position[2] + 40),
    );
    depth = Math.round(distFromSurface * 10) / 10;
  }

  // 信号强度 — 非裂缝场景金属/混凝土环境衰减更大
  const signalBase = dataSource === 'nuclear' ? -65 : dataSource === 'refinery' ? -60 : dataSource === 'pipeline' ? -55 : dataSource === 'underground' ? -50 : -40;
  const signalStrength = Math.round(signalBase - depth * 0.3 + rand(-8, 8));

  // 传感器读数 — 按数据源使用不同物理量，值域符合行业实际
  let ch4: number, temperature: number, humidity: number;

  if (dataSource === 'nuclear') {
    // 核反应堆：剂量率(mSv/h) / 冷却剂温度(°C) / 运行压力(MPa)
    const doseRoll = sr();
    ch4 = doseRoll > 0.8 ? round(rand(15, 50), 2) : round(rand(0.1, 8), 2);
    temperature = round(rand(280, 330), 1);
    humidity = round(rand(14.8, 15.6), 1);
  } else if (dataSource === 'refinery') {
    // 炼油化工：壁厚减薄(%) / 操作温度(°C) / 腐蚀速率(mm/yr)
    ch4 = round(rand(0.5, 8.0), 1);
    temperature = round(rand(60, 420), 1);
    humidity = round(rand(0.03, 0.8), 2);
  } else if (dataSource === 'pipeline') {
    // 管线：天然气泄漏(%LEL) / 管道温度(°C) / 运行压力(MPa)
    const leakRoll = sr();
    ch4 = leakRoll > 0.85 ? round(rand(15, 35), 1) : round(rand(0, 10), 1);
    temperature = round(rand(8, 55), 1);
    humidity = round(rand(3.0, 12.0), 1);
  } else if (dataSource === 'underground') {
    // 地下暗流：矿化度(mg/L) / 地温(°C) / 含水率(%)
    const mineralRoll = sr();
    ch4 = mineralRoll > 0.8 ? Math.round(rand(48_000, 72_000)) : Math.round(rand(12_000, 42_000));
    temperature = round(rand(35, 110), 1);
    humidity = round(rand(95, 100), 1);
  } else {
    // 地下裂缝子场景：主指标 / 温度 / 辅助读数
    if (scenario === 'gold') {
      ch4 = Math.round(rand(4, 22));
      temperature = round(rand(26, 42), 1);
      humidity = round(rand(8, 22), 1);
    } else if (scenario === 'oil') {
      ch4 = round(rand(14, 36), 1);
      temperature = round(rand(52, 92), 1);
      humidity = round(rand(0.4, 3.6), 2);
    } else {
      ch4 = round(rand(0.1, 3.5), 2);
      temperature = round(22 + depth * 0.15 + rand(-3, 8), 1);
      humidity = Math.round(rand(45, 95));
    }
  }

  return {
    id: `R-${String(index + 1).padStart(3, '0')}`,
    model,
    status,
    position,
    battery,
    meshRole,
    meshConnected,
    task: pick(tasks),
    depth,
    signalStrength,
    sensors: { ch4, temperature, humidity },
    lastUpdate: Date.now() - Math.floor(rand(0, 300000)),
  };
}

let cachedRobots: Robot[] | null = null;
let cachedGoldRobots: Robot[] | null = null;
let cachedOilRobots: Robot[] | null = null;
let cachedPipelineRobots: Robot[] | null = null;
let cachedNuclearRobots: Robot[] | null = null;
let cachedRefineryRobots: Robot[] | null = null;
let cachedUndergroundRobots: Robot[] | null = null;

export function generateMockRobots(dataSource: DataSourceType = 'fracture', scenario: ScenarioType = 'coal'): Robot[] {
  if (dataSource === 'pipeline') {
    if (cachedPipelineRobots) return cachedPipelineRobots;
    generatePipelineNetwork();
    seed = 7777;
    cachedPipelineRobots = [];
    for (let i = 0; i < 150; i++) cachedPipelineRobots.push(generateRobot(i, 'pipeline'));
    return cachedPipelineRobots;
  }

  if (dataSource === 'nuclear') {
    if (cachedNuclearRobots) return cachedNuclearRobots;
    generateNuclearNetwork();
    seed = 7777;
    cachedNuclearRobots = [];
    for (let i = 0; i < 180; i++) cachedNuclearRobots.push(generateRobot(i, 'nuclear'));
    return cachedNuclearRobots;
  }

  if (dataSource === 'refinery') {
    if (cachedRefineryRobots) return cachedRefineryRobots;
    generateRefineryNetwork();
    seed = 7777;
    cachedRefineryRobots = [];
    for (let i = 0; i < 160; i++) cachedRefineryRobots.push(generateRobot(i, 'refinery'));
    return cachedRefineryRobots;
  }

  if (dataSource === 'underground') {
    if (cachedUndergroundRobots) return cachedUndergroundRobots;
    generateUndergroundNetwork();
    seed = 7777;
    cachedUndergroundRobots = [];
    for (let i = 0; i < 160; i++) cachedUndergroundRobots.push(generateRobot(i, 'underground'));
    return cachedUndergroundRobots;
  }

  if (scenario === 'gold') {
    if (cachedGoldRobots) return cachedGoldRobots;
    generateFractureNetwork('gold');
    seed = 7777;
    cachedGoldRobots = [];
    for (let i = 0; i < TOTAL_ROBOTS; i++) cachedGoldRobots.push(generateRobot(i, 'fracture', 'gold'));
    return cachedGoldRobots;
  }

  if (scenario === 'oil') {
    if (cachedOilRobots) return cachedOilRobots;
    generateFractureNetwork('oil');
    seed = 7777;
    cachedOilRobots = [];
    for (let i = 0; i < TOTAL_ROBOTS; i++) cachedOilRobots.push(generateRobot(i, 'fracture', 'oil'));
    return cachedOilRobots;
  }

  if (cachedRobots) return cachedRobots;
  generateFractureNetwork('coal');
  seed = 7777;
  cachedRobots = [];
  for (let i = 0; i < TOTAL_ROBOTS; i++) cachedRobots.push(generateRobot(i, 'fracture', 'coal'));
  return cachedRobots;
}

export function getMockRobotStats(dataSource: DataSourceType = 'fracture', scenario: ScenarioType = 'coal') {
  const robots = generateMockRobots(dataSource, scenario);
  const online = robots.filter(r => r.status === 'online').length;
  const offline = robots.filter(r => r.status === 'offline').length;
  const lowBattery = robots.filter(r => r.status === 'low_battery').length;
  const error = robots.filter(r => r.status === 'error').length;
  const maintenance = robots.filter(r => r.status === 'maintenance').length;
  const meshConnected = robots.filter(r => r.meshConnected).length;
  const avgBattery = Math.round(robots.reduce((s, r) => s + r.battery, 0) / robots.length);
  return { total: robots.length, online, offline, lowBattery, error, maintenance, meshConnected, avgBattery };
}
