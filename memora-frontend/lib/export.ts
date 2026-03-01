/**
 * MEMORA — Export PDF
 *
 * Génère un PDF propre via la fonction d'impression du navigateur.
 * Zéro dépendance externe, supporte parfaitement les accents français.
 */

import type { Source } from './types';

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('fr-CA', {
    day: 'numeric', month: 'long', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatDuration(seconds: number | null): string {
  if (!seconds) return '';
  const min = Math.floor(seconds / 60);
  const sec = seconds % 60;
  if (min === 0) return `${sec}s`;
  return `${min}min${sec > 0 ? ` ${sec}s` : ''}`;
}

function getTypeLabel(type: string): string {
  const labels: Record<string, string> = {
    text: 'Texte', meeting: 'Meeting', voice_note: 'Note vocale',
    document: 'Document', upload: 'Fichier',
  };
  return labels[type] || type;
}

/**
 * Exporte une source en PDF via impression navigateur.
 * Ouvre une fenêtre avec le contenu formaté et déclenche l'impression.
 */
export function exportSourcePDF(source: Source, spaceName?: string) {
  const typeLabel = getTypeLabel(source.type);
  const dateCreation = formatDate(source.createdAt);
  const duree = source.durationSeconds ? formatDuration(source.durationSeconds) : null;

  // Contenu principal (transcription ou texte)
  const contenuHtml = source.content
    ? `<pre class="contenu">${escapeHtml(source.content)}</pre>`
    : '<p class="vide">Aucun contenu disponible.</p>';

  // Résumé
  const resumeHtml = source.summary
    ? `<h2>Résumé</h2>
       <pre class="contenu">${escapeHtml(source.summary)}</pre>
       ${source.summaryModel ? `<p class="modele">Modèle : ${escapeHtml(source.summaryModel)}</p>` : ''}`
    : '';

  // Métadonnées
  const metadataItems = [
    `<tr><td>Type</td><td>${escapeHtml(typeLabel)}</td></tr>`,
    duree ? `<tr><td>Durée</td><td>${escapeHtml(duree)}</td></tr>` : '',
    source.speakers && source.speakers.length > 0
      ? `<tr><td>Participants</td><td>${source.speakers.map(s => escapeHtml(s)).join(', ')}</td></tr>`
      : '',
    `<tr><td>Créée le</td><td>${escapeHtml(dateCreation)}</td></tr>`,
  ].filter(Boolean).join('\n');

  const html = `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8">
  <title>${escapeHtml(source.nom)} — Memoras</title>
  <style>
    @page {
      margin: 2cm;
      size: A4;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      color: #1a1a2e;
      line-height: 1.6;
      font-size: 11pt;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      border-bottom: 3px solid #09307e;
      padding-bottom: 12px;
      margin-bottom: 24px;
    }
    .header h1 {
      font-size: 18pt;
      color: #09307e;
      margin-bottom: 4px;
    }
    .header .meta {
      font-size: 9pt;
      color: #4a5568;
    }
    .header .logo {
      font-size: 10pt;
      font-weight: bold;
      color: #09307e;
    }
    .header .logo span {
      color: #f58820;
    }
    .badge {
      display: inline-block;
      background: #e8edf5;
      color: #09307e;
      padding: 2px 8px;
      border-radius: 4px;
      font-size: 9pt;
      font-weight: 600;
    }
    h2 {
      font-size: 13pt;
      color: #09307e;
      margin-top: 24px;
      margin-bottom: 12px;
      padding-bottom: 4px;
      border-bottom: 1px solid #e8edf5;
    }
    .contenu {
      white-space: pre-wrap;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      font-size: 10pt;
      line-height: 1.7;
      background: #f8f9fa;
      padding: 16px;
      border-radius: 6px;
      border: 1px solid #e8edf5;
    }
    .vide {
      color: #4a5568;
      font-style: italic;
      padding: 16px;
    }
    .modele {
      font-size: 9pt;
      color: #4a5568;
      margin-top: 8px;
    }
    table.infos {
      width: 100%;
      border-collapse: collapse;
      font-size: 10pt;
    }
    table.infos td {
      padding: 6px 0;
      border-bottom: 1px solid #f0f2f8;
    }
    table.infos td:first-child {
      color: #4a5568;
      width: 140px;
    }
    .footer {
      margin-top: 32px;
      padding-top: 12px;
      border-top: 1px solid #e8edf5;
      font-size: 8pt;
      color: #a0aec0;
      text-align: center;
    }
    @media print {
      body { print-color-adjust: exact; -webkit-print-color-adjust: exact; }
    }
  </style>
</head>
<body>
  <div class="header">
    <div>
      <h1>${escapeHtml(source.nom)}</h1>
      <div class="meta">
        <span class="badge">${escapeHtml(typeLabel)}</span>
        ${spaceName ? ` &mdash; ${escapeHtml(spaceName)}` : ''}
        &mdash; ${escapeHtml(dateCreation)}
        ${duree ? ` &mdash; ${escapeHtml(duree)}` : ''}
      </div>
    </div>
    <div class="logo">Memoras<span>.</span>ai</div>
  </div>

  <h2>${source.type === 'meeting' || source.type === 'voice_note' ? 'Transcription' : 'Contenu'}</h2>
  ${contenuHtml}

  ${resumeHtml}

  <h2>Informations</h2>
  <table class="infos">
    ${metadataItems}
  </table>

  <div class="footer">
    Exporté depuis Memoras.ai &mdash; ${new Date().toLocaleDateString('fr-CA')}
  </div>

  <script>
    window.onload = function() {
      window.print();
    };
  </script>
</body>
</html>`;

  // Ouvre dans un nouvel onglet et déclenche l'impression
  const fenetre = window.open('', '_blank');
  if (fenetre) {
    fenetre.document.write(html);
    fenetre.document.close();
  }
}
