import { motion } from 'framer-motion';

interface Props {
  size?: number;
  mood?: 'idle' | 'thinking' | 'happy' | 'alert';
  className?: string;
}

export default function GhostAvatar({ size = 80, mood = 'idle', className = '' }: Props) {
  const eyeY = mood === 'thinking' ? 34 : 36;
  const mouthPath = mood === 'happy'
    ? 'M 34 52 Q 40 58 46 52'
    : mood === 'alert'
    ? 'M 34 54 L 46 54'
    : 'M 35 52 Q 40 55 45 52';

  const glowColor = mood === 'happy' ? '#10b981' : mood === 'alert' ? '#ef4444' : '#7c3aed';

  return (
    <motion.div
      className={className}
      style={{ width: size, height: size, position: 'relative', display: 'inline-block' }}
      animate={{ y: [0, -8, 0] }}
      transition={{ duration: 3.5, repeat: Infinity, ease: 'easeInOut' }}
    >
      {/* Glow ring */}
      <motion.div
        style={{
          position: 'absolute',
          inset: -8,
          borderRadius: '50%',
          background: `radial-gradient(circle, ${glowColor}30 0%, transparent 70%)`,
          pointerEvents: 'none',
        }}
        animate={{ opacity: [0.5, 1, 0.5], scale: [0.9, 1.05, 0.9] }}
        transition={{ duration: 2.5, repeat: Infinity, ease: 'easeInOut' }}
      />

      <svg
        width={size}
        height={size}
        viewBox="0 0 80 88"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        <defs>
          <radialGradient id="bodyGrad" cx="50%" cy="40%" r="60%">
            <stop offset="0%" stopColor="#a78bfa" />
            <stop offset="100%" stopColor="#5b21b6" />
          </radialGradient>
          <radialGradient id="cheekGrad" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor="#f9a8d4" stopOpacity="0.7" />
            <stop offset="100%" stopColor="#f9a8d4" stopOpacity="0" />
          </radialGradient>
          <filter id="softGlow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Body / sheet shape */}
        <path
          d="M 10 40 C 10 18 20 6 40 6 C 60 6 70 18 70 40 L 70 74 C 70 76 68 78 66 76 L 60 70 L 54 76 C 52 78 48 78 46 76 L 40 70 L 34 76 C 32 78 28 78 26 76 L 20 70 L 14 76 C 12 78 10 76 10 74 Z"
          fill="url(#bodyGrad)"
          filter="url(#softGlow)"
        />

        {/* Shine highlight */}
        <ellipse cx="28" cy="22" rx="8" ry="5" fill="white" opacity="0.18" transform="rotate(-20 28 22)" />

        {/* Cheeks */}
        <ellipse cx="26" cy="48" rx="7" ry="5" fill="url(#cheekGrad)" />
        <ellipse cx="54" cy="48" rx="7" ry="5" fill="url(#cheekGrad)" />

        {/* Eyes */}
        <motion.g
          animate={mood === 'thinking' ? { scaleY: [1, 0.1, 1] } : { scaleY: [1, 0.08, 1] }}
          transition={
            mood === 'thinking'
              ? { duration: 0.3, repeat: Infinity, repeatDelay: 1.2 }
              : { duration: 0.15, repeat: Infinity, repeatDelay: 3.5 }
          }
          style={{ transformOrigin: '40px 36px' }}
        >
          {/* Left eye */}
          <ellipse cx="30" cy={eyeY} rx="5" ry="5.5" fill="white" />
          <ellipse cx="31" cy={eyeY + 0.5} rx="2.8" ry="3" fill="#1a0a3e" />
          <circle cx="32" cy={eyeY - 1} r="1" fill="white" opacity="0.9" />

          {/* Right eye */}
          <ellipse cx="50" cy={eyeY} rx="5" ry="5.5" fill="white" />
          <ellipse cx="51" cy={eyeY + 0.5} rx="2.8" ry="3" fill="#1a0a3e" />
          <circle cx="52" cy={eyeY - 1} r="1" fill="white" opacity="0.9" />
        </motion.g>

        {/* Mouth */}
        <motion.path
          d={mouthPath}
          stroke="white"
          strokeWidth="2.2"
          strokeLinecap="round"
          fill="none"
          opacity="0.85"
          animate={{ d: mouthPath }}
          transition={{ duration: 0.4 }}
        />

        {/* Thinking dots */}
        {mood === 'thinking' && (
          <motion.g
            animate={{ opacity: [0, 1, 0] }}
            transition={{ duration: 1, repeat: Infinity, staggerChildren: 0.2 }}
          >
            <circle cx="36" cy="62" r="2.5" fill="white" opacity="0.6" />
            <circle cx="40" cy="62" r="2.5" fill="white" opacity="0.6" />
            <circle cx="44" cy="62" r="2.5" fill="white" opacity="0.6" />
          </motion.g>
        )}

        {/* Code bracket decorations */}
        <text x="14" y="44" fontSize="7" fill="white" opacity="0.25" fontFamily="monospace">{'<'}</text>
        <text x="63" y="44" fontSize="7" fill="white" opacity="0.25" fontFamily="monospace">{'>'}</text>
      </svg>
    </motion.div>
  );
}
