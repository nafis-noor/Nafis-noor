import React, { useState, useEffect } from 'react';
import {
  Flame,
  X,
  Share2,
  Sparkles,
  BookOpen,
  ArrowRight,
  Heart,
  Check,
  AlertTriangle,
  ChevronDown,
  Volume2,
} from 'lucide-react';
import { DailyInspirationItem } from '../../types/ramadan';
import { trackInspirationPulse } from '../../utils/ramadanDb';
import { useModalScrollLock } from '../../utils/useModalScrollLock';

interface DailyInspirationPulseModalProps {
  isOpen: boolean;
  onDismissTemporarily: () => void;
  onEngagedComplete: () => void;
  item: DailyInspirationItem;
  dayNumber?: number;
  isDark?: boolean;
}

export const DailyInspirationPulseModal: React.FC<DailyInspirationPulseModalProps> = ({
  isOpen,
  onDismissTemporarily,
  onEngagedComplete,
  item,
  dayNumber = 1,
  isDark = true,
}) => {
  useModalScrollLock(isOpen, 'daily-inspiration-pulse-modal');

  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [hasCopiedShare, setHasCopiedShare] = useState<boolean>(false);

  // When user reads more, track as engaged
  const handleReadMore = () => {
    setIsExpanded(true);
    trackInspirationPulse(item.id, item.contentType, true);
  };

  const handleFinishEngagement = () => {
    trackInspirationPulse(item.id, item.contentType, true);
    onEngagedComplete();
  };

  const handleShare = async () => {
    const textToShare = `🌙 *NOOR Ramadan Daily Awakening (Day ${dayNumber})*\n\n"${item.hook}"\n\n${item.shareMessage}\n\nRead more in NOOR: Peaceful Islamic Companion`;
    
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: item.title,
          text: textToShare,
          url: window.location.origin + '/noor-ramadan',
        });
        setHasCopiedShare(true);
        setTimeout(() => setHasCopiedShare(false), 3000);
        return;
      } catch {
        // Fallback to clipboard
      }
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      await navigator.clipboard.writeText(textToShare);
      setHasCopiedShare(true);
      setTimeout(() => setHasCopiedShare(false), 3000);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-[#03050B]/92 backdrop-blur-2xl animate-fadeIn overflow-y-auto select-none"
      role="dialog"
      aria-modal="true"
      aria-label="Daily Ramadan Inspiration Pulse"
    >
      {/* Outer Card with Warm Amber Glow differentiating it from standard notifications */}
      <div
        className="w-full max-w-lg rounded-[32px] border relative overflow-hidden flex flex-col justify-between transition-all duration-300 shadow-[0_0_60px_rgba(245,158,11,0.22)] bg-gradient-to-b from-[#111420] via-[#0A0D18] to-[#060810] border-amber-500/40 text-stone-100"
      >
        {/* Top Radiant Amber Glow Trim */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-transparent via-amber-400 to-transparent opacity-95 z-20" />

        {/* Ambient Warm Amber Light Orbs */}
        <div className="absolute -top-20 -left-20 w-72 h-72 rounded-full bg-amber-500/15 blur-3xl pointer-events-none" />
        <div className="absolute -bottom-20 -right-20 w-72 h-72 rounded-full bg-orange-600/10 blur-3xl pointer-events-none" />

        {/* Header Bar */}
        <div className="relative z-10 flex items-center justify-between px-6 pt-5 pb-3 border-b border-amber-500/20 bg-[#080B14]/80 backdrop-blur-md">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-amber-500/20 border border-amber-500/40 flex items-center justify-center text-amber-300 shadow-[0_0_15px_rgba(245,158,11,0.3)]">
              <Flame className="w-5 h-5 animate-pulse text-amber-400" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-mono uppercase tracking-widest text-amber-400 font-bold">
                  Daily Inspiration Pulse • Day {dayNumber}
                </span>
                <span className="px-2 py-0.2 rounded-full text-[9px] font-mono bg-amber-500/20 text-amber-300 border border-amber-500/30">
                  {item.tag}
                </span>
              </div>
              <p className="text-xs text-stone-300 font-serif-heading">
                Heart Awakening for Ramadan
              </p>
            </div>
          </div>

          {/* Swipe Away / Temporary Dismiss Button */}
          <button
            onClick={onDismissTemporarily}
            className="p-2 rounded-xl text-stone-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
            title="Swipe away temporarily"
            aria-label="Dismiss temporarily"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="relative z-10 p-6 space-y-4 max-h-[72vh] overflow-y-auto">
          {/* Arabic Heading if available */}
          {item.arabicHeading && (
            <div className="text-center">
              <p className="text-xl sm:text-2xl font-arabic font-bold text-amber-300/90 leading-relaxed" dir="rtl">
                « {item.arabicHeading} »
              </p>
            </div>
          )}

          {/* Title */}
          <h2 className="text-xl sm:text-2xl font-serif-heading font-bold text-white text-center tracking-wide">
            {item.title}
          </h2>

          {/* Shocking / Stirring Hook Callout with Amber Accent */}
          <div className="p-4 sm:p-5 rounded-2xl bg-gradient-to-r from-amber-950/40 via-amber-900/20 to-black/50 border border-amber-500/35 text-amber-100 shadow-inner space-y-2">
            <div className="flex items-start gap-2.5">
              <AlertTriangle className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
              <p className="text-sm sm:text-base font-semibold leading-relaxed text-amber-200">
                "{item.hook}"
              </p>
            </div>
          </div>

          {/* Expandable / Full Content */}
          {!isExpanded ? (
            <div className="space-y-3">
              <p className="text-xs sm:text-sm text-stone-300 leading-relaxed font-light">
                {item.previewText}
              </p>

              <button
                type="button"
                onClick={handleReadMore}
                className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-amber-500 via-amber-400 to-amber-500 hover:from-amber-400 hover:to-amber-300 text-stone-950 font-cinzel text-xs font-bold tracking-wider uppercase shadow-[0_0_25px_rgba(245,158,11,0.4)] transition-all cursor-pointer flex items-center justify-center gap-2 active:scale-95"
              >
                <BookOpen className="w-4 h-4" />
                <span>Read More & Stir Your Heart (Required to Clear)</span>
              </button>

              <p className="text-[10px] text-center text-amber-400/80 font-mono">
                * This pulse reappears if dismissed until you engage and reflect.
              </p>
            </div>
          ) : (
            <div className="space-y-4 animate-fadeIn">
              <div className="p-4 rounded-2xl bg-black/40 border border-white/10 space-y-3 text-xs sm:text-sm text-stone-200 leading-relaxed font-light whitespace-pre-line">
                {item.fullContent}
              </div>

              {/* Source or Citation */}
              <div className="flex items-center justify-between text-[11px] font-mono text-amber-400/90 px-1">
                <span>Source: {item.sourceOrCitation}</span>
              </div>

              {/* Call to Action Box */}
              <div className="p-3.5 rounded-2xl bg-emerald-950/30 border border-emerald-500/30 text-emerald-200 text-xs flex items-center gap-2.5">
                <Sparkles className="w-4 h-4 text-emerald-400 shrink-0" />
                <div>
                  <strong className="block text-emerald-300 font-semibold">Immediate Action:</strong>
                  <span>{item.actionCall}</span>
                </div>
              </div>

              {/* Final Complete Button & Share */}
              <div className="pt-2 flex flex-col sm:flex-row items-center gap-2.5">
                <button
                  type="button"
                  onClick={handleFinishEngagement}
                  className="w-full sm:flex-1 py-3 px-5 rounded-2xl bg-gradient-to-r from-[#C9A063] via-[#DFBA7F] to-[#C9A063] text-stone-950 font-cinzel text-xs font-bold tracking-wider uppercase shadow-md hover:brightness-110 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Check className="w-4 h-4 text-stone-950" />
                  <span>I Have Reflected — Complete Pulse</span>
                </button>

                <button
                  type="button"
                  onClick={handleShare}
                  className="w-full sm:w-auto py-3 px-4 rounded-2xl bg-white/5 hover:bg-white/10 border border-white/10 text-stone-200 text-xs font-semibold flex items-center justify-center gap-1.5 transition-all cursor-pointer"
                  title="Forward this reflection to family & friends"
                >
                  <Share2 className="w-4 h-4 text-amber-400" />
                  <span>{hasCopiedShare ? 'Copied to Share!' : 'Share Pulse'}</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer Note */}
        <div className="relative z-10 px-6 py-3 border-t border-amber-500/15 bg-[#060810]/70 flex items-center justify-between text-[10px] text-stone-400 font-mono">
          <span>NOOR Ramadan Spiritual Pulse</span>
          <button
            onClick={onDismissTemporarily}
            className="hover:text-amber-300 transition-colors underline cursor-pointer"
          >
            Remind me in 2 hours
          </button>
        </div>
      </div>
    </div>
  );
};
