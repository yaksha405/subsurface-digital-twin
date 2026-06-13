/**
 * 任务回放引擎 — 模拟真实机器人探测过程
 *
 * 核心逻辑：
 * 1. 将机器人分配到各裂缝/管道路径（round-robin，每条主干分配一批）
 * 2. 根据 playbackProgress 计算每个机器人沿路径的前进比例
 *    - 大部分机器人正常前进（速度有随机差异）
 *    - 少数机器人会卡住（status → offline/error），停在原地
 *    - 少数机器人变慢（status → low_battery）
 * 3. 计算每条裂缝的"已发现比例" = 该裂缝上最远机器人的进度
 * 4. 输出：动画机器人位置数组 + 每条裂缝的揭示比例
 */
import * as THREE from 'three';
import type { Fracture, Robot, RobotStatus } from '../types';

export interface AnimatedRobot {
  id: string;
  model: Robot['model'];
  status: RobotStatus;
  /** 动画后的实时位置 */
  position: [number, number, number];
  battery: number;
  meshRole: Robot['meshRole'];
  meshConnected: boolean;
  task: string;
  depth: number;
  signalStrength: number;
  sensors: Robot['sensors'];
  lastUpdate: number;
  /** 分配到的裂缝 ID */
  fractureId: string;
  /** 沿路径的前进比例 0~1 */
  pathProgress: number;
}

export interface PlaybackState {
  /** 动画机器人列表（只有已部署的） */
  robots: AnimatedRobot[];
  /** 每条裂缝的揭示比例 { fractureId: 0~1 } */
  revealRatios: Record<string, number>;
}

// 缓存：避免每次 render 都重新分配
let _cacheKey = '';
let _assignments: Map<string, { fractureId: string; speedFactor: number; stallAt: number; stallType: RobotStatus | null }> = new Map();
let _curveCache: Map<string, THREE.CatmullRomCurve3> = new Map();

// 缓存：每条分支的汇合点信息 { branchId → { parentId, junctionFraction } }
let _junctionCache: Map<string, { parentId: string; junctionFraction: number }> = new Map();

// 缓存：fractureId → 地表入口点（所有机器人在 pathT=0 时的集合点）
let _rootEntryCache = new Map<string, [number, number, number]>();

/**
 * 计算分支裂缝与其母体（主裂缝）的连接关系。
 *
 * 查找分支 path[0]（入口）在母体路径上最近的点，返回：
 * - parentId: 母体裂缝 ID
 * - junctionFraction: 汇合点在母体路径上的位置比例 (0~1)
 *
 * 优先使用显式 parentFractureId；若为 null（如核反应堆管网），
 * 则通过空间最近匹配在所有主裂缝中查找。
 */
function computeBranchJunction(
  branch: Fracture,
  fractures: Fracture[],
): { parentId: string; junctionFraction: number } {
  const existing = _junctionCache.get(branch.id);
  if (existing) return existing;

  const origin = branch.path[0];

  // 候选母体：优先显式 parentFractureId，否则全部主裂缝
  const explicitParent = fractures.find(f => f.id === branch.parentFractureId);
  const candidates = explicitParent
    ? [explicitParent]
    : fractures.filter(f => f.type === 'main');

  let bestParentId = '';
  let bestFraction = 0;
  let bestDist = Infinity;

  for (const parent of candidates) {
    for (let i = 0; i < parent.path.length; i++) {
      const dx = parent.path[i][0] - origin[0];
      const dy = parent.path[i][1] - origin[1];
      const dz = parent.path[i][2] - origin[2];
      const dist = dx * dx + dy * dy + dz * dz;
      if (dist < bestDist) {
        bestDist = dist;
        bestParentId = parent.id;
        bestFraction = i / Math.max(1, parent.path.length - 1);
      }
    }
  }

  const result = { parentId: bestParentId, junctionFraction: bestFraction };
  _junctionCache.set(branch.id, result);
  return result;
}

/**
 * 计算裂缝的"地表入口"——机器人未开始爬行时的集合点。
 *
 * 物理逻辑：
 * - 主裂缝（type='main'）的地表入口 = 自己的 path[0]
 *   但如果该主裂缝入口本身在地下深处（如地下暗流的主干3），
 *   则回退到最近的地表主裂缝入口
 * - 非主裂缝的地表入口 = 沿母体关系追溯到根主裂缝的 path[0]
 *
 * 这确保了所有机器人在回放开始时都在地表入口聚集，
 * 而不是凭空出现在地下深处的分支入口。
 */
function getRootEntryPoint(
  fracture: Fracture,
  fractures: Fracture[],
): [number, number, number] {
  const existing = _rootEntryCache.get(fracture.id);
  if (existing) return existing;

  const mains = fractures.filter(f => f.type === 'main');
  if (mains.length === 0) {
    _rootEntryCache.set(fracture.id, fracture.path[0]);
    return fracture.path[0];
  }

  // 找到 Y 值最高（最接近地表/入口）的主裂缝入口
  const maxMainY = Math.max(...mains.map(m => m.path[0][1]));
  // 地表主裂缝：入口 Y 值在最高主裂缝的 5 以内
  const surfaceMains = mains.filter(m => m.path[0][1] >= maxMainY - 5);

  if (fracture.type === 'main') {
    // 主裂缝自身是地表入口
    if (surfaceMains.includes(fracture)) {
      _rootEntryCache.set(fracture.id, fracture.path[0]);
      return fracture.path[0];
    }
    // 地下主裂缝（如深层连通暗河）→ 最近的地表主裂缝入口
    const nearest = findNearestEntry(fracture.path[0], surfaceMains);
    _rootEntryCache.set(fracture.id, nearest);
    return nearest;
  }

  // 非主裂缝 → 追溯母体
  const visited = new Set<string>();
  let current: Fracture | undefined = fracture;
  while (current && !visited.has(current.id)) {
    visited.add(current.id);
    if (current.type === 'main') break;
    const j = computeBranchJunction(current, fractures);
    current = fractures.find(f => f.id === j.parentId);
  }

  if (current && current.type === 'main') {
    if (surfaceMains.includes(current)) {
      _rootEntryCache.set(fracture.id, current.path[0]);
      return current.path[0];
    }
    const nearest = findNearestEntry(current.path[0], surfaceMains);
    _rootEntryCache.set(fracture.id, nearest);
    return nearest;
  }

  // 兜底
  const fallback = surfaceMains[0]?.path[0] ?? fracture.path[0];
  _rootEntryCache.set(fracture.id, fallback);
  return fallback;
}

/** 在候选主裂缝中找到入口距离 target 最近的那条 */
function findNearestEntry(
  target: [number, number, number],
  candidates: Fracture[],
): [number, number, number] {
  let best = candidates[0]?.path[0] ?? target;
  let bestDist = Infinity;
  for (const c of candidates) {
    const dx = c.path[0][0] - target[0];
    const dy = c.path[0][1] - target[1];
    const dz = c.path[0][2] - target[2];
    const dist = dx * dx + dy * dy + dz * dz;
    if (dist < bestDist) {
      bestDist = dist;
      best = c.path[0];
    }
  }
  return best;
}

/**
 * 将机器人分配到裂缝路径
 * - 加权比例分配：主干权重 3，其他 2，分支 1
 * - 保证每条裂缝至少有 MIN_PER_FRACTURE 个机器人
 * - 剩余机器人按权重比例分配
 * - 每个机器人有独立的速度系数（0.5~1.5）和随机故障概率
 */
function assignRobotsToFractures(
  robots: Robot[],
  fractures: Fracture[],
): Map<string, { fractureId: string; speedFactor: number; stallAt: number; stallType: RobotStatus | null; entryOffset: number }> {
  const key = `${robots.length}-${fractures.length}-${robots[0]?.id}-${fractures[0]?.id}`;
  if (key === _cacheKey) return _assignments as any;
  _cacheKey = key;

  const assignments = new Map<string, { fractureId: string; speedFactor: number; stallAt: number; stallType: RobotStatus | null; entryOffset: number }>();

  if (fractures.length === 0) return assignments;

  // 计算每条裂缝的权重
  const weights = fractures.map(f => {
    if (f.type === 'main') return 3;
    if (f.type === 'branch') return 1;
    return 2;
  });

  // 第一步：保证每条裂缝至少 MIN_PER_FRACTURE 个机器人
  const MIN_PER_FRACTURE = 2;
  const guaranteed = Math.min(MIN_PER_FRACTURE, Math.floor(robots.length / fractures.length));
  const guaranteedTotal = guaranteed * fractures.length;

  // 按裂缝构建机器人 ID 列表
  const robotsPerFracture: number[] = fractures.map(() => guaranteed);

  // 第二步：剩余机器人按权重比例分配
  const remaining = robots.length - guaranteedTotal;
  if (remaining > 0) {
    const totalWeight = weights.reduce((s, w) => s + w, 0);
    let allocated = 0;
    for (let fi = 0; fi < fractures.length; fi++) {
      const share = Math.floor(remaining * weights[fi] / totalWeight);
      robotsPerFracture[fi] += share;
      allocated += share;
    }
    // 分配余数（从权重最高的裂缝开始）
    let leftover = remaining - allocated;
    let fi = 0;
    while (leftover > 0) {
      robotsPerFracture[fi % fractures.length]++;
      leftover--;
      fi++;
    }
  }

  // 将机器人分配到裂缝（按 robotsPerFracture 列表依次消耗）
  let robotIdx = 0;
  for (let fi = 0; fi < fractures.length; fi++) {
    const count = robotsPerFracture[fi];
    for (let c = 0; c < count && robotIdx < robots.length; c++, robotIdx++) {
      const robot = robots[robotIdx];
      const frac = fractures[fi];

      // 确定性伪随机数生成器
      const charCodeSum = robot.id.charCodeAt(0) + (robot.id.charCodeAt(2) || 48);
      const hash = (n: number) => ((charCodeSum * 9301 + n * 49297) % 233280) / 233280;

      // 速度系数：大部分正常(0.7~1.3)，少数慢(0.4~0.7)
      let speedFactor = 0.7 + hash(robotIdx) * 0.6;
      let stallType: RobotStatus | null = null;
      let stallAt = 1.0;

      // ★ 关键：从数据原始 status 派生停机行为（不再独立随机生成）
      // 确保 3D 渲染颜色/状态与数据源完全一致
      switch (robot.status) {
        case 'error':
          // 设备故障 — 卡在路径 15~50% 处
          stallAt = 0.15 + hash(robotIdx + 200) * 0.35;
          stallType = 'error';
          speedFactor *= 0.7;
          break;
        case 'offline':
          // 通信中断 — 卡在路径 20~60% 处
          stallAt = 0.20 + hash(robotIdx + 300) * 0.40;
          stallType = 'offline';
          speedFactor *= 0.8;
          break;
        case 'low_battery':
          // 低电量 — 减速但继续前进，最终到达
          stallType = 'low_battery';
          speedFactor *= 0.5;
          break;
        case 'maintenance':
          // 维护中 — 留在入口不动
          stallAt = 0;
          stallType = 'maintenance';
          speedFactor = 0;
          break;
        case 'online':
        default:
          // 正常运行 — 全程爬行
          break;
      }

      const entryOffset = Math.sin(robotIdx * 2.4) * 1.5;

      assignments.set(robot.id, {
        fractureId: frac.id,
        speedFactor,
        stallAt,
        stallType,
        entryOffset,
      });
    }
  }

  _assignments = assignments as any;
  return assignments;
}

/** 缓存 CatmullRomCurve3 以避免重复创建 */
function getCurve(fracture: Fracture): THREE.CatmullRomCurve3 | null {
  const existing = _curveCache.get(fracture.id);
  if (existing) return existing;

  const points = fracture.path.map(p => new THREE.Vector3(...p));
  if (points.length < 2) return null;

  const curve = new THREE.CatmullRomCurve3(points);
  _curveCache.set(fracture.id, curve);
  return curve;
}

/**
 * 计算每条裂缝在回放中的揭示比例（用于管道渲染截断）
 *
 * 物理逻辑：
 * 1. 主干裂缝按时间进度逐步揭示（从入口向远端推进）
 * 2. 分支裂缝只能在其母体（主裂缝）的探测推进到汇合点之后才开始揭示
 *    — 这模拟了机器人爬过主裂缝到达岔路口后才发现/进入分支
 * 3. 分支揭示速度取决于母体探测越过汇合点后还剩多少路程
 */
export function computeRevealRatios(
  fractures: Fracture[],
  progress: number,
): Record<string, number> {
  const ratios: Record<string, number> = {};
  const fractureMap = new Map(fractures.map(f => [f.id, f]));

  const mainFractures = fractures.filter(f => f.type === 'main');
  const mainCount = Math.max(1, mainFractures.length);

  // Phase 1: 主裂缝 — 基于时间进度独立揭示
  mainFractures.forEach((f, mi) => {
    // 主干在 progress 0.1~0.7 之间逐步揭示（按序号错开）
    const start = 0.1 + (mi / mainCount) * 0.3;
    ratios[f.id] = Math.max(0, Math.min(1, (progress - start) / 0.4));
  });

  // 其他类型（如 'trunk'）按主干逻辑处理
  fractures.forEach(f => {
    if (f.type !== 'main' && f.type !== 'branch' && ratios[f.id] === undefined) {
      ratios[f.id] = Math.max(0, Math.min(1, (progress - 0.1) / 0.5));
    }
  });

  // Phase 2: 分支裂缝 — 由母体探测进度门控
  const branchFractures = fractures.filter(f => f.type === 'branch');
  const branchCount = Math.max(1, branchFractures.length);

  branchFractures.forEach((f, bi) => {
    const junction = computeBranchJunction(f, fractures);

    if (!junction.parentId || !fractureMap.has(junction.parentId)) {
      // 无法确定母体 — 退化为基于时间的保守揭示（progress 0.4+）
      ratios[f.id] = Math.max(0, Math.min(1, (progress - 0.4 - (bi / branchCount) * 0.1) / 0.5));
      return;
    }

    const parentReveal = ratios[junction.parentId] ?? 0;
    const jf = junction.junctionFraction;

    // 关键约束：母体探测未到达汇合点 → 分支完全不显示
    if (parentReveal < jf) {
      ratios[f.id] = 0;
      return;
    }

    // 汇合点之后剩余的母体探测路程
    const exploreRange = 1.0 - jf;
    if (exploreRange <= 0.02) {
      // 汇合点在母体末端 — 母体几乎完全探测后分支立即出现
      ratios[f.id] = parentReveal >= jf ? 1 : 0;
      return;
    }

    // 错开量：延迟分支开始揭示的时刻（不削减最终值）
    const stagger = (bi / branchCount) * 0.08;
    const adjStart = jf + stagger * exploreRange;
    if (parentReveal < adjStart) {
      ratios[f.id] = 0;
      return;
    }
    const adjRange = 1.0 - adjStart;
    ratios[f.id] = Math.max(0, Math.min(1,
      (parentReveal - adjStart) / Math.max(0.01, adjRange),
    ));
  });

  return ratios;
}

/**
 * 主入口：计算机器人位置 + 管道揭示比例
 *
 * 核心原则（机器人驱动，非时间驱动）：
 * 1. 机器人按时间/速度沿裂缝爬行 → 爬到哪里，管道揭示到哪里
 * 2. 主裂缝机器人从入口开始，按 crawlPhase * speed 爬行
 * 3. 分支裂缝机器人只有在母体裂缝上最远的机器人物理越过汇合点后才开始爬行
 * 4. 揭示比例 = 每条裂缝上最远机器人的 pathT（不是时间表）
 *
 * @param robots 全部机器人（静态数据）
 * @param fractures 全部裂缝/管道
 * @param progress 回放进度 0~1
 * @returns 动画机器人 + 每条裂缝的揭示比例
 */
export function computePlaybackState(
  robots: Robot[],
  fractures: Fracture[],
  progress: number,
): PlaybackState {
  const assignments = assignRobotsToFractures(robots, fractures);
  const fractureMap = new Map(fractures.map(f => [f.id, f]));

  const deployPhase = Math.min(1, progress / 0.15);
  const crawlPhase = Math.max(0, (progress - 0.05) / 0.95);

  // 每条裂缝的最远机器人进度（= 该裂缝的揭示比例）
  const maxProgressPerFracture: Record<string, number> = {};
  fractures.forEach(f => { maxProgressPerFracture[f.id] = 0; });

  // 临时存储：robotId → { pathT, assign, fractureId }
  const robotPathT = new Map<string, number>();

  // ---- Step 1: 主裂缝 / 其他类型 — 机器人按时间爬行 ----
  for (let ri = 0; ri < robots.length; ri++) {
    const robot = robots[ri];
    const assign = assignments.get(robot.id);
    if (!assign) continue;

    const fracture = fractureMap.get(assign.fractureId);
    if (!fracture || fracture.type === 'branch') continue;

    const deployThreshold = (ri / robots.length) * 0.8;

    // ★ 未部署的机器人留在入口（pathT=0），不跳过 — 保证机器人数始终一致
    if (deployPhase <= deployThreshold) {
      robotPathT.set(robot.id, 0);
      continue;
    }

    let pathT = crawlPhase * assign.speedFactor;
    pathT = Math.min(pathT, assign.stallAt);

    if (crawlPhase > 0.9) {
      const ramp = (crawlPhase - 0.9) / 0.1;
      pathT = pathT * (1 - ramp) + assign.stallAt * ramp;
    }

    pathT = Math.max(0, Math.min(1, pathT));
    robotPathT.set(robot.id, pathT);
    maxProgressPerFracture[fracture.id] = Math.max(maxProgressPerFracture[fracture.id], pathT);
  }

  // ---- Step 2: 分支裂缝 — 由母体最远机器人位置物理门控 ----
  for (let ri = 0; ri < robots.length; ri++) {
    const robot = robots[ri];
    const assign = assignments.get(robot.id);
    if (!assign) continue;

    const fracture = fractureMap.get(assign.fractureId);
    if (!fracture || fracture.type !== 'branch') continue;

    const deployThreshold = (ri / robots.length) * 0.8;

    // ★ 未部署或母体未到汇合点 → 机器人留在入口（pathT=0），不跳过
    if (deployPhase <= deployThreshold) {
      robotPathT.set(robot.id, 0);
      continue;
    }

    const junction = computeBranchJunction(fracture, fractures);
    const parentMax = maxProgressPerFracture[junction.parentId] ?? 0;

    // 母体最远机器人还没爬到汇合点 → 分支机器人留在入口
    if (parentMax < junction.junctionFraction) {
      robotPathT.set(robot.id, 0);
      continue;
    }

    // 母体越过汇合点的比例 (0~1)
    const exploreRange = 1.0 - junction.junctionFraction;
    let pathT: number;

    if (exploreRange <= 0.02) {
      // 汇合点在母体末端 — 母体探到底后分支机器人全力爬行
      pathT = crawlPhase * assign.speedFactor;
    } else {
      const explorePastJunction = (parentMax - junction.junctionFraction) / exploreRange;
      pathT = explorePastJunction * assign.speedFactor;
    }

    pathT = Math.min(pathT, assign.stallAt);

    if (crawlPhase > 0.9) {
      const ramp = (crawlPhase - 0.9) / 0.1;
      pathT = pathT * (1 - ramp) + assign.stallAt * ramp;
    }

    pathT = Math.max(0, Math.min(1, pathT));
    // pathT=0 的机器人已经由前面的逻辑处理（留在入口），这里只记录有进展的
    robotPathT.set(robot.id, pathT);
    maxProgressPerFracture[fracture.id] = Math.max(maxProgressPerFracture[fracture.id], pathT);
  }

  // ---- Step 3: 生成动画机器人位置 ----
  const animatedRobots: AnimatedRobot[] = [];

  for (let ri = 0; ri < robots.length; ri++) {
    const robot = robots[ri];
    const pathT = robotPathT.get(robot.id);
    if (pathT === undefined) continue;

    const assign = assignments.get(robot.id)!;
    const fracture = fractureMap.get(assign.fractureId)!;
    const curve = getCurve(fracture);
    if (!curve) continue;

    const pos = curve.getPointAt(Math.min(0.999, Math.max(0, pathT)));

    let finalPos: [number, number, number];
    if (pathT < 0.05) {
      // ★ 未开始爬行的机器人聚集在地表入口（不是裂缝自身的入口）
      // 分支机器人的 path[0] 可能在地下深处，但它们应该从地表入口出发
      const rootEntry = getRootEntryPoint(fracture, fractures);
      const entryBlend = pathT / 0.05; // 0→1 平滑过渡
      const curveEntry = fracture.path[0];
      finalPos = [
        rootEntry[0] * (1 - entryBlend) + curveEntry[0] * entryBlend + assign.entryOffset * (1 - pathT / 0.05),
        rootEntry[1] * (1 - entryBlend) + curveEntry[1] * entryBlend + Math.cos(assign.entryOffset * 3) * 0.5,
        rootEntry[2] * (1 - entryBlend) + curveEntry[2] * entryBlend + Math.sin(assign.entryOffset * 2) * (1 - pathT / 0.05),
      ];
    } else {
      finalPos = [pos.x, pos.y, pos.z];
    }

    // ★ 状态直接使用数据源原始 status — 颜色/存活状态完全一致
    const status: RobotStatus = robot.status;

    animatedRobots.push({
      id: robot.id,
      model: robot.model,
      status,
      position: finalPos,
      battery: robot.battery,
      meshRole: robot.meshRole,
      meshConnected: robot.meshConnected,
      task: robot.task,
      depth: Math.abs(finalPos[1]),
      signalStrength: robot.signalStrength,
      sensors: robot.sensors,
      lastUpdate: Date.now(),
      fractureId: assign.fractureId,
      pathProgress: pathT,
    });
  }

  return { robots: animatedRobots, revealRatios: maxProgressPerFracture };
}

/** 重置缓存（切换场景时调用） */
export function resetPlaybackCache() {
  _cacheKey = '';
  _assignments = new Map();
  _curveCache = new Map();
  _junctionCache = new Map();
  _rootEntryCache = new Map();
}
