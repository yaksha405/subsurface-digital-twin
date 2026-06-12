/**
 * useQuickCommands — 快捷指令 Hook
 */

import { useEffect, useState } from 'react';
import { fetchQuickCommands } from '../api/aiApi';
import type { QuickCommand } from '../types/api';

let cached: QuickCommand[] | null = null;

export interface UseQuickCommandsResult {
  data: QuickCommand[];
  loading: boolean;
}

export function useQuickCommands(): UseQuickCommandsResult {
  const [data, setData] = useState<QuickCommand[]>(cached || []);
  const [loading, setLoading] = useState(!cached);

  useEffect(() => {
    if (cached) return;

    // fetchQuickCommands is a plain array (re-exported from mockAI)
    const d = Array.isArray(fetchQuickCommands)
      ? (fetchQuickCommands as QuickCommand[])
      : [];

    cached = d;
    setData(d);
    setLoading(false);
  }, []);

  return { data, loading };
}
