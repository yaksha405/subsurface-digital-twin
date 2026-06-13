import { useState, useMemo, useEffect } from 'react';
import { useSceneStore } from '../../store/useSceneStore';
import { exportPDF } from '../../lib/pdfExport';
import { exportLAS, getLASStats } from '../../lib/exportLAS';
import { exportOBJ, getOBJStats } from '../../lib/exportOBJ';
import { exportCSV, getCSVStats } from '../../lib/exportCSV';
import { useAllRobots, useRobotStats } from '../../hooks/useRobots';
import { useAlerts } from '../../hooks/useAlerts';
import { useSceneStats } from '../../hooks/useSceneStats';
import { usePOIs } from '../../hooks/usePOIs';

type ExportFormat = 'pdf' | 'las' | 'obj' | 'csv' | null;

export function ExportHub({ open, onClose }: { open: boolean; onClose: () => void }) {
  const [activeFormat, setActiveFormat] = useState<ExportFormat>(null);
  const [progress, setProgress] = useState('');
  const [done, setDone] = useState<string | null>(null);

  const captureScreenshot = useSceneStore((s) => s.captureScreenshot);
  const gasThreshold = useSceneStore((s) => s.gasThreshold);
  const confidenceFilter = useSceneStore((s) => s.confidenceFilter);
  const layers = useSceneStore((s) => s.layers);
  const scenario = useSceneStore((s) => s.scenario);
  const dataSource = useSceneStore((s) => s.dataSource);
  const fractures = useSceneStore((s) => s.fractures);
  const annotations = useSceneStore((s) => s.annotations);
  const messages = useSceneStore((s) => s.messages);
  const cameraInfo = useSceneStore((s) => s.cameraInfo);

  const { data: robots } = useAllRobots();
  const { data: robotStats } = useRobotStats();
  const { data: alerts } = useAlerts(dataSource);
  const { data: stats } = useSceneStats();
  const { data: pois } = usePOIs();

  const lasStats = useMemo(() => getLASStats(fractures, robots ?? null), [fractures, robots]);
  const objStats = useMemo(() => getOBJStats(fractures, robots ?? null), [fractures, robots]);
  const csvStats = useMemo(() => getCSVStats(fractures, robots ?? null, alerts ?? null), [fractures, robots, alerts]);

  // M5: ESC 键关闭（导出进行中时禁止关闭）
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && activeFormat === null) onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, activeFormat, onClose]);

  if (!open) return null;

  const handleExport = async (format: ExportFormat) => {
    setActiveFormat(format);
    setProgress('准备数据中...');
    setDone(null);
    try {
      switch (format) {
        case 'pdf':
          setProgress('生成 PDF 安全评估报告...');
          await exportPDF(captureScreenshot, {
            gasThreshold, confidenceFilter, layers, scenario,
            stats, robots, robotStats, alerts, fractures, pois, annotations, messages, cameraInfo,
          });
          break;
        case 'las':
          setProgress(`生成 LAS 1.4 点云文件 (${lasStats.totalPoints.toLocaleString()} 点)...`);
          exportLAS(fractures, robots ?? null, scenario);
          break;
        case 'obj':
          setProgress('生成 OBJ 3D 网格模型...');
          exportOBJ(fractures, robots ?? null, scenario);
          break;
        case 'csv':
          setProgress(`生成 CSV 传感器矩阵 (${csvStats.sensorRows + csvStats.robotRows} 行)...`);
          exportCSV(fractures, robots ?? null, alerts ?? null, scenario);
          break;
      }
      const labels: Record<string, string> = {
        pdf: 'PDF 安全评估报告',
        las: 'LAS 点云文件',
        obj: 'OBJ 3D 网格模型',
        csv: 'CSV 传感器数据表',
      };
      setDone(labels[format!] ?? '');
    } catch (e) {
      console.error('Export failed:', e);
      setDone(null);
      setProgress(`导出失败: ${(e as Error).message}`);
    } finally {
      setActiveFormat(null);
    }
  };

  const isExporting = activeFormat !== null;

  // M6: 批量导出 — 依次导出全部格式
  const handleExportAll = async () => {
    const formats: ExportFormat[] = ['pdf', 'csv', 'las', 'obj'];
    for (const fmt of formats) {
      await handleExport(fmt);
      // 短暂延迟让用户看到完成状态
      await new Promise(r => setTimeout(r, 600));
    }
  };

  return (
    <div
      className="fixed inset-0 z-[500] flex items-center justify-center bg-black/60 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="w-[680px] max-h-[85vh] overflow-y-auto glass-panel rounded-xl border border-primary-yellow/20 shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-primary-yellow/15 flex items-center justify-center">
              <svg className="w-5 h-5 text-primary-yellow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
            </div>
            <div>
              <div className="text-base font-bold text-text">数据导出 / 交付中心</div>
              <div className="text-[10px] text-text-muted/60 tracking-wide">EXPORT HUB · 兼容 Trimble / AutoCAD / ArcGIS / Excel</div>
            </div>
          </div>
          <button
            onClick={onClose}
            className="w-7 h-7 rounded-md hover:bg-white/10 flex items-center justify-center text-text-muted hover:text-text transition-colors"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Export Cards */}
        <div className="p-6 space-y-3">
          {/* Progress / Status */}
          {(isExporting || progress || done) && (
            <div className={`px-4 py-2.5 rounded-lg text-[11px] font-medium flex items-center gap-2 ${
              done ? 'bg-green-500/10 text-green-400 border border-green-500/20'
              : progress.startsWith('导出失败') ? 'bg-red-500/10 text-red-400 border border-red-500/20'
              : 'bg-blue-500/10 text-blue-400 border border-blue-500/20'
            }`}>
              {isExporting && (
                <svg className="w-3.5 h-3.5 animate-spin shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M21 12a9 9 0 1 1-6.219-8.56" />
                </svg>
              )}
              {done ? `已导出: ${done}` : progress}
            </div>
          )}

          {/* Card 1: PDF Report */}
          <ExportCard
            icon="report"
            title="管理层汇报材料"
            subtitle="PDF 安全评估报告"
            badge="已就绪"
            badgeColor="green"
            description="附带 3D 场景截图、LLM 分析结论、告警列表、机器人状态、裂缝分析、完整性哈希。适合矿长/安监局/投资人阅览。"
            stats={[
              { label: '内容', value: '9 章节' },
              { label: '格式', value: 'A4 PDF' },
              { label: '合规', value: 'SHA-256' },
            ]}
            onClick={() => handleExport('pdf')}
            disabled={isExporting}
            active={activeFormat === 'pdf'}
          />

          {/* Card 2: LAS Point Cloud */}
          <ExportCard
            icon="cloud"
            title="测绘后处理点云"
            subtitle="LAS 1.4 / .las 文件"
            badge="ASPRS 标准"
            badgeColor="blue"
            description="全量激光雷达点云，含 XYZ 坐标、反射强度、RGB 着色。可直接拖入 Trimble Business Center、AutoCAD Civil 3D、CloudCompare、ArcGIS Pro 进行测绘级后处理。"
            stats={[
              { label: '点数', value: lasStats.totalPoints.toLocaleString() },
              { label: '大小', value: `~${lasStats.estimatedSizeMB} MB` },
              { label: '分类', value: 'ASPRS' },
            ]}
            onClick={() => handleExport('las')}
            disabled={isExporting}
            active={activeFormat === 'las'}
          />

          {/* Card 3: OBJ Mesh */}
          <ExportCard
            icon="cube"
            title="3D 实体空间网格"
            subtitle="OBJ + MTL 模型文件"
            badge="Wavefront"
            badgeColor="orange"
            description="裂缝管道 + 体素表面 + 机器人的 3D 三角网格模型。可导入 Blender、3ds Max、AutoCAD，或直接送入 3D 打印机制作矿洞物理沙盘。"
            stats={[
              { label: '网格', value: `${objStats.meshCount} 个` },
              { label: '顶点', value: objStats.estimatedVertices.toLocaleString() },
              { label: '大小', value: `~${objStats.estimatedSizeMB} MB` },
            ]}
            onClick={() => handleExport('obj')}
            disabled={isExporting}
            active={activeFormat === 'obj'}
          />

          {/* Card 4: CSV Data */}
          <ExportCard
            icon="table"
            title="原始传感器矩阵"
            subtitle="CSV 数据表"
            badge="RFC 4180"
            badgeColor="cyan"
            description="裂缝节点全量传感器 (19 项物理量) + 机器人状态 + 告警事件 + 裂缝几何参数。UTF-8 BOM 编码，Excel 直接打开，可导入矿企 ERP / SCADA 系统。"
            stats={[
              { label: '传感器', value: `${csvStats.sensorRows} 行` },
              { label: '机器人', value: `${csvStats.robotRows} 行` },
              { label: '告警', value: `${csvStats.alertRows} 条` },
            ]}
            onClick={() => handleExport('csv')}
            disabled={isExporting}
            active={activeFormat === 'csv'}
          />
        </div>

        {/* Footer */}
        <div className="px-6 py-3 border-t border-white/10 flex items-center justify-between">
          <div className="text-[9px] text-text-muted/50">
            所有导出文件均包含数据完整性校验 · 导出数据仅供工程参考
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleExportAll}
              disabled={isExporting}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-primary-yellow/15 text-primary-yellow border border-primary-yellow/30 rounded-md text-[11px] font-medium hover:bg-primary-yellow/25 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
              一键全部导出
            </button>
            <button
              onClick={onClose}
              className="px-4 py-1.5 bg-white/5 border border-white/10 rounded-md text-xs text-text hover:bg-white/10 transition-colors"
            >
              关闭
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Export Card Component ──

type BadgeColor = 'green' | 'blue' | 'orange' | 'cyan';

function ExportCard({
  icon,
  title,
  subtitle,
  badge,
  badgeColor,
  description,
  stats,
  onClick,
  disabled,
  active,
}: {
  icon: string;
  title: string;
  subtitle: string;
  badge: string;
  badgeColor: BadgeColor;
  description: string;
  stats: { label: string; value: string }[];
  onClick: () => void;
  disabled: boolean;
  active: boolean;
}) {
  const badgeColors: Record<BadgeColor, string> = {
    green: 'bg-green-500/15 text-green-400 border-green-500/30',
    blue: 'bg-blue-500/15 text-blue-400 border-blue-500/30',
    orange: 'bg-orange-500/15 text-orange-400 border-orange-500/30',
    cyan: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
  };

  return (
    <div className={`group relative rounded-lg border transition-all ${
      active ? 'border-primary-yellow/50 bg-primary-yellow/5' : 'border-white/8 bg-white/[0.02] hover:border-white/15 hover:bg-white/[0.04]'
    } ${disabled && !active ? 'opacity-50' : ''}`}>
      <div className="flex items-start gap-4 p-4">
        {/* Icon */}
        <div className={`w-11 h-11 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
          active ? 'bg-primary-yellow/20' : 'bg-white/5 group-hover:bg-white/8'
        }`}>
          <ExportIcon icon={icon} active={active} />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-semibold text-text">{title}</span>
            <span className={`text-[9px] px-1.5 py-0.5 rounded border font-mono ${badgeColors[badgeColor]}`}>
              {badge}
            </span>
          </div>
          <div className="text-[11px] text-text-muted font-mono mb-2">{subtitle}</div>
          <p className="text-[10px] text-text-muted/70 leading-relaxed mb-3">{description}</p>

          {/* Stats */}
          <div className="flex gap-4">
            {stats.map((s) => (
              <div key={s.label} className="flex flex-col">
                <span className="text-[9px] text-text-muted/50 uppercase tracking-wider">{s.label}</span>
                <span className="text-[11px] text-text font-mono font-medium">{s.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Action Button */}
        <button
          onClick={onClick}
          disabled={disabled}
          className={`shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-md text-[11px] font-medium transition-all ${
            active
              ? 'bg-primary-yellow text-background'
              : disabled
              ? 'bg-white/5 text-text-muted cursor-not-allowed'
              : 'bg-primary-yellow/10 text-primary-yellow border border-primary-yellow/30 hover:bg-primary-yellow/20'
          }`}
        >
          {active ? (
            <>
              <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
              导出中
            </>
          ) : (
            <>
              <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
              </svg>
              导出
            </>
          )}
        </button>
      </div>
    </div>
  );
}

// ── Icons ──

function ExportIcon({ icon, active }: { icon: string; active: boolean }) {
  const color = active ? 'text-primary-yellow' : 'text-text-muted group-hover:text-text';
  const stroke = 'currentColor';

  switch (icon) {
    case 'report':
      return (
        <svg className={`w-5 h-5 ${color}`} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
          <path d="M14 2v6h6M16 13H8M16 17H8M10 9H8" />
        </svg>
      );
    case 'cloud':
      return (
        <svg className={`w-5 h-5 ${color}`} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8">
          <circle cx="6" cy="6" r="1.5" fill={stroke} />
          <circle cx="18" cy="6" r="1.5" fill={stroke} />
          <circle cx="6" cy="18" r="1.5" fill={stroke} />
          <circle cx="18" cy="18" r="1.5" fill={stroke} />
          <circle cx="12" cy="12" r="2" fill={stroke} />
          <path d="M6 6L12 12M18 6L12 12M6 18L12 12M18 18L12 12" strokeWidth="0.5" opacity="0.5" />
        </svg>
      );
    case 'cube':
      return (
        <svg className={`w-5 h-5 ${color}`} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8">
          <path d="M21 7.5l-9-5-9 5 9 5 9-5z" />
          <path d="M3 7.5v9l9 5 9-5v-9" />
          <path d="M12 12.5v10" strokeWidth="1" opacity="0.4" />
        </svg>
      );
    case 'table':
      return (
        <svg className={`w-5 h-5 ${color}`} viewBox="0 0 24 24" fill="none" stroke={stroke} strokeWidth="1.8">
          <rect x="3" y="3" width="18" height="18" rx="1" />
          <path d="M3 9h18M3 15h18M9 3v18M15 3v18" strokeWidth="1" opacity="0.5" />
        </svg>
      );
    default:
      return null;
  }
}
