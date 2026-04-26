import { useState, useEffect } from 'react';
import { supabase } from './lib/supabase.js';
import KitchenManager from './components/KitchenManager.jsx';

const ALLOWED = (import.meta.env.VITE_ALLOWED_EMAILS || '').split(',').map(e => e.trim()).filter(Boolean);

export default function App() {
  const [session, setSession] = useState(undefined);
  const [denied,  setDenied]  = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      handleSession(session);
    });
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_e, session) => {
      handleSession(session);
    });
    return () => subscription.unsubscribe();
  }, []);

  const handleSession = (session) => {
    if (session && ALLOWED.length > 0 && !ALLOWED.includes(session.user.email)) {
      supabase.auth.signOut();
      setDenied(true);
      setSession(null);
      return;
    }
    setDenied(false);
    setSession(session);
  };

  if (session === undefined) return <Splash />;
  if (!session) return <Login denied={denied} />;
  return <KitchenManager user={session.user} />;
}

function Splash() {
  return (
    <div style={S.center}>
      <img src="/favicon.png" alt="おうちキッチン" style={{ width: 72, height: 72, marginBottom: 12, borderRadius: 16 }} />
      <div style={{ color: '#718096', fontSize: 14 }}>読み込み中…</div>
    </div>
  );
}

function Login({ denied }) {
  const login = () => supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
  });

  return (
    <div style={S.loginBg}>
      <div style={S.loginCard}>
        <img src="/favicon.png" alt="おうちキッチン" style={{ width: 96, height: 96, marginBottom: 12, borderRadius: 22 }} />
        <div style={S.loginTitle}>おうちキッチン</div>
        <div style={S.loginSub}>食材管理 &amp; 献立提案</div>
        {denied && (
          <div style={S.denied}>このアカウントはアクセスできません</div>
        )}
        <button style={S.googleBtn} onClick={login}>
          <GoogleIcon />
          Googleでログイン
        </button>
      </div>
    </div>
  );
}

function GoogleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 18 18">
      <path fill="#4285F4" d="M17.64 9.2c0-.637-.057-1.251-.164-1.84H9v3.481h4.844c-.209 1.125-.843 2.078-1.796 2.717v2.258h2.908c1.702-1.567 2.684-3.874 2.684-6.615z"/>
      <path fill="#34A853" d="M9 18c2.43 0 4.467-.806 5.956-2.18l-2.908-2.259c-.806.54-1.837.86-3.048.86-2.344 0-4.328-1.584-5.036-3.711H.957v2.332C2.438 15.983 5.482 18 9 18z"/>
      <path fill="#FBBC05" d="M3.964 10.71c-.18-.54-.282-1.117-.282-1.71s.102-1.17.282-1.71V4.958H.957C.347 6.173 0 7.548 0 9s.348 2.827.957 4.042l3.007-2.332z"/>
      <path fill="#EA4335" d="M9 3.58c1.321 0 2.508.454 3.44 1.345l2.582-2.58C13.463.891 11.426 0 9 0 5.482 0 2.438 2.017.957 4.958L3.964 6.29C4.672 4.163 6.656 3.58 9 3.58z"/>
    </svg>
  );
}

const S = {
  center: { minHeight: '100vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', background: '#FFF9F0' },
  loginBg: { minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'linear-gradient(135deg,#FFF9F0 0%,#FFF3E0 60%,#F3F8FF 100%)' },
  loginCard: { background: 'white', borderRadius: 20, padding: '40px 32px', boxShadow: '0 4px 24px rgba(0,0,0,0.1)', textAlign: 'center', maxWidth: 320, width: '100%' },
  loginTitle: { fontSize: 22, fontWeight: 800, color: '#2D3748', marginBottom: 4 },
  loginSub: { fontSize: 13, color: '#718096', marginBottom: 28 },
  denied: { background: '#FFF5F5', color: '#E53E3E', border: '1px solid #FED7D7', borderRadius: 8, padding: '8px 12px', fontSize: 12, marginBottom: 16 },
  googleBtn: { width: '100%', padding: '12px 20px', borderRadius: 12, border: '1.5px solid #E2E8F0', background: 'white', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, fontSize: 14, fontWeight: 600, color: '#2D3748', boxShadow: '0 2px 8px rgba(0,0,0,0.06)' },
};
