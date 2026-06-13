import { useSceneStore } from '../../store/useSceneStore';
import type { ScenarioType, DataSourceType } from '../../types';
import { fetchFractures } from '../../api/fractureApi';
import { useEffect, useState, useRef } from 'react';

/** 切换数据源时重置聊天消息 */
function updateWelcomeMessage(mode: ScenarioType) {
  const welcomeMap: Record<string, string> = {
    coal: '## 系统就绪\n\n地质裂缝分析AI助手已上线。\n\n可使用快捷指令分析瓦斯、应力、渗透率、突水等数据。',
    gold: '## 系统就绪\n\n金矿裂缝分析AI助手已上线。\n\n当前监测金矿井下裂缝网络，可使用快捷指令分析微震、岩爆风险、应力集中等数据。',
    oil: '## 系统就绪\n\n油气裂缝分析AI助手已上线。\n\n当前监测油气储层裂缝网络，可使用快捷指令分析孔隙压力、渗透率、含油饱和度等数据。',
    pipeline: '## 系统就绪\n\n管线巡检AI助手已上线。\n\n当前监测油气输送管网，可使用快捷指令分析泄漏、壁厚、腐蚀、H₂S等数据。',
    nuclear: '## 系统就绪\n\n核反应堆检修AI助手已上线。\n\n当前监测压水堆(PWR)管道系统，可使用快捷指令分析剂量率、疲劳、FAC、振动等数据。',
    underground: '## 系统就绪\n\n地下暗流探测AI助手已上线。\n\n当前监测地下岩溶暗河/油气运移通道网络，蛇形与猪形机器人协同探测。可使用快捷指令分析流体流速、渗透率、油气饱和度、地温梯度等数据。',
    refinery: '## 系统就绪\n\n炼油化工设备内检AI助手已上线。\n\n当前监测炼油厂核心设备（换热器、加热炉、蒸馏塔）内部通道，蛇形机器人已深入内部回传数据。\n\n可使用快捷指令分析壁厚减薄、结垢、蠕变、裂纹、振动等数据。',
  };
  useSceneStore.setState({
    messages: [{
      id: `msg-${Date.now()}`,
      role: 'assistant' as const,
      content: welcomeMap[mode] || welcomeMap.coal,
      timestamp: Date.now(),
    }],
  });
  // 清除旧标记
  useSceneStore.getState().clearAIMarkers();
}

const SCENARIOS_FRACTURE: { key: ScenarioType; label: string; icon: string }[] = [
  { key: 'coal', label: '煤矿', icon: '⛏' },
  { key: 'gold', label: '金矿', icon: '🪨' },
  { key: 'oil', label: '油气', icon: '🛢' },
];

interface DataSourceOption {
  key: DataSourceType;
  label: string;
  shortLabel: string;
  icon: string;
  desc: string;
  scenario: ScenarioType;
}

const DATA_SOURCES: DataSourceOption[] = [
  { key: 'fracture', label: '模拟数据一·地下裂缝', shortLabel: '裂缝', icon: '⛏', desc: '煤矿/金矿/油气地下裂缝网络', scenario: 'coal' },
  { key: 'pipeline', label: '模拟数据二·油气管线', shortLabel: '管线', icon: '🛢', desc: '油气输送管道站场管网', scenario: 'pipeline' },
  { key: 'nuclear', label: '模拟数据三·核反应堆', shortLabel: '核反应堆', icon: '☢', desc: '压水堆一/二回路管道系统', scenario: 'nuclear' },
  { key: 'refinery', label: '模拟数据四·炼油化工', shortLabel: '炼油化工', icon: '🏭', desc: '换热器·加热炉·蒸馏塔内部通道', scenario: 'refinery' },
  { key: 'underground', label: '模拟数据五·地下暗流', shortLabel: '地下暗流', icon: '🌊', desc: '岩溶暗河/油气运移通道·管径变化', scenario: 'underground' },
];

export function ScenarioSelector() {
  const scenario = useSceneStore((s) => s.scenario);
  const setScenario = useSceneStore((s) => s.setScenario);
  const setFractures = useSceneStore((s) => s.setFractures);
  const dataSource = useSceneStore((s) => s.dataSource);
  const setDataSource = useSceneStore((s) => s.setDataSource);

  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // 点击外部关闭下拉
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSwitch = async (key: ScenarioType) => {
    setScenario(key);
    const fractures = await fetchFractures(key);
    setFractures(fractures);
    updateWelcomeMessage(key);
  };

  const handleSwitchDataSource = async (ds: DataSourceType) => {
    setDropdownOpen(false);
    const option = DATA_SOURCES.find((d) => d.key === ds);
    if (!option) return;
    setDataSource(ds);

    if (ds === 'fracture') {
      if (scenario === 'pipeline' || scenario === 'nuclear' || scenario === 'refinery' || scenario === 'underground') {
        handleSwitch('coal');
      }
      updateWelcomeMessage('coal');
    } else {
      setScenario(option.scenario);
      const fractures = await fetchFractures(option.scenario);
      setFractures(fractures);
      updateWelcomeMessage(option.scenario);
    }
  };

  // 初始化时通过 API 加载数据
  useEffect(() => {
    (async () => {
      const fractures = await fetchFractures(scenario);
      setFractures(fractures);
    })();
  }, []);

  const isPipelineMode = dataSource !== 'fracture';
  const currentSource = DATA_SOURCES.find((d) => d.key === dataSource) || DATA_SOURCES[0];

  return (
    <div className="flex items-center gap-2">
      {/* 数据源下拉菜单 */}
      <div className="relative" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen((v) => !v)}
          className="flex items-center gap-2 px-3 py-1.5 rounded text-[11px] font-medium transition-all whitespace-nowrap bg-[#00D4FF]/20 text-[#00D4FF] border border-[#00D4FF]/40 hover:bg-[#00D4FF]/30"
        >
          <span className="text-sm">{currentSource.icon}</span>
          <span>{currentSource.label}</span>
          <svg
            className={`w-3 h-3 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`}
            fill="none" stroke="currentColor" viewBox="0 0 24 24"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>

        {/* 下拉面板 */}
        {dropdownOpen && (
          <div className="absolute top-full left-0 mt-1 w-72 rounded-lg border border-white/15 bg-[#0A0E17]/95 backdrop-blur-xl shadow-2xl z-50 overflow-hidden">
            {DATA_SOURCES.map((ds) => (
              <button
                key={ds.key}
                onClick={() => handleSwitchDataSource(ds.key)}
                className={`w-full flex items-start gap-3 px-4 py-2.5 text-left transition-all border-b border-white/5 last:border-b-0 ${
                  dataSource === ds.key
                    ? 'bg-[#00D4FF]/15 text-[#00D4FF]'
                    : 'text-[#A0A0B0] hover:bg-white/5 hover:text-[#E0E0E8]'
                }`}
              >
                <span className="text-base mt-0.5">{ds.icon}</span>
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-semibold whitespace-nowrap">{ds.label}</div>
                  <div className="text-[9px] text-[#606070] mt-0.5">{ds.desc}</div>
                </div>
                {dataSource === ds.key && (
                  <span className="text-[#00D4FF] text-xs mt-0.5">✓</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* 分隔线 */}
      <div className="w-px h-4 bg-white/10" />

      {/* 子场景（仅裂缝模式显示煤矿/金矿/油气） */}
      {!isPipelineMode && SCENARIOS_FRACTURE.map(({ key, label, icon }) => (
        <button
          key={key}
          onClick={() => handleSwitch(key)}
          className={`flex items-center gap-1 px-2.5 py-1 rounded text-[10px] font-medium transition-all ${
            scenario === key
              ? 'bg-[#FFE600]/20 text-[#FFE600] border border-[#FFE600]/40'
              : 'text-[#A0A0B0] border border-transparent hover:bg-white/5 hover:text-[#E0E0E8]'
          }`}
        >
          <span className="text-xs">{icon}</span>
          {label}
        </button>
      ))}
    </div>
  );
}
