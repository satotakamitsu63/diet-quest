import { useCallback, useEffect, useRef, useState } from 'react';

type SpeechRecognitionAlternative = { transcript: string };
type SpeechRecognitionResult = { 0: SpeechRecognitionAlternative; isFinal: boolean; length: number };
type SpeechRecognitionResultList = { length: number; [index: number]: SpeechRecognitionResult };

type SpeechRecognitionEventLike = {
  resultIndex: number;
  results: SpeechRecognitionResultList;
};

type SpeechRecognitionLike = {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  start: () => void;
  stop: () => void;
  abort: () => void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

function resolveConstructor(): SpeechRecognitionConstructor | null {
  const globalWindow = window as unknown as {
    SpeechRecognition?: SpeechRecognitionConstructor;
    webkitSpeechRecognition?: SpeechRecognitionConstructor;
  };
  return globalWindow.SpeechRecognition ?? globalWindow.webkitSpeechRecognition ?? null;
}

export type SpeechRecognitionState = {
  isSupported: boolean;
  isListening: boolean;
  /** 確定した文字列 */
  transcript: string;
  /** 認識途中の文字列 */
  interimTranscript: string;
  error: string | null;
  start: () => void;
  stop: () => void;
  reset: () => void;
};

/** ブラウザの音声認識を日本語で使う。対応していない環境では isSupported が false になる。 */
export function useSpeechRecognition(): SpeechRecognitionState {
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const [isListening, setIsListening] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [interimTranscript, setInterimTranscript] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isSupported] = useState(() => resolveConstructor() !== null);

  useEffect(() => {
    const Constructor = resolveConstructor();
    if (!Constructor) return undefined;

    const recognition = new Constructor();
    recognition.lang = 'ja-JP';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onresult = (event) => {
      let finalText = '';
      let interimText = '';
      for (let index = event.resultIndex; index < event.results.length; index += 1) {
        const result = event.results[index];
        if (result.isFinal) finalText += result[0].transcript;
        else interimText += result[0].transcript;
      }
      if (finalText) setTranscript((current) => current + finalText);
      setInterimTranscript(interimText);
    };

    recognition.onerror = (event) => {
      setError(
        event.error === 'not-allowed' || event.error === 'service-not-allowed'
          ? 'このページではマイクを使えません。下の入力欄をタップして、キーボードのマイクキーから話してください。'
          : `音声認識でエラーが起きました（${event.error}）。入力欄のキーボードのマイクキーからは話せます。`,
      );
      setIsListening(false);
    };

    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;

    return () => {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      recognition.abort();
    };
  }, []);

  const start = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;
    setError(null);
    setInterimTranscript('');
    try {
      recognition.start();
      setIsListening(true);
    } catch {
      // すでに開始しているときは start() が例外を投げるので、状態だけ合わせる
      setIsListening(true);
    }
  }, []);

  const stop = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const reset = useCallback(() => {
    setTranscript('');
    setInterimTranscript('');
    setError(null);
  }, []);

  return { isSupported, isListening, transcript, interimTranscript, error, start, stop, reset };
}
