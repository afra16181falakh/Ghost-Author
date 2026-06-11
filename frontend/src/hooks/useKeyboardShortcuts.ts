import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

interface Options {
  onRunNow?: () => void;
  onCloseTerminal?: () => void;
}

/**
 * Global keyboard shortcuts:
 *   R          → trigger a run (calls onRunNow)
 *   Escape     → close the live terminal overlay (calls onCloseTerminal)
 *   D          → navigate to /dashboard
 *   H          → navigate to /heatmap
 *   S          → navigate to /settings
 *   P          → navigate to /pulls
 *   W          → navigate to /repos
 *
 * Shortcuts are suppressed when focus is inside an input, textarea, or select.
 */
export function useKeyboardShortcuts({ onRunNow, onCloseTerminal }: Options = {}) {
  const navigate = useNavigate();

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (tag === 'input' || tag === 'textarea' || tag === 'select') return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;

      switch (e.key) {
        case 'r':
        case 'R':
          e.preventDefault();
          onRunNow?.();
          break;
        case 'Escape':
          onCloseTerminal?.();
          break;
        case 'd':
        case 'D':
          e.preventDefault();
          navigate('/dashboard');
          break;
        case 'h':
        case 'H':
          e.preventDefault();
          navigate('/heatmap');
          break;
        case 's':
        case 'S':
          e.preventDefault();
          navigate('/settings');
          break;
        case 'p':
        case 'P':
          e.preventDefault();
          navigate('/pulls');
          break;
        case 'w':
        case 'W':
          e.preventDefault();
          navigate('/repos');
          break;
      }
    };

    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [navigate, onRunNow, onCloseTerminal]);
}
