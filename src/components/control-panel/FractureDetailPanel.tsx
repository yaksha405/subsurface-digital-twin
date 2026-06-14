import { useSceneStore } from '../../store/useSceneStore';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { Activity, Battery, Crosshair, MapPin, Signal, Wifi, WifiOff, X } from 'lucide-react';
import type { ReactNode } from 'react';
import type { MeshRole, Robot, RobotModel, RobotStatus, ScenarioType, SensorReading } from '../../types';
import { getRobotTelemetryCopy } from '../../lib/robotTelemetryCopy';
import type { Locale } from '../../domain/i18nCatalog';
import { getSceneSemantics } from '../../lib/sceneSemantics';
import { localizeTask } from '../../lib/taskLocale';

const RISK_COLORS: Record<string, string> = {
  normal: '#087443',
  caution: '#D29922',
  warning: '#B54708',
  danger: '#FF3B30',
};

/** 4色语义体系 — 参考 Palantir Foundry */
const COLOR_DANGER = '#FF3B30';
const COLOR_WARN = '#FFCC00';
const COLOR_OK = '#087443';

const MODEL_LABELS: Record<RobotModel, { zh: string; en: string }> = {
  snake: { zh: '蛇形', en: 'Snake' },
  tracked: { zh: '履带式', en: 'Tracked' },
  wheeled: { zh: '轮式', en: 'Wheeled' },
  climbing: { zh: '攀爬式', en: 'Climbing' },
  aerial: { zh: '飞行', en: 'Aerial' },
  spider: { zh: '蛛型', en: 'Spider' },
  floatwalker: { zh: '浮走式', en: 'Floatwalker' },
};

const STATUS_LABELS: Record<RobotStatus, { zh: string; en: string }> = {
  online: { zh: '在线', en: 'Online' },
  offline: { zh: '离线', en: 'Offline' },
  low_battery: { zh: '低电量', en: 'Low Battery' },
  error: { zh: '故障', en: 'Fault' },
  maintenance: { zh: '维护中', en: 'Maintenance' },
};

const STATUS_COLORS: Record<RobotStatus, string> = {
  online: '#087443',
  offline: '#667085',
  low_battery: '#B54708',
  error: '#B42318',
  maintenance: '#475467',
};

const MESH_LABELS: Record<MeshRole, { zh: string; en: string }> = {
  gateway: { zh: '网关', en: 'Gateway' },
  relay: { zh: '中继', en: 'Relay' },
  edge: { zh: '边缘', en: 'Edge' },
  leaf: { zh: '终端', en: 'Leaf' },
};

function timeAgo(ts: number, locale: Locale): string {
  const s = Math.floor((Date.now() - ts) / 1000);
  if (locale === 'zh-CN') {
    if (s < 60) return `${s}s前`;
    if (s < 3600) return `${Math.floor(s / 60)}m前`;
    return `${Math.floor(s / 3600)}h前`;
  }
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  return `${Math.floor(s / 3600)}h ago`;
}

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
  const textColor = danger || isOver ? COLOR_DANGER : isNear ? COLOR_WARN : '#182230';

  return (
    <div className="px-2 py-1.5 rounded">
      <div className="flex justify-between items-baseline mb-1">
        <span className="text-[10px] text-[#667085]">{label}</span>
        <span
          className={`font-mono text-[11px] tabular-nums ${isOver ? 'animate-pulse' : ''}`}
          style={{ color: textColor }}
        >
          {value}<span className="text-[9px] text-[#667085] ml-0.5">{unit}</span>
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
function calcSafetyScore(sr: SensorReading, scenario: ScenarioType): { score: number; level: string } {
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
  } else if (scenario === 'underground') {
    if (sr.permeability_md > 10000) score -= 35;
    else if (sr.permeability_md > 5000) score -= 18;
    if (sr.water_pressure_mpa > 8) score -= 25;
    else if (sr.water_pressure_mpa > 5) score -= 12;
    if (sr.temperature_c > 90) score -= 20;
    else if (sr.temperature_c > 70) score -= 8;
    if (sr.h2s_ppm > 10) score -= 12;
    if (sr.fluid_ph < 5.5 || sr.fluid_ph > 8.5) score -= 10;
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

function RobotInlineDetail({
  robot,
  scenario,
  locale,
  onClose,
}: {
  robot: Robot;
  scenario: ScenarioType;
  locale: Locale;
  onClose: () => void;
}) {
  const statusColor = STATUS_COLORS[robot.status];
  const batteryColor = robot.battery < 20 ? '#B42318' : robot.battery < 40 ? '#B54708' : '#087443';
  const sc = getRobotTelemetryCopy(scenario);
  const primaryOver = robot.sensors.ch4 > sc.primary.threshold;
  const semantics = getSceneSemantics(scenario);

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span
                className="h-2 w-2 rounded-full"
                style={{ backgroundColor: statusColor, boxShadow: robot.status !== 'offline' ? `0 0 6px ${statusColor}` : 'none' }}
              />
              <div className="text-sm font-bold text-[#182230] truncate">{robot.id}</div>
            </div>
            <div className="mt-0.5 text-[9px] text-[#667085]">
              {MODEL_LABELS[robot.model][locale === 'zh-CN' ? 'zh' : 'en']} · {STATUS_LABELS[robot.status][locale === 'zh-CN' ? 'zh' : 'en']} · {timeAgo(robot.lastUpdate, locale)}
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-7 w-7 rounded border border-[#D9E1EA] bg-white text-[#667085] hover:border-[#C99A2E]/50 hover:text-[#182230] transition-colors flex items-center justify-center"
            aria-label={locale === 'zh-CN' ? '关闭机器人详情' : 'Close robot details'}
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <div className="rounded border border-[#D9E1EA] bg-[#F8FAFC] p-2.5">
          <div className="text-[9px] text-[#667085] mb-1">{locale === 'zh-CN' ? '当前任务' : 'Current Task'}</div>
          <div data-testid="robot-detail-task" className="text-xs font-semibold text-[#182230] leading-snug">{localizeTask(robot.task, locale)}</div>
        </div>

        <div className="grid grid-cols-2 gap-1.5 text-[10px]">
          <RobotMetric icon={<Battery className="h-3 w-3" />} label={locale === 'zh-CN' ? '电量' : 'Battery'} value={`${robot.battery}%`} color={batteryColor} />
          <RobotMetric icon={<Signal className="h-3 w-3" />} label={locale === 'zh-CN' ? '信号' : 'Signal'} value={`${robot.signalStrength}dBm`} color="#475467" />
          <RobotMetric icon={<Activity className="h-3 w-3" />} label={sc.depthLabel} value={`${robot.depth}m`} color="#475467" />
          <RobotMetric
            icon={robot.meshConnected ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            label={locale === 'zh-CN' ? '组网' : 'Mesh'}
            value={MESH_LABELS[robot.meshRole][locale === 'zh-CN' ? 'zh' : 'en']}
            color={robot.meshConnected ? '#087443' : '#B42318'}
          />
        </div>

        <div className="rounded border border-[#D9E1EA] bg-white p-2.5">
          <div className="flex items-center gap-1.5 text-[9px] text-[#667085] mb-2">
            <MapPin className="h-3 w-3" />
            <span>{locale === 'zh-CN' ? '空间位置' : 'Spatial Position'}</span>
          </div>
          <div className="font-mono text-[11px] text-[#182230]">
            X {robot.position[0].toFixed(1)} · Y {robot.position[1].toFixed(1)} · Z {robot.position[2].toFixed(1)}
          </div>
        </div>

        <div>
          <div className="text-[9px] text-[#C99A2E] font-semibold mb-1.5 flex items-center gap-1">
            <StatusDot status={primaryOver ? 'danger' : 'ok'} />
            {locale === 'zh-CN' ? '机器人回传' : 'Robot Telemetry'}
          </div>
          <div className="grid grid-cols-3 gap-1.5">
            <SensorTile label={sc.primary.label} value={`${robot.sensors.ch4}${sc.primary.unit}`} danger={primaryOver} />
            <SensorTile label={sc.temperature.label} value={`${robot.sensors.temperature}${sc.temperature.unit}`} />
            <SensorTile label={sc.aux.label} value={`${robot.sensors.humidity}${sc.aux.unit}`} />
          </div>
        </div>

        <div className="rounded border border-[#D9E1EA] bg-[#F8FAFC] p-2 text-[9px] leading-relaxed text-[#667085]">
          {locale === 'zh-CN'
            ? `选中机器人后，右侧面板用于查看状态、回传与位置；切换到${semantics.objectLabel}或测点时会自动进入对应对象详情。`
            : `Selecting a robot shows its status, telemetry, and position here. Switching to a ${semantics.objectLabel} or node automatically opens the matching object details.`}
        </div>
      </div>
    </ScrollArea>
  );
}

function RobotMetric({
  icon,
  label,
  value,
  color,
}: {
  icon: ReactNode;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="rounded border border-[#D9E1EA] bg-white px-2 py-1.5">
      <div className="flex items-center gap-1 text-[#667085]">
        <span style={{ color }}>{icon}</span>
        <span>{label}</span>
      </div>
      <div className="mt-1 font-mono text-[11px] font-semibold tabular-nums" style={{ color }}>
        {value}
      </div>
    </div>
  );
}

function SensorTile({ label, value, danger = false }: { label: string; value: string; danger?: boolean }) {
  return (
    <div className="rounded border border-[#D9E1EA] bg-white px-2 py-1.5">
      <div className="text-[9px] text-[#667085]">{label}</div>
      <div className="mt-1 font-mono text-[11px] font-semibold tabular-nums" style={{ color: danger ? '#B42318' : '#182230' }}>
        {value}
      </div>
    </div>
  );
}

/**
 * 右侧面板 — 选中裂缝的详细数据 + 传感器读数
 * 迭代：DangerBar 危险进度条 + 综合安全评分 + 点状状态灯（参考 Palantir Foundry）
 */
export function FractureDetailPanel() {
  const selectedRobot = useSceneStore((s) => s.selectedRobot);
  const closeRobotDetail = useSceneStore((s) => s.closeRobotDetail);
  const selectedFracture = useSceneStore((s) => s.selectedFracture);
  const selectedFractureNode = useSceneStore((s) => s.selectedFractureNode);
  const scenario = useSceneStore((s) => s.scenario);
  const dataSource = useSceneStore((s) => s.dataSource);
  const selectFracture = useSceneStore((s) => s.selectFracture);
  const selectFractureNode = useSceneStore((s) => s.selectFractureNode);
  const flyTo = useSceneStore((s) => s.flyTo);
  const highlightWithTimer = useSceneStore((s) => s.highlightWithTimer);
  const locale = useSceneStore((s) => s.locale);
  const semantics = getSceneSemantics(scenario);

  if (selectedRobot) {
    return <RobotInlineDetail robot={selectedRobot} scenario={scenario} locale={locale} onClose={closeRobotDetail} />;
  }

  if (!selectedFracture) {
    const emptyStateMap: Record<string, { icon: string; hint: Record<Locale, string>; label: Record<Locale, string> }> = {
      coal: { icon: '⛏', hint: { 'zh-CN': '点击 3D 场景中的机器人或裂缝', 'en-US': 'Click a robot or fracture in the 3D scene' }, label: { 'zh-CN': '查看机器人状态、瓦斯、应力、渗透率等参数', 'en-US': 'Inspect robot status, CH4, stress, and permeability readings' } },
      gold: { icon: '🪨', hint: { 'zh-CN': '点击 3D 场景中的机器人或裂缝', 'en-US': 'Click a robot or fracture in the 3D scene' }, label: { 'zh-CN': '查看机器人状态、微震、岩爆风险、应力集中数据', 'en-US': 'Inspect robot status, microseismic activity, burst risk, and stress concentration' } },
      oil: { icon: '🛢', hint: { 'zh-CN': '点击 3D 场景中的机器人或裂缝', 'en-US': 'Click a robot or reservoir fracture in the 3D scene' }, label: { 'zh-CN': '查看机器人状态、孔隙压力、渗透率、含油饱和度', 'en-US': 'Inspect robot status, pore pressure, permeability, and saturation' } },
      pipeline: { icon: '🛢', hint: { 'zh-CN': '点击 3D 场景中的机器人或管道', 'en-US': 'Click a robot or pipe segment in the 3D scene' }, label: { 'zh-CN': '查看机器人状态、泄漏、壁厚、腐蚀、H₂S 数据', 'en-US': 'Inspect robot status, leakage, wall loss, corrosion, and H2S readings' } },
      nuclear: { icon: '☢', hint: { 'zh-CN': '点击 3D 场景中的机器人或管道', 'en-US': 'Click a robot or reactor pipe in the 3D scene' }, label: { 'zh-CN': '查看机器人状态、剂量率、疲劳、FAC、振动数据', 'en-US': 'Inspect robot status, dose rate, fatigue usage, FAC, and vibration' } },
      refinery: { icon: '🏭', hint: { 'zh-CN': '点击 3D 场景中的机器人或设备通道', 'en-US': 'Click a robot or equipment passage in the 3D scene' }, label: { 'zh-CN': '查看机器人状态、壁厚减薄、结垢、蠕变数据', 'en-US': 'Inspect robot status, wall thinning, fouling, and creep indicators' } },
      underground: { icon: '🌊', hint: { 'zh-CN': '点击 3D 场景中的机器人或暗流通道', 'en-US': 'Click a robot or underground channel in the 3D scene' }, label: { 'zh-CN': '查看机器人状态、流速、渗透率、矿化度、地温数据', 'en-US': 'Inspect robot status, flow, permeability, salinity, and geothermal readings' } },
    };
    const ds = dataSource === 'fracture' ? scenario : dataSource;
    const emptyInfo = emptyStateMap[ds] || emptyStateMap.coal;

    return (
      <div data-testid="detail-empty-state" className="h-full flex flex-col items-center justify-center text-[#667085] p-4">
        <div className="text-3xl mb-3">{emptyInfo.icon}</div>
        <div className="text-xs text-center leading-relaxed">
          {emptyInfo.hint[locale]}<br />
          {emptyInfo.label[locale]}
        </div>
        <div className="mt-4 text-[9px] text-[#667085]/50">
          {locale === 'zh-CN' ? '快捷操作：拖拽旋转 · 滚轮缩放 · 右键平移' : 'Quick controls: drag to orbit · wheel to zoom · right-drag to pan'}
        </div>
      </div>
    );
  }

  const { sensorReading: sr } = selectedFracture;

  // 综合安全评分
  const { score: safetyScore, level: safetyLevel } = calcSafetyScore(sr, scenario);
  const safetyLabel = locale === 'zh-CN'
    ? { normal: '安全', caution: '关注', warning: '警告', danger: '危险' }[safetyLevel]
    : { normal: 'Safe', caution: 'Watch', warning: 'Warning', danger: 'Danger' }[safetyLevel];
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
  ] : scenario === 'underground' ? [
    { label: '渗透率', value: sr.permeability_md, unit: 'mD', max: 12000, threshold: 5000, danger: sr.permeability_md > 5000 },
    { label: '水压', value: sr.water_pressure_mpa, unit: 'MPa', max: 12, threshold: 8, danger: sr.water_pressure_mpa > 8 },
    { label: '地温', value: sr.temperature_c, unit: '°C', max: 120, threshold: 90, danger: sr.temperature_c > 90 },
    { label: 'H₂S', value: sr.h2s_ppm, unit: 'ppm', max: 20, threshold: 10, danger: sr.h2s_ppm > 10 },
    { label: '微震扰动', value: sr.microseismic_count, unit: '次/h', max: 30, threshold: 15, danger: sr.microseismic_count > 15 },
    { label: '含水饱和度', value: sr.water_saturation_pct, unit: '%', max: 100, threshold: 999, danger: false },
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
  ] : scenario === 'underground' ? [
    { label: '通道直径', value: `${(sr.fracture_aperture_um / 1000).toFixed(2)}m` },
    { label: 'pH值', value: `${sr.fluid_ph}` },
    { label: '含水饱和度', value: `${sr.water_saturation_pct}%` },
    { label: '矿化度估算', value: `${sr.co_ppm}mg/L` },
    { label: '孔隙压力', value: `${sr.pore_pressure_mpa}MPa` },
    { label: '岩石强度', value: `${sr.rock_strength_mpa}MPa` },
    { label: '位移', value: `${sr.displacement_mm}mm` },
    { label: '声发射', value: `${sr.acoustic_emission_mv}mV·s` },
  ] : [
    { label: '孔隙度', value: `${sr.porosity_pct}%` },
    { label: '开度', value: `${sr.fracture_aperture_um}µm` },
    { label: 'pH值', value: `${sr.fluid_ph}` },
    { label: '地应力', value: `${sr.stress_mpa}MPa` },
  ];

  return (
    <ScrollArea data-testid="fracture-detail-panel" className="h-full">
      <div className="p-3 space-y-3">
        {/* 头部 + 综合安全评分 */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <div>
              <div className="text-sm font-bold text-[#182230]">{selectedFracture.name}</div>
              <div className="text-[9px] text-[#667085]">
                {locale === 'zh-CN'
                  ? scenario === 'pipeline'
                    ? `${selectedFracture.type === 'main' ? '主干线' : '支线'} · ${selectedFracture.length}m · DN${Math.round(selectedFracture.porosity * 1000)}`
                    : scenario === 'nuclear'
                    ? `${selectedFracture.type === 'main' ? '主管道' : '辅助管道'} · ${selectedFracture.length}m · DN${Math.round(selectedFracture.porosity * 1000)}`
                    : scenario === 'refinery'
                    ? `${selectedFracture.type === 'main' ? '主通道' : '支通道'} · ${selectedFracture.length}m · DN${Math.round(selectedFracture.porosity * 1000)}`
                    : scenario === 'underground'
                    ? `${selectedFracture.type === 'main' ? '主干暗流' : '分支暗流'} · ${selectedFracture.length}m · 直径${(selectedFracture.aperture_um / 1000).toFixed(2)}m`
                    : `${selectedFracture.type === 'main' ? '主裂缝' : '分支裂缝'} · ${selectedFracture.length}m`
                  : scenario === 'pipeline'
                    ? `${selectedFracture.type === 'main' ? 'Trunk Line' : 'Branch Line'} · ${selectedFracture.length}m · DN${Math.round(selectedFracture.porosity * 1000)}`
                    : scenario === 'nuclear'
                    ? `${selectedFracture.type === 'main' ? 'Primary Pipe' : 'Aux Pipe'} · ${selectedFracture.length}m · DN${Math.round(selectedFracture.porosity * 1000)}`
                    : scenario === 'refinery'
                    ? `${selectedFracture.type === 'main' ? 'Main Passage' : 'Branch Passage'} · ${selectedFracture.length}m · DN${Math.round(selectedFracture.porosity * 1000)}`
                    : scenario === 'underground'
                    ? `${selectedFracture.type === 'main' ? 'Main Channel' : 'Branch Channel'} · ${selectedFracture.length}m · Dia ${(selectedFracture.aperture_um / 1000).toFixed(2)}m`
                    : `${selectedFracture.type === 'main' ? 'Main Fracture' : 'Branch Fracture'} · ${selectedFracture.length}m`}
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
              <span className="text-[9px] text-[#667085] tracking-wider uppercase">{locale === 'zh-CN' ? '综合安全评分' : 'Safety Score'}</span>
              <span className="text-[9px]" style={{ color: safetyColor }}>
                {locale === 'zh-CN'
                  ? safetyLabel === '危险' ? '极高危' : safetyLabel === '警告' ? '高风险' : safetyLabel === '关注' ? '需关注' : '正常'
                  : safetyLevel === 'danger' ? 'Critical' : safetyLevel === 'warning' ? 'High Risk' : safetyLevel === 'caution' ? 'Review' : 'Nominal'}
              </span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span
                className={`font-mono text-2xl font-bold tabular-nums ${safetyLevel === 'danger' ? 'animate-pulse' : ''}`}
                style={{ color: safetyColor }}
              >
                {safetyScore}
              </span>
              <span className="text-[10px] text-[#667085]">/100</span>
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
          {scenario === 'pipeline' || scenario === 'nuclear' || scenario === 'refinery' || scenario === 'underground' ? (
            <>
              <ParamItem label={locale === 'zh-CN' ? (scenario === 'underground' ? '通道直径' : '壁厚') : (scenario === 'underground' ? 'Channel Diameter' : 'Wall Thickness')} value={scenario === 'underground' ? `${(selectedFracture.aperture_um / 1000).toFixed(2)}m` : `${(selectedFracture.aperture_um / 1000).toFixed(1)}mm`} />
              <ParamItem label={locale === 'zh-CN' ? (scenario === 'underground' ? '等效孔径' : '管径') : (scenario === 'underground' ? 'Equivalent Void Ratio' : 'Nominal Diameter')} value={scenario === 'underground' ? `${(selectedFracture.porosity * 100).toFixed(1)}%` : `DN${Math.round(selectedFracture.porosity * 1000)}`} />
              <ParamItem label={locale === 'zh-CN' ? (scenario === 'underground' ? '通道长度' : '管段长度') : (scenario === 'underground' ? 'Channel Length' : 'Segment Length')} value={`${selectedFracture.length}m`} />
              <ParamItem label={locale === 'zh-CN' ? '粗糙度Ra' : 'Roughness Ra'} value={selectedFracture.roughness_coeff.toString()} />
              <ParamItem label={locale === 'zh-CN' ? '倾角' : 'Dip'} value={`${selectedFracture.dip_angle}°`} />
              <ParamItem label={locale === 'zh-CN' ? '走向' : 'Azimuth'} value={`${selectedFracture.azimuth_angle}°`} />
              <ParamItem label={locale === 'zh-CN' ? '连接数' : 'Connections'} value={locale === 'zh-CN' ? `${selectedFracture.connectivity}条` : `${selectedFracture.connectivity}`} />
              <ParamItem label={locale === 'zh-CN' ? '迂曲度' : 'Tortuosity'} value={selectedFracture.tortuosity.toFixed(3)} />
            </>
          ) : (
            <>
              <ParamItem label={locale === 'zh-CN' ? '开度' : 'Aperture'} value={`${selectedFracture.aperture_um}µm`} />
              <ParamItem label={locale === 'zh-CN' ? '孔隙率' : 'Porosity'} value={`${(selectedFracture.porosity * 100).toFixed(2)}%`} />
              <ParamItem label={locale === 'zh-CN' ? '分形维数' : 'Fractal Dim'} value={selectedFracture.fractal_dim.toFixed(3)} />
              <ParamItem label={locale === 'zh-CN' ? '迂曲度' : 'Tortuosity'} value={selectedFracture.tortuosity.toFixed(3)} />
              <ParamItem label={locale === 'zh-CN' ? '倾角' : 'Dip'} value={`${selectedFracture.dip_angle}°`} />
              <ParamItem label={locale === 'zh-CN' ? '走向' : 'Azimuth'} value={`${selectedFracture.azimuth_angle}°`} />
              <ParamItem label={locale === 'zh-CN' ? '粗糙度' : 'Roughness'} value={selectedFracture.roughness_coeff.toString()} />
              <ParamItem label={locale === 'zh-CN' ? '连通性' : 'Connectivity'} value={locale === 'zh-CN' ? `${selectedFracture.connectivity}条` : `${selectedFracture.connectivity}`} />
            </>
          )}
        </div>

        {/* 危险进度条区 — 核心可视化 */}
        <div>
          <div className="text-[9px] text-[#C99A2E] font-semibold mb-1.5 flex items-center gap-1">
            <StatusDot status={safetyLevel === 'normal' ? 'ok' : safetyLevel === 'caution' ? 'warn' : 'danger'} />
            {locale === 'zh-CN' ? '实时监测 · 危险进度条' : 'Live Monitoring · Risk Bars'}
          </div>
          <div className="space-y-0.5">
            {dangerBars.map((bar) => (
              <DangerBar key={bar.label} {...bar} />
            ))}
          </div>
        </div>

        {/* 辅助参数 */}
        <div>
          <div className="text-[9px] text-[#667085]/70 font-semibold mb-1">{locale === 'zh-CN' ? '其他参数' : 'Supporting Parameters'}</div>
          <div className="grid grid-cols-2 gap-1">
            {auxParams.map((p) => (
              <div key={p.label} className="flex justify-between px-1.5 py-0.5 rounded text-[10px]">
                <span className="text-[#667085]">{p.label}</span>
                <span className="text-[#182230] font-mono tabular-nums">{p.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 测点列表 — 双向联动：点击节点 → 飞到3D位置 */}
        <div>
          <div className="text-[9px] text-[#C99A2E] font-semibold mb-1">
            {locale === 'zh-CN' ? `${semantics.nodeLabel} (${selectedFracture.nodes.length})` : `${semantics.nodeLabel} (${selectedFracture.nodes.length})`}
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
              if (scenario === 'underground') {
                if (node.sensors.permeability_md > 10000 || node.sensors.water_pressure_mpa > 8 || node.sensors.temperature_c > 90) nodeStatus = 'danger';
                else if (node.sensors.permeability_md > 5000 || node.sensors.water_pressure_mpa > 5 || node.sensors.temperature_c > 70) nodeStatus = 'warn';
              }

              return (
                <div
                  key={node.id}
                  onClick={() => {
                    selectFractureNode(node.id);
                    flyTo({ position: node.position, region: node.id, zoom: 'close' });
                    setTimeout(() => {
                      highlightWithTimer(node.position, 1.6, 4000);
                    }, 1800);
                  }}
                  className={`flex items-center justify-between px-2 py-1.5 rounded text-[9px] cursor-pointer transition-all ${
                    isSelected
                      ? 'bg-[#C99A2E]/15 border border-[#C99A2E]/30'
                      : 'hover:bg-[#F8FAFC] border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <StatusDot status={nodeStatus} />
                    <span className="text-[#667085]">{node.id}</span>
                    {isSelected && <Crosshair className="w-2.5 h-2.5 text-[#C99A2E]" />}
                  </div>
                  <span className="text-[#182230] font-mono">
                    {node.robotId ? `R-${node.robotId.slice(-3)}` : '—'}
                  </span>
                </div>
              );
            })}
          </div>
          <div className="text-[9px] text-[#667085]/40 mt-1 text-center">
            {locale === 'zh-CN' ? `点击${semantics.nodeLabel}可飞行定位到 3D 位置` : `Click a ${semantics.nodeLabel.toLowerCase()} to fly to its 3D position`}
          </div>
        </div>

        {/* 关闭 */}
        <button
          onClick={() => selectFracture(null)}
          className="w-full py-2 text-[10px] text-[#667085] hover:text-[#C99A2E] transition-colors border border-[#D9E1EA] rounded"
        >
          {locale === 'zh-CN' ? '关闭详情' : 'Close Details'}
        </button>
      </div>
    </ScrollArea>
  );
}

function ParamItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between px-2 py-1 bg-[#F8FAFC] rounded border border-[#D9E1EA]">
      <span className="text-[#667085]">{label}</span>
      <span className="text-[#182230] font-mono tabular-nums">{value}</span>
    </div>
  );
}
