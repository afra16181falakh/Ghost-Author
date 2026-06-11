import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  GitBranch, Code2, AlertTriangle, TrendingDown, TrendingUp,
  Minus, X, RefreshCw, Search,
} from 'lucide-react';
import {
  LineChart, Line, Tooltip as RechartTooltip, ResponsiveContainer,
} from 'recharts';
import GhostAvatar from '../components/GhostAvatar';
import { useRuns, useHeatmap, useFunctionHistory } from '../api/hooks';
import type { HeatmapFile, HeatmapFunction } from '../types';

function complexityColor(c: number, fixed: boolean): { bg: string; text: string; label: string } {
  if (fixed) return { bg: 'rgba(16,185,129,0.15)', text: '#10b981', label: 'Fixed' };
  if (c >= 18) return { bg: 'rgba(239,68,68,0.18)',  text: '#ef4444', label: 'Critical' };
  if (c >= 12) return { bg: 'rgba(249,115,22,0.16)', text: '#f97316', label: 'High' };
  if (c >= 7)  return { bg: 'rgba(234,179,8,0.14)',  text: '#eab308', label: 'Medium' };
  return { bg: 'rgba(124,58,237,0.1)', text: '#a78bfa', label: 'Low' };
}

function fileMaxComplexity(functions: HeatmapFunction[]): number {
  return Math.max(0, ...functions.map(f => f.fixed ? 0 : f.cognitive));
}

// ── Sparkline for a single function's complexity history ─────────────────────
function FunctionSparkline({ name }: { name: string }) {
  const { data, loading } = useFunctionHistory(name);
  if (loading) return <div style={{ fontSize: 10, color: 'var(--text3)' }}>Loading history…</div>;
  if (!data || data.history.length < 2) return <div style={{ fontSize: 10, color: 'var(--text3)' }}>Not enough history yet.</div>;
  return (
    <div style={{ marginTop: 10 }}>
      <div style={{ fontSize: 10, color: 'var(--text3)', fontWeight: 600, marginBottom: 4 }}>Complexity trend</div>
      <ResponsiveContainer width="100%" height={48}>
        <LineChart data={data.history} margin={{ top: 2, bottom: 2, left: 0, right: 0 }}>
          <Line type="monotone" dataKey="cognitive" stroke="#a855f7" strokeWidth={2} dot={false} />
          <RechartTooltip
            contentStyle={{ background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 8, fontSize: 11 }}
            formatter={(v: number) => [v, 'cognitive']}
            labelFormatter={(_, p) => p[0]?.payload?.date ?? ''}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export default function Heatmap() {
  const { data: runs, refetch: refetchRuns } = useRuns({ status: 'success' });
  const { data: heatmapData, status: heatmapStatus, refetch: refetchHeatmap } = useHeatmap();
  const [selected, setSelected] = useState<HeatmapFile | null>(null);
  const [sortBy, setSortBy] = useState<'severity' | 'name' | 'functions'>('severity');
  const [filterText, setFilterText] = useState('');

  const handleRefresh = () => { refetchHeatmap(); refetchRuns(); };

  // Build a set of function names successfully fixed by the agent from run history
  const fixedFunctions = useMemo(() => {
    const names = new Set<string>();
    runs.forEach(run => run.smells.forEach(s => names.add(s.function_name)));
    return names;
  }, [runs]);

  // Overlay real fix data from run history onto heatmap entries
  const liveData = useMemo(() => heatmapData.map(file => ({
    ...file,
    functions: file.functions.map(fn => ({
      ...fn,
      fixed: fn.fixed || fixedFunctions.has(fn.name),
    })),
  })), [heatmapData, fixedFunctions]);

  const sorted = [...liveData]
    .filter(f => !filterText || f.path.toLowerCase().includes(filterText.toLowerCase()))
    .sort((a, b) => {
      if (sortBy === 'severity')  return fileMaxComplexity(b.functions) - fileMaxComplexity(a.functions);
      if (sortBy === 'functions') return b.functions.length - a.functions.length;
      return a.path.localeCompare(b.path);
    });

  const allFunctions = liveData.flatMap(f => f.functions);
  const totalFunctions = allFunctions.length;
  const critical = allFunctions.filter(f => f.cognitive >= 18 && !f.fixed).length;
  const high     = allFunctions.filter(f => f.cognitive >= 12 && f.cognitive < 18 && !f.fixed).length;
  const fixedCount = allFunctions.filter(f => f.fixed).length;

  return (
    <div style={{ padding: '88px 28px 48px', maxWidth: 1280, margin: '0 auto' }}>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: 20, display: 'flex', alignItems: 'center', gap: 16 }}>
        <GhostAvatar size={48} mood={heatmapStatus === 'loading' ? 'thinking' : 'idle'} />
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.8px' }}>
            Code Quality Heatmap
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text2)', marginTop: 2 }}>
            Repo-wide technical debt overview. Ghost-fixed functions update automatically from run history.
          </p>
        </div>
        <motion.button onClick={handleRefresh} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
          style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 16px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text2)', fontSize: 13, fontWeight: 600 }}>
          <RefreshCw size={14} /> Refresh
        </motion.button>
      </motion.div>

      {/* Loading skeleton */}
      {heatmapStatus === 'loading' && liveData.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
          {[1, 2, 3].map(i => (
            <div key={i} style={{ height: 72, borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border2)', animation: 'pulse 2s ease-in-out infinite' }} />
          ))}
        </div>
      )}

      {/* Summary bar */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 28 }}>
        {[
          { label: 'Total Functions', value: totalFunctions, color: '#a855f7' },
          { label: 'Critical (≥18)',  value: critical,       color: '#ef4444' },
          { label: 'High (12–17)',    value: high,           color: '#f97316' },
          { label: 'Ghost-Fixed',     value: fixedCount,     color: '#10b981' },
        ].map(({ label, value, color }) => (
          <motion.div key={label} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
            style={{ padding: '16px 20px', borderRadius: 14, background: 'var(--surface)', border: '1px solid var(--border2)', textAlign: 'center' }}>
            <div style={{ fontSize: 28, fontWeight: 900, color, letterSpacing: '-1px' }}>{value}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 500, marginTop: 4 }}>{label}</div>
          </motion.div>
        ))}
      </div>

      {/* Search filter */}
      <div style={{ position: 'relative', marginBottom: 14 }}>
        <Search size={13} style={{ position: 'absolute', left: 11, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
        <input
          value={filterText}
          onChange={e => setFilterText(e.target.value)}
          placeholder="Filter files by path…"
          style={{ width: '100%', padding: '8px 12px 8px 32px', background: 'var(--surface)', border: '1px solid var(--border2)', borderRadius: 10, color: 'var(--text)', fontSize: 13, outline: 'none', boxSizing: 'border-box' }}
        />
        {filterText && (
          <button onClick={() => setFilterText('')} style={{ position: 'absolute', right: 10, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }}>
            <X size={13} />
          </button>
        )}
      </div>

      {/* Sort controls + legend */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 600 }}>Sort by:</span>
        {(['severity', 'name', 'functions'] as const).map(s => (
          <motion.button key={s} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
            onClick={() => setSortBy(s)}
            style={{ padding: '5px 14px', borderRadius: 8, fontSize: 12, fontWeight: 600, background: sortBy === s ? 'linear-gradient(135deg, var(--accent), var(--accent2))' : 'var(--surface)', color: sortBy === s ? 'white' : 'var(--text2)', border: '1px solid var(--border2)', textTransform: 'capitalize' }}>
            {s}
          </motion.button>
        ))}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 12, alignItems: 'center' }}>
          {[
            { label: 'Critical', color: '#ef4444' },
            { label: 'High',     color: '#f97316' },
            { label: 'Medium',   color: '#eab308' },
            { label: 'Low',      color: '#a78bfa' },
            { label: 'Fixed',    color: '#10b981' },
          ].map(({ label, color }) => (
            <span key={label} style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 11, color: 'var(--text3)' }}>
              <span style={{ width: 8, height: 8, borderRadius: 2, background: color, display: 'inline-block' }} />
              {label}
            </span>
          ))}
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: selected ? '1fr 380px' : '1fr', gap: 20 }}>

        {/* File grid */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {sorted.map((file, fi) => {
            const maxC = fileMaxComplexity(file.functions);
            const allFixed = file.functions.every(f => f.fixed);
            const fileColor = allFixed ? complexityColor(0, true) : complexityColor(maxC, false);
            return (
              <motion.div key={file.path}
                initial={{ opacity: 0, x: -16 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: fi * 0.04 }}
                onClick={() => setSelected(selected?.path === file.path ? null : file)}
                whileHover={{ x: 3 }}
                style={{ borderRadius: 14, background: 'var(--surface)', border: `1px solid ${selected?.path === file.path ? fileColor.text : 'var(--border2)'}`, cursor: 'pointer', overflow: 'hidden', transition: 'border-color 0.2s', boxShadow: selected?.path === file.path ? `0 0 20px ${fileColor.text}20` : 'none' }}
              >
                <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
                  <div style={{ width: 10, height: 10, borderRadius: '50%', flexShrink: 0, background: fileColor.text, boxShadow: `0 0 8px ${fileColor.text}80` }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', fontFamily: 'JetBrains Mono, monospace', flex: 1 }}>{file.path}</span>
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>{file.functions.length} function{file.functions.length !== 1 ? 's' : ''}</span>
                  <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: fileColor.bg, color: fileColor.text }}>
                    {allFixed ? 'Fixed' : `max ${maxC}`}
                  </span>
                </div>
                <div style={{ padding: '0 16px 12px', display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {file.functions.map((fn: HeatmapFunction) => {
                    const fc = complexityColor(fn.cognitive, fn.fixed);
                    return (
                      <motion.div key={fn.name} whileHover={{ scale: 1.06 }}
                        title={`${fn.name}: cognitive ${fn.cognitive}, nesting ${fn.nesting}, ${fn.length} lines`}
                        style={{ padding: '4px 10px', borderRadius: 8, background: fc.bg, border: `1px solid ${fc.text}30`, fontSize: 11, fontFamily: 'JetBrains Mono, monospace', color: fc.text, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 5 }}>
                        {fn.fixed && <span style={{ fontSize: 8 }}>✓</span>}
                        {fn.name}
                        <span style={{ opacity: 0.7, fontWeight: 400 }}>{fn.cognitive}</span>
                      </motion.div>
                    );
                  })}
                </div>
              </motion.div>
            );
          })}
        </div>

        {/* Detail panel */}
        <AnimatePresence>
          {selected && (
            <motion.div key={selected.path}
              initial={{ opacity: 0, x: 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 24 }}
              style={{ borderRadius: 18, background: 'var(--surface)', border: '1px solid var(--border)', height: 'fit-content', position: 'sticky', top: 88, overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', background: 'var(--bg2)', borderBottom: '1px solid var(--border2)', display: 'flex', alignItems: 'center', gap: 10 }}>
                <GitBranch size={15} style={{ color: 'var(--accent2)' }} />
                <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', fontFamily: 'monospace', flex: 1, wordBreak: 'break-all' }}>{selected.path}</span>
                <motion.button whileHover={{ scale: 1.1, background: 'var(--surface2)' }} onClick={() => setSelected(null)} style={{ padding: 4, borderRadius: 6, color: 'var(--text3)' }}>
                  <X size={14} />
                </motion.button>
              </div>
              <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
                {selected.functions.map((fn: HeatmapFunction) => {
                  const fc = complexityColor(fn.cognitive, fn.fixed);
                  const trend = fn.cognitive >= 15 ? 'up' : fn.fixed ? 'down' : 'flat';
                  return (
                    <div key={fn.name} style={{ padding: '14px', borderRadius: 12, background: 'var(--bg2)', border: `1px solid ${fc.text}20` }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                        <Code2 size={13} style={{ color: fc.text }} />
                        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', fontFamily: 'monospace', flex: 1 }}>{fn.name}()</span>
                        {trend === 'up'   && <TrendingUp   size={13} style={{ color: '#ef4444' }} />}
                        {trend === 'down' && <TrendingDown size={13} style={{ color: '#10b981' }} />}
                        {trend === 'flat' && <Minus        size={13} style={{ color: 'var(--text3)' }} />}
                        {fn.fixed && (
                          <span style={{ fontSize: 10, padding: '2px 7px', borderRadius: 20, background: 'rgba(16,185,129,0.15)', color: '#10b981', fontWeight: 700 }}>
                            Ghost-Fixed
                          </span>
                        )}
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8 }}>
                        {[
                          { label: 'Cognitive', value: fn.cognitive, warn: fn.cognitive >= 15 },
                          { label: 'Nesting',   value: fn.nesting,   warn: fn.nesting >= 3 },
                          { label: 'Lines',     value: fn.length,    warn: fn.length >= 30 },
                        ].map(({ label, value, warn }) => (
                          <div key={label} style={{ textAlign: 'center', padding: '8px 4px', borderRadius: 8, background: 'var(--surface)' }}>
                            <div style={{ fontSize: 18, fontWeight: 800, color: warn ? '#f97316' : '#10b981' }}>{value}</div>
                            <div style={{ fontSize: 10, color: 'var(--text3)', marginTop: 2 }}>{label}</div>
                          </div>
                        ))}
                      </div>
                      {fn.cognitive >= 12 && !fn.fixed && (
                        <div style={{ marginTop: 10, display: 'flex', gap: 6, alignItems: 'center', fontSize: 11, color: '#f97316', background: 'rgba(249,115,22,0.08)', padding: '6px 10px', borderRadius: 8 }}>
                          <AlertTriangle size={11} />
                          Ghost Author will target this function on next run.
                        </div>
                      )}
                      <FunctionSparkline name={fn.name} />
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
