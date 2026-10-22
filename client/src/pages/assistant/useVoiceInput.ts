// Voice input with the browser's built-in speech recognition (Chrome, Edge, Safari).
import { useRef, useState } from 'react';

const SPEECH_LANG: Record<string, string> = {
  en: 'en-IN', hi: 'hi-IN', ta: 'ta-IN', te: 'te-IN', kn: 'kn-IN', ml: 'ml-IN', bn: 'bn-IN', mr: 'mr-IN', gu: 'gu-IN',
  es: 'es-ES', fr: 'fr-FR', ar: 'ar-SA'
};

export function useVoiceInput(lang: string, onHeard: (text: string) => void, onError: (message: string) => void) {
  const [listening, setListening] = useState(false);
  const rec = useRef<any>(null);

  const start = () => {
    const w = window as any;
    const SR = w.SpeechRecognition || w.webkitSpeechRecognition;
    if (!SR) { onError('Voice input is not supported in this browser. Try Chrome.'); return; }
    if (listening) { rec.current?.stop(); return; }
    const r = new SR();
    r.lang = SPEECH_LANG[lang] || 'en-IN';
    r.interimResults = false;
    r.onresult = (e: any) => onHeard(e.results[0][0].transcript);
    r.onerror = (e: any) => { setListening(false); if (e.error === 'not-allowed') onError('Allow microphone access to use voice input.'); };
    r.onend = () => setListening(false);
    rec.current = r;
    setListening(true);
    r.start();
  };

  return { listening, start };
}
