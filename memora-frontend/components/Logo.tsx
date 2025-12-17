'use client';

interface LogoProps {
  size?: 'sm' | 'md' | 'lg' | 'xl';
  showText?: boolean;
  className?: string;
}

export default function Logo({ size = 'md', showText = false, className = '' }: LogoProps) {
  const sizes = {
    sm: { icon: 32, text: 'text-lg' },
    md: { icon: 40, text: 'text-xl' },
    lg: { icon: 56, text: 'text-2xl' },
    xl: { icon: 72, text: 'text-3xl' },
  };

  const { icon, text } = sizes[size];

  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <svg
        width={icon}
        height={icon}
        viewBox="0 0 80 80"
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
        className="flex-shrink-0"
      >
        {/* Définitions des dégradés */}
        <defs>
          {/* Dégradé principal turquoise vers violet */}
          <linearGradient id="gradient-main" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#06B6D4" />
            <stop offset="100%" stopColor="#8B5CF6" />
          </linearGradient>
          
          {/* Dégradé pour les lignes */}
          <linearGradient id="gradient-lines" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#06B6D4" stopOpacity="0.6" />
            <stop offset="100%" stopColor="#8B5CF6" stopOpacity="0.6" />
          </linearGradient>

          {/* Glow effect */}
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="2" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>

          {/* Glow plus intense pour le centre */}
          <filter id="glow-strong" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge>
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>

        {/* Cercle de fond avec dégradé subtil */}
        <circle cx="40" cy="40" r="38" fill="white" stroke="url(#gradient-main)" strokeWidth="2" opacity="0.1"/>
        
        {/* Lignes de connexion */}
        <g stroke="url(#gradient-lines)" strokeWidth="2" strokeLinecap="round">
          {/* Du centre vers les nœuds extérieurs */}
          <line x1="40" y1="40" x2="20" y2="20" opacity="0.7"/>
          <line x1="40" y1="40" x2="60" y2="20" opacity="0.7"/>
          <line x1="40" y1="40" x2="20" y2="60" opacity="0.7"/>
          <line x1="40" y1="40" x2="60" y2="60" opacity="0.7"/>
          <line x1="40" y1="40" x2="40" y2="12" opacity="0.7"/>
          <line x1="40" y1="40" x2="40" y2="68" opacity="0.7"/>
          <line x1="40" y1="40" x2="12" y2="40" opacity="0.7"/>
          <line x1="40" y1="40" x2="68" y2="40" opacity="0.7"/>
          
          {/* Connexions entre nœuds extérieurs */}
          <line x1="20" y1="20" x2="40" y2="12" opacity="0.4"/>
          <line x1="60" y1="20" x2="40" y2="12" opacity="0.4"/>
          <line x1="20" y1="20" x2="12" y2="40" opacity="0.4"/>
          <line x1="60" y1="20" x2="68" y2="40" opacity="0.4"/>
          <line x1="20" y1="60" x2="12" y2="40" opacity="0.4"/>
          <line x1="60" y1="60" x2="68" y2="40" opacity="0.4"/>
          <line x1="20" y1="60" x2="40" y2="68" opacity="0.4"/>
          <line x1="60" y1="60" x2="40" y2="68" opacity="0.4"/>
        </g>

        {/* Nœuds extérieurs - petits cercles */}
        <g filter="url(#glow)">
          {/* Coins */}
          <circle cx="20" cy="20" r="5" fill="#06B6D4"/>
          <circle cx="60" cy="20" r="5" fill="#22D3EE"/>
          <circle cx="20" cy="60" r="5" fill="#A78BFA"/>
          <circle cx="60" cy="60" r="5" fill="#8B5CF6"/>
          
          {/* Cardinaux */}
          <circle cx="40" cy="12" r="4" fill="#06B6D4"/>
          <circle cx="40" cy="68" r="4" fill="#8B5CF6"/>
          <circle cx="12" cy="40" r="4" fill="#22D3EE"/>
          <circle cx="68" cy="40" r="4" fill="#A78BFA"/>
        </g>

        {/* Nœud central - plus gros avec effet glow */}
        <g filter="url(#glow-strong)">
          <circle cx="40" cy="40" r="12" fill="url(#gradient-main)"/>
          <circle cx="40" cy="40" r="8" fill="white" opacity="0.3"/>
          <circle cx="40" cy="40" r="4" fill="white"/>
        </g>

        {/* Petits points décoratifs animés */}
        <circle cx="30" cy="28" r="2" fill="#06B6D4" opacity="0.5">
          <animate attributeName="opacity" values="0.5;1;0.5" dur="2s" repeatCount="indefinite"/>
        </circle>
        <circle cx="50" cy="52" r="2" fill="#8B5CF6" opacity="0.5">
          <animate attributeName="opacity" values="0.5;1;0.5" dur="2s" repeatCount="indefinite" begin="0.5s"/>
        </circle>
        <circle cx="52" cy="30" r="1.5" fill="#22D3EE" opacity="0.5">
          <animate attributeName="opacity" values="0.5;1;0.5" dur="2s" repeatCount="indefinite" begin="1s"/>
        </circle>
        <circle cx="28" cy="50" r="1.5" fill="#A78BFA" opacity="0.5">
          <animate attributeName="opacity" values="0.5;1;0.5" dur="2s" repeatCount="indefinite" begin="1.5s"/>
        </circle>
      </svg>

      {showText && (
        <span className={`font-bold text-gray-900 ${text}`}>
          Memora
        </span>
      )}
    </div>
  );
}
