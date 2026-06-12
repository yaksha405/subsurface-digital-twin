import { useSceneStore } from '../../store/useSceneStore';

export function WatermarkOverlay() {
  const physicalTruthMode = useSceneStore((s) => s.physicalTruthMode);

  if (!physicalTruthMode) return null;

  return (
    <div className="absolute inset-0 z-30 pointer-events-none flex items-center justify-center">
      {/* Gray overlay */}
      <div className="absolute inset-0 bg-black/30" />

      {/* Watermark text - rotated and semi-transparent, repeated */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="text-center">
          <div className="text-primary-yellow/40 text-3xl font-bold tracking-widest transform rotate-[-20deg] mb-4">
            [ 原始雷达物理反射回波 ]
          </div>
          <div className="text-primary-red/50 text-2xl font-bold tracking-widest transform rotate-[-20deg]">
            未经 AI 润色
          </div>
          <div className="text-text-muted/30 text-sm mt-6 transform rotate-[-20deg]">
            COMPLIANCE AUDIT MODE — RAW SENSOR DATA ONLY
          </div>
        </div>
      </div>

      {/* Repeated diagonal watermark */}
      <div
        className="absolute inset-0 overflow-hidden"
        style={{
          backgroundImage: `repeating-linear-gradient(
            -45deg,
            transparent,
            transparent 80px,
            rgba(255, 230, 0, 0.03) 80px,
            rgba(255, 230, 0, 0.03) 160px
          )`,
        }}
      />
    </div>
  );
}
