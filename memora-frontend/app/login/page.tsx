'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { login, isLoggedIn } from '@/lib/api';

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Pas d'auto-redirect ici — évite les boucles infinies
  // si le token est expiré ou le backend pas démarré

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      await login(email, password);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const fillDemo = () => {
    setEmail('demo@memora.ai');
    setPassword('password123');
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-[var(--color-bg-secondary)]">

      {/* Effets aurora bleu/orange */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div
          className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(9,48,126,0.12) 0%, transparent 60%)',
            filter: 'blur(80px)',
            animation: 'pulse 8s ease-in-out infinite',
          }}
        />
        <div
          className="absolute -bottom-40 -left-40 w-[600px] h-[600px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(245,136,32,0.08) 0%, transparent 60%)',
            filter: 'blur(80px)',
            animation: 'pulse 10s ease-in-out infinite reverse',
          }}
        />
        <div
          className="absolute top-1/3 -left-20 w-[400px] h-[400px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(9,48,126,0.06) 0%, transparent 60%)',
            filter: 'blur(100px)',
          }}
        />
      </div>

      {/* Contenu principal */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">

          {/* Logo et titre */}
          <div className="text-center mb-8">
            <Link href="/" className="inline-block">
              <div className="flex items-center justify-center gap-3 mb-4">
                <svg width="48" height="48" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="logo-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#09307e" />
                      <stop offset="100%" stopColor="#f58820" />
                    </linearGradient>
                  </defs>
                  <circle cx="40" cy="40" r="36" stroke="url(#logo-grad)" strokeWidth="3" fill="none" opacity="0.2" />
                  <circle cx="40" cy="40" r="16" fill="#09307e" opacity="0.15" />
                  <circle cx="40" cy="40" r="6" fill="#09307e" />
                  <circle cx="22" cy="22" r="4" fill="#09307e" opacity="0.6" />
                  <circle cx="58" cy="22" r="4" fill="#1155a8" opacity="0.6" />
                  <circle cx="22" cy="58" r="4" fill="#f58820" opacity="0.6" />
                  <circle cx="58" cy="58" r="4" fill="#f5a623" opacity="0.6" />
                  <line x1="40" y1="40" x2="22" y2="22" stroke="#09307e" strokeWidth="1.5" opacity="0.3" />
                  <line x1="40" y1="40" x2="58" y2="22" stroke="#09307e" strokeWidth="1.5" opacity="0.3" />
                  <line x1="40" y1="40" x2="22" y2="58" stroke="#f58820" strokeWidth="1.5" opacity="0.3" />
                  <line x1="40" y1="40" x2="58" y2="58" stroke="#f58820" strokeWidth="1.5" opacity="0.3" />
                </svg>
                <span className="text-2xl font-bold text-[#09307e]">Memoras</span>
              </div>
            </Link>
            <h1 className="text-2xl font-bold text-[var(--color-accent-primary)]">
              Bon retour !
            </h1>
            <p className="mt-2 text-[var(--color-text-secondary)]">
              Connecte-toi à ton{' '}
              <span className="font-semibold text-[var(--color-accent-primary)]">
                espace de connaissances
              </span>
            </p>
          </div>

          {/* Carte login */}
          <div className="card-glass p-8 shadow-medium">
            {/* Ligne accent en haut */}
            <div
              className="absolute top-0 left-[10%] right-[10%] h-[2px] rounded-full"
              style={{
                background: 'linear-gradient(90deg, transparent, #09307e, #f58820, transparent)',
              }}
            />

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="label">Email</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="vous@exemple.com"
                    className="input pl-12"
                  />
                </div>
              </div>

              <div>
                <label className="label">Mot de passe</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="input pl-12 pr-12"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)] hover:text-[var(--color-accent-primary)] transition-colors"
                  >
                    {showPassword ? (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                      </svg>
                    ) : (
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div className="text-right">
                <button
                  type="button"
                  className="text-sm text-[var(--color-accent-primary)] hover:underline transition-colors"
                >
                  Mot de passe oublié ?
                </button>
              </div>

              {error && (
                <div className="px-4 py-3 rounded-xl text-sm flex items-center gap-2 bg-error-50 text-error-600 border border-error-200">
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary w-full py-3.5"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Connexion...
                  </span>
                ) : (
                  'Se connecter'
                )}
              </button>
            </form>

            {/* Séparateur */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full h-[1px] bg-[var(--color-border)]" />
              </div>
              <div className="relative flex justify-center">
                <span className="px-4 text-sm bg-[var(--color-bg-primary)] text-[var(--color-text-secondary)]">
                  ou
                </span>
              </div>
            </div>

            {/* Compte démo */}
            <button
              type="button"
              onClick={fillDemo}
              className="btn btn-outline w-full"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Utiliser le compte démo
            </button>
          </div>

          {/* Lien inscription */}
          <p className="text-center mt-6 text-[var(--color-text-secondary)]">
            Pas encore de compte ?{' '}
            <Link
              href="/register"
              className="font-semibold text-[var(--color-accent-primary)] hover:underline transition-colors"
            >
              S&apos;inscrire gratuitement
            </Link>
          </p>

          <p className="text-center text-sm mt-4 text-[var(--color-text-secondary)] opacity-60">
            En continuant, tu acceptes nos{' '}
            <a href="#" className="hover:underline text-[var(--color-accent-primary)]">
              conditions d&apos;utilisation
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
