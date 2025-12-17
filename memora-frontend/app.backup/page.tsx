'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { login, register, isLoggedIn } from '@/lib/api';
import Logo from '@/components/Logo';

export default function LoginPage() {
  const router = useRouter();
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

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
      if (isLogin) {
        await login(email, password);
      } else {
        await register(email, password, firstName, lastName);
      }
      router.push('/dashboard');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Une erreur est survenue');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden">
      {/* Fond dégradé style tl;dv */}
      <div className="absolute inset-0 bg-gradient-to-br from-cyan-50 via-white to-violet-50"></div>
      
      {/* Formes décoratives en arrière-plan */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {/* Grande forme turquoise en haut à gauche */}
        <div 
          className="absolute -top-40 -left-40 w-[600px] h-[600px] rounded-full opacity-30"
          style={{
            background: 'radial-gradient(circle, rgba(6,182,212,0.4) 0%, rgba(6,182,212,0) 70%)',
          }}
        ></div>
        
        {/* Grande forme violette en bas à droite */}
        <div 
          className="absolute -bottom-40 -right-40 w-[600px] h-[600px] rounded-full opacity-30"
          style={{
            background: 'radial-gradient(circle, rgba(139,92,246,0.4) 0%, rgba(139,92,246,0) 70%)',
          }}
        ></div>

        {/* Forme verte en bas à gauche */}
        <div 
          className="absolute bottom-20 -left-20 w-[400px] h-[400px] rounded-full opacity-20"
          style={{
            background: 'radial-gradient(circle, rgba(16,185,129,0.4) 0%, rgba(16,185,129,0) 70%)',
          }}
        ></div>

        {/* Petits cercles décoratifs */}
        <div className="absolute top-1/4 right-1/4 w-4 h-4 bg-cyan-400 rounded-full opacity-40 animate-pulse"></div>
        <div className="absolute top-1/3 left-1/4 w-3 h-3 bg-violet-400 rounded-full opacity-40 animate-pulse"></div>
        <div className="absolute bottom-1/3 right-1/3 w-5 h-5 bg-emerald-400 rounded-full opacity-30 animate-pulse"></div>
        <div className="absolute top-2/3 left-1/3 w-2 h-2 bg-cyan-500 rounded-full opacity-50 animate-pulse"></div>

        {/* Lignes décoratives subtiles */}
        <svg className="absolute top-0 left-0 w-full h-full opacity-[0.03]" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <pattern id="grid" width="60" height="60" patternUnits="userSpaceOnUse">
              <path d="M 60 0 L 0 0 0 60" fill="none" stroke="#06B6D4" strokeWidth="1"/>
            </pattern>
          </defs>
          <rect width="100%" height="100%" fill="url(#grid)" />
        </svg>
      </div>

      {/* Contenu principal */}
      <div className="relative z-10 min-h-screen flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Logo et titre */}
          <div className="text-center mb-8 animate-slide-down">
            <div className="flex justify-center mb-4">
              <div className="bg-white/80 backdrop-blur-sm p-3 rounded-2xl shadow-medium">
                <Logo size="lg" />
              </div>
            </div>
            <h1 className="text-3xl font-bold text-gray-900">
              Memora
            </h1>
            <p className="text-gray-600 mt-2">
              Vos réunions, <span className="text-transparent bg-clip-text bg-gradient-to-r from-cyan-500 to-violet-500 font-semibold">résumées par l'IA</span>
            </p>
          </div>

          {/* Carte de connexion */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-medium p-8 animate-slide-up">
            {/* Tabs */}
            <div className="flex mb-6 bg-gray-100 rounded-xl p-1.5">
              <button
                onClick={() => setIsLogin(true)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  isLogin
                    ? 'bg-white text-cyan-600 shadow-soft'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Connexion
              </button>
              <button
                onClick={() => setIsLogin(false)}
                className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-all duration-200 ${
                  !isLogin
                    ? 'bg-white text-cyan-600 shadow-soft'
                    : 'text-gray-500 hover:text-gray-700'
                }`}
              >
                Inscription
              </button>
            </div>

            {/* Formulaire */}
            <form onSubmit={handleSubmit} className="space-y-4">
              {!isLogin && (
                <div className="grid grid-cols-2 gap-4 animate-fade-in">
                  <div>
                    <label className="label">Prénom</label>
                    <input
                      type="text"
                      value={firstName}
                      onChange={(e) => setFirstName(e.target.value)}
                      className="input"
                      placeholder="Jean"
                    />
                  </div>
                  <div>
                    <label className="label">Nom</label>
                    <input
                      type="text"
                      value={lastName}
                      onChange={(e) => setLastName(e.target.value)}
                      className="input"
                      placeholder="Dupont"
                    />
                  </div>
                </div>
              )}

              <div>
                <label className="label">Email</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  className="input"
                  placeholder="jean@exemple.com"
                />
              </div>

              <div>
                <label className="label">Mot de passe</label>
                <input
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  minLength={8}
                  className="input"
                  placeholder="••••••••"
                />
                {!isLogin && (
                  <p className="text-xs text-gray-400 mt-1.5">
                    Minimum 8 caractères
                  </p>
                )}
              </div>

              {error && (
                <div className="bg-red-50 text-red-600 px-4 py-3 rounded-xl text-sm flex items-center gap-2 animate-fade-in">
                  <svg className="w-5 h-5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className="btn btn-primary w-full"
              >
                {loading ? (
                  <span className="flex items-center justify-center gap-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Chargement...
                  </span>
                ) : isLogin ? (
                  'Se connecter'
                ) : (
                  "S'inscrire"
                )}
              </button>
            </form>

            {/* Séparateur */}
            <div className="relative my-6">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-gray-200"></div>
              </div>
              <div className="relative flex justify-center">
                <span className="bg-white/80 px-4 text-sm text-gray-400">ou</span>
              </div>
            </div>

            {/* Compte démo */}
            <div className="text-center">
              <p className="text-sm text-gray-500 mb-3">Tester avec le compte démo</p>
              <button
                type="button"
                onClick={() => {
                  setEmail('demo@memora.ai');
                  setPassword('password123');
                  setIsLogin(true);
                }}
                className="btn btn-outline btn-sm"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
                Utiliser le compte démo
              </button>
            </div>
          </div>

          {/* Footer */}
          <p className="text-center text-sm text-gray-400 mt-6">
            En continuant, vous acceptez nos{' '}
            <a href="#" className="text-cyan-500 hover:underline">conditions d'utilisation</a>
          </p>
        </div>
      </div>
    </div>
  );
}
