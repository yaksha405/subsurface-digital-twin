import { TooltipProvider } from '../ui/tooltip';
import { GasThresholdSlider } from './GasThresholdSlider';
import { LayerToggle } from './LayerToggle';
import { ToolActions } from './ToolActions';
import { SystemStatus } from './SystemStatus';
import { RobotFleet } from './RobotFleet';
import { AlertFeed } from './AlertFeed';
import { SensorTrends } from './SensorTrends';
import { useSceneStore } from '../../store/useSceneStore';
import { ScrollArea } from '../ui/scroll-area';
import { Separator } from '../ui/separator';

export function ControlPanel() {
  const physicalTruthMode = useSceneStore((s) => s.physicalTruthMode);

  return (
    <TooltipProvider delayDuration={200}>
      <div className="h-full bg-[#121218]/90 backdrop-blur-md border-r border-white/5 flex flex-col overflow-hidden">
        <div className="p-3 border-b border-white/5 flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#FFE600] animate-pulse" />
          <h2 className="text-sm font-semibold text-[#E0E0E8] tracking-wide">控制台</h2>
          <span className="ml-auto text-[9px] text-[#A0A0B0] font-mono">SHADCN · RADIX UI</span>
        </div>

        <ScrollArea className="flex-1">
          <div className="p-3 space-y-3">
            <SystemStatus />
            <Separator />
            <AlertFeed />
            <Separator />
            <RobotFleet />
            <Separator />
            <SensorTrends />
            <Separator />
            <LayerToggle />
            <Separator />
            {!physicalTruthMode && (
              <GasThresholdSlider />
            )}
            <ToolActions />
          </div>
        </ScrollArea>
      </div>
    </TooltipProvider>
  );
}
