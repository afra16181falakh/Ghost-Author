import { useNavigate } from 'react-router-dom';
import { motion, useScroll, useTransform } from 'framer-motion';
import { useRef, useState } from 'react';
import {
  Zap, GitPullRequest, ShieldCheck,
  Code2, Brain, TestTube2, GitBranch,
  ChevronRight, Star, Activity, Mail, User, Lock, Eye, EyeOff,
  Sun, Moon,
} from 'lucide-react';
import GhostAvatar from '../components/GhostAvatar';
import { useTheme } from '../ThemeContext';

// ── Auth Section ─────────────────────────────────────────────────────────────

function AuthSection() {
  const navigate = useNavigate();
  const [tab, setTab]         = useState<'login' | 'signup'>('login');
  const [name, setName]       = useState('');
  const [email, setEmail]     = useState('');
  const [password, setPassword] = useState('');
  const [showPw, setShowPw]   = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setTimeout(() => { navigate('/dashboard'); }, 800);
  };

  const inp = {
    width: '100%', padding: '11px 14px 11px 40px',
    background: 'var(--bg2)', border: '1px solid var(--border2)',
    borderRadius: 12, color: 'var(--text)', fontSize: 14, outline: 'none',
    transition: 'border-color 0.2s',
  } as React.CSSProperties;

  return (
    <section style={{ padding: '100px 24px', background: 'var(--bg2)' }}>
      <div style={{ maxWidth: 480, margin: '0 auto' }}>
        <motion.div
          initial={{ opacity: 0, y: 28 }} whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          style={{ borderRadius: 24, background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 24px 80px rgba(0,0,0,0.25)', overflow: 'hidden' }}
        >
          {/* Tab bar */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', borderBottom: '1px solid var(--border2)' }}>
            {(['login', 'signup'] as const).map(t => (
              <button key={t} onClick={() => setTab(t)}
                style={{ padding: '18px', fontSize: 14, fontWeight: 700, letterSpacing: '-0.2px', color: tab === t ? 'white' : 'var(--text3)', background: tab === t ? 'linear-gradient(135deg, var(--accent), var(--accent2))' : 'transparent', transition: 'all 0.2s' }}>
                {t === 'login' ? 'Sign In' : 'Create Account'}
              </button>
            ))}
          </div>

          {/* Form */}
          <div style={{ padding: '36px 32px' }}>
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <GhostAvatar size={52} mood={loading ? 'thinking' : 'happy'} />
              <div style={{ marginTop: 12, fontSize: 20, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.5px' }}>
                {tab === 'login' ? 'Welcome back' : 'Get started free'}
              </div>
              <div style={{ fontSize: 13, color: 'var(--text3)', marginTop: 4 }}>
                {tab === 'login' ? 'Sign in to your Ghost Author workspace' : 'Create your Ghost Author account'}
              </div>
            </div>

            <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              {tab === 'signup' && (
                <div style={{ position: 'relative' }}>
                  <User size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
                  <input required value={name} onChange={e => setName(e.target.value)}
                    placeholder="Full name" style={inp}
                    onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                    onBlur={e => e.target.style.borderColor = 'var(--border2)'}
                  />
                </div>
              )}

              <div style={{ position: 'relative' }}>
                <Mail size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
                <input required type="email" value={email} onChange={e => setEmail(e.target.value)}
                  placeholder="Email address" style={inp}
                  onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border2)'}
                />
              </div>

              <div style={{ position: 'relative' }}>
                <Lock size={15} style={{ position: 'absolute', left: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
                <input required type={showPw ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                  placeholder="Password" style={{ ...inp, paddingRight: 44 }}
                  onFocus={e => e.target.style.borderColor = 'var(--accent)'}
                  onBlur={e => e.target.style.borderColor = 'var(--border2)'}
                />
                <button type="button" onClick={() => setShowPw(s => !s)}
                  style={{ position: 'absolute', right: 13, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }}>
                  {showPw ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>

              <motion.button type="submit" disabled={loading}
                whileHover={{ scale: loading ? 1 : 1.03, boxShadow: loading ? 'none' : '0 8px 32px rgba(124,58,237,0.4)' }}
                whileTap={{ scale: loading ? 1 : 0.97 }}
                style={{ marginTop: 6, padding: '13px', borderRadius: 12, background: 'linear-gradient(135deg, var(--accent), var(--accent2))', color: 'white', fontSize: 14, fontWeight: 700, boxShadow: '0 4px 20px rgba(124,58,237,0.3)', opacity: loading ? 0.8 : 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
                {loading
                  ? <motion.div style={{ width: 16, height: 16, borderRadius: '50%', border: '2px solid white', borderTopColor: 'transparent' }} animate={{ rotate: 360 }} transition={{ duration: 0.8, repeat: Infinity, ease: 'linear' }} />
                  : <Zap size={15} />}
                {loading ? 'Launching…' : tab === 'login' ? 'Sign In' : 'Create Account'}
              </motion.button>
            </form>

            <div style={{ marginTop: 20, textAlign: 'center', fontSize: 12, color: 'var(--text3)' }}>
              {tab === 'login' ? "Don't have an account? " : 'Already have an account? '}
              <button onClick={() => setTab(tab === 'login' ? 'signup' : 'login')}
                style={{ color: 'var(--accent3)', fontWeight: 600, fontSize: 12 }}>
                {tab === 'login' ? 'Sign up' : 'Sign in'}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </section>
  );
}

// ─────────────────────────────────────────────────────────────────────────────

const features = [
  {
    icon: Brain,
    title: 'AI-Powered Refactoring',
    desc: 'Gemini 2.5 Flash analyzes your code smells and generates contextually-aware refactors, learning from test failures to self-correct.',
    color: '#a855f7',
    glow: 'rgba(168,85,247,0.25)',
  },
  {
    icon: ShieldCheck,
    title: 'Safety-First Sandbox',
    desc: 'Every refactor runs in an isolated git worktree branch. Nothing touches your main branch until tests pass. Zero risk, full control.',
    color: '#06b6d4',
    glow: 'rgba(6,182,212,0.2)',
  },
  {
    icon: TestTube2,
    title: 'Self-Healing Retry Loop',
    desc: 'Failed tests? Ghost Author feeds the error back to the AI and tries again — up to 3 times — with smarter patches each attempt.',
    color: '#10b981',
    glow: 'rgba(16,185,129,0.2)',
  },
  {
    icon: GitPullRequest,
    title: 'Automated Draft PRs',
    desc: 'Successful fixes become documented pull requests with unified diffs, test logs, and risk assessments — ready for your review.',
    color: '#f97316',
    glow: 'rgba(249,115,22,0.2)',
  },
  {
    icon: Code2,
    title: 'AST Smell Detection',
    desc: 'Deep static analysis catches nested conditionals, bloated functions, and high cognitive complexity before they become real problems.',
    color: '#eab308',
    glow: 'rgba(234,179,8,0.2)',
  },
  {
    icon: GitBranch,
    title: 'Ghost Ignore Escapes',
    desc: 'Stay in control with `# ghost-ignore` annotations. Mark any file or function off-limits — the agent will always respect your boundaries.',
    color: '#ec4899',
    glow: 'rgba(236,72,153,0.2)',
  },
];

const stats = [
  { label: 'Code Smells Resolved', value: '10k+', icon: Activity },
  { label: 'Avg. Fix Time', value: '14s', icon: Zap },
  { label: 'Test Pass Rate', value: '77%', icon: TestTube2 },
  { label: 'PRs Generated', value: '2.4k+', icon: GitPullRequest },
];

const steps = [
  { num: '01', title: 'Connect your repo', desc: 'Link any GitHub repository in seconds. Ghost Author watches for every commit.' },
  { num: '02', title: 'Ghost detects smells', desc: 'AST analysis runs on changed files. Nested loops, bloated functions — nothing slips through.' },
  { num: '03', title: 'AI refactors safely', desc: 'Gemini generates a fix in an isolated branch. Your main code is never touched until tests pass.' },
  { num: '04', title: 'Review & merge', desc: 'A documented draft PR lands in your queue. One click to review the diff, approve, and ship.' },
];

function OrbitParticle({ angle, radius, size, color, duration }: { angle: number; radius: number; size: number; color: string; duration: number }) {
  return (
    <motion.div
      style={{
        position: 'absolute',
        top: '50%', left: '50%',
        width: size, height: size,
        borderRadius: '50%',
        background: color,
        boxShadow: `0 0 ${size * 3}px ${color}`,
        x: -size / 2, y: -size / 2,
      }}
      animate={{
        x: [
          Math.cos((angle * Math.PI) / 180) * radius - size / 2,
          Math.cos(((angle + 360) * Math.PI) / 180) * radius - size / 2,
        ],
        y: [
          Math.sin((angle * Math.PI) / 180) * radius - size / 2,
          Math.sin(((angle + 360) * Math.PI) / 180) * radius - size / 2,
        ],
      }}
      transition={{ duration, repeat: Infinity, ease: 'linear' }}
    />
  );
}

export default function Landing() {
  const { theme, toggle } = useTheme();
  const heroRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({ target: heroRef, offset: ['start start', 'end start'] });
  const heroY = useTransform(scrollYProgress, [0, 1], ['0%', '30%']);
  const heroOpacity = useTransform(scrollYProgress, [0, 0.8], [1, 0]);

  return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)' }}>

      {/* Minimal top bar for landing */}
      <header style={{
        position: 'fixed', top: 0, left: 0, right: 0, zIndex: 100,
        padding: '0 32px', height: 64,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        borderBottom: '1px solid var(--border2)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        background: theme === 'dark' ? 'rgba(13,13,20,0.85)' : 'rgba(248,247,255,0.88)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <GhostAvatar size={34} mood="idle" />
          <span style={{
            fontSize: 18, fontWeight: 800,
            background: 'linear-gradient(135deg, #c084fc, #7c3aed)',
            WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
          }}>Ghost Author</span>
          <span style={{
            fontSize: 10, fontWeight: 700, background: 'var(--accent)',
            color: 'white', padding: '2px 6px', borderRadius: 6,
            letterSpacing: '0.5px',
          }}>AI</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <motion.button
            onClick={toggle}
            whileHover={{ scale: 1.1 }} whileTap={{ scale: 0.95 }}
            style={{
              width: 36, height: 36, borderRadius: 10,
              border: '1px solid var(--border2)',
              background: 'var(--surface)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              color: 'var(--text2)',
            }}
          >
            {theme === 'dark' ? <Sun size={15} /> : <Moon size={15} />}
          </motion.button>
        </div>
      </header>

      {/* HERO */}
      <section
        ref={heroRef}
        style={{
          minHeight: '100vh',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          position: 'relative', overflow: 'hidden',
          padding: '100px 24px 60px',
        }}
      >
        {/* Background grid */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: theme === 'dark'
            ? 'linear-gradient(rgba(124,58,237,0.05) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.05) 1px, transparent 1px)'
            : 'linear-gradient(rgba(124,58,237,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(124,58,237,0.08) 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }} />

        {/* Radial glow */}
        <div style={{
          position: 'absolute', top: '20%', left: '50%', transform: 'translateX(-50%)',
          width: 600, height: 600,
          background: 'radial-gradient(circle, rgba(124,58,237,0.18) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', top: '30%', left: '25%',
          width: 300, height: 300,
          background: 'radial-gradient(circle, rgba(6,182,212,0.1) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', top: '25%', right: '20%',
          width: 250, height: 250,
          background: 'radial-gradient(circle, rgba(168,85,247,0.1) 0%, transparent 70%)',
          pointerEvents: 'none',
        }} />

        <motion.div
          style={{ y: heroY, opacity: heroOpacity }}
          initial={{ opacity: 0, y: 40 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <div style={{ maxWidth: 860, margin: '0 auto', textAlign: 'center', position: 'relative' }}>

            {/* Badge */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.1 }}
              style={{
                display: 'inline-flex', alignItems: 'center', gap: 8,
                padding: '6px 16px', borderRadius: 20,
                border: '1px solid var(--border)',
                background: 'rgba(124,58,237,0.1)',
                fontSize: 12, fontWeight: 600, color: 'var(--accent3)',
                marginBottom: 28, letterSpacing: '0.3px',
              }}
            >
              <motion.div
                style={{ width: 6, height: 6, borderRadius: '50%', background: 'var(--accent2)' }}
                animate={{ scale: [1, 1.5, 1], opacity: [1, 0.5, 1] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              Powered by Gemini 2.5 Flash · AST Analysis · Git Worktrees
            </motion.div>

            {/* Avatar hero */}
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 32, position: 'relative' }}>
              {/* Orbit particles */}
              <div style={{ position: 'relative', width: 200, height: 200, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div style={{ position: 'absolute', inset: 0, borderRadius: '50%', border: '1px dashed rgba(124,58,237,0.2)' }} />
                <div style={{ position: 'absolute', inset: -24, borderRadius: '50%', border: '1px dashed rgba(124,58,237,0.1)' }} />
                <OrbitParticle angle={0} radius={80} size={8} color="#7c3aed" duration={8} />
                <OrbitParticle angle={120} radius={80} size={5} color="#06b6d4" duration={8} />
                <OrbitParticle angle={240} radius={80} size={6} color="#10b981" duration={8} />
                <OrbitParticle angle={60} radius={104} size={4} color="#f97316" duration={12} />
                <OrbitParticle angle={200} radius={104} size={5} color="#a855f7" duration={12} />
                <GhostAvatar size={120} mood="happy" />
              </div>
            </div>

            {/* Headline */}
            <motion.h1
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2, duration: 0.7 }}
              style={{
                fontSize: 'clamp(40px, 7vw, 76px)',
                fontWeight: 900,
                lineHeight: 1.05,
                letterSpacing: '-2px',
                marginBottom: 24,
                color: 'var(--text)',
              }}
            >
              Your AI Ghost{' '}
              <span style={{
                background: 'linear-gradient(135deg, #c084fc 0%, #7c3aed 50%, #06b6d4 100%)',
                WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
                backgroundSize: '200% auto',
                animation: 'shimmer 3s linear infinite',
              }}>
                writes the PRs
              </span>
              <br />
              you never had time for.
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.35, duration: 0.6 }}
              style={{
                fontSize: 19, lineHeight: 1.65,
                color: 'var(--text2)', maxWidth: 580, margin: '0 auto 40px',
                fontWeight: 400,
              }}
            >
              Ghost Author silently watches your repo, hunts down code smells,
              refactors them with Gemini AI, validates with your tests, and ships
              a documented draft PR — all while you sleep.
            </motion.p>

            {/* CTAs */}
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}
            >

              <motion.a
                href="https://github.com" target="_blank" rel="noreferrer"
                whileHover={{ scale: 1.04 }} whileTap={{ scale: 0.97 }}
              >
                <button style={{
                  display: 'flex', alignItems: 'center', gap: 9,
                  padding: '14px 30px', borderRadius: 14,
                  background: 'var(--surface)',
                  border: '1px solid var(--border)',
                  color: 'var(--text)', fontSize: 15, fontWeight: 600,
                }}>
                  <Star size={15} style={{ color: 'var(--yellow)' }} />
                  Star on GitHub
                </button>
              </motion.a>
            </motion.div>

            {/* Scroll cue */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1.2 }}
              style={{ marginTop: 64, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
            >
              <span style={{ fontSize: 11, color: 'var(--text3)', letterSpacing: '1.5px', textTransform: 'uppercase' }}>Scroll to explore</span>
              <motion.div
                animate={{ y: [0, 6, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
                style={{ width: 1, height: 32, background: 'linear-gradient(to bottom, var(--accent2), transparent)' }}
              />
            </motion.div>
          </div>
        </motion.div>
      </section>

      {/* STATS */}
      <section style={{ padding: '60px 24px', background: 'var(--bg2)' }}>
        <div style={{ maxWidth: 1100, margin: '0 auto', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 20 }}>
          {stats.map(({ label, value, icon: Icon }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 24 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.1 }}
              whileHover={{ y: -4, boxShadow: '0 12px 40px var(--glow2)' }}
              style={{
                padding: '28px 24px', borderRadius: 16,
                background: 'var(--surface)',
                border: '1px solid var(--border)',
                textAlign: 'center',
                transition: 'box-shadow 0.3s',
              }}
            >
              <Icon size={24} style={{ color: 'var(--accent2)', margin: '0 auto 12px' }} />
              <div style={{ fontSize: 36, fontWeight: 900, color: 'var(--text)', letterSpacing: '-1px' }}>{value}</div>
              <div style={{ fontSize: 13, color: 'var(--text2)', marginTop: 4, fontWeight: 500 }}>{label}</div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* FEATURES */}
      <section style={{ padding: '100px 24px', maxWidth: 1200, margin: '0 auto' }}>
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          style={{ textAlign: 'center', marginBottom: 64 }}
        >
          <div style={{
            display: 'inline-block', padding: '4px 14px', borderRadius: 20,
            background: 'rgba(124,58,237,0.12)', border: '1px solid var(--border)',
            fontSize: 11, fontWeight: 700, color: 'var(--accent3)',
            letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 18,
          }}>
            Capabilities
          </div>
          <h2 style={{ fontSize: 'clamp(28px, 4vw, 48px)', fontWeight: 900, letterSpacing: '-1.5px', color: 'var(--text)', marginBottom: 16 }}>
            Everything you need to ship<br />
            <span style={{ color: 'var(--accent2)' }}>cleaner code, automatically.</span>
          </h2>
          <p style={{ color: 'var(--text2)', fontSize: 17, maxWidth: 500, margin: '0 auto' }}>
            Ghost Author combines static analysis, LLM intelligence, and test-driven validation into a single autonomous agent.
          </p>
        </motion.div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 20 }}>
          {features.map(({ icon: Icon, title, desc, color, glow }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 28 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.08 }}
              whileHover={{ y: -6, boxShadow: `0 16px 48px ${glow}` }}
              style={{
                padding: '28px', borderRadius: 20,
                background: 'var(--surface)',
                border: '1px solid var(--border2)',
                transition: 'box-shadow 0.3s, transform 0.3s',
              }}
            >
              <div style={{
                width: 48, height: 48, borderRadius: 14,
                background: `${color}1a`, border: `1px solid ${color}40`,
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 18,
              }}>
                <Icon size={22} style={{ color }} />
              </div>
              <h3 style={{ fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 10, letterSpacing: '-0.3px' }}>{title}</h3>
              <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.65 }}>{desc}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* HOW IT WORKS */}
      <section style={{ padding: '100px 24px', background: 'var(--bg2)' }}>
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            style={{ textAlign: 'center', marginBottom: 64 }}
          >
            <div style={{
              display: 'inline-block', padding: '4px 14px', borderRadius: 20,
              background: 'rgba(6,182,212,0.1)', border: '1px solid rgba(6,182,212,0.2)',
              fontSize: 11, fontWeight: 700, color: '#06b6d4',
              letterSpacing: '1.5px', textTransform: 'uppercase', marginBottom: 18,
            }}>
              How It Works
            </div>
            <h2 style={{ fontSize: 'clamp(28px, 4vw, 46px)', fontWeight: 900, letterSpacing: '-1.5px', color: 'var(--text)' }}>
              Four steps from commit to clean code.
            </h2>
          </motion.div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
            {steps.map(({ num, title, desc }, i) => (
              <motion.div
                key={num}
                initial={{ opacity: 0, x: i % 2 === 0 ? -30 : 30 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ delay: i * 0.12 }}
                style={{
                  display: 'flex', gap: 28, alignItems: 'flex-start',
                  padding: '28px 0',
                  borderBottom: i < steps.length - 1 ? '1px solid var(--border2)' : 'none',
                }}
              >
                <div style={{
                  flexShrink: 0,
                  width: 52, height: 52, borderRadius: 14,
                  background: 'linear-gradient(135deg, var(--accent), var(--accent2))',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 13, fontWeight: 800, color: 'white',
                  boxShadow: '0 4px 16px var(--glow)',
                  fontFamily: 'JetBrains Mono, monospace',
                }}>
                  {num}
                </div>
                <div>
                  <h3 style={{ fontSize: 18, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>{title}</h3>
                  <p style={{ fontSize: 15, color: 'var(--text2)', lineHeight: 1.6 }}>{desc}</p>
                </div>
                <ChevronRight size={18} style={{ color: 'var(--text3)', flexShrink: 0, marginTop: 4 }} />
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA SECTION */}
      <section style={{ padding: '100px 24px' }}>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          style={{
            maxWidth: 740, margin: '0 auto', textAlign: 'center',
            padding: '64px 40px', borderRadius: 28,
            background: 'linear-gradient(135deg, rgba(124,58,237,0.2), rgba(168,85,247,0.08))',
            border: '1px solid var(--border)',
            boxShadow: '0 0 80px rgba(124,58,237,0.12)',
            position: 'relative', overflow: 'hidden',
          }}
        >
          <div style={{
            position: 'absolute', top: -40, right: -40,
            width: 200, height: 200,
            background: 'radial-gradient(circle, rgba(168,85,247,0.2) 0%, transparent 70%)',
            pointerEvents: 'none',
          }} />
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 24 }}>
            <GhostAvatar size={80} mood="happy" />
          </div>
          <h2 style={{ fontSize: 'clamp(26px, 4vw, 42px)', fontWeight: 900, letterSpacing: '-1px', color: 'var(--text)', marginBottom: 16 }}>
            Ready to meet your ghost coder?
          </h2>
          <p style={{ fontSize: 16, color: 'var(--text2)', marginBottom: 36, maxWidth: 440, margin: '0 auto 36px' }}>
            Connect your first repository in under 60 seconds and watch Ghost Author silently clean up your codebase.
          </p>
        </motion.div>
      </section>

      {/* AUTH SECTION */}
      <AuthSection />

      {/* Footer */}
      <footer style={{
        borderTop: '1px solid var(--border2)',
        padding: '32px 24px',
        textAlign: 'center',
        color: 'var(--text3)', fontSize: 13,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
          <GhostAvatar size={22} mood="idle" />
          <span style={{ fontWeight: 600, color: 'var(--text2)' }}>Ghost Author</span>
          <span>·</span>
          <span>AI Code Quality Agent</span>
        </div>
      </footer>
    </div>
  );
}
