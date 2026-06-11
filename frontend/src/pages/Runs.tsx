import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Search, Filter, GitPullRequest, AlertTriangle,
  CheckCircle2, XCircle, Clock, ChevronDown, ChevronUp,
  Code2, Zap, WifiOff, Ban, GitMerge, FlaskConical,
} from 'lucide-react';
import { useRuns, useCancelRun } from '../api/hooks';
import type { RefactorRun } from '../types';
import LiveTerminal from '../components/LiveTerminal';

const statusConfig: Record<string, { icon: React.ElementType; color: string; bg: string; label: string }> = {
  success:   { icon: CheckCircle2, color: '#10b981', bg: 'rgba(16,185,129,0.1)',  label: 'Success' },
  failed:    { icon: XCircle,      color: '#ef4444', bg: 'rgba(239,68,68,0.1)',   label: 'Failed' },
  running:   { icon: Zap,          color: '#a855f7', bg: 'rgba(168,85,247,0.1)',  label: 'Running' },
  pending:   { icon: Clock,        color: '#eab308', bg: 'rgba(234,179,8,0.1)',   label: 'Pending' },
  cancelled: { icon: Ban,          color: '#6b7280', bg: 'rgba(107,114,128,0.1)', label: 'Cancelled' },
};

// ── Side-by-side diff renderer ────────────────────────────────────────────────

type DiffLineType = 'ctx' | 'del' | 'add' | 'empty' | 'hdr';
interface DiffLine { text: string; type: DiffLineType }
interface DiffRow { left: DiffLine; right: DiffLine }

function parseSideBySide(diffText: string): DiffRow[] {
  const rows: DiffRow[] = [];
  const lines = diffText.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    if (line.startsWith('---') || line.startsWith('+++') || line.startsWith('diff ')) { i++; continue; }
    if (line.startsWith('@@')) {
      rows.push({ left: { text: line, type: 'hdr' }, right: { text: line, type: 'hdr' } });
      i++; continue;
    }
    if (line.startsWith('-') || line.startsWith('+')) {
      const dels: string[] = [];
      const adds: string[] = [];
      while (i < lines.length && (lines[i].startsWith('-') || lines[i].startsWith('+'))) {
        if (lines[i].startsWith('-')) dels.push(lines[i].slice(1));
        else adds.push(lines[i].slice(1));
        i++;
      }
      const maxLen = Math.max(dels.length, adds.length);
      for (let j = 0; j < maxLen; j++) {
        rows.push({
          left:  j < dels.length ? { text: dels[j], type: 'del' }   : { text: '', type: 'empty' },
          right: j < adds.length ? { text: adds[j], type: 'add' }   : { text: '', type: 'empty' },
        });
      }
      continue;
    }
    const text = line.startsWith(' ') ? line.slice(1) : line;
    rows.push({ left: { text, type: 'ctx' }, right: { text, type: 'ctx' } });
    i++;
  }
  return rows;
}

const diffBg   = (t: DiffLineType) => t === 'del' ? 'rgba(239,68,68,0.12)' : t === 'add' ? 'rgba(16,185,129,0.1)' : t === 'empty' ? 'rgba(0,0,0,0.03)' : 'transparent';
const diffColor = (t: DiffLineType) => t === 'del' ? '#ef4444' : t === 'add' ? '#10b981' : 'var(--text2)';

function SideBySideDiff({ diff }: { diff: string }) {
  const rows = parseSideBySide(diff);
  return (
    <div style={{ fontFamily: 'JetBrains Mono, monospace', fontSize: 11.5, border: '1px solid var(--border2)', borderRadius: 10, overflow: 'hidden' }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', background: 'var(--bg2)', borderBottom: '1px solid var(--border2)' }}>
        <div style={{ padding: '6px 12px', fontSize: 11, fontWeight: 700, color: '#ef4444', borderRight: '1px solid var(--border2)' }}>Before</div>
        <div style={{ padding: '6px 12px', fontSize: 11, fontWeight: 700, color: '#10b981' }}>After</div>
      </div>
      <div style={{ maxHeight: 480, overflowY: 'auto' }}>
        {rows.map((row, i) =>
          row.left.type === 'hdr' ? (
            <div key={i} style={{ padding: '3px 12px', background: 'rgba(168,85,247,0.08)', color: '#a855f7', fontSize: 11 }}>
              {row.left.text}
            </div>
          ) : (
            <div key={i} style={{ display: 'grid', gridTemplateColumns: '1fr 1fr' }}>
              <div style={{ padding: '1px 12px', background: diffBg(row.left.type), color: diffColor(row.left.type), borderRight: '1px solid var(--border2)', whiteSpace: 'pre', lineHeight: 1.7, minHeight: 22 }}>
                {row.left.type === 'del' && <span style={{ opacity: 0.5, userSelect: 'none', marginRight: 4 }}>−</span>}
                {row.left.text}
              </div>
              <div style={{ padding: '1px 12px', background: diffBg(row.right.type), color: diffColor(row.right.type), whiteSpace: 'pre', lineHeight: 1.7, minHeight: 22 }}>
                {row.right.type === 'add' && <span style={{ opacity: 0.5, userSelect: 'none', marginRight: 4 }}>+</span>}
                {row.right.text}
              </div>
            </div>
          )
        )}
      </div>
    </div>
  );
}

function RunDetail({ run }: { run: RefactorRun }) {
  const defaultTab = run.status === 'running' ? 'live' : 'smells';
  const [tab, setTab] = useState<'diff' | 'tests' | 'smells' | 'live'>(defaultTab);
  return (
    <motion.div
      initial={{ opacity: 0, height: 0 }}
      animate={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0 }}
      transition={{ duration: 0.3 }}
      style={{ overflow: 'hidden' }}
    >
      <div style={{ padding: '0 24px 20px', borderTop: '1px solid var(--border2)' }}>
        {/* Tabs */}
        <div style={{ display: 'flex', gap: 4, margin: '16px 0 14px', borderBottom: '1px solid var(--border2)', paddingBottom: 0 }}>
          {(run.status === 'running' ? ['live', 'smells', 'diff', 'tests'] : ['smells', 'diff', 'tests'] as const).map((t: any) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              style={{
                padding: '7px 16px', borderRadius: '8px 8px 0 0', fontSize: 12,
                fontWeight: 600, background: tab === t ? 'var(--surface2)' : 'transparent',
                color: tab === t ? 'var(--accent2)' : 'var(--text3)',
                borderBottom: tab === t ? '2px solid var(--accent2)' : '2px solid transparent',
                transition: 'all 0.2s', textTransform: 'capitalize',
              }}
            >
              {t === 'live' ? '🔴 Live' : t === 'smells' ? 'Smells' : t === 'diff' ? 'Code Diff' : 'Test Output'}
            </button>
          ))}
        </div>

        {tab === 'live' && (
          <LiveTerminal runId={run.id} initialStatus={run.status} />
        )}

        {tab === 'smells' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {run.smells.map(smell => (
              <div key={smell.function_name} style={{ padding: '14px', borderRadius: 10, background: 'var(--bg2)', border: '1px solid var(--border2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <Code2 size={14} style={{ color: 'var(--accent2)' }} />
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', fontFamily: 'JetBrains Mono, monospace' }}>
                    {smell.function_name}()
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--text3)' }}>lines {smell.start_line}–{smell.end_line}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 10 }}>
                  <div style={{ textAlign: 'center', padding: '8px', borderRadius: 8, background: 'var(--surface)' }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: smell.nesting_depth > 2 ? '#ef4444' : '#10b981' }}>{smell.nesting_depth}</div>
                    <div style={{ fontSize: 10, color: 'var(--text3)' }}>Nesting</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '8px', borderRadius: 8, background: 'var(--surface)' }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: smell.length > 15 ? '#ef4444' : '#10b981' }}>{smell.length}</div>
                    <div style={{ fontSize: 10, color: 'var(--text3)' }}>Lines</div>
                  </div>
                  <div style={{ textAlign: 'center', padding: '8px', borderRadius: 8, background: 'var(--surface)' }}>
                    <div style={{ fontSize: 18, fontWeight: 800, color: smell.cognitive_complexity > 15 ? '#ef4444' : '#10b981' }}>{smell.cognitive_complexity}</div>
                    <div style={{ fontSize: 10, color: 'var(--text3)' }}>Complexity</div>
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {smell.smells.map(s => (
                    <div key={s.type} style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                      <AlertTriangle size={12} style={{ color: '#f97316', flexShrink: 0, marginTop: 2 }} />
                      <div>
                        <span style={{ fontSize: 11, fontWeight: 700, color: '#f97316', fontFamily: 'monospace', marginRight: 6 }}>{s.type}</span>
                        <span style={{ fontSize: 12, color: 'var(--text2)' }}>{s.msg}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {tab === 'diff' && (
          run.diff
            ? <SideBySideDiff diff={run.diff} />
            : <div style={{ padding: '24px', textAlign: 'center', color: 'var(--text3)', fontSize: 13 }}>No diff available yet.</div>
        )}

        {tab === 'tests' && (
          <pre style={{
            background: 'var(--bg2)', borderRadius: 10, padding: '16px',
            fontSize: 12, fontFamily: 'JetBrains Mono, monospace',
            color: run.test_output?.includes('passed') ? '#10b981' : run.test_output ? '#ef4444' : 'var(--text3)',
            border: '1px solid var(--border2)', lineHeight: 1.7,
          }}>
            {run.test_output || 'Waiting for test results...'}
          </pre>
        )}
      </div>
    </motion.div>
  );
}

export default function Runs() {
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<string>('all');
  const [expanded, setExpanded] = useState<string | null>(null);
  const { data: allRuns, status, refetch } = useRuns();
  const { cancel, cancelling } = useCancelRun();

  const filtered = allRuns.filter(r => {
    const repoLabel = r.repo ?? r.repo_id;
    const matchSearch = r.filepath.toLowerCase().includes(search.toLowerCase()) ||
      repoLabel.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter === 'all' || r.status === filter;
    return matchSearch && matchFilter;
  });

  return (
    <div style={{ padding: '88px 28px 48px', maxWidth: 1100, margin: '0 auto' }}>
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }} style={{ marginBottom: 28 }}>
        <h1 style={{ fontSize: 26, fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.8px', marginBottom: 6 }}>
          Refactor Runs
        </h1>
        <p style={{ fontSize: 14, color: 'var(--text2)' }}>Every refactoring attempt, with full details on smells, diffs, and test outcomes.</p>
      </motion.div>

      {/* Controls */}
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        style={{ display: 'flex', gap: 12, marginBottom: 20, flexWrap: 'wrap' }}
      >
        <div style={{ position: 'relative', flex: 1, minWidth: 200 }}>
          <Search size={14} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
          <input
            value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search by file or repo..."
            style={{
              width: '100%', padding: '9px 12px 9px 36px',
              background: 'var(--surface)', border: '1px solid var(--border2)',
              borderRadius: 10, color: 'var(--text)', fontSize: 13,
              outline: 'none',
            }}
          />
        </div>
        <div style={{ display: 'flex', gap: 6 }}>
          {['all', 'success', 'failed', 'running', 'cancelled'].map(s => (
            <motion.button
              key={s}
              whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
              onClick={() => setFilter(s)}
              style={{
                padding: '8px 16px', borderRadius: 10, fontSize: 12, fontWeight: 600,
                background: filter === s ? 'linear-gradient(135deg, var(--accent), var(--accent2))' : 'var(--surface)',
                color: filter === s ? 'white' : 'var(--text2)',
                border: '1px solid var(--border2)',
                textTransform: 'capitalize',
              }}
            >
              {s}
            </motion.button>
          ))}
        </div>
      </motion.div>

      {/* Run list */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <AnimatePresence>
          {filtered.map((run, i) => {
            const s = statusConfig[run.status];
            const Icon = s.icon;
            const isOpen = expanded === run.id;
            return (
              <motion.div
                key={run.id}
                layout
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ delay: i * 0.04 }}
                style={{
                  borderRadius: 16, background: 'var(--surface)',
                  border: `1px solid ${isOpen ? 'var(--border)' : 'var(--border2)'}`,
                  overflow: 'hidden',
                  transition: 'border-color 0.2s',
                }}
              >
                {/* Run header */}
                <motion.div
                  onClick={() => setExpanded(isOpen ? null : run.id)}
                  whileHover={{ background: 'var(--surface2)' }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 14, padding: '16px 24px',
                    cursor: 'pointer', transition: 'background 0.2s',
                  }}
                >
                  {/* Status icon */}
                  <div style={{
                    width: 36, height: 36, borderRadius: 10, flexShrink: 0,
                    background: s.bg, display: 'flex', alignItems: 'center', justifyContent: 'center',
                  }}>
                    {run.status === 'running' ? (
                      <motion.div animate={{ rotate: 360 }} transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}>
                        <Icon size={16} style={{ color: s.color }} />
                      </motion.div>
                    ) : <Icon size={16} style={{ color: s.color }} />}
                  </div>

                  {/* File + smells */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 4 }}>
                      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)', fontFamily: 'JetBrains Mono, monospace' }}>
                        {run.filepath}
                      </span>
                      <span style={{ fontSize: 11, padding: '2px 8px', borderRadius: 20, background: 'var(--surface2)', color: 'var(--text3)', fontWeight: 500 }}>
                        {run.repo ?? run.repo_id?.slice(0, 8) ?? 'local'}
                      </span>
                    </div>
                    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {run.smells[0]?.smells.map(sm => (
                        <span key={sm.type} style={{
                          fontSize: 10, padding: '2px 8px', borderRadius: 20,
                          background: 'rgba(124,58,237,0.1)', color: 'var(--accent3)',
                          fontWeight: 600, fontFamily: 'monospace',
                        }}>
                          {sm.type}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Meta */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
                    <div style={{ textAlign: 'right' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5, justifyContent: 'flex-end', marginBottom: 3 }}>
                        {run.dry_run && (
                          <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20, background: 'rgba(6,182,212,0.12)', color: '#06b6d4', display: 'flex', alignItems: 'center', gap: 3 }}>
                            <FlaskConical size={9} /> Dry Run
                          </span>
                        )}
                        <div style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: s.bg, color: s.color }}>
                          {s.label}
                        </div>
                      </div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                        {run.attempts} attempt{run.attempts !== 1 ? 's' : ''} · {run.started_at.split('T')[0]}
                      </div>
                    </div>
                    {run.pr_url && (
                      <a
                        href={run.pr_url} target="_blank" rel="noreferrer"
                        onClick={e => e.stopPropagation()}
                        style={{
                          display: 'flex', alignItems: 'center', gap: 4,
                          fontSize: 11, fontWeight: 700,
                          color: run.pr_merged ? '#a855f7' : '#10b981',
                          background: run.pr_merged ? 'rgba(168,85,247,0.12)' : 'rgba(16,185,129,0.1)',
                          padding: '5px 10px', borderRadius: 8,
                        }}
                      >
                        {run.pr_merged ? <GitMerge size={11} /> : <GitPullRequest size={11} />}
                        {run.pr_merged ? 'Merged' : 'PR'}
                      </a>
                    )}
                    {(run.status === 'running' || run.status === 'pending') && (
                      <motion.button
                        whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.94 }}
                        onClick={e => { e.stopPropagation(); cancel(run.id).then(() => refetch()); }}
                        disabled={cancelling === run.id}
                        style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#ef4444', background: 'rgba(239,68,68,0.1)', padding: '5px 10px', borderRadius: 8 }}
                      >
                        <Ban size={11} />Cancel
                      </motion.button>
                    )}
                    {isOpen ? <ChevronUp size={16} style={{ color: 'var(--text3)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text3)' }} />}
                  </div>
                </motion.div>

                {/* Expandable detail */}
                <AnimatePresence>
                  {isOpen && <RunDetail key="detail" run={run} />}
                </AnimatePresence>
              </motion.div>
            );
          })}
        </AnimatePresence>

        {filtered.length === 0 && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text3)' }}>
            <Filter size={32} style={{ margin: '0 auto 12px', opacity: 0.4 }} />
            <p style={{ fontSize: 15 }}>No runs match your filter.</p>
          </motion.div>
        )}
      </div>
    </div>
  );
}
