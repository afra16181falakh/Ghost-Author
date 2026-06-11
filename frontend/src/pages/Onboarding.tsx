import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { FolderGit2, Key, Zap, Check, ChevronRight, ArrowRight } from 'lucide-react';
import GhostAvatar from '../components/GhostAvatar';
import { useConnectRepo } from '../api/hooks';
import { api } from '../api/client';

const STEPS = [
  {
    id: 1,
    icon: FolderGit2,
    title: 'Connect your repository',
    subtitle: 'Tell Ghost Author where your code lives.',
    color: '#a855f7',
  },
  {
    id: 2,
    icon: Key,
    title: 'Configure your API key',
    subtitle: 'Ghost Author uses Gemini to understand and fix your code.',
    color: '#06b6d4',
  },
  {
    id: 3,
    icon: Zap,
    title: 'Run your first scan',
    subtitle: "You're all set — let Ghost Author find its first smells.",
    color: '#10b981',
  },
];

function StepIndicator({ current }: { current: number }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 40 }}>
      {STEPS.map((step, i) => {
        const done   = step.id < current;
        const active = step.id === current;
        return (
          <div key={step.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <motion.div
              animate={{
                background: done ? '#10b981' : active ? 'linear-gradient(135deg,#7c3aed,#a855f7)' : 'var(--surface)',
                border: `2px solid ${done ? '#10b981' : active ? '#a855f7' : 'var(--border2)'}`,
              }}
              style={{ width: 32, height: 32, borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, fontWeight: 800, color: done || active ? 'white' : 'var(--text3)' }}
            >
              {done ? <Check size={14} /> : step.id}
            </motion.div>
            {i < STEPS.length - 1 && (
              <div style={{ width: 48, height: 2, background: done ? '#10b981' : 'var(--border2)', borderRadius: 2, transition: 'background 0.4s' }} />
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── Step 1: Connect Repo ──────────────────────────────────────────────────────

function Step1({ onNext }: { onNext: () => void }) {
  const { connect, loading, error } = useConnectRepo();
  const [owner, setOwner]     = useState('');
  const [name, setName]       = useState('');
  const [path, setPath]       = useState('');
  const [done, setDone]       = useState(false);

  const inp = {
    width: '100%', padding: '11px 14px', background: 'var(--bg2)',
    border: '1px solid var(--border2)', borderRadius: 12,
    color: 'var(--text)', fontSize: 14, outline: 'none',
  } as React.CSSProperties;

  const handleConnect = async (e: React.FormEvent) => {
    e.preventDefault();
    const res = await connect(owner, name, path || undefined);
    if (res) { setDone(true); setTimeout(onNext, 800); }
  };

  return (
    <form onSubmit={handleConnect} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 6 }}>
            GitHub Owner
          </label>
          <input required value={owner} onChange={e => setOwner(e.target.value)}
            placeholder="e.g. octocat" style={inp} />
        </div>
        <div>
          <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 6 }}>
            Repository Name
          </label>
          <input required value={name} onChange={e => setName(e.target.value)}
            placeholder="e.g. my-project" style={inp} />
        </div>
      </div>
      <div>
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 6 }}>
          Local Path <span style={{ fontWeight: 400 }}>(optional — for local analysis)</span>
        </label>
        <input value={path} onChange={e => setPath(e.target.value)}
          placeholder="e.g. C:\Projects\my-project" style={inp} />
      </div>
      {error && (
        <p style={{ fontSize: 12, color: '#ef4444', margin: 0 }}>{error}</p>
      )}
      <motion.button type="submit" disabled={loading || done}
        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
        style={{ marginTop: 4, padding: '13px', borderRadius: 12, background: done ? '#10b981' : 'linear-gradient(135deg,#7c3aed,#a855f7)', color: 'white', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: loading ? 0.8 : 1 }}>
        {done ? <><Check size={16} /> Connected!</> : loading ? 'Connecting…' : <><FolderGit2 size={15} /> Connect Repo</>}
      </motion.button>
      <button type="button" onClick={onNext}
        style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center' }}>
        Skip for now →
      </button>
    </form>
  );
}

// ── Step 2: API Key ───────────────────────────────────────────────────────────

function Step2({ onNext }: { onNext: () => void }) {
  const [key, setKey]     = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved]   = useState(false);

  const inp = {
    width: '100%', padding: '11px 14px', background: 'var(--bg2)',
    border: '1px solid var(--border2)', borderRadius: 12,
    color: 'var(--text)', fontSize: 14, outline: 'none', fontFamily: 'monospace',
  } as React.CSSProperties;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.put('/api/settings', { gemini_api_key: key });
      setSaved(true);
      setTimeout(onNext, 700);
    } catch {
      /* ignore — proceed anyway */
      onNext();
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSave} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div>
        <label style={{ fontSize: 12, fontWeight: 600, color: 'var(--text3)', display: 'block', marginBottom: 6 }}>
          Gemini API Key
        </label>
        <input type="password" value={key} onChange={e => setKey(e.target.value)}
          placeholder="AIza…" style={inp} />
        <p style={{ fontSize: 11, color: 'var(--text3)', marginTop: 6 }}>
          Get yours free at{' '}
          <span style={{ color: 'var(--accent3)', fontWeight: 600 }}>aistudio.google.com</span>
          . Keys are stored encrypted in your database — never sent to our servers.
        </p>
      </div>
      <motion.button type="submit" disabled={saving || saved || !key}
        whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }}
        style={{ padding: '13px', borderRadius: 12, background: saved ? '#10b981' : 'linear-gradient(135deg,#0891b2,#06b6d4)', color: 'white', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, opacity: saving ? 0.8 : 1 }}>
        {saved ? <><Check size={16} /> Saved!</> : saving ? 'Saving…' : <><Key size={15} /> Save Key</>}
      </motion.button>
      <button type="button" onClick={onNext}
        style={{ fontSize: 12, color: 'var(--text3)', textAlign: 'center' }}>
        Skip — I'll add it in Settings →
      </button>
    </form>
  );
}

// ── Step 3: First Run ─────────────────────────────────────────────────────────

function Step3({ onFinish }: { onFinish: () => void }) {
  return (
    <div style={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 20 }}>
      <GhostAvatar size={80} mood="happy" />
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.5px', marginBottom: 8 }}>
          Ghost Author is ready 👻
        </div>
        <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.6, maxWidth: 380 }}>
          Click <strong>Go to Dashboard</strong> to trigger your first scan. Ghost Author will
          detect code smells, score them by risk, and start refactoring the riskiest ones first.
        </p>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, width: '100%' }}>
        <motion.button onClick={onFinish}
          whileHover={{ scale: 1.03, boxShadow: '0 8px 32px rgba(16,185,129,0.4)' }}
          whileTap={{ scale: 0.97 }}
          style={{ padding: '14px', borderRadius: 12, background: 'linear-gradient(135deg,#059669,#10b981)', color: 'white', fontSize: 15, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, boxShadow: '0 4px 20px rgba(16,185,129,0.3)' }}>
          <Zap size={16} /> Go to Dashboard
          <ArrowRight size={15} />
        </motion.button>
      </div>
    </div>
  );
}

// ── Main Onboarding Page ──────────────────────────────────────────────────────

export default function Onboarding() {
  const navigate  = useNavigate();
  const [step, setStep] = useState(1);

  const finish = () => {
    localStorage.setItem('onboarding_complete', '1');
    navigate('/dashboard');
  };

  const currentStep = STEPS[step - 1];
  const Icon        = currentStep.icon;

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: 24,
    }}>
      <motion.div
        initial={{ opacity: 0, y: 32 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ width: '100%', maxWidth: 520, borderRadius: 28, background: 'var(--surface)', border: '1px solid var(--border)', boxShadow: '0 32px 100px rgba(0,0,0,0.35)', overflow: 'hidden' }}
      >
        {/* Header */}
        <div style={{ padding: '32px 40px 0', background: 'var(--bg2)', borderBottom: '1px solid var(--border2)' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24 }}>
            <GhostAvatar size={36} mood="idle" />
            <span style={{ fontSize: 16, fontWeight: 800, letterSpacing: '-0.3px', background: 'linear-gradient(135deg,#c084fc,#7c3aed)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Ghost Author Setup
            </span>
          </div>
          <StepIndicator current={step} />
        </div>

        {/* Body */}
        <div style={{ padding: '36px 40px 40px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 24 }}>
            <div style={{ width: 48, height: 48, borderRadius: 14, background: `${currentStep.color}1a`, border: `1px solid ${currentStep.color}40`, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Icon size={22} style={{ color: currentStep.color }} />
            </div>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.4px', margin: 0 }}>
                {currentStep.title}
              </h2>
              <p style={{ fontSize: 13, color: 'var(--text2)', margin: '3px 0 0' }}>
                {currentStep.subtitle}
              </p>
            </div>
          </div>

          <AnimatePresence mode="wait">
            <motion.div
              key={step}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              transition={{ duration: 0.22 }}
            >
              {step === 1 && <Step1 onNext={() => setStep(2)} />}
              {step === 2 && <Step2 onNext={() => setStep(3)} />}
              {step === 3 && <Step3 onFinish={finish} />}
            </motion.div>
          </AnimatePresence>
        </div>
      </motion.div>
    </div>
  );
}
