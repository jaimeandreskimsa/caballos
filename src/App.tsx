import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Component, type ReactNode, useEffect, useState } from 'react';
import { useAppStore } from './store/appStore';
import LoginPage from './pages/LoginPage';
import { Sidebar } from './components/Sidebar';
import { BottomNav } from './components/BottomNav';
import Dashboard from './pages/Dashboard';
import HorsesPage from './pages/HorsesPage';
import ValuationPage from './pages/ValuationPage';
import SearchPage from './pages/SearchPage';
import DataPage from './pages/DataPage';
import SettingsPage from './pages/SettingsPage';
import { Download, X } from 'lucide-react';

const qc = new QueryClient();

class ErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null };
  static getDerivedStateFromError(e: Error) { return { error: e.message }; }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 40, color: '#DC2626', background: '#FEF2F2', minHeight: '100vh', fontFamily: 'monospace' }}>
          <h2>Error al iniciar la app</h2>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13 }}>{this.state.error}</pre>
          <button onClick={() => { localStorage.clear(); window.location.reload(); }}
            style={{ marginTop: 20, padding: '10px 20px', background: '#A0731A', color: '#fff', border: 'none', borderRadius: 8, cursor: 'pointer', fontWeight: 700 }}>
            Limpiar datos y recargar
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>;
}

function PWAInstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(() => !!localStorage.getItem('pwa-banner-dismissed'));

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  if (!deferredPrompt || dismissed) return null;

  const install = async () => {
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted' || outcome === 'dismissed') {
      setDeferredPrompt(null);
      localStorage.setItem('pwa-banner-dismissed', '1');
    }
  };

  return (
    <div style={{
      position: 'fixed', bottom: 'calc(68px + env(safe-area-inset-bottom))', left: '50%', transform: 'translateX(-50%)',
      background: '#FFFFFF', border: '1px solid #E3E8EF',
      borderRadius: 14, padding: '14px 18px',
      display: 'flex', alignItems: 'center', gap: 12,
      boxShadow: '0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06)',
      zIndex: 9999, maxWidth: 380, width: 'calc(100vw - 40px)',
    }}>
      <div style={{
        width: 38, height: 38, borderRadius: 10, flexShrink: 0,
        background: 'linear-gradient(135deg, #635BFF, #7C74FF)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 22,
      }}>♞</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 700, color: '#1A1612' }}>Instalar EquiValue AI</div>
        <div style={{ fontSize: 11, color: '#9A9189', marginTop: 1 }}>Accedé desde tu pantalla de inicio</div>
      </div>
      <button onClick={install} style={{
        background: '#635BFF', color: '#fff', border: 'none',
        borderRadius: 8, padding: '7px 13px',
        fontSize: 12, fontWeight: 600, cursor: 'pointer',
        display: 'flex', alignItems: 'center', gap: 5, flexShrink: 0,
      }}>
        <Download size={12} /> Instalar
      </button>
      <button onClick={() => { setDismissed(true); localStorage.setItem('pwa-banner-dismissed', '1'); }}
        style={{ background: 'transparent', border: 'none', cursor: 'pointer', color: '#C4BDB5', padding: 4, display: 'flex' }}>
        <X size={14} />
      </button>
    </div>
  );
}

export default function App() {
  const isAuthenticated = useAppStore((s) => s.isAuthenticated);

  if (!isAuthenticated) return <LoginPage />;

  return (
    <ErrorBoundary>
      <QueryClientProvider client={qc}>
        <BrowserRouter>
          <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--c-bg)' }}>
            <div className="sidebar-desktop"><Sidebar /></div>
            <main className="main-content" style={{ flex: 1, overflowY: 'auto', minHeight: '100vh', background: 'var(--c-bg)' }}>
              <Routes>
                <Route path="/" element={<Dashboard />} />
                <Route path="/horses" element={<HorsesPage />} />
                <Route path="/valuation" element={<ValuationPage />} />
                <Route path="/search" element={<SearchPage />} />
                <Route path="/data" element={<DataPage />} />
                <Route path="/settings" element={<SettingsPage />} />
              </Routes>
            </main>
          </div>
          <BottomNav />
          <PWAInstallBanner />
        </BrowserRouter>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

