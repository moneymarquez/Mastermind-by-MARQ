import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import type { BotConfig, BotSignal, BotTrade, BotDailySummary, StocksAccountStatus, BrokerKeyStatus } from './types';

const DEFAULT_CONFIG: BotConfig = {
  id: '', watchlist: ['SPY', 'QQQ'], enabled: false, mode: 'paper', halted_date: null, halted_reason: null, last_run_at: null,
};
const EMPTY_ACCOUNT: StocksAccountStatus = { connected: false, equity: 0, cash: 0, dailyPl: 0, dailyPlPct: 0, positions: [], news: [] };

async function authedFetch(path: string, opts: RequestInit = {}): Promise<Response> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  if (!token) throw new Error('Not signed in.');
  return fetch(path, { ...opts, headers: { ...opts.headers, authorization: `Bearer ${token}` } });
}

export function useStocksBot() {
  const [config, setConfig] = useState<BotConfig>(DEFAULT_CONFIG);
  const [signals, setSignals] = useState<BotSignal[]>([]);
  const [trades, setTrades] = useState<BotTrade[]>([]);
  const [dailySummaries, setDailySummaries] = useState<BotDailySummary[]>([]);
  const [account, setAccount] = useState<StocksAccountStatus>(EMPTY_ACCOUNT);
  const [brokerStatus, setBrokerStatus] = useState<BrokerKeyStatus>({ connected: false, apiKeyIdMasked: null });
  const [loading, setLoading] = useState(true);
  const [accountLoading, setAccountLoading] = useState(true);
  const [savingKeys, setSavingKeys] = useState(false);
  const [keysError, setKeysError] = useState('');

  const loadTables = useCallback(async () => {
    const [configRes, signalsRes, tradesRes, summaryRes] = await Promise.all([
      supabase.from('bot_config').select('*').maybeSingle(),
      supabase.from('bot_signals').select('*').order('created_at', { ascending: false }).limit(50),
      supabase.from('bot_trades').select('*').order('opened_at', { ascending: false }).limit(100),
      supabase.from('bot_daily_summary').select('*').order('summary_date', { ascending: false }).limit(30),
    ]);
    if (configRes.data) setConfig(configRes.data as BotConfig);
    setSignals((signalsRes.data ?? []) as BotSignal[]);
    setTrades((tradesRes.data ?? []) as BotTrade[]);
    setDailySummaries((summaryRes.data ?? []) as BotDailySummary[]);
    setLoading(false);
  }, []);

  const loadAccount = useCallback(async () => {
    setAccountLoading(true);
    try {
      const res = await authedFetch('/api/stocks-account');
      if (res.ok) setAccount(await res.json());
    } catch {
      // network hiccup — keep showing the last known account state
    } finally {
      setAccountLoading(false);
    }
  }, []);

  const loadBrokerStatus = useCallback(async () => {
    try {
      const res = await authedFetch('/api/broker-keys-status');
      if (res.ok) setBrokerStatus(await res.json());
    } catch {
      // leave as disconnected — the Settings panel will show the connect flow
    }
  }, []);

  useEffect(() => {
    loadTables();
    loadAccount();
    loadBrokerStatus();
  }, [loadTables, loadAccount, loadBrokerStatus]);

  const updateConfig = async (patch: Partial<Pick<BotConfig, 'watchlist' | 'enabled'>>) => {
    const next = { ...config, ...patch };
    setConfig(next);
    await supabase.from('bot_config').upsert({ watchlist: next.watchlist, enabled: next.enabled, mode: next.mode, updated_at: new Date().toISOString() }, { onConflict: 'user_id' });
  };

  const toggleEnabled = () => updateConfig({ enabled: !config.enabled });

  const saveBrokerKeys = async (apiKeyId: string, apiSecret: string) => {
    setSavingKeys(true);
    setKeysError('');
    try {
      const res = await authedFetch('/api/save-broker-keys', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ apiKeyId, apiSecret }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Could not save keys');
      }
      await loadBrokerStatus();
      await loadAccount();
    } catch (err) {
      setKeysError(err instanceof Error ? err.message : 'Could not save keys');
    } finally {
      setSavingKeys(false);
    }
  };

  return {
    config, signals, trades, dailySummaries, account, brokerStatus,
    loading, accountLoading, savingKeys, keysError,
    updateConfig, toggleEnabled, saveBrokerKeys,
    refreshAccount: loadAccount, refreshTables: loadTables,
  };
}
