'use client';

import { useState } from 'react';

interface ExportButtonsProps {
  meetingId: number;
  hasTranscript: boolean;
  hasSummary: boolean;
}

export default function ExportButtons({ meetingId, hasTranscript, hasSummary }: ExportButtonsProps) {
  const [exporting, setExporting] = useState<string | null>(null);
  const [showMenu, setShowMenu] = useState(false);

  const handleExport = async (type: 'transcript' | 'summary', format: 'pdf' | 'docx') => {
    const token = localStorage.getItem('memora_token');
    if (!token) return;

    setExporting(`${type}-${format}`);
    setShowMenu(false);

    try {
      const response = await fetch(
        `http://localhost:3001/export/${type}/${meetingId}/${format}`,
        {
          headers: {
            'Authorization': `Bearer ${token}`
          }
        }
      );

      if (!response.ok) {
        throw new Error('Erreur export');
      }

      // Télécharger le fichier
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      
      // Extraire le nom du fichier depuis les headers
      const contentDisposition = response.headers.get('Content-Disposition');
      let filename = `memora-${type}-${meetingId}.${format}`;
      if (contentDisposition) {
        const match = contentDisposition.match(/filename="(.+)"/);
        if (match) filename = match[1];
      }
      
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

    } catch (error) {
      console.error('Erreur export:', error);
      alert('Erreur lors de l\'export. Veuillez réessayer.');
    } finally {
      setExporting(null);
    }
  };

  if (!hasTranscript && !hasSummary) {
    return null;
  }

  return (
    <div className="relative">
      <button
        onClick={() => setShowMenu(!showMenu)}
        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-cyan-500 to-violet-500 text-white rounded-lg hover:from-cyan-600 hover:to-violet-600 transition-all shadow-md hover:shadow-lg"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
        </svg>
        Exporter
        <svg className={`w-4 h-4 transition-transform ${showMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {showMenu && (
        <>
          {/* Overlay pour fermer le menu */}
          <div 
            className="fixed inset-0 z-10" 
            onClick={() => setShowMenu(false)}
          />
          
          {/* Menu dropdown */}
          <div className="absolute right-0 mt-2 w-64 bg-white rounded-xl shadow-xl border border-gray-100 z-20 overflow-hidden">
            {/* En-tête */}
            <div className="px-4 py-3 bg-gradient-to-r from-cyan-50 to-violet-50 border-b border-gray-100">
              <p className="text-sm font-medium text-gray-700">Choisir le format d'export</p>
            </div>

            {/* Options de transcription */}
            {hasTranscript && (
              <div className="p-2">
                <p className="px-2 py-1 text-xs font-medium text-gray-400 uppercase tracking-wide">
                  Transcription
                </p>
                <button
                  onClick={() => handleExport('transcript', 'pdf')}
                  disabled={exporting !== null}
                  className="w-full flex items-center gap-3 px-3 py-2 text-left text-gray-700 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50"
                >
                  {exporting === 'transcript-pdf' ? (
                    <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span className="text-red-500 text-lg">PDF</span>
                  )}
                  <span>Télécharger en PDF</span>
                </button>
                <button
                  onClick={() => handleExport('transcript', 'docx')}
                  disabled={exporting !== null}
                  className="w-full flex items-center gap-3 px-3 py-2 text-left text-gray-700 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50"
                >
                  {exporting === 'transcript-docx' ? (
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span className="text-blue-500 text-lg">DOC</span>
                  )}
                  <span>Télécharger en Word</span>
                </button>
              </div>
            )}

            {/* Séparateur */}
            {hasTranscript && hasSummary && (
              <div className="border-t border-gray-100" />
            )}

            {/* Options de résumé */}
            {hasSummary && (
              <div className="p-2">
                <p className="px-2 py-1 text-xs font-medium text-gray-400 uppercase tracking-wide">
                  Résumé
                </p>
                <button
                  onClick={() => handleExport('summary', 'pdf')}
                  disabled={exporting !== null}
                  className="w-full flex items-center gap-3 px-3 py-2 text-left text-gray-700 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50"
                >
                  {exporting === 'summary-pdf' ? (
                    <div className="w-5 h-5 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span className="text-red-500 text-lg">PDF</span>
                  )}
                  <span>Télécharger en PDF</span>
                </button>
                <button
                  onClick={() => handleExport('summary', 'docx')}
                  disabled={exporting !== null}
                  className="w-full flex items-center gap-3 px-3 py-2 text-left text-gray-700 hover:bg-gray-50 rounded-lg transition-colors disabled:opacity-50"
                >
                  {exporting === 'summary-docx' ? (
                    <div className="w-5 h-5 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                  ) : (
                    <span className="text-blue-500 text-lg">DOC</span>
                  )}
                  <span>Télécharger en Word</span>
                </button>
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
