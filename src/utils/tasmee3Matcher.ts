import { Ayah } from '../types';

/**
 * Normalizes Arabic text for Qur'anic recitation matching:
 * - Strips all Tashkeel (harakat: fatha, damma, kasra, sukun, shaddah, tanwin)
 * - Strips Qur'anic pause/stop marks (sajdah, rub el hizb, high meem, high jeem, etc.)
 * - Strips Tatweel (kashida)
 * - Normalizes Alif variants (أ, إ, آ, ٱ -> ا)
 * - Normalizes Taa Marbuta (ة -> ه)
 * - Normalizes Yaa (ى -> ي)
 * - Strips all numbers, punctuation, symbols, and extra whitespace
 */
export function normalizeQuranArabic(text: string): string {
  if (!text) return '';
  return text
    // Remove Quranic annotation symbols (e.g., stops, ayah markers, sajdah, rub el hizb)
    .replace(/[\u06D6-\u06ED\u06DD\u06DE\u06E9\u0600-\u0605\uFD3E\uFD3F]/g, '')
    // Remove Tashkeel / Harakat (fatha, damma, kasra, sukun, shaddah, tanwin, dagger alif, maddah)
    .replace(/[\u064B-\u065F\u0670\u0653\u0654\u0655]/g, '')
    // Remove Tatweel (kashida)
    .replace(/\u0640/g, '')
    // Normalize Alif forms (أ, إ, آ, ٱ -> ا)
    .replace(/[أإآٱ]/g, 'ا')
    // Normalize Taa Marbuta (ة -> ه)
    .replace(/ة/g, 'ه')
    // Normalize Alif Maqsurah to Yaa (ى -> ي)
    .replace(/ى/g, 'ي')
    // Normalize Waslah and special Arabic forms
    .replace(/[\u0671]/g, 'ا')
    // Keep only Arabic letter characters and spaces
    .replace(/[^\u0621-\u063A\u0641-\u064A\s]/g, ' ')
    // Collapse multiple spaces
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Breaks normalized Arabic text into word tokens
 */
export function tokenizeArabic(text: string): string[] {
  const norm = normalizeQuranArabic(text);
  if (!norm) return [];
  return norm.split(' ').filter(w => w.length > 0);
}

export interface Tasmee3MatchResult {
  matchedVerseNumber: number | null;
  confidence: 'high' | 'medium' | 'low' | 'uncertain';
  confidenceScore: number;
  isUncertain: boolean;
  message?: string;
  matchedWordsCount: number;
  matchedVerseText?: string;
}

/**
 * Genuine Quran recitation verse matcher:
 * Takes spoken Arabic text recognized from microphone and matches it against
 * authoritative candidate Quran verses around the user's current reading position.
 *
 * Requirements enforced:
 * - Uses authoritative Quran text
 * - Never invents or alters verses
 * - If uncertain, sets isUncertain: true and message: "We’re not sure where you are. Please continue or repeat the verse."
 * - Clearly distinguishes detected position from Tajweed/recitation correctness
 */
export function matchRecitationToVerses(params: {
  spokenText: string;
  candidateVerses: Ayah[];
  currentVerseNumber: number;
  windowBack?: number;
  windowForward?: number;
}): Tasmee3MatchResult {
  const {
    spokenText,
    candidateVerses,
    currentVerseNumber,
    windowBack = 1,
    windowForward = 4,
  } = params;

  const spokenNormalized = normalizeQuranArabic(spokenText);
  const spokenTokens = tokenizeArabic(spokenNormalized);

  // If there are fewer than 2 recognized spoken Arabic words, we cannot confidently match
  if (!spokenNormalized || spokenTokens.length < 2) {
    return {
      matchedVerseNumber: null,
      confidence: 'uncertain',
      confidenceScore: 0,
      isUncertain: true,
      message: "We’re not sure where you are. Please continue or repeat the verse.",
      matchedWordsCount: 0,
    };
  }

  // Filter candidate verses within a window around current position
  // E.g., currentVerse - 1 to currentVerse + 4
  const minVerse = Math.max(1, currentVerseNumber - windowBack);
  const maxVerse = currentVerseNumber + windowForward;

  const windowVerses = candidateVerses.filter(
    v => v.numberInSurah >= minVerse && v.numberInSurah <= maxVerse
  );

  let bestMatchVerse: Ayah | null = null;
  let bestScore = 0;
  let bestMatchedWords = 0;

  for (const verse of windowVerses) {
    const verseNorm = normalizeQuranArabic(verse.text);
    const verseTokens = tokenizeArabic(verseNorm);
    if (verseTokens.length === 0) continue;

    // 1. Direct substring match (e.g. user recited a contiguous chunk of the verse)
    if (verseNorm.includes(spokenNormalized) && spokenTokens.length >= 2) {
      const score = 0.95;
      if (score > bestScore) {
        bestScore = score;
        bestMatchVerse = verse;
        bestMatchedWords = spokenTokens.length;
      }
      continue;
    }

    if (spokenNormalized.includes(verseNorm) && verseTokens.length >= 2) {
      const score = 0.90;
      if (score > bestScore) {
        bestScore = score;
        bestMatchVerse = verse;
        bestMatchedWords = verseTokens.length;
      }
      continue;
    }

    // 2. N-gram / consecutive word sequence matching (order matters in recitation)
    let consecutiveMatches = 0;
    let maxConsecutive = 0;
    let tokenMatchCount = 0;

    const verseTokenSet = new Set(verseTokens);

    for (const sWord of spokenTokens) {
      if (verseTokenSet.has(sWord)) {
        tokenMatchCount++;
      }
    }

    // Check sliding window of 2-word and 3-word bi-grams / tri-grams
    for (let i = 0; i < spokenTokens.length - 1; i++) {
      const biGram = `${spokenTokens[i]} ${spokenTokens[i + 1]}`;
      if (verseNorm.includes(biGram)) {
        consecutiveMatches += 2;
      }
    }
    maxConsecutive = Math.max(maxConsecutive, consecutiveMatches);

    // Compute token coverage relative to verse length and spoken length
    const spokenCoverage = tokenMatchCount / spokenTokens.length;
    const verseCoverage = tokenMatchCount / verseTokens.length;

    // Favor verses near currentVerseNumber slightly to prevent jump confusion
    const distancePenalty = Math.abs(verse.numberInSurah - currentVerseNumber) * 0.04;

    // Base score combines token overlap and consecutive word ordering
    const score = Math.max(0, (spokenCoverage * 0.4 + verseCoverage * 0.3 + (maxConsecutive > 0 ? 0.3 : 0)) - distancePenalty);

    if (score > bestScore) {
      bestScore = score;
      bestMatchVerse = verse;
      bestMatchedWords = tokenMatchCount;
    }
  }

  // Strict confidence check:
  // Must have at least 2 matching words and score >= 0.48 to be confident
  if (bestMatchVerse && bestScore >= 0.48 && bestMatchedWords >= 2) {
    const isHigh = bestScore >= 0.70 || bestMatchedWords >= 3;
    return {
      matchedVerseNumber: bestMatchVerse.numberInSurah,
      confidence: isHigh ? 'high' : 'medium',
      confidenceScore: Math.min(1, Math.round(bestScore * 100) / 100),
      isUncertain: false,
      matchedWordsCount: bestMatchedWords,
      matchedVerseText: bestMatchVerse.text,
    };
  }

  // Uncertain result
  return {
    matchedVerseNumber: null,
    confidence: 'uncertain',
    confidenceScore: Math.round(bestScore * 100) / 100,
    isUncertain: true,
    message: "We’re not sure where you are. Please continue or repeat the verse.",
    matchedWordsCount: bestMatchedWords,
  };
}
