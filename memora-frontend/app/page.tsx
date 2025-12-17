'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { isLoggedIn } from '@/lib/api';

export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    // Rediriger vers dashboard si connecté, sinon vers login
    if (isLoggedIn()) {
      router.push('/dashboard');
    } else {
      router.push('/login');
    }
  }, [router]);

  // Afficher un écran de chargement pendant la redirection
  return (
    <div className="min-h-screen flex items-center justify-center" style={{ backgroundColor: '#1E2A26' }}>
      {/* Aurora background effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div 
          className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(181,138,255,0.2) 0%, transparent 60%)',
            filter: 'blur(80px)',
          }}
        />
        <div 
          className="absolute -bottom-40 -left-40 w-[600px] h-[600px] rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(168,183,138,0.15) 0%, transparent 60%)',
            filter: 'blur(80px)',
          }}
        />
      </div>

      {/* Loading spinner */}
      <div className="relative z-10 text-center">
        <img 
          src="/memora-logo.png" 
          alt="Memora" 
          className="h-24 w-auto mx-auto mb-6 animate-pulse"
        />
        <div 
          className="w-8 h-8 border-2 border-t-transparent rounded-full animate-spin mx-auto"
          style={{ borderColor: '#B58AFF', borderTopColor: 'transparent' }}
        />
        <p className="mt-4 text-sm" style={{ color: '#A8B78A' }}>
          Chargement...
        </p>
      </div>
    </div>
  );
}
