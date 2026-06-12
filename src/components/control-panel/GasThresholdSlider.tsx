import { useSceneStore } from '../../store/useSceneStore';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Slider } from '../ui/slider';
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip';
import { Info } from 'lucide-react';

export function GasThresholdSlider() {
  const gasThreshold = useSceneStore((s) => s.gasThreshold);
  const setGasThreshold = useSceneStore((s) => s.setGasThreshold);
  const scenario = useSceneStore((s) => s.scenario);

  // 根据场景动态调整标签
  const isCoal = scenario === 'coal';
  const label = isCoal ? '瓦斯报警红线' : scenario === 'gold' ? '微震报警阈值' : '孔压报警阈值';
  const unit = scenario === 'gold' ? '次/h' : scenario === 'oil' ? 'MPa' : '%';
  const min = scenario === 'gold' ? 5 : scenario === 'oil' ? 10 : 0.5;
  const max = scenario === 'gold' ? 30 : scenario === 'oil' ? 35 : 5.0;
  const defaultThreshold = scenario === 'gold' ? 15 : scenario === 'oil' ? 30 : 1.5;

  const isOverThreshold = gasThreshold < defaultThreshold;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5">
            <CardTitle>{label}</CardTitle>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-3 h-3 text-[#A0A0B0] cursor-help" />
              </TooltipTrigger>
              <TooltipContent side="right" className="max-w-[220px]">
                拖动滑块调整报警阈值。3D 裂缝网络会实时重绘颜色：超阈值区域变为红色。对标 Gecko Robotics 热力图色谱。
              </TooltipContent>
            </Tooltip>
          </div>
          <div className={`text-sm font-mono font-bold ${isOverThreshold ? 'text-[#FF3333] animate-pulse' : 'text-[#FFE600]'}`}>
            {gasThreshold.toFixed(scenario === 'coal' ? 1 : 0)}{unit}
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Slider
          value={[gasThreshold]}
          onValueChange={(vals) => setGasThreshold(vals[0])}
          min={min}
          max={max}
          step={scenario === 'coal' ? 0.1 : 1}
        />
        <div className="flex justify-between text-[9px] text-[#A0A0B0]/50 font-mono">
          <span>{min}{unit}</span>
          <span className="text-[#FFE600]/50">{defaultThreshold}{unit}</span>
          <span>{max}{unit}</span>
        </div>
        {/* 色标图例 */}
        <div className="flex items-center gap-2">
          <div className="flex-1 h-2 rounded-sm" style={{
            background: 'linear-gradient(to right, #1A80E0, #44DDAA, #DDCC22, #FF6622, #FF2222)'
          }} />
          <span className="text-[8px] text-[#A0A0B0]">安全 → 危险</span>
        </div>
      </CardContent>
    </Card>
  );
}
