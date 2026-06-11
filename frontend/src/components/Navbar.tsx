import { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Sun, Moon, Zap, LayoutDashboard, GitPullRequest,
  Settings, Activity, Map, FolderGit2, Loader2, Menu, X,
  LogIn, LogOut, FlaskConical,
} from 'lucide-react';
import { useTheme } from '../ThemeContext';
import { useAuth } from '../AuthContext';
import GhostAvatar from './GhostAvatar';
import { useTrigger } from '../api/hooks';
import LiveTerminal from './LiveTerminal';
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts';

function UserMenu() {
  const { user, loading, login, logout } = useAuth();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const close = () => setOpen(false);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [open]);

  if (loading) return null;

  if (!user) {
    return (
      <motion.button onClick={login} whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 9, border: '1px solid var(--border2)', background: 'var(--surface)', color: 'var(--text2)', fontSize: 12, fontWeight: 600 }}>
        <LogIn size={13} />
        Sign in
      </motion.button>
    );
  }

  const initials = (user.name ?? user.login).slice(0, 2).toUpperCase();

  return (
    <div style={{ position: 'relative' }}>
      <motion.button
        onClick={e => { e.stopPropagation(); setOpen(o => !o); }}
        whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
        style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '5px 10px', borderRadius: 9, border: '1px solid var(--border2)', background: 'var(--surface)', color: 'var(--text)', fontSize: 12, fontWeight: 600 }}>
        {user.avatar_url
          ? <img src={user.avatar_url} alt={user.login} style={{ width: 22, height: 22, borderRadius: '50%' }} />
          : <div style={{ width: 22, height: 22, borderRadius: '50%', background: 'linear-gradient(135deg, var(--accent), var(--accent2))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 9, fontWeight: 800, color: 'white' }}>{initials}</div>
        }
        <span style={{ maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {user.name ?? user.login}
        </span>
      </motion.button>

      <AnimatePresence>
        {open && (
          <motion.div onClick={e => e.stopPropagation()}
            initial={{ opacity: 0, y: 6, scale: 0.95 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 6, scale: 0.95 }}
            style={{ position: 'absolute', right: 0, top: 'calc(100% + 8px)', minWidth: 160, borderRadius: 12, background: 'var(--surface)', border: '1px solid var(--border2)', boxShadow: '0 8px 32px rgba(0,0,0,0.3)', overflow: 'hidden', zIndex: 300 }}>
            <div style={{ padding: '12px 14px', borderBottom: '1px solid var(--border2)' }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text)' }}>{user.name ?? user.login}</div>
              {user.email && <div style={{ fontSize: 11, color: 'var(--text3)', marginTop: 2 }}>{user.email}</div>}
            </div>
            <button onClick={() => { setOpen(false); logout(); }}
              style={{ width: '100%', padding: '10px 14px', display: 'flex', alignItems: 'center', gap: 8, fontSize: 12, fontWeight: 600, color: '#ef4444', background: 'transparent', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
              <LogOut size={12} />
              Sign out
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

const navLinks = [
  { to: '/dashboard', label: 'Dashboard', icon: LayoutDashboard, key: 'D' },
  { to: '/runs',      label: 'Runs',       icon: Activity,        key: 'U' },
  { to: '/pulls',     label: 'PRs',        icon: GitPullRequest,  key: 'P' },
  { to: '/repos',     label: 'Repos',      icon: FolderGit2,      key: 'W' },
  { to: '/heatmap',   label: 'Heatmap',    icon: Map,             key: 'H' },
  { to: '/settings',  label: 'Settings',   icon: Settings,        key: 'S' },
];

export default function Navbar() {
  const { theme, toggle }                    = useTheme();
  const { pathname }                         = useLocation();
  const { trigger, loading }                 = useTrigger();
  const [runId, setRunId]                    = useState<string | null>(null);
  const [showTerminal, setShowTerminal]      = useState(false);
  const [mobileOpen, setMobileOpen]          = useState(false);
  const [isMobile, setIsMobile]             = useState(window.innerWidth < 900);

  // Responsive breakpoint
  useEffect(() => {
    const handler = () => setIsMobile(window.innerWidth < 900);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  // Close mobile menu on route change
  useEffect(() => { setMobileOpen(false); }, [pathname]);

  const handleRun = async (dryRun = false) => {
    const res = await trigger(undefined, dryRun);
    if (res?.run_id) {
      setRunId(res.run_id);
      setShowTerminal(true);
    }
  };

  useKeyboardShortcuts({
    onRunNow:        () => handleRun(false),
    onCloseTerminal: () => setShowTerminal(false),
  });

  return (
    <>
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        borderBottom: '1px solid var(--border2)',
        backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)',
        background: theme === 'dark' ? 'rgba(13,13,20,0.92)' : 'rgba(248,247,255,0.92)',
      }}>
        <nav style={{ maxWidth: 1280, margin: '0 auto', padding: '0 24px', height: 64, display: 'flex', alignItems: 'center', gap: 8 }}>

          {/* Logo */}
          <Link to="/" style={{ display: 'flex', alignItems: 'center', gap: 10, marginRight: 16 }}>
            <GhostAvatar size={34} mood="idle" />
            <span style={{ fontSize: 17, fontWeight: 800, letterSpacing: '-0.5px', background: 'linear-gradient(135deg, #c084fc, #7c3aed)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Ghost Author
            </span>
            <span style={{ fontSize: 9, fontWeight: 700, background: 'var(--accent)', color: 'white', padding: '2px 6px', borderRadius: 5, letterSpacing: '0.5px', textTransform: 'uppercase' }}>
              AI
            </span>
          </Link>

          {/* Desktop nav links */}
          {!isMobile && (
            <div style={{ display: 'flex', gap: 2, flex: 1 }}>
              {navLinks.map(({ to, label, icon: Icon, key }) => {
                const active = pathname.startsWith(to);
                return (
                  <Link key={to} to={to} title={`${label} (${key})`}>
                    <motion.div whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.96 }}
                      style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 9, fontSize: 13, fontWeight: active ? 700 : 500, color: active ? 'white' : 'var(--text2)', background: active ? 'linear-gradient(135deg, var(--accent), var(--accent2))' : 'transparent', transition: 'all 0.2s', boxShadow: active ? '0 2px 12px var(--glow)' : 'none' }}>
                      <Icon size={14} />
                      {label}
                    </motion.div>
                  </Link>
                );
              })}
            </div>
          )}

          {/* Spacer on mobile */}
          {isMobile && <div style={{ flex: 1 }} />}

          {/* Right side */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>

            {/* Agent status pill — desktop only */}
            {!isMobile && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '5px 11px', borderRadius: 20, border: '1px solid var(--border)', background: loading ? 'rgba(168,85,247,0.1)' : 'rgba(16,185,129,0.1)', fontSize: 11, fontWeight: 600, color: loading ? 'var(--accent2)' : 'var(--green)' }}>
                <motion.div style={{ width: 6, height: 6, borderRadius: '50%', background: loading ? 'var(--accent2)' : 'var(--green)' }} animate={{ opacity: [1, 0.3, 1] }} transition={{ duration: loading ? 0.8 : 2, repeat: Infinity }} />
                {loading ? 'Running…' : 'Agent Active'}
              </div>
            )}

            {/* Theme toggle */}
            <motion.button onClick={toggle} whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
              style={{ width: 34, height: 34, borderRadius: 9, border: '1px solid var(--border2)', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text2)' }}>
              {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
            </motion.button>

            {/* Run Now + Dry Run buttons — desktop */}
            {!isMobile && (
              <>
                <motion.button onClick={() => handleRun(true)} disabled={loading} title="Dry Run — analysis only, no commits"
                  whileHover={{ scale: loading ? 1 : 1.04 }} whileTap={{ scale: loading ? 1 : 0.96 }}
                  style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '7px 13px', borderRadius: 9, background: 'var(--surface)', border: '1px solid var(--border2)', color: 'var(--text2)', fontSize: 12, fontWeight: 600, opacity: loading ? 0.6 : 1 }}>
                  <FlaskConical size={13} />
                  Dry Run
                </motion.button>
                <motion.button onClick={() => handleRun(false)} disabled={loading} title="Run Now (R)"
                  whileHover={{ scale: loading ? 1 : 1.04, boxShadow: loading ? 'none' : '0 0 24px var(--glow)' }}
                  whileTap={{ scale: loading ? 1 : 0.96 }}
                  style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '7px 15px', borderRadius: 9, background: loading ? 'var(--surface2)' : 'linear-gradient(135deg, var(--accent), var(--accent2))', color: loading ? 'var(--text3)' : 'white', fontSize: 12, fontWeight: 700, boxShadow: loading ? 'none' : '0 4px 14px var(--glow)', opacity: loading ? 0.8 : 1 }}>
                  {loading
                    ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}><Loader2 size={13} /></motion.div>
                    : <Zap size={13} />
                  }
                  {loading ? 'Running…' : 'Run Now'}
                </motion.button>
              </>
            )}

            {/* User auth menu */}
            {!isMobile && <UserMenu />}

            {/* Mobile hamburger */}
            {isMobile && (
              <motion.button onClick={() => setMobileOpen(o => !o)} whileHover={{ scale: 1.08 }} whileTap={{ scale: 0.95 }}
                style={{ width: 34, height: 34, borderRadius: 9, border: '1px solid var(--border2)', background: 'var(--surface)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text2)' }}>
                {mobileOpen ? <X size={16} /> : <Menu size={16} />}
              </motion.button>
            )}
          </div>
        </nav>

        {/* Mobile menu dropdown */}
        <AnimatePresence>
          {isMobile && mobileOpen && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              style={{ overflow: 'hidden', borderTop: '1px solid var(--border2)', background: theme === 'dark' ? 'rgba(13,13,20,0.98)' : 'rgba(248,247,255,0.98)' }}
            >
              <div style={{ padding: '12px 20px 16px', display: 'flex', flexDirection: 'column', gap: 4 }}>
                {navLinks.map(({ to, label, icon: Icon }) => {
                  const active = pathname.startsWith(to);
                  return (
                    <Link key={to} to={to}>
                      <motion.div whileTap={{ scale: 0.97 }}
                        style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, fontSize: 14, fontWeight: active ? 700 : 500, color: active ? 'white' : 'var(--text2)', background: active ? 'linear-gradient(135deg, var(--accent), var(--accent2))' : 'transparent' }}>
                        <Icon size={16} />
                        {label}
                      </motion.div>
                    </Link>
                  );
                })}
                <motion.button onClick={() => handleRun(false)} disabled={loading} whileTap={{ scale: 0.97 }}
                  style={{ marginTop: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px', borderRadius: 10, background: loading ? 'var(--surface2)' : 'linear-gradient(135deg, var(--accent), var(--accent2))', color: loading ? 'var(--text3)' : 'white', fontSize: 14, fontWeight: 700 }}>
                  {loading ? <Loader2 size={14} /> : <Zap size={14} />}
                  {loading ? 'Running…' : 'Run Now'}
                </motion.button>
                <motion.button onClick={() => handleRun(true)} disabled={loading} whileTap={{ scale: 0.97 }}
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '11px', borderRadius: 10, background: 'var(--surface)', border: '1px solid var(--border2)', color: 'var(--text2)', fontSize: 14, fontWeight: 600 }}>
                  <FlaskConical size={14} />
                  Dry Run
                </motion.button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </header>

      {/* Live Terminal overlay */}
      <AnimatePresence>
        {showTerminal && runId && (
          <motion.div
            initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 24 }}
            style={{ position: 'fixed', bottom: 24, right: 24, width: isMobile ? 'calc(100vw - 48px)' : 560, zIndex: 200, borderRadius: 16, overflow: 'hidden', boxShadow: '0 24px 80px rgba(0,0,0,0.6), 0 0 40px var(--glow)' }}
          >
            <div style={{ padding: '8px 14px', background: 'var(--surface)', borderBottom: '1px solid var(--border2)', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text2)' }}>🔮 Ghost Author — Live Run</span>
              <motion.button onClick={() => setShowTerminal(false)} title="Close (Esc)" whileHover={{ scale: 1.1 }}
                style={{ fontSize: 18, color: 'var(--text3)', lineHeight: 1, padding: '2px 6px', borderRadius: 6 }}>
                ×
              </motion.button>
            </div>
            <LiveTerminal runId={runId} initialStatus="pending" />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
