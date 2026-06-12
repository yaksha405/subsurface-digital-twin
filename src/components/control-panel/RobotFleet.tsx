import { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { useRobotStats, useFilteredRobots, defaultFilter, type RobotFilter } from '../../hooks/useRobots';
import { useSceneStore } from '../../store/useSceneStore';
import type { RobotModel, RobotStatus, MeshRole } from '../../types';
import { Search, Bot, Battery, Signal, Wifi, WifiOff } from 'lucide-react';

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

const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'online', label: '在线' },
  { value: 'offline', label: '离线' },
  { value: 'low_battery', label: '低电量' },
  { value: 'error', label: '故障' },
  { value: 'maintenance', label: '维护' },
];

const MODEL_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: '全部型号' },
  { value: 'snake', label: '蛇形' },
  { value: 'tracked', label: '履带式' },
  { value: 'wheeled', label: '轮式' },
  { value: 'climbing', label: '攀爬式' },
  { value: 'aerial', label: '飞行' },
];

const MESH_OPTIONS: { value: string; label: string }[] = [
  { value: 'all', label: '全部角色' },
  { value: 'gateway', label: '网关' },
  { value: 'relay', label: '中继' },
  { value: 'edge', label: '边缘' },
  { value: 'leaf', label: '终端' },
];

function batteryColor(battery: number): string {
  if (battery < 20) return '#FF3333';
  if (battery < 40) return '#FFA500';
  return '#00FF66';
}

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}s前`;
  if (s < 3600) return `${Math.floor(s / 60)}m前`;
  return `${Math.floor(s / 3600)}h前`;
}

function RobotCard({ robot, onClick }: { robot: Robot; onClick: () => void }) {
  const color = STATUS_COLORS[robot.status];

  return (
    <div
      onClick={onClick}
      className="group px-2.5 py-2 rounded-md bg-[#1A1D2A]/60 border border-white/5 hover:border-[#FFE600]/30 hover:bg-[#1A1D2A] cursor-pointer transition-all"
    >
      {/* Row 1: ID + status */}
      <div className="flex items-center justify-between mb-1">
        <div className="flex items-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: color, boxShadow: `0 0 4px ${color}` }} />
          <span className="text-[11px] font-mono font-semibold text-[#E0E0E8] group-hover:text-[#FFE600]">{robot.id}</span>
          <span className="text-[9px] text-[#A0A0B0]">{MODEL_LABELS[robot.model]}</span>
        </div>
        {robot.meshConnected ? (
          <Wifi className="w-3 h-3 text-[#00FF66]/60" />
        ) : (
          <WifiOff className="w-3 h-3 text-[#FF3333]/60" />
        )}
      </div>

      {/* Row 2: task + mesh role */}
      <div className="flex items-center gap-1 mb-1.5">
        <Badge variant="neutral" className="text-[8px] px-1 py-0">{STATUS_LABELS[robot.status]}</Badge>
        <Badge variant="neutral" className="text-[8px] px-1 py-0">{MESH_LABELS[robot.meshRole]}</Badge>
        <span className="text-[9px] text-[#A0A0B0]/70 truncate flex-1">{robot.task}</span>
      </div>

      {/* Row 3: battery + signal + depth */}
      <div className="flex items-center gap-2.5">
        <div className="flex items-center gap-0.5">
          <Battery className="w-2.5 h-2.5" style={{ color: batteryColor(robot.battery) }} />
          <span className="text-[8px] font-mono" style={{ color: batteryColor(robot.battery) }}>{robot.battery}%</span>
        </div>
        <div className="flex items-center gap-0.5">
          <Signal className="w-2.5 h-2.5 text-[#A0A0B0]/50" />
          <span className="text-[8px] font-mono text-[#A0A0B0]/70">{robot.signalStrength}dBm</span>
        </div>
        <span className="text-[8px] font-mono text-[#A0A0B0]/50 ml-auto">Z={robot.depth}m</span>
        <span className="text-[8px] text-[#A0A0B0]/40">{timeAgo(robot.lastUpdate)}</span>
      </div>
    </div>
  );
}

export function RobotFleet() {
  const [filter, setFilter] = useState<RobotFilter>(defaultFilter);
  const [collapsed, setCollapsed] = useState(false);
  const { data: stats } = useRobotStats();
  const { data: robots, loading, total } = useFilteredRobots(filter);
  const flyTo = useSceneStore((s) => s.flyTo);
  const setHighlightRegion = useSceneStore((s) => s.setHighlightRegion);
  const openRobotDetail = useSceneStore((s) => s.openRobotDetail);

  const handleRobotClick = (robot: Parameters<typeof openRobotDetail>[0]) => {
    flyTo({ position: robot.position, region: `robot-${robot.id}` });
    setHighlightRegion({ position: robot.position, radius: 8, active: true });
    setTimeout(() => {
      setHighlightRegion({ position: robot.position, radius: 8, active: false });
    }, 5000);
    openRobotDetail(robot);
  };

  return (
    <>
    <Card>
      <CardHeader onClick={() => setCollapsed(!collapsed)} className="cursor-pointer">
        <CardTitle className="flex items-center gap-2">
          <Bot className="w-3.5 h-3.5 text-[#FFE600]" />
          <span>集群机器人</span>
          {stats && (
            <span className="ml-auto text-[9px] font-mono text-[#A0A0B0]">
              {stats.online}<span className="text-[#00FF66]">●</span> / {stats.total}
            </span>
          )}
        </CardTitle>
      </CardHeader>

      {!collapsed && (
        <CardContent className="space-y-2">
          {/* Summary stats bar */}
          {stats && (
            <div className="grid grid-cols-5 gap-1">
              <StatChip label="在线" value={stats.online} color="#00FF66" />
              <StatChip label="离线" value={stats.offline} color="#666" />
              <StatChip label="低电量" value={stats.lowBattery} color="#FFA500" />
              <StatChip label="故障" value={stats.error} color="#FF3333" />
              <StatChip label="Mesh" value={stats.meshConnected} color="#4DA6FF" />
            </div>
          )}

          {/* Search input */}
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3 h-3 text-[#A0A0B0]/50" />
            <input
              type="text"
              value={filter.q}
              onChange={(e) => setFilter({ ...filter, q: e.target.value })}
              placeholder="搜索编号 R-001..."
              className="w-full pl-7 pr-2 py-1.5 text-[10px] bg-[#0F0F16] border border-white/10 rounded-md text-[#E0E0E8] placeholder:text-[#A0A0B0]/30 focus:outline-none focus:border-[#FFE600]/30"
            />
          </div>

          {/* Filter dropdowns */}
          <div className="grid grid-cols-3 gap-1">
            <FilterSelect
              value={filter.status}
              options={STATUS_OPTIONS}
              onChange={(v) => setFilter({ ...filter, status: v })}
            />
            <FilterSelect
              value={filter.model}
              options={MODEL_OPTIONS}
              onChange={(v) => setFilter({ ...filter, model: v })}
            />
            <FilterSelect
              value={filter.meshRole}
              options={MESH_OPTIONS}
              onChange={(v) => setFilter({ ...filter, meshRole: v })}
            />
          </div>

          {/* Result count */}
          <div className="text-[9px] text-[#A0A0B0]/50 text-center">
            {loading ? '加载中...' : `显示 ${robots.length} / ${total} 台`}
          </div>

          {/* Robot list */}
          <div className="max-h-[300px] overflow-y-auto space-y-1 pr-0.5 custom-scroll">
            {robots.map((robot) => (
              <RobotCard key={robot.id} robot={robot} onClick={() => handleRobotClick(robot)} />
            ))}
            {!loading && robots.length === 0 && (
              <div className="text-[10px] text-[#A0A0B0]/40 text-center py-4">
                {filter.model !== 'all' && filter.model !== 'snake'
                  ? `${MODEL_LABELS[filter.model as RobotModel]} 机器人在当前裂缝场景未部署`
                  : '无匹配机器人'}
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
    </>
  );
}

function StatChip({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="flex flex-col items-center py-1 bg-[#0F0F16]/60 rounded border border-white/5">
      <span className="text-[12px] font-mono font-bold" style={{ color }}>{value}</span>
      <span className="text-[7px] text-[#A0A0B0]/50">{label}</span>
    </div>
  );
}

function FilterSelect({
  value,
  options,
  onChange,
}: {
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full px-1 py-1 text-[9px] bg-[#0F0F16] border border-white/10 rounded text-[#A0A0B0] focus:outline-none focus:border-[#FFE600]/30 cursor-pointer"
    >
      {options.map((opt) => (
        <option key={opt.value} value={opt.value}>{opt.label}</option>
      ))}
    </select>
  );
}
