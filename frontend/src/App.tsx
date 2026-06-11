import { Routes, Route, useLocation, Navigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import Navbar from './components/Navbar';
import Landing from './pages/Landing';
import Dashboard from './pages/Dashboard';
import Runs from './pages/Runs';
import PullRequests from './pages/PullRequests';
import Settings from './pages/Settings';
import Heatmap from './pages/Heatmap';
import Repos from './pages/Repos';
import Onboarding from './pages/Onboarding';
import AuthCallback from './pages/AuthCallback';

const pageVariants = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.3, ease: [0.22, 1, 0.36, 1] } },
  exit:    { opacity: 0, y: -6, transition: { duration: 0.18 } },
};

function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Navbar />
      <main>{children}</main>
    </>
  );
}

function Page({ children }: { children: React.ReactNode }) {
  return (
    <motion.div variants={pageVariants} initial="initial" animate="animate" exit="exit">
      {children}
    </motion.div>
  );
}

/** Redirect first-time visitors to onboarding. */
function DashboardGuard() {
  const onboardingDone = localStorage.getItem('onboarding_complete');
  if (!onboardingDone) return <Navigate to="/onboarding" replace />;
  return <AppLayout><Page><Dashboard /></Page></AppLayout>;
}

export default function App() {
  const location = useLocation();

  return (
    <div style={{ minHeight: '100vh' }}>
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>

          {/* Public */}
          <Route path="/"              element={<Page><Landing /></Page>} />
          <Route path="/onboarding"    element={<Page><Onboarding /></Page>} />
          <Route path="/auth/callback" element={<Page><AuthCallback /></Page>} />

          {/* App shell */}
          <Route path="/dashboard" element={<DashboardGuard />} />
          <Route path="/runs"      element={<AppLayout><Page><Runs /></Page></AppLayout>} />
          <Route path="/pulls"     element={<AppLayout><Page><PullRequests /></Page></AppLayout>} />
          <Route path="/repos"     element={<AppLayout><Page><Repos /></Page></AppLayout>} />
          <Route path="/heatmap"   element={<AppLayout><Page><Heatmap /></Page></AppLayout>} />
          <Route path="/settings"  element={<AppLayout><Page><Settings /></Page></AppLayout>} />

        </Routes>
      </AnimatePresence>
    </div>
  );
}
