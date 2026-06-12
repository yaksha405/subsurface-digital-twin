import { useState, useEffect } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Settings, X, Eye, EyeOff } from 'lucide-react';

export interface LLMSettings {
  provider: 'deepseek' | 'openai' | 'qwen' | 'custom';
  baseUrl: string;
  apiKey: string;
  model: string;
}

const PRESETS: Record<string, { baseUrl: string; model: string }> = {
  deepseek: { baseUrl: 'https://api.deepseek.com', model: 'deepseek-chat' },
  openai: { baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o' },
  qwen: { baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', model: 'qwen-plus' },
  custom: { baseUrl: '', model: '' },
};

const STORAGE_KEY = 'llm-settings';

export function loadSettings(): LLMSettings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return JSON.parse(raw);
  } catch {}
  return {
    provider: 'deepseek',
    baseUrl: 'https://api.deepseek.com',
    apiKey: '',
    model: 'deepseek-chat',
  };
}

function saveSettings(s: LLMSettings) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
}

export function SettingsDialog() {
  const [open, setOpen] = useState(false);
  const [settings, setSettings] = useState<LLMSettings>(loadSettings);
  const [showKey, setShowKey] = useState(false);

  useEffect(() => {
    setSettings(loadSettings());
  }, [open]);

  const handleProviderChange = (provider: LLMSettings['provider']) => {
    const preset = PRESETS[provider];
    setSettings((s) => ({
      ...s,
      provider,
      baseUrl: preset.baseUrl || s.baseUrl,
      model: preset.model || s.model,
    }));
  };

  const handleSave = () => {
    saveSettings(settings);
    setOpen(false);
  };

  return (
    <Dialog.Root open={open} onOpenChange={setOpen}>
      <Dialog.Trigger asChild>
        <button
          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded text-[10px] text-[#A0A0B0] hover:text-[#FFE600] hover:bg-white/5 transition-all"
          title="AI 模型设置"
        >
          <Settings className="w-3.5 h-3.5" />
        </button>
      </Dialog.Trigger>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 bg-black/60 z-50" />
        <Dialog.Content className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[420px] bg-[#1A1D2A] border border-white/10 rounded-xl p-6 z-50 shadow-2xl">
          <Dialog.Title className="text-sm font-bold text-[#E0E0E8] mb-4 flex items-center gap-2">
            <Settings className="w-4 h-4 text-[#FFE600]" />
            AI 模型设置
          </Dialog.Title>
          <Dialog.Description className="text-[10px] text-[#A0A0B0] mb-4">
            配置大语言模型的连接参数。保存后立即生效。
          </Dialog.Description>

          <div className="space-y-4">
            {/* Provider */}
            <div>
              <label className="block text-[10px] text-[#A0A0B0] mb-1.5">模型提供商</label>
              <div className="grid grid-cols-4 gap-1.5">
                {(['deepseek', 'openai', 'qwen', 'custom'] as const).map((p) => (
                  <button
                    key={p}
                    onClick={() => handleProviderChange(p)}
                    className={`px-2 py-1.5 rounded text-[10px] font-medium transition-all ${
                      settings.provider === p
                        ? 'bg-[#FFE600]/20 text-[#FFE600] border border-[#FFE600]/40'
                        : 'bg-white/5 text-[#A0A0B0] border border-white/10 hover:bg-white/10'
                    }`}
                  >
                    {p === 'deepseek' ? 'DeepSeek' : p === 'openai' ? 'OpenAI' : p === 'qwen' ? '通义千问' : '自定义'}
                  </button>
                ))}
              </div>
            </div>

            {/* Base URL */}
            <div>
              <label className="block text-[10px] text-[#A0A0B0] mb-1.5">Base URL</label>
              <input
                type="text"
                value={settings.baseUrl}
                onChange={(e) => setSettings((s) => ({ ...s, baseUrl: e.target.value }))}
                className="w-full px-3 py-2 bg-[#121218] border border-white/10 rounded text-xs text-[#E0E0E8] focus:outline-none focus:border-[#FFE600]/40"
                placeholder="https://api.deepseek.com"
              />
            </div>

            {/* API Key */}
            <div>
              <label className="block text-[10px] text-[#A0A0B0] mb-1.5">API Key</label>
              <div className="relative">
                <input
                  type={showKey ? 'text' : 'password'}
                  value={settings.apiKey}
                  onChange={(e) => setSettings((s) => ({ ...s, apiKey: e.target.value }))}
                  className="w-full px-3 py-2 pr-8 bg-[#121218] border border-white/10 rounded text-xs text-[#E0E0E8] focus:outline-none focus:border-[#FFE600]/40"
                  placeholder="sk-..."
                />
                <button
                  type="button"
                  onClick={() => setShowKey(!showKey)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-[#A0A0B0] hover:text-[#FFE600]"
                >
                  {showKey ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            {/* Model */}
            <div>
              <label className="block text-[10px] text-[#A0A0B0] mb-1.5">模型名称</label>
              <input
                type="text"
                value={settings.model}
                onChange={(e) => setSettings((s) => ({ ...s, model: e.target.value }))}
                className="w-full px-3 py-2 bg-[#121218] border border-white/10 rounded text-xs text-[#E0E0E8] focus:outline-none focus:border-[#FFE600]/40"
                placeholder="deepseek-chat"
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 mt-6">
            <Dialog.Close asChild>
              <button className="px-4 py-2 text-xs text-[#A0A0B0] hover:text-[#E0E0E8] transition-colors">
                取消
              </button>
            </Dialog.Close>
            <button
              onClick={handleSave}
              className="px-4 py-2 bg-[#FFE600]/20 text-[#FFE600] border border-[#FFE600]/30 rounded text-xs font-medium hover:bg-[#FFE600]/30 transition-all"
            >
              保存设置
            </button>
          </div>

          <Dialog.Close asChild>
            <button
              className="absolute top-4 right-4 text-[#A0A0B0] hover:text-[#E0E0E8]"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
