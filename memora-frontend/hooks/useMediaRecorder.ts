'use client';

import { useState, useRef, useCallback, useEffect } from 'react';

export type RecordingState = 'idle' | 'requesting' | 'recording' | 'paused' | 'stopped';

interface UseMediaRecorderOptions {
  // Durée max en secondes (défaut: 30 min)
  maxDuration?: number;
  // Callback quand l'enregistrement est terminé
  onComplete?: (blob: Blob, duration: number) => void;
}

interface UseMediaRecorderReturn {
  state: RecordingState;
  duration: number;
  audioLevel: number;
  audioBlob: Blob | null;
  audioUrl: string | null;
  error: string | null;
  start: () => Promise<void>;
  stop: () => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  isSupported: boolean;
}

export function useMediaRecorder(options: UseMediaRecorderOptions = {}): UseMediaRecorderReturn {
  const { maxDuration = 1800, onComplete } = options;

  const [state, setState] = useState<RecordingState>('idle');
  const [duration, setDuration] = useState(0);
  const [audioLevel, setAudioLevel] = useState(0);
  const [audioBlob, setAudioBlob] = useState<Blob | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const startTimeRef = useRef<number>(0);
  const pausedDurationRef = useRef<number>(0);

  const isSupported = typeof window !== 'undefined' &&
    !!navigator.mediaDevices?.getUserMedia &&
    !!window.MediaRecorder;

  // Nettoyage à la destruction du composant
  useEffect(() => {
    return () => {
      cleanup();
    };
  }, []);

  function cleanup() {
    if (timerRef.current) clearInterval(timerRef.current);
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
    }
    if (audioUrl) URL.revokeObjectURL(audioUrl);
  }

  // Analyse du niveau audio en temps réel (pour la waveform)
  function startAudioAnalysis(stream: MediaStream) {
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    const analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);
    analyserRef.current = analyser;

    const dataArray = new Uint8Array(analyser.frequencyBinCount);

    function updateLevel() {
      if (!analyserRef.current) return;
      analyserRef.current.getByteFrequencyData(dataArray);
      // Moyenne des fréquences pour le niveau global
      const average = dataArray.reduce((sum, val) => sum + val, 0) / dataArray.length;
      setAudioLevel(average / 255); // Normaliser entre 0 et 1
      animFrameRef.current = requestAnimationFrame(updateLevel);
    }

    updateLevel();
  }

  const start = useCallback(async () => {
    if (!isSupported) {
      setError('L\'enregistrement audio n\'est pas supporté sur ce navigateur.');
      return;
    }

    setError(null);
    setState('requesting');

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 44100,
        },
      });

      streamRef.current = stream;

      // Déterminer le format supporté
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : MediaRecorder.isTypeSupported('audio/mp4')
          ? 'audio/mp4'
          : 'audio/webm';

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;
      chunksRef.current = [];

      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) {
          chunksRef.current.push(e.data);
        }
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: mimeType });
        const url = URL.createObjectURL(blob);
        setAudioBlob(blob);
        setAudioUrl(url);
        setState('stopped');

        // Arrêter l'analyse audio
        if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
        analyserRef.current = null;
        setAudioLevel(0);

        // Arrêter le stream
        stream.getTracks().forEach(track => track.stop());

        if (onComplete) {
          onComplete(blob, duration);
        }
      };

      // Démarrer l'enregistrement (chunks toutes les secondes)
      recorder.start(1000);
      setState('recording');
      startTimeRef.current = Date.now();
      pausedDurationRef.current = 0;

      // Timer pour la durée
      timerRef.current = setInterval(() => {
        const elapsed = Math.floor((Date.now() - startTimeRef.current) / 1000) - pausedDurationRef.current;
        setDuration(elapsed);

        // Durée max atteinte
        if (elapsed >= maxDuration) {
          recorder.stop();
          if (timerRef.current) clearInterval(timerRef.current);
        }
      }, 200);

      // Analyse audio pour la waveform
      startAudioAnalysis(stream);

    } catch (err) {
      setState('idle');
      if (err instanceof DOMException) {
        if (err.name === 'NotAllowedError') {
          setError('Permission micro refusée. Autorise l\'accès au microphone dans les paramètres du navigateur.');
        } else if (err.name === 'NotFoundError') {
          setError('Aucun microphone détecté sur cet appareil.');
        } else {
          setError(`Erreur microphone : ${err.message}`);
        }
      } else {
        setError('Erreur inattendue lors de l\'accès au microphone.');
      }
    }
  }, [isSupported, maxDuration, onComplete, duration]);

  const stop = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      mediaRecorderRef.current.stop();
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const pause = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.pause();
      setState('paused');
      if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current);
    }
  }, []);

  const resume = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'paused') {
      mediaRecorderRef.current.resume();
      setState('recording');
      // Reprendre l'analyse audio
      if (streamRef.current) startAudioAnalysis(streamRef.current);
    }
  }, []);

  const reset = useCallback(() => {
    cleanup();
    setState('idle');
    setDuration(0);
    setAudioLevel(0);
    setAudioBlob(null);
    setAudioUrl(null);
    setError(null);
    chunksRef.current = [];
  }, [audioUrl]);

  return {
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
  };
}
