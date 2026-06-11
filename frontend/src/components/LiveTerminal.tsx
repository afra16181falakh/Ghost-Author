import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Terminal, Wifi, WifiOff, CheckCircle2, XCircle, RefreshCw } from 'lucide-react';
import { openRunSocket } from '../api/client';
import GhostAvatar from './GhostAvatar';

interface LogLine {
  id: number;
  level: string;
  message: string;
  ts?: string;
}

interface Props {
  runId: string;
  initialStatus?: string;
}

const levelColor: Record<string, string> = {
  INFO:    '#a5b4fc',
  WARNING: '#fbbf24',
  ERROR:   '#f87171',
  DEBUG:   '#6b7280',
};

const MAX_RETRIES = 5;

export default function LiveTerminal({ runId, initialStatus }: Props) {
  const [logs, setLogs]           = useState<LogLine[]>([]);
  const [status, setStatus]       = useState(initialStatus ?? 'pending');
  const [connected, setConnected] = useState(false);
  const [retrying, setRetrying]   = useState(false);
  const [prUrl, setPrUrl]         = useState<string | null>(null);
  const bottomRef  = useRef<HTMLDivElement>(null);
  const counterRef = useRef(0);

  const ghostMood = status === 'running' ? 'thinking'
    : status === 'success' ? 'happy'
    : status === 'failed'  ? 'alert'
    : 'idle';

  useEffect(() => {
    let currentWs: ReturnType<typeof openRunSocket>;
    let retryCount = 0;
    let done = false;
    let retryTimer: ReturnType<typeof setTimeout>;

    const connect = () => {
      currentWs = openRunSocket(runId, {
        onLog: (level, message, ts) => {
          counterRef.current += 1;
          setLogs(prev => [...prev, { id: counterRef.current, level, message, ts }]);
        },
        onStatus: (s) => setStatus(s),
        onComplete: (success, url) => {
          done = true;
          setStatus(success ? 'success' : 'failed');
          setPrUrl(url);
          setConnected(false);
          setRetrying(false);
        },
        onError: () => setConnected(false),
      });

      currentWs.onopen = () => {
        setConnected(true);
        setRetrying(false);
        retryCount = 0;
      };

      currentWs.onclose = () => {
        setConnected(false);
        if (!done && retryCount < MAX_RETRIES) {
          const delay = Math.min(1000 * Math.pow(2, retryCount), 10_000);
          retryCount += 1;
          setRetrying(true);
          retryTimer = setTimeout(connect, delay);
        } else if (!done) {
          setRetrying(false);
        }
      };
    };

    connect();

    return () => {
      done = true;
      clearTimeout(retryTimer);
      currentWs?.close();
    };
  }, [runId]);

  // Auto-scroll to bottom on new logs
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div style={{
      borderRadius: 14, overflow: 'hidden',
      border: '1px solid var(--border2)',
      background: '#0a0a12',
      fontFamily: 'JetBrains Mono, monospace',
    }}>
      {/* Terminal header bar */}
      <div style={{
        padding: '10px 16px',
        background: 'rgba(255,255,255,0.04)',
        borderBottom: '1px solid rgba(255,255,255,0.06)',
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        {/* Traffic lights */}
        <div style={{ display: 'flex', gap: 6 }}>
          {['#ef4444', '#eab308', '#10b981'].map(c => (
            <div key={c} style={{ width: 10, height: 10, borderRadius: '50%', background: c, opacity: 0.7 }} />
          ))}
        </div>
        <Terminal size={12} style={{ color: 'var(--text3)', marginLeft: 4 }} />
        <span style={{ fontSize: 11, color: 'var(--text3)', flex: 1 }}>
          ghost-author — run {runId.slice(0, 8)}
        </span>

        <GhostAvatar size={24} mood={ghostMood} />

        {/* Connection / retry indicator */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 10, color: connected ? '#10b981' : retrying ? '#eab308' : '#6b7280' }}>
          {connected ? (
            <Wifi size={11} />
          ) : retrying ? (
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 1, repeat: Infinity, ease: 'linear' }}>
              <RefreshCw size={11} />
            </motion.div>
          ) : (
            <WifiOff size={11} />
          )}
          {connected ? 'live' : retrying ? 'reconnecting…' : 'disconnected'}
        </div>

        {/* Status badge */}
        <span style={{
          fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 20,
          background: status === 'success' ? 'rgba(16,185,129,0.15)' : status === 'failed' ? 'rgba(239,68,68,0.15)' : status === 'running' ? 'rgba(168,85,247,0.15)' : 'rgba(107,114,128,0.15)',
          color:      status === 'success' ? '#10b981'               : status === 'failed' ? '#ef4444'              : status === 'running' ? '#a855f7'               : '#9ca3af',
          textTransform: 'uppercase',
        }}>
          {status}
        </span>
      </div>

      {/* Log output */}
      <div style={{ height: 340, overflowY: 'auto', padding: '12px 16px' }}>
        <AnimatePresence initial={false}>
          {logs.map(log => (
            <motion.div
              key={log.id}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.15 }}
              style={{ display: 'flex', gap: 12, marginBottom: 3, fontSize: 12, lineHeight: 1.6 }}
            >
              <span style={{ color: '#3d3d5c', flexShrink: 0, fontSize: 10, paddingTop: 2 }}>
                {log.ts ? new Date(log.ts).toLocaleTimeString() : ''}
              </span>
              <span style={{ color: levelColor[log.level] ?? '#a5b4fc', flexShrink: 0, width: 52, fontSize: 10, paddingTop: 2, fontWeight: 600 }}>
                [{log.level}]
              </span>
              <span style={{ color: '#c9c2e8', wordBreak: 'break-all' }}>{log.message}</span>
            </motion.div>
          ))}
        </AnimatePresence>

        {/* Running cursor */}
        {status === 'running' && (
          <motion.span
            animate={{ opacity: [1, 0, 1] }}
            transition={{ duration: 0.8, repeat: Infinity }}
            style={{ color: '#7c3aed', fontSize: 14 }}
          >
            ▋
          </motion.span>
        )}

        {/* Completion message */}
        {(status === 'success' || status === 'failed') && logs.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8 }}
          >
            {status === 'success'
              ? <CheckCircle2 size={14} style={{ color: '#10b981' }} />
              : <XCircle     size={14} style={{ color: '#ef4444' }} />
            }
            <span style={{ fontSize: 12, color: status === 'success' ? '#10b981' : '#ef4444', fontWeight: 600 }}>
              Run {status === 'success' ? 'completed successfully' : 'failed'}.
              {prUrl && <a href={prUrl} target="_blank" rel="noreferrer" style={{ color: '#a855f7', marginLeft: 8 }}>View PR →</a>}
            </span>
          </motion.div>
        )}

        {logs.length === 0 && !retrying && (
          <span style={{ color: '#3d3d5c', fontSize: 12 }}>Waiting for agent output...</span>
        )}

        <div ref={bottomRef} />
      </div>
    </div>
  );
}
