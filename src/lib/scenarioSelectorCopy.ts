import type { ScenarioType, DataSourceType } from '../types';
import type { Locale } from '../domain/i18nCatalog';

interface DataSourceOptionLike {
  key: DataSourceType;
  icon?: string;
  scenario?: ScenarioType;
}

export function getFractureScenarioLabel(key: ScenarioType, locale: Locale) {
  const labels: Record<'coal' | 'gold' | 'oil', { zh: string; en: string }> = {
    coal: { zh: '煤矿', en: 'Coal' },
    gold: { zh: '金矿', en: 'Gold' },
    oil: { zh: '油气', en: 'Oil & Gas' },
  };

  return labels[key as 'coal' | 'gold' | 'oil']?.[locale === 'zh-CN' ? 'zh' : 'en'] ?? key;
}

export function getDataSourceCopy(option: DataSourceOptionLike, locale: Locale) {
  const map: Record<DataSourceType, { label: string; desc: string; shortLabel: string }> = {
    fracture: {
      label: locale === 'zh-CN' ? '模拟数据一·地下裂缝' : 'Mock Scene 1 · Underground Fractures',
      shortLabel: locale === 'zh-CN' ? '裂缝' : 'Fractures',
      desc: locale === 'zh-CN' ? '煤矿/金矿/油气地下裂缝网络' : 'Coal, gold, and reservoir fracture network',
    },
    pipeline: {
      label: locale === 'zh-CN' ? '模拟数据二·油气管线' : 'Mock Scene 2 · Pipeline',
      shortLabel: locale === 'zh-CN' ? '管线' : 'Pipeline',
      desc: locale === 'zh-CN' ? '油气输送管道站场管网' : 'Oil and gas transmission piping network',
    },
    nuclear: {
      label: locale === 'zh-CN' ? '模拟数据三·核反应堆' : 'Mock Scene 3 · Reactor Loop',
      shortLabel: locale === 'zh-CN' ? '核反应堆' : 'Reactor',
      desc: locale === 'zh-CN' ? '压水堆一/二回路管道系统' : 'PWR primary and secondary loop piping',
    },
    refinery: {
      label: locale === 'zh-CN' ? '模拟数据四·炼油化工' : 'Mock Scene 4 · Refinery',
      shortLabel: locale === 'zh-CN' ? '炼油化工' : 'Refinery',
      desc: locale === 'zh-CN' ? '换热器·加热炉·蒸馏塔内部通道' : 'Internal passages of exchangers, furnaces, and towers',
    },
    underground: {
      label: locale === 'zh-CN' ? '模拟数据五·地下暗流' : 'Mock Scene 5 · Underground Flow',
      shortLabel: locale === 'zh-CN' ? '地下暗流' : 'Underground Flow',
      desc: locale === 'zh-CN' ? '地下岩溶暗河/深层渗流通道·管径变化' : 'Karst channels, deep seepage passages, and diameter changes',
    },
  };

  return {
    ...option,
    ...map[option.key],
  };
}
