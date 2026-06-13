import { useSceneStore } from '../../store/useSceneStore';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { Crosshair } from 'lucide-react';

const RISK_COLORS: Record<string, string> = {
  normal: '#3FB950',
  caution: '#D29922',
  warning: '#FF8800',
  danger: '#FF3B30',
};

/** 4色语义体系 — 参考 Palantir Foundry */
const COLOR_DANGER = '#FF3B30';
const COLOR_WARN = '#FFCC00';
const COLOR_OK = '#3FB950';
const COLOR_INFO = '#58A6FF';

/** 危险进度条 — 满量=危险阈值，超限闪烁红 */
function DangerBar({
  label, value, unit, max, threshold, danger,
}: {
  label: string;
  value: number;
  unit: string;
  max: number;
  threshold: number;
  danger?: boolean;
}) {
  const pct = Math.min(100, (value / max) * 100);
  const isOver = value >= threshold;
  const isNear = value >= threshold * 0.8;
  const barColor = isOver ? COLOR_DANGER : isNear ? COLOR_WARN : COLOR_OK;
  const textColor = danger || isOver ? COLOR_DANGER : isNear ? COLOR_WARN : '#E0E0E8';

  return (
    <div className="px-2 py-1.5 rounded">
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-[10px] text-[#A0A0B0]">{label}</span>
        <span
          className={`font-mono text-[11px] tabular-nums ${isOver ? 'animate-pulse' : ''}`}
          style={{ color: textColor }}
        >
          {value}<span className="text-[9px] text-[#A0A0B0] ml-0.5">{unit}</span>
        </span>
      </div>
      {/* 极细能量条 */}
      <div className="h-[3px] bg-white/[0.06] rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-300 ${isOver ? 'animate-pulse' : ''}`}
          style={{
            width: `${pct}%`,
            background: barColor,
            boxShadow: isOver ? `0 0 6px ${barColor}` : 'none',
          }}
        />
      </div>
      {/* 阈值标记线 */}
      <div className="relative h-0">
        <div
          className="absolute top-0 w-[1px] h-[3px] -translate-y-[3px] opacity-60"
          style={{ left: `${Math.min(98, (threshold / max) * 100)}%`, background: COLOR_DANGER }}
        />
      </div>
    </div>
  );
}

/** Sparkline — 极简迷你折线 */
function Sparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;
  const points = data.map((v, i) => {
    const x = (i / (data.length - 1)) * 100;
    const y = 100 - ((v - min) / range) * 100;
    return `${x},${y}`;
  }).join(' ');

  return (
    <svg width="40" height="14" viewBox="0 0 100 100" preserveAspectRatio="none" className="opacity-70">
      <polyline points={points} fill="none" stroke={color} strokeWidth="3" vectorEffect="non-scaling-stroke" />
    </svg>
  );
}

/** 点状状态灯 */
function StatusDot({ status }: { status: 'ok' | 'warn' | 'danger' }) {
  const colors = { ok: COLOR_OK, warn: COLOR_WARN, danger: COLOR_DANGER };
  return (
    <span
      className="inline-block w-1.5 h-1.5 rounded-full"
      style={{
        backgroundColor: colors[status],
        boxShadow: status !== 'ok' ? `0 0 4px ${colors[status]}` : 'none',
      }}
    />
  );
}

/** 计算综合安全评分 (0-100) */
function calcSafetyScore(sr: any, scenario: string): { score: number; level: string } {
  let score = 100;
  if (scenario === 'coal') {
    if (sr.ch4_pct > 3.0) score -= 40;
    else if (sr.ch4_pct > 1.5) score -= 25;
    else if (sr.ch4_pct > 1.0) score -= 10;
    if (sr.co_ppm > 24) score -= 15;
    if (sr.h2s_ppm > 10) score -= 15;
    if (sr.water_pressure_mpa > 5) score -= 20;
    if (sr.microseismic_count > 15) score -= 20;
    if (sr.temperature_c > 35) score -= 5;
  } else if (scenario === 'gold') {
    if (sr.microseismic_count > 15) score -= 35;
    else if (sr.microseismic_count > 8) score -= 15;
    if (sr.stress_sigma1 > 25) score -= 25;
    if (sr.displacement_mm > 5) score -= 15;
    if (sr.acoustic_emission_mv > 5000) score -= 10;
  } else if (scenario === 'pipeline') {
    // 管线安全评分 — 基于 ASME B31.8 / NACE MR0175
    if (sr.ch4_pct > 20) score -= 40;        // 天然气泄漏 >20%LEL
    else if (sr.ch4_pct > 10) score -= 20;
    if (sr.h2s_ppm > 50) score -= 30;        // H₂S 酸性服务阈值
    else if (sr.h2s_ppm > 20) score -= 15;
    if (sr.rock_strength_mpa > 40) score -= 25; // 壁厚损失 >40%
    else if (sr.rock_strength_mpa > 20) score -= 12;
    if (sr.stress_sigma1 > 72) score -= 20;  // 屈服利用率 >72%
    if (sr.permeability_md > 0.25) score -= 10; // 腐蚀速率偏高
    if (sr.microseismic_count > 40) score -= 10; // 振动异常
  } else if (scenario === 'nuclear') {
    // 核反应堆安全评分 — 基于 ASME Section III / EPRI FAC / ISO 10816
    if (sr.ch4_pct > 25) score -= 40;        // 剂量率 >25 mSv/h
    else if (sr.ch4_pct > 10) score -= 20;
    if (sr.water_pressure_mpa > 60) score -= 25; // 疲劳使用因子 >60%
    else if (sr.water_pressure_mpa > 40) score -= 12;
    if (sr.h2s_ppm > 5) score -= 30;         // 冷却剂活度 >5 Bq/mL（包壳破损判据）
    else if (sr.h2s_ppm > 2) score -= 15;
    if (sr.permeability_md > 0.1) score -= 15; // FAC速率 >0.1 mm/yr
    if (sr.microseismic_count > 7) score -= 10; // 振动 >7.1 mm/s (ISO 10816)
    if (sr.stress_sigma1 > 75) score -= 10;  // 热应力利用率偏高
  } else if (scenario === 'refinery') {
    // 炼油化工安全评分 — 基于 API 510 / API 579 / NACE SP0304
    if (sr.rock_strength_mpa > 5) score -= 35;     // 壁厚减薄 >5%
    else if (sr.rock_strength_mpa > 3) score -= 18;
    if (sr.permeability_md > 0.3) score -= 25;      // 腐蚀速率 >0.3 mm/yr
    else if (sr.permeability_md > 0.15) score -= 12;
    if (sr.h2s_ppm > 100) score -= 20;              // H₂S >100 ppm
    else if (sr.h2s_ppm > 50) score -= 10;
    if (sr.temperature_c > 500) score -= 15;         // 超温
    else if (sr.temperature_c > 420) score -= 8;
    if (sr.ch4_pct > 20) score -= 15;                // 泄漏 >20%LEL
    if (sr.microseismic_count > 45) score -= 10;     // 振动超标
  } else {
    if (sr.pore_pressure_mpa > 30) score -= 35;
    else if (sr.pore_pressure_mpa > 20) score -= 15;
    if (sr.permeability_md < 0.01) score -= 20;
    if (sr.temperature_c > 80) score -= 10;
  }
  score = Math.max(0, Math.min(100, Math.round(score)));
  const level = score >= 80 ? 'normal' : score >= 60 ? 'caution' : score >= 40 ? 'warning' : 'danger';
  return { score, level };
}

/**
 * 右侧面板 — 选中裂缝的详细数据 + 传感器读数
 * 迭代：DangerBar 危险进度条 + 综合安全评分 + 点状状态灯（参考 Palantir Foundry）
 */
export function FractureDetailPanel() {
  const selectedFracture = useSceneStore((s) => s.selectedFracture);
  const selectedFractureNode = useSceneStore((s) => s.selectedFractureNode);
  const scenario = useSceneStore((s) => s.scenario);
  const dataSource = useSceneStore((s) => s.dataSource);
  const selectFracture = useSceneStore((s) => s.selectFracture);
  const selectFractureNode = useSceneStore((s) => s.selectFractureNode);
  const flyTo = useSceneStore((s) => s.flyTo);
  const highlightWithTimer = useSceneStore((s) => s.highlightWithTimer);

  if (!selectedFracture) {
    const emptyStateMap: Record<string, { icon: string; hint: string; label: string }> = {
      coal: { icon: '⛏', hint: '点击 3D 场景中的裂缝', label: '查看瓦斯、应力、渗透率等参数' },
      gold: { icon: '🪨', hint: '点击 3D 场景中的裂缝', label: '查看微震、岩爆风险、应力集中数据' },
      oil: { icon: '🛢', hint: '点击 3D 场景中的裂缝', label: '查看孔隙压力、渗透率、含油饱和度' },
      pipeline: { icon: '🛢', hint: '点击 3D 场景中的管道', label: '查看泄漏、壁厚、腐蚀、H₂S 数据' },
      nuclear: { icon: '☢', hint: '点击 3D 场景中的管道', label: '查看剂量率、疲劳、FAC、振动数据' },
      refinery: { icon: '🏭', hint: '点击 3D 场景中的设备通道', label: '查看壁厚减薄、结垢、蠕变数据' },
      underground: { icon: '🌊', hint: '点击 3D 场景中的暗流通道', label: '查看流速、渗透率、矿化度、地温数据' },
    };
    const ds = dataSource === 'fracture' ? scenario : dataSource;
    const emptyInfo = emptyStateMap[ds] || emptyStateMap.coal;

    return (
      <div className="h-full flex flex-col items-center justify-center text-[#A0A0B0] p-4">
        <div className="text-3xl mb-3">{emptyInfo.icon}</div>
        <div className="text-xs text-center leading-relaxed">
          {emptyInfo.hint}<br />
          {emptyInfo.label}
        </div>
        <div className="mt-4 text-[9px] text-[#A0A0B0]/50">
          快捷操作：拖拽旋转 · 滚轮缩放 · 右键平移
        </div>
      </div>
    );
  }

  const { sensorReading: sr } = selectedFracture;

  // 综合安全评分
  const { score: safetyScore, level: safetyLevel } = calcSafetyScore(sr, scenario);
  const safetyLabel = { normal: '安全', caution: '关注', warning: '警告', danger: '危险' }[safetyLevel];
  const safetyColor = RISK_COLORS[safetyLevel];

  // 危险进度条配置 — 每个场景不同
  const dangerBars = scenario === 'coal' ? [
    { label: 'CH₄ 瓦斯', value: sr.ch4_pct, unit: '%', max: 5, threshold: 1.5, danger: sr.ch4_pct > 1.5, spark: [0.8, 1.2, 1.0, 1.8, 2.14] },
    { label: 'CO 一氧化碳', value: sr.co_ppm, unit: 'ppm', max: 50, threshold: 24, danger: sr.co_ppm > 24 },
    { label: 'H₂S 硫化氢', value: sr.h2s_ppm, unit: 'ppm', max: 20, threshold: 10, danger: sr.h2s_ppm > 10 },
    { label: '水压', value: sr.water_pressure_mpa, unit: 'MPa', max: 10, threshold: 5, danger: sr.water_pressure_mpa > 5 },
    { label: '微震活动', value: sr.microseismic_count, unit: '次/h', max: 30, threshold: 15, danger: sr.microseismic_count > 15 },
    { label: '温度', value: sr.temperature_c, unit: '°C', max: 50, threshold: 35, danger: sr.temperature_c > 35 },
  ] : scenario === 'gold' ? [
    { label: '微震活动', value: sr.microseismic_count, unit: '次/h', max: 30, threshold: 15, danger: sr.microseismic_count > 15 },
    { label: '最大主应力 σ₁', value: sr.stress_sigma1, unit: 'MPa', max: 40, threshold: 25, danger: sr.stress_sigma1 > 25 },
    { label: '位移', value: sr.displacement_mm, unit: 'mm', max: 10, threshold: 5, danger: sr.displacement_mm > 5 },
    { label: '声发射', value: sr.acoustic_emission_mv, unit: 'mV·s', max: 10000, threshold: 5000, danger: sr.acoustic_emission_mv > 5000 },
    { label: '岩体强度', value: sr.rock_strength_mpa, unit: 'MPa', max: 150, threshold: 999, danger: false },
  ] : scenario === 'pipeline' ? [
    { label: '天然气泄漏', value: sr.ch4_pct, unit: '%LEL', max: 40, threshold: 20, danger: sr.ch4_pct > 20 },
    { label: 'H₂S 硫化氢', value: sr.h2s_ppm, unit: 'ppm', max: 500, threshold: 50, danger: sr.h2s_ppm > 50 },
    { label: '壁厚损失', value: sr.rock_strength_mpa, unit: '%', max: 60, threshold: 50, danger: sr.rock_strength_mpa > 50 },
    { label: '运行压力', value: sr.stress_mpa, unit: 'MPa', max: 15, threshold: 12, danger: sr.stress_mpa > 12 },
    { label: '腐蚀速率', value: sr.permeability_md, unit: 'mm/yr', max: 0.5, threshold: 0.25, danger: sr.permeability_md > 0.25 },
    { label: '屈服利用率', value: sr.stress_sigma1, unit: '%', max: 100, threshold: 72, danger: sr.stress_sigma1 > 72 },
  ] : scenario === 'nuclear' ? [
    { label: '剂量率', value: sr.ch4_pct, unit: 'mSv/h', max: 100, threshold: 25, danger: sr.ch4_pct > 25 },
    { label: '疲劳使用因子', value: sr.water_pressure_mpa, unit: '%', max: 100, threshold: 60, danger: sr.water_pressure_mpa > 60 },
    { label: '冷却剂活度', value: sr.h2s_ppm, unit: 'Bq/mL', max: 50, threshold: 5, danger: sr.h2s_ppm > 5 },
    { label: 'FAC速率', value: sr.permeability_md, unit: 'mm/yr', max: 0.2, threshold: 0.1, danger: sr.permeability_md > 0.1 },
    { label: '振动速度', value: sr.microseismic_count, unit: 'mm/s', max: 10, threshold: 7.1, danger: sr.microseismic_count > 7.1 },
    { label: '热应力利用率', value: sr.stress_sigma1, unit: '%', max: 100, threshold: 75, danger: sr.stress_sigma1 > 75 },
  ] : scenario === 'refinery' ? [
    { label: '壁厚减薄', value: sr.rock_strength_mpa, unit: '%', max: 10, threshold: 3, danger: sr.rock_strength_mpa > 3 },
    { label: '腐蚀速率', value: sr.permeability_md, unit: 'mm/yr', max: 1.0, threshold: 0.3, danger: sr.permeability_md > 0.3 },
    { label: 'H₂S 硫化氢', value: sr.h2s_ppm, unit: 'ppm', max: 1000, threshold: 100, danger: sr.h2s_ppm > 100 },
    { label: '操作温度', value: sr.temperature_c, unit: '°C', max: 800, threshold: 500, danger: sr.temperature_c > 500 },
    { label: '泄漏浓度', value: sr.ch4_pct, unit: '%LEL', max: 40, threshold: 20, danger: sr.ch4_pct > 20 },
    { label: '振动速度', value: sr.microseismic_count, unit: 'mm/s', max: 60, threshold: 45, danger: sr.microseismic_count > 45 },
  ] : [
    { label: '孔隙压力', value: sr.pore_pressure_mpa, unit: 'MPa', max: 50, threshold: 30, danger: sr.pore_pressure_mpa > 30 },
    { label: '渗透率', value: sr.permeability_md, unit: 'mD', max: 5, threshold: 999, danger: false },
    { label: '温度', value: sr.temperature_c, unit: '°C', max: 150, threshold: 80, danger: sr.temperature_c > 80 },
    { label: '含水饱和度', value: sr.water_saturation_pct, unit: '%', max: 100, threshold: 999, danger: false },
  ];

  // 辅助参数（无进度条）
  const auxParams = scenario === 'coal' ? [
    { label: 'σ₁', value: `${sr.stress_sigma1}MPa` },
    { label: 'σ₂', value: `${sr.stress_sigma2}MPa` },
    { label: 'σ₃', value: `${sr.stress_sigma3}MPa` },
    { label: '渗透率', value: `${sr.permeability_md}mD` },
    { label: '开度', value: `${sr.fracture_aperture_um}µm` },
    { label: '声发射', value: `${sr.acoustic_emission_mv}mV·s` },
    { label: '湿度', value: `${sr.humidity_pct}%` },
    { label: '位移', value: `${sr.displacement_mm}mm` },
  ] : scenario === 'gold' ? [
    { label: 'σ₂', value: `${sr.stress_sigma2}MPa` },
    { label: 'σ₃', value: `${sr.stress_sigma3}MPa` },
    { label: '渗透率', value: `${sr.permeability_md}mD` },
    { label: '开度', value: `${sr.fracture_aperture_um}µm` },
    { label: '岩体强度', value: `${sr.rock_strength_mpa}MPa` },
    { label: '温度', value: `${sr.temperature_c}°C` },
  ] : scenario === 'pipeline' ? [
    { label: '壁厚', value: `${(sr.fracture_aperture_um / 1000).toFixed(1)}mm` },
    { label: '钢级', value: `X${Math.round(sr.stress_sigma3 / 6.9)}` },
    { label: '流量', value: `${(sr.stress_sigma2 * 1000).toFixed(0)}m³/h` },
    { label: '温度', value: `${sr.temperature_c}°C` },
    { label: '振动', value: `${sr.microseismic_count}Hz` },
    { label: '声发射', value: `${sr.acoustic_emission_mv}mV·s` },
    { label: '沉降', value: `${sr.displacement_mm}mm` },
    { label: '涂层', value: `${sr.water_saturation_pct}%` },
  ] : scenario === 'nuclear' ? [
    { label: '壁厚', value: `${(sr.fracture_aperture_um / 1000).toFixed(1)}mm` },
    { label: '运行压力', value: `${sr.stress_mpa}MPa` },
    { label: '温度', value: `${sr.temperature_c}°C` },
    { label: '流量', value: `${(sr.stress_sigma2 * 1000).toFixed(0)}m³/h` },
    { label: '硼酸浓度', value: `${(sr.co_ppm * 10).toFixed(0)}ppm` },
    { label: 'Cs-137活度', value: `${sr.pore_pressure_mpa}Bq/mL` },
    { label: 'pH', value: `${(sr.humidity_pct / 10).toFixed(1)}` },
    { label: '壁厚损失', value: `${sr.rock_strength_mpa}%` },
  ] : scenario === 'refinery' ? [
    { label: '壁厚', value: `${(sr.fracture_aperture_um / 1000).toFixed(1)}mm` },
    { label: '管径', value: `DN${Math.round(sr.stress_sigma3)}` },
    { label: '运行压力', value: `${sr.stress_mpa}MPa` },
    { label: '热应力', value: `${sr.stress_sigma1}%` },
    { label: '结垢厚度', value: `${sr.stress_sigma2.toFixed(2)}mm` },
    { label: '蠕变寿命', value: `${(sr.water_saturation_pct * 100).toFixed(0)}h` },
    { label: '声发射', value: `${sr.acoustic_emission_mv}mV·s` },
    { label: 'CO浓度', value: `${sr.co_ppm}ppm` },
  ] : [
    { label: '孔隙度', value: `${sr.porosity_pct}%` },
    { label: '开度', value: `${sr.fracture_aperture_um}µm` },
    { label: 'pH值', value: `${sr.fluid_ph}` },
    { label: '地应力', value: `${sr.stress_mpa}MPa` },
  ];

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-3">
        {/* 头部 + 综合安全评分 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-sm font-bold text-[#E0E0E8]">{selectedFracture.name}</div>
              <div className="text-[9px] text-[#A0A0B0]">
                {scenario === 'pipeline'
                  ? `${selectedFracture.type === 'main' ? '主干线' : '支线'} · ${selectedFracture.length}m · DN${Math.round(selectedFracture.porosity * 1000)}`
                  : scenario === 'nuclear'
                  ? `${selectedFracture.type === 'main' ? '主管道' : '辅助管道'} · ${selectedFracture.length}m · DN${Math.round(selectedFracture.porosity * 1000)}`
                  : scenario === 'refinery'
                  ? `${selectedFracture.type === 'main' ? '主通道' : '支通道'} · ${selectedFracture.length}m · DN${Math.round(selectedFracture.porosity * 1000)}`
                  : `${selectedFracture.type === 'main' ? '主裂缝' : '分支裂缝'} · ${selectedFracture.length}m`}
              </div>
            </div>
            <Badge style={{ color: safetyColor, borderColor: safetyColor + '40' }}>
              {safetyLabel}
            </Badge>
          </div>

          {/* 安全评分仪表 */}
          <div
            className="rounded p-2.5"
            style={{
              background: `linear-gradient(135deg, ${safetyColor}15 0%, transparent 100%)`,
              border: `1px solid ${safetyColor}30`,
            }}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[9px] text-[#A0A0B0] tracking-wider uppercase">综合安全评分</span>
              <span className="text-[9px]" style={{ color: safetyColor }}>
                {safetyLabel === '危险' ? '极高危' : safetyLabel === '警告' ? '高风险' : safetyLabel === '关注' ? '需关注' : '正常'}
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span
                className={`font-mono text-2xl font-bold tabular-nums ${safetyLevel === 'danger' ? 'animate-pulse' : ''}`}
                style={{ color: safetyColor }}
              >
                {safetyScore}
              </span>
              <span className="text-[10px] text-[#A0A0B0]">/100</span>
            </div>
            {/* 评分条 */}
            <div className="h-1.5 bg-white/[0.06] rounded-full overflow-hidden mt-1.5">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${safetyScore}%`,
                  background: `linear-gradient(90deg, ${COLOR_DANGER} 0%, ${COLOR_WARN} 50%, ${COLOR_OK} 100%)`,
                }}
              />
            </div>
          </div>
        </div>

        {/* 几何参数 */}
        <div className="grid grid-cols-2 gap-1.5 text-[10px]">
          {scenario === 'pipeline' || scenario === 'nuclear' || scenario === 'refinery' ? (
            <>
              <ParamItem label="壁厚" value={`${(selectedFracture.aperture_um / 1000).toFixed(1)}mm`} />
              <ParamItem label="管径" value={`DN${Math.round(selectedFracture.porosity * 1000)}`} />
              <ParamItem label="管段长度" value={`${selectedFracture.length}m`} />
              <ParamItem label="粗糙度Ra" value={selectedFracture.roughness_coeff.toString()} />
              <ParamItem label="倾角" value={`${selectedFracture.dip_angle}°`} />
              <ParamItem label="走向" value={`${selectedFracture.azimuth_angle}°`} />
              <ParamItem label="连接数" value={`${selectedFracture.connectivity}条`} />
              <ParamItem label="迂曲度" value={selectedFracture.tortuosity.toFixed(3)} />
            </>
          ) : (
            <>
              <ParamItem label="开度" value={`${selectedFracture.aperture_um}µm`} />
              <ParamItem label="孔隙率" value={`${(selectedFracture.porosity * 100).toFixed(2)}%`} />
              <ParamItem label="分形维数" value={selectedFracture.fractal_dim.toFixed(3)} />
              <ParamItem label="迂曲度" value={selectedFracture.tortuosity.toFixed(3)} />
              <ParamItem label="倾角" value={`${selectedFracture.dip_angle}°`} />
              <ParamItem label="走向" value={`${selectedFracture.azimuth_angle}°`} />
              <ParamItem label="粗糙度" value={selectedFracture.roughness_coeff.toString()} />
              <ParamItem label="连通性" value={`${selectedFracture.connectivity}条`} />
            </>
          )}
        </div>

        {/* 危险进度条区 — 核心可视化 */}
        <div>
          <div className="text-[9px] text-[#FFE600] font-semibold mb-1.5 flex items-center gap-1">
            <StatusDot status={safetyLevel === 'normal' ? 'ok' : safetyLevel === 'caution' ? 'warn' : 'danger'} />
            实时监测 · 危险进度条
          </div>
          <div className="space-y-0.5">
            {dangerBars.map((bar) => (
              <DangerBar key={bar.label} {...bar} />
            ))}
          </div>
        </div>

        {/* 辅助参数 */}
        <div>
          <div className="text-[9px] text-[#A0A0B0]/70 font-semibold mb-1">其他参数</div>
          <div className="grid grid-cols-2 gap-1">
            {auxParams.map((p) => (
              <div key={p.label} className="flex justify-between px-1.5 py-0.5 rounded text-[10px]">
                <span className="text-[#A0A0B0]">{p.label}</span>
                <span className="text-[#E0E0E8] font-mono tabular-nums">{p.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 测点列表 — 双向联动：点击节点 → 飞到3D位置 */}
        <div>
          <div className="text-[9px] text-[#FFE600] font-semibold mb-1">
            测点 ({selectedFracture.nodes.length})
          </div>
          <div className="space-y-0.5 max-h-[200px] overflow-y-auto">
            {selectedFracture.nodes.map((node) => {
              const isSelected = selectedFractureNode === node.id;
              // 节点状态灯
              let nodeStatus: 'ok' | 'warn' | 'danger' = 'ok';
              if (scenario === 'coal') {
                if (node.sensors.ch4_pct > 3.0) nodeStatus = 'danger';
                else if (node.sensors.ch4_pct > 1.5) nodeStatus = 'warn';
              }
              if (scenario === 'gold') {
                if (node.sensors.microseismic_count > 15) nodeStatus = 'danger';
                else if (node.sensors.microseismic_count > 8) nodeStatus = 'warn';
              }
              if (scenario === 'pipeline') {
                if (node.sensors.ch4_pct > 20 || node.sensors.h2s_ppm > 50) nodeStatus = 'danger';
                else if (node.sensors.ch4_pct > 10 || node.sensors.h2s_ppm > 20) nodeStatus = 'warn';
              }
              if (scenario === 'nuclear') {
                if (node.sensors.ch4_pct > 25 || node.sensors.h2s_ppm > 5) nodeStatus = 'danger';
                else if (node.sensors.ch4_pct > 10 || node.sensors.h2s_ppm > 2) nodeStatus = 'warn';
              }
              if (scenario === 'refinery') {
                if (node.sensors.rock_strength_mpa > 5 || node.sensors.h2s_ppm > 100 || node.sensors.ch4_pct > 20) nodeStatus = 'danger';
                else if (node.sensors.rock_strength_mpa > 3 || node.sensors.h2s_ppm > 50 || node.sensors.ch4_pct > 10) nodeStatus = 'warn';
              }

              return (
                <div
                  key={node.id}
                  onClick={() => {
                    selectFractureNode(node.id);
                    flyTo({ position: node.position, region: node.id, zoom: 'close' });
                    setTimeout(() => {
                      highlightWithTimer(node.position, 5, 4000);
                    }, 1800);
                  }}
                  className={`flex items-center justify-between px-2 py-1.5 rounded text-[9px] cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-[#FFE600]/15 border border-[#FFE600]/30'
                      : 'hover:bg-white/5 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <StatusDot status={nodeStatus} />
                    <span className="text-[#A0A0B0]">{node.id}</span>
                    {isSelected && <Crosshair className="w-2.5 h-2.5 text-[#FFE600]" />}
                  </div>
                  <span className="text-[#E0E0E8] font-mono">
                    {node.robotId ? `R-${node.robotId.slice(-3)}` : '—'}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="text-[9px] text-[#A0A0B0]/40 mt-1 text-center">
            点击测点可飞行定位到3D位置
          </div>
        </div>

        {/* 关闭 */}
        <button
          onClick={() => selectFracture(null)}
          className="w-full py-2 text-[10px] text-[#A0A0B0] hover:text-[#FFE600] transition-colors border border-white/5 rounded"
        >
          关闭详情
        </button>
      </div>
    </ScrollArea>
  );
}

function ParamItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between px-2 py-1 bg-white/[0.02] rounded">
      <span className="text-[#A0A0B0]">{label}</span>
      <span className="text-[#E0E0E8] font-mono tabular-nums">{value}</span>
    </div>
  );
}
