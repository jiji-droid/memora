// ecosystem.config.js — Configuration PM2 pour Memora (production)
// Utilisation : pm2 start ecosystem.config.js
// Gère le backend API (Fastify) ET le frontend (Next.js)

module.exports = {
  apps: [
    // ── Backend API (Fastify sur port 3001) ──
    {
      name: 'memora-api',
      script: 'services/auth-service/src/index.js',
      cwd: '/opt/memora/memora-backend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',

      // NODE_ENV=production → index.js charge automatiquement .env.production
      env: {
        NODE_ENV: 'production',
      },

      // Logs
      error_file: '/var/log/memora/api-error.log',
      out_file: '/var/log/memora/api-output.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      // Restart automatique sur erreurs
      exp_backoff_restart_delay: 100,
      max_restarts: 10,
      min_uptime: '10s',
    },

    // ── Frontend Next.js (standalone sur port 3000) ──
    {
      name: 'memora-front',
      script: '.next/standalone/server.js',
      cwd: '/opt/memora/memora-frontend',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',

      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        HOSTNAME: '0.0.0.0',
        NEXT_PUBLIC_API_URL: 'https://api.memoras.ai',
      },

      // Logs
      error_file: '/var/log/memora/front-error.log',
      out_file: '/var/log/memora/front-output.log',
      log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
      merge_logs: true,

      exp_backoff_restart_delay: 100,
      max_restarts: 10,
      min_uptime: '10s',
    },
  ],
};
