import { Badge } from '../ui/badge';
import type { Robot, RobotModel, RobotStatus, MeshRole } from '../../types';
import { Battery, Signal, Wifi, WifiOff, Activity, MapPin, Radio, X } from 'lucide-react';

const MODEL_LABELS: Record<RobotModel, string> = {
  snake: '蛇形',
  tracked: '履带式',
  wheeled: '轮式',
  climbing: '攀爬式',
  aerial: '飞行',
};

const STATUS_LABELS: Record<RobotStatus, string> = {
  online: '在线',
  offline: '离线',
  low_battery: '低电量',
  error: '故障',
  maintenance: '维护中',
};

const STATUS_COLORS: Record<RobotStatus, string> = {
  online: '#00FF66',
  offline: '#666',
  low_battery: '#FFA500',
  error: '#FF3333',
  maintenance: '#4DA6FF',
};

const MESH_LABELS: Record<MeshRole, string> = {
  gateway: '网关',
  relay: '中继',
  edge: '边缘',
  leaf: '终端',
};

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s前`;
  if (s < 3600) return `${Math.floor(s / 60)}m前`;
  return `${Math.floor(s / 3600)}h前`;
}

/**
 * 机器人悬浮信息卡 — 紧凑、半透明、不遮挡 3D 场景
 * 点击左侧列表或 3D 光点后，相机飞向机器人位置，同时显示此小卡片
 */
export function RobotDetailDialog({ robot, open, onClose }: { robot: Robot | null; open: boolean; onClose: () => void }) {
  if (!robot || !open) return null;

  const statusColor = STATUS_COLORS[robot.status];
  const batteryColor = robot.battery < 20 ? '#FF3333' : robot.battery < 40 ? '#FFA500' : '#00FF66';

  return (
    <div
      className="fixed z-50"
      style={{
        bottom: 'calc(30% + 12px)',
        right: 'calc(20% + 12px)',
        maxWidth: '220px',
      }}
    >
      <div
        className="rounded-lg border border-white/10 shadow-2xl backdrop-blur-md overflow-hidden"
        style={{ background: 'rgba(10,10,18,0.88)' }}
      >
        {/* Header: ID + status + close */}
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 border-b border-white/5">
          <div className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ backgroundColor: statusColor, boxShadow: `0 0 4px ${statusColor}` }} />
          <span className="text-[10px] font-mono font-semibold text-[#E0E0E8] truncate">{robot.id}</span>
          <span className="text-[8px] text-[#A0A0B0] flex-shrink-0">{MODEL_LABELS[robot.model]}</span>
          <span className="text-[8px] flex-shrink-0" style={{ color: statusColor }}>{STATUS_LABELS[robot.status]}</span>
          <button
            onClick={onClose}
            className="ml-auto w-4 h-4 flex items-center justify-center rounded hover:bg-white/10 transition-colors flex-shrink-0"
          >
            <X className="w-2.5 h-2.5 text-[#A0A0B0]" />
          </button>
        </div>

        {/* Body: compact info grid */}
        <div className="px-2.5 py-2 space-y-1">
          {/* Task */}
          <div className="text-[9px] text-[#FFE600] truncate">{robot.task}</div>

          {/* Battery + signal row */}
          <div className="flex items-center gap-2.5">
            <div className="flex items-center gap-0.5">
              <Battery className="w-2.5 h-2.5" style={{ color: batteryColor }} />
              <span className="text-[9px] font-mono" style={{ color: batteryColor }}>{robot.battery}%</span>
            </div>
            <div className="flex items-center gap-0.5">
              <Signal className="w-2.5 h-2.5 text-[#A0A0B0]/50" />
              <span className="text-[9px] font-mono text-[#A0A0B0]/70">{robot.signalStrength}dBm</span>
            </div>
            <div className="flex items-center gap-0.5">
              <Activity className="w-2.5 h-2.5 text-[#A0A0B0]/50" />
              <span className="text-[9px] font-mono text-[#A0A0B0]/70">{robot.depth}m</span>
            </div>
          </div>

          {/* Position */}
          <div className="flex items-center gap-0.5">
            <MapPin className="w-2.5 h-2.5 text-[#A0A0B0]/40" />
            <span className="text-[8px] font-mono text-[#A0A0B0]/50">
              [{robot.position[0].toFixed(1)}, {robot.position[1].toFixed(1)}, {robot.position[2].toFixed(1)}]
            </span>
            <span className="text-[8px] text-[#A0A0B0]/30 ml-auto">{timeAgo(robot.lastUpdate)}</span>
          </div>

          {/* Mesh + sensors in one row */}
          <div className="flex items-center gap-1.5 pt-0.5 border-t border-white/5">
            <div className="flex items-center gap-0.5">
              {robot.meshConnected ? <Wifi className="w-2.5 h-2.5 text-[#00FF66]/60" /> : <WifiOff className="w-2.5 h-2.5 text-[#FF3333]/60" />}
              <span className="text-[8px] text-[#A0A0B0]/60">{MESH_LABELS[robot.meshRole]}</span>
            </div>
            <span className="text-[8px] font-mono ml-auto" style={{ color: robot.sensors.ch4 > 1.5 ? '#FF3333' : '#FFA500' }}>
              CH4 {robot.sensors.ch4}%
            </span>
            <span className="text-[8px] font-mono text-[#FF6B35]">{robot.sensors.temperature}°</span>
            <span className="text-[8px] font-mono text-[#4DA6FF]">{robot.sensors.humidity}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}
