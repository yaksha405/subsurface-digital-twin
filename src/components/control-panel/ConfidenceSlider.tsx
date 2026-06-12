import { useSceneStore } from '../../store/useSceneStore';
import { useSceneStats } from '../../hooks/useSceneStats';
import { Card, CardHeader, CardTitle, CardContent } from '../ui/card';
import { Slider } from '../ui/slider';
import { Progress } from '../ui/progress';

export function ConfidenceSlider() {
  const confidenceFilter = useSceneStore((s) => s.confidenceFilter);
  const setConfidenceFilter = useSceneStore((s) => s.setConfidenceFilter);
  const { data: stats, loading } = useSceneStats();
  const totalNodes = stats?.totalNodes ?? 0;
  const filteredCount = Math.round(totalNodes * (confidenceFilter / 100));

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>数据置信度过滤</CardTitle>
          <div className="text-sm font-mono font-bold text-[#FFE600]">{confidenceFilter}%</div>
        </div>
      </CardHeader>
      <CardContent className="space-y-3">
        <Slider
          value={[confidenceFilter]}
          onValueChange={(vals) => setConfidenceFilter(vals[0])}
          min={0}
          max={100}
          step={1}
        />
        <div className="flex justify-between text-[9px] text-[#A0A0B0]/50 font-mono">
          <span>0%</span>
          <span>50%</span>
          <span>100%</span>
        </div>
        <Progress value={confidenceFilter} />
        <div className="flex items-center justify-between text-[9px]">
          <span className="text-[#A0A0B0]/70">剥离 AI 脑补盲区</span>
          {confidenceFilter > 0 && (
            <span className="text-[#FF8800] font-mono">
              过滤 -{filteredCount.toLocaleString()} 节点
            </span>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
