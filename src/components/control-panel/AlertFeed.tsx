import { useState, useMemo } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { useAlerts } from '../../hooks/useAlerts';
import { useSceneStore } from '../../store/useSceneStore';
import type { AlertEvent, AlertLevel } from '../../data/alertDataGenerator';
import { AlertTriangle, AlertOctagon, Info, ChevronDown } from 'lucide-react';

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

function AlertItem({ alert, onClick }: { alert: AlertEvent; onClick: () => void }) {
  const { color, bg, Icon } = LEVEL_CONFIG[alert.level];

  return (
    <div
      onClick={onClick}
      className={`px-2 py-1.5 rounded-md border border-white/5 cursor-pointer transition-all hover:border-white/10 ${!alert.acknowledged ? '' : 'opacity-50'}`}
      style={{ backgroundColor: bg }}
    >
      <div className="flex items-start gap-1.5">
        <Icon className="w-3 h-3 mt-0.5 flex-shrink-0" style={{ color }} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-0.5">
            <span className="text-[10px] font-semibold truncate" style={{ color }}>{alert.title}</span>
            {!alert.acknowledged && (
              <span className="w-1.5 h-1.5 rounded-full flex-shrink-0 animate-pulse" style={{ backgroundColor: color }} />
            )}
          </div>
          <p className="text-[9px] text-[#A0A0B0]/70 leading-tight line-clamp-2">{alert.description}</p>
          <span className="text-[8px] text-[#A0A0B0]/40 mt-0.5 block">{timeAgo(alert.timestamp)}</span>
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

  const filtered = useMemo(() => {
    if (!alerts) return [];
    if (filter === 'all') return alerts;
    if (filter === 'unack') return alerts.filter(a => !a.acknowledged);
    return alerts.filter(a => a.level === filter);
  }, [alerts, filter]);

  const dangerCount = alerts?.filter(a => a.level === 'danger' && !a.acknowledged).length ?? 0;
  const warningCount = alerts?.filter(a => a.level === 'warning' && !a.acknowledged).length ?? 0;

  const handleAlertClick = (alert: AlertEvent) => {
    if (alert.position) {
      const pos = alert.position;
      flyTo({ position: pos, region: `alert-${alert.id}`, zoom: 'close' });
      highlightWithTimer(pos, 5, 5000);
    }
  };

  return (
    <Card>
      <CardHeader onClick={() => setCollapsed(!collapsed)} className="cursor-pointer">
        <CardTitle className="flex items-center gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-[#FF3333]" />
          <span>实时告警</span>
          {dangerCount > 0 && <Badge variant="danger" className="text-[8px]">{dangerCount} 紧急</Badge>}
          {warningCount > 0 && <Badge className="text-[8px] bg-[#FFA500]/10 border-[#FFA500]/30 text-[#FFA500]">{warningCount} 警告</Badge>}
          <ChevronDown className={`w-3 h-3 ml-auto text-[#A0A0B0] transition-transform ${collapsed ? '' : 'rotate-180'}`} />
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
              { v: 'unack', label: '未处理', count: alerts?.filter(a => !a.acknowledged).length ?? 0 },
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
                <AlertItem key={alert.id} alert={alert} onClick={() => handleAlertClick(alert)} />
              ))
            )}
            {!loading && filtered.length === 0 && (
              <div className="text-[10px] text-[#00FF66]/50 text-center py-3">暂无告警</div>
            )}
          </div>
        </CardContent>
      )}
    </Card>
  );
}
