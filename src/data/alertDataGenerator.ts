/**
 * 实时告警事件 mock 数据生成器
 * 生成告警事件：瓦斯超标/机器人离线/Mesh断网/温度异常/电量低等
 */

import type { Robot } from '../types';

export type AlertLevel = 'danger' | 'warning' | 'info';
export type AlertType =
  | 'gas_overload'
  | 'robot_offline'
  | 'mesh_disconnect'
  | 'temp_anomaly'
  | 'battery_low'
  | 'robot_error'
  | 'task_complete'
  | 'system';

export interface AlertEvent {
  id: string;
  level: AlertLevel;
  type: AlertType;
  title: string;
  description: string;
  robotId?: string;
  position?: [number, number, number];
  timestamp: number;
  acknowledged: boolean;
}

const ALERT_TEMPLATES: { type: AlertType; level: AlertLevel; titleFn: (r: Robot) => { title: string; desc: string } }[] = [
  {
    type: 'gas_overload',
    level: 'danger',
    titleFn: (r) => ({
      title: `CH4 浓度超标 — ${r.id}`,
      desc: `${r.id} 检测到 CH4 浓度 ${r.sensors.ch4}%，超过安全阈值 1.5%，位置 Z=${r.depth}m`,
    }),
  },
  {
    type: 'robot_offline',
    level: 'warning',
    titleFn: (r) => ({
      title: `机器人离线 — ${r.id}`,
      desc: `${r.id} 已失联，最后位置 [${r.position.join(', ')}]，最后回传 Z=${r.depth}m`,
    }),
  },
  {
    type: 'mesh_disconnect',
    level: 'warning',
    titleFn: (r) => ({
      title: `Mesh 组网中断 — ${r.id}`,
      desc: `${r.id} 从 Mesh 网络掉线，角色 ${r.meshRole}，影响区域 Z=${r.depth}m 通信链路`,
    }),
  },
  {
    type: 'temp_anomaly',
    level: 'danger',
    titleFn: (r) => ({
      title: `温度异常 — ${r.id}`,
      desc: `${r.id} 环境温度 ${r.sensors.temperature}°C，超出正常范围，位置 Z=${r.depth}m`,
    }),
  },
  {
    type: 'battery_low',
    level: 'warning',
    titleFn: (r) => ({
      title: `电量告警 — ${r.id}`,
      desc: `${r.id} 电量仅剩 ${r.battery}%，建议尽快返回充电桩，当前任务: ${r.task}`,
    }),
  },
  {
    type: 'robot_error',
    level: 'danger',
    titleFn: (r) => ({
      title: `设备故障 — ${r.id}`,
      desc: `${r.id} 报告硬件异常，型号 ${r.model}，需要人工介入检查`,
    }),
  },
];

const SYSTEM_ALERTS: { type: AlertType; level: AlertLevel; title: string; desc: string }[] = [
  {
    type: 'system',
    level: 'info',
    title: '系统启动完成',
    desc: 'HIVE 数字孪生主控舱初始化完毕，200台机器人已注册，Mesh 网络拓扑建立成功',
  },
  {
    type: 'task_complete',
    level: 'info',
    title: '区域扫描完成',
    desc: 'SECTOR-A1 三维扫描任务完成，重建 12,000 个体素节点，点云置信度 60%',
  },
];

let cachedAlerts: AlertEvent[] | null = null;

export function generateMockAlerts(robots?: Robot[]): AlertEvent[] {
  if (cachedAlerts) return cachedAlerts;
  if (!robots) return [];

  const alerts: AlertEvent[] = [];
  let counter = 0;

  // System alerts
  for (const sys of SYSTEM_ALERTS) {
    alerts.push({
      id: `alert-${String(++counter).padStart(4, '0')}`,
      level: sys.level,
      type: sys.type,
      title: sys.title,
      description: sys.desc,
      timestamp: Date.now() - Math.floor(Math.random() * 3600000 * 2),
      acknowledged: false,
    });
  }

  // Robot-based alerts
  for (const r of robots) {
    let templateIdx: number | null = null;

    if (r.status === 'error') templateIdx = 5;       // robot_error
    else if (r.status === 'offline') templateIdx = 1; // robot_offline
    else if (r.status === 'low_battery') templateIdx = 4; // battery_low
    else if (!r.meshConnected && r.status !== 'maintenance') templateIdx = 2; // mesh_disconnect
    else if (r.sensors.ch4 > 1.5) templateIdx = 0;   // gas_overload
    else if (r.sensors.temperature > 40) templateIdx = 3; // temp_anomaly

    if (templateIdx !== null && Math.random() > 0.3) {
      const tpl = ALERT_TEMPLATES[templateIdx];
      const { title, desc } = tpl.titleFn(r);
      alerts.push({
        id: `alert-${String(++counter).padStart(4, '0')}`,
        level: tpl.level,
        type: tpl.type,
        title,
        description: desc,
        robotId: r.id,
        position: r.position,
        timestamp: Date.now() - Math.floor(Math.random() * 1800000),
        acknowledged: Math.random() > 0.6,
      });
    }
  }

  // Sort by timestamp descending (newest first)
  alerts.sort((a, b) => b.timestamp - a.timestamp);
  cachedAlerts = alerts;
  return alerts;
}
