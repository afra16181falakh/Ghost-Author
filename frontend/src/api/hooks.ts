import { useState, useEffect, useCallback } from 'react';
import { api } from './client';
import type { RefactorRun, Metrics, Repo, AgentSettings, HeatmapFile, FunctionHistory } from '../types';

export type FetchStatus = 'loading' | 'success' | 'error';

// Zero-filled metrics — shown while the real data loads (no fake numbers)
const EMPTY_METRICS: Metrics = {
  total_runs: 0,
  issues_found: 0,
  fixes_passed: 0,
  fixes_failed: 0,
  prs_generated: 0,
  avg_attempts: 0,
  success_rate: 0,
  avg_time_sec: 0,
  weekly_trend: [],
  smell_breakdown: [],
};

// ── Generic fetch hook — real API only, no mock fallback ─────────────────────
function useFetch<T>(path: string, initial: T, refreshMs = 0) {
  const [data, setData]     = useState<T>(initial);
  const [status, setStatus] = useState<FetchStatus>('loading');
  const [error, setError]   = useState<string | null>(null);

  const fetch_ = useCallback(async () => {
    try {
      const result = await api.get<T>(path);
      setData(result);
      setStatus('success');
      setError(null);
    } catch (e) {
      setStatus('error');
      setError((e as Error).message);
      // Keep whatever data we have — empty on first load, last-good on refresh
    }
  }, [path]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    fetch_();
    if (refreshMs > 0) {
      const id = setInterval(fetch_, refreshMs);
      return () => clearInterval(id);
    }
  }, [fetch_, refreshMs]);

  return { data, status, error, refetch: fetch_ };
}

// ── Normalise a run from the API (smells_json → smells) ──────────────────────
function normaliseRun(r: any): RefactorRun {
  return {
    ...r,
    smells: (r.smells ?? []).map((s: any) => ({
      ...s,
      smells: s.smells_json ?? s.smells ?? [],
    })),
    diff:        r.diff        ?? null,
    test_output: r.test_output ?? null,
    branch:      r.branch      ?? null,
    pr_merged:   r.pr_merged   ?? false,
    dry_run:     r.dry_run     ?? false,
  };
}

// ── Hooks ─────────────────────────────────────────────────────────────────────

export function useMetrics() {
  return useFetch<Metrics>('/api/metrics', EMPTY_METRICS, 30_000);
}

export function useRuns(filters?: { status?: string; repo_id?: string }) {
  const params = new URLSearchParams();
  if (filters?.status)  params.set('status', filters.status);
  if (filters?.repo_id) params.set('repo_id', filters.repo_id);
  const qs = params.toString();

  const hook = useFetch<any[]>(`/api/runs${qs ? '?' + qs : ''}`, [], 15_000);
  return {
    ...hook,
    data: hook.data.map(normaliseRun) as RefactorRun[],
  };
}

export function useRun(runId: string) {
  const hook = useFetch<any | null>(`/api/runs/${runId}`, null);
  return {
    ...hook,
    data: hook.data ? (normaliseRun(hook.data) as RefactorRun) : null,
  };
}

export function useRepos() {
  return useFetch<Repo[]>('/api/repos', [], 30_000);
}

export function useHeatmap(repoId?: string) {
  const path = repoId ? `/api/repos/${repoId}/heatmap` : '/api/heatmap';
  return useFetch<HeatmapFile[]>(path, [], 60_000);
}

export function useSettings() {
  const [data, setData]     = useState<AgentSettings | null>(null);
  const [status, setStatus] = useState<FetchStatus>('loading');
  const [saving, setSaving] = useState(false);
  const [saveOk, setSaveOk] = useState(false);

  const fetch_ = useCallback(async () => {
    try {
      const result = await api.get<AgentSettings>('/api/settings');
      setData(result);
      setStatus('success');
    } catch {
      setStatus('error');
    }
  }, []);

  useEffect(() => { fetch_(); }, [fetch_]);

  const save = async (body: Partial<AgentSettings> & { github_token?: string; gemini_api_key?: string }) => {
    setSaving(true);
    try {
      const updated = await api.put<AgentSettings>('/api/settings', body);
      setData(updated);
      setSaveOk(true);
      setTimeout(() => setSaveOk(false), 2500);
      return updated;
    } finally {
      setSaving(false);
    }
  };

  return { data, status, saving, saveOk, save, refetch: fetch_ };
}

export function useTrigger() {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const trigger = async (repoId?: string, dryRun = false) => {
    setLoading(true);
    setError(null);
    try {
      const res = await api.post<{ run_id: string; status: string; message: string; dry_run: boolean }>(
        '/api/runs/trigger',
        { repo_id: repoId ?? null, dry_run: dryRun },
      );
      return res;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { trigger, loading, error };
}

export function useCancelRun() {
  const [cancelling, setCancelling] = useState<string | null>(null);

  const cancel = async (runId: string) => {
    setCancelling(runId);
    try {
      return await api.patch<RefactorRun>(`/api/runs/${runId}/cancel`, {});
    } catch {
      return null;
    } finally {
      setCancelling(null);
    }
  };

  return { cancel, cancelling };
}

export function useFunctionHistory(functionName: string | null, repoId?: string) {
  const [data, setData]       = useState<FunctionHistory | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!functionName) { setData(null); return; }
    setLoading(true);
    const params = new URLSearchParams({ function_name: functionName });
    if (repoId) params.set('repo_id', repoId);
    api.get<FunctionHistory>(`/api/runs/function-history?${params}`)
      .then(setData)
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [functionName, repoId]);

  return { data, loading };
}

export function useTestWebhook() {
  const [result, setResult]   = useState<{ success: boolean; message: string } | null>(null);
  const [loading, setLoading] = useState(false);

  const test = async () => {
    setLoading(true);
    setResult(null);
    try {
      const res = await api.post<{ success: boolean; message: string }>('/api/settings/test-webhook', {});
      setResult(res);
    } catch (e) {
      setResult({ success: false, message: (e as Error).message });
    } finally {
      setLoading(false);
    }
  };

  return { test, result, loading };
}

export function useConnectRepo() {
  const [loading, setLoading] = useState(false);
  const [error, setError]     = useState<string | null>(null);

  const connect = async (githubOwner: string, name: string, localPath?: string) => {
    setLoading(true);
    setError(null);
    try {
      const repo = await api.post<Repo>('/api/repos', {
        github_owner: githubOwner,
        name,
        local_path: localPath ?? null,
      });
      return repo;
    } catch (e) {
      setError((e as Error).message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { connect, loading, error };
}
