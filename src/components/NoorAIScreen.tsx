import React, { useState, useRef, useEffect } from 'react';
import {
  Send,
  User,
  Sparkles,
  BookOpen,
  Share2,
  Check,
  RotateCcw,
  Info,
  ShieldCheck,
  Plus,
  Trash2,
  AlertTriangle,
  Mic,
  MicOff,
  ThumbsUp,
  ThumbsDown,
  Bookmark,
  BookmarkCheck,
  ChevronDown,
  ChevronUp,
  Copy,
  History,
  MessageSquare,
  ArrowRight,
  Lock,
  Scale,
  X,
  ExternalLink,
  Play,
  Pause,
  Volume2,
  VolumeX,
  Heart,
  Radio,
} from 'lucide-react';
import { NoorAIIcon } from './NoorAIIcon';
import {
  NoorAIMessage,
  NoorAIConversationSession,
  UserStats,
  QuranRefData,
  HadithRefData,
} from '../types';
import { getAyahAudioUrl, ALL_SURAHS } from '../data/quranData';
import { LiveVoiceModal } from './LiveVoiceModal';
import { TTSPlayer, LiveTranscriptEntry } from '../utils/audioLiveManager';
import { t, getLanguageCode, getGlobalLanguage } from '../utils/i18n';

export const DEFAULT_WELCOME_MESSAGE: NoorAIMessage = {
  id: 'welcome-initial',
  sender: 'noor',
  greeting: "السلام عليكم ورحمة الله وبركاته. حياكم الله وبياكم في رحاب القرآن الكريم والسنة النبوية المطهرة.",
  text: "Assalamu Alaikum wa Rahmatullahi wa Barakatuh. Welcome! I am Noor AI, your peaceful Islamic companion. I am here to assist you with authentic Islamic knowledge, Qur'anic reflection (Tadabbur), Hadith insights, and mindful guidance. How may I illuminate your journey of learning today?",
  concludingDua: "أسأل الله العظيم أن يشرح صدركم بنور القرآن الكريم، وأن يوفقكم للعلم النافع والعمل الصالح.",
  timestamp: 'Just now',
  sources: ["Holy Qur'an", "Sahih Sunnah", "Tafsir Ibn Kathir"],
  sourceVerification: "Grounded in the Holy Qur'an, Sahih Hadith, and Classical Tafsir",
};

interface NoorAIScreenProps {
  isDark: boolean;
  initialPrompt?: string;
  userStats?: UserStats;
  onUpdateStats?: (stats: Partial<UserStats>) => void;
  messages?: NoorAIMessage[];
  onUpdateMessages?: (messages: NoorAIMessage[]) => void;
}

export const NoorAIScreen: React.FC<NoorAIScreenProps> = ({
  isDark,
  initialPrompt,
  userStats,
  onUpdateStats,
  messages: externalMessages,
  onUpdateMessages,
}) => {
  const lang = getLanguageCode(userStats?.language);
  // Extract or initialize sessions
  const existingSessions = userStats?.noorAiSessions || [];
  const currentActiveId = userStats?.activeNoorSessionId;

  // Find or create active session
  const [activeSessionId, setActiveSessionId] = useState<string>(() => {
    if (currentActiveId && existingSessions.some((s) => s.id === currentActiveId)) {
      return currentActiveId;
    }
    if (existingSessions.length > 0) {
      return existingSessions[0].id;
    }
    return `session-${Date.now()}`;
  });

  // Current session messages
  const currentSession = existingSessions.find((s) => s.id === activeSessionId);
  const activeMessages = currentSession
    ? currentSession.messages
    : externalMessages && externalMessages.length > 0
    ? externalMessages
    : [];

  const [inputQuery, setInputQuery] = useState(initialPrompt || '');
  const [isLoading, setIsLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [expandedSources, setExpandedSources] = useState<Record<string, boolean>>({});
  const [expandedExplainMore, setExpandedExplainMore] = useState<Record<string, boolean>>({});
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);
  const [showClearConfirmModal, setShowClearConfirmModal] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [lastFailedQuery, setLastFailedQuery] = useState<string | null>(null);
  const [playingVerseKey, setPlayingVerseKey] = useState<string | null>(null);
  const [showLiveVoiceModal, setShowLiveVoiceModal] = useState<boolean>(false);
  const [activeVoiceName, setActiveVoiceName] = useState<string>('Zephyr');
  const [playingTtsId, setPlayingTtsId] = useState<string | null>(null);
  const [isTtsLoadingId, setIsTtsLoadingId] = useState<string | null>(null);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const recognitionRef = useRef<any>(null);
  const currentAudioRef = useRef<HTMLAudioElement | null>(null);
  const ttsStopFnRef = useRef<(() => void) | null>(null);

  const starterSuggestions = [
    { title: 'Explain the meaning & virtues of Sabr', desc: 'Patience, spiritual fortitude, and Surah Al-Baqarah 2:153' },
    { title: 'What is the blessing of Tahajjud & night prayer?', desc: 'Qur\'an 17:79 reflection & the descent of divine mercy' },
    { title: 'How to achieve true Khushu in Salah?', desc: 'Heart presence, understanding Al-Fatihah, and inner stillness' },
    { title: 'How to overcome anxiety and grief through Dhikr?', desc: 'Surah Ar-Ra\'d 13:28 Tadabbur & Prophetic supplications' },
    { title: 'Explain the meaning of Wudu & spiritual purification', desc: 'Surah Al-Ma\'idah 5:6 and the light of the limbs' },
  ];

  // Helper to extract Surah and Ayah numbers for audio recitation
  const extractSurahAndAyah = (verseNumberStr?: string, surahName?: string) => {
    if (!verseNumberStr) return null;
    const match = verseNumberStr.match(/(\d+)[:\s]+(\d+)/);
    if (match) {
      return { surahNum: parseInt(match[1], 10), ayahNum: parseInt(match[2], 10) };
    }
    if (surahName) {
      const s = ALL_SURAHS.find(
        (item) =>
          item.englishName.toLowerCase().replace(/[^a-z]/g, '') ===
          surahName.toLowerCase().replace(/[^a-z]/g, '')
      );
      const singleNumMatch = verseNumberStr.match(/(\d+)/);
      if (s && singleNumMatch) {
        return { surahNum: s.number, ayahNum: parseInt(singleNumMatch[1], 10) };
      }
    }
    return null;
  };

  // Audio recitation handler
  const handlePlayVerseAudio = (surahNum: number, ayahNum: number, key: string) => {
    if (playingVerseKey === key && currentAudioRef.current) {
      currentAudioRef.current.pause();
      setPlayingVerseKey(null);
      return;
    }
    if (currentAudioRef.current) {
      currentAudioRef.current.pause();
    }
    try {
      const url = getAyahAudioUrl(surahNum, ayahNum, 'dossary');
      const audio = new Audio(url);
      currentAudioRef.current = audio;
      setPlayingVerseKey(key);
      audio.play().catch((err) => {
        console.warn('Audio play prevented', err);
        setPlayingVerseKey(null);
      });
      audio.onended = () => {
        setPlayingVerseKey(null);
      };
      audio.onerror = () => {
        setPlayingVerseKey(null);
      };
    } catch (err) {
      console.warn('Audio playback error', err);
      setPlayingVerseKey(null);
    }
  };

  // Auto-scroll on new message
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [activeMessages.length, isLoading]);

  // Handle external initial prompt
  useEffect(() => {
    if (initialPrompt && initialPrompt.trim().length > 0) {
      handleSendMessage(initialPrompt);
    }
  }, [initialPrompt]);

  // Voice Recognition setup
  useEffect(() => {
    const SpeechRecognition =
      (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    if (SpeechRecognition) {
      const recognition = new SpeechRecognition();
      recognition.continuous = false;
      recognition.interimResults = false;
      recognition.lang = 'en-US';

      recognition.onresult = (event: any) => {
        const transcript = event.results[0][0].transcript;
        if (transcript) {
          setInputQuery((prev) => (prev ? `${prev} ${transcript}` : transcript));
        }
        setIsListening(false);
      };

      recognition.onerror = () => {
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
    }
  }, []);

  const toggleVoiceInput = () => {
    if (!recognitionRef.current) {
      showToast('Voice input is not supported in this browser.');
      return;
    }

    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        setIsListening(false);
      }
    }
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3000);
  };

  // Helper to persist updated messages to session list
  const persistSessionMessages = (
    sessId: string,
    newMessages: NoorAIMessage[],
    customTitle?: string
  ) => {
    const now = new Date().toISOString();
    let sessions = [...(userStats?.noorAiSessions || [])];
    const existingIndex = sessions.findIndex((s) => s.id === sessId);

    // Generate smart title from user's first question if not provided
    let title = customTitle;
    if (!title) {
      const firstUserMsg = newMessages.find((m) => m.sender === 'user');
      if (firstUserMsg) {
        title = firstUserMsg.text.slice(0, 32);
        if (firstUserMsg.text.length > 32) title += '...';
      } else {
        title = 'Islamic Guidance';
      }
    }

    if (existingIndex >= 0) {
      sessions[existingIndex] = {
        ...sessions[existingIndex],
        title: sessions[existingIndex].title !== 'New Conversation' ? sessions[existingIndex].title : title,
        updatedAt: now,
        messages: newMessages,
      };
    } else {
      sessions.unshift({
        id: sessId,
        title: title || 'Islamic Conversation',
        createdAt: now,
        updatedAt: now,
        messages: newMessages,
      });
    }

    if (onUpdateStats) {
      onUpdateStats({
        noorAiSessions: sessions,
        activeNoorSessionId: sessId,
        noorAiConversation: newMessages, // backward compatibility
      });
    }
    if (onUpdateMessages) {
      onUpdateMessages(newMessages);
    }
  };

  // Handle Text-to-Speech (TTS) for individual Noor AI responses
  const handleToggleTTS = async (msg: NoorAIMessage) => {
    if (playingTtsId === msg.id) {
      if (ttsStopFnRef.current) {
        ttsStopFnRef.current();
        ttsStopFnRef.current = null;
      }
      TTSPlayer.stop();
      setPlayingTtsId(null);
      return;
    }

    if (ttsStopFnRef.current) {
      ttsStopFnRef.current();
      ttsStopFnRef.current = null;
    }
    TTSPlayer.stop();

    setIsTtsLoadingId(msg.id);

    // Prepare speech text
    const textToRead = [
      msg.text || '',
      msg.explanation ? `Explanation: ${msg.explanation}` : '',
      msg.concludingDua ? `Supplication: ${msg.concludingDua}` : '',
    ]
      .filter(Boolean)
      .join('. ');

    const stopFn = await TTSPlayer.playText(
      textToRead,
      activeVoiceName,
      () => {
        setIsTtsLoadingId(null);
        setPlayingTtsId(msg.id);
      },
      () => {
        setIsTtsLoadingId(null);
        setPlayingTtsId(null);
        ttsStopFnRef.current = null;
      },
      (err) => {
        setIsTtsLoadingId(null);
        setPlayingTtsId(null);
        showToast(`Voice audio: ${err}`);
      }
    );
    ttsStopFnRef.current = stopFn;
  };

  // Save live voice transcripts to conversation session
  const handleLiveSessionTranscripts = (liveEntries: LiveTranscriptEntry[]) => {
    if (!liveEntries || liveEntries.length === 0) return;

    const newMsgs: NoorAIMessage[] = liveEntries.map((entry) => ({
      id: entry.id,
      sender: entry.sender === 'user' ? 'user' : 'noor',
      text: entry.text,
      timestamp: entry.timestamp || 'Just now',
      sourceVerification:
        entry.sender === 'noor'
          ? 'Live Gemini 3.1 Voice Conversation (Voice: ' + activeVoiceName + ')'
          : undefined,
    }));

    const updatedMessages = [...activeMessages, ...newMsgs];
    persistSessionMessages(activeSessionId, updatedMessages, 'Live Voice Talk');
    showToast('Live voice conversation saved to chat history');
  };

  const handleSendMessage = async (queryText?: string) => {
    const textToSend = (queryText || inputQuery).trim();
    if (!textToSend || isLoading) return;

    setErrorMessage(null);
    setLastFailedQuery(null);

    const userMessage: NoorAIMessage = {
      id: `user-${Date.now()}`,
      sender: 'user',
      text: textToSend,
      timestamp: 'Just now',
    };

    const newHistory = [...activeMessages, userMessage];
    persistSessionMessages(activeSessionId, newHistory);
    setInputQuery('');
    setIsLoading(true);

    try {
      const response = await fetch('/api/noor-ai', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-app-language': getGlobalLanguage(),
          'x-language': getGlobalLanguage(),
        },
        body: JSON.stringify({
          question: textToSend,
          conversationHistory: newHistory.map((m) => ({ sender: m.sender, text: m.text })),
          language: getGlobalLanguage(),
        }),
      });

      if (!response.ok) {
        throw new Error(`Server returned status ${response.status}`);
      }

      const data = await response.json();
      if (data.success && data.data) {
        const noorReply = data.data;

        const noorMessage: NoorAIMessage = {
          id: `noor-${Date.now()}`,
          sender: 'noor',
          greeting: noorReply.greeting,
          text: noorReply.directAnswer || 'Seeking knowledge with sincerity is deeply rewarded.',
          concludingDua: noorReply.concludingDua,
          tadabbur: noorReply.tadabbur,
          quranReference: noorReply.quranReference,
          hadithReference: noorReply.hadithReference,
          explanation: noorReply.explanation,
          scholarlyDisagreement: noorReply.scholarlyDisagreement,
          isPersonalRulingAdvice: noorReply.isPersonalRulingAdvice,
          sources: noorReply.sources || ['Holy Qur\'an and Sahih Sunnah'],
          sourceVerification: noorReply.sources ? noorReply.sources.join(' • ') : 'Verified Islamic Sources',
          practicalTakeaway: noorReply.practicalTakeaway,
          detailedExplanation: noorReply.detailedExplanation,
          suggestedFollowUps: noorReply.suggestedFollowUps,
          timestamp: 'Just now',
        };

        const updatedWithNoor = [...newHistory, noorMessage];
        persistSessionMessages(activeSessionId, updatedWithNoor, noorReply.suggestedTitle);
      } else {
        throw new Error('API returned unformatted response');
      }
    } catch (err) {
      console.error('Error fetching Noor AI:', err);
      setErrorMessage("I couldn't complete that answer right now. Please try again.");
      setLastFailedQuery(textToSend);

      // Add graceful error message with retry
      const errorReply: NoorAIMessage = {
        id: `noor-err-${Date.now()}`,
        sender: 'noor',
        text: "I couldn't complete that answer right now due to a network connection issue. Please tap 'Retry' below.",
        isError: true,
        timestamp: 'Just now',
      };
      persistSessionMessages(activeSessionId, [...newHistory, errorReply]);
    } finally {
      setIsLoading(false);
    }
  };

  const handleRetry = () => {
    if (lastFailedQuery) {
      // Remove the last error message
      const filtered = activeMessages.filter((m) => !m.isError);
      persistSessionMessages(activeSessionId, filtered);
      handleSendMessage(lastFailedQuery);
    }
  };

  const handleNewChat = () => {
    const newId = `session-${Date.now()}`;
    setActiveSessionId(newId);
    persistSessionMessages(newId, [], 'New Conversation');
    setInputQuery('');
    setShowHistoryDrawer(false);
    showToast('Started a new conversation.');
  };

  const handleSwitchSession = (sessionId: string) => {
    setActiveSessionId(sessionId);
    const target = userStats?.noorAiSessions?.find((s) => s.id === sessionId);
    if (target && onUpdateStats) {
      onUpdateStats({
        activeNoorSessionId: sessionId,
        noorAiConversation: target.messages,
      });
    }
    setShowHistoryDrawer(false);
  };

  const handleDeleteSession = (sessionId: string, e?: React.MouseEvent) => {
    e?.stopPropagation();
    let sessions = [...(userStats?.noorAiSessions || [])];
    sessions = sessions.filter((s) => s.id !== sessionId);

    let nextActiveId = activeSessionId;
    if (activeSessionId === sessionId) {
      nextActiveId = sessions.length > 0 ? sessions[0].id : `session-${Date.now()}`;
      setActiveSessionId(nextActiveId);
    }

    const nextMessages = sessions.find((s) => s.id === nextActiveId)?.messages || [];

    if (onUpdateStats) {
      onUpdateStats({
        noorAiSessions: sessions,
        activeNoorSessionId: nextActiveId,
        noorAiConversation: nextMessages,
      });
    }
    setSessionToDelete(null);
    showToast('Conversation deleted.');
  };

  const handleClearCurrentConversation = () => {
    persistSessionMessages(activeSessionId, []);
    setShowClearConfirmModal(false);
    showToast('Conversation cleared.');
  };

  const handleFeedback = (msgId: string, type: 'helpful' | 'unhelpful') => {
    const updated = activeMessages.map((m) => {
      if (m.id === msgId) {
        const newFeedback = m.feedback === type ? undefined : type;
        return { ...m, feedback: newFeedback };
      }
      return m;
    });
    persistSessionMessages(activeSessionId, updated);
    showToast(type === 'helpful' ? 'Thank you for your feedback! ♡' : 'Feedback noted.');
  };

  const handleToggleSave = (msg: NoorAIMessage) => {
    const isNowSaved = !msg.isSaved;
    const updatedMessages = activeMessages.map((m) =>
      m.id === msg.id ? { ...m, isSaved: isNowSaved } : m
    );
    persistSessionMessages(activeSessionId, updatedMessages);

    // Also update savedNoorMessages collection in userStats
    if (onUpdateStats && userStats) {
      let saved = [...(userStats.savedNoorMessages || [])];
      if (isNowSaved) {
        if (!saved.some((s) => s.id === msg.id)) {
          saved.push({ ...msg, isSaved: true });
        }
      } else {
        saved = saved.filter((s) => s.id !== msg.id);
      }
      onUpdateStats({ savedNoorMessages: saved });
    }

    showToast(isNowSaved ? 'Saved to your Noor collection 🔖' : 'Removed from saved answers.');
  };

  const handleCopyMessage = (msg: NoorAIMessage) => {
    let fullText = '';
    if (msg.greeting) {
      fullText += `${msg.greeting}\n\n`;
    }
    fullText += msg.text;

    if (msg.quranReference) {
      if (typeof msg.quranReference === 'string') {
        fullText += `\n\n📖 Qur'an: ${msg.quranReference}`;
      } else {
        fullText += `\n\n📖 Qur'an (${msg.quranReference.surahName} ${msg.quranReference.verseNumber})`;
        if (msg.quranReference.textArabic) fullText += `\n${msg.quranReference.textArabic}`;
        if (msg.quranReference.textTranslation) fullText += `\n"${msg.quranReference.textTranslation}"`;
      }
    }

    if (msg.tadabbur) {
      fullText += `\n\n✨ Tadabbur (Reflection): ${msg.tadabbur}`;
    }

    if (msg.hadithReference) {
      if (typeof msg.hadithReference === 'string') {
        fullText += `\n\n📚 Hadith: ${msg.hadithReference}`;
      } else {
        fullText += `\n\n📚 Hadith (${msg.hadithReference.collection} ${msg.hadithReference.number || ''} - ${msg.hadithReference.status || 'Authentic'}):\n"${msg.hadithReference.text}"`;
      }
    }

    if (msg.explanation) {
      fullText += `\n\n💡 Meaning & Tafsir: ${msg.explanation}`;
    }

    if (msg.concludingDua) {
      fullText += `\n\n🤲 Supplication: ${msg.concludingDua}`;
    }

    if (msg.sources && msg.sources.length > 0) {
      fullText += `\n\nSources: ${msg.sources.join(', ')}`;
    }

    fullText += '\n\n— Noor AI (Grounded Islamic Companion)';

    navigator.clipboard.writeText(fullText);
    setCopiedId(msg.id);
    showToast('Copied to clipboard 📋');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleShareMessage = async (msg: NoorAIMessage) => {
    const textToShare = `${msg.greeting ? msg.greeting + '\n\n' : ''}${msg.text}\n\n— Shared from Noor AI`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Noor AI - Islamic Guidance',
          text: textToShare,
        });
      } catch {
        handleCopyMessage(msg);
      }
    } else {
      handleCopyMessage(msg);
    }
  };

  const toggleSources = (msgId: string) => {
    setExpandedSources((prev) => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  const toggleExplainMore = (msgId: string) => {
    setExpandedExplainMore((prev) => ({ ...prev, [msgId]: !prev[msgId] }));
  };

  // Helper renderer for Qur'an reference with verse audio playback
  const renderQuranRef = (quranRef: QuranRefData | string) => {
    if (typeof quranRef === 'string') {
      const parsedRef = extractSurahAndAyah(quranRef);
      return (
        <div
          className={`p-3.5 rounded-2xl border transition-all ${
            isDark
              ? 'bg-[#141922]/90 border-[#DFBA7F]/30 text-[#DFBA7F]'
              : 'bg-amber-50/90 border-[#C9A063]/35 text-amber-950 shadow-2xs'
          }`}
        >
          <div className="flex items-center justify-between gap-2 mb-1.5">
            <div className="flex items-center gap-1.5 font-cinzel font-bold text-xs text-[#DFBA7F]">
              <BookOpen className="w-3.5 h-3.5 text-[#DFBA7F]" />
              <span>Qur'an Reference</span>
            </div>
            {parsedRef && (
              <button
                onClick={() =>
                  handlePlayVerseAudio(
                    parsedRef.surahNum,
                    parsedRef.ayahNum,
                    `ayah-str-${parsedRef.surahNum}-${parsedRef.ayahNum}`
                  )
                }
                className="flex items-center gap-1 px-2.5 py-1 rounded-xl bg-[#DFBA7F]/20 hover:bg-[#DFBA7F]/30 text-[#DFBA7F] border border-[#DFBA7F]/40 text-[10px] font-semibold transition-all active:scale-95 shadow-2xs"
                title="Listen to Qur'an recitation"
              >
                {playingVerseKey === `ayah-str-${parsedRef.surahNum}-${parsedRef.ayahNum}` ? (
                  <>
                    <Pause className="w-3 h-3 animate-pulse" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Play className="w-3 h-3 fill-current" />
                    <span>Recitation</span>
                  </>
                )}
              </button>
            )}
          </div>
          <div className="text-xs leading-relaxed font-sans">{quranRef}</div>
        </div>
      );
    }

    const parsedRef = extractSurahAndAyah(quranRef.verseNumber, quranRef.surahName);

    return (
      <div
        className={`p-3.5 rounded-2xl border transition-all ${
          isDark
            ? 'bg-[#141922]/90 border-[#DFBA7F]/30 text-stone-100'
            : 'bg-amber-50/90 border-[#C9A063]/35 text-stone-900 shadow-2xs'
        }`}
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 font-cinzel font-bold text-xs text-[#DFBA7F]">
            <BookOpen className="w-3.5 h-3.5" />
            <span>Surah {quranRef.surahName}</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-[#DFBA7F]/15 border border-[#DFBA7F]/30 text-[#DFBA7F]">
              Qur'an {quranRef.verseNumber}
            </span>
            {parsedRef && (
              <button
                onClick={() =>
                  handlePlayVerseAudio(
                    parsedRef.surahNum,
                    parsedRef.ayahNum,
                    `ayah-${parsedRef.surahNum}-${parsedRef.ayahNum}`
                  )
                }
                className="flex items-center gap-1 px-2 py-1 rounded-xl bg-[#DFBA7F]/20 hover:bg-[#DFBA7F]/30 text-[#DFBA7F] border border-[#DFBA7F]/40 text-[10px] font-semibold transition-all active:scale-95 shadow-2xs"
                title="Listen to Qur'an recitation"
              >
                {playingVerseKey === `ayah-${parsedRef.surahNum}-${parsedRef.ayahNum}` ? (
                  <>
                    <Pause className="w-3 h-3 animate-pulse" />
                    <span>Pause</span>
                  </>
                ) : (
                  <>
                    <Volume2 className="w-3 h-3" />
                    <span>Recitation</span>
                  </>
                )}
              </button>
            )}
          </div>
        </div>

        {quranRef.textArabic && (
          <p
            dir="rtl"
            className="text-right font-quran text-base sm:text-lg leading-loose text-[#DFBA7F] my-2 px-1"
          >
            {quranRef.textArabic}
          </p>
        )}

        {quranRef.textTranslation && (
          <p
            className={`text-xs leading-relaxed italic ${
              isDark ? 'text-stone-300' : 'text-stone-700'
            }`}
          >
            "{quranRef.textTranslation}"
          </p>
        )}
      </div>
    );
  };

  // Helper renderer for Hadith reference
  const renderHadithRef = (hadithRef: HadithRefData | string) => {
    if (typeof hadithRef === 'string') {
      return (
        <div
          className={`p-3.5 rounded-2xl border transition-all ${
            isDark
              ? 'bg-[#12161E]/90 border-stone-700/60 text-stone-200'
              : 'bg-stone-50/90 border-stone-200 text-stone-800'
          }`}
        >
          <div className="flex items-center gap-1.5 font-cinzel font-bold text-xs text-[#DFBA7F] mb-1.5">
            <span>📚</span>
            <span>Hadith Reference</span>
          </div>
          <div className="text-xs leading-relaxed font-sans">{hadithRef}</div>
        </div>
      );
    }

    return (
      <div
        className={`p-3.5 rounded-2xl border transition-all ${
          isDark
            ? 'bg-[#12161E]/90 border-stone-700/60 text-stone-200'
            : 'bg-stone-50/90 border-stone-200 text-stone-800'
        }`}
      >
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-1.5 font-cinzel font-bold text-xs text-[#DFBA7F]">
            <span>📚</span>
            <span>{hadithRef.collection}</span>
          </div>
          {hadithRef.number && (
            <span
              className={`text-[10px] px-2 py-0.5 rounded-full border ${
                isDark
                  ? 'bg-stone-800/80 border-stone-700 text-stone-300'
                  : 'bg-stone-200/70 border-stone-300 text-stone-700'
              }`}
            >
              #{hadithRef.number}
            </span>
          )}
        </div>

        <p className="text-xs leading-relaxed my-1.5">"{hadithRef.text}"</p>

        {hadithRef.status && (
          <div className="flex items-center gap-1 text-[10px] text-[#DFBA7F] mt-1.5 font-medium">
            <ShieldCheck className="w-3 h-3" />
            <span>Grade: {hadithRef.status}</span>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-[calc(100dvh-60px)] lg:h-[calc(100dvh-20px)] w-full max-w-4xl xl:max-w-5xl mx-auto px-3 sm:px-6 pt-2 pb-20 sm:pb-22 lg:pb-3 lg:pt-2 relative animate-fadeIn">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-18 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-2xl bg-[#090B0E]/98 text-[#DFBA7F] border border-[#DFBA7F]/40 shadow-md text-xs font-semibold animate-fadeIn flex items-center gap-2">
          <Sparkles className="w-3.5 h-3.5 text-[#DFBA7F]" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Header Bar with Verified Badge, History & New Chat */}
      <div
        id="noor-ai-top-header"
        className={`p-3 rounded-2xl border flex items-center justify-between mb-3 shrink-0 transition-all duration-200 ${
          isDark
            ? 'bg-[#0E1217] border-[#C9A063]/25 shadow-sm'
            : 'bg-white border-[#C9A063]/25 shadow-2xs'
        }`}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-2xl bg-gradient-to-tr from-[#C9A063] to-[#DFBA7F] text-[#090B0E] flex items-center justify-center shadow-md font-bold shrink-0">
            <NoorAIIcon className="w-4 h-4 text-[#090B0E]" />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h2
                className={`text-xs sm:text-sm font-cinzel font-bold tracking-wider ${
                  isDark ? 'text-[#F5EFE6]' : 'text-stone-900'
                }`}
              >
                NOOR AI
              </h2>
              <span className="flex items-center gap-0.5 text-[9px] font-semibold text-[#DFBA7F] bg-[#C9A063]/10 px-1.5 py-0.5 rounded-full border border-[#C9A063]/25">
                <ShieldCheck className="w-2.5 h-2.5" />
                {t(lang, 'verifiedSources')}
              </span>
            </div>
            <p className="text-[10px] text-stone-400 truncate max-w-[170px] sm:max-w-[280px]">
              {currentSession?.title || t(lang, 'noorAiTitle')}
            </p>
          </div>
        </div>

        {/* Action Controls: Live Voice, History, New Chat, Privacy, Clear */}
        <div className="flex items-center gap-1.5">
          <button
            id="open-live-voice-btn"
            onClick={() => setShowLiveVoiceModal(true)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-tr from-[#C9A063] to-[#DFBA7F] hover:brightness-110 text-[#090B0E] text-[11px] font-bold shadow-md transition-all active:scale-95 animate-pulse"
            title="Open Real-time Live Voice Talk"
          >
            <Radio className="w-3.5 h-3.5" />
            <span>{t(lang, 'liveVoice')}</span>
          </button>

          <button
            id="open-history-btn"
            onClick={() => setShowHistoryDrawer(true)}
            className={`p-2 rounded-xl border text-xs transition-all flex items-center gap-1 ${
              isDark
                ? 'bg-stone-800/40 border-stone-700/60 text-stone-300 hover:text-white hover:bg-stone-800/80'
                : 'bg-stone-100 border-stone-200 text-stone-700 hover:text-stone-900 hover:bg-stone-200'
            }`}
            title="Conversation History"
          >
            <History className="w-3.5 h-3.5" />
            <span className="hidden sm:inline text-[11px] font-medium">{t(lang, 'history')}</span>
          </button>

          <button
            id="new-chat-btn"
            onClick={handleNewChat}
            className="flex items-center gap-1 px-3 py-1.5 rounded-xl bg-gradient-to-tr from-[#C9A063]/20 to-[#DFBA7F]/20 hover:from-[#C9A063]/30 hover:to-[#DFBA7F]/30 text-[#DFBA7F] text-[11px] font-semibold border border-[#C9A063]/35 transition-all active:scale-95 shadow-2xs"
            title="Start a new chat"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>{t(lang, 'newChat')}</span>
          </button>

          {activeMessages.length > 0 && (
            <button
              id="clear-chat-btn"
              onClick={() => setShowClearConfirmModal(true)}
              className="p-2 rounded-xl border border-white/5 hover:border-red-500/30 hover:bg-red-500/10 text-stone-400 hover:text-red-400 text-xs transition-all"
              title="Clear current conversation"
            >
              <Trash2 className="w-3.5 h-3.5" />
            </button>
          )}

          <button
            id="privacy-info-btn"
            onClick={() => setShowPrivacyModal(true)}
            className="p-2 rounded-xl border border-white/5 hover:border-[#DFBA7F]/30 text-stone-400 hover:text-[#DFBA7F] text-xs transition-all"
            title="Privacy & Data Transparency"
          >
            <Lock className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Messages Scroll Area */}
      <div className="flex-1 overflow-y-auto space-y-4 pr-1 no-scrollbar min-h-0">
        {/* Brand New User / Zero-Conversation Sanctuary Header */}
        {activeMessages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-6 text-center animate-fadeIn px-2">
            <div className="relative mb-4">
              <div className="w-16 h-16 rounded-3xl bg-gradient-to-tr from-[#C9A063] via-[#DFBA7F] to-[#B88E4F] flex items-center justify-center text-[#090B0E] shadow-[0_8px_32px_rgba(201,160,99,0.4)] animate-pulse">
                <NoorAIIcon className="w-8 h-8 text-[#090B0E]" />
              </div>
              <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-[#0E1217] border-2 border-[#DFBA7F] flex items-center justify-center text-[#DFBA7F]">
                <Sparkles className="w-3 h-3" />
              </div>
            </div>

            <h3
              className={`font-serif-heading font-bold text-lg sm:text-xl mb-1.5 ${
                isDark ? 'text-[#F5EFE6]' : 'text-stone-900'
              }`}
            >
              {t(lang, 'noorAiHeader')}
            </h3>
            <p className="text-xs text-stone-400 max-w-sm mb-6 leading-relaxed">
              {t(lang, 'noorAiSubheader')}
            </p>

            {/* Starter Suggestion Buttons (Strictly suggestions, not fake history) */}
            <div className="w-full max-w-md space-y-2 text-left">
              <div className="text-[10px] font-cinzel font-bold uppercase tracking-wider text-[#DFBA7F] px-1">
                {t(lang, 'quickReflections')}
              </div>
              {starterSuggestions.map((item, idx) => (
                <button
                  key={idx}
                  onClick={() => handleSendMessage(item.title)}
                  className={`w-full p-3 rounded-2xl border text-left transition-all group flex items-center justify-between ${
                    isDark
                      ? 'bg-[#0E1217]/80 hover:bg-[#151B24] border-[#C9A063]/20 hover:border-[#DFBA7F]/50 text-stone-200'
                      : 'bg-white hover:bg-amber-50/60 border-stone-200 hover:border-[#C9A063]/50 text-stone-800 shadow-2xs'
                  }`}
                >
                  <div>
                    <div className="text-xs font-semibold group-hover:text-[#DFBA7F] transition-colors">
                      {item.title}
                    </div>
                    <div className="text-[11px] text-stone-400 mt-0.5">{item.desc}</div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-stone-400 group-hover:text-[#DFBA7F] transition-transform group-hover:translate-x-1 shrink-0 ml-2" />
                </button>
              ))}
            </div>
          </div>
        ) : (
          activeMessages.map((msg) => {
            const isUser = msg.sender === 'user';
            const isSaved = msg.isSaved || userStats?.savedNoorMessages?.some((s) => s.id === msg.id);

            return (
              <div
                key={msg.id}
                id={`chat-msg-${msg.id}`}
                className={`flex flex-col ${isUser ? 'items-end' : 'items-start'} animate-fadeIn`}
              >
                {/* User Message (Floating Liquid Glass Bubble) */}
                {isUser ? (
                  <div className="max-w-[88%] sm:max-w-[80%] rounded-3xl rounded-br-xs px-4 py-3 bg-gradient-to-tr from-[#C9A063] via-[#DFBA7F] to-[#B88E4F] text-[#090B0E] font-medium border border-[#DFBA7F]/40 shadow-md">
                    <p className="text-xs sm:text-sm leading-relaxed whitespace-pre-wrap">
                      {msg.text}
                    </p>
                  </div>
                ) : (
                  /* Noor AI Response (Structured Sectioned Layout) */
                  <div
                    className={`w-full max-w-[96%] sm:max-w-[92%] rounded-3xl rounded-bl-xs p-4 sm:p-5 border transition-all ${
                      msg.isError
                        ? 'bg-red-500/10 border-red-500/30 text-red-300'
                        : isDark
                        ? 'bg-[#0E1217] border-[#C9A063]/25 text-stone-100 shadow-md'
                        : 'bg-white border-stone-200 text-stone-900 shadow-sm'
                    }`}
                  >
                    {/* Error State with Retry */}
                    {msg.isError ? (
                      <div className="space-y-3">
                        <div className="flex items-center gap-2 text-red-400 text-xs font-semibold">
                          <AlertTriangle className="w-4 h-4" />
                          <span>Response Interrupted</span>
                        </div>
                        <p className="text-xs leading-relaxed text-stone-300">{msg.text}</p>
                        <button
                          onClick={handleRetry}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/30 border border-red-500/40 text-red-300 text-xs font-semibold transition-all active:scale-95"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                          <span>Retry</span>
                        </button>
                      </div>
                    ) : (
                      <div className="space-y-3.5">
                        {/* Section 0: Islamic Greeting Banner */}
                        {msg.greeting && (
                          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-[#DFBA7F]/15 via-[#C9A063]/10 to-[#DFBA7F]/15 border border-[#DFBA7F]/30 text-stone-200">
                            <div className="flex items-center gap-1.5 font-cinzel font-semibold text-[#DFBA7F] text-[11px] mb-1">
                              <Sparkles className="w-3.5 h-3.5 text-[#DFBA7F]" />
                              <span>Islamic Greeting • تحية وترحيب</span>
                            </div>
                            <p className="text-xs sm:text-sm leading-relaxed text-[#DFBA7F] font-arabic" dir="rtl">
                              {msg.greeting}
                            </p>
                          </div>
                        )}

                        {/* Section 1: Short Direct Answer (Answer First) */}
                        <div className="text-xs sm:text-sm leading-relaxed font-normal text-stone-100 whitespace-pre-wrap">
                          <span
                            className={
                              isDark ? 'text-[#F5EFE6]' : 'text-stone-900'
                            }
                          >
                            {msg.text}
                          </span>
                        </div>

                        {/* Section 2: 📖 Qur'an Reference */}
                        {msg.quranReference && renderQuranRef(msg.quranReference)}

                        {/* Section 3: ✨ Tadabbur (Qur'anic Reflection) */}
                        {msg.tadabbur && (
                          <div className="p-3.5 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-xs leading-relaxed">
                            <div className="flex items-center gap-1.5 font-cinzel font-semibold text-[#DFBA7F] text-[11px] mb-1">
                              <Sparkles className="w-3.5 h-3.5" />
                              <span>Tadabbur (Qur'anic Reflection) • تدبر الآية الكريمة</span>
                            </div>
                            <p className="text-stone-300 leading-relaxed">{msg.tadabbur}</p>
                          </div>
                        )}

                        {/* Section 4: 📚 Hadith Reference */}
                        {msg.hadithReference && renderHadithRef(msg.hadithReference)}

                        {/* Section 5: 💡 Meaning / Context / Classical Explanation */}
                        {msg.explanation && (
                          <div
                            className={`p-3.5 rounded-2xl border text-xs leading-relaxed ${
                              isDark
                                ? 'bg-stone-900/60 border-stone-800 text-stone-300'
                                : 'bg-stone-50 border-stone-200 text-stone-700'
                            }`}
                          >
                            <div className="flex items-center gap-1.5 font-cinzel font-semibold text-[#DFBA7F] text-[11px] mb-1">
                              <BookOpen className="w-3.5 h-3.5 text-[#DFBA7F]" />
                              <span>Meaning & Classical Explanation • البيان والشرح</span>
                            </div>
                            <p className="leading-relaxed">{msg.explanation}</p>
                          </div>
                        )}

                        {/* Section 6: 🤲 Concluding Supplication / Du'a */}
                        {msg.concludingDua && (
                          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-[#C9A063]/15 via-[#DFBA7F]/10 to-[#C9A063]/15 border border-[#DFBA7F]/30 text-stone-200">
                            <div className="flex items-center gap-1.5 font-cinzel font-semibold text-[#DFBA7F] text-[11px] mb-1">
                              <Heart className="w-3.5 h-3.5 text-[#DFBA7F]" />
                              <span>Supplication (Du'a) • دعاء مبارك</span>
                            </div>
                            <p className="text-xs sm:text-sm leading-relaxed text-[#DFBA7F] font-arabic" dir="rtl">
                              {msg.concludingDua}
                            </p>
                          </div>
                        )}

                        {/* Section 7: ⚖️ Scholarly Disagreement / Differing Views */}
                        {msg.scholarlyDisagreement && (
                          <div className="p-3 rounded-2xl bg-amber-500/10 border border-amber-500/25 text-amber-200 text-xs leading-relaxed">
                            <div className="flex items-center gap-1.5 font-cinzel font-semibold text-[#DFBA7F] text-[11px] mb-1">
                              <Scale className="w-3.5 h-3.5" />
                              <span>Scholarly Perspectives</span>
                            </div>
                            <p className="text-stone-300">{msg.scholarlyDisagreement}</p>
                          </div>
                        )}

                        {/* Section 8: ⚠️ Personal Religious Ruling Advisory */}
                        {msg.isPersonalRulingAdvice && (
                          <div className="p-3 rounded-2xl bg-stone-800/60 border border-stone-700 text-stone-300 text-[11px] flex items-start gap-2">
                            <Info className="w-3.5 h-3.5 text-[#DFBA7F] shrink-0 mt-0.5" />
                            <span>
                              For personal legal decisions or binding rulings (Fatwa), please
                              consult a trusted, qualified local Islamic scholar.
                            </span>
                          </div>
                        )}

                        {/* Section 9: Explain More (Expandable on demand) */}
                        {msg.detailedExplanation && (
                          <div className="pt-1">
                            <button
                              onClick={() => toggleExplainMore(msg.id)}
                              className="text-xs font-semibold text-[#DFBA7F] hover:underline flex items-center gap-1 transition-colors"
                            >
                              <span>
                                {expandedExplainMore[msg.id]
                                  ? 'Show less ↑'
                                  : 'Explain more →'}
                              </span>
                            </button>

                            {expandedExplainMore[msg.id] && (
                              <div
                                className={`mt-2 p-3.5 rounded-2xl border text-xs leading-relaxed animate-fadeIn ${
                                  isDark
                                    ? 'bg-[#12161F] border-[#DFBA7F]/20 text-stone-200'
                                    : 'bg-amber-50/50 border-[#C9A063]/20 text-stone-800'
                                }`}
                              >
                                <p className="whitespace-pre-wrap">{msg.detailedExplanation}</p>
                              </div>
                            )}
                          </div>
                        )}

                        {/* Section 10: Sources ▾ Expandable Accordion */}
                        {msg.sources && msg.sources.length > 0 && (
                          <div className="pt-1 border-t border-[#C9A063]/15">
                            <button
                              onClick={() => toggleSources(msg.id)}
                              className="flex items-center gap-1.5 text-[11px] font-semibold text-stone-400 hover:text-[#DFBA7F] transition-colors py-1"
                            >
                              <ShieldCheck className="w-3 h-3 text-[#DFBA7F]" />
                              <span>Sources & References ({msg.sources.length})</span>
                              {expandedSources[msg.id] ? (
                                <ChevronUp className="w-3 h-3 ml-0.5" />
                              ) : (
                                <ChevronDown className="w-3 h-3 ml-0.5" />
                              )}
                            </button>

                            {expandedSources[msg.id] && (
                              <div className="mt-1.5 space-y-1 pl-2 border-l-2 border-[#DFBA7F]/40 animate-fadeIn">
                                {msg.sources.map((src, sIdx) => (
                                  <div
                                    key={sIdx}
                                    className="text-[11px] text-stone-400 flex items-center gap-1.5"
                                  >
                                    <span className="w-1 h-1 rounded-full bg-[#DFBA7F]" />
                                    <span>{src}</span>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Section 11: Suggested Follow-up Inquiries */}
                        {msg.suggestedFollowUps && msg.suggestedFollowUps.length > 0 && (
                          <div className="pt-2 flex flex-wrap gap-1.5">
                            {msg.suggestedFollowUps.map((prompt, pIdx) => (
                              <button
                                key={pIdx}
                                onClick={() => handleSendMessage(prompt)}
                                className={`text-[10px] px-2.5 py-1 rounded-xl border transition-all ${
                                  isDark
                                    ? 'bg-stone-800/50 hover:bg-stone-800 border-stone-700/60 text-stone-300 hover:text-[#DFBA7F]'
                                    : 'bg-stone-100 hover:bg-stone-200 border-stone-200 text-stone-700 hover:text-stone-900'
                                }`}
                              >
                                💬 {prompt}
                              </button>
                            ))}
                          </div>
                        )}

                        {/* Section 10: Action Toolbar (Helpful, Copy, Save, Share) */}
                        <div className="pt-2 border-t border-stone-800/40 flex items-center justify-between text-[11px] text-stone-400">
                          <div className="flex items-center gap-1">
                            {/* Helpful ♡ */}
                            <button
                              onClick={() => handleFeedback(msg.id, 'helpful')}
                              className={`p-1.5 rounded-lg border transition-all flex items-center gap-1 ${
                                msg.feedback === 'helpful'
                                  ? 'bg-[#DFBA7F]/20 border-[#DFBA7F]/50 text-[#DFBA7F]'
                                  : 'border-transparent hover:bg-white/5 hover:text-stone-200'
                              }`}
                              title="Helpful response"
                            >
                              <ThumbsUp className="w-3 h-3" />
                              <span className="text-[10px]">Helpful</span>
                            </button>

                            {/* Not helpful 👎 */}
                            <button
                              onClick={() => handleFeedback(msg.id, 'unhelpful')}
                              className={`p-1.5 rounded-lg border transition-all ${
                                msg.feedback === 'unhelpful'
                                  ? 'bg-stone-800 border-stone-600 text-stone-300'
                                  : 'border-transparent hover:bg-white/5 hover:text-stone-200'
                              }`}
                              title="Not helpful"
                            >
                              <ThumbsDown className="w-3 h-3" />
                            </button>
                          </div>

                          <div className="flex items-center gap-1">
                            {/* Read Aloud / TTS Voice 🔊 */}
                            <button
                              onClick={() => handleToggleTTS(msg)}
                              disabled={isTtsLoadingId === msg.id}
                              className={`p-1.5 rounded-lg border transition-all flex items-center gap-1 ${
                                playingTtsId === msg.id
                                  ? 'bg-[#DFBA7F]/25 border-[#DFBA7F] text-[#DFBA7F] animate-pulse shadow-xs'
                                  : 'border-transparent hover:bg-white/5 hover:text-[#DFBA7F]'
                              }`}
                              title={
                                playingTtsId === msg.id
                                  ? 'Stop audio'
                                  : 'Listen to response with tranquil AI voice'
                              }
                            >
                              {isTtsLoadingId === msg.id ? (
                                <div className="w-3.5 h-3.5 border-2 border-[#DFBA7F] border-t-transparent rounded-full animate-spin" />
                              ) : playingTtsId === msg.id ? (
                                <VolumeX className="w-3.5 h-3.5 text-[#DFBA7F]" />
                              ) : (
                                <Volume2 className="w-3.5 h-3.5" />
                              )}
                              <span className="text-[10px]">
                                {isTtsLoadingId === msg.id
                                  ? 'Loading…'
                                  : playingTtsId === msg.id
                                  ? 'Playing'
                                  : 'Listen'}
                              </span>
                            </button>

                            {/* Save / Bookmark 🔖 */}
                            <button
                              onClick={() => handleToggleSave(msg)}
                              className={`p-1.5 rounded-lg border transition-all flex items-center gap-1 ${
                                isSaved
                                  ? 'bg-[#DFBA7F]/20 border-[#DFBA7F]/40 text-[#DFBA7F]'
                                  : 'border-transparent hover:bg-white/5 hover:text-stone-200'
                              }`}
                              title={isSaved ? 'Saved to bookmarks' : 'Save response'}
                            >
                              {isSaved ? (
                                <BookmarkCheck className="w-3.5 h-3.5 text-[#DFBA7F]" />
                              ) : (
                                <Bookmark className="w-3.5 h-3.5" />
                              )}
                            </button>

                            {/* Copy 📋 */}
                            <button
                              onClick={() => handleCopyMessage(msg)}
                              className="p-1.5 rounded-lg border border-transparent hover:bg-white/5 hover:text-[#DFBA7F] transition-all"
                              title="Copy full verified answer"
                            >
                              {copiedId === msg.id ? (
                                <Check className="w-3.5 h-3.5 text-[#DFBA7F]" />
                              ) : (
                                <Copy className="w-3.5 h-3.5" />
                              )}
                            </button>

                            {/* Share ↗ */}
                            <button
                              onClick={() => handleShareMessage(msg)}
                              className="p-1.5 rounded-lg border border-transparent hover:bg-white/5 hover:text-[#DFBA7F] transition-all"
                              title="Share answer"
                            >
                              <Share2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <span className="text-[10px] text-stone-400 mt-1 px-2">{msg.timestamp}</span>
              </div>
            );
          })
        )}

        {/* Responsive Typing / Loading State (Noor is thinking…) */}
        {isLoading && (
          <div className="flex items-center gap-3 p-4 rounded-3xl bg-[#0E1217] border border-[#C9A063]/30 text-xs text-[#DFBA7F] max-w-[85%] sm:max-w-[70%] shadow-md animate-fadeIn">
            <div className="relative">
              <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-[#C9A063] to-[#DFBA7F] text-[#090B0E] flex items-center justify-center font-bold">
                <NoorAIIcon className="w-4 h-4 text-[#090B0E]" />
              </div>
            </div>
            <div>
              <div className="font-semibold text-[#DFBA7F] flex items-center gap-1.5">
                <span>Noor is thinking…</span>
                <span className="flex gap-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#DFBA7F] animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#DFBA7F] animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="w-1.5 h-1.5 rounded-full bg-[#DFBA7F] animate-bounce" style={{ animationDelay: '300ms' }} />
                </span>
              </div>
              <p className="text-[10px] text-stone-400 mt-0.5">
                Verifying Qur'an and authentic Sunnah references
              </p>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Floating Liquid Glass Message Composer */}
      <div className="mt-auto pt-2 shrink-0 relative z-20">
        <form
          onSubmit={(e) => {
            e.preventDefault();
            handleSendMessage();
          }}
          className="relative flex items-center"
        >
          <input
            ref={inputRef}
            type="text"
            value={inputQuery}
            onChange={(e) => setInputQuery(e.target.value)}
            placeholder={isListening ? t(lang, 'listening') : t(lang, 'askPlaceholder')}
            disabled={isLoading}
            className={`w-full pl-4.5 pr-32 sm:pr-36 py-3.5 sm:py-4 rounded-2xl text-xs sm:text-sm font-medium border transition-all focus:outline-none focus:ring-2 focus:ring-[#C9A063]/50 shadow-sm ${
              isListening
                ? 'ring-2 ring-red-500/50 bg-red-500/5'
                : ''
            } ${
              isDark
                ? 'bg-[#0E1217]/95 border-[#C9A063]/30 text-white placeholder-stone-500 shadow-lg'
                : 'bg-white border-stone-200 text-stone-900 placeholder-stone-400 shadow-sm'
            }`}
          />

          <div className="absolute right-2 flex items-center gap-1.5">
            {/* 🎙️ Live Voice Talk Launcher */}
            <button
              type="button"
              onClick={() => setShowLiveVoiceModal(true)}
              className="w-8 h-8 rounded-xl bg-[#DFBA7F]/20 hover:bg-[#DFBA7F]/30 border border-[#DFBA7F]/40 text-[#DFBA7F] flex items-center justify-center transition-all active:scale-95 shadow-2xs"
              title="Live Voice Talk (Gemini Live)"
            >
              <Radio className="w-3.5 h-3.5" />
            </button>

            {/* 🎙️ Voice Dictation Toggle */}
            <button
              type="button"
              onClick={toggleVoiceInput}
              disabled={isLoading}
              className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all ${
                isListening
                  ? 'bg-red-500 text-white animate-pulse shadow-md'
                  : isDark
                  ? 'bg-stone-800 hover:bg-stone-700 text-stone-300 hover:text-white'
                  : 'bg-stone-100 hover:bg-stone-200 text-stone-600 hover:text-stone-900'
              }`}
              title={isListening ? 'Stop dictation' : 'Speech to text dictation'}
            >
              {isListening ? <MicOff className="w-3.5 h-3.5" /> : <Mic className="w-3.5 h-3.5" />}
            </button>

            {/* ➤ Send Button (Active only when text entered) */}
            <button
              type="submit"
              disabled={!inputQuery.trim() || isLoading}
              className="w-9 h-9 rounded-xl bg-gradient-to-tr from-[#C9A063] to-[#DFBA7F] hover:opacity-95 disabled:opacity-30 text-[#090B0E] font-bold flex items-center justify-center shadow-md transition-all active:scale-95 disabled:pointer-events-none"
              title="Send message"
            >
              <Send className="w-4 h-4 ml-0.5" />
            </button>
          </div>
        </form>

        <p className="text-[10px] sm:text-[11px] text-center text-stone-400/80 mt-2 tracking-wide font-normal">
          Ask → understand → learn. Always verify personal verdicts with a trusted scholar.
        </p>
      </div>

      {/* Conversation History Drawer / Modal */}
      {showHistoryDrawer && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div
            className={`w-full max-w-sm h-full p-5 flex flex-col border-l shadow-2xl ${
              isDark
                ? 'bg-[#0E1217] border-[#C9A063]/30 text-stone-100'
                : 'bg-white border-stone-200 text-stone-900'
            }`}
          >
            <div className="flex items-center justify-between pb-4 border-b border-stone-800/60 shrink-0">
              <div className="flex items-center gap-2">
                <History className="w-4 h-4 text-[#DFBA7F]" />
                <h3 className="font-serif-heading font-bold text-sm">Conversation History</h3>
              </div>
              <button
                onClick={() => setShowHistoryDrawer(false)}
                className="p-1.5 rounded-lg hover:bg-white/5 text-stone-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* New Chat Button inside drawer */}
            <button
              onClick={handleNewChat}
              className="w-full mt-4 p-3 rounded-2xl bg-gradient-to-tr from-[#C9A063]/20 to-[#DFBA7F]/20 hover:from-[#C9A063]/30 hover:to-[#DFBA7F]/30 border border-[#C9A063]/40 text-[#DFBA7F] text-xs font-semibold flex items-center justify-center gap-2 transition-all shrink-0"
            >
              <Plus className="w-4 h-4" />
              <span>Start New Chat</span>
            </button>

            {/* List of Sessions */}
            <div className="flex-1 overflow-y-auto mt-4 space-y-2 no-scrollbar">
              {existingSessions.length === 0 ? (
                <div className="text-center py-10 text-xs text-stone-400">
                  No conversation history yet. Start asking Noor!
                </div>
              ) : (
                existingSessions.map((sess) => {
                  const isActive = sess.id === activeSessionId;
                  const messageCount = sess.messages.length;

                  return (
                    <div
                      key={sess.id}
                      onClick={() => handleSwitchSession(sess.id)}
                      className={`p-3 rounded-2xl border transition-all cursor-pointer group flex items-center justify-between ${
                        isActive
                          ? 'bg-[#DFBA7F]/15 border-[#DFBA7F]/50 text-[#DFBA7F]'
                          : isDark
                          ? 'bg-stone-900/60 hover:bg-stone-800/80 border-stone-800 text-stone-300'
                          : 'bg-stone-50 hover:bg-stone-100 border-stone-200 text-stone-800'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <MessageSquare
                          className={`w-4 h-4 shrink-0 ${
                            isActive ? 'text-[#DFBA7F]' : 'text-stone-400'
                          }`}
                        />
                        <div className="min-w-0">
                          <p className="text-xs font-semibold truncate">{sess.title}</p>
                          <p className="text-[10px] text-stone-400">
                            {messageCount} {messageCount === 1 ? 'message' : 'messages'}
                          </p>
                        </div>
                      </div>

                      <button
                        onClick={(e) => handleDeleteSession(sess.id, e)}
                        className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/20 text-stone-400 hover:text-red-400 transition-all shrink-0 ml-2"
                        title="Delete conversation"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>

            {/* Saved Messages Quick Link */}
            {userStats?.savedNoorMessages && userStats.savedNoorMessages.length > 0 && (
              <div className="pt-3 border-t border-stone-800/60 shrink-0">
                <div className="text-[10px] uppercase font-cinzel font-bold text-stone-400 mb-2">
                  Saved Insights ({userStats.savedNoorMessages.length})
                </div>
                <div className="max-h-28 overflow-y-auto space-y-1.5 no-scrollbar">
                  {userStats.savedNoorMessages.slice(0, 3).map((saved) => (
                    <div
                      key={saved.id}
                      className="p-2 rounded-xl bg-stone-900/40 border border-stone-800 text-[11px] text-stone-300 truncate"
                    >
                      🔖 {saved.text.slice(0, 45)}...
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Privacy Notice Modal */}
      {showPrivacyModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div
            className={`w-full max-w-md rounded-3xl p-6 border shadow-2xl ${
              isDark
                ? 'bg-[#0E1217] border-[#C9A063]/30 text-stone-100'
                : 'bg-white border-stone-200 text-stone-900'
            }`}
          >
            <div className="w-12 h-12 rounded-2xl bg-[#C9A063]/15 border border-[#C9A063]/30 flex items-center justify-center text-[#DFBA7F] mx-auto mb-4">
              <Lock className="w-6 h-6" />
            </div>

            <h3 className="text-center font-serif-heading font-bold text-base mb-2">
              Privacy & Data Transparency
            </h3>
            <p className="text-xs text-stone-300 leading-relaxed mb-4 text-center">
              Your conversations are associated with your Noor account so you can access them across
              your devices. We protect your information and explain how your data is used in our
              Privacy Policy.
            </p>

            <div className="space-y-2 mb-6 text-xs text-stone-400">
              <div className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-[#DFBA7F]" />
                <span>You can delete individual conversations anytime.</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-[#DFBA7F]" />
                <span>You can clear your entire chat history in settings.</span>
              </div>
              <div className="flex items-center gap-2">
                <Check className="w-3.5 h-3.5 text-[#DFBA7F]" />
                <span>Noor AI answers are grounded in authentic Islamic sources.</span>
              </div>
            </div>

            <button
              onClick={() => setShowPrivacyModal(false)}
              className="w-full py-3 rounded-2xl bg-gradient-to-tr from-[#C9A063] to-[#DFBA7F] text-[#090B0E] text-xs font-bold transition-all shadow-md active:scale-95"
            >
              Understood
            </button>
          </div>
        </div>
      )}

      {/* Clear Chat Confirmation Modal */}
      {showClearConfirmModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-fadeIn">
          <div
            className={`w-full max-w-sm rounded-3xl p-6 border shadow-2xl ${
              isDark
                ? 'bg-[#0E1217] border-[#C9A063]/30 text-stone-100'
                : 'bg-white border-stone-200 text-stone-900'
            }`}
          >
            <div className="w-12 h-12 rounded-2xl bg-red-500/15 border border-red-500/30 flex items-center justify-center text-red-400 mx-auto mb-4">
              <Trash2 className="w-6 h-6" />
            </div>

            <h3 className="text-center font-serif-heading font-bold text-base mb-2">
              Clear Conversation?
            </h3>
            <p className="text-center text-xs text-stone-400 leading-relaxed mb-6">
              Are you sure you want to clear the current conversation? Your previous chats in history
              will remain intact.
            </p>

            <div className="flex items-center gap-2.5">
              <button
                onClick={() => setShowClearConfirmModal(false)}
                className="flex-1 py-2.5 px-4 rounded-xl border border-white/10 text-xs font-semibold hover:bg-white/5 transition-colors"
              >
                Cancel
              </button>
              <button
                id="confirm-delete-chat-btn"
                onClick={handleClearCurrentConversation}
                className="flex-1 py-2.5 px-4 rounded-xl bg-red-500 hover:bg-red-600 text-white text-xs font-semibold transition-colors shadow-md"
              >
                Clear Chat
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Gemini Live Voice Real-Time Talk Modal */}
      <LiveVoiceModal
        isOpen={showLiveVoiceModal}
        onClose={() => setShowLiveVoiceModal(false)}
        isDark={isDark}
        initialVoice={activeVoiceName}
        onSaveToChat={handleLiveSessionTranscripts}
      />
    </div>
  );
};
