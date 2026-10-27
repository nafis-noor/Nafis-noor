/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Mic,
  MicOff,
  X,
  Volume2,
  VolumeX,
  Sparkles,
  ShieldCheck,
  Radio,
  RotateCcw,
  Sliders,
  Check,
  User,
  Heart,
  BookOpen,
} from 'lucide-react';
import { NoorAIIcon } from './NoorAIIcon';
import {
  LiveVoiceSession,
  LiveTranscriptEntry,
  LiveConnectionState,
} from '../utils/audioLiveManager';

interface LiveVoiceModalProps {
  isOpen: boolean;
  onClose: (transcripts: LiveTranscriptEntry[]) => void;
  isDark: boolean;
  initialVoice?: string;
  onSaveToChat?: (transcripts: LiveTranscriptEntry[]) => void;
}

const VOICE_OPTIONS = [
  { id: 'Zephyr', name: 'Zephyr', description: 'Serene, Balanced & Tranquil' },
  { id: 'Kore', name: 'Kore', description: 'Gentle, Warm & Soothing' },
  { id: 'Puck', name: 'Puck', description: 'Clear, Engaging & Uplifting' },
  { id: 'Fenrir', name: 'Fenrir', description: 'Deep, Resonant & Reflective' },
  { id: 'Charon', name: 'Charon', description: 'Soft & Contemplative' },
];

const SUGGESTED_VOICE_PROMPTS = [
  'What is the spiritual virtue of Tahajjud prayer?',
  'How do I cultivate patience (Sabr) during hardship?',
  'Teach me a heart-softening Du\'a for anxiety.',
  'What is the meaning of Surah Al-Inshirah?',
];

export const LiveVoiceModal: React.FC<LiveVoiceModalProps> = ({
  isOpen,
  onClose,
  isDark,
  initialVoice = 'Zephyr',
  onSaveToChat,
}) => {
  const [connectionState, setConnectionState] = useState<LiveConnectionState>('idle');
  const [selectedVoice, setSelectedVoice] = useState<string>(initialVoice);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [userVolume, setUserVolume] = useState<number>(0);
  const [aiVolume, setAiVolume] = useState<number>(0);
  const [transcripts, setTranscripts] = useState<LiveTranscriptEntry[]>([]);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showVoiceSettings, setShowVoiceSettings] = useState<boolean>(false);

  const sessionRef = useRef<LiveVoiceSession | null>(null);
  const scrollRef = useRef<HTMLDivElement | null>(null);

  // Initialize and start live session when modal opens
  useEffect(() => {
    if (!isOpen) {
      if (sessionRef.current) {
        sessionRef.current.stop();
        sessionRef.current = null;
      }
      return;
    }

    setErrorMessage(null);
    setTranscripts([]);

    const session = new LiveVoiceSession(
      {
        onStateChange: (state) => {
          setConnectionState(state);
        },
        onTranscriptUpdate: (newTranscripts) => {
          setTranscripts(newTranscripts);
        },
        onUserVolume: (vol) => {
          setUserVolume(vol);
        },
        onAiVolume: (vol) => {
          setAiVolume(vol);
        },
        onError: (err) => {
          setErrorMessage(err);
        },
      },
      selectedVoice
    );

    sessionRef.current = session;
    session.start();

    return () => {
      if (sessionRef.current) {
        sessionRef.current.stop();
        sessionRef.current = null;
      }
    };
  }, [isOpen, selectedVoice]);

  // Auto-scroll transcripts
  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcripts]);

  const handleToggleMute = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    sessionRef.current?.setMuted(nextMute);
  };

  const handleInterrupt = () => {
    sessionRef.current?.interrupt();
  };

  const handleSendQuickPrompt = (prompt: string) => {
    sessionRef.current?.sendTextMessage(prompt);
  };

  const handleClose = () => {
    const currentTranscripts = sessionRef.current ? sessionRef.current.getTranscripts() : transcripts;
    if (sessionRef.current) {
      sessionRef.current.stop();
      sessionRef.current = null;
    }
    if (currentTranscripts.length > 0 && onSaveToChat) {
      onSaveToChat(currentTranscripts);
    }
    onClose(currentTranscripts);
  };

  if (!isOpen) return null;

  // Dynamic visualizer values
  const activeScale = 1 + (connectionState === 'speaking' ? aiVolume * 0.45 : userVolume * 0.4);
  const activeGlow = connectionState === 'speaking'
    ? `0 0 ${25 + aiVolume * 60}px rgba(223, 186, 127, ${0.4 + aiVolume * 0.6})`
    : connectionState === 'listening'
    ? `0 0 ${20 + userVolume * 45}px rgba(96, 165, 250, ${0.3 + userVolume * 0.5})`
    : '0 0 20px rgba(201, 160, 99, 0.25)';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/85 backdrop-blur-md animate-fadeIn">
      {/* Modal Container */}
      <div
        id="live-voice-sanctuary-modal"
        className={`w-full max-w-2xl h-[90vh] max-h-[750px] rounded-3xl border flex flex-col overflow-hidden shadow-2xl relative transition-all ${
          isDark
            ? 'bg-[#090C11]/95 border-[#DFBA7F]/30 text-stone-100'
            : 'bg-[#FCFAF6]/98 border-[#C9A063]/40 text-stone-900'
        }`}
      >
        {/* Top Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between shrink-0 bg-white/5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#C9A063] to-[#DFBA7F] text-[#090B0E] flex items-center justify-center shadow-lg font-bold">
              <Radio className={`w-5 h-5 ${connectionState === 'speaking' ? 'animate-pulse' : ''}`} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="font-cinzel font-bold text-sm sm:text-base tracking-wider text-[#DFBA7F]">
                  NOOR LIVE VOICE
                </h3>
                <span className="flex items-center gap-1 text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/30">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-ping" />
                  Gemini Live
                </span>
              </div>
              <p className="text-[11px] text-stone-400">
                Natural Islamic voice conversation with real-time audio
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowVoiceSettings(!showVoiceSettings)}
              className={`p-2 rounded-xl border transition-all text-xs flex items-center gap-1.5 ${
                showVoiceSettings
                  ? 'bg-[#DFBA7F]/20 border-[#DFBA7F] text-[#DFBA7F]'
                  : 'bg-white/5 border-white/10 text-stone-400 hover:text-white'
              }`}
              title="Voice Settings"
            >
              <Sliders className="w-4 h-4" />
              <span className="hidden sm:inline font-medium text-[11px]">{selectedVoice}</span>
            </button>

            <button
              onClick={handleClose}
              className="p-2 rounded-xl border border-white/10 hover:bg-white/10 text-stone-400 hover:text-white transition-all"
              title="End & Close Live Voice"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Voice Persona Dropdown Drawer */}
        {showVoiceSettings && (
          <div className="p-4 border-b border-[#DFBA7F]/20 bg-[#0E1217] space-y-2 animate-fadeIn shrink-0">
            <div className="text-[11px] font-cinzel font-bold text-[#DFBA7F] uppercase tracking-wider">
              Select Voice Tone
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {VOICE_OPTIONS.map((voice) => (
                <button
                  key={voice.id}
                  onClick={() => {
                    setSelectedVoice(voice.id);
                    setShowVoiceSettings(false);
                  }}
                  className={`p-2.5 rounded-2xl border text-left flex items-center justify-between transition-all ${
                    selectedVoice === voice.id
                      ? 'bg-[#DFBA7F]/20 border-[#DFBA7F] text-[#DFBA7F]'
                      : 'bg-white/5 border-white/10 text-stone-300 hover:bg-white/10'
                  }`}
                >
                  <div>
                    <div className="text-xs font-semibold">{voice.name}</div>
                    <div className="text-[10px] text-stone-400">{voice.description}</div>
                  </div>
                  {selectedVoice === voice.id && <Check className="w-4 h-4 text-[#DFBA7F]" />}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Central Visualizer & Status Area */}
        <div className="flex-1 flex flex-col items-center justify-between p-4 sm:p-6 overflow-y-auto no-scrollbar">
          {/* Glowing Animated Audio Orb */}
          <div className="flex flex-col items-center justify-center my-auto py-4 relative">
            {/* Outer Sound Wave Rings */}
            <div
              className="absolute w-44 h-44 rounded-full border border-[#DFBA7F]/30 transition-transform duration-100 pointer-events-none"
              style={{
                transform: `scale(${activeScale * 1.15})`,
                opacity: (connectionState === 'speaking' || connectionState === 'listening') ? 0.6 : 0.2,
              }}
            />
            <div
              className="absolute w-56 h-56 rounded-full border border-[#DFBA7F]/15 transition-transform duration-150 pointer-events-none"
              style={{
                transform: `scale(${activeScale * 1.35})`,
                opacity: (connectionState === 'speaking' || connectionState === 'listening') ? 0.4 : 0.1,
              }}
            />

            {/* Core Radiant Orb */}
            <div
              className="w-28 h-28 sm:w-32 sm:h-32 rounded-full relative flex items-center justify-center cursor-pointer transition-all duration-100 active:scale-95"
              style={{
                boxShadow: activeGlow,
                transform: `scale(${activeScale})`,
                background:
                  connectionState === 'speaking'
                    ? 'radial-gradient(circle at 35% 30%, #F5DEB3 0%, #DFBA7F 40%, #8A642B 100%)'
                    : connectionState === 'listening'
                    ? 'radial-gradient(circle at 35% 30%, #BFDBFE 0%, #60A5FA 45%, #1E3A8A 100%)'
                    : 'radial-gradient(circle at 35% 30%, #DFBA7F 0%, #C9A063 50%, #151922 100%)',
              }}
              onClick={connectionState === 'speaking' ? handleInterrupt : handleToggleMute}
              title={connectionState === 'speaking' ? 'Tap to interrupt' : isMuted ? 'Tap to unmute' : 'Listening'}
            >
              <div className="text-[#090B0E] flex flex-col items-center justify-center">
                {connectionState === 'speaking' ? (
                  <Volume2 className="w-8 h-8 animate-bounce" />
                ) : isMuted ? (
                  <MicOff className="w-8 h-8 text-red-900" />
                ) : (
                  <Mic className="w-8 h-8 animate-pulse" />
                )}
              </div>
            </div>

            {/* Status Pill */}
            <div className="mt-6 flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/15 shadow-sm">
              <span
                className={`w-2 h-2 rounded-full ${
                  connectionState === 'speaking'
                    ? 'bg-[#DFBA7F] animate-ping'
                    : connectionState === 'listening'
                    ? 'bg-blue-400 animate-pulse'
                    : connectionState === 'connecting'
                    ? 'bg-amber-400 animate-pulse'
                    : isMuted
                    ? 'bg-red-400'
                    : 'bg-stone-500'
                }`}
              />
              <span className="text-xs font-semibold tracking-wide">
                {connectionState === 'speaking'
                  ? 'Noor AI is speaking...'
                  : connectionState === 'listening'
                  ? 'Listening to your voice...'
                  : connectionState === 'connecting'
                  ? 'Connecting to Live API...'
                  : isMuted
                  ? 'Microphone muted'
                  : 'Ready to speak'}
              </span>
            </div>

            {errorMessage && (
              <div className="mt-3 px-4 py-2 rounded-2xl bg-red-500/15 border border-red-500/30 text-red-300 text-xs text-center max-w-sm">
                {errorMessage}
              </div>
            )}
          </div>

          {/* Real-time Live Transcript Bubble */}
          <div className="w-full max-h-48 overflow-y-auto space-y-2.5 p-3 rounded-2xl bg-black/40 border border-white/10 text-xs">
            <div className="text-[10px] font-cinzel font-bold text-[#DFBA7F] flex items-center justify-between">
              <span>LIVE TRANSCRIPT</span>
              {transcripts.length > 0 && <span>{transcripts.length} exchanges</span>}
            </div>

            {transcripts.length === 0 ? (
              <p className="text-stone-400 italic text-center py-2">
                Speak freely into your microphone. Say "Assalamu Alaikum", ask about a verse, or seek guidance.
              </p>
            ) : (
              transcripts.map((entry) => (
                <div
                  key={entry.id}
                  className={`p-2.5 rounded-xl ${
                    entry.sender === 'user'
                      ? 'bg-[#DFBA7F]/20 text-[#DFBA7F] ml-6 border border-[#DFBA7F]/30'
                      : 'bg-white/10 text-stone-200 mr-6 border border-white/10'
                  }`}
                >
                  <div className="flex items-center gap-1 text-[10px] font-semibold opacity-70 mb-0.5">
                    {entry.sender === 'user' ? <User className="w-3 h-3" /> : <NoorAIIcon className="w-3 h-3 text-[#DFBA7F]" />}
                    <span>{entry.sender === 'user' ? 'You' : 'Noor AI'}</span>
                    <span className="text-[9px] opacity-60 ml-auto">{entry.timestamp}</span>
                  </div>
                  <p className="leading-relaxed whitespace-pre-wrap">{entry.text}</p>
                </div>
              ))
            )}
            <div ref={scrollRef} />
          </div>

          {/* Quick Voice Topics / Starters */}
          {transcripts.length === 0 && (
            <div className="w-full mt-3">
              <div className="text-[10px] font-cinzel font-bold text-stone-400 uppercase mb-1.5">
                Suggested questions to ask:
              </div>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTED_VOICE_PROMPTS.map((prompt, pIdx) => (
                  <button
                    key={pIdx}
                    onClick={() => handleSendQuickPrompt(prompt)}
                    className="px-3 py-1.5 rounded-xl bg-white/5 hover:bg-[#DFBA7F]/20 border border-white/10 hover:border-[#DFBA7F]/40 text-stone-300 hover:text-[#DFBA7F] text-[11px] transition-all text-left"
                  >
                    "{prompt}"
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Bottom Control Dock */}
        <div className="p-4 sm:p-5 border-t border-white/10 flex items-center justify-between bg-white/5 shrink-0">
          <button
            onClick={handleToggleMute}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-2xl border text-xs font-semibold transition-all active:scale-95 ${
              isMuted
                ? 'bg-red-500/20 border-red-500/40 text-red-300'
                : 'bg-white/10 hover:bg-white/15 border-white/15 text-stone-200'
            }`}
          >
            {isMuted ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4 text-emerald-400" />}
            <span>{isMuted ? 'Unmute' : 'Mute Mic'}</span>
          </button>

          {connectionState === 'speaking' && (
            <button
              onClick={handleInterrupt}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-2xl bg-amber-500/20 hover:bg-amber-500/30 border border-amber-500/40 text-amber-300 text-xs font-semibold transition-all active:scale-95 animate-pulse"
            >
              <VolumeX className="w-4 h-4" />
              <span>Tap to Interrupt</span>
            </button>
          )}

          <button
            onClick={handleClose}
            className="flex items-center gap-1.5 px-5 py-2.5 rounded-2xl bg-gradient-to-tr from-[#C9A063] to-[#DFBA7F] text-[#090B0E] text-xs font-bold shadow-lg hover:brightness-110 transition-all active:scale-95"
          >
            <Check className="w-4 h-4" />
            <span>End & Save Chat</span>
          </button>
        </div>
      </div>
    </div>
  );
};
