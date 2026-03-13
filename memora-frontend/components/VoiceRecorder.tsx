'use client';

import React, { useState, useRef, useEffect } from 'react';
import { useMediaRecorder, RecordingState } from '@/hooks/useMediaRecorder';

interface VoiceRecorderProps {
  onRecordingComplete: (blob: Blob, duration: number, nom: string) => void;
  onCancel: () => void;
}

export default function VoiceRecorder({ onRecordingComplete, onCancel }: VoiceRecorderProps) {
  const [nom, setNom] = useState('');
  const [showNomInput, setShowNomInput] = useState(false);
  const waveformBarsRef = useRef<number[]>(Array(24).fill(0));

  const {
    state,
    duration,
    audioLevel,
    audioBlob,
    audioUrl,
    error,
    start,
    stop,
    pause,
    resume,
    reset,
    isSupported,
  } = useMediaRecorder({ maxDuration: 1800 });

  // Mettre à jour les barres de la waveform en temps réel
  useEffect(() => {
    if (state === 'recording') {
      waveformBarsRef.current = [
        ...waveformBarsRef.current.slice(1),
        audioLevel,
      ];
    }
  }, [audioLevel, state]);

  function formatTime(seconds: number): string {
    const min = Math.floor(seconds / 60);
    const sec = seconds % 60;
    return `${min.toString().padStart(2, '0')}:${sec.toString().padStart(2, '0')}`;
  }

  function genererNomDefaut(): string {
    const maintenant = new Date();
    return `Note vocale ${maintenant.toLocaleDateString('fr-CA', {
      day: 'numeric', month: 'short',
    })} ${maintenant.toLocaleTimeString('fr-CA', {
      hour: '2-digit', minute: '2-digit',
    })}`;
  }

  function handleSend() {
    if (!audioBlob) return;
    const nomFinal = nom.trim() || genererNomDefaut();
    onRecordingComplete(audioBlob, duration, nomFinal);
  }

  function handleStopAndName() {
    stop();
    setShowNomInput(true);
  }

  if (!isSupported) {
    return (
      <div className="p-6 text-center">
        <div className="w-14 h-14 mx-auto mb-3 rounded-full bg-error-50 flex items-center justify-center">
          <svg className="w-7 h-7 text-error-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
        </div>
        <p className="text-sm font-medium text-[var(--color-text-primary)] mb-1">Navigateur non supporté</p>
        <p className="text-xs text-[var(--color-text-secondary)]">
          L&apos;enregistrement vocal nécessite un navigateur moderne (Chrome, Safari, Firefox).
        </p>
        <button onClick={onCancel} className="btn btn-ghost btn-sm mt-4">Fermer</button>
      </div>
    );
  }

  // === ÉTAT : ENREGISTREMENT TERMINÉ — NOMMER ET ENVOYER ===
  if (state === 'stopped' && showNomInput) {
    return (
      <div className="p-5 space-y-4 animate-fade-in">
        <div className="text-center">
          <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-green-50 flex items-center justify-center">
            <svg className="w-6 h-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <p className="text-sm font-semibold text-[var(--color-text-primary)]">
            {formatTime(duration)} enregistré
          </p>
        </div>

        {/* Lecteur audio preview */}
        {audioUrl && (
          <audio controls src={audioUrl} className="w-full h-10" />
        )}

        {/* Nom de la note */}
        <div>
          <label className="label">Nom de la note vocale</label>
          <input
            autoFocus
            type="text"
            value={nom}
            onChange={(e) => setNom(e.target.value)}
            placeholder={genererNomDefaut()}
            className="input text-sm"
          />
        </div>

        {/* Boutons */}
        <div className="flex gap-3">
          <button
            onClick={() => { reset(); setShowNomInput(false); }}
            className="btn btn-ghost btn-sm flex-1"
          >
            Recommencer
          </button>
          <button onClick={onCancel} className="btn btn-outline btn-sm flex-1">
            Annuler
          </button>
          <button onClick={handleSend} className="btn btn-primary btn-sm flex-1">
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
            </svg>
            Envoyer
          </button>
        </div>
      </div>
    );
  }

  // === ÉTAT : IDLE / RECORDING / PAUSED ===
  return (
    <div className="p-5 space-y-5 animate-fade-in">
      {/* Erreur */}
      {error && (
        <div className="p-3 rounded-lg bg-error-50 text-error-600 text-sm">
          {error}
        </div>
      )}

      {/* Waveform + Timer */}
      <div className="text-center">
        {/* Timer */}
        <div className="mb-4">
          <span className={`text-3xl font-bold tabular-nums ${
            state === 'recording'
              ? 'text-[var(--color-accent-secondary)]'
              : state === 'paused'
                ? 'text-[var(--color-text-secondary)]'
                : 'text-[var(--color-text-primary)]'
          }`}>
            {formatTime(duration)}
          </span>
          {state === 'recording' && (
            <span className="ml-2 text-xs text-[var(--color-text-secondary)]">
              max {formatTime(1800)}
            </span>
          )}
        </div>

        {/* Waveform visuelle */}
        <div className="flex items-center justify-center gap-[3px] h-16 mb-4">
          {waveformBarsRef.current.map((level, i) => {
            const height = state === 'recording' || state === 'paused'
              ? Math.max(4, level * 64)
              : 4;
            return (
              <div
                key={i}
                className="w-[6px] rounded-full transition-all duration-150"
                style={{
                  height: `${height}px`,
                  backgroundColor: state === 'recording'
                    ? `var(--color-accent-secondary)`
                    : state === 'paused'
                      ? `var(--color-text-secondary)`
                      : `var(--color-border)`,
                  opacity: state === 'recording' ? 0.5 + (level * 0.5) : 0.3,
                }}
              />
            );
          })}
        </div>

        {/* Indicateur d'état */}
        {state === 'recording' && (
          <div className="flex items-center justify-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 animate-pulse-soft" />
            <span className="text-xs font-medium text-[var(--color-text-secondary)]">Enregistrement en cours</span>
          </div>
        )}
        {state === 'paused' && (
          <div className="flex items-center justify-center gap-2">
            <div className="w-2.5 h-2.5 rounded-full bg-yellow-500" />
            <span className="text-xs font-medium text-[var(--color-text-secondary)]">En pause</span>
          </div>
        )}
        {state === 'idle' && !error && (
          <p className="text-xs text-[var(--color-text-secondary)]">
            Appuie sur le bouton pour commencer l&apos;enregistrement
          </p>
        )}
      </div>

      {/* Boutons de contrôle */}
      <div className="flex items-center justify-center gap-4">
        {state === 'idle' && (
          <>
            <button onClick={onCancel} className="btn btn-ghost btn-sm">
              Annuler
            </button>
            <button
              onClick={start}
              className="w-28 h-28 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95"
              style={{
                background: 'linear-gradient(135deg, #f58820 0%, #f5a623 100%)',
                boxShadow: '0 6px 30px rgba(245, 136, 32, 0.5)',
              }}
              title="Commencer l'enregistrement"
            >
              <svg className="w-12 h-12 text-white" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 14c1.66 0 3-1.34 3-3V5c0-1.66-1.34-3-3-3S9 3.34 9 5v6c0 1.66 1.34 3 3 3z" />
                <path d="M17 11c0 2.76-2.24 5-5 5s-5-2.24-5-5H5c0 3.53 2.61 6.43 6 6.92V21h2v-3.08c3.39-.49 6-3.39 6-6.92h-2z" />
              </svg>
            </button>
          </>
        )}

        {state === 'recording' && (
          <>
            {/* Pause */}
            <button
              onClick={pause}
              className="w-12 h-12 rounded-full flex items-center justify-center bg-[var(--color-bg-hover)] hover:bg-[var(--color-border)] transition-colors"
              title="Pause"
            >
              <svg className="w-5 h-5 text-[var(--color-text-primary)]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M6 19h4V5H6v14zm8-14v14h4V5h-4z" />
              </svg>
            </button>

            {/* Stop (gros bouton) */}
            <button
              onClick={handleStopAndName}
              className="w-28 h-28 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95 animate-glow"
              style={{
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                boxShadow: '0 6px 30px rgba(239, 68, 68, 0.5)',
              }}
              title="Arrêter l'enregistrement"
            >
              <div className="w-8 h-8 bg-white rounded-sm" />
            </button>

            {/* Annuler */}
            <button
              onClick={() => { stop(); reset(); }}
              className="w-12 h-12 rounded-full flex items-center justify-center bg-[var(--color-bg-hover)] hover:bg-[var(--color-border)] transition-colors"
              title="Annuler"
            >
              <svg className="w-5 h-5 text-[var(--color-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </>
        )}

        {state === 'paused' && (
          <>
            {/* Reprendre */}
            <button
              onClick={resume}
              className="w-12 h-12 rounded-full flex items-center justify-center bg-[var(--color-bg-hover)] hover:bg-[var(--color-border)] transition-colors"
              title="Reprendre"
            >
              <svg className="w-5 h-5 text-[var(--color-accent-secondary)]" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>

            {/* Stop */}
            <button
              onClick={handleStopAndName}
              className="w-16 h-16 rounded-full flex items-center justify-center transition-all hover:scale-105 active:scale-95"
              style={{
                background: 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
                boxShadow: '0 4px 20px rgba(239, 68, 68, 0.4)',
              }}
              title="Terminer l'enregistrement"
            >
              <div className="w-6 h-6 bg-white rounded-sm" />
            </button>

            {/* Annuler */}
            <button
              onClick={() => { reset(); }}
              className="w-12 h-12 rounded-full flex items-center justify-center bg-[var(--color-bg-hover)] hover:bg-[var(--color-border)] transition-colors"
              title="Annuler"
            >
              <svg className="w-5 h-5 text-[var(--color-text-secondary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </>
        )}
      </div>
    </div>
  );
}
