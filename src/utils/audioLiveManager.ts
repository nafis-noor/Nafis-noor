/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { getGlobalLanguage } from './i18n';

// PCM conversion and Audio streaming utilities for Gemini Live API & TTS

export interface LiveTranscriptEntry {
  id: string;
  sender: 'user' | 'noor';
  text: string;
  isComplete: boolean;
  timestamp: string;
}

export type LiveConnectionState = 'idle' | 'connecting' | 'connected' | 'listening' | 'speaking' | 'error';

export interface LiveSessionCallbacks {
  onStateChange: (state: LiveConnectionState) => void;
  onTranscriptUpdate: (transcripts: LiveTranscriptEntry[]) => void;
  onUserVolume: (volume: number) => void; // 0 to 1
  onAiVolume: (volume: number) => void;   // 0 to 1
  onError: (errorMsg: string) => void;
}

/**
 * Converts Float32Array (Web Audio API buffer) to 16-bit PCM Little Endian Base64
 */
export function floatTo16BitPCMBase64(float32Array: Float32Array): string {
  const buffer = new ArrayBuffer(float32Array.length * 2);
  const view = new DataView(buffer);
  for (let i = 0; i < float32Array.length; i++) {
    let s = Math.max(-1, Math.min(1, float32Array[i]));
    view.setInt16(i * 2, s < 0 ? s * 0x8000 : s * 0x7fff, true);
  }

  let binary = '';
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + chunkSize))
    );
  }
  return btoa(binary);
}

/**
 * Converts Base64 16-bit PCM (from Gemini Live API / TTS at 24kHz) to an AudioBuffer
 */
export function base64PCMToAudioBuffer(
  base64Data: string,
  audioCtx: AudioContext,
  sampleRate: number = 24000
): AudioBuffer {
  const binaryString = atob(base64Data);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  const int16Array = new Int16Array(bytes.buffer);
  const float32Array = new Float32Array(int16Array.length);
  for (let i = 0; i < int16Array.length; i++) {
    float32Array[i] = int16Array[i] / (int16Array[i] < 0 ? 32768 : 32767);
  }

  const audioBuffer = audioCtx.createBuffer(1, float32Array.length, sampleRate);
  audioBuffer.getChannelData(0).set(float32Array);
  return audioBuffer;
}

/**
 * Resamples Float32 audio to target sample rate (16000 Hz for Gemini Live input)
 */
export function resampleAudioBuffer(
  inputData: Float32Array,
  fromSampleRate: number,
  toSampleRate: number = 16000
): Float32Array {
  if (fromSampleRate === toSampleRate) {
    return inputData;
  }
  const ratio = fromSampleRate / toSampleRate;
  const newLength = Math.round(inputData.length / ratio);
  const result = new Float32Array(newLength);
  let offsetResult = 0;
  let offsetInput = 0;

  while (offsetResult < result.length) {
    const nextOffsetInput = Math.round((offsetResult + 1) * ratio);
    let accum = 0;
    let count = 0;
    for (let i = offsetInput; i < nextOffsetInput && i < inputData.length; i++) {
      accum += inputData[i];
      count++;
    }
    result[offsetResult] = count > 0 ? accum / count : 0;
    offsetResult++;
    offsetInput = nextOffsetInput;
  }
  return result;
}

export class LiveVoiceSession {
  private ws: WebSocket | null = null;
  private inputAudioCtx: AudioContext | null = null;
  private outputAudioCtx: AudioContext | null = null;
  private mediaStream: MediaStream | null = null;
  private scriptProcessor: ScriptProcessorNode | null = null;
  private micSource: MediaStreamAudioSourceNode | null = null;
  private micAnalyser: AnalyserNode | null = null;
  private outAnalyser: AnalyserNode | null = null;
  private nextPlayTime: number = 0;
  private isMuted: boolean = false;
  private activeSourceNodes: AudioBufferSourceNode[] = [];
  private callbacks: LiveSessionCallbacks;
  private transcripts: LiveTranscriptEntry[] = [];
  private voiceName: string = 'Fenrir';
  private animFrameId: number | null = null;
  private isConnecting: boolean = false;

  constructor(callbacks: LiveSessionCallbacks, voiceName: string = 'Fenrir') {
    this.callbacks = callbacks;
    this.voiceName = voiceName;
  }

  public setVoice(voice: string) {
    this.voiceName = voice;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (this.mediaStream) {
      this.mediaStream.getAudioTracks().forEach((track) => {
        track.enabled = !muted;
      });
    }
  }

  public async start(): Promise<void> {
    if (this.ws || this.isConnecting) return;
    this.isConnecting = true;
    this.callbacks.onStateChange('connecting');

    try {
      // 1. Request microphone access
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });

      // 2. Initialize Output AudioContext (24kHz for playback)
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      this.outputAudioCtx = new AudioCtxClass({ sampleRate: 24000 });
      if (this.outputAudioCtx.state === 'suspended') {
        await this.outputAudioCtx.resume();
      }

      this.outAnalyser = this.outputAudioCtx.createAnalyser();
      this.outAnalyser.fftSize = 64;
      this.outAnalyser.connect(this.outputAudioCtx.destination);

      // 3. Initialize Input AudioContext (16kHz or default with resampling)
      this.inputAudioCtx = new AudioCtxClass();
      if (this.inputAudioCtx.state === 'suspended') {
        await this.inputAudioCtx.resume();
      }

      this.micAnalyser = this.inputAudioCtx.createAnalyser();
      this.micAnalyser.fftSize = 64;

      this.micSource = this.inputAudioCtx.createMediaStreamSource(this.mediaStream);
      this.micSource.connect(this.micAnalyser);

      // Buffer size 2048 or 4096 gives ~100-200ms latency chunks
      this.scriptProcessor = this.inputAudioCtx.createScriptProcessor(4096, 1, 1);
      this.micSource.connect(this.scriptProcessor);
      this.scriptProcessor.connect(this.inputAudioCtx.destination);

      // 4. Connect WebSocket to backend /api/live
      const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsUrl = `${protocol}//${window.location.host}/api/live?voice=${encodeURIComponent(
        this.voiceName
      )}&lang=${encodeURIComponent(getGlobalLanguage())}`;

      this.ws = new WebSocket(wsUrl);

      this.ws.onopen = () => {
        this.isConnecting = false;
        this.callbacks.onStateChange('connected');
        this.startAudioVisualizerLoop();
      };

      this.ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data);
          this.handleServerMessage(msg);
        } catch (e) {
          console.error('Error parsing live WS message', e);
        }
      };

      this.ws.onerror = (event) => {
        console.error('Live WS error:', event);
        this.callbacks.onError('WebSocket connection error. Please try reconnecting.');
        this.callbacks.onStateChange('error');
      };

      this.ws.onclose = () => {
        this.callbacks.onStateChange('idle');
      };

      // 5. Stream mic audio to WebSocket
      this.scriptProcessor.onaudioprocess = (e) => {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN || this.isMuted) return;

        const inputChannelData = e.inputBuffer.getChannelData(0);
        const resampled = resampleAudioBuffer(
          inputChannelData,
          this.inputAudioCtx?.sampleRate || 44100,
          16000
        );

        const base64PCM = floatTo16BitPCMBase64(resampled);
        this.ws.send(JSON.stringify({ audio: base64PCM }));
      };
    } catch (err: any) {
      console.error('Failed to start Live Voice session', err);
      this.isConnecting = false;
      this.callbacks.onError(err?.message || 'Could not initialize microphone or audio context');
      this.callbacks.onStateChange('error');
      this.stop();
    }
  }

  private handleServerMessage(msg: any) {
    if (msg.type === 'audio' && msg.audio) {
      this.playAudioChunk(msg.audio);
      this.callbacks.onStateChange('speaking');
    } else if (msg.type === 'input_transcript' && msg.text) {
      this.appendTranscript('user', msg.text);
      this.callbacks.onStateChange('listening');
    } else if (msg.type === 'output_transcript' && msg.text) {
      this.appendTranscript('noor', msg.text);
      this.callbacks.onStateChange('speaking');
    } else if (msg.type === 'interrupted') {
      this.stopAllAudio();
      this.callbacks.onStateChange('listening');
    } else if (msg.type === 'turn_complete') {
      this.markLastTranscriptComplete();
      this.callbacks.onStateChange('listening');
    } else if (msg.type === 'error') {
      this.callbacks.onError(msg.error || 'Live session error');
    }
  }

  private playAudioChunk(base64Audio: string) {
    if (!this.outputAudioCtx || !this.outAnalyser) return;

    try {
      const audioBuffer = base64PCMToAudioBuffer(base64Audio, this.outputAudioCtx, 24000);
      const source = this.outputAudioCtx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(this.outAnalyser);

      const currentTime = this.outputAudioCtx.currentTime;
      // Schedule gapless playback
      const startTime = Math.max(currentTime, this.nextPlayTime);
      source.start(startTime);
      this.nextPlayTime = startTime + audioBuffer.duration;

      this.activeSourceNodes.push(source);
      source.onended = () => {
        const idx = this.activeSourceNodes.indexOf(source);
        if (idx >= 0) this.activeSourceNodes.splice(idx, 1);
        if (this.activeSourceNodes.length === 0 && this.outputAudioCtx) {
          if (this.outputAudioCtx.currentTime >= this.nextPlayTime - 0.05) {
            this.callbacks.onStateChange('listening');
          }
        }
      };
    } catch (err) {
      console.error('Audio chunk decoding error', err);
    }
  }

  public interrupt() {
    this.stopAllAudio();
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ action: 'interrupt' }));
    }
  }

  public sendTextMessage(text: string) {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      this.appendTranscript('user', text);
      this.markLastTranscriptComplete();
      this.ws.send(JSON.stringify({ text }));
    }
  }

  private stopAllAudio() {
    this.activeSourceNodes.forEach((s) => {
      try {
        s.stop();
      } catch {}
    });
    this.activeSourceNodes = [];
    if (this.outputAudioCtx) {
      this.nextPlayTime = this.outputAudioCtx.currentTime;
    }
  }

  private appendTranscript(sender: 'user' | 'noor', textChunk: string) {
    const last = this.transcripts[this.transcripts.length - 1];
    if (last && last.sender === sender && !last.isComplete) {
      last.text += textChunk;
    } else {
      this.transcripts.push({
        id: `live-tx-${Date.now()}-${Math.random().toString(36).substr(2, 4)}`,
        sender,
        text: textChunk,
        isComplete: false,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      });
    }
    this.callbacks.onTranscriptUpdate([...this.transcripts]);
  }

  private markLastTranscriptComplete() {
    const last = this.transcripts[this.transcripts.length - 1];
    if (last) {
      last.isComplete = true;
      this.callbacks.onTranscriptUpdate([...this.transcripts]);
    }
  }

  private startAudioVisualizerLoop() {
    const micDataArray = new Uint8Array(32);
    const outDataArray = new Uint8Array(32);

    const checkVolume = () => {
      // Calculate Mic Volume
      if (this.micAnalyser && !this.isMuted) {
        this.micAnalyser.getByteFrequencyData(micDataArray);
        let sum = 0;
        for (let i = 0; i < micDataArray.length; i++) {
          sum += micDataArray[i];
        }
        const avg = sum / micDataArray.length;
        this.callbacks.onUserVolume(Math.min(1, avg / 80));
      } else {
        this.callbacks.onUserVolume(0);
      }

      // Calculate AI Output Volume
      if (this.outAnalyser) {
        this.outAnalyser.getByteFrequencyData(outDataArray);
        let sum = 0;
        for (let i = 0; i < outDataArray.length; i++) {
          sum += outDataArray[i];
        }
        const avg = sum / outDataArray.length;
        this.callbacks.onAiVolume(Math.min(1, avg / 75));
      } else {
        this.callbacks.onAiVolume(0);
      }

      this.animFrameId = requestAnimationFrame(checkVolume);
    };

    this.animFrameId = requestAnimationFrame(checkVolume);
  }

  public getTranscripts(): LiveTranscriptEntry[] {
    return this.transcripts;
  }

  public stop() {
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }

    this.stopAllAudio();

    if (this.scriptProcessor) {
      this.scriptProcessor.disconnect();
      this.scriptProcessor.onaudioprocess = null;
      this.scriptProcessor = null;
    }

    if (this.micSource) {
      this.micSource.disconnect();
      this.micSource = null;
    }

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
      this.mediaStream = null;
    }

    if (this.inputAudioCtx) {
      this.inputAudioCtx.close().catch(() => {});
      this.inputAudioCtx = null;
    }

    if (this.outputAudioCtx) {
      this.outputAudioCtx.close().catch(() => {});
      this.outputAudioCtx = null;
    }

    if (this.ws) {
      this.ws.onopen = null;
      this.ws.onmessage = null;
      this.ws.onerror = null;
      this.ws.onclose = null;
      try {
        this.ws.close();
      } catch {}
      this.ws = null;
    }

    this.isConnecting = false;
    this.callbacks.onStateChange('idle');
  }
}

/**
 * Text-to-Speech (TTS) Single Message Player
 */
export class TTSPlayer {
  private static audioCtx: AudioContext | null = null;
  private static currentSource: AudioBufferSourceNode | null = null;
  private static currentHtmlAudio: HTMLAudioElement | null = null;

  public static async playText(
    text: string,
    voice: string = 'Fenrir',
    onStart?: () => void,
    onEnded?: () => void,
    onError?: (err: string) => void
  ): Promise<() => void> {
    this.stop();

    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, voice: voice || 'Fenrir' }),
      });

      if (!response.ok) {
        throw new Error(`TTS server responded with ${response.status}`);
      }

      const data = await response.json();
      if (!data.success) {
        throw new Error(data.error || 'Failed to generate speech');
      }

      // If data has wavUrl, HTML5 audio can be played with maximum fidelity and smooth pauses
      if (data.wavUrl) {
        const audio = new Audio(data.wavUrl);
        this.currentHtmlAudio = audio;
        onStart?.();

        audio.onended = () => {
          if (this.currentHtmlAudio === audio) {
            this.currentHtmlAudio = null;
            onEnded?.();
          }
        };

        audio.onerror = () => {
          if (this.currentHtmlAudio === audio) {
            this.currentHtmlAudio = null;
            onError?.('Audio playback failed');
            onEnded?.();
          }
        };

        await audio.play();

        return () => {
          try {
            audio.pause();
            audio.currentTime = 0;
          } catch {}
          if (this.currentHtmlAudio === audio) {
            this.currentHtmlAudio = null;
            onEnded?.();
          }
        };
      }

      // Fallback to Web Audio API PCM buffer
      if (data.audio) {
        const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
        if (!this.audioCtx) {
          this.audioCtx = new AudioCtxClass({ sampleRate: 24000 });
        }
        if (this.audioCtx.state === 'suspended') {
          await this.audioCtx.resume();
        }

        const audioBuffer = base64PCMToAudioBuffer(data.audio, this.audioCtx, 24000);
        const source = this.audioCtx.createBufferSource();
        source.buffer = audioBuffer;
        source.connect(this.audioCtx.destination);

        this.currentSource = source;
        onStart?.();

        source.onended = () => {
          if (this.currentSource === source) {
            this.currentSource = null;
            onEnded?.();
          }
        };

        source.start();

        return () => {
          try {
            source.stop();
          } catch {}
          if (this.currentSource === source) {
            this.currentSource = null;
            onEnded?.();
          }
        };
      }

      throw new Error('No audio data received');
    } catch (err: any) {
      console.error('TTS playback error:', err);
      onError?.(err?.message || 'Could not play voice');
      onEnded?.();
      return () => {};
    }
  }

  public static stop() {
    if (this.currentHtmlAudio) {
      try {
        this.currentHtmlAudio.pause();
        this.currentHtmlAudio.currentTime = 0;
      } catch {}
      this.currentHtmlAudio = null;
    }
    if (this.currentSource) {
      try {
        this.currentSource.stop();
      } catch {}
      this.currentSource = null;
    }
  }
}
