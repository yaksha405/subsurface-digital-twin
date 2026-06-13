import { useState, useMemo, useEffect, useRef } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { useAlerts } from '../../hooks/useAlerts';
import { useSceneStore } from '../../store/useSceneStore';
import type { AlertEvent, AlertLevel } from '../../data/alertDataGenerator';
import { AlertTriangle, AlertOctagon, Info, ChevronDown, Check } from 'lucide-react';

const LEVEL_CONFIG: Record<AlertLevel, { color: string; bg: string; Icon: typeof Info }> = {
  danger: { color: '#FF3333', bg: 'rgba(255,51,51,0.08)', Icon: AlertOctagon },
  warning: { color: '#FFA500', bg: 'rgba(255,165,0,0.08)', Icon: AlertTriangle },
  info: { color: '#4DA6FF', bg: 'rgba(77,166,255,0.06)', Icon: Info },
};

function timeAgo(ts: number): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (s < 60) return `${s}秒前`;
  if (s < 3600) return `${Math.floor(s / 60)}分钟前`;
  return `${Math.floor(s / 3600)}小时前`;
}

/** C5: 播放告警提示音 — 仅 danger 级别 */
function playAlertSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.type = 'sine';
    osc.frequency.setValueAtTime(880, ctx.currentTime);
    osc.frequency.setValueAtTime(660, ctx.currentTime + 0.15);
    gain.gain.setValueAtTime(0.3, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.4);
    osc.start(ctx.currentTime);
    osc.stop(ctx.currentTime + 0.4);
  } catch {}
}

function AlertItem({ alert, isAcked, onClick, onAck }: {
  alert: AlertEvent;
  isAcked: boolean;
  onClick: () => void;
  onAck: (e: React.MouseEvent) => void;
}) {
  const { color, bg, Icon } = LEVEL_CONFIG[alert.level];

  return (
    <div
      onClick={onClick}
      className={`px-2 py-1.5 rounded-md border border-white/5 cursor-pointer transition-all hover:border-white/10 ${isAcked ? 'opacity-40' : ''}`}
      style={{ backgroundColor: bg }}
    >
      <div className="flex items-start gap-1.5">
        <Icon className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[10px] font-semibold truncate" style={{ color }}>{alert.title}</span>
            {!isAcked && (
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse" style={{ backgroundColor: color }} />
            )}
          </div>
          <p className="text-[9px] text-[#A0A0B0]/70 leading-tight line-clamp-2">{alert.description}</p>
          <div className="flex items-center justify-between mt-0.5">
            <span className="text-[9px] text-[#A0A0B0]/40">{timeAgo(alert.timestamp)}</span>
            <button
              onClick={onAck}
              disabled={isAcked}
              className={`text-[9px] px-1.5 py-0.5 rounded transition-all ${
                isAcked
                  ? 'text-[#A0A0B0]/30 cursor-default'
                  : 'text-[#3FB950] hover:bg-[#3FB950]/10 border border-[#3FB950]/20'
              }`}
            >
              {isAcked ? '已确认' : '确认'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function AlertFeed() {
  const [collapsed, setCollapsed] = useState(false);
  const [filter, setFilter] = useState<'all' | 'danger' | 'warning' | 'unack'>('all');
  const dataSource = useSceneStore((s) => s.dataSource);
  const { data: alerts, loading } = useAlerts(dataSource);
  const flyTo = useSceneStore((s) => s.flyTo);
  const highlightWithTimer = useSceneStore((s) => s.highlightWithTimer);
  const acknowledgedAlertIds = useSceneStore((s) => s.acknowledgedAlertIds);
  const acknowledgeAlert = useSceneStore((s) => s.acknowledgeAlert);
  const acknowledgeAllAlerts = useSceneStore((s) => s.acknowledgeAllAlerts);

  const prevDangerCountRef = useRef(0);

  // 判断告警是否已确认（先看 alert.acknowledged，再看 store 中的手动确认）
  const isAcknowledged = (alert: AlertEvent) =>
    alert.acknowledged || acknowledgedAlertIds.includes(alert.id);

  const filtered = useMemo(() => {
    if (!alerts) return [];
    const result = filter === 'all' ? alerts
      : filter === 'unack' ? alerts.filter(a => !isAcknowledged(a))
      : alerts.filter(a => a.level === filter);
    return result;
  }, [alerts, filter, acknowledgedAlertIds]);

  const dangerCount = alerts?.filter(a => a.level === 'danger' && !isAcknowledged(a)).length ?? 0;
  const warningCount = alerts?.filter(a => a.level === 'warning' && !isAcknowledged(a)).length ?? 0;
  const unackCount = alerts?.filter(a => !isAcknowledged(a)).length ?? 0;

  // C5: 新增 danger 告警时播放提示音
  useEffect(() => {
    if (dangerCount > prevDangerCountRef.current && dangerCount > 0) {
      playAlertSound();
    }
    prevDangerCountRef.current = dangerCount;
  }, [dangerCount]);

  const handleAlertClick = (alert: AlertEvent) => {
    if (alert.position) {
      const pos = alert.position;
      flyTo({ position: pos, region: `alert-${alert.id}`, zoom: 'close' });
      highlightWithTimer(pos, 5, 5000);
    }
  };

  const handleAck = (e: React.MouseEvent, alert: AlertEvent) => {
    e.stopPropagation();
    acknowledgeAlert(alert.id);
  };

  const handleAckAll = () => {
    if (!alerts) return;
    const unackIds = alerts.filter(a => !isAcknowledged(a)).map(a => a.id);
    if (unackIds.length > 0) acknowledgeAllAlerts(unackIds);
  };

  return (
    <Card>
      <CardHeader onClick={() => setCollapsed(!collapsed)} className="cursor-pointer">
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-[#FF3333]" />
          <span>实时告警</span>
          {dangerCount > 0 && <Badge variant="danger" className="text-[9px] !px-1.5">{dangerCount} 紧急</Badge>}
          {warningCount > 0 && <Badge className="text-[9px] bg-[#FFA500]/10 border-[#FFA500]/30 text-[#FFA500] !px-1.5">{warningCount} 警告</Badge>}
          {unackCount > 0 && (
            <button
              onClick={(e) => { e.stopPropagation(); handleAckAll(); }}
              className="ml-auto mr-1 flex items-center gap-0.5 text-[9px] text-[#3FB950] hover:bg-[#3FB950]/10 px-1.5 py-0.5 rounded border border-[#3FB950]/20 transition-all"
            >
              <Check className="w-2.5 h-2.5" />
              全部确认
            </button>
          )}
          {unackCount === 0 && (
            <ChevronDown className={`w-3 h-3 ml-auto text-[#A0A0B0] transition-transform ${collapsed ? '' : 'rotate-180'}`} />
          )}
        </CardTitle>
      </CardHeader>

      {!collapsed && (
        <CardContent className="space-y-2">
          {/* Filter tabs */}
          <div className="flex gap-1">
            {([
              { v: 'all', label: '全部', count: alerts?.length ?? 0 },
              { v: 'danger', label: '紧急', count: dangerCount },
              { v: 'warning', label: '警告', count: warningCount },
              { v: 'unack', label: '未处理', count: unackCount },
            ] as const).map(tab => (
              <button
                key={tab.v}
                onClick={() => setFilter(tab.v)}
                className={`flex-1 px-1 py-1 text-[9px] rounded transition-all ${
                  filter === tab.v
                    ? 'bg-[#FFE600]/10 text-[#FFE600] border border-[#FFE600]/20'
                    : 'text-[#A0A0B0]/50 border border-transparent hover:bg-white/5'
                }`}
              >
                {tab.label} <span className="font-mono">{tab.count}</span>
              </button>
            ))}
          </div>

          {/* Alert list */}
          <div className="max-h-[200px] overflow-y-auto space-y-1 pr-0.5 custom-scroll">
            {loading ? (
              <div className="text-[10px] text-[#A0A0B0]/40 text-center py-3">加载告警...</div>
            ) : (
              filtered.slice(0, 30).map(alert => (
                <AlertItem
                  key={alert.id}
                  alert={alert}
                  isAcked={isAcknowledged(alert)}
                  onClick={() => handleAlertClick(alert)}
                  onAck={(e) => handleAck(e, alert)}
                />
              ))
            )}
            {!loading && filtered.length === 0 && (
              <div className="text-[10px] text-[#00FF66]/50 text-center py-3">
                {filter === 'unack' ? '所有告警已处理' : '暂无告警'}
              </div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
