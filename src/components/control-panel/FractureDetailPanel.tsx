import { useSceneStore } from '../../store/useSceneStore';
import { ScrollArea } from '../ui/scroll-area';
import { Badge } from '../ui/badge';
import { Crosshair } from 'lucide-react';

const RISK_COLORS: Record<string, string> = {
  normal: '#44FF88',
  caution: '#FFAA00',
  warning: '#FF8844',
  danger: '#FF2222',
};

/**
 * 右侧面板 — 选中裂缝的详细数据 + 传感器读数
 */
export function FractureDetailPanel() {
  const selectedFracture = useSceneStore((s) => s.selectedFracture);
  const selectedFractureNode = useSceneStore((s) => s.selectedFractureNode);
  const scenario = useSceneStore((s) => s.scenario);
  const selectFracture = useSceneStore((s) => s.selectFracture);
  const selectFractureNode = useSceneStore((s) => s.selectFractureNode);
  const flyTo = useSceneStore((s) => s.flyTo);
  const highlightWithTimer = useSceneStore((s) => s.highlightWithTimer);

  if (!selectedFracture) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-[#A0A0B0] p-4">
        <div className="text-3xl mb-3">🔬</div>
        <div className="text-xs text-center leading-relaxed">
          点击 3D 场景中的裂缝<br />
          查看详细参数和传感器数据
        </div>
        <div className="mt-4 text-[9px] text-[#A0A0B0]/50">
          当前场景: {scenario === 'coal' ? '煤矿' : scenario === 'gold' ? '金矿' : '油气'}
        </div>
      </div>
    );
  }

  const { sensorReading: sr } = selectedFracture;

  // 评估风险
  const getRisk = () => {
    if (scenario === 'coal') {
      if (sr.ch4_pct > 3.0 || sr.microseismic_count > 15) return 'danger';
      if (sr.ch4_pct > 1.5 || sr.water_pressure_mpa > 5) return 'warning';
      if (sr.ch4_pct > 1.0 || sr.temperature_c > 35) return 'caution';
      return 'normal';
    }
    if (scenario === 'gold') {
      if (sr.microseismic_count > 15 || sr.stress_mpa > 25) return 'danger';
      if (sr.microseismic_count > 8) return 'warning';
      return 'normal';
    }
    // oil
    if (sr.pore_pressure_mpa > 30 || sr.permeability_md < 0.01) return 'danger';
    if (sr.pore_pressure_mpa > 20) return 'warning';
    return 'normal';
  };

  const risk = getRisk();
  const riskLabel = { normal: '正常', caution: '关注', warning: '警告', danger: '危险' }[risk];

  // 传感器分组显示
  const sensorGroups = scenario === 'coal' ? [
    { label: '气体检测', items: [
      { name: 'CH₄', value: `${sr.ch4_pct}%`, warn: sr.ch4_pct > 1.5 },
      { name: 'CO', value: `${sr.co_ppm}ppm`, warn: sr.co_ppm > 24 },
      { name: 'H₂S', value: `${sr.h2s_ppm}ppm`, warn: sr.h2s_ppm > 10 },
    ]},
    { label: '环境参数', items: [
      { name: '温度', value: `${sr.temperature_c}°C`, warn: +sr.temperature_c > 35 },
      { name: '湿度', value: `${sr.humidity_pct}%`, warn: false },
      { name: '水压', value: `${sr.water_pressure_mpa}MPa`, warn: sr.water_pressure_mpa > 5 },
    ]},
    { label: '力学参数', items: [
      { name: 'σ₁', value: `${sr.stress_sigma1}MPa`, warn: false },
      { name: 'σ₂', value: `${sr.stress_sigma2}MPa`, warn: false },
      { name: 'σ₃', value: `${sr.stress_sigma3}MPa`, warn: false },
    ]},
    { label: '裂缝参数', items: [
      { name: '渗透率', value: `${sr.permeability_md}mD`, warn: false },
      { name: '开度', value: `${sr.fracture_aperture_um}µm`, warn: false },
      { name: '微震', value: `${sr.microseismic_count}次/h`, warn: sr.microseismic_count > 10 },
      { name: '声发射', value: `${sr.acoustic_emission_mv}mV·s`, warn: +sr.acoustic_emission_mv > 3000 },
    ]},
  ] : scenario === 'gold' ? [
    { label: '应力监测', items: [
      { name: '最大主应力', value: `${sr.stress_sigma1}MPa`, warn: +sr.stress_sigma1 > 25 },
      { name: '中间主应力', value: `${sr.stress_sigma2}MPa`, warn: false },
      { name: '最小主应力', value: `${sr.stress_sigma3}MPa`, warn: false },
    ]},
    { label: '岩体参数', items: [
      { name: '岩体强度', value: `${sr.rock_strength_mpa}MPa`, warn: false },
      { name: '渗透率', value: `${sr.permeability_md}mD`, warn: false },
      { name: '裂缝开度', value: `${sr.fracture_aperture_um}µm`, warn: false },
    ]},
    { label: '监测数据', items: [
      { name: '微震', value: `${sr.microseismic_count}次/h`, warn: sr.microseismic_count > 10 },
      { name: '声发射', value: `${sr.acoustic_emission_mv}mV·s`, warn: +sr.acoustic_emission_mv > 5000 },
      { name: '位移', value: `${sr.displacement_mm}mm`, warn: +sr.displacement_mm > 5 },
      { name: '温度', value: `${sr.temperature_c}°C`, warn: false },
    ]},
  ] : [
    { label: '储层参数', items: [
      { name: '孔隙压力', value: `${sr.pore_pressure_mpa}MPa`, warn: +sr.pore_pressure_mpa > 30 },
      { name: '渗透率', value: `${sr.permeability_md}mD`, warn: false },
      { name: '孔隙度', value: `${sr.porosity_pct}%`, warn: false },
    ]},
    { label: '裂缝参数', items: [
      { name: '开度', value: `${sr.fracture_aperture_um}µm`, warn: false },
      { name: '温度', value: `${sr.temperature_c}°C`, warn: false },
      { name: '含水饱和度', value: `${sr.water_saturation_pct}%`, warn: false },
    ]},
    { label: '流体参数', items: [
      { name: 'pH值', value: `${sr.fluid_ph}`, warn: false },
      { name: '矿化度', value: `${((sr as any).salinity_ppm || 0)}ppm`, warn: false },
      { name: '地应力', value: `${sr.stress_mpa}MPa`, warn: false },
    ]},
  ];

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-3">
        {/* 头部 */}
        <div className="flex items-center justify-between">
          <div>
            <div className="text-sm font-bold text-[#E0E0E8]">{selectedFracture.name}</div>
            <div className="text-[9px] text-[#A0A0B0]">
              {selectedFracture.type === 'main' ? '主裂缝' : '分支裂缝'} · {selectedFracture.length}m
            </div>
          </div>
          <Badge style={{ color: RISK_COLORS[risk], borderColor: RISK_COLORS[risk] + '40' }}>
            {riskLabel}
          </Badge>
        </div>

        {/* 裂缝参数 */}
        <div className="grid grid-cols-2 gap-1.5 text-[10px]">
          <ParamItem label="开度" value={`${selectedFracture.aperture_um}µm`} />
          <ParamItem label="孔隙率" value={`${(selectedFracture.porosity * 100).toFixed(2)}%`} />
          <ParamItem label="分形维数" value={selectedFracture.fractal_dim.toFixed(3)} />
          <ParamItem label="迂曲度" value={selectedFracture.tortuosity.toFixed(3)} />
          <ParamItem label="倾角" value={`${selectedFracture.dip_angle}°`} />
          <ParamItem label="走向" value={`${selectedFracture.azimuth_angle}°`} />
          <ParamItem label="粗糙度" value={selectedFracture.roughness_coeff.toString()} />
          <ParamItem label="连通性" value={`${selectedFracture.connectivity}条`} />
        </div>

        {/* 传感器分组 */}
        {sensorGroups.map((group) => (
          <div key={group.label}>
            <div className="text-[9px] text-[#FFE600] font-semibold mb-1">{group.label}</div>
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <div key={item.name} className="flex justify-between items-center px-2 py-1 rounded text-[10px]">
                  <span className="text-[#A0A0B0]">{item.name}</span>
                  <span className={item.warn ? 'text-[#FF6644] font-mono font-medium' : 'text-[#E0E0E8] font-mono'}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>
        ))}

        {/* 测点列表 — 双向联动：点击节点 → 飞到3D位置 */}
        <div>
          <div className="text-[9px] text-[#FFE600] font-semibold mb-1">
            测点 ({selectedFracture.nodes.length})
          </div>
          <div className="space-y-0.5 max-h-[200px] overflow-y-auto">
            {selectedFracture.nodes.map((node) => {
              const isSelected = selectedFractureNode === node.id;
              // 节点风险着色
              let nodeColor = '#44FF88';
              if (scenario === 'coal' && node.sensors.ch4_pct > 1.5) nodeColor = '#FF6644';
              if (scenario === 'coal' && node.sensors.ch4_pct > 3.0) nodeColor = '#FF2222';
              if (scenario === 'gold' && node.sensors.microseismic_count > 10) nodeColor = '#FF6644';

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
                    <span
                      className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                      style={{ backgroundColor: nodeColor }}
                    />
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
          <div className="text-[8px] text-[#A0A0B0]/40 mt-1 text-center">
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
      <span className="text-[#E0E0E8] font-mono">{value}</span>
    </div>
  );
}
