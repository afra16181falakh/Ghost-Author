import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Github, Database, Brain, ShieldCheck,
  Save, Eye, EyeOff, Plus, Trash2, ToggleLeft, ToggleRight,
  Key, Cpu, TestTube2, CheckCircle2, AlertTriangle, Loader2, Webhook,
} from 'lucide-react';
import GhostAvatar from '../components/GhostAvatar';
import { useSettings, useTestWebhook } from '../api/hooks';

// ── Reusable sub-components ───────────────────────────────────────────────────

function Section({ title, icon: Icon, color, children }: {
  title: string; icon: React.ElementType; color: string; children: React.ReactNode;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }}
      style={{ borderRadius: 18, background: 'var(--surface)', border: '1px solid var(--border2)', overflow: 'hidden', marginBottom: 20 }}
    >
      <div style={{ padding: '18px 24px', borderBottom: '1px solid var(--border2)', display: 'flex', alignItems: 'center', gap: 12, background: 'var(--bg2)' }}>
        <div style={{ width: 36, height: 36, borderRadius: 10, background: `${color}18`, border: `1px solid ${color}30`, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
          <Icon size={17} style={{ color }} />
        </div>
        <h2 style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)' }}>{title}</h2>
      </div>
      <div style={{ padding: '24px' }}>{children}</div>
    </motion.div>
  );
}

function Field({ label, desc, last, children }: { label: string; desc?: string; last?: boolean; children: React.ReactNode }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start', paddingBottom: last ? 0 : 20, marginBottom: last ? 0 : 20, borderBottom: last ? 'none' : '1px solid var(--border2)' }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{label}</div>
        {desc && <div style={{ fontSize: 12, color: 'var(--text3)', lineHeight: 1.5 }}>{desc}</div>}
      </div>
      <div>{children}</div>
    </div>
  );
}

function TextInput({ value, onChange, type = 'text', placeholder = '', mono = false }: {
  value: string; onChange: (v: string) => void; type?: string; placeholder?: string; mono?: boolean;
}) {
  return (
    <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
      style={{ width: '100%', padding: '9px 14px', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 10, color: 'var(--text)', fontSize: 13, fontFamily: mono ? 'JetBrains Mono, monospace' : 'inherit', outline: 'none', transition: 'border-color 0.2s' }}
      onFocus={e => e.target.style.borderColor = 'var(--accent)'}
      onBlur={e => e.target.style.borderColor = 'var(--border2)'}
    />
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (v: boolean) => void }) {
  return (
    <motion.button onClick={() => onChange(!value)} whileTap={{ scale: 0.95 }}
      style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, fontWeight: 600, color: value ? 'var(--green)' : 'var(--text3)' }}>
      {value ? <ToggleRight size={28} style={{ color: 'var(--green)' }} /> : <ToggleLeft size={28} style={{ color: 'var(--text3)' }} />}
      {value ? 'Enabled' : 'Disabled'}
    </motion.button>
  );
}

function NumInput({ value, onChange, min, max }: { value: number; onChange: (v: number) => void; min?: number; max?: number }) {
  return (
    <input type="number" value={value} min={min} max={max} onChange={e => onChange(Number(e.target.value))}
      style={{ width: '100%', padding: '9px 14px', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 10, color: 'var(--text)', fontSize: 13, outline: 'none' }}
      onFocus={e => e.target.style.borderColor = 'var(--accent)'}
      onBlur={e => e.target.style.borderColor = 'var(--border2)'}
    />
  );
}

function SecretInput({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder: string }) {
  const [show, setShow] = useState(false);
  return (
    <div style={{ position: 'relative' }}>
      <Key size={13} style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }} />
      <input type={show ? 'text' : 'password'} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
        style={{ width: '100%', padding: '9px 40px 9px 36px', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 10, color: 'var(--text)', fontSize: 13, fontFamily: 'JetBrains Mono, monospace', outline: 'none' }}
        onFocus={e => e.target.style.borderColor = 'var(--accent)'}
        onBlur={e => e.target.style.borderColor = 'var(--border2)'}
      />
      <button onClick={() => setShow(s => !s)} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--text3)' }}>
        {show ? <EyeOff size={14} /> : <Eye size={14} />}
      </button>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function Settings() {
  const { data: remote, saving, saveOk, save, status: fetchStatus } = useSettings();
  const { test: testWebhook, result: webhookResult, loading: webhookTesting } = useTestWebhook();

  // Local form state — seeded from API data once loaded
  const [githubEnabled, setGithubEnabled] = useState(false);
  const [githubOwner,   setGithubOwner]   = useState('');
  const [githubRepo,    setGithubRepo]    = useState('');
  const [githubToken,   setGithubToken]   = useState('');
  const [geminiKey,     setGeminiKey]     = useState('');
  const [model,         setModel]         = useState('gemini-2.5-flash');
  const [maxAttempts,   setMaxAttempts]   = useState(3);
  const [maxCognitive,  setMaxCognitive]  = useState(15);
  const [maxNesting,    setMaxNesting]    = useState(2);
  const [maxLength,     setMaxLength]     = useState(15);
  const [useDocker,     setUseDocker]     = useState(false);
  const [dockerImage,   setDockerImage]   = useState('python:3.11-slim');
  const [branchPrefix,  setBranchPrefix]  = useState('ghost/refactor-');
  const [allowlist,     setAllowlist]     = useState<string[]>(['src', 'app']);
  const [blacklist,     setBlacklist]     = useState<string[]>(['tests', '.git']);
  const [newAllow,      setNewAllow]      = useState('');
  const [newBlacklist,  setNewBlacklist]  = useState('');
  const [saveError,     setSaveError]     = useState<string | null>(null);

  // Seed form from API data when it loads
  useEffect(() => {
    if (!remote || fetchStatus !== 'success') return;
    setGithubEnabled(remote.github_enabled);
    setGithubOwner(remote.github_owner ?? '');
    setGithubRepo(remote.github_repo ?? '');
    setModel(remote.model_name);
    setMaxAttempts(remote.max_attempts);
    setMaxCognitive(remote.max_cognitive);
    setMaxNesting(remote.max_nesting);
    setMaxLength(remote.max_length);
    setUseDocker(remote.use_docker);
    setDockerImage(remote.docker_image);
    setBranchPrefix(remote.branch_prefix);
    setAllowlist(remote.allowlist_dirs ?? []);
    setBlacklist(remote.blacklist_dirs ?? []);
  }, [remote, fetchStatus]);

  const handleSave = async () => {
    setSaveError(null);
    try {
      await save({
        github_enabled: githubEnabled,
        github_owner:   githubOwner   || null,
        github_repo:    githubRepo    || null,
        github_token:   githubToken   || undefined,   // blank = don't overwrite
        gemini_api_key: geminiKey     || undefined,
        model_name:     model,
        max_attempts:   maxAttempts,
        max_cognitive:  maxCognitive,
        max_nesting:    maxNesting,
        max_length:     maxLength,
        use_docker:     useDocker,
        docker_image:   dockerImage,
        branch_prefix:  branchPrefix,
        allowlist_dirs: allowlist,
        blacklist_dirs: blacklist,
      });
    } catch (e) {
      setSaveError((e as Error).message);
    }
  };

  return (
    <div style={{ padding: '88px 28px 80px', maxWidth: 900, margin: '0 auto' }}>

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -16 }} animate={{ opacity: 1, y: 0 }}
        style={{ marginBottom: 32, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <GhostAvatar size={48} mood={saving ? 'thinking' : saveOk ? 'happy' : 'idle'} />
          <div>
            <h1 style={{ fontSize: 26, fontWeight: 900, color: 'var(--text)', letterSpacing: '-0.8px' }}>Settings</h1>
            <p style={{ fontSize: 14, color: 'var(--text2)' }}>Configure Ghost Author's AI, integrations, and agent behaviour.</p>
          </div>
        </div>
      </motion.div>

      {/* ── GitHub ── */}
      <Section title="GitHub Integration" icon={Github} color="#a855f7">
        <Field label="Enable PR Creation" desc="Automatically open draft PRs when a refactoring succeeds.">
          <Toggle value={githubEnabled} onChange={setGithubEnabled} />
        </Field>
        <Field label="Repository Owner" desc="Your GitHub username or organisation name.">
          <TextInput value={githubOwner} onChange={setGithubOwner} placeholder="your-username" />
        </Field>
        <Field label="Repository Name" desc="The repo Ghost Author should push refactor branches to.">
          <TextInput value={githubRepo} onChange={setGithubRepo} placeholder="my-repo" />
        </Field>
        <Field label="GitHub Token" desc="Personal access token with repo scope. Leave blank to keep the existing token.">
          <SecretInput value={githubToken} onChange={setGithubToken} placeholder="ghp_•••••••• (leave blank to keep existing)" />
        </Field>
        <Field label="Test Webhook" desc="Verify that your GITHUB_WEBHOOK_SECRET is configured and HMAC signing works." last>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <motion.button
              onClick={testWebhook} disabled={webhookTesting}
              whileHover={{ scale: webhookTesting ? 1 : 1.03 }} whileTap={{ scale: 0.97 }}
              style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '9px 16px', borderRadius: 10, background: 'var(--bg2)', border: '1px solid var(--border2)', color: 'var(--text2)', fontSize: 13, fontWeight: 600, width: 'fit-content' }}
            >
              {webhookTesting
                ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}><Loader2 size={14} /></motion.div>
                : <Webhook size={14} />
              }
              {webhookTesting ? 'Testing…' : 'Send Test'}
            </motion.button>
            {webhookResult && (
              <motion.div initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                style={{ display: 'flex', alignItems: 'flex-start', gap: 7, padding: '9px 12px', borderRadius: 9, fontSize: 12, fontWeight: 500,
                  background: webhookResult.success ? 'rgba(16,185,129,0.1)' : 'rgba(239,68,68,0.1)',
                  border: `1px solid ${webhookResult.success ? 'rgba(16,185,129,0.25)' : 'rgba(239,68,68,0.25)'}`,
                  color: webhookResult.success ? '#10b981' : '#ef4444',
                }}>
                {webhookResult.success ? <CheckCircle2 size={13} style={{ flexShrink: 0, marginTop: 1 }} /> : <AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 1 }} />}
                {webhookResult.message}
              </motion.div>
            )}
          </div>
        </Field>
      </Section>

      {/* ── AI Model ── */}
      <Section title="AI Model" icon={Brain} color="#06b6d4">
        <Field label="Gemini API Key" desc="Required for LLM refactoring. Leave blank to keep existing. Falls back to rule-based engine if absent.">
          <SecretInput value={geminiKey} onChange={setGeminiKey} placeholder="AIza•••••••• (leave blank to keep existing)" />
        </Field>
        <Field label="Model" desc="Gemini model used for code generation.">
          <select value={model} onChange={e => setModel(e.target.value)}
            style={{ width: '100%', padding: '9px 14px', background: 'var(--bg2)', border: '1px solid var(--border2)', borderRadius: 10, color: 'var(--text)', fontSize: 13, outline: 'none' }}>
            <option value="gemini-2.5-flash">gemini-2.5-flash (Recommended)</option>
            <option value="gemini-2.0-flash">gemini-2.0-flash</option>
            <option value="gemini-1.5-pro">gemini-1.5-pro</option>
          </select>
        </Field>
        <Field label="Max Retry Attempts" desc="How many Gemini re-tries before giving up on a failing function (1–5)." last>
          <NumInput value={maxAttempts} onChange={setMaxAttempts} min={1} max={5} />
        </Field>
      </Section>

      {/* ── Smell Thresholds ── */}
      <Section title="Smell Detection Thresholds" icon={Cpu} color="#f97316">
        <Field label="Max Cognitive Complexity" desc="Functions above this score get flagged. Lower = stricter.">
          <NumInput value={maxCognitive} onChange={setMaxCognitive} min={5} max={50} />
        </Field>
        <Field label="Max Nesting Depth" desc="Deepest allowed block nesting level inside a function.">
          <NumInput value={maxNesting} onChange={setMaxNesting} min={1} max={10} />
        </Field>
        <Field label="Max Function Length" desc="Functions longer than this (in lines) will be flagged as too large." last>
          <NumInput value={maxLength} onChange={setMaxLength} min={5} max={200} />
        </Field>
      </Section>

      {/* ── Policy ── */}
      <Section title="Policy & Access Control" icon={ShieldCheck} color="#10b981">
        <Field label="Branch Prefix" desc="Prefix for refactoring branches Ghost Author creates.">
          <TextInput value={branchPrefix} onChange={setBranchPrefix} placeholder="ghost/refactor-" mono />
        </Field>

        {/* Allowlist */}
        <div style={{ marginBottom: 20, paddingBottom: 20, borderBottom: '1px solid var(--border2)' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Allowlist Directories</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>Only touch files inside these paths.</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {allowlist.map(d => (
              <span key={d} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 8, background: 'rgba(16,185,129,0.12)', border: '1px solid rgba(16,185,129,0.25)', fontSize: 12, fontFamily: 'monospace', color: '#10b981' }}>
                {d}
                <button onClick={() => setAllowlist(p => p.filter(x => x !== d))} style={{ color: '#10b981', lineHeight: 0 }}><Trash2 size={11} /></button>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <TextInput value={newAllow} onChange={setNewAllow} placeholder="Add directory…" mono />
            <motion.button whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.95 }}
              onClick={() => { if (newAllow.trim()) { setAllowlist(p => [...p, newAllow.trim()]); setNewAllow(''); } }}
              style={{ padding: '9px 14px', borderRadius: 10, background: 'rgba(16,185,129,0.15)', border: '1px solid rgba(16,185,129,0.3)', color: '#10b981' }}>
              <Plus size={15} />
            </motion.button>
          </div>
        </div>

        {/* Blacklist */}
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>Blacklist Directories</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>Never touch files inside these paths.</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {blacklist.map(d => (
              <span key={d} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '4px 10px', borderRadius: 8, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', fontSize: 12, fontFamily: 'monospace', color: '#ef4444' }}>
                {d}
                <button onClick={() => setBlacklist(p => p.filter(x => x !== d))} style={{ color: '#ef4444', lineHeight: 0 }}><Trash2 size={11} /></button>
              </span>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <TextInput value={newBlacklist} onChange={setNewBlacklist} placeholder="Add directory…" mono />
            <motion.button whileHover={{ scale: 1.06 }} whileTap={{ scale: 0.95 }}
              onClick={() => { if (newBlacklist.trim()) { setBlacklist(p => [...p, newBlacklist.trim()]); setNewBlacklist(''); } }}
              style={{ padding: '9px 14px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)', color: '#ef4444' }}>
              <Plus size={15} />
            </motion.button>
          </div>
        </div>
      </Section>

      {/* ── Test Runner ── */}
      <Section title="Test Runner" icon={TestTube2} color="#eab308">
        <Field label="Use Docker" desc="Run pytest inside an isolated Docker container instead of native subprocess.">
          <Toggle value={useDocker} onChange={setUseDocker} />
        </Field>
        {useDocker && (
          <Field label="Docker Image" desc="The image used to run the test suite." last>
            <TextInput value={dockerImage} onChange={setDockerImage} placeholder="python:3.11-slim" mono />
          </Field>
        )}
      </Section>

      {/* ── Database (display-only) ── */}
      <Section title="Database" icon={Database} color="#a855f7">
        <div>
          <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>PostgreSQL Connection URL</div>
          <div style={{ fontSize: 12, color: 'var(--text3)', marginBottom: 10 }}>Configured via the <code style={{ background: 'var(--bg2)', padding: '1px 5px', borderRadius: 4 }}>DATABASE_URL</code> environment variable in <code style={{ background: 'var(--bg2)', padding: '1px 5px', borderRadius: 4 }}>.env</code>. Not editable from the UI for security reasons.</div>
          <div style={{ padding: '10px 14px', background: 'var(--bg2)', borderRadius: 10, border: '1px solid var(--border2)', fontSize: 12, fontFamily: 'JetBrains Mono, monospace', color: 'var(--text3)' }}>
            postgresql+asyncpg://ghost:••••••••@localhost:5432/ghost_author
          </div>
        </div>
      </Section>

      {/* ── Save bar ── */}
      {saveError && (
        <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }}
          style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '12px 16px', borderRadius: 10, background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.25)', color: '#ef4444', fontSize: 13, marginBottom: 16 }}>
          <AlertTriangle size={14} /> {saveError}
        </motion.div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 12, alignItems: 'center' }}>
        {saveOk && (
          <motion.span initial={{ opacity: 0, x: 8 }} animate={{ opacity: 1, x: 0 }}
            style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, color: '#10b981', fontWeight: 600 }}>
            <CheckCircle2 size={14} /> Settings saved
          </motion.span>
        )}
        <motion.button onClick={handleSave} disabled={saving}
          whileHover={{ scale: saving ? 1 : 1.04, boxShadow: saving ? 'none' : '0 8px 32px var(--glow)' }}
          whileTap={{ scale: saving ? 1 : 0.96 }}
          style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '12px 28px', borderRadius: 12, background: saveOk ? 'linear-gradient(135deg, #059669, #10b981)' : 'linear-gradient(135deg, var(--accent), var(--accent2))', color: 'white', fontSize: 14, fontWeight: 700, boxShadow: '0 4px 20px var(--glow)', transition: 'background 0.3s', opacity: saving ? 0.7 : 1 }}>
          {saving
            ? <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}><Loader2 size={15} /></motion.div>
            : saveOk ? <CheckCircle2 size={15} /> : <Save size={15} />
          }
          {saving ? 'Saving…' : saveOk ? 'Saved!' : 'Save Settings'}
        </motion.button>
      </div>
    </div>
  );
}
