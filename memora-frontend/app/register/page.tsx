'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { register, isLoggedIn } from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  useEffect(() => {
    if (isLoggedIn()) {
      router.push('/dashboard');
    }
  }, [router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password !== confirmPassword) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }

    if (password.length < 8) {
      setError('Le mot de passe doit contenir au moins 8 caractères');
      return;
    }

    setLoading(true);

    try {
      await register(email, password, firstName, lastName);
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  const getPasswordStrength = () => {
    if (!password) return { strength: 0, label: '', color: '' };
    let strength = 0;
    if (password.length >= 8) strength++;
    if (password.match(/[a-z]/) && password.match(/[A-Z]/)) strength++;
    if (password.match(/[0-9]/)) strength++;
    if (password.match(/[^a-zA-Z0-9]/)) strength++;

    const configs = [
      { label: 'Faible', color: '#ef4444' },
      { label: 'Moyen', color: '#f59e0b' },
      { label: 'Bon', color: '#10b981' },
      { label: 'Excellent', color: '#09307e' },
    ];

    return { strength, ...configs[Math.min(strength - 1, 3)] || { label: '', color: '' } };
  };

  const passwordStrength = getPasswordStrength();

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
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4 py-8">
        <div className="w-full max-w-md">

          {/* Logo et titre */}
          <div className="text-center mb-6">
            <Link href="/" className="inline-block">
              <div className="flex items-center justify-center gap-3 mb-4">
                <svg width="40" height="40" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <defs>
                    <linearGradient id="reg-grad" x1="0%" y1="0%" x2="100%" y2="100%">
                      <stop offset="0%" stopColor="#09307e" />
                      <stop offset="100%" stopColor="#f58820" />
                    </linearGradient>
                  </defs>
                  <circle cx="40" cy="40" r="36" stroke="url(#reg-grad)" strokeWidth="3" fill="none" opacity="0.2" />
                  <circle cx="40" cy="40" r="16" fill="#09307e" opacity="0.15" />
                  <circle cx="40" cy="40" r="6" fill="#09307e" />
                </svg>
                <span className="text-2xl font-bold text-[#09307e]">Memoras</span>
              </div>
            </Link>
            <h1 className="text-2xl font-bold text-[var(--color-accent-primary)]">
              Créer un compte
            </h1>
            <p className="mt-2 text-[var(--color-text-secondary)]">
              Rejoins{' '}
              <span className="font-semibold text-[var(--color-accent-primary)]">
                Memoras
              </span>
              {' '}gratuitement
            </p>
          </div>

          {/* Carte inscription */}
          <div className="card-glass p-8 shadow-medium animate-fade-in relative">
            {/* Ligne accent en haut */}
            <div
              className="absolute top-0 left-[10%] right-[10%] h-[2px] rounded-full"
              style={{
                background: 'linear-gradient(90deg, transparent, #09307e, #f58820, transparent)',
              }}
            />

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Prénom / Nom */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label">Prénom</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    placeholder="Jean"
                    className="input"
                  />
                </div>
                <div>
                  <label className="label">Nom</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    placeholder="Dupont"
                    className="input"
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label className="label">Email *</label>
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

              {/* Mot de passe */}
              <div>
                <label className="label">Mot de passe *</label>
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
                    minLength={8}
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

                {/* Indicateur de force */}
                {password && (
                  <div className="mt-2">
                    <div className="flex gap-1 mb-1">
                      {[1, 2, 3, 4].map((level) => (
                        <div
                          key={level}
                          className="h-1 flex-1 rounded-full transition-all duration-300"
                          style={{
                            backgroundColor: level <= passwordStrength.strength
                              ? passwordStrength.color
                              : 'var(--color-border)'
                          }}
                        />
                      ))}
                    </div>
                    <p className="text-xs" style={{ color: passwordStrength.color }}>
                      {passwordStrength.label}
                    </p>
                  </div>
                )}
              </div>

              {/* Confirmer mot de passe */}
              <div>
                <label className="label">Confirmer le mot de passe *</label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2 text-[var(--color-text-secondary)]">
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
                    </svg>
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className={`input pl-12 ${confirmPassword && confirmPassword !== password ? 'border-error-500' : ''}`}
                  />
                  {confirmPassword && password === confirmPassword && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-success-600">
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>
                {confirmPassword && confirmPassword !== password && (
                  <p className="text-xs mt-1 text-error-500">
                    Les mots de passe ne correspondent pas
                  </p>
                )}
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
                    Création du compte...
                  </span>
                ) : (
                  "S'inscrire"
                )}
              </button>
            </form>
          </div>

          {/* Lien connexion */}
          <p className="text-center mt-6 text-[var(--color-text-secondary)]">
            Déjà un compte ?{' '}
            <Link
              href="/login"
              className="font-semibold text-[var(--color-accent-primary)] hover:underline transition-colors"
            >
              Se connecter
            </Link>
          </p>

          <p className="text-center text-sm mt-4 text-[var(--color-text-secondary)] opacity-60">
            En créant un compte, tu acceptes nos{' '}
            <a href="#" className="hover:underline text-[var(--color-accent-primary)]">
              conditions d&apos;utilisation
            </a>
            {' '}et notre{' '}
            <a href="#" className="hover:underline text-[var(--color-accent-primary)]">
              politique de confidentialité
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
