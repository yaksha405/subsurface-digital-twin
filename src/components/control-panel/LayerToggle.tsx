import { useSceneStore } from '../../store/useSceneStore';
import type { LayerState } from '../../types';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Switch } from '../ui/switch';
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip';
import { Bot, Mountain, GitBranch, MapPin, Boxes } from 'lucide-react';

const layerConfig: {
  key: keyof LayerState;
  label: string;
  desc: string;
  Icon: React.ComponentType<{ className?: string }>;
}[] = [
  { key: 'rockMass', label: '地质岩体', desc: '半透明地质体外壳 (200×40×80m)', Icon: Mountain },
  { key: 'fractures', label: '裂缝网络', desc: '地下裂缝网络可视化（从地表向下延伸）', Icon: GitBranch },
  { key: 'pointCloud', label: '点云数据', desc: '原始扫描点云渲染（ShaderMaterial GPU着色 + Potree LOD）', Icon: Boxes },
  { key: 'robots', label: '机器人集群', desc: '蛇形探测机器人实时位置', Icon: Bot },
  { key: 'poi', label: '兴趣点标注', desc: '裂缝入口、传感器站点、危险区域', Icon: MapPin },
];

export function LayerToggle() {
  const layers = useSceneStore((s) => s.layers);
  const setLayer = useSceneStore((s) => s.setLayer);
  const physicalTruthMode = useSceneStore((s) => s.physicalTruthMode);

  return (
    <Card>
      <CardHeader>
        <CardTitle>图层控制</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {layerConfig.map(({ key, label, desc, Icon }) => {
          const isEnabled = layers[key];
          const isDisabled = false;
          return (
            <Tooltip key={key}>
              <TooltipTrigger asChild>
                <div
                  className={`w-full flex items-center gap-2 px-2 py-2 rounded-md transition-all cursor-pointer ${
                    isDisabled
                      ? 'opacity-30 cursor-not-allowed'
                      : isEnabled
                      ? 'bg-[#FFE600]/8 border border-[#FFE600]/20'
                      : 'border border-transparent hover:bg-white/5'
                  }`}
                  onClick={() => !isDisabled && setLayer(key, !isEnabled)}
                >
                  <div className={`w-7 h-7 rounded flex items-center justify-center ${
                    isEnabled && !isDisabled ? 'bg-[#FFE600]/15 text-[#FFE600]' : 'bg-[#2A2D3A] text-[#A0A0B0]'
                  }`}>
                    <Icon className="w-3.5 h-3.5" />
                  </div>
                  <div className="flex-1 text-left">
                    <div className={`text-xs font-medium ${isEnabled && !isDisabled ? 'text-[#E0E0E8]' : 'text-[#A0A0B0]'}`}>
                      {label}
                    </div>
                  </div>
                  <Switch
                    checked={isEnabled && !isDisabled}
                    disabled={isDisabled}
                    onCheckedChange={() => setLayer(key, !isEnabled)}
                  />
                </div>
              </TooltipTrigger>
              <TooltipContent side="right">{desc}</TooltipContent>
            </Tooltip>
          );
        })}
      </CardContent>
    </Card>
  );
}
