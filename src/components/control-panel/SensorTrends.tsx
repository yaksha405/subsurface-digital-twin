import { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { useSensorTrend } from '../../hooks/useSensorTrend';
import { useSceneStore } from '../../store/useSceneStore';
import { ChevronDown, MapPin } from 'lucide-react';
import type { ScenarioType } from '../../types';

/** 场景特定的趋势标签配置 */
const TREND_LABELS: Record<ScenarioType, {
  primary: { label: string; unit: string; threshold: number };
  temp: { label: string };
  aux: { label: string; unit: string };
}> = {
  coal: {
    primary: { label: 'CH₄ 浓度', unit: '%', threshold: 1.5 },
    temp: { label: '环境温度' },
    aux: { label: '大气压力', unit: 'kPa' },
  },
  gold: {
    primary: { label: '微震频率', unit: '次/h', threshold: 15 },
    temp: { label: '岩温' },
    aux: { label: '应力', unit: 'MPa' },
  },
  oil: {
    primary: { label: '孔隙压力', unit: 'MPa', threshold: 30 },
    temp: { label: '地层温度' },
    aux: { label: '渗透率', unit: 'mD' },
  },
  pipeline: {
    primary: { label: '天然气泄漏', unit: '%LEL', threshold: 20 },
    temp: { label: '管道温度' },
    aux: { label: '运行压力', unit: 'MPa' },
  },
  nuclear: {
    primary: { label: '剂量率', unit: 'mSv/h', threshold: 25 },
    temp: { label: '冷却剂温度' },
    aux: { label: '运行压力', unit: 'MPa' },
  },
  refinery: {
    primary: { label: '壁厚减薄', unit: '%', threshold: 3 },
    temp: { label: '操作温度' },
    aux: { label: '腐蚀速率', unit: 'mm/yr' },
  },
};

// Mini sparkline chart using SVG
function Sparkline({ data, color, height = 36 }: { data: number[]; color: string; height?: number }) {
  if (!data || data.length === 0 || data.some((v) => isNaN(v))) return null;
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
  const [view, setView] = useState<'aggregate' | 'regional'>('aggregate');
  const [activeRegion, setActiveRegion] = useState<string | null>(null);
  const { data: trend, loading } = useSensorTrend();
  const flyTo = useSceneStore((s) => s.flyTo);
  const setHighlightedFractureIds = useSceneStore((s) => s.setHighlightedFractureIds);
  const scenario = useSceneStore((s) => s.scenario);
  const labels = TREND_LABELS[scenario] || TREND_LABELS.coal;

  const handleRegionClick = (r: typeof trend.regions[0]) => {
    if (activeRegion === r.regionId) {
      // 再次点击取消选择
      setActiveRegion(null);
      setHighlightedFractureIds(null);
    } else {
      setActiveRegion(r.regionId);
      // 直接高亮该区域内的裂缝面 — 不用球体
      setHighlightedFractureIds(r.fractureIds);
      flyTo({ position: r.center, region: r.regionName, zoom: 'close' });
    }
  };

  const handleViewChange = (v: 'aggregate' | 'regional') => {
    setView(v);
    setActiveRegion(null);
    if (v === 'aggregate') {
      setHighlightedFractureIds(null);
    }
  };

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
          {/* Source label */}
          {trend && (
            <div className="text-[7px] text-[#A0A0B0]/40 text-center pb-0.5">
              {trend.source}
            </div>
          )}

          {/* View toggle */}
          <div className="flex gap-0.5">
            <button
              onClick={(e) => { e.stopPropagation(); handleViewChange('aggregate'); }}
              className={`flex-1 px-1 py-0.5 text-[8px] rounded transition-all ${
                view === 'aggregate'
                  ? 'bg-[#FFE600]/10 text-[#FFE600] border border-[#FFE600]/20'
                  : 'text-[#A0A0B0]/50 border border-transparent hover:bg-white/5'
              }`}
            >
              全局聚合
            </button>
            <button
              onClick={(e) => { e.stopPropagation(); handleViewChange('regional'); }}
              className={`flex-1 px-1 py-0.5 text-[8px] rounded transition-all ${
                view === 'regional'
                  ? 'bg-[#FFE600]/10 text-[#FFE600] border border-[#FFE600]/20'
                  : 'text-[#A0A0B0]/50 border border-transparent hover:bg-white/5'
              }`}
            >
              分区域
            </button>
          </div>

          {loading || !trend ? (
            <div className="text-[10px] text-[#A0A0B0]/40 text-center py-3">加载趋势...</div>
          ) : view === 'aggregate' ? (
            <>
              <TrendRow label={`${labels.primary.label} (聚合)`} unit={labels.primary.unit} data={trend.ch4} color="#FFA500" threshold={labels.primary.threshold} />
              <TrendRow label={`${labels.temp.label} (聚合)`} unit="°C" data={trend.temperature} color="#FF6B35" />
              <TrendRow label={`${labels.aux.label} (聚合)`} unit={labels.aux.unit} data={trend.pressure} color="#4DA6FF" />
            </>
          ) : (
            <div className="space-y-1.5 max-h-[180px] overflow-y-auto custom-scroll">
              {trend.regions.map((r) => {
                const ch4Now = r.ch4[r.ch4.length - 1] ?? 0;
                const isActive = activeRegion === r.regionId;
                return (
                  <div
                    key={r.regionId}
                    onClick={(e) => { e.stopPropagation(); handleRegionClick(r); }}
                    className={`px-1 py-1 rounded cursor-pointer transition-all border ${
                      isActive
                        ? 'bg-[#FFE600]/8 border-[#FFE600]/30 shadow-[0_0_8px_rgba(255,230,0,0.15)]'
                        : 'bg-[#0F0F16]/40 border-white/5 hover:border-[#FFE600]/15 hover:bg-[#0F0F16]/60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-0.5">
                      <div className="flex items-center gap-1">
                        <MapPin className={`w-2.5 h-2.5 ${isActive ? 'text-[#FFE600]' : 'text-[#A0A0B0]/40'}`} />
                        <span className={`text-[9px] font-medium ${isActive ? 'text-[#FFE600]' : 'text-[#E0E0E8]'}`}>{r.regionName}</span>
                      </div>
                      <span className="text-[7px] text-[#A0A0B0]/40">{r.nodeCount} 节点</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[9px] font-mono ${ch4Now > labels.primary.threshold ? 'text-[#FF3333]' : 'text-[#FFA500]'}`}>
                        {labels.primary.label} {ch4Now.toFixed(2)}{labels.primary.unit}
                      </span>
                      <span className="text-[9px] font-mono text-[#FF6B35]">
                        {r.temperature[r.temperature.length - 1]?.toFixed(0)}°C
                      </span>
                    </div>
                    <div className="mt-0.5">
                      <Sparkline data={r.ch4} color={ch4Now > labels.primary.threshold ? '#FF3333' : '#FFA500'} height={24} />
                    </div>
                    {isActive && (
                      <div className="text-[7px] text-[#FFE600]/50 text-center mt-0.5 animate-fade-in">
                        已框选 · 再次点击取消
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      )}
    </Card>
  );
}
