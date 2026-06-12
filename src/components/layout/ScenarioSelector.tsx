import { useSceneStore } from '../../store/useSceneStore';
import type { ScenarioType } from '../../types';
import { generateFractureNetwork } from '../../data/fractureDataGenerator';
import { useEffect } from 'react';

const SCENARIOS: { key: ScenarioType; label: string; icon: string }[] = [
  { key: 'coal', label: '煤矿', icon: '⛏' },
  { key: 'gold', label: '金矿', icon: '🪨' },
  { key: 'oil', label: '油气', icon: '🛢' },
];

export function ScenarioSelector() {
  const scenario = useSceneStore((s) => s.scenario);
  const setScenario = useSceneStore((s) => s.setScenario);
  const setFractures = useSceneStore((s) => s.setFractures);

  const handleSwitch = (key: ScenarioType) => {
    setScenario(key);
    const fractures = generateFractureNetwork(key);
    setFractures(fractures);
  };

  // 初始化时生成默认数据
  useEffect(() => {
    const fractures = generateFractureNetwork(scenario);
    setFractures(fractures);
  }, []);

  return (
    <div className="flex items-center gap-1">
      {SCENARIOS.map(({ key, label, icon }) => (
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
