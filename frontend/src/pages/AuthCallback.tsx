/**
 * GitHub OAuth callback page.
 * GitHub redirects to /auth/callback?token=<jwt>
 * We store the token then redirect to /dashboard.
 */
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { setToken } from '../api/client';
import GhostAvatar from '../components/GhostAvatar';

export default function AuthCallback() {
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    if (token) {
      setToken(token);
      navigate('/dashboard', { replace: true });
    } else {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', gap: 20,
    }}>
      <GhostAvatar size={80} mood="thinking" />
      <motion.p
        animate={{ opacity: [0.5, 1, 0.5] }}
        transition={{ duration: 1.5, repeat: Infinity }}
        style={{ color: 'var(--text2)', fontSize: 16 }}
      >
        Authenticating with GitHub...
      </motion.p>
    </div>
  );
}
