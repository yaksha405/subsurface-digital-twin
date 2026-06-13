import { useSceneStore } from '../../store/useSceneStore';
import type { LayerState, ScenarioType } from '../../types';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Switch } from '../ui/switch';
import { Tooltip, TooltipTrigger, TooltipContent } from '../ui/tooltip';
import { Bot, Mountain, GitBranch, MapPin, Boxes, Atom } from 'lucide-react';

/**
 * 各场景"掩体/结构层"（rockMass）的标签和图标
 * — coal/gold: 地质岩体
 * — oil: 储层岩体
 * — pipeline: 管沟覆土
 * — nuclear: 安全壳厂房（ReactorContainment，非岩体）
 * — refinery: 无此层（不渲染，隐藏开关）
 * — underground: 岩溶围岩
 */
const STRUCTURE_LAYER: Record<Exclude<ScenarioType, 'refinery'>, {
  label: string;
  desc: string;
  Icon: React.ComponentType<{ className?: string }>;
}> = {
  coal:        { label: '地质岩体',   desc: '半透明煤矿地质岩体外壳', Icon: Mountain },
  gold:        { label: '地质岩体',   desc: '半透明金矿地质岩体外壳', Icon: Mountain },
  oil:         { label: '储层岩体',   desc: '半透明油气储层岩体外壳', Icon: Mountain },
  pipeline:    { label: '管沟覆土',   desc: '半透明管线覆土回填层', Icon: Mountain },
  nuclear:     { label: '安全壳厂房', desc: '反应堆安全壳及 RPV/SG/RCP 等设备线框', Icon: Atom },
  underground: { label: '岩溶围岩',   desc: '半透明深部岩溶围岩体', Icon: Mountain },
};

export function LayerToggle() {
  const layers = useSceneStore((s) => s.layers);
  const setLayer = useSceneStore((s) => s.setLayer);
  const dataSource = useSceneStore((s) => s.dataSource);

  // refinery 场景无掩体/结构层，不显示该开关
  const structureConfig = dataSource !== 'refinery' ? STRUCTURE_LAYER[dataSource] : null;

  const layerItems: {
    key: keyof LayerState;
    label: string;
    desc: string;
    Icon: React.ComponentType<{ className?: string }>;
  }[] = [];

  if (structureConfig) {
    layerItems.push({ key: 'rockMass', ...structureConfig });
  }
  layerItems.push(
    { key: 'fractures', label: '裂缝网络', desc: '地下裂缝/管道网络可视化', Icon: GitBranch },
    { key: 'pointCloud', label: '点云数据', desc: '原始扫描点云渲染（Potree LOD）', Icon: Boxes },
    { key: 'robots', label: '机器人集群', desc: '探测机器人实时位置', Icon: Bot },
    { key: 'poi', label: '兴趣点标注', desc: '裂缝入口、传感器站点、危险区域', Icon: MapPin },
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>图层控制</CardTitle>
      </CardHeader>
      <CardContent className="space-y-1.5">
        {layerItems.map(({ key, label, desc, Icon }) => {
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
