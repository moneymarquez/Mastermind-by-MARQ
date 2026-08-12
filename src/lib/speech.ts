// Wraps the Web Speech API's SpeechRecognition (webkit-prefixed on Safari/
// iOS, unprefixed on Chrome/Edge). Not part of TypeScript's standard DOM
// lib — these are non-standard, browser-vendor-specific types — so the
// minimal shapes actually used are declared here rather than pulling in a
// third-party @types package for a handful of fields.
// KNOWN LIMITATION: unsupported in Firefox and some in-app WebViews — always
// feature-detect with isSpeechRecognitionSupported() before using this.

interface SpeechRecognitionResultLike {
  isFinal: boolean;
  0: { transcript: string };
}
interface SpeechRecognitionEventLike {
  resultIndex: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
}
interface SpeechRecognitionErrorEventLike {
  error: string;
}
interface SpeechRecognitionLike {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start(): void;
  stop(): void;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onerror: ((event: SpeechRecognitionErrorEventLike) => void) | null;
  onend: (() => void) | null;
}
interface SpeechRecognitionConstructorLike {
  new (): SpeechRecognitionLike;
}
interface WindowWithSpeech extends Window {
  SpeechRecognition?: SpeechRecognitionConstructorLike;
  webkitSpeechRecognition?: SpeechRecognitionConstructorLike;
}

function getConstructor(): SpeechRecognitionConstructorLike | null {
  if (typeof window === 'undefined') return null;
  const w = window as WindowWithSpeech;
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function isSpeechRecognitionSupported(): boolean {
  return getConstructor() !== null;
}

export interface SpeechRecognizerHandle {
  stop: () => void;
}

/** Starts listening immediately. `onTranscript` fires repeatedly with the
 *  live interim text as you speak, then once more with `isFinal: true` for
 *  the settled phrase. `onEnd` fires when recognition stops, whether from
 *  natural silence, an explicit `.stop()`, or an error. Returns null (and
 *  calls neither callback) if the browser doesn't support this at all. */
export function startListening(opts: {
  onTranscript: (text: string, isFinal: boolean) => void;
  onEnd: () => void;
  onError?: (message: string) => void;
}): SpeechRecognizerHandle | null {
  const Ctor = getConstructor();
  if (!Ctor) return null;

  const recognition = new Ctor();
  recognition.continuous = false;
  recognition.interimResults = true;
  recognition.lang = 'en-US';

  recognition.onresult = (event) => {
    let finalText = '';
    let interimText = '';
    for (let i = event.resultIndex; i < event.results.length; i++) {
      const result = event.results[i];
      if (result.isFinal) finalText += result[0].transcript;
      else interimText += result[0].transcript;
    }
    if (finalText) opts.onTranscript(finalText.trim(), true);
    else if (interimText) opts.onTranscript(interimText.trim(), false);
  };
  recognition.onerror = (event) => {
    // "no-speech"/"aborted" are routine (silence timeout, explicit stop) —
    // only surface anything to the caller for real failures.
    if (event.error !== 'no-speech' && event.error !== 'aborted') {
      opts.onError?.(event.error);
    }
  };
  recognition.onend = () => opts.onEnd();

  try {
    recognition.start();
  } catch {
    return null;
  }
  return { stop: () => recognition.stop() };
}
