import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Github, Plus, Trash2, Play, Pause, GitBranch,
  CheckCircle2, AlertTriangle, Loader2, RefreshCw, X,
  FolderGit2, Clock, BarChart3,
} from 'lucide-react';
import GhostAvatar from '../components/GhostAvatar';
import { useRepos, useConnectRepo, useTrigger } from '../api/hooks';
import { api } from '../api/client';
import type { Repo } from '../types';

function statusColor(status: Repo['status']): { bg: string; text: string } {
  if (status === 'active') return { bg: 'rgba(168,85,247,0.12)', text: '#a855f7' };
  if (status === 'paused') return { bg: 'rgba(234,179,8,0.12)',  text: '#eab308' };
  return { bg: 'rgba(16,185,129,0.12)', text: '#10b981' };
}

function formatTime(iso: string | null): string {
  if (!iso) return 'Never';
  const d = new Date(iso);
  const diff = Date.now() - d.getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1)  return 'Just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

// ── Connect form ──────────────────────────────────────────────────────────────

function ConnectForm({ onDone }: { onDone: () => void }) {
  const { connect, loading, error } = useConnectRepo();
  const [owner, setOwner]   = useState('');
  const [name, setName]     = useState('');
  const [path, setPath]     = useState('');
  const [done, setDone]     = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const repo = await connect(owner.trim(), name.trim(), path.trim() || undefined);
    if (repo) { setDone(true); setTimeout(onDone, 800); }
  };

  const inputStyle = {
    width: '100%', padding: '9px 14px',
    background: 'var(--bg2)', border: '1px solid var(--border2)',
    borderRadius: 10, color: 'var(--text)', fontSize: 13, outline: 'none',
  };

  return (
    <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>
            GitHub Owner <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input
            required value={owner} onChange={e => setOwner(e.target.value)}
            placeholder="your-username" style={inputStyle}
            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            onBlur={e => e.target.style.borderColor = 'var(--border2)'}
          />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>
            Repository Name <span style={{ color: '#ef4444' }}>*</span>
          </label>
          <input
            required value={name} onChange={e => setName(e.target.value)}
            placeholder="my-repo" style={inputStyle}
            onFocus={e => e.target.style.borderColor = 'var(--accent)'}
            onBlur={e => e.target.style.borderColor = 'var(--border2)'}
          />
        </div>
      </div>
      <div>
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text2)', display: 'block', marginBottom: 6 }}>
          Local Path <span style={{ fontSize: 11, color: 'var(--text3)', fontWeight: 400 }}>(optional — for local scan)</span>
        </label>
        <input
          value={path} onChange={e => setPath(e.target.value)}
          placeholder="/home/user/projects/my-repo" style={{ ...inputStyle, fontFamily: 'JetBrains Mono, monospace' }}
          onFocus={e => e.target.style.borderColor = 'var(--accent)'}
          onBlur={e => e.target.style.borderColor = 'var(--border2)'}
        />
      </div>
      {error && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: '#ef4444', background: 'rgba(239,68,68,0.08)', padding: '8px 12px', borderRadius: 8 }}>
          <AlertTriangle size={12} /> {error}
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10 }}>
        <motion.button type="button" onClick={onDone} whileHover={{ scale: 1.03 }} whileTap={{ scale: 0.97 }}
          style={{ padding: '9px 18px', borderRadius: 10, border: '1px solid var(--border2)', background: 'var(--surface)', color: 'var(--text2)', fontSize: 13, fontWeight: 600 }}>
          Cancel
        </motion.button>
        <motion.button type="submit" disabled={loading || done} whileHover={{ scale: loading || done ? 1 : 1.04 }} whileTap={{ scale: loading || done ? 1 : 0.96 }}
          style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 22px', borderRadius: 10, background: done ? 'linear-gradient(135deg, #059669, #10b981)' : 'linear-gradient(135deg, var(--accent), var(--accent2))', color: 'white', fontSize: 13, fontWeight: 700, opacity: loading ? 0.8 : 1 }}>
          {loading ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}><Loader2 size={14} /></motion.div>
           : done ? <CheckCircle2 size={14} /> : <Github size={14} />}
          {loading ? 'Connecting…' : done ? 'Connected!' : 'Connect Repository'}
        </motion.button>
      </div>
    </form>
  );
}

// ── Repo card ─────────────────────────────────────────────────────────────────

function RepoCard({ repo, onRefresh }: { repo: Repo; onRefresh: () => void }) {
  const { trigger, loading: running } = useTrigger();
  const [pausing, setPausing] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const colors = statusColor(repo.status);

  const handleRun = async () => {
    await trigger(repo.id);
    setTimeout(onRefresh, 1000);
  };

  const handlePause = async () => {
    setPausing(true);
    try { await api.patch(`/api/repos/${repo.id}/pause`, {}); onRefresh(); }
    finally { setPausing(false); }
  };

  const handleDelete = async () => {
    setDeleting(true);
    try { await api.delete(`/api/repos/${repo.id}`); onRefresh(); }
    finally { setDeleting(false); setConfirmDelete(false); }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
      style={{ borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border2)', overflow: 'hidden' }}
    >
      {/* Header */}
      <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14 }}>
        <div style={{ width: 40, height: 40, borderRadius: 12, background: 'rgba(168,85,247,0.1)', border: '1px solid rgba(168,85,247,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <FolderGit2 size={18} style={{ color: '#a855f7' }} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--text)', fontFamily: 'JetBrains Mono, monospace' }}>
              {repo.full_name}
            </span>
            <span style={{ fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20, background: colors.bg, color: colors.text, textTransform: 'capitalize' }}>
              {repo.status}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginTop: 4 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text3)' }}>
              <Clock size={10} /> {formatTime(repo.last_run_at)}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: 'var(--text3)' }}>
              <GitBranch size={10} /> {repo.total_runs} run{repo.total_runs !== 1 ? 's' : ''}
            </span>
            <span style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 11, color: '#10b981' }}>
              <BarChart3 size={10} /> {repo.total_fixes} fix{repo.total_fixes !== 1 ? 'es' : ''}
            </span>
          </div>
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <motion.button onClick={handleRun} disabled={running || repo.status === 'paused'}
            whileHover={{ scale: running ? 1 : 1.05 }} whileTap={{ scale: 0.95 }}
            title="Run agent on this repo"
            style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 12px', borderRadius: 9, background: 'linear-gradient(135deg, var(--accent), var(--accent2))', color: 'white', fontSize: 11, fontWeight: 700, opacity: (running || repo.status === 'paused') ? 0.6 : 1 }}>
            {running
              ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}><Loader2 size={12} /></motion.div>
              : <Play size={12} />}
            Run
          </motion.button>
          <motion.button onClick={handlePause} disabled={pausing}
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            title={repo.status === 'paused' ? 'Resume' : 'Pause'}
            style={{ width: 32, height: 32, borderRadius: 9, border: '1px solid var(--border2)', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: repo.status === 'paused' ? '#10b981' : 'var(--text3)' }}>
            {pausing ? <Loader2 size={13} className="animate-spin" /> : repo.status === 'paused' ? <Play size={13} /> : <Pause size={13} />}
          </motion.button>
          <motion.button onClick={() => setConfirmDelete(true)}
            whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            title="Remove repo"
            style={{ width: 32, height: 32, borderRadius: 9, border: '1px solid rgba(239,68,68,0.25)', background: 'rgba(239,68,68,0.08)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#ef4444' }}>
            <Trash2 size={13} />
          </motion.button>
        </div>
      </div>

      {/* Delete confirmation */}
      <AnimatePresence>
        {confirmDelete && (
          <motion.div
            initial={{ height: 0, opacity: 0 }} animate={{ height: 'auto', opacity: 1 }} exit={{ height: 0, opacity: 0 }}
            style={{ overflow: 'hidden', borderTop: '1px solid rgba(239,68,68,0.2)', background: 'rgba(239,68,68,0.05)' }}
          >
            <div style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 12, color: '#ef4444', fontWeight: 600 }}>Remove <strong>{repo.full_name}</strong> from Ghost Author?</span>
              <div style={{ display: 'flex', gap: 8 }}>
                <motion.button onClick={() => setConfirmDelete(false)} whileHover={{ scale: 1.04 }}
                  style={{ padding: '5px 12px', borderRadius: 8, border: '1px solid var(--border2)', background: 'var(--surface)', color: 'var(--text2)', fontSize: 12, fontWeight: 600 }}>
                  Cancel
                </motion.button>
                <motion.button onClick={handleDelete} disabled={deleting} whileHover={{ scale: 1.04 }}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 12px', borderRadius: 8, background: '#ef4444', color: 'white', fontSize: 12, fontWeight: 700, opacity: deleting ? 0.7 : 1 }}>
                  {deleting ? <Loader2 size={11} /> : <Trash2 size={11} />}
                  {deleting ? 'Removing…' : 'Remove'}
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function Repos() {
  const { data: repos, status, refetch } = useRepos();
  const [showForm, setShowForm] = useState(false);

  const handleDone = () => { setShowForm(false); refetch(); };

  return (
    <div style={{ padding: '88px 28px 48px', maxWidth: 900, margin: '0 auto' }}>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: 28, display: 'flex', alignItems: 'center', gap: 16 }}>
        <GhostAvatar size={48} mood={status === 'loading' ? 'thinking' : 'idle'} />
        <div style={{ flex: 1 }}>
          <h1 style={{ fontSize: 26, fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.8px' }}>
            Repositories
          </h1>
          <p style={{ fontSize: 14, color: 'var(--text2)', marginTop: 2 }}>
            Connect GitHub repos for Ghost Author to monitor and refactor automatically.
          </p>
        </div>
        <div style={{ display: 'flex', gap: 10 }}>
          <motion.button onClick={refetch} whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}
            style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '8px 14px', borderRadius: 10, border: '1px solid var(--border)', background: 'var(--surface)', color: 'var(--text2)', fontSize: 12, fontWeight: 600 }}>
            <RefreshCw size={13} /> Refresh
          </motion.button>
          <motion.button onClick={() => setShowForm(v => !v)} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
            style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '8px 18px', borderRadius: 10, background: showForm ? 'var(--surface)' : 'linear-gradient(135deg, var(--accent), var(--accent2))', border: showForm ? '1px solid var(--border2)' : 'none', color: showForm ? 'var(--text2)' : 'white', fontSize: 13, fontWeight: 700, boxShadow: showForm ? 'none' : '0 4px 14px var(--glow)' }}>
            {showForm ? <X size={14} /> : <Plus size={14} />}
            {showForm ? 'Cancel' : 'Connect Repo'}
          </motion.button>
        </div>
      </motion.div>

      {/* Connect form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.98 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: -12, scale: 0.98 }}
            style={{ marginBottom: 24, padding: '24px', borderRadius: 18, background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 8px 32px rgba(0,0,0,0.2)' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 20 }}>
              <Github size={18} style={{ color: '#a855f7' }} />
              <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>Connect a Repository</h2>
            </div>
            <ConnectForm onDone={handleDone} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Loading */}
      {status === 'loading' && repos.length === 0 && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {[1, 2].map(i => (
            <div key={i} style={{ height: 88, borderRadius: 16, background: 'var(--surface)', border: '1px solid var(--border2)', animation: 'pulse 2s ease-in-out infinite' }} />
          ))}
        </div>
      )}

      {/* Repo list */}
      {repos.length > 0 ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {repos.map(repo => (
            <RepoCard key={repo.id} repo={repo} onRefresh={refetch} />
          ))}
        </div>
      ) : status === 'success' ? (
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          style={{ textAlign: 'center', padding: '60px 24px', borderRadius: 18, background: 'var(--surface)', border: '1px solid var(--border2)' }}>
          <GhostAvatar size={64} mood="idle" />
          <div style={{ marginTop: 16, fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
            No repositories connected
          </div>
          <div style={{ fontSize: 13, color: 'var(--text3)', marginBottom: 20 }}>
            Connect a GitHub repo to start automated code quality monitoring.
          </div>
          <motion.button onClick={() => setShowForm(true)} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 7, padding: '10px 24px', borderRadius: 12, background: 'linear-gradient(135deg, var(--accent), var(--accent2))', color: 'white', fontSize: 13, fontWeight: 700, boxShadow: '0 4px 14px var(--glow)' }}>
            <Plus size={15} /> Connect your first repo
          </motion.button>
        </motion.div>
      ) : null}
    </div>
  );
}
