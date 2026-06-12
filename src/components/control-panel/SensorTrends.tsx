import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { useSensorTrend } from '../../hooks/useSensorTrend';
import { ChevronDown } from 'lucide-react';

// Mini sparkline chart using SVG
function Sparkline({ data, color, height = 36 }: { data: number[]; color: string; height?: number }) {
  if (data.length === 0) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const w = 100;
  const h = height;
  const step = w / (data.length - 1);

  const points = data.map((v, i) => `${i * step},${h - ((v - min) / range) * (h - 4) - 2}`);
  const linePath = `M ${points.join(' L ')}`;
  const areaPath = `M 0,${h} L ${points.join(' L ')} L ${w},${h} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full" style={{ height }} preserveAspectRatio="none">
      <defs>
        <linearGradient id={`grad-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={areaPath} fill={`url(#grad-${color.replace('#', '')})`} />
      <path d={linePath} fill="none" stroke={color} strokeWidth="1.5" vectorEffect="non-scaling-stroke" />
      {/* Last point dot */}
      <circle
        cx={w}
        cy={h - ((data[data.length - 1] - min) / range) * (h - 4) - 2}
        r="1.5"
        fill={color}
      />
    </svg>
  );
}

function TrendRow({
  label,
  unit,
  data,
  color,
  threshold,
}: {
  label: string;
  unit: string;
  data: number[];
  color: string;
  threshold?: number;
}) {
  const current = data[data.length - 1] ?? 0;
  const prev = data[data.length - 2] ?? current;
  const delta = current - prev;
  const overThreshold = threshold !== undefined && current > threshold;

  return (
    <div className="px-1 py-1 rounded bg-[#0F0F16]/40">
      <div className="flex items-center justify-between mb-0.5">
        <span className="text-[9px] text-[#A0A0B0]">{label}</span>
        <div className="flex items-center gap-1">
          <span className={`text-[11px] font-mono font-bold ${overThreshold ? 'text-[#FF3333]' : ''}`} style={!overThreshold ? { color } : undefined}>
            {current}{unit}
          </span>
          {delta !== 0 && (
            <span className={`text-[8px] ${delta > 0 ? 'text-[#FF3333]' : 'text-[#00FF66]'}`}>
              {delta > 0 ? '▲' : '▼'}{Math.abs(Math.round(delta * 10) / 10)}
            </span>
          )}
        </div>
      </div>
      <Sparkline data={data} color={overThreshold ? '#FF3333' : color} />
    </div>
  );
}

export function SensorTrends() {
  const [collapsed, setCollapsed] = useState(false);
  const { data: trend, loading } = useSensorTrend();

  return (
    <Card>
      <CardHeader onClick={() => setCollapsed(!collapsed)} className="cursor-pointer">
        <CardTitle className="flex items-center gap-2">
          <svg className="w-3.5 h-3.5 text-[#4DA6FF]" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M3 3v18h18M7 14l4-4 4 4 5-5" />
          </svg>
          <span>传感器趋势</span>
          <span className="text-[8px] text-[#A0A0B0]/40 ml-auto">近 2.5 小时</span>
          <ChevronDown className={`w-3 h-3 text-[#A0A0B0] transition-transform ${collapsed ? '' : 'rotate-180'}`} />
        </CardTitle>
      </CardHeader>

      {!collapsed && (
        <CardContent className="space-y-1.5">
          {loading || !trend ? (
            <div className="text-[10px] text-[#A0A0B0]/40 text-center py-3">加载趋势...</div>
          ) : (
            <>
              <TrendRow label="CH4 浓度" unit="%" data={trend.ch4} color="#FFA500" threshold={1.5} />
              <TrendRow label="环境温度" unit="°C" data={trend.temperature} color="#FF6B35" />
              <TrendRow label="大气压力" unit="kPa" data={trend.pressure} color="#4DA6FF" />
            </>
          )}
        </CardContent>
      )}
    </Card>
  );
}
