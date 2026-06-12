import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Badge } from '../ui/badge';
import { useSceneStats } from '../../hooks/useSceneStats';
import { isMockMode } from '../../api/config';

export function SystemStatus() {
  const { data: stats, loading } = useSceneStats();

  return (
    <Card>
      <CardHeader>
        <CardTitle>系统状态监控</CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {loading || !stats ? (
          <div className="text-xs text-[#A0A0B0]/50 text-center py-2">加载统计数据...</div>
        ) : (
          <>
            <StatusRow
              label="数据源"
              value={isMockMode ? '模拟数据' : '实时接口'}
              dotColor={isMockMode ? 'bg-[#FF8800]' : 'bg-[#00FF66]'}
              badge={<Badge variant={isMockMode ? 'danger' : 'default'}>{isMockMode ? 'MOCK' : 'LIVE'}</Badge>}
            />
            <StatusRow label="传感器节点" value={stats.totalNodes.toLocaleString()} dotColor="bg-[#FFE600]" />
            <StatusRow label="平均置信度" value={`${stats.avgConf}%`} dotColor="bg-[#1E3A5F]" />
            <StatusRow label="CH4 超标区" value={`${stats.overThreshold}`} dotColor="bg-[#FF3333]" valueClass="text-[#FF3333]" />
            <StatusRow label="数据吞吐" value={isMockMode ? '—' : '2.4 MB/s'} dotColor="bg-[#FFE600]" />
          </>
        )}
      </CardContent>
    </Card>
  );
}

function StatusRow({
  label,
  value,
  dotColor,
  valueClass = 'text-[#E0E0E8]',
  badge,
}: {
  label: string;
  value: string;
  dotColor: string;
  valueClass?: string;
  badge?: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between text-xs">
      <div className="flex items-center gap-1.5">
        <div className={`w-1.5 h-1.5 rounded-full ${dotColor} animate-pulse`} />
        <span className="text-[#A0A0B0]">{label}</span>
      </div>
      <div className="flex items-center gap-1.5">
        <span className={`font-mono ${valueClass}`}>{value}</span>
        {badge}
      </div>
    </div>
  );
}
