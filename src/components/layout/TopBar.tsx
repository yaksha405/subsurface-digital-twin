import { useEffect, useState } from 'react';
import { ScenarioSelector } from './ScenarioSelector';
import { MeasurementToolbar } from './MeasurementToolbar';
import { SettingsDialog } from './SettingsDialog';
import { ExportHub } from './ExportHub';
import { canPerformAction, roleLabel, type ProductRole } from '../../domain/accessControl';
import { t } from '../../domain/i18nCatalog';
import { useSceneStore } from '../../store/useSceneStore';

export function TopBar() {
  const [time, setTime] = useState(new Date());
  const [exportHubOpen, setExportHubOpen] = useState(false);
  const locale = useSceneStore((s) => s.locale);
  const setLocale = useSceneStore((s) => s.setLocale);
  const [role, setRole] = useState<ProductRole>('engineer');

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="h-14 bg-white/95 backdrop-blur-md border-b border-[#D9E1EA] flex items-center px-4 gap-4 relative z-[200] shadow-sm">
      {/* Logo */}
      <div className="flex items-center gap-2">
        <div className="w-9 h-9 rounded-lg bg-[#1F2937] flex items-center justify-center shadow-sm">
          <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
            <rect x="3" y="11" width="18" height="10" rx="2" />
            <circle cx="12" cy="5" r="2" />
            <path d="M12 7v4M8 16h.01M16 16h.01" />
          </svg>
        </div>
        <div>
          <div className="text-sm font-extrabold text-[#182230] tracking-wide leading-none">{t('app.title', locale)}</div>
          <div className="text-[9px] text-[#667085] tracking-widest mt-0.5">EVIDENCE-FIRST ROBOTIC INSPECTION</div>
        </div>
      </div>

      {/* Center: scenario + tools */}
      <div className="flex-1 flex items-center justify-center gap-6">
        <ScenarioSelector />
        <div className="w-px h-5 bg-[#D9E1EA]" />
        <MeasurementToolbar />
      </div>

      {/* Right: clock + export */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1">
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as ProductRole)}
            className="h-8 rounded-md border border-[#D9E1EA] bg-[#F8FAFC] px-2 text-[10px] text-[#344054] outline-none hover:border-[#B7C3D0]"
            title={t('top.role', locale)}
          >
            {(['manager', 'safety', 'engineer', 'operator'] as ProductRole[]).map((item) => (
              <option key={item} value={item}>{roleLabel(item, locale)}</option>
            ))}
          </select>
          <button
            onClick={() => setLocale(locale === 'zh-CN' ? 'en-US' : 'zh-CN')}
            aria-label={locale === 'zh-CN' ? 'Switch to English' : '切换到中文'}
            data-testid="locale-toggle"
            className="h-8 rounded-md border border-[#D9E1EA] bg-[#F8FAFC] px-2 text-[10px] text-[#667085] hover:text-[#182230]"
          >
            {locale === 'zh-CN' ? 'EN' : '中文'}
          </button>
        </div>
        <div className="text-right">
          <div className="text-xs font-mono text-[#1F2937] leading-none">
            {time.toLocaleTimeString(locale === 'zh-CN' ? 'zh-CN' : 'en-GB', { hour12: false })}
          </div>
          <div className="text-[9px] text-[#667085] mt-0.5">
            {time.toLocaleDateString(locale === 'zh-CN' ? 'zh-CN' : 'en-CA')}
          </div>
        </div>
        <button
          onClick={() => setExportHubOpen(true)}
          disabled={!canPerformAction(role, 'export_data')}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-[#1F2937] border border-[#1F2937] text-white rounded-md text-[10px] font-semibold hover:bg-[#111827] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          title={canPerformAction(role, 'export_data') ? t('top.exportOpen', locale) : t('top.exportDenied', locale)}
        >
          <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3" />
          </svg>
          {locale === 'zh-CN' ? '数据导出' : 'Export'}
        </button>
        <SettingsDialog />
      </div>

      <ExportHub open={exportHubOpen} onClose={() => setExportHubOpen(false)} />
    </div>
  );
}
