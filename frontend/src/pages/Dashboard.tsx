import { motion, AnimatePresence } from 'framer-motion';
import {
  Activity, Zap, GitPullRequest, CheckCircle2, XCircle,
  TrendingUp, Clock, Code2, RefreshCw, ChevronRight,
  AlertTriangle, WifiOff, Loader2,
} from 'lucide-react';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis,
  Tooltip, ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';
import GhostAvatar from '../components/GhostAvatar';
import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useMetrics, useRuns, useRepos, useTrigger, useHeatmap } from '../api/hooks';
import { useAuth } from '../AuthContext';

// ── Helpers ───────────────────────────────────────────────────────────────────

function calcDebtScore(heatmap: ReturnType<typeof useHeatmap>['data']) {
  const fns = heatmap.flatMap(f => f.functions);
  if (!fns.length) return { score: 100, label: 'No data', color: '#6b7280' };
  const weighted = fns.reduce((sum, f) => {
    if (f.fixed) return sum;
    if (f.cognitive >= 18) return sum + 4;
    if (f.cognitive >= 12) return sum + 2;
    if (f.cognitive >= 7)  return sum + 1;
    return sum + 0.25;
  }, 0);
  const max    = fns.length * 4;
  const debt   = Math.min(100, Math.round((weighted / max) * 100));
  const health = 100 - debt;
  const label  = health >= 80 ? 'Healthy' : health >= 60 ? 'Fair' : health >= 40 ? 'Needs Work' : 'Critical';
  const color  = health >= 80 ? '#10b981' : health >= 60 ? '#eab308' : health >= 40 ? '#f97316' : '#ef4444';
  return { score: health, label, color };
}

function getGreeting() {
  const h = new Date().getHours();
  if (h >= 5  && h < 12) return { salutation: 'Good morning',   emoji: '🌅', sub: 'Ghost Author has been busy while you were away.' };
  if (h >= 12 && h < 17) return { salutation: 'Good afternoon', emoji: '☀️', sub: "Here's what's happened since this morning." };
  if (h >= 17 && h < 21) return { salutation: 'Good evening',   emoji: '🌆', sub: "Here's your end-of-day summary." };
  return                         { salutation: 'Good night',     emoji: '🌙', sub: "Working late? Here's what Ghost Author's been up to." };
}

const statusColors = {
  success:   { color: '#10b981', bg: 'rgba(16,185,129,0.12)',  label: 'Success'   },
  failed:    { color: '#ef4444', bg: 'rgba(239,68,68,0.12)',   label: 'Failed'    },
  running:   { color: '#a855f7', bg: 'rgba(168,85,247,0.12)', label: 'Running'   },
  pending:   { color: '#eab308', bg: 'rgba(234,179,8,0.12)',   label: 'Pending'   },
  cancelled: { color: '#6b7280', bg: 'rgba(107,114,128,0.12)', label: 'Cancelled' },
};

const PIE_COLORS = ['#7c3aed', '#06b6d4', '#f97316', '#10b981', '#ef4444'];

// ── Sub-components ────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon: Icon, color, delay = 0, loading }: {
  label: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string; delay?: number; loading?: boolean;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
      transition={{ delay, duration: 0.5 }}
      whileHover={{ y: -3, boxShadow: `0 12px 32px ${color}25` }}
      style={{ padding: '22px 24px', borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border2)', transition: 'box-shadow 0.3s' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{ width: 40, height: 40, borderRadius: 11, background: `${color}18`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={18} style={{ color }} />
        </div>
        {sub && !loading && (
          <span style={{ fontSize: 11, color: '#10b981', fontWeight: 600, background: 'rgba(16,185,129,0.1)', padding: '2px 8px', borderRadius: 20 }}>
            {sub}
          </span>
        )}
      </div>
      {loading ? (
        <div style={{ height: 36, background: 'var(--border2)', borderRadius: 8, marginBottom: 6, animation: 'pulse 1.5s infinite' }} />
      ) : (
        <div style={{ fontSize: 30, fontWeight: 900, color: 'var(--text)', letterSpacing: '-1px', lineHeight: 1.1 }}>{value}</div>
      )}
      <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 4, fontWeight: 500 }}>{label}</div>
    </motion.div>
  );
}

const CustomTooltipArea = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 10, padding: '10px 14px', fontSize: 12 }}>
      <p style={{ color: 'var(--text2)', marginBottom: 4 }}>{label}</p>
      {payload.map((p: any) => (
        <p key={p.name} style={{ color: p.color, fontWeight: 600 }}>{p.name}: {p.value}</p>
      ))}
    </div>
  );
};

function EmptyState({ message, icon: Icon = Activity }: { message: string; icon?: React.ElementType }) {
  return (
    <div style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text3)' }}>
      <Icon size={32} style={{ marginBottom: 12, opacity: 0.4 }} />
      <p style={{ fontSize: 13, fontWeight: 500 }}>{message}</p>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Dashboard() {
  const [ghostMood, setGhostMood] = useState<'idle' | 'thinking' | 'happy' | 'alert'>('idle');

  const { data: m,     status: metricsStatus, refetch: refetchMetrics } = useMetrics();
  const { data: runs,  status: runsStatus,    refetch: refetchRuns }    = useRuns();
  const { data: repos, status: reposStatus,   refetch: refetchRepos }   = useRepos();
  const { trigger, loading: triggering } = useTrigger();
  const { user } = useAuth();
  const { data: heatmapData } = useHeatmap();

  const greeting    = getGreeting();
  const name        = user?.name ?? user?.login ?? 'Developer';
  const debt        = calcDebtScore(heatmapData);
  const metricsLoading = metricsStatus === 'loading';
  const apiDown     = metricsStatus === 'error' && runsStatus === 'error' && reposStatus === 'error';

  const handleRefresh = () => {
    setGhostMood('thinking');
    Promise.all([refetchMetrics(), refetchRuns(), refetchRepos()])
      .finally(() => setGhostMood('idle'));
  };

  return (
    <div style={{ padding: '88px 28px 48px', maxWidth: 1280, margin: '0 auto' }}>

      {/* ── API down banner ─────────────────────────────────────────────────── */}
      <AnimatePresence>
        {apiDown && (
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -10 }}
            style={{ marginBottom: 20, padding: '12px 20px', borderRadius: 12, background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.25)', display: 'flex', alignItems: 'center', gap: 10 }}
          >
            <WifiOff size={16} style={{ color: '#ef4444', flexShrink: 0 }} />
            <span style={{ fontSize: 13, fontWeight: 600, color: '#ef4444' }}>API unreachable — is the backend running on port 8000?</span>
            <motion.button onClick={handleRefresh} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
              style={{ marginLeft: 'auto', fontSize: 12, padding: '4px 12px', borderRadius: 8, background: 'rgba(239,68,68,0.15)', color: '#ef4444', border: '1px solid rgba(239,68,68,0.3)', fontWeight: 600 }}>
              Retry
            </motion.button>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Header ──────────────────────────────────────────────────────────── */}
      <motion.div
        initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}
        style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32, flexWrap: 'wrap', gap: 16 }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <motion.div onHoverStart={() => setGhostMood('thinking')} onHoverEnd={() => setGhostMood('idle')}>
            <GhostAvatar size={56} mood={ghostMood} />
          </motion.div>
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.8px' }}>
              {greeting.salutation}, {name} {greeting.emoji}
            </h1>
            <p style={{ fontSize: 14, color: 'var(--text2)', marginTop: 2 }}>{greeting.sub}</p>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <motion.button whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }} onClick={handleRefresh}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text2)', fontSize: 13, fontWeight: 600 }}>
            <RefreshCw size={14} />
            Refresh
          </motion.button>
          <motion.button
            whileHover={{ scale: 1.04, boxShadow: '0 0 24px var(--glow)' }} whileTap={{ scale: 0.96 }}
            onClick={async () => { setGhostMood('thinking'); await trigger(); setGhostMood('happy'); }}
            disabled={triggering}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 18px', borderRadius: 10, background: 'linear-gradient(135deg, var(--accent), var(--accent2))', color: 'white', fontSize: 13, fontWeight: 700, boxShadow: '0 4px 16px var(--glow)', opacity: triggering ? 0.7 : 1 }}>
            {triggering ? <Loader2 size={14} style={{ animation: 'spin 1s linear infinite' }} /> : <Zap size={14} />}
            {triggering ? 'Running...' : 'Trigger Run'}
          </motion.button>
        </div>
      </motion.div>

      {/* ── Code health + stat cards ─────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 16, marginBottom: 28 }}>

        {/* Code Health ring */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
          style={{ padding: 20, borderRadius: 16, background: 'var(--surface)', border: `1px solid ${debt.color}30`, gridColumn: 'span 2', display: 'flex', alignItems: 'center', gap: 20 }}>
          <div style={{ position: 'relative', width: 72, height: 72, flexShrink: 0 }}>
            <svg viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)', width: 72, height: 72 }}>
              <circle cx="18" cy="18" r="15.9" fill="none" stroke="var(--border2)" strokeWidth="3" />
              <circle cx="18" cy="18" r="15.9" fill="none" stroke={debt.color} strokeWidth="3"
                strokeDasharray={`${debt.score} 100`} strokeLinecap="round" />
            </svg>
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 15, fontWeight: 900, color: debt.color }}>
              {debt.score}
            </div>
          </div>
          <div>
            <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text3)', marginBottom: 2 }}>Code Health</div>
            <div style={{ fontSize: 22, fontWeight: 900, color: debt.color, letterSpacing: '-0.5px' }}>{debt.label}</div>
            <div style={{ fontSize: 12, color: 'var(--text3)', marginTop: 3 }}>
              {heatmapData.length === 0
                ? 'Run a scan to see your code health'
                : `Based on ${heatmapData.flatMap(f => f.functions).length} functions across ${heatmapData.length} files`}
            </div>
          </div>
        </motion.div>

        <StatCard icon={Activity}       label="Total Runs"     value={m.total_runs}     sub="All time"              color="#7c3aed" delay={0}    loading={metricsLoading} />
        <StatCard icon={Code2}          label="Smells Found"   value={m.issues_found}                               color="#06b6d4" delay={0.06} loading={metricsLoading} />
        <StatCard icon={CheckCircle2}   label="Fixes Passed"   value={m.fixes_passed}   sub={`${m.success_rate}%`} color="#10b981" delay={0.12} loading={metricsLoading} />
        <StatCard icon={XCircle}        label="Fixes Failed"   value={m.fixes_failed}                               color="#ef4444" delay={0.18} loading={metricsLoading} />
        <StatCard icon={GitPullRequest} label="PRs Generated"  value={m.prs_generated}                              color="#f97316" delay={0.24} loading={metricsLoading} />
        <StatCard icon={Clock}          label="Avg Fix Time"   value={`${m.avg_time_sec}s`}                         color="#a855f7" delay={0.30} loading={metricsLoading} />
        <StatCard icon={TrendingUp}     label="Avg Attempts"   value={m.avg_attempts}                               color="#eab308" delay={0.36} loading={metricsLoading} />
        <StatCard icon={Zap}            label="Success Rate"   value={`${m.success_rate}%`}                         color="#ec4899" delay={0.42} loading={metricsLoading} />
      </div>

      {/* ── Charts row ───────────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 20, marginBottom: 28 }}>

        {/* Area chart — Weekly Activity */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
          style={{ padding: 24, borderRadius: 18, background: 'var(--surface)', border: '1px solid var(--border2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Weekly Activity</h3>
              <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Smells found vs fixed this week</p>
            </div>
            <div style={{ display: 'flex', gap: 14, fontSize: 12 }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text2)' }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: '#7c3aed', display: 'inline-block' }} />Found
              </span>
              <span style={{ display: 'flex', alignItems: 'center', gap: 5, color: 'var(--text2)' }}>
                <span style={{ width: 8, height: 8, borderRadius: 2, background: '#10b981', display: 'inline-block' }} />Fixed
              </span>
            </div>
          </div>
          {m.weekly_trend.length === 0 ? (
            <EmptyState message="No weekly data yet — trigger a run to start tracking." icon={TrendingUp} />
          ) : (
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={m.weekly_trend} margin={{ left: -10 }}>
                <defs>
                  <linearGradient id="gFound" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#7c3aed" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#7c3aed" stopOpacity={0} />
                  </linearGradient>
                  <linearGradient id="gFixed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tick={{ fill: 'var(--text3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltipArea />} />
                <Area type="monotone" dataKey="found" stroke="#7c3aed" strokeWidth={2} fill="url(#gFound)" name="Found" />
                <Area type="monotone" dataKey="fixed" stroke="#10b981" strokeWidth={2} fill="url(#gFixed)" name="Fixed" />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        {/* Pie — Smell Breakdown */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }}
          style={{ padding: 24, borderRadius: 18, background: 'var(--surface)', border: '1px solid var(--border2)' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Smell Breakdown</h3>
          <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 16 }}>Distribution by type</p>
          {m.smell_breakdown.length === 0 ? (
            <EmptyState message="No smell data yet." icon={Code2} />
          ) : (
            <>
              <ResponsiveContainer width="100%" height={140}>
                <PieChart>
                  <Pie data={m.smell_breakdown} dataKey="count" innerRadius={38} outerRadius={62} paddingAngle={3}>
                    {m.smell_breakdown.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                </PieChart>
              </ResponsiveContainer>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
                {m.smell_breakdown.map(({ type, count }, i) => (
                  <div key={type} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                      <div style={{ width: 8, height: 8, borderRadius: 2, background: PIE_COLORS[i % PIE_COLORS.length] }} />
                      <span style={{ fontSize: 12, color: 'var(--text2)' }}>{type}</span>
                    </div>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{count}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </motion.div>
      </div>

      {/* ── Bar chart + repos ─────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 28 }}>

        {/* Bar — Fixes per Day */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.45 }}
          style={{ padding: 24, borderRadius: 18, background: 'var(--surface)', border: '1px solid var(--border2)' }}>
          <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 4 }}>Fixes per Day</h3>
          <p style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 20 }}>Successful refactors this week</p>
          {m.weekly_trend.length === 0 ? (
            <EmptyState message="No data yet." />
          ) : (
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={m.weekly_trend} margin={{ left: -10 }}>
                <defs>
                  <linearGradient id="bFixed" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#a855f7" />
                    <stop offset="100%" stopColor="#7c3aed" />
                  </linearGradient>
                </defs>
                <XAxis dataKey="day" tick={{ fill: 'var(--text3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fill: 'var(--text3)', fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip contentStyle={{ background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 8, fontSize: 12 }} />
                <Bar dataKey="fixed" fill="url(#bFixed)" radius={[5, 5, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </motion.div>

        {/* Repos quick view */}
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.5 }}
          style={{ padding: 24, borderRadius: 18, background: 'var(--surface)', border: '1px solid var(--border2)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
            <div>
              <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Repositories</h3>
              <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Monitored repos</p>
            </div>
            <Link to="/repos" style={{ fontSize: 12, color: 'var(--accent2)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
              Manage <ChevronRight size={12} />
            </Link>
          </div>
          {reposStatus === 'loading' ? (
            <div style={{ display: 'flex', justifyContent: 'center', padding: 24 }}>
              <Loader2 size={20} style={{ color: 'var(--text3)', animation: 'spin 1s linear infinite' }} />
            </div>
          ) : repos.length === 0 ? (
            <EmptyState message="No repositories connected yet. Go to Settings to connect one." />
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {repos.map(repo => (
                <div key={repo.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', borderRadius: 10, background: 'var(--bg2)', border: '1px solid var(--border2)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <div style={{ width: 8, height: 8, borderRadius: '50%', background: repo.status === 'active' ? '#10b981' : repo.status === 'paused' ? '#eab308' : '#6b7280', boxShadow: repo.status === 'active' ? '0 0 6px #10b981' : 'none' }} />
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{repo.github_owner}/{repo.name}</div>
                      <div style={{ fontSize: 11, color: 'var(--text3)' }}>Last run: {repo.last_run_at ? new Date(repo.last_run_at).toLocaleString() : 'Never'}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--accent2)' }}>{repo.total_fixes} fixes</span>
                    <span style={{ fontSize: 10, fontWeight: 600, padding: '2px 8px', borderRadius: 20, background: repo.status === 'active' ? 'rgba(16,185,129,0.12)' : repo.status === 'paused' ? 'rgba(234,179,8,0.12)' : 'rgba(107,114,128,0.12)', color: repo.status === 'active' ? '#10b981' : repo.status === 'paused' ? '#eab308' : '#9ca3af' }}>
                      {repo.status}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </motion.div>
      </div>

      {/* ── Recent runs ──────────────────────────────────────────────────────── */}
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.55 }}
        style={{ borderRadius: 18, background: 'var(--surface)', border: '1px solid var(--border2)', overflow: 'hidden' }}>
        <div style={{ padding: '20px 24px', borderBottom: '1px solid var(--border2)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Recent Runs</h3>
            <p style={{ fontSize: 12, color: 'var(--text3)', marginTop: 2 }}>Latest refactoring activity</p>
          </div>
          <Link to="/runs" style={{ fontSize: 12, color: 'var(--accent2)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 3 }}>
            View all <ChevronRight size={12} />
          </Link>
        </div>

        {runsStatus === 'loading' ? (
          <div style={{ display: 'flex', justifyContent: 'center', padding: 40 }}>
            <Loader2 size={24} style={{ color: 'var(--text3)', animation: 'spin 1s linear infinite' }} />
          </div>
        ) : runs.length === 0 ? (
          <EmptyState message='No runs yet. Click "Trigger Run" or push code to a connected repo.' icon={Zap} />
        ) : (
          runs.slice(0, 8).map((run, i) => {
            const s = statusColors[run.status as keyof typeof statusColors] ?? statusColors.failed;
            return (
              <motion.div
                key={run.id}
                initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.6 + i * 0.06 }}
                whileHover={{ background: 'var(--surface2)' }}
                style={{ display: 'flex', alignItems: 'center', gap: 16, padding: '14px 24px', borderBottom: i < runs.length - 1 ? '1px solid var(--border2)' : 'none', transition: 'background 0.2s', cursor: 'pointer' }}
              >
                {/* Status dot */}
                <div style={{ width: 8, height: 8, borderRadius: '50%', flexShrink: 0, background: s.color, boxShadow: run.status === 'running' ? `0 0 8px ${s.color}` : 'none' }}>
                  {run.status === 'running' && (
                    <motion.div animate={{ scale: [1, 2, 1], opacity: [0.8, 0, 0.8] }} transition={{ duration: 1.5, repeat: Infinity }}
                      style={{ width: '100%', height: '100%', borderRadius: '50%', background: s.color }} />
                  )}
                </div>

                {/* File + smells */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                    <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', fontFamily: 'JetBrains Mono, monospace', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {run.filepath}
                    </span>
                    {run.repo_id && (
                      <span style={{ fontSize: 11, color: 'var(--text3)', flexShrink: 0 }}>
                        repo: {(run.repo_id ?? '').slice(0, 8)}
                      </span>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                    {run.smells[0]?.smells.slice(0, 3).map(sm => (
                      <span key={sm.type} style={{ fontSize: 10, padding: '1px 7px', borderRadius: 20, background: 'rgba(124,58,237,0.1)', color: 'var(--accent3)', fontWeight: 600, fontFamily: 'JetBrains Mono, monospace' }}>
                        {sm.type}
                      </span>
                    ))}
                  </div>
                </div>

                {/* Status badge */}
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px', borderRadius: 20, background: s.bg, color: s.color, marginBottom: 4 }}>
                    {run.status === 'running' ? (
                      <motion.span animate={{ opacity: [1, 0.5, 1] }} transition={{ duration: 1, repeat: Infinity }}>Running…</motion.span>
                    ) : s.label}
                  </div>
                  <div style={{ fontSize: 11, color: 'var(--text3)' }}>{run.attempts} attempt{run.attempts !== 1 ? 's' : ''}</div>
                </div>

                {/* PR link */}
                {run.pr_url && (
                  <motion.a href={run.pr_url} target="_blank" rel="noreferrer" whileHover={{ scale: 1.1 }}
                    style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, fontWeight: 700, color: '#10b981', background: 'rgba(16,185,129,0.1)', padding: '4px 10px', borderRadius: 8, flexShrink: 0 }}>
                    <GitPullRequest size={11} />
                    PR
                  </motion.a>
                )}

                {run.status === 'failed' && <AlertTriangle size={15} style={{ color: '#ef4444', flexShrink: 0 }} />}
              </motion.div>
            );
          })
        )}
      </motion.div>
    </div>
  );
}
