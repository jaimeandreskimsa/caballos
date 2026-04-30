import { useState, useEffect } from 'react';
import { useAppStore } from '../store/appStore';

function useIsMobile() {
  const [mobile, setMobile] = useState(() => window.innerWidth < 768);
  useEffect(() => {
    const handler = () => setMobile(window.innerWidth < 768);
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);
  return mobile;
}

// Hero photo — chestnut horse + rider show jumping (Pexels free license)
const HERO_IMAGE = 'https://images.pexels.com/photos/5663052/pexels-photo-5663052.jpeg?auto=compress&cs=tinysrgb&w=1920&h=1080&fit=crop';

const USERS: Record<string, string> = {
  admin: 'equivalue2026',
  demo: 'demo',
};

export default function LoginPage() {
  const login = useAppStore((s) => s.login);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const isMobile = useIsMobile();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);

    setTimeout(() => {
      const user = email.trim().toLowerCase();
      const pass = password;
      if (USERS[user] && USERS[user] === pass) {
        login();
      } else {
        setError('Usuario o contraseña incorrectos');
        setLoading(false);
      }
    }, 900);
  }

  if (isMobile) {
    return (
      <div style={{
        position: 'fixed', inset: 0,
        fontFamily: 'system-ui, -apple-system, sans-serif',
        overflow: 'hidden',
      }}>
        {/* ── FULL SCREEN PHOTO ── */}
        <div style={{
          position: 'absolute', inset: 0,
          backgroundImage: `url(${HERO_IMAGE})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center 35%',
        }} />

        {/* Subtle vignette — keeps photo visible */}
        <div style={{
          position: 'absolute', inset: 0,
          background: 'linear-gradient(to bottom, rgba(0,0,0,0.28) 0%, rgba(0,0,0,0.05) 38%, rgba(0,0,0,0.15) 60%, rgba(0,0,0,0.72) 100%)',
        }} />

        {/* ── TOP BRAND ── */}
        <div style={{
          position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
          display: 'flex', flexDirection: 'column',
          alignItems: 'center',
          paddingTop: 'calc(env(safe-area-inset-top, 44px) + 18px)',
          gap: 8,
        }}>
          {/* Logo badge */}
          <div style={{
            width: 52, height: 52, borderRadius: 16,
            background: 'rgba(255,255,255,0.18)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
            border: '1.5px solid rgba(255,255,255,0.3)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 17, fontWeight: 900, color: '#FFFFFF',
            letterSpacing: '-0.5px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.2)',
          }}>EV</div>
          <div style={{ fontSize: 24, fontWeight: 900, color: '#FFFFFF', letterSpacing: '-0.6px', textShadow: '0 2px 12px rgba(0,0,0,0.4)' }}>
            EquiValue <span style={{ color: '#D4A843' }}>AI</span>
          </div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: 'rgba(212,168,67,0.18)',
            border: '1px solid rgba(212,168,67,0.4)',
            borderRadius: 999, padding: '4px 12px',
          }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#D4A843' }} />
            <span style={{ fontSize: 10, fontWeight: 700, color: 'rgba(212,168,67,1)', letterSpacing: '0.1em', textTransform: 'uppercase' }}>
              Show Jumping Intelligence
            </span>
          </div>
        </div>

        {/* ── GLASS FORM CARD ── */}
        <div style={{
          position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 10,
          background: 'rgba(8,8,12,0.52)',
          backdropFilter: 'blur(40px) saturate(180%)',
          WebkitBackdropFilter: 'blur(40px) saturate(180%)',
          borderRadius: '28px 28px 0 0',
          border: '1px solid rgba(255,255,255,0.1)',
          borderBottom: 'none',
          boxShadow: '0 -1px 0 rgba(255,255,255,0.06), 0 -32px 80px rgba(0,0,0,0.45)',
          padding: '20px 24px calc(env(safe-area-inset-bottom, 20px) + 24px)',
        }}>
          {/* Drag handle */}
          <div style={{ width: 36, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.22)', margin: '0 auto 22px' }} />

          {/* Card header */}
          <div style={{ marginBottom: 24 }}>
            <h2 style={{ margin: '0 0 5px', fontSize: 24, fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.6px' }}>
              Bienvenido de nuevo
            </h2>
            <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.48)', lineHeight: 1.4 }}>
              Ingresá tus credenciales para continuar
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            {/* Usuario */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Usuario
              </label>
              <input
                type="text"
                autoComplete="username"
                placeholder="admin"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1.5px solid rgba(255,255,255,0.15)',
                  borderRadius: 12, padding: '14px 16px',
                  color: '#FFFFFF', fontSize: 16, outline: 'none',
                  width: '100%', boxSizing: 'border-box',
                  WebkitAppearance: 'none',
                  transition: 'border-color 0.15s, background 0.15s',
                }}
                onFocus={(e) => { e.target.style.borderColor = 'rgba(212,168,67,0.7)'; e.target.style.background = 'rgba(255,255,255,0.13)'; }}
                onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.15)'; e.target.style.background = 'rgba(255,255,255,0.08)'; }}
              />
            </div>

            {/* Contraseña */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={{ fontSize: 12, fontWeight: 700, color: 'rgba(255,255,255,0.55)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>
                Contraseña
              </label>
              <input
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{
                  background: 'rgba(255,255,255,0.08)',
                  border: '1.5px solid rgba(255,255,255,0.15)',
                  borderRadius: 12, padding: '14px 16px',
                  color: '#FFFFFF', fontSize: 16, outline: 'none',
                  width: '100%', boxSizing: 'border-box',
                  WebkitAppearance: 'none',
                  transition: 'border-color 0.15s, background 0.15s',
                }}
                onFocus={(e) => { e.target.style.borderColor = 'rgba(212,168,67,0.7)'; e.target.style.background = 'rgba(255,255,255,0.13)'; }}
                onBlur={(e) => { e.target.style.borderColor = 'rgba(255,255,255,0.15)'; e.target.style.background = 'rgba(255,255,255,0.08)'; }}
              />
            </div>

            {/* Error */}
            {error && (
              <div style={{
                background: 'rgba(220,38,38,0.15)', border: '1px solid rgba(220,38,38,0.35)',
                borderRadius: 10, padding: '11px 14px',
                color: '#FCA5A5', fontSize: 13,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{ fontSize: 15 }}>⚠</span> {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: 4, padding: '15px',
                background: loading ? 'rgba(212,168,67,0.35)' : 'linear-gradient(135deg, #D4A843 0%, #E8C060 100%)',
                border: 'none', borderRadius: 12,
                color: loading ? 'rgba(255,255,255,0.5)' : '#0A0A0A',
                fontSize: 16, fontWeight: 800,
                cursor: loading ? 'not-allowed' : 'pointer',
                letterSpacing: '0.01em',
                boxShadow: loading ? 'none' : '0 4px 24px rgba(212,168,67,0.4)',
                transition: 'all 0.15s',
                WebkitTapHighlightColor: 'transparent',
              }}
            >
              {loading ? '⟳ Verificando...' : 'Ingresar →'}
            </button>
          </form>

          {/* Divider + Demo */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '20px 0 14px' }}>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
            <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.08em', fontWeight: 600 }}>ACCESO DEMO</span>
            <div style={{ flex: 1, height: 1, background: 'rgba(255,255,255,0.1)' }} />
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {[
              { user: 'demo', pass: 'demo', label: 'Demo' },
              { user: 'admin', pass: 'equivalue2026', label: 'Admin' },
            ].map(({ user, pass, label }) => (
              <button
                key={user}
                type="button"
                onClick={() => { setEmail(user); setPassword(pass); setError(''); }}
                style={{
                  flex: 1, padding: '11px',
                  background: 'rgba(255,255,255,0.07)',
                  border: '1.5px solid rgba(255,255,255,0.14)',
                  borderRadius: 10, cursor: 'pointer',
                  fontSize: 14, fontWeight: 600,
                  color: 'rgba(255,255,255,0.65)',
                  transition: 'all 0.15s',
                  WebkitTapHighlightColor: 'transparent',
                }}
                onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(212,168,67,0.6)'; e.currentTarget.style.color = '#D4A843'; }}
                onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.14)'; e.currentTarget.style.color = 'rgba(255,255,255,0.65)'; }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'row',
      width: '100vw',
      minHeight: '100vh',
      overflow: 'hidden',
      fontFamily: 'system-ui, -apple-system, sans-serif',
    }}>

      {/* ── HERO PANEL — full left on desktop ── */}
      <div style={{
        flex: '0 0 58%',
        height: '100vh',
        position: 'relative',
        overflow: 'hidden',
        backgroundImage: `url(${HERO_IMAGE})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center 40%',
      }}>

        {/* Overlays */}
        <div style={{
          position: 'absolute', inset: 0, zIndex: 2,
          background: 'linear-gradient(135deg, rgba(0,0,0,0.55) 0%, rgba(0,0,0,0.25) 50%, rgba(0,0,0,0.70) 100%)',
        }} />
        <div style={{
          position: 'absolute', inset: 0, zIndex: 2,
          background: 'linear-gradient(to top, rgba(0,0,0,0.85) 0%, rgba(0,0,0,0) 45%)',
        }} />
        <div style={{
          position: 'absolute', top: 0, right: 0, bottom: 0, width: '30%', zIndex: 2,
          background: 'linear-gradient(to right, transparent 0%, rgba(0,0,0,0.4) 100%)',
        }} />

        {/* Top-left brand — desktop */}
        <div style={{ position: 'absolute', top: 36, left: 40, zIndex: 3 }}>
          <span style={{ fontSize: 15, fontWeight: 800, letterSpacing: '-0.3px', color: 'rgba(255,255,255,0.92)' }}>
            EquiValue <span style={{ color: '#D4A843', fontWeight: 900 }}>AI</span>
          </span>
        </div>

        {/* Desktop: bottom hero text */}
        {!isMobile && (
          <div style={{ position: 'absolute', bottom: 48, left: 44, right: 44, zIndex: 3 }}>
            <div style={{
              display: 'inline-flex', alignItems: 'center', gap: 7,
              background: 'rgba(212,168,67,0.15)',
              border: '1px solid rgba(212,168,67,0.35)',
              borderRadius: 999, padding: '4px 12px', marginBottom: 18,
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#D4A843' }} />
              <span style={{ fontSize: 11, fontWeight: 600, color: 'rgba(212,168,67,0.9)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
                Show Jumping Intelligence
              </span>
            </div>
            <h1 style={{
              margin: '0 0 14px', fontSize: 38, fontWeight: 900,
              color: '#FFFFFF', letterSpacing: '-1.2px', lineHeight: 1.1,
            }}>
              Valoración IA<br />
              para caballos<br />
              <span style={{ color: '#D4A843' }}>de competición</span>
            </h1>
            <p style={{
              margin: '0 0 28px', fontSize: 14, color: 'rgba(255,255,255,0.55)',
              lineHeight: 1.6, maxWidth: 340,
            }}>
              Datos FEI, Jumpr, FEDECUARG y DATAFECH unificados en una sola plataforma.
            </p>
            <div style={{ display: 'flex', gap: 28 }}>
              {[
                { value: '500+', label: 'Caballos analizados' },
                { value: '3 países', label: 'ARG · CL · BRA' },
                { value: 'Tiempo real', label: 'Datos actualizados' },
              ].map((s) => (
                <div key={s.label}>
                  <div style={{ fontSize: 17, fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.5px' }}>{s.value}</div>
                  <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── FORM PANEL ─────────────────────────────────────────────── */}
      <div style={{
        ...(isMobile ? {
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          borderRadius: '24px 24px 0 0',
          maxHeight: '74vh',
          overflowY: 'auto',
          background: 'rgba(0,0,0,0.48)',
          backdropFilter: 'blur(28px)',
          WebkitBackdropFilter: 'blur(28px)',
          padding: '24px 24px calc(env(safe-area-inset-bottom, 16px) + 28px)',
          boxShadow: '0 -2px 0 rgba(255,255,255,0.08), 0 -24px 64px rgba(0,0,0,0.5)',
          border: '1px solid rgba(255,255,255,0.1)',
          borderBottom: 'none',
          zIndex: 10,
        } : {
          flex: 1,
          background: '#FFFFFF',
          display: 'flex', flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'center',
          padding: '48px 52px',
          boxShadow: '-8px 0 48px rgba(0,0,0,0.18)',
          position: 'relative',
        }),
      }}>
        <div style={{ width: '100%', maxWidth: isMobile ? '100%' : 360 }}>

          {/* Desktop-only header block */}
          {!isMobile && (
            <div style={{ marginBottom: 36 }}>
              <div style={{
                width: 44, height: 44, borderRadius: 12, background: '#111111',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                marginBottom: 24, fontSize: 18, fontWeight: 900, color: '#FFFFFF', letterSpacing: '-0.5px',
              }}>EV</div>
              <h2 style={{ margin: '0 0 6px', fontSize: 26, fontWeight: 800, color: '#0A0A0A', letterSpacing: '-0.6px' }}>
                Bienvenido de nuevo
              </h2>
              <p style={{ margin: 0, fontSize: 14, color: '#888888' }}>
                Ingresá tus credenciales para continuar
              </p>
            </div>
          )}

          {/* Mobile-only compact header */}
          {isMobile && (
            <div style={{ marginBottom: 22 }}>
              {/* drag handle */}
              <div style={{ width: 40, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.3)', margin: '0 auto 20px' }} />
              <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 800, color: '#FFFFFF', letterSpacing: '-0.5px' }}>
                Bienvenido de nuevo
              </h2>
              <p style={{ margin: 0, fontSize: 14, color: 'rgba(255,255,255,0.55)' }}>
                Ingresá tus credenciales para continuar
              </p>
            </div>
          )}

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            {/* Usuario */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: isMobile ? 'rgba(255,255,255,0.7)' : '#333333' }}>Usuario</label>
              <input
                type="text"
                autoComplete="username"
                placeholder="admin"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                style={{
                  background: isMobile ? 'rgba(255,255,255,0.1)' : '#F8F8F8',
                  border: isMobile ? '1.5px solid rgba(255,255,255,0.2)' : '1.5px solid #E8E8E8',
                  borderRadius: 10, padding: '13px 16px',
                  color: isMobile ? '#FFFFFF' : '#111111',
                  fontSize: 16, outline: 'none',
                  transition: 'border-color 0.15s, background 0.15s',
                  width: '100%', boxSizing: 'border-box',
                  WebkitAppearance: 'none',
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  ['--placeholder-color' as any]: isMobile ? 'rgba(255,255,255,0.35)' : undefined,
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = isMobile ? 'rgba(212,168,67,0.7)' : '#111111';
                  e.target.style.background = isMobile ? 'rgba(255,255,255,0.15)' : '#FFFFFF';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = isMobile ? 'rgba(255,255,255,0.2)' : '#E8E8E8';
                  e.target.style.background = isMobile ? 'rgba(255,255,255,0.1)' : '#F8F8F8';
                }}
              />
            </div>

            {/* Contraseña */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
              <label style={{ fontSize: 13, fontWeight: 600, color: isMobile ? 'rgba(255,255,255,0.7)' : '#333333' }}>Contraseña</label>
              <input
                type="password"
                autoComplete="current-password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                style={{
                  background: isMobile ? 'rgba(255,255,255,0.1)' : '#F8F8F8',
                  border: isMobile ? '1.5px solid rgba(255,255,255,0.2)' : '1.5px solid #E8E8E8',
                  borderRadius: 10, padding: '13px 16px',
                  color: isMobile ? '#FFFFFF' : '#111111',
                  fontSize: 16, outline: 'none',
                  transition: 'border-color 0.15s, background 0.15s',
                  width: '100%', boxSizing: 'border-box',
                  WebkitAppearance: 'none',
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = isMobile ? 'rgba(212,168,67,0.7)' : '#111111';
                  e.target.style.background = isMobile ? 'rgba(255,255,255,0.15)' : '#FFFFFF';
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = isMobile ? 'rgba(255,255,255,0.2)' : '#E8E8E8';
                  e.target.style.background = isMobile ? 'rgba(255,255,255,0.1)' : '#F8F8F8';
                }}
              />
            </div>

            {/* Error */}
            {error && (
              <div style={{
                background: '#FEF2F2', border: '1px solid #FECACA',
                borderRadius: 8, padding: '11px 14px',
                color: '#DC2626', fontSize: 13,
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <span style={{ fontSize: 15 }}>⚠</span> {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: 4, padding: '15px',
                background: loading
                  ? (isMobile ? 'rgba(212,168,67,0.4)' : '#555555')
                  : (isMobile ? '#D4A843' : '#111111'),
                border: 'none', borderRadius: 10,
                color: isMobile ? '#111111' : '#FFFFFF',
                fontSize: 16, fontWeight: 700,
                cursor: loading ? 'not-allowed' : 'pointer',
                letterSpacing: '0.01em', transition: 'all 0.15s',
                boxShadow: loading ? 'none' : (isMobile ? '0 4px 20px rgba(212,168,67,0.35)' : '0 2px 12px rgba(0,0,0,0.18)'),
                WebkitTapHighlightColor: 'transparent',
              }}
              onMouseEnter={(e) => {
                if (!loading) {
                  e.currentTarget.style.background = isMobile ? '#E8B84B' : '#222222';
                  e.currentTarget.style.transform = 'translateY(-1px)';
                  e.currentTarget.style.boxShadow = isMobile ? '0 8px 28px rgba(212,168,67,0.5)' : '0 6px 20px rgba(0,0,0,0.25)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = loading ? (isMobile ? 'rgba(212,168,67,0.4)' : '#555555') : (isMobile ? '#D4A843' : '#111111');
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = loading ? 'none' : (isMobile ? '0 4px 20px rgba(212,168,67,0.35)' : '0 2px 12px rgba(0,0,0,0.18)');
              }}
            >
              {loading ? '⟳ Verificando...' : 'Ingresar →'}
            </button>
          </form>

          {/* Divider */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, margin: '24px 0' }}>
            <div style={{ flex: 1, height: 1, background: isMobile ? 'rgba(255,255,255,0.15)' : '#F0F0F0' }} />
            <span style={{ fontSize: 11, color: isMobile ? 'rgba(255,255,255,0.4)' : '#CCCCCC', letterSpacing: '0.06em' }}>ACCESO DEMO</span>
            <div style={{ flex: 1, height: 1, background: isMobile ? 'rgba(255,255,255,0.15)' : '#F0F0F0' }} />
          </div>

          {/* Demo quick-fill */}
          <div style={{ display: 'flex', gap: 10 }}>
            {[
              { user: 'demo', pass: 'demo', label: 'Demo' },
              { user: 'admin', pass: 'equivalue2026', label: 'Admin' },
            ].map(({ user, pass, label }) => (
              <button
                key={user}
                type="button"
                onClick={() => { setEmail(user); setPassword(pass); setError(''); }}
                style={{
                  flex: 1, padding: '11px',
                  background: isMobile ? 'rgba(255,255,255,0.1)' : '#F8F8F8',
                  border: isMobile ? '1.5px solid rgba(255,255,255,0.2)' : '1.5px solid #E8E8E8',
                  borderRadius: 8, cursor: 'pointer',
                  fontSize: 14, fontWeight: 600,
                  color: isMobile ? 'rgba(255,255,255,0.75)' : '#555555',
                  transition: 'all 0.15s',
                  WebkitTapHighlightColor: 'transparent',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = isMobile ? 'rgba(212,168,67,0.6)' : '#111111';
                  e.currentTarget.style.color = isMobile ? '#D4A843' : '#111111';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = isMobile ? 'rgba(255,255,255,0.2)' : '#E8E8E8';
                  e.currentTarget.style.color = isMobile ? 'rgba(255,255,255,0.75)' : '#555555';
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {/* Footer */}
        {!isMobile && (
          <p style={{
            position: 'absolute',
            bottom: 24,
            left: 0, right: 0,
            textAlign: 'center',
            fontSize: 11, color: '#CCCCCC', letterSpacing: '0.05em',
            margin: 0,
          }}>
            © 2026 KIMSA · EquiValue AI Platform
          </p>
        )}
      </div>
    </div>
  );
}
