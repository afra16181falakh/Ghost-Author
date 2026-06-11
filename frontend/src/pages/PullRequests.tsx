import { motion } from 'framer-motion';
import { GitPullRequest, ExternalLink, CheckCircle2, Clock, Code2, Folder } from 'lucide-react';
import { useRuns } from '../api/hooks';
import GhostAvatar from '../components/GhostAvatar';

export default function PullRequests() {
  const { data: runs, status } = useRuns({ status: 'success' });
  const prRuns = runs.filter(r => r.pr_url);

  const avgAttempts = prRuns.length
    ? (prRuns.reduce((s, r) => s + r.attempts, 0) / prRuns.length).toFixed(1)
    : '—';

  const filesPatched = new Set(prRuns.map(r => r.filepath)).size;
  const reposCovered = new Set(prRuns.map(r => r.repo_id)).size;

  return (
    <div style={{ padding: '88px 28px 48px', maxWidth: 1100, margin: '0 auto' }}>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: 32, display: 'flex', alignItems: 'center', gap: 16 }}>
        <GhostAvatar size={48} mood="happy" />
        <div>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.8px', marginBottom: 4 }}>
            Pull Requests
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text2)' }}>
            Every successfully validated refactor, documented and ready to merge.
          </p>
        </div>
      </motion.div>

      {/* Summary strip */}
      <motion.div
        initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14, marginBottom: 28 }}
      >
        {[
          { label: 'Total PRs',     value: prRuns.length, color: '#a855f7', icon: GitPullRequest },
          { label: 'Files Patched', value: filesPatched,  color: '#10b981', icon: CheckCircle2 },
          { label: 'Repos Covered', value: reposCovered,  color: '#06b6d4', icon: Folder },
          { label: 'Avg Attempts',  value: avgAttempts,   color: '#f97316', icon: Clock },
        ].map(({ label, value, color, icon: Icon }) => (
          <div key={label} style={{
            padding: '18px 20px', borderRadius: 14,
            background: 'var(--surface)', border: '1px solid var(--border2)',
            display: 'flex', alignItems: 'center', gap: 12,
          }}>
            <div style={{
              width: 38, height: 38, borderRadius: 10,
              background: `${color}18`, border: `1px solid ${color}30`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Icon size={17} style={{ color }} />
            </div>
            <div>
              <div style={{ fontSize: 22, fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.5px', lineHeight: 1.1 }}>{value}</div>
              <div style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 500 }}>{label}</div>
            </div>
          </div>
        ))}
      </motion.div>

      {/* PR cards */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {prRuns.map((run, i) => (
          <motion.div
            key={run.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 + i * 0.07 }}
            whileHover={{ y: -2, boxShadow: '0 8px 32px rgba(124,58,237,0.15)' }}
            style={{
              borderRadius: 18, background: 'var(--surface)',
              border: '1px solid var(--border2)', overflow: 'hidden',
              transition: 'box-shadow 0.3s',
            }}
          >
            {/* Header row */}
            <div style={{
              padding: '20px 24px', display: 'flex', alignItems: 'flex-start',
              gap: 16, borderBottom: '1px solid var(--border2)',
            }}>
              <div style={{
                width: 42, height: 42, borderRadius: 11, flexShrink: 0,
                background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <GitPullRequest size={19} style={{ color: '#10b981' }} />
              </div>

              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 6, flexWrap: 'wrap' }}>
                  <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', letterSpacing: '-0.3px' }}>
                    refactor: resolve smells in{' '}
                    <span style={{ fontFamily: 'JetBrains Mono, monospace', color: 'var(--accent2)' }}>
                      {run.smells[0]?.function_name ?? 'unknown'}()
                    </span>
                  </h3>
                  <span style={{
                    fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
                    background: 'rgba(16,185,129,0.12)', color: '#10b981', letterSpacing: '0.3px',
                  }}>
                    draft
                  </span>
                </div>
                <div style={{ display: 'flex', gap: 12, fontSize: 12, color: 'var(--text3)', flexWrap: 'wrap', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'monospace' }}>{run.repo ?? run.repo_id?.slice(0, 8) ?? 'local'}/{run.filepath}</span>
                  <span>·</span>
                  <span style={{ fontFamily: 'monospace', fontSize: 11 }}>{run.branch ?? '—'}</span>
                  <span>·</span>
                  <span>{run.started_at.split('T')[0]}</span>
                  <span>·</span>
                  <span>{run.attempts} AI attempt{run.attempts !== 1 ? 's' : ''}</span>
                  {run.duration_sec != null && (
                    <>
                      <span>·</span>
                      <span>{run.duration_sec.toFixed(1)}s</span>
                    </>
                  )}
                </div>
              </div>

              <motion.a
                href={run.pr_url!} target="_blank" rel="noreferrer"
                whileHover={{ scale: 1.05, boxShadow: '0 4px 20px rgba(16,185,129,0.4)' }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 6,
                  padding: '9px 18px', borderRadius: 10, flexShrink: 0,
                  background: 'linear-gradient(135deg, #059669, #10b981)',
                  color: 'white', fontSize: 12, fontWeight: 700,
                  boxShadow: '0 2px 12px rgba(16,185,129,0.3)',
                }}
              >
                <ExternalLink size={12} />
                Open PR
              </motion.a>
            </div>

            {/* Smell tags */}
            <div style={{
              padding: '12px 24px', display: 'flex', gap: 8,
              flexWrap: 'wrap', background: 'var(--bg2)',
              borderBottom: '1px solid var(--border2)', alignItems: 'center',
            }}>
              <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 600 }}>Addressed:</span>
              {run.smells.flatMap(s => s.smells).map((s, idx) => (
                <span key={idx} style={{
                  fontSize: 10, padding: '3px 10px', borderRadius: 20,
                  background: 'rgba(124,58,237,0.12)', color: 'var(--accent3)',
                  fontWeight: 600, fontFamily: 'monospace',
                }}>
                  {s.type}
                </span>
              ))}
            </div>

            {/* Diff preview */}
            {run.diff && (
              <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                  <Code2 size={13} style={{ color: 'var(--accent2)' }} />
                  <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)' }}>Code Diff</span>
                </div>
                <pre style={{
                  background: 'var(--bg2)', borderRadius: 10, padding: '14px',
                  fontSize: 11, fontFamily: 'JetBrains Mono, monospace',
                  overflowX: 'auto', lineHeight: 1.7, maxHeight: 200, overflow: 'auto',
                  border: '1px solid var(--border2)', color: 'var(--text2)',
                }}>
                  {run.diff.split('\n').slice(0, 24).map((line, idx) => (
                    <span key={idx} style={{
                      display: 'block',
                      color: line.startsWith('+') ? '#10b981' : line.startsWith('-') ? '#ef4444' : line.startsWith('@@') ? '#a855f7' : 'var(--text2)',
                      background: line.startsWith('+') ? 'rgba(16,185,129,0.06)' : line.startsWith('-') ? 'rgba(239,68,68,0.06)' : 'transparent',
                    }}>
                      {line || ' '}
                    </span>
                  ))}
                </pre>
              </div>
            )}

            {/* Test result footer */}
            <div style={{ padding: '12px 24px 16px', display: 'flex', alignItems: 'center', gap: 10 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 6,
                fontSize: 12, fontWeight: 600, color: '#10b981',
                background: 'rgba(16,185,129,0.1)', padding: '5px 14px', borderRadius: 20,
              }}>
                <CheckCircle2 size={12} />
                {run.test_output ?? 'Tests passed'}
              </div>
              <div style={{ fontSize: 11, color: 'var(--text3)' }}>
                Validated in {run.attempts} attempt{run.attempts !== 1 ? 's' : ''}
              </div>
            </div>
          </motion.div>
        ))}

        {/* Empty state */}
        {status !== 'loading' && prRuns.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{
              textAlign: 'center', padding: '80px 0',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
            }}
          >
            <GhostAvatar size={72} mood="idle" />
            <div>
              <p style={{ fontSize: 16, fontWeight: 600, color: 'var(--text2)', marginBottom: 6 }}>
                No pull requests yet.
              </p>
              <p style={{ fontSize: 13, color: 'var(--text3)' }}>
                Trigger a run — when Ghost Author successfully refactors and tests pass, a PR will appear here.
              </p>
            </div>
          </motion.div>
        )}

        {/* Loading state */}
        {status === 'loading' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {[1, 2].map(i => (
              <div key={i} style={{
                height: 160, borderRadius: 18, background: 'var(--surface)',
                border: '1px solid var(--border2)',
                animation: 'pulse 2s ease-in-out infinite',
              }} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
