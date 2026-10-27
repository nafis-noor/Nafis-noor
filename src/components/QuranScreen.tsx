import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import {
  Search,
  BookOpen,
  Bookmark,
  Play,
  Pause,
  SkipBack,
  SkipForward,
  Volume2,
  Share2,
  Check,
  ChevronLeft,
  ChevronRight,
  Sparkles,
  Award,
  Layers,
  Heart,
  Loader2,
  Filter,
  ArrowUpDown,
  Navigation as NavigationIcon,
  Copy,
  SlidersHorizontal,
  RotateCcw,
  X,
  FileText,
  Flame,
  ArrowUpRight,
  Mic,
  GraduationCap
} from 'lucide-react';
import { Surah, Ayah, UserStats, Reciter } from '../types';
import { ALL_SURAHS, RECITERS, getAyahAudioUrl } from '../data/quranData';
import { loadCompleteSurah, preloadAdjacentSurahs, CANONICAL_COUNTS } from '../utils/quranLoader';
import { recordUserActivity } from '../utils/streakManager';
import { searchQuranVerses, QuranSearchMatch, POPULAR_QURAN_KEYWORDS } from '../utils/quranSearch';
import { Tasmee3Modal } from './Tasmee3Modal';
import { Tasmee3DockedBar } from './Tasmee3DockedBar';
import { Tasmee3Controller, Tasmee3Status, Tasmee3SessionSummary } from '../utils/tasmee3Speech';
import { QuranTeacherModal } from './quranTeacher/QuranTeacherModal';
import { useBackHandler } from '../utils/historyManager';
import { t, getLanguageCode } from '../utils/i18n';
import { useQuranLanguage } from '../utils/quranTranslations';

interface QuranScreenProps {
  isDark: boolean;
  userStats: UserStats;
  onUpdateStats: (stats: Partial<UserStats>) => void;
  initialSurahNumber?: number;
  language?: string;
}

export const QuranScreen: React.FC<QuranScreenProps> = React.memo(({
  isDark,
  userStats,
  onUpdateStats,
  initialSurahNumber,
  language,
}) => {
  const { activeLang, qt, edition } = useQuranLanguage(language || userStats.language);
  const lang = activeLang;
  const [searchQuery, setSearchQuery] = useState('');
  const [searchScope, setSearchScope] = useState<'surahs' | 'verses'>('surahs');
  const [activeTab, setActiveTab] = useState<'surahs' | 'verses' | 'bookmarks' | 'juz'>('surahs');
  const [selectedJuz, setSelectedJuz] = useState<number | null>(null);

  // Verse Keyword Search State
  const [verseSearchResults, setVerseSearchResults] = useState<QuranSearchMatch[]>([]);
  const [verseSearchCount, setVerseSearchCount] = useState<number>(0);
  const [isSearchingVerses, setIsSearchingVerses] = useState(false);
  const [verseSearchError, setVerseSearchError] = useState<string | null>(null);
  const [copiedSearchResultIndex, setCopiedSearchResultIndex] = useState<number | null>(null);

  // Active Surah & Reader State
  const [currentSurah, setCurrentSurah] = useState<Surah>(() => {
    if (initialSurahNumber) {
      return ALL_SURAHS.find(s => s.number === initialSurahNumber) || ALL_SURAHS[0];
    }
    return ALL_SURAHS.find(s => s.number === userStats.lastReadSurah) || ALL_SURAHS[0];
  });

  const [isReadingMode, setIsReadingMode] = useState(false);
  const [loadedAyahs, setLoadedAyahs] = useState<Ayah[]>([]);
  const [isLoadingAyahs, setIsLoadingAyahs] = useState(false);
  const [ayahLoadError, setAyahLoadError] = useState<string | null>(null);

  // Search & Jump within Active Surah
  const [surahSearchQuery, setSurahSearchQuery] = useState('');
  const [jumpToAyahInput, setJumpToAyahInput] = useState('');
  const [highlightedAyahNumber, setHighlightedAyahNumber] = useState<number | null>(null);

  // Audio Player State
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentAyahIndex, setCurrentAyahIndex] = useState(0);
  const [selectedReciter, setSelectedReciter] = useState<Reciter>(RECITERS[0]);
  const [showReciterMenu, setShowReciterMenu] = useState(false);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);

  // Display Preferences
  const [arabicFontSize, setArabicFontSize] = useState<number>(() => {
    try {
      const saved = localStorage.getItem('noor_quran_arabic_font_size');
      return saved ? Number(saved) : 28;
    } catch {
      return 28;
    }
  });
  const [showFontSettings, setShowFontSettings] = useState(false);
  const [showTranslation, setShowTranslation] = useState(true);
  const [copiedAyah, setCopiedAyah] = useState<number | null>(null);
  const [showSurahSelectDropdown, setShowSurahSelectDropdown] = useState(false);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const nextAudioPreloadRef = useRef<HTMLAudioElement | null>(null);
  const readerTopRef = useRef<HTMLDivElement | null>(null);
  const readerContainerRef = useRef<HTMLDivElement | null>(null);

  // =========================================================================
  // TASMEE3: QURAN RECITATION LISTENING STATE & CONTROLLER
  // =========================================================================
  const [showTasmee3Modal, setShowTasmee3Modal] = useState(false);
  const [tasmee3InitialSurah, setTasmee3InitialSurah] = useState<Surah | undefined>(undefined);
  const [tasmee3InitialVerse, setTasmee3InitialVerse] = useState<number>(1);
  const [tasmee3Active, setTasmee3Active] = useState(false);
  const [tasmee3Status, setTasmee3Status] = useState<Tasmee3Status>('idle');
  const [tasmee3Verse, setTasmee3Verse] = useState<number>(1);
  const [tasmee3StartingVerse, setTasmee3StartingVerse] = useState<number>(1);
  const [tasmee3AudioLevel, setTasmee3AudioLevel] = useState<number>(0);
  const [tasmee3UncertainMessage, setTasmee3UncertainMessage] = useState<string | null>(null);
  const [tasmee3Summary, setTasmee3Summary] = useState<Tasmee3SessionSummary | null>(null);
  const [showTasmee3SummaryModal, setShowTasmee3SummaryModal] = useState(false);

  // Quran Teacher AI interactive voice lesson state
  const [showQuranTeacherModal, setShowQuranTeacherModal] = useState(false);
  const [quranTeacherSurahNumber, setQuranTeacherSurahNumber] = useState<number>(1);
  const [quranTeacherStartAyah, setQuranTeacherStartAyah] = useState<number>(1);
  const [quranTeacherEndAyah, setQuranTeacherEndAyah] = useState<number>(7);

  // Browser Back button navigation hooks
  useBackHandler(isReadingMode, () => setIsReadingMode(false), 'quran-reading-mode');
  useBackHandler(showTasmee3Modal, () => setShowTasmee3Modal(false), 'quran-tasmee3-modal');
  useBackHandler(showTasmee3SummaryModal, () => setShowTasmee3SummaryModal(false), 'quran-tasmee3-summary');
  useBackHandler(showQuranTeacherModal, () => setShowQuranTeacherModal(false), 'quran-teacher-modal');
  useBackHandler(showFontSettings, () => setShowFontSettings(false), 'quran-font-settings');
  useBackHandler(showReciterMenu, () => setShowReciterMenu(false), 'quran-reciter-menu');

  const handleOpenQuranTeacher = useCallback(
    (surahNum?: number, startAyah?: number, endAyah?: number) => {
      const num = surahNum || currentSurah.number;
      const targetSurah = ALL_SURAHS.find((s) => s.number === num);
      const total = targetSurah ? targetSurah.numberOfAyahs : 7;
      const start = startAyah ? Math.min(Math.max(1, startAyah), total) : 1;
      const end = endAyah ? Math.min(Math.max(start, endAyah), total) : Math.min(start + 6, total);

      setQuranTeacherSurahNumber(num);
      setQuranTeacherStartAyah(start);
      setQuranTeacherEndAyah(end);
      setShowQuranTeacherModal(true);
    },
    [currentSurah]
  );

  const tasmee3ControllerRef = useRef<Tasmee3Controller | null>(null);

  // Cleanup Tasmee3 microphone streams on unmount
  useEffect(() => {
    return () => {
      if (tasmee3ControllerRef.current) {
        tasmee3ControllerRef.current.stop();
        tasmee3ControllerRef.current = null;
      }
    };
  }, []);

  // Open full Tasmee3 interactive modal
  const handleOpenTasmee3 = useCallback((startVerse: number = 1, surah?: Surah) => {
    const targetSurah = surah || currentSurah;
    setTasmee3InitialSurah(targetSurah);
    setTasmee3InitialVerse(Math.max(1, startVerse));
    setShowTasmee3Modal(true);
  }, [currentSurah]);

  // Start Tasmee3 directly inside reading view
  const handleStartTasmee3InReader = useCallback(async (startVerse: number) => {
    // 1. Pause any playing audio recitation to prevent audio interference
    setIsPlaying(false);

    // 2. Ensure we have loaded ayahs
    let ayahs = loadedAyahs;
    if (ayahs.length === 0) {
      try {
        setIsLoadingAyahs(true);
        ayahs = await loadCompleteSurah(currentSurah.number, lang);
        setLoadedAyahs(ayahs);
        setIsLoadingAyahs(false);
      } catch (err) {
        setIsLoadingAyahs(false);
        setTasmee3UncertainMessage('Failed to load authoritative Quran text. Please try again.');
        return;
      }
    }

    // 3. Clean up existing controller
    if (tasmee3ControllerRef.current) {
      tasmee3ControllerRef.current.stop();
    }

    setTasmee3StartingVerse(startVerse);
    setTasmee3Verse(startVerse);
    setTasmee3UncertainMessage(null);
    setTasmee3Active(true);

    const controller = new Tasmee3Controller({
      onStatusChange: (st) => {
        setTasmee3Status(st);
        if (st === 'stopped' || st === 'finished') {
          setTasmee3Active(false);
        } else if (st === 'listening' || st === 'paused') {
          setTasmee3Active(true);
        }
      },
      onPositionUpdate: (verseNum, result) => {
        setTasmee3Verse(verseNum);
        setTasmee3UncertainMessage(null);
        // Automatically smoothly scroll to newly matched verse
        const elem = document.getElementById(`ayah-${verseNum}`);
        if (elem) {
          elem.scrollIntoView({ behavior: 'smooth', block: 'center' });
        }
      },
      onUncertain: (msg) => {
        setTasmee3UncertainMessage(msg);
      },
      onAudioLevel: (lvl) => {
        setTasmee3AudioLevel(lvl);
      },
      onError: (err) => {
        setTasmee3UncertainMessage(err);
      },
    });

    tasmee3ControllerRef.current = controller;

    const ok = await controller.start({
      surahNumber: currentSurah.number,
      surahName: currentSurah.name,
      surahEnglishName: currentSurah.englishName,
      startingVerse: startVerse,
      verses: ayahs,
    });

    if (!ok) {
      setTasmee3Active(false);
    }
  }, [loadedAyahs, currentSurah]);

  const handlePauseTasmee3 = useCallback(() => {
    tasmee3ControllerRef.current?.pause();
  }, []);

  const handleResumeTasmee3 = useCallback(() => {
    tasmee3ControllerRef.current?.resume();
  }, []);

  const handleStopTasmee3 = useCallback(() => {
    tasmee3ControllerRef.current?.stop();
    setTasmee3Active(false);
    setTasmee3Status('stopped');
  }, []);

  const handleFinishTasmee3 = useCallback(() => {
    if (tasmee3ControllerRef.current) {
      const summary = tasmee3ControllerRef.current.finish();
      setTasmee3Summary(summary);
      setShowTasmee3SummaryModal(true);
      setTasmee3Active(false);
    }
  }, []);

  // Dynamic calculation for line-height corresponding to font size
  const getArabicLineHeight = useCallback((size: number) => {
    if (size >= 40) return '2.8';
    if (size >= 34) return '2.6';
    if (size >= 28) return '2.4';
    if (size >= 22) return '2.2';
    return '2.0';
  }, []);

  // Update CSS variable directly on DOM for 0ms lag without full component re-renders
  const updateArabicFontSizeCss = useCallback((size: number) => {
    if (readerContainerRef.current) {
      readerContainerRef.current.style.setProperty('--quran-arabic-size', `${size}px`);
      readerContainerRef.current.style.setProperty('--quran-arabic-lh', getArabicLineHeight(size));
    }
  }, [getArabicLineHeight]);

  const handleFontSizeChange = useCallback((newSize: number) => {
    const clamped = Math.max(16, Math.min(52, newSize));
    setArabicFontSize(clamped);
    updateArabicFontSizeCss(clamped);
    try {
      localStorage.setItem('noor_quran_arabic_font_size', String(clamped));
    } catch {
      // ignore
    }
  }, [updateArabicFontSizeCss]);

  // Fast direct DOM update on slider scrub for 0ms lag without waiting for full component rerender
  const handleSliderInput = useCallback((e: React.FormEvent<HTMLInputElement>) => {
    const val = Number((e.target as HTMLInputElement).value);
    updateArabicFontSizeCss(val);
    setArabicFontSize(val);
  }, [updateArabicFontSizeCss]);

  const handleSliderChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const val = Number(e.target.value);
    handleFontSizeChange(val);
  }, [handleFontSizeChange]);

  useEffect(() => {
    updateArabicFontSizeCss(arabicFontSize);
  }, [arabicFontSize, isReadingMode, updateArabicFontSizeCss]);

  // Respond to external initialSurahNumber prop changes
  useEffect(() => {
    if (initialSurahNumber && initialSurahNumber !== currentSurah.number) {
      const found = ALL_SURAHS.find(s => s.number === initialSurahNumber);
      if (found) {
        setCurrentSurah(found);
        setIsReadingMode(true);
        setCurrentAyahIndex(0);
      }
    }
  }, [initialSurahNumber]);

  // Load Complete Surah (All Ayahs, in user's selected language)
  useEffect(() => {
    if (!currentSurah || !isReadingMode) return;

    let isMounted = true;
    const surahNum = currentSurah.number;
    setIsLoadingAyahs(true);
    setAyahLoadError(null);

    loadCompleteSurah(surahNum, lang)
      .then((ayahs) => {
        if (!isMounted) return;
        setLoadedAyahs(ayahs);
        setIsLoadingAyahs(false);
        // Preload adjacent surahs in background with the selected language
        preloadAdjacentSurahs(surahNum, lang);
      })
      .catch((err) => {
        if (!isMounted) return;
        console.error(`[QuranScreen] Error loading complete Surah ${surahNum} (${lang}):`, err);
        setAyahLoadError('Failed to load complete verified Qur\'an text. Retrying...');
        setIsLoadingAyahs(false);
      });

    return () => {
      isMounted = false;
    };
  }, [currentSurah, isReadingMode, lang]);

  // Get active ayah list (guarantees non-empty)
  const activeAyahs = useMemo(() => {
    if (loadedAyahs.length > 0) return loadedAyahs;
    if (currentSurah && currentSurah.sampleAyahs && currentSurah.sampleAyahs.length > 0) {
      return currentSurah.sampleAyahs;
    }
    return [
      {
        number: 1,
        numberInSurah: 1,
        text: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
        translation: 'In the name of Allah, the Entirely Merciful, the Especially Merciful.',
      },
    ];
  }, [loadedAyahs, currentSurah]);

  // Filtered ayahs when searching within Surah
  const displayedAyahs = useMemo(() => {
    if (!surahSearchQuery.trim()) return activeAyahs;
    const q = surahSearchQuery.toLowerCase().trim();
    return activeAyahs.filter(
      (a) =>
        a.text.includes(q) ||
        a.translation.toLowerCase().includes(q) ||
        String(a.numberInSurah) === q
    );
  }, [activeAyahs, surahSearchQuery]);

  // Current playing ayah
  const currentAyah = activeAyahs[currentAyahIndex] || activeAyahs[0] || {
    number: 1,
    numberInSurah: 1,
    text: 'بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ',
    translation: 'In the name of Allah, the Entirely Merciful, the Especially Merciful.',
  };

  const audioSrc = useMemo(() => {
    if (!currentSurah || !currentAyah) return '';
    return getAyahAudioUrl(currentSurah.number, currentAyah.numberInSurah, selectedReciter.id);
  }, [currentSurah, currentAyah, selectedReciter.id]);

  // Preload next audio track for gapless recitation
  useEffect(() => {
    if (isPlaying && currentSurah && currentAyahIndex < activeAyahs.length - 1) {
      const nextAyah = activeAyahs[currentAyahIndex + 1];
      if (nextAyah) {
        const nextUrl = getAyahAudioUrl(currentSurah.number, nextAyah.numberInSurah, selectedReciter.id);
        if (!nextAudioPreloadRef.current) {
          nextAudioPreloadRef.current = new Audio();
        }
        nextAudioPreloadRef.current.src = nextUrl;
      }
    }
  }, [isPlaying, currentSurah, currentAyahIndex, activeAyahs, selectedReciter.id]);

  // Audio Play / Pause controller
  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
      if (isPlaying) {
        audioRef.current.play().catch(() => setIsPlaying(false));
      } else {
        audioRef.current.pause();
      }
    }
  }, [isPlaying, audioSrc, playbackSpeed]);

  // Auto-scroll to active playing Ayah
  useEffect(() => {
    if (isPlaying && currentAyah) {
      const elem = document.getElementById(`ayah-${currentAyah.numberInSurah}`);
      if (elem) {
        elem.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }
    }
  }, [currentAyahIndex, isPlaying, currentAyah]);

  const handleTogglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const handleNextAyah = useCallback(() => {
    if (currentAyahIndex < activeAyahs.length - 1) {
      setCurrentAyahIndex((prev) => prev + 1);
    } else {
      setIsPlaying(false);
    }
  }, [currentAyahIndex, activeAyahs.length]);

  const handlePrevAyah = useCallback(() => {
    if (currentAyahIndex > 0) {
      setCurrentAyahIndex((prev) => prev - 1);
    }
  }, [currentAyahIndex]);

  const handleAyahAudioEnded = useCallback(() => {
    if (currentAyahIndex < activeAyahs.length - 1) {
      setCurrentAyahIndex((prev) => prev + 1);
    } else {
      setIsPlaying(false);
    }
  }, [currentAyahIndex, activeAyahs.length]);

  const handleSelectSurah = useCallback((surah: Surah, startAyah = 1) => {
    setCurrentSurah(surah);
    setCurrentAyahIndex(Math.max(0, startAyah - 1));
    setIsReadingMode(true);
    setIsPlaying(false);
    setSurahSearchQuery('');
    setJumpToAyahInput('');
    setShowSurahSelectDropdown(false);

    // Smooth scroll to top of reader
    setTimeout(() => {
      if (readerTopRef.current) {
        readerTopRef.current.scrollIntoView({ behavior: 'smooth' });
      }
    }, 50);

    const streakUpdates = recordUserActivity(userStats, 'quran');
    onUpdateStats({
      lastReadSurah: surah.number,
      lastReadAyah: startAyah,
      quranPagesRead: Math.min(604, userStats.quranPagesRead + 1),
      ...streakUpdates,
    });
  }, [userStats, onUpdateStats]);

  const handleNavigateSurah = useCallback((direction: 'next' | 'prev') => {
    if (!currentSurah) return;
    const targetNumber = direction === 'next' ? currentSurah.number + 1 : currentSurah.number - 1;
    if (targetNumber >= 1 && targetNumber <= 114) {
      const targetSurah = ALL_SURAHS.find(s => s.number === targetNumber);
      if (targetSurah) {
        handleSelectSurah(targetSurah);
      }
    }
  }, [currentSurah, handleSelectSurah]);

  const handleJumpToAyah = useCallback((targetNumber: number) => {
    if (!currentSurah || targetNumber < 1 || targetNumber > currentSurah.numberOfAyahs) return;
    const targetIdx = targetNumber - 1;
    setCurrentAyahIndex(targetIdx);
    setHighlightedAyahNumber(targetNumber);

    setTimeout(() => {
      const elem = document.getElementById(`ayah-${targetNumber}`);
      if (elem) {
        elem.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 100);

    setTimeout(() => {
      setHighlightedAyahNumber(null);
    }, 3000);
  }, [currentSurah]);

  const handleToggleBookmark = useCallback((ayahNumberInSurah: number) => {
    if (!currentSurah) return;
    const exists = userStats.bookmarks.some(
      (b) => b.surahNumber === currentSurah.number && b.ayahNumber === ayahNumberInSurah
    );
    if (exists) {
      onUpdateStats({
        bookmarks: userStats.bookmarks.filter(
          (b) => !(b.surahNumber === currentSurah.number && b.ayahNumber === ayahNumberInSurah)
        ),
      });
    } else {
      onUpdateStats({
        bookmarks: [
          ...userStats.bookmarks,
          {
            surahNumber: currentSurah.number,
            ayahNumber: ayahNumberInSurah,
            timestamp: new Date().toISOString(),
          },
        ],
      });
    }
  }, [currentSurah, userStats.bookmarks, onUpdateStats]);

  const isAyahBookmarked = useCallback((ayahNum: number) => {
    if (!currentSurah) return false;
    return userStats.bookmarks.some(
      (b) => b.surahNumber === currentSurah.number && b.ayahNumber === ayahNum
    );
  }, [currentSurah, userStats.bookmarks]);

  const handleCopyAyahText = useCallback((ayah: Ayah) => {
    if (!currentSurah) return;
    const text = `${ayah.text}\n\n${ayah.translation}\n\n— Holy Qur'an, Surah ${currentSurah.englishName} (${currentSurah.number}:${ayah.numberInSurah})`;
    navigator.clipboard.writeText(text);
    setCopiedAyah(ayah.numberInSurah);
    setTimeout(() => setCopiedAyah(null), 2000);
  }, [currentSurah]);

  // Filter Surahs in main list
  const filteredSurahs = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    return ALL_SURAHS.filter((surah) => {
      const matchesSearch =
        !query ||
        surah.englishName.toLowerCase().includes(query) ||
        surah.englishNameTranslation.toLowerCase().includes(query) ||
        surah.name.includes(query) ||
        String(surah.number) === query;

      if (activeTab === 'bookmarks') {
        const isBookmarked = userStats.bookmarks.some((b) => b.surahNumber === surah.number);
        return matchesSearch && isBookmarked;
      }

      if (selectedJuz !== null) {
        return matchesSearch && surah.juzNumber === selectedJuz;
      }

      return matchesSearch;
    });
  }, [searchQuery, activeTab, selectedJuz, userStats.bookmarks]);

  // Bookmarks detailed list
  const detailedBookmarks = useMemo(() => {
    return userStats.bookmarks.map((bm) => {
      const surah = ALL_SURAHS.find((s) => s.number === bm.surahNumber);
      return {
        ...bm,
        surahName: surah?.englishName || `Surah ${bm.surahNumber}`,
        surahArabicName: surah?.name || '',
        totalAyahs: surah?.numberOfAyahs || 0,
      };
    });
  }, [userStats.bookmarks]);

  // Live verse keyword search debounce effect
  useEffect(() => {
    if (activeTab !== 'verses' && searchScope !== 'verses') return;
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setVerseSearchResults([]);
      setVerseSearchCount(0);
      setIsSearchingVerses(false);
      return;
    }

    let isMounted = true;
    setIsSearchingVerses(true);
    setVerseSearchError(null);

    const timer = setTimeout(async () => {
      try {
        const result = await searchQuranVerses(trimmed);
        if (!isMounted) return;
        setVerseSearchResults(result.matches);
        setVerseSearchCount(result.count);
        setIsSearchingVerses(false);
      } catch (err: any) {
        if (!isMounted) return;
        console.error('Error searching verses:', err);
        setVerseSearchError('Failed to search verses. Please check connection and try again.');
        setIsSearchingVerses(false);
      }
    }, 300);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [searchQuery, activeTab, searchScope]);

  // Select a popular keyword exploration chip
  const handleSelectKeywordChip = useCallback((keyword: string) => {
    setSearchQuery(keyword);
    setSearchScope('verses');
    setActiveTab('verses');
  }, []);

  // Jump directly to verse from search results into Reader mode with scrolling and highlight
  const handleOpenSearchResult = useCallback(
    (match: QuranSearchMatch) => {
      const targetSurah = ALL_SURAHS.find((s) => s.number === match.surah.number) || {
        number: match.surah.number,
        name: match.surah.name,
        englishName: match.surah.englishName,
        englishNameTranslation: match.surah.englishNameTranslation,
        numberOfAyahs: match.surah.numberOfAyahs || 7,
        revelationType: (match.surah.revelationType as any) || 'Meccan',
        revelationOrder: 1,
        pageNumber: match.page || 1,
        juzNumber: match.juz || 1,
        sampleAyahs: [],
      };

      handleSelectSurah(targetSurah, match.numberInSurah);
    },
    [handleSelectSurah]
  );

  // Copy verse text with reference
  const handleCopySearchResult = useCallback((match: QuranSearchMatch, idx: number) => {
    const text = `${match.text}\n\n— Holy Qur'an, Surah ${match.surah.englishName} (${match.surah.number}:${match.numberInSurah})`;
    navigator.clipboard.writeText(text);
    setCopiedSearchResultIndex(idx);
    setTimeout(() => setCopiedSearchResultIndex(null), 2000);
  }, []);

  // Keyword highlighting helper
  const renderHighlightedText = useCallback((text: string, query: string) => {
    if (!query.trim() || !text) return text;
    const cleanTerms = query.trim().split(/\s+/).filter(t => t.length > 1);
    if (cleanTerms.length === 0) return text;

    const regex = new RegExp(`(${cleanTerms.map(t => t.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|')})`, 'gi');
    const parts = text.split(regex);

    return parts.map((part, i) =>
      regex.test(part) ? (
        <span
          key={i}
          className="bg-[#C9A063]/30 text-[#DFBA7F] px-1 py-0.5 rounded font-bold border-b border-[#C9A063]/50 shadow-2xs"
        >
          {part}
        </span>
      ) : (
        part
      )
    );
  }, []);

  return (
    <div className="w-full max-w-5xl xl:max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-3 sm:py-6 pb-36 lg:pb-20 space-y-6">
      {/* Audio element */}
      <audio
        ref={audioRef}
        src={audioSrc}
        onEnded={handleAyahAudioEnded}
        onError={() => setIsPlaying(false)}
      />

      {/* ========================================================================= */}
      {/* FULL COMPLETE QUR'AN READER VIEW (ALL AYAHS, NO 6-PAGE LIMIT)            */}
      {/* ========================================================================= */}
      {isReadingMode && currentSurah ? (
        <div
          ref={(node) => {
            readerTopRef.current = node;
            readerContainerRef.current = node;
          }}
          style={{
            '--quran-arabic-size': `${arabicFontSize}px`,
            '--quran-arabic-lh': getArabicLineHeight(arabicFontSize),
          } as React.CSSProperties}
          className="max-w-4xl mx-auto space-y-5"
        >
          {/* Reader Top Navigation & Quick Switcher Header */}
          <div
            className={`sticky top-2 sm:top-4 z-30 p-3 sm:p-4 rounded-2xl sm:rounded-3xl border flex items-center justify-between transition-colors duration-200 shadow-md ${
              isDark
                ? 'bg-[#0E1217] border-[#C9A063]/30'
                : 'bg-white border-[#C9A063]/30'
            }`}
          >
            {/* Back to Surahs & Previous Surah */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                id="btn-back-to-surahs"
                onClick={() => {
                  setIsReadingMode(false);
                  setIsPlaying(false);
                }}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-xl border border-[#C9A063]/30 text-xs font-cinzel font-semibold text-[#DFBA7F] hover:bg-[#C9A063]/15 active:scale-95 transition-all"
              >
                <ChevronLeft className="w-4 h-4" />
                <span className="hidden sm:inline">{qt.backToSurahs}</span>
              </button>

              <button
                id="btn-prev-surah"
                onClick={() => handleNavigateSurah('prev')}
                disabled={currentSurah.number <= 1}
                className="p-1.5 rounded-xl border border-[#C9A063]/25 text-stone-300 hover:text-white disabled:opacity-30 disabled:pointer-events-none hover:bg-[#C9A063]/10 active:scale-95 transition-all"
                title={qt.prevSurah}
              >
                <ChevronLeft className="w-4 h-4 text-[#DFBA7F]" />
              </button>
            </div>

            {/* Current Surah Title & Quick Dropdown Picker */}
            <div className="relative text-center">
              <button
                id="btn-surah-picker-dropdown"
                onClick={() => setShowSurahSelectDropdown((prev) => !prev)}
                className="flex items-center justify-center gap-1.5 group focus:outline-none"
              >
                <div className="text-center">
                  <div className="flex items-center justify-center gap-1.5">
                    <span className="text-xs sm:text-sm font-serif-heading font-bold text-[#DFBA7F] group-hover:underline">
                      {currentSurah.number}. {currentSurah.englishName}
                    </span>
                    <span className="font-arabic text-sm text-[#DFBA7F]">
                      ({currentSurah.name})
                    </span>
                    <span className="text-[10px] text-stone-400 group-hover:text-[#DFBA7F]">▼</span>
                  </div>
                  <div className="text-[10px] text-stone-400 font-medium">
                    {currentSurah.revelationType === 'Meccan' ? qt.mecca : qt.medina} • {currentSurah.numberOfAyahs} {qt.ayahsCount} ({qt.completeSurah}) • {qt.juzLabel} {currentSurah.juzNumber}
                  </div>
                </div>
              </button>

              {/* Quick Surah Dropdown Modal */}
              {showSurahSelectDropdown && (
                <div
                  className={`absolute left-1/2 -translate-x-1/2 top-full mt-2 w-72 sm:w-80 max-h-80 overflow-y-auto rounded-2xl border p-2 z-50 shadow-md ${
                    isDark
                      ? 'bg-[#0E1217] border-[#C9A063]/40 text-stone-200'
                      : 'bg-white border-stone-300 text-stone-900'
                  }`}
                >
                  <div className="text-[11px] font-cinzel font-bold text-[#DFBA7F] px-2 py-1 border-b border-[#C9A063]/20 mb-1">
                    {qt.backToSurahs}
                  </div>
                  <div className="space-y-1">
                    {ALL_SURAHS.map((s) => (
                      <button
                        key={s.number}
                        onClick={() => handleSelectSurah(s)}
                        className={`w-full p-2 rounded-xl text-left flex items-center justify-between text-xs transition-all ${
                          s.number === currentSurah.number
                            ? 'bg-[#C9A063]/25 text-[#DFBA7F] font-bold border border-[#C9A063]/40'
                            : isDark
                            ? 'hover:bg-stone-800/80 text-stone-300'
                            : 'hover:bg-stone-100 text-stone-800'
                        }`}
                      >
                        <span className="font-medium">
                          {s.number}. {s.englishName}
                        </span>
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] text-stone-400">{s.numberOfAyahs} {qt.ayahsCount}</span>
                          <span className="font-arabic font-bold text-[#DFBA7F]">{s.name}</span>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Next Surah & Display Controls */}
            <div className="flex items-center gap-1.5 sm:gap-2">
              <button
                id="btn-next-surah"
                onClick={() => handleNavigateSurah('next')}
                disabled={currentSurah.number >= 114}
                className="p-1.5 rounded-xl border border-[#C9A063]/25 text-stone-300 hover:text-white disabled:opacity-30 disabled:pointer-events-none hover:bg-[#C9A063]/10 active:scale-95 transition-all"
                title={qt.nextSurah}
              >
                <ChevronRight className="w-4 h-4 text-[#DFBA7F]" />
              </button>

              {/* Translation Toggle */}
              <button
                onClick={() => setShowTranslation(!showTranslation)}
                className={`px-2 py-1.5 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${
                  showTranslation
                    ? 'bg-[#C9A063]/20 text-[#DFBA7F] border-[#C9A063]/40'
                    : isDark
                    ? 'bg-[#12161D] text-stone-400 border-white/10'
                    : 'bg-stone-100 text-stone-600 border-stone-200'
                }`}
                title={qt.translationToggle}
              >
                {qt.translationToggle.slice(0, 6)}
              </button>

              {/* Dedicated Tasmee3 Button */}
              <button
                id="btn-reader-tasmee3-header"
                onClick={() => {
                  if (tasmee3Active) {
                    setShowTasmee3Modal(true);
                  } else {
                    handleOpenTasmee3(currentAyahIndex + 1);
                  }
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${
                  tasmee3Active
                    ? 'bg-emerald-500/25 text-emerald-300 border-emerald-500/50 shadow-sm font-bold'
                    : 'bg-[#C9A063]/20 hover:bg-[#C9A063]/30 text-[#DFBA7F] border-[#C9A063]/40'
                }`}
                title={qt.tasmee3Btn}
              >
                <Mic className={`w-3.5 h-3.5 ${tasmee3Active ? 'text-emerald-400 animate-pulse' : 'text-[#DFBA7F]'}`} />
                <span className="font-serif-heading font-bold">Tasmee3</span>
              </button>

              {/* Dedicated Quran Teacher AI Flagship Button */}
              <button
                id="btn-reader-teacher-ai-header"
                onClick={() => handleOpenQuranTeacher(currentSurah.number, currentAyahIndex + 1)}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold border bg-gradient-to-r from-[#C9A063]/25 to-[#DFBA7F]/15 hover:from-[#C9A063]/35 hover:to-[#DFBA7F]/25 text-[#DFBA7F] border-[#C9A063]/40 shadow-xs active:scale-95 transition-all"
                title={qt.quranTeacherBtn}
              >
                <GraduationCap className="w-3.5 h-3.5 text-[#DFBA7F]" />
                <span className="font-serif-heading font-bold hidden sm:inline">Teacher AI</span>
              </button>

              {/* Dynamic Font Size Slider Toggle */}
              <button
                id="btn-font-size-slider-toggle"
                onClick={() => setShowFontSettings((prev) => !prev)}
                className={`flex items-center gap-1 px-2 py-1.5 rounded-xl text-xs font-semibold border transition-all active:scale-95 ${
                  showFontSettings
                    ? 'bg-[#C9A063]/30 text-[#DFBA7F] border-[#C9A063]/60 shadow-sm'
                    : isDark
                    ? 'bg-[#12161D] text-stone-300 border-[#C9A063]/25 hover:border-[#C9A063]/50'
                    : 'bg-stone-100 text-stone-700 border-stone-200'
                }`}
                title={qt.arabicFontSize}
              >
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#DFBA7F]" />
                <span className="font-mono text-[11px] hidden sm:inline">{arabicFontSize}px</span>
              </button>
            </div>
          </div>

          {/* Interactive Dynamic Font Size Slider Panel */}
          {showFontSettings && (
            <div
              id="quran-font-settings-panel"
              className={`p-4 sm:p-5 rounded-2xl sm:rounded-3xl border space-y-3 transition-all duration-200 shadow-md ${
                isDark
                  ? 'bg-[#0E1217] border-[#C9A063]/35'
                  : 'bg-white border-[#C9A063]/35'
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <SlidersHorizontal className="w-4 h-4 text-[#DFBA7F]" />
                  <span className="text-xs sm:text-sm font-serif-heading font-bold text-[#DFBA7F]">
                    Arabic Font Size Slider
                  </span>
                  <span className="text-[10px] text-stone-400 font-sans hidden sm:inline">
                    (Instant Zero-Lag Scaling)
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  <span className="text-xs font-mono font-bold px-2.5 py-0.5 rounded-lg bg-[#C9A063]/15 text-[#DFBA7F] border border-[#C9A063]/30">
                    {arabicFontSize} px
                  </span>
                  <button
                    onClick={() => handleFontSizeChange(28)}
                    className="px-2 py-1 rounded-lg text-stone-400 hover:text-stone-200 hover:bg-[#C9A063]/15 text-[11px] flex items-center gap-1 border border-transparent hover:border-[#C9A063]/30 active:scale-95 transition-all"
                    title="Reset to default 28px"
                  >
                    <RotateCcw className="w-3 h-3 text-[#DFBA7F]" />
                    <span>Reset</span>
                  </button>
                </div>
              </div>

              {/* Continuous Dynamic Range Slider */}
              <div className="flex items-center gap-3 pt-1">
                <span className="text-xs font-bold text-stone-400 font-sans">18px</span>
                <div className="relative flex-1 flex items-center">
                  <input
                    id="quran-font-size-range-slider"
                    type="range"
                    min="18"
                    max="48"
                    step="1"
                    value={arabicFontSize}
                    onInput={handleSliderInput}
                    onChange={handleSliderChange}
                    className="w-full accent-[#C9A063] cursor-pointer h-2 bg-stone-700/60 rounded-lg"
                  />
                </div>
                <span className="text-sm font-bold text-stone-300 font-sans">48px</span>
              </div>

              {/* Quick Preset Buttons & Live Arabic Calligraphy Preview */}
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2.5 pt-2 border-t border-[#C9A063]/15">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-[11px] text-stone-400 mr-1">Presets:</span>
                  {[
                    { label: 'Compact', size: 20 },
                    { label: 'Medium', size: 24 },
                    { label: 'Default', size: 28 },
                    { label: 'Large', size: 34 },
                    { label: 'Huge', size: 42 },
                  ].map((preset) => (
                    <button
                      key={preset.size}
                      onClick={() => handleFontSizeChange(preset.size)}
                      className={`px-2.5 py-1 rounded-xl text-[11px] font-semibold border transition-all active:scale-95 ${
                        arabicFontSize === preset.size
                          ? 'bg-[#C9A063]/30 text-[#DFBA7F] border-[#C9A063]/60 font-bold'
                          : isDark
                          ? 'bg-[#12161D] text-stone-400 border-white/10 hover:text-stone-200'
                          : 'bg-stone-100 text-stone-600 border-stone-200'
                      }`}
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>

                <div
                  dir="rtl"
                  className="font-arabic text-[#DFBA7F] select-none text-right px-2 py-0.5 truncate max-w-full sm:max-w-[240px]"
                  style={{
                    fontSize: 'var(--quran-arabic-size, 28px)',
                    lineHeight: 'var(--quran-arabic-lh, 2.4)',
                  }}
                >
                  بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
                </div>
              </div>
            </div>
          )}

          {/* Quick Jump & Search within Surah Toolbar */}
          <div
            className={`p-3 rounded-2xl border flex flex-col sm:flex-row items-center justify-between gap-3 text-xs ${
              isDark ? 'bg-[#0E1217]/85 border-[#C9A063]/20' : 'bg-white/90 border-stone-200 shadow-2xs'
            }`}
          >
            {/* Search within Surah */}
            <div className="relative w-full sm:w-1/2">
              <Search className="w-3.5 h-3.5 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={surahSearchQuery}
                onChange={(e) => setSurahSearchQuery(e.target.value)}
                placeholder={qt.searchInSurahPlaceholder}
                className={`w-full pl-8 pr-3 py-1.5 rounded-xl text-xs border transition-all focus:outline-none focus:ring-1 focus:ring-[#C9A063] ${
                  isDark
                    ? 'bg-stone-900/90 border-[#C9A063]/20 text-stone-100 placeholder-stone-500'
                    : 'bg-stone-50 border-stone-200 text-stone-900 placeholder-stone-400'
                }`}
              />
            </div>

            {/* Jump to Ayah Picker */}
            <div className="flex items-center gap-2 w-full sm:w-auto justify-between sm:justify-end">
              <span className="text-stone-400 whitespace-nowrap text-[11px]">{qt.jumpToAyah}:</span>
              <div className="flex items-center gap-1.5">
                <input
                  type="number"
                  min="1"
                  max={currentSurah.numberOfAyahs}
                  value={jumpToAyahInput}
                  onChange={(e) => setJumpToAyahInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      const num = parseInt(jumpToAyahInput, 10);
                      if (!isNaN(num)) handleJumpToAyah(num);
                    }
                  }}
                  placeholder={`1-${currentSurah.numberOfAyahs}`}
                  className={`w-20 px-2 py-1.5 rounded-xl text-xs text-center border font-mono font-bold focus:outline-none focus:ring-1 focus:ring-[#C9A063] ${
                    isDark
                      ? 'bg-stone-900/90 border-[#C9A063]/25 text-[#DFBA7F]'
                      : 'bg-stone-50 border-stone-200 text-stone-900'
                  }`}
                />
                <button
                  onClick={() => {
                    const num = parseInt(jumpToAyahInput, 10);
                    if (!isNaN(num)) handleJumpToAyah(num);
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-[#C9A063]/20 hover:bg-[#C9A063]/30 text-[#DFBA7F] border border-[#C9A063]/40 font-bold active:scale-95 transition-all text-xs"
                >
                  {qt.jumpGo}
                </button>
              </div>
            </div>
          </div>

          {/* Surah Decorative Opening Banner */}
          <div
            className={`rounded-3xl p-6 sm:p-8 text-center border relative overflow-hidden transform-gpu shadow-md ${
              isDark
                ? 'bg-gradient-to-b from-[#141A22] via-[#0B0E13] to-[#181E26] border-[#C9A063]/35 shadow-md'
                : 'bg-gradient-to-b from-amber-50/90 to-white border-[#C9A063]/35 shadow-md'
            }`}
          >
            <div className="font-arabic text-4xl sm:text-5xl font-bold text-[#DFBA7F] mb-2 drop-shadow-sm">
              {currentSurah.name}
            </div>
            <h1 className={`text-lg sm:text-xl font-serif-heading font-bold ${isDark ? 'text-[#F5EFE6]' : 'text-stone-900'}`}>
              Surah {currentSurah.englishName} ({currentSurah.englishNameTranslation})
            </h1>
            <div className="text-xs text-stone-400 mt-1 font-medium">
              Surah #{currentSurah.number} • {currentSurah.revelationType} Revelation • {currentSurah.numberOfAyahs} Complete Verses
            </div>

            {/* Bismillah Header for all Surahs except At-Tawbah (Surah 9) */}
            {currentSurah.number !== 9 && (
              <div className="mt-5 pt-4 border-t border-[#C9A063]/25 font-arabic text-2xl sm:text-3xl text-[#DFBA7F] tracking-wide">
                بِسْمِ اللَّهِ الرَّحْمَٰنِ الرَّحِيمِ
              </div>
            )}
          </div>

          {/* Loading Indicator or Error State */}
          {isLoadingAyahs && loadedAyahs.length === 0 && (
            <div className="flex flex-col items-center justify-center py-12 space-y-3">
              <Loader2 className="w-8 h-8 animate-spin text-[#C9A063]" />
              <div className="text-xs font-semibold text-[#DFBA7F]">
                Loading all {currentSurah.numberOfAyahs} verses of Surah {currentSurah.englishName}...
              </div>
            </div>
          )}

          {ayahLoadError && (
            <div className="p-4 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-center text-xs text-amber-200">
              {ayahLoadError}
            </div>
          )}

          {/* ========================================================================= */}
          {/* COMPLETE AYAH LIST (ALL VERSES 1 TO N RENDERED IN FULL ORDER)            */}
          {/* ========================================================================= */}
          <div className="space-y-4">
            {displayedAyahs.map((ayah, index) => {
              const ayahNumInSurah = ayah.numberInSurah;
              const isCurrentPlayingAyah = currentAyahIndex === (ayahNumInSurah - 1) && isPlaying;
              const isTasmee3ActiveAyah = tasmee3Active && tasmee3Verse === ayahNumInSurah;
              const isHighlighted = highlightedAyahNumber === ayahNumInSurah;
              const bookmarked = isAyahBookmarked(ayahNumInSurah);

              return (
                <div
                  key={`${currentSurah.number}-${ayahNumInSurah}`}
                  id={`ayah-${ayahNumInSurah}`}
                  className={`rounded-3xl p-5 sm:p-6 border transition-all duration-200 transform-gpu ${
                    isTasmee3ActiveAyah
                      ? 'border-emerald-400 bg-emerald-500/15 ring-2 ring-emerald-400/80 shadow-[0_0_30px_rgba(16,185,129,0.35)]'
                      : isHighlighted
                      ? 'border-[#DFBA7F] bg-[#C9A063]/25 ring-2 ring-[#DFBA7F] shadow-[0_0_30px_rgba(201,160,99,0.5)]'
                      : isCurrentPlayingAyah
                      ? 'border-[#C9A063] bg-[#C9A063]/15 shadow-[0_0_24px_rgba(201,160,99,0.3)] ring-1 ring-[#C9A063]/50'
                      : isDark
                      ? 'bg-[#0E1217]/85 border-[#C9A063]/20 hover:border-[#C9A063]/45'
                      : 'bg-white/95 border-stone-200 hover:border-[#C9A063]/50 shadow-2xs'
                  }`}
                >
                  {/* Top Bar: Verse Number & Quick Actions */}
                  <div className="flex items-center justify-between mb-3.5">
                    <div className="flex items-center gap-2">
                      <span
                        className={`w-8 h-8 rounded-full border flex items-center justify-center text-xs font-bold font-mono shadow-2xs transition-all ${
                          isTasmee3ActiveAyah
                            ? 'bg-emerald-500/20 border-emerald-500/60 text-emerald-300'
                            : 'bg-[#C9A063]/15 border-[#C9A063]/40 text-[#DFBA7F]'
                        }`}
                      >
                        {ayahNumInSurah}
                      </span>
                      <span className="text-xs text-stone-400 font-medium font-cinzel">
                        {currentSurah.englishName} [{currentSurah.number}:{ayahNumInSurah}]
                      </span>

                      {/* Real-time Tasmee3 recitation tracking badge */}
                      {isTasmee3ActiveAyah && (
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-semibold flex items-center gap-1 font-sans shadow-2xs animate-in fade-in">
                          <Mic className="w-3 h-3 animate-pulse text-emerald-400" />
                          <span>Reciting Verse {ayahNumInSurah}</span>
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5">
                      {/* Play single ayah recitation */}
                      <button
                        onClick={() => {
                          if (tasmee3Active) handleStopTasmee3();
                          setCurrentAyahIndex(ayahNumInSurah - 1);
                          setIsPlaying(true);
                        }}
                        className={`p-1.5 sm:p-2 rounded-xl border transition-all active:scale-90 ${
                          isCurrentPlayingAyah
                            ? 'bg-[#C9A063] text-[#090B0E] border-[#C9A063] shadow-md font-bold'
                            : isDark
                            ? 'bg-[#12161D] text-stone-300 border-white/10 hover:text-white'
                            : 'bg-stone-100 text-stone-600 border-stone-200 hover:text-stone-900'
                        }`}
                        title="Play recitation from this verse"
                      >
                        {isCurrentPlayingAyah ? (
                          <Volume2 className="w-3.5 h-3.5" />
                        ) : (
                          <Play className="w-3.5 h-3.5 ml-0.5" />
                        )}
                      </button>

                      {/* Tasmee3 Recitation Listening from this Ayah */}
                      <button
                        id={`btn-ayah-tasmee3-${ayahNumInSurah}`}
                        onClick={() => handleStartTasmee3InReader(ayahNumInSurah)}
                        className={`p-1.5 sm:p-2 rounded-xl border transition-all active:scale-90 ${
                          isTasmee3ActiveAyah
                            ? 'bg-emerald-500/25 text-emerald-300 border-emerald-500/60 shadow-sm font-bold'
                            : isDark
                            ? 'bg-[#12161D] text-stone-400 border-white/10 hover:text-[#DFBA7F]'
                            : 'bg-stone-100 text-stone-500 border-stone-200 hover:text-[#DFBA7F]'
                        }`}
                        title="Recite with Tasmee3 from this verse"
                      >
                        <Mic className="w-3.5 h-3.5" />
                      </button>

                      {/* Quran Teacher AI from this Ayah */}
                      <button
                        id={`btn-ayah-teacher-${ayahNumInSurah}`}
                        onClick={() => handleOpenQuranTeacher(currentSurah.number, ayahNumInSurah)}
                        className={`p-1.5 sm:p-2 rounded-xl border transition-all active:scale-90 ${
                          isDark
                            ? 'bg-[#12161D] text-stone-400 border-white/10 hover:text-[#DFBA7F]'
                            : 'bg-stone-100 text-stone-500 border-stone-200 hover:text-[#DFBA7F]'
                        }`}
                        title="Practice with Quran Teacher AI"
                      >
                        <GraduationCap className="w-3.5 h-3.5" />
                      </button>

                      {/* Bookmark Ayah */}
                      <button
                        onClick={() => handleToggleBookmark(ayahNumInSurah)}
                        className={`p-1.5 sm:p-2 rounded-xl border transition-all active:scale-90 ${
                          bookmarked
                            ? 'bg-[#C9A063]/25 text-[#DFBA7F] border-[#C9A063]/40'
                            : isDark
                            ? 'bg-[#12161D] text-stone-400 border-white/10 hover:text-[#DFBA7F]'
                            : 'bg-stone-100 text-stone-500 border-stone-200'
                        }`}
                        title={bookmarked ? 'Remove Bookmark' : 'Bookmark this Ayah'}
                      >
                        <Bookmark className={`w-3.5 h-3.5 ${bookmarked ? 'fill-[#DFBA7F] text-[#DFBA7F]' : ''}`} />
                      </button>

                      {/* Copy Ayah */}
                      <button
                        onClick={() => handleCopyAyahText(ayah)}
                        className={`p-1.5 sm:p-2 rounded-xl border transition-all active:scale-90 ${
                          copiedAyah === ayahNumInSurah
                            ? 'bg-[#C9A063]/25 text-[#DFBA7F] border-[#C9A063]/40'
                            : isDark
                            ? 'bg-[#12161D] text-stone-400 border-white/10 hover:text-[#DFBA7F]'
                            : 'bg-stone-100 text-stone-500 border-stone-200'
                        }`}
                        title="Copy Arabic and translation"
                      >
                        {copiedAyah === ayahNumInSurah ? (
                          <Check className="w-3.5 h-3.5 text-[#DFBA7F]" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Complete Arabic Text in authentic Uthmani script */}
                  <div
                    dir="rtl"
                    className="font-arabic text-right text-[#DFBA7F] font-normal tracking-wide my-4 select-text"
                    style={{
                      fontSize: 'var(--quran-arabic-size, 28px)',
                      lineHeight: 'var(--quran-arabic-lh, 2.4)',
                    }}
                  >
                    {ayah.text}
                    <span className="font-sans text-xs px-2.5 py-0.5 rounded-full border border-[#C9A063]/30 text-[#DFBA7F] mr-2 inline-block shadow-2xs">
                      ۝{ayahNumInSurah}
                    </span>
                  </div>

                  {/* Authentic Translation in user's selected language */}
                  {showTranslation && (
                    <div
                      className={`text-xs sm:text-sm leading-relaxed mt-3 pt-3 border-t ${
                        isDark
                          ? 'border-[#C9A063]/15 text-stone-300'
                          : 'border-stone-200 text-stone-700'
                      }`}
                    >
                      <div className="flex items-center gap-1.5 mb-1 text-[10px] text-stone-400 font-medium select-none">
                        <span className="font-semibold text-[#DFBA7F]">{qt.activeTranslationSource}:</span>
                        <span>{edition.name}</span>
                        <span className="opacity-50">•</span>
                        <span className="opacity-80">{edition.author}</span>
                      </div>
                      <p className="font-sans leading-relaxed">{ayah.translation}</p>
                    </div>
                  )}
                </div>
              );
            })}

            {displayedAyahs.length === 0 && (
              <div className="text-center py-12 text-stone-400 text-xs">
                {qt.noVerseResults}
              </div>
            )}
          </div>

          {/* Surah Bottom Navigation: Next / Prev Surah Buttons */}
          <div className="flex items-center justify-between pt-6 border-t border-[#C9A063]/20">
            <button
              onClick={() => handleNavigateSurah('prev')}
              disabled={currentSurah.number <= 1}
              className="flex items-center gap-2 px-4 py-2 rounded-2xl border border-[#C9A063]/30 bg-[#C9A063]/10 text-xs font-semibold text-[#DFBA7F] disabled:opacity-30 disabled:pointer-events-none hover:bg-[#C9A063]/20 active:scale-95 transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
              <span>Previous Surah</span>
            </button>

            <div className="text-center text-[11px] text-stone-400 font-cinzel">
              End of Surah {currentSurah.englishName} ({currentSurah.numberOfAyahs} of {currentSurah.numberOfAyahs} Ayahs)
            </div>

            <button
              onClick={() => handleNavigateSurah('next')}
              disabled={currentSurah.number >= 114}
              className="flex items-center gap-2 px-4 py-2 rounded-2xl border border-[#C9A063]/30 bg-[#C9A063]/10 text-xs font-semibold text-[#DFBA7F] disabled:opacity-30 disabled:pointer-events-none hover:bg-[#C9A063]/20 active:scale-95 transition-all"
            >
              <span>Next Surah</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {/* ========================================================================= */}
          {/* FLOATING AUDIO RECITATION CONTROLLER                                     */}
          {/* ========================================================================= */}
          <div
            id="quran-audio-player-bar"
            className={`fixed bottom-20 left-4 right-4 z-40 max-w-xl mx-auto rounded-3xl p-3.5 border transition-all duration-200 shadow-lg ${
              isDark
                ? 'bg-[#0E1217] border-[#C9A063]/35'
                : 'bg-white border-[#C9A063]/35'
            }`}
          >
            <div className="flex items-center justify-between">
              {/* Reciter & Current Ayah Info */}
              <div
                onClick={() => setShowReciterMenu(!showReciterMenu)}
                className="flex items-center gap-2.5 cursor-pointer group select-none active:opacity-80"
              >
                <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#C9A063] to-[#DFBA7F] text-[#090B0E] flex items-center justify-center font-bold text-xs shadow-md">
                  {isPlaying ? <Volume2 className="w-5 h-5 animate-pulse" /> : <Play className="w-5 h-5" />}
                </div>
                <div>
                  <div className="text-[11px] font-bold text-[#DFBA7F] flex items-center gap-1 font-cinzel">
                    <span>{selectedReciter.name}</span>
                    <span className="text-[9px] text-stone-400 group-hover:underline">▼</span>
                  </div>
                  <div className={`text-xs font-semibold ${isDark ? 'text-[#F5EFE6]' : 'text-stone-900'}`}>
                    Ayah {currentAyah.numberInSurah} of {currentSurah.numberOfAyahs}
                  </div>
                </div>
              </div>

              {/* Playback Speed Switcher */}
              <button
                onClick={() => {
                  const speeds = [1, 1.25, 1.5, 0.75];
                  const nextIdx = (speeds.indexOf(playbackSpeed) + 1) % speeds.length;
                  setPlaybackSpeed(speeds[nextIdx]);
                }}
                className="hidden sm:inline-block px-2 py-1 rounded-lg text-[10px] font-mono font-bold border border-[#C9A063]/30 text-[#DFBA7F] hover:bg-[#C9A063]/15 active:scale-95 transition-all"
                title={qt.playbackSpeed}
              >
                {playbackSpeed}x
              </button>

              {/* Player Navigation Controls */}
              <div className="flex items-center gap-2">
                <button
                  onClick={handlePrevAyah}
                  disabled={currentAyahIndex === 0}
                  className="p-2 rounded-xl text-stone-400 hover:text-stone-100 disabled:opacity-30 active:scale-90 transition-transform"
                  title={qt.prevAyah}
                >
                  <SkipBack className="w-4 h-4" />
                </button>

                <button
                  onClick={handleTogglePlay}
                  className="w-11 h-11 rounded-2xl bg-gradient-to-tr from-[#C9A063] via-[#DFBA7F] to-[#B88E4F] text-[#090B0E] flex items-center justify-center shadow-lg transition-transform active:scale-90"
                  title={isPlaying ? qt.pause : qt.playAll}
                >
                  {isPlaying ? (
                    <Pause className="w-5 h-5 fill-[#090B0E]" />
                  ) : (
                    <Play className="w-5 h-5 fill-[#090B0E] ml-0.5" />
                  )}
                </button>

                <button
                  onClick={handleNextAyah}
                  disabled={currentAyahIndex >= activeAyahs.length - 1}
                  className="p-2 rounded-xl text-stone-400 hover:text-stone-100 disabled:opacity-30 active:scale-90 transition-transform"
                  title={qt.nextAyah}
                >
                  <SkipForward className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Reciter Selector Menu */}
            {showReciterMenu && (
              <div
                className={`mt-3 pt-3 border-t border-[#C9A063]/20 space-y-1.5 max-h-48 overflow-y-auto ${
                  isDark ? 'text-stone-200' : 'text-stone-800'
                }`}
              >
                <div className="text-[10px] uppercase font-cinzel font-semibold text-stone-400 px-1 mb-1">
                  {qt.selectReciter}
                </div>
                {RECITERS.map((r) => (
                  <button
                    key={r.id}
                    onClick={() => {
                      setSelectedReciter(r);
                      setShowReciterMenu(false);
                    }}
                    className={`w-full p-2 rounded-xl text-left flex items-center justify-between text-xs transition-colors ${
                      selectedReciter.id === r.id
                        ? 'bg-[#C9A063]/20 text-[#DFBA7F] font-semibold border border-[#C9A063]/30'
                        : isDark
                        ? 'hover:bg-[#12161D]'
                        : 'hover:bg-stone-100'
                    }`}
                  >
                    <div>
                      <div className="font-medium">{r.name}</div>
                      <div className="text-[10px] text-stone-400 font-arabic">{r.arabicName}</div>
                    </div>
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#C9A063]/10 text-[#DFBA7F] border border-[#C9A063]/20">
                      {r.style}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : (
        /* ========================================================================= */
        /* SURAH LIST & BROWSING VIEW (ALL 114 SURAHS & KEYWORD SEARCH)              */
        /* ========================================================================= */
        <div className="space-y-5">
          {/* ========================================================================= */}
          {/* SEARCH BAR AT THE TOP OF QURAN SCREEN                                    */}
          {/* ========================================================================= */}
          <div
            id="quran-search-container"
            className={`rounded-3xl p-4 sm:p-5 border transition-all transform-gpu shadow-xl ${
              isDark
                ? 'liquid-glass border-[#C9A063]/35 shadow-[0_12px_36px_rgba(0,0,0,0.6)]'
                : 'liquid-glass-light border-[#C9A063]/30 shadow-md'
            }`}
          >
            <div className="flex items-center justify-between gap-3 mb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-[#C9A063]/15 border border-[#C9A063]/30 flex items-center justify-center text-[#DFBA7F]">
                  <Search className="w-4 h-4 text-[#C9A063]" />
                </div>
                <div>
                  <h2 className={`text-sm font-serif-heading font-bold ${isDark ? 'text-[#F5EFE6]' : 'text-stone-900'}`}>
                    {qt.quranHeader}
                  </h2>
                  <p className="text-[11px] text-stone-400">
                    {qt.quranSubheader}
                  </p>
                </div>
              </div>

              {/* Scope Switcher: Surahs vs Verses */}
              <div className="flex items-center p-1 rounded-xl bg-stone-800/40 border border-[#C9A063]/20">
                <button
                  type="button"
                  onClick={() => {
                    setSearchScope('surahs');
                    setActiveTab('surahs');
                  }}
                  className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-semibold transition-all active:scale-95 flex items-center gap-1.5 ${
                    searchScope === 'surahs' && activeTab === 'surahs'
                      ? 'bg-gradient-to-r from-[#C9A063] to-[#DFBA7F] text-[#090B0E] font-bold shadow-xs'
                      : isDark
                      ? 'text-stone-300 hover:text-[#DFBA7F]'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5" />
                  <span>{qt.tabSurahs}</span>
                  {searchQuery.trim() && searchScope === 'surahs' && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/20 font-mono font-bold">
                      {filteredSurahs.length}
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setSearchScope('verses');
                    setActiveTab('verses');
                  }}
                  className={`px-2.5 sm:px-3 py-1 rounded-lg text-xs font-semibold transition-all active:scale-95 flex items-center gap-1.5 ${
                    searchScope === 'verses' || activeTab === 'verses'
                      ? 'bg-gradient-to-r from-[#C9A063] to-[#DFBA7F] text-[#090B0E] font-bold shadow-xs'
                      : isDark
                      ? 'text-stone-300 hover:text-[#DFBA7F]'
                      : 'text-stone-600 hover:text-stone-900'
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>{qt.tabVerses}</span>
                  {verseSearchCount > 0 && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/20 font-mono font-bold">
                      {verseSearchCount}
                    </span>
                  )}
                </button>
              </div>
            </div>

            {/* Main Search Input */}
            <div className="relative">
              <Search className="w-4 h-4 text-[#C9A063] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  if (searchScope === 'verses' && activeTab !== 'verses') {
                    setActiveTab('verses');
                  }
                }}
                placeholder={searchScope === 'verses' ? qt.searchVersePlaceholder : qt.searchSurahPlaceholder}
                className={`w-full pl-10 pr-20 py-3 rounded-2xl text-xs font-medium border transition-all focus:outline-none focus:ring-2 focus:ring-[#C9A063]/50 ${
                  isDark
                    ? 'bg-[#0E1217]/90 border-[#C9A063]/30 text-stone-100 placeholder-stone-500 shadow-inner'
                    : 'bg-white border-stone-200 text-stone-900 placeholder-stone-400 shadow-xs'
                }`}
              />

              <div className="absolute right-3 top-1/2 -translate-y-1/2 flex items-center gap-1.5">
                {isSearchingVerses && (
                  <Loader2 className="w-4 h-4 text-[#C9A063] animate-spin" />
                )}

                {searchQuery.trim() && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchQuery('');
                      setVerseSearchResults([]);
                      setVerseSearchCount(0);
                    }}
                    aria-label="Clear search"
                    className="p-1 rounded-full text-stone-400 hover:text-stone-200 hover:bg-stone-700/50 active:scale-90 transition-all"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            </div>

            {/* Popular Keyword Inspiration Chips */}
            <div className="mt-3 pt-3 border-t border-[#C9A063]/15">
              <div className="flex items-center gap-1.5 mb-2 text-[11px] font-semibold text-[#DFBA7F]">
                <Flame className="w-3.5 h-3.5 text-[#C9A063]" />
                <span>Popular Themes & Verse Keywords:</span>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto pb-1 no-scrollbar">
                {POPULAR_QURAN_KEYWORDS.map((kw) => (
                  <button
                    key={kw.query}
                    type="button"
                    onClick={() => handleSelectKeywordChip(kw.query)}
                    className={`px-2.5 py-1 rounded-xl text-[11px] font-medium border transition-all active:scale-95 whitespace-nowrap flex items-center gap-1 ${
                      searchQuery.toLowerCase() === kw.query.toLowerCase()
                        ? 'bg-[#C9A063]/25 border-[#C9A063] text-[#DFBA7F] font-bold shadow-2xs'
                        : isDark
                        ? 'bg-[#0E1217]/70 border-[#C9A063]/20 text-stone-300 hover:border-[#C9A063]/50 hover:text-[#DFBA7F]'
                        : 'bg-white border-stone-200 text-stone-700 hover:border-[#C9A063]/50'
                    }`}
                  >
                    <span>{kw.label}</span>
                    <span className="text-[9px] text-[#C9A063] font-arabic opacity-80">{kw.arabic}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* FLAGSHIP: QURAN TEACHER AI REAL-TIME INTERACTIVE VOICE LEARNING           */}
          {/* ========================================================================= */}
          <div
            id="quran-teacher-ai-flagship-banner"
            className={`rounded-3xl p-5 sm:p-6 border transition-all transform-gpu shadow-md relative overflow-hidden ${
              isDark
                ? 'liquid-glass border-[#C9A063]/40 shadow-md bg-gradient-to-r from-[#0C1017] via-[#10151E] to-[#0A0D12]'
                : 'liquid-glass-light border-[#C9A063]/40 shadow-sm bg-gradient-to-r from-amber-50/70 via-white to-amber-50/40'
            }`}
          >
            {/* Subtle background golden glow accent */}
            <div className="absolute -right-12 -top-12 w-48 h-48 bg-[#C9A063]/10 rounded-full blur-3xl pointer-events-none" />

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5 relative z-10">
              <div className="flex items-start gap-4">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#C9A063] via-[#DFBA7F] to-[#8E6527] flex items-center justify-center text-[#080A0E] shadow-xs shrink-0">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <div>
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-bold text-[#DFBA7F] font-cinzel tracking-wider">
                      Flagship Feature
                    </span>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-[#C9A063]/20 text-[#DFBA7F] border border-[#C9A063]/40 font-bold tracking-wide uppercase">
                      Interactive Voice Lesson
                    </span>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-medium">
                      Hands-Free Auto-Advance
                    </span>
                  </div>
                  <h3 className={`text-lg font-serif-heading font-bold mt-1 ${isDark ? 'text-[#F5EFE6]' : 'text-stone-900'}`}>
                    Quran Teacher AI
                  </h3>
                  <p className="text-xs text-stone-400 mt-1 max-w-xl leading-relaxed">
                    A real-time Quran teacher session. The AI speaks, listens as you recite, evaluates each ayah accurately, and advances automatically without touching the screen.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto shrink-0">
                <button
                  id="btn-launch-quran-teacher-banner"
                  onClick={() => handleOpenQuranTeacher(1, 1, 7)}
                  className="w-full sm:w-auto px-6 py-3 rounded-2xl bg-gradient-to-r from-[#C9A063] to-[#DFBA7F] text-[#080A0E] font-bold text-xs shadow-sm hover:brightness-105 active:scale-95 transition-all flex items-center justify-center gap-2"
                >
                  <GraduationCap className="w-4 h-4" />
                  <span>Start Teacher Lesson</span>
                </button>
              </div>
            </div>
          </div>

          {/* ========================================================================= */}
          {/* TASMEE3: QURAN RECITATION LISTENING FEATURE BANNER                       */}
          {/* ========================================================================= */}
          <div
            id="quran-tasmee3-feature-banner"
            className={`rounded-3xl p-5 sm:p-6 border transition-all transform-gpu shadow-md ${
              isDark
                ? 'liquid-glass border-[#C9A063]/35 shadow-md'
                : 'liquid-glass-light border-[#C9A063]/30 shadow-sm'
            }`}
          >
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#C9A063]/30 to-[#DFBA7F]/10 border border-[#C9A063]/40 flex items-center justify-center text-[#DFBA7F] shadow-sm shrink-0">
                  <Mic className="w-5 h-5 text-[#DFBA7F]" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-[#DFBA7F] font-cinzel">Tasmee3</span>
                    <span className="text-[9px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 font-bold tracking-wide uppercase">
                      Recitation Listening
                    </span>
                  </div>
                  <h3 className={`text-base font-serif-heading font-bold mt-0.5 ${isDark ? 'text-[#F5EFE6]' : 'text-stone-900'}`}>
                    Recite & Noor Follows
                  </h3>
                  <p className="text-xs text-stone-400 mt-1 max-w-xl leading-relaxed">
                    Recite the Holy Qur'an aloud. Noor listens through your microphone and automatically tracks your verse progression in real time as you recite.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  id="btn-launch-tasmee3-catalog"
                  onClick={() => handleOpenTasmee3(1)}
                  className="w-full sm:w-auto px-5 py-2.5 rounded-2xl bg-gradient-to-r from-[#C9A063] to-[#DFBA7F] text-[#090B0E] font-bold text-xs shadow-sm hover:brightness-105 active:scale-95 transition-all flex items-center justify-center gap-2 shrink-0"
                >
                  <Mic className="w-3.5 h-3.5" />
                  <span>Start Tasmee3</span>
                </button>
              </div>
            </div>
          </div>

          {/* Reading Goals & Khatm Progress Banner */}
          <div
            id="quran-goals-banner"
            className={`rounded-3xl p-6 border transition-all transform-gpu shadow-md ${
              isDark
                ? 'liquid-glass border-[#C9A063]/30 shadow-md'
                : 'liquid-glass-light border-[#C9A063]/30 shadow-sm'
            }`}
          >
            <div className="flex items-center justify-between mb-3.5">
              <div>
                <div className="flex items-center gap-1.5 text-xs font-semibold text-[#DFBA7F]">
                  <Sparkles className="w-3.5 h-3.5 text-[#C9A063]" />
                  <span className="font-cinzel">Qur'an Complete Experience</span>
                </div>
                <h2 className={`text-base font-serif-heading font-bold mt-0.5 ${isDark ? 'text-[#F5EFE6]' : 'text-stone-900'}`}>
                  {userStats.quranPagesRead === 0 ? "Read and Listen to the Complete 114 Surahs." : "Qur'an Reading Progress"}
                </h2>
              </div>

              <div className="text-right">
                <span className="text-xs font-mono font-bold text-[#DFBA7F]">
                  {userStats.quranPagesRead} / 604 pages
                </span>
                <div className="text-[10px] text-stone-400 font-medium">
                  {Math.round((userStats.quranPagesRead / 604) * 100)}% of Khatm
                </div>
              </div>
            </div>

            <div className="w-full bg-stone-800/60 rounded-full h-2.5 overflow-hidden mb-3.5">
              <div
                className="bg-gradient-to-r from-[#C9A063] to-[#DFBA7F] h-2.5 rounded-full transition-all duration-200 shadow-xs"
                style={{ width: `${Math.max(userStats.quranPagesRead > 0 ? 2 : 0, (userStats.quranPagesRead / 604) * 100)}%` }}
              />
            </div>

            <div className="flex items-center justify-between text-xs pt-1.5 border-t border-[#C9A063]/15">
              <div className="flex items-center gap-1.5 text-[#DFBA7F] font-semibold">
                <Award className="w-4 h-4 text-[#C9A063]" />
                <span>{userStats.quranStreak === 0 ? '0-Day Streak' : `${userStats.quranStreak} Day Streak`}</span>
              </div>
              <button
                onClick={() => {
                  const lastSurah = ALL_SURAHS.find((s) => s.number === userStats.lastReadSurah) || ALL_SURAHS[0];
                  handleSelectSurah(lastSurah, userStats.lastReadAyah || 1);
                }}
                className="text-[#DFBA7F] hover:underline font-semibold flex items-center gap-1 active:scale-95 transition-transform"
              >
                <span>Resume Surah {userStats.lastReadSurah} (Ayah {userStats.lastReadAyah || 1})</span>
                <ChevronLeft className="w-3.5 h-3.5 rotate-180" />
              </button>
            </div>
          </div>

          {/* Navigation & Results Tabs */}
          <div className="flex items-center gap-2 overflow-x-auto pb-1">
            <button
              onClick={() => {
                setActiveTab('surahs');
                setSearchScope('surahs');
                setSelectedJuz(null);
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all active:scale-95 whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'surahs' && selectedJuz === null
                  ? 'bg-gradient-to-r from-[#C9A063] to-[#DFBA7F] text-[#090B0E] border-[#C9A063] shadow-sm font-bold'
                  : isDark
                  ? 'bg-[#0E1217]/85 border-[#C9A063]/20 text-stone-300'
                  : 'bg-white border-stone-200 text-stone-700'
              }`}
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span>{qt.tabSurahs}</span>
              {searchQuery.trim() && searchScope === 'surahs' && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/20 font-mono">
                  {filteredSurahs.length}
                </span>
              )}
            </button>

            <button
              onClick={() => {
                setActiveTab('verses');
                setSearchScope('verses');
              }}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all active:scale-95 whitespace-nowrap flex items-center gap-1.5 ${
                activeTab === 'verses'
                  ? 'bg-gradient-to-r from-[#C9A063] to-[#DFBA7F] text-[#090B0E] border-[#C9A063] shadow-sm font-bold'
                  : isDark
                  ? 'bg-[#0E1217]/85 border-[#C9A063]/20 text-stone-300'
                  : 'bg-white border-stone-200 text-stone-700'
              }`}
            >
              <FileText className="w-3.5 h-3.5" />
              <span>{qt.tabVerses}</span>
              {verseSearchCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full bg-black/20 font-mono">
                  {verseSearchCount}
                </span>
              )}
            </button>

            <button
              onClick={() => setActiveTab('bookmarks')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 active:scale-95 whitespace-nowrap ${
                activeTab === 'bookmarks'
                  ? 'bg-gradient-to-r from-[#C9A063] to-[#DFBA7F] text-[#090B0E] border-[#C9A063] shadow-sm font-bold'
                  : isDark
                  ? 'bg-[#0E1217]/85 border-[#C9A063]/20 text-stone-300'
                  : 'bg-white border-stone-200 text-stone-700'
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" />
              <span>{qt.tabBookmarks} ({userStats.bookmarks.length})</span>
            </button>
          </div>

          {/* ========================================================================= */}
          {/* VERSE KEYWORDS SEARCH RESULTS VIEW                                       */}
          {/* ========================================================================= */}
          {activeTab === 'verses' && (
            <div className="space-y-4">
              {/* Results status banner */}
              {searchQuery.trim().length >= 2 && !isSearchingVerses && (
                <div className="flex items-center justify-between px-1">
                  <span className={`text-xs font-medium ${isDark ? 'text-stone-300' : 'text-stone-700'}`}>
                    Found <span className="font-bold text-[#DFBA7F]">{verseSearchCount}</span> verses matching{' '}
                    <span className="font-semibold text-[#DFBA7F]">"{searchQuery}"</span>
                  </span>
                  {verseSearchResults.length > 0 && (
                    <span className="text-[11px] text-stone-400">
                      Click "Read in Surah" to jump directly to any verse
                    </span>
                  )}
                </div>
              )}

              {/* Loading State */}
              {isSearchingVerses && (
                <div className={`p-10 rounded-2xl border text-center space-y-3 ${
                  isDark ? 'bg-[#0E1217]/85 border-[#C9A063]/20' : 'bg-white border-stone-200'
                }`}>
                  <Loader2 className="w-6 h-6 text-[#C9A063] animate-spin mx-auto" />
                  <p className="text-xs text-stone-400">
                    Searching verses across the Holy Qur'an for <span className="text-[#DFBA7F] font-semibold">"{searchQuery}"</span>...
                  </p>
                </div>
              )}

              {/* Error State */}
              {verseSearchError && !isSearchingVerses && (
                <div className="p-6 rounded-2xl border border-red-500/30 bg-red-500/10 text-center space-y-2">
                  <p className="text-xs text-red-300">{verseSearchError}</p>
                  <button
                    type="button"
                    onClick={() => {
                      if (searchQuery.trim()) {
                        handleSelectKeywordChip(searchQuery.trim());
                      }
                    }}
                    className="px-3 py-1 rounded-xl bg-red-500/20 text-red-200 text-xs font-semibold hover:bg-red-500/30"
                  >
                    Retry Search
                  </button>
                </div>
              )}

              {/* Empty Initial Search Prompt */}
              {searchQuery.trim().length < 2 && !isSearchingVerses && (
                <div className={`p-8 rounded-3xl border text-center space-y-4 ${
                  isDark ? 'bg-[#0E1217]/85 border-[#C9A063]/25' : 'bg-white border-stone-200 shadow-sm'
                }`}>
                  <div className="w-12 h-12 rounded-2xl bg-[#C9A063]/15 border border-[#C9A063]/30 flex items-center justify-center text-[#DFBA7F] mx-auto">
                    <Search className="w-6 h-6 text-[#C9A063]" />
                  </div>
                  <div className="max-w-md mx-auto">
                    <h3 className={`text-sm font-serif-heading font-bold ${isDark ? 'text-[#F5EFE6]' : 'text-stone-900'}`}>
                      Search Inside Qur'an Verses
                    </h3>
                    <p className="text-xs text-stone-400 mt-1">
                      Type any keyword in English or Arabic (e.g., <span className="text-[#DFBA7F]">mercy</span>,{' '}
                      <span className="text-[#DFBA7F]">light</span>, <span className="text-[#DFBA7F]">patience</span>,{' '}
                      <span className="text-[#DFBA7F]">paradise</span>, <span className="text-[#DFBA7F]">صبر</span>,{' '}
                      <span className="text-[#DFBA7F]">نور</span>) to find all matching ayahs across all 114 Surahs.
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                    {POPULAR_QURAN_KEYWORDS.slice(0, 6).map((kw) => (
                      <button
                        key={kw.query}
                        type="button"
                        onClick={() => handleSelectKeywordChip(kw.query)}
                        className={`px-3 py-1.5 rounded-xl text-xs font-medium border transition-all active:scale-95 ${
                          isDark
                            ? 'bg-[#0E1217] border-[#C9A063]/30 text-stone-200 hover:border-[#C9A063] hover:text-[#DFBA7F]'
                            : 'bg-stone-50 border-stone-200 text-stone-700 hover:border-[#C9A063]'
                        }`}
                      >
                        {kw.label}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* No Results Found */}
              {searchQuery.trim().length >= 2 && !isSearchingVerses && verseSearchResults.length === 0 && !verseSearchError && (
                <div className={`p-8 rounded-3xl border text-center space-y-3 ${
                  isDark ? 'bg-[#0E1217]/85 border-[#C9A063]/20' : 'bg-white border-stone-200'
                }`}>
                  <p className="text-xs text-stone-400">
                    No verses found matching <span className="text-[#DFBA7F] font-semibold">"{searchQuery}"</span>.
                  </p>
                  <p className="text-[11px] text-stone-500">
                    Try searching for common themes like "mercy", "light", "patience", "parents", or "forgive".
                  </p>
                </div>
              )}

              {/* Matching Verse Results Cards */}
              {verseSearchResults.length > 0 && !isSearchingVerses && (
                <div className="space-y-3.5">
                  {verseSearchResults.map((match, idx) => (
                    <div
                      key={`${match.surah.number}-${match.numberInSurah}-${idx}`}
                      className={`rounded-2xl p-4 sm:p-5 border transition-all duration-150 transform-gpu ${
                        isDark
                          ? 'bg-[#0E1217]/90 border-[#C9A063]/25 hover:border-[#C9A063]/60 shadow-lg'
                          : 'bg-white border-stone-200 hover:border-[#C9A063]/60 shadow-xs'
                      }`}
                    >
                      {/* Verse Header Info */}
                      <div className="flex items-center justify-between gap-2 mb-3 pb-2.5 border-b border-[#C9A063]/15">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-[#C9A063]/15 border border-[#C9A063]/30 flex items-center justify-center font-bold text-xs text-[#DFBA7F] font-mono">
                            {match.surah.number}:{match.numberInSurah}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <h4 className={`text-xs sm:text-sm font-serif-heading font-bold ${isDark ? 'text-[#F5EFE6]' : 'text-stone-900'}`}>
                                Surah {match.surah.englishName}
                              </h4>
                              <span className="text-[10px] text-stone-400">
                                ({match.surah.englishNameTranslation})
                              </span>
                              {match.surah.revelationType && (
                                <span className={`text-[9px] px-1.5 py-0.2 rounded-md ${
                                  match.surah.revelationType === 'Meccan'
                                    ? isDark ? 'bg-[#C9A063]/15 text-[#DFBA7F]' : 'bg-amber-50 text-amber-800'
                                    : isDark ? 'bg-amber-600/15 text-amber-300' : 'bg-stone-100 text-stone-700'
                                }`}>
                                  {match.surah.revelationType}
                                </span>
                              )}
                            </div>
                            <div className="text-[10px] text-stone-400">
                              Juz {match.juz || 1} • Page {match.page || 1}
                            </div>
                          </div>
                        </div>

                        <div className="font-arabic text-lg font-bold text-[#DFBA7F]">
                          {match.surah.name}
                        </div>
                      </div>

                      {/* Verse Text with Keyword Highlighting */}
                      <div className="space-y-2.5 my-3">
                        <p className={`text-xs sm:text-sm leading-relaxed ${isDark ? 'text-stone-200' : 'text-stone-800'}`}>
                          {renderHighlightedText(match.text, searchQuery)}
                        </p>
                      </div>

                      {/* Action Buttons */}
                      <div className="flex items-center justify-between pt-2.5 border-t border-[#C9A063]/10">
                        <button
                          type="button"
                          onClick={() => handleCopySearchResult(match, idx)}
                          className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl border border-[#C9A063]/25 text-xs text-stone-400 hover:text-[#DFBA7F] hover:bg-[#C9A063]/10 active:scale-95 transition-all"
                        >
                          {copiedSearchResultIndex === idx ? (
                            <>
                              <Check className="w-3.5 h-3.5 text-emerald-400" />
                              <span className="text-emerald-400 font-semibold">Copied</span>
                            </>
                          ) : (
                            <>
                              <Copy className="w-3.5 h-3.5" />
                              <span>{qt.copyAyah}</span>
                            </>
                          )}
                        </button>

                        <button
                          type="button"
                          onClick={() => handleOpenSearchResult(match)}
                          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#C9A063] to-[#DFBA7F] hover:from-[#DFBA7F] hover:to-[#C9A063] text-[#090B0E] text-xs font-bold shadow-xs active:scale-95 transition-all"
                        >
                          <span>{qt.readInSurah}</span>
                          <ArrowUpRight className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* BOOKMARKS LIST VIEW                                                      */}
          {/* ========================================================================= */}
          {activeTab === 'bookmarks' && (
            <div className="space-y-3">
              {detailedBookmarks.map((bm, i) => {
                const surahObj = ALL_SURAHS.find((s) => s.number === bm.surahNumber);
                return (
                  <div
                    key={`${bm.surahNumber}-${bm.ayahNumber}-${i}`}
                    className={`rounded-2xl p-4 border flex items-center justify-between transition-all ${
                      isDark ? 'bg-[#0E1217]/85 border-[#C9A063]/25' : 'bg-white border-stone-200'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-xl bg-[#C9A063]/15 border border-[#C9A063]/30 flex items-center justify-center font-bold text-xs text-[#DFBA7F] font-mono">
                        {bm.ayahNumber}
                      </div>
                      <div>
                        <h4 className={`text-xs font-serif-heading font-bold ${isDark ? 'text-[#F5EFE6]' : 'text-stone-900'}`}>
                          {qt.surahSingular} {bm.surahName} : {qt.ayahSingular} {bm.ayahNumber}
                        </h4>
                        <div className="text-[11px] text-stone-400">
                          {bm.surahArabicName} • Bookmarked on {new Date(bm.timestamp).toLocaleDateString()}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => {
                        if (surahObj) {
                          handleSelectSurah(surahObj, bm.ayahNumber);
                        }
                      }}
                      className="px-3 py-1.5 rounded-xl bg-[#C9A063]/20 hover:bg-[#C9A063]/30 text-[#DFBA7F] border border-[#C9A063]/40 text-xs font-semibold active:scale-95 transition-all"
                    >
                      {qt.readInSurah}
                    </button>
                  </div>
                );
              })}

              {detailedBookmarks.length === 0 && (
                <div className="text-center py-12 text-stone-400 text-xs space-y-1">
                  <div className="font-bold text-[#DFBA7F]">{qt.noBookmarksTitle}</div>
                  <div>{qt.noBookmarksDesc}</div>
                </div>
              )}
            </div>
          )}

          {/* ========================================================================= */}
          {/* ALL 114 SURAHS GRID                                                      */}
          {/* ========================================================================= */}
          {activeTab === 'surahs' && (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3.5">
              {filteredSurahs.map((surah) => (
                <div
                  key={surah.number}
                  id={`surah-item-${surah.number}`}
                  onClick={() => handleSelectSurah(surah)}
                  className={`cursor-pointer rounded-2xl p-4 border transition-all duration-150 active:scale-[0.98] flex items-center justify-between transform-gpu ${
                    userStats.lastReadSurah === surah.number
                      ? 'border-[#C9A063]/70 bg-[#C9A063]/12 shadow-[0_0_20px_rgba(201,160,99,0.2)]'
                      : isDark
                      ? 'bg-[#0E1217]/85 border-[#C9A063]/20 hover:border-[#C9A063]/50'
                      : 'bg-white/90 border-stone-200 hover:border-[#C9A063]/50 shadow-2xs'
                  }`}
                >
                  <div className="flex items-center gap-3.5">
                    <div className="w-10 h-10 rounded-xl bg-[#C9A063]/15 border border-[#C9A063]/30 flex items-center justify-center font-bold text-xs text-[#DFBA7F] font-mono shadow-2xs">
                      {surah.number}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className={`text-sm font-serif-heading font-bold ${isDark ? 'text-[#F5EFE6]' : 'text-stone-900'}`}>
                          {surah.englishName}
                        </h3>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                          surah.revelationType === 'Meccan'
                            ? isDark ? 'bg-[#C9A063]/15 text-[#DFBA7F] border border-[#C9A063]/30' : 'bg-amber-50 text-amber-800'
                            : isDark ? 'bg-amber-600/15 text-amber-300 border border-amber-500/25' : 'bg-stone-100 text-stone-700'
                        }`}>
                          {surah.revelationType === 'Meccan' ? qt.mecca : qt.medina}
                        </span>
                      </div>
                      <div className="text-xs text-stone-400 mt-0.5 font-medium">
                        {surah.englishNameTranslation} • {surah.numberOfAyahs} {qt.ayahsCount}
                      </div>
                    </div>
                  </div>

                  <div className="text-right">
                    <div className="font-arabic text-2xl font-bold text-[#DFBA7F]">
                      {surah.name}
                    </div>
                    <div className="text-[10px] text-stone-400">
                      {qt.juzLabel} {surah.juzNumber} • {qt.pageLabel} {surah.pageNumber}
                    </div>
                  </div>
                </div>
              ))}

              {filteredSurahs.length === 0 && (
                <div className="text-center py-12 text-stone-400 text-xs col-span-full">
                  No Surahs found matching "{searchQuery}".
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Floating Tasmee3 Docked Bar (when active inside reader) */}
      {tasmee3Active && isReadingMode && (
        <Tasmee3DockedBar
          isDark={isDark}
          status={tasmee3Status}
          surahName={currentSurah.name}
          surahEnglishName={currentSurah.englishName}
          currentVerse={tasmee3Verse}
          startingVerse={tasmee3StartingVerse}
          totalAyahs={currentSurah.numberOfAyahs}
          audioLevel={tasmee3AudioLevel}
          uncertainMessage={tasmee3UncertainMessage}
          onPause={handlePauseTasmee3}
          onResume={handleResumeTasmee3}
          onStop={handleStopTasmee3}
          onFinish={handleFinishTasmee3}
          onExpand={() => setShowTasmee3Modal(true)}
          onDismissUncertain={() => setTasmee3UncertainMessage(null)}
        />
      )}

      {/* Interactive Tasmee3 Modal */}
      <Tasmee3Modal
        isOpen={showTasmee3Modal}
        onClose={() => setShowTasmee3Modal(false)}
        isDark={isDark}
        initialSurah={tasmee3InitialSurah || currentSurah}
        initialVerseNumber={tasmee3InitialVerse}
        onJumpToVerseInReader={(surah, verseNum) => {
          handleSelectSurah(surah, verseNum);
          handleJumpToAyah(verseNum);
        }}
      />

      {/* Standalone Tasmee3 Finished Summary Modal (triggered from Docked Bar) */}
      {showTasmee3SummaryModal && tasmee3Summary && (
        <div
          id="tasmee3-summary-modal-overlay"
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in duration-200"
        >
          <div
            className={`w-full max-w-md rounded-3xl p-6 border shadow-md text-center space-y-4 ${
              isDark
                ? 'bg-[#0E1217]/98 border-[#C9A063]/40 text-stone-100 shadow-[0_2px_8px_rgba(0,0,0,0.25)]'
                : 'bg-white/98 border-[#C9A063]/30 text-stone-900 shadow-md'
            }`}
          >
            <div className="w-12 h-12 rounded-2xl bg-[#C9A063]/20 border border-[#C9A063]/40 flex items-center justify-center mx-auto text-[#DFBA7F]">
              <Check className="w-6 h-6" />
            </div>

            <div>
              <div className="text-xs font-cinzel text-[#DFBA7F] font-bold tracking-wider uppercase">
                Tasmee3 Recitation Finished
              </div>
              <h3 className="text-lg font-serif-heading font-bold text-[#F5EFE6] mt-1">
                You reached: Surah {tasmee3Summary.surahEnglishName} — Verse {tasmee3Summary.finalVerse}
              </h3>
              <p className="text-xs text-stone-400 mt-1">
                Starting from Verse {tasmee3Summary.startingVerse} • {tasmee3Summary.totalVersesCovered} Verses recited
              </p>
            </div>

            <div
              className={`rounded-2xl p-3 border grid grid-cols-2 gap-3 text-center ${
                isDark ? 'bg-[#141A22] border-[#C9A063]/25' : 'bg-stone-50 border-stone-200'
              }`}
            >
              <div>
                <span className="text-[10px] text-stone-400 font-cinzel block">Final Position</span>
                <span className="font-mono text-base font-bold text-emerald-400">
                  Verse {tasmee3Summary.finalVerse}
                </span>
              </div>
              <div>
                <span className="text-[10px] text-stone-400 font-cinzel block">Duration</span>
                <span className="font-mono text-base font-bold text-stone-200">
                  {Math.floor(tasmee3Summary.durationSeconds / 60)}m {tasmee3Summary.durationSeconds % 60}s
                </span>
              </div>
            </div>

            <p className="text-xs text-stone-400 leading-relaxed">
              Detected position only. Tajweed rules and pronunciation correctness are not graded.
            </p>

            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => {
                  setShowTasmee3SummaryModal(false);
                  handleJumpToAyah(tasmee3Summary.finalVerse);
                }}
                className="px-5 py-2.5 rounded-2xl bg-gradient-to-r from-[#C9A063] to-[#DFBA7F] text-[#090B0E] font-bold text-xs shadow-md active:scale-95 transition-all flex items-center gap-1.5"
              >
                <BookOpen className="w-3.5 h-3.5" />
                <span>Read in Quran</span>
              </button>
              <button
                onClick={() => setShowTasmee3SummaryModal(false)}
                className="px-4 py-2.5 rounded-2xl border border-stone-700 text-stone-300 hover:bg-stone-800 text-xs active:scale-95 transition-all"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Flagship Quran Teacher AI Interactive Modal */}
      <QuranTeacherModal
        isOpen={showQuranTeacherModal}
        onClose={() => setShowQuranTeacherModal(false)}
        isDark={isDark}
        userStats={userStats}
        onUpdateStats={onUpdateStats}
        initialSurahNumber={quranTeacherSurahNumber}
        initialStartAyah={quranTeacherStartAyah}
        initialEndAyah={quranTeacherEndAyah}
      />
    </div>
  );
});
