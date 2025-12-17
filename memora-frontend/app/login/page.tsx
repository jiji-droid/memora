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

  useEffect(() => {
    if (isLoggedIn()) {
      router.push('/dashboard');
    }
  }, [router]);

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
    <div className="min-h-screen relative overflow-hidden" style={{ backgroundColor: '#1E2A26' }}>
      
      {/* Aurora background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full animate-pulse"
          style={{
            background: 'radial-gradient(circle, rgba(181,138,255,0.2) 0%, transparent 60%)',
            filter: 'blur(80px)',
            animation: 'pulse 8s ease-in-out infinite',
          }}
        />
        
        <div 
          className="absolute -bottom-40 -left-40 w-[600px] h-[600px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(168,183,138,0.15) 0%, transparent 60%)',
            filter: 'blur(80px)',
            animation: 'pulse 10s ease-in-out infinite reverse',
          }}
        />

        <div 
          className="absolute top-1/3 -left-20 w-[400px] h-[400px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(181,138,255,0.1) 0%, transparent 60%)',
            filter: 'blur(100px)',
          }}
        />

        <div 
          className="absolute top-1/2 right-1/4 w-[500px] h-[500px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(215,224,140,0.08) 0%, transparent 60%)',
            filter: 'blur(100px)',
          }}
        />

        <svg className="absolute top-0 left-0 w-full h-full opacity-[0.02]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#A8B78A" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* Main content */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          
          {/* Logo and title */}
          <div className="text-center mb-8">
            <Link href="/" className="inline-block">
              <img 
                src="/memora-logo.png" 
                alt="Memora" 
                className="h-32 w-auto mx-auto transition-transform duration-300 hover:scale-105"
              />
            </Link>
            <h1 className="text-2xl font-bold mt-4" style={{ color: '#f5f5f5' }}>
              Bon retour !
            </h1>
            <p style={{ color: '#A8B78A' }} className="mt-2">
              Connectez-vous à votre{' '}
              <span 
                className="font-semibold"
                style={{ 
                  background: 'linear-gradient(135deg, #B58AFF 0%, #D7E08C 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                second cerveau
              </span>
            </p>
          </div>

          {/* Login card */}
          <div 
            className="relative rounded-2xl p-8"
            style={{
              background: 'linear-gradient(145deg, rgba(46, 62, 56, 0.95) 0%, rgba(46, 62, 56, 0.98) 100%)',
              backdropFilter: 'blur(20px)',
              border: '1px solid rgba(168, 183, 138, 0.2)',
              boxShadow: '0 25px 50px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255,255,255,0.03)',
            }}
          >
            {/* Top glow line */}
            <div 
              className="absolute top-0 left-[10%] right-[10%] h-[2px] rounded-full"
              style={{
                background: 'linear-gradient(90deg, transparent, #B58AFF, #A8B78A, transparent)',
              }}
            />

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#A8B78A' }}>
                  Email
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2">
                    <svg className="w-5 h-5" style={{ color: '#A8B78A' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                  </div>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    placeholder="vous@exemple.com"
                    className="w-full pl-12 pr-4 py-3 rounded-xl outline-none transition-all duration-300"
                    style={{ 
                      backgroundColor: 'rgba(30, 42, 38, 0.8)',
                      border: '2px solid rgba(168, 183, 138, 0.2)',
                      color: '#f5f5f5'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#B58AFF';
                      e.currentTarget.style.boxShadow = '0 0 20px rgba(181, 138, 255, 0.2)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(168, 183, 138, 0.2)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium mb-2" style={{ color: '#A8B78A' }}>
                  Mot de passe
                </label>
                <div className="relative">
                  <div className="absolute left-4 top-1/2 -translate-y-1/2">
                    <svg className="w-5 h-5" style={{ color: '#A8B78A' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                  </div>
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    placeholder="••••••••"
                    className="w-full pl-12 pr-12 py-3 rounded-xl outline-none transition-all duration-300"
                    style={{ 
                      backgroundColor: 'rgba(30, 42, 38, 0.8)',
                      border: '2px solid rgba(168, 183, 138, 0.2)',
                      color: '#f5f5f5'
                    }}
                    onFocus={(e) => {
                      e.currentTarget.style.borderColor = '#B58AFF';
                      e.currentTarget.style.boxShadow = '0 0 20px rgba(181, 138, 255, 0.2)';
                    }}
                    onBlur={(e) => {
                      e.currentTarget.style.borderColor = 'rgba(168, 183, 138, 0.2)';
                      e.currentTarget.style.boxShadow = 'none';
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-4 top-1/2 -translate-y-1/2 transition-colors"
                    style={{ color: '#A8B78A' }}
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

              {/* Forgot password link */}
              <div className="text-right">
                <button
                  type="button"
                  className="text-sm transition-colors hover:underline"
                  style={{ color: '#B58AFF' }}
                >
                  Mot de passe oublié ?
                </button>
              </div>

              {error && (
                <div 
                  className="px-4 py-3 rounded-xl text-sm flex items-center gap-2"
                  style={{
                    backgroundColor: 'rgba(239, 68, 68, 0.1)',
                    color: '#f87171',
                    border: '1px solid rgba(239, 68, 68, 0.2)',
                  }}
                >
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3.5 rounded-xl font-semibold transition-all duration-300 hover:scale-[1.02]"
                style={{ 
                  background: 'linear-gradient(135deg, #B58AFF 0%, #9D6FE8 100%)',
                  color: '#1E2A26',
                  opacity: loading ? 0.7 : 1,
                  boxShadow: '0 4px 20px rgba(181, 138, 255, 0.4)'
                }}
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

            {/* Separator */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div 
                  className="w-full h-[1px]"
                  style={{
                    background: 'linear-gradient(90deg, transparent, rgba(168, 183, 138, 0.4), transparent)',
                  }}
                />
              </div>
              <div className="relative flex justify-center">
                <span 
                  className="px-4 text-sm"
                  style={{ 
                    backgroundColor: 'rgba(46, 62, 56, 0.98)',
                    color: '#A8B78A',
                  }}
                >
                  ou
                </span>
              </div>
            </div>

            {/* Demo account */}
            <button
              type="button"
              onClick={fillDemo}
              className="w-full py-3 rounded-xl font-medium transition-all duration-300 flex items-center justify-center gap-2 hover:scale-[1.02]"
              style={{ 
                backgroundColor: 'rgba(168, 183, 138, 0.1)',
                border: '2px solid rgba(168, 183, 138, 0.3)',
                color: '#A8B78A'
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#A8B78A';
                e.currentTarget.style.backgroundColor = 'rgba(168, 183, 138, 0.2)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(168, 183, 138, 0.3)';
                e.currentTarget.style.backgroundColor = 'rgba(168, 183, 138, 0.1)';
              }}
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
              </svg>
              Utiliser le compte démo
            </button>
          </div>

          {/* Register link */}
          <p className="text-center mt-6" style={{ color: '#A8B78A' }}>
            Pas encore de compte ?{' '}
            <Link 
              href="/register" 
              className="font-semibold transition-colors hover:underline"
              style={{ color: '#B58AFF' }}
            >
              S'inscrire gratuitement
            </Link>
          </p>

          {/* Footer */}
          <p className="text-center text-sm mt-4" style={{ color: 'rgba(168, 183, 138, 0.6)' }}>
            En continuant, vous acceptez nos{' '}
            <a href="#" className="hover:underline" style={{ color: '#A8B78A' }}>
              conditions d'utilisation
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
