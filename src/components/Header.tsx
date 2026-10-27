import React, { memo } from 'react';
import { Sun, Moon, Flame, Sparkles } from 'lucide-react';
import { AppLogoIcon } from './AppLogoIcon';
import { t, getLanguageCode } from '../utils/i18n';

interface HeaderProps {
  isDark: boolean;
  onToggleTheme: () => void;
  streak: number;
  hijriDate: string;
  language?: string;
  isAtRisk?: boolean;
  riskFormattedTime?: string;
  onOpenStreakRisk?: () => void;
}

export const Header: React.FC<HeaderProps> = memo(({
  isDark,
  onToggleTheme,
  streak,
  hijriDate,
  language,
  isAtRisk = false,
  riskFormattedTime,
  onOpenStreakRisk,
}) => {
  const lang = getLanguageCode(language);
  return (
    <header
      id="app-header"
      className={`lg:hidden sticky top-0 z-30 px-4 sm:px-6 pt-3 pb-3 ${
        isDark ? 'bg-[#080A0E]/95' : 'bg-[#FAF9F5]/95'
      } transition-colors duration-200 border-b border-[#C9A063]/15`}
    >
      <div className="w-full max-w-4xl mx-auto flex items-center justify-between">
        {/* Brand & Calligraphy */}
        <div className="flex items-center gap-2.5">
          <div className="w-10 h-10 rounded-2xl overflow-hidden shadow-sm shrink-0">
            <AppLogoIcon className="w-full h-full" withContainer={true} />
          </div>
          <div>
            <div className="flex items-center gap-1.5">
              <h1 className={`text-base font-cinzel font-bold tracking-widest ${isDark ? 'text-[#F5EFE6]' : 'text-stone-900'}`}>
                NOOR
              </h1>
              <span className="inline-flex items-center px-1.5 py-0.5 rounded-full text-[10px] font-medium bg-[#C9A063]/12 text-[#DFBA7F] border border-[#C9A063]/30">
                <Sparkles className="w-2.5 h-2.5 mr-0.5 text-[#C9A063]" />
                {t(lang, 'sanctuary')}
              </span>
            </div>
            <p className={`text-[11px] font-medium ${isDark ? 'text-stone-400' : 'text-stone-500'}`}>
              {hijriDate}
            </p>
          </div>
        </div>

        {/* Action Pills */}
        <div className="flex items-center gap-2">
          {/* Daily Streak Pill */}
          <button
            id="header-streak-pill"
            onClick={isAtRisk && onOpenStreakRisk ? onOpenStreakRisk : undefined}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all ${
              isAtRisk
                ? 'bg-amber-500/25 border-amber-500/60 text-amber-300 shadow-[0_0_12px_rgba(245,158,11,0.4)] animate-pulse'
                : isDark
                ? 'bg-[#C9A063]/10 border-[#C9A063]/30 text-[#DFBA7F]'
                : 'bg-amber-50/90 border-[#C9A063]/40 text-amber-800'
            }`}
            title={
              isAtRisk
                ? `⚠️ Streak at risk! Only ${riskFormattedTime || 'a few hours'} left today. Study or Dhikr to save!`
                : t(lang, 'activeStreak')
            }
          >
            <Flame
              className={`w-4 h-4 transition-all ${
                isAtRisk
                  ? 'text-amber-400 fill-amber-400 animate-bounce'
                  : 'text-[#C9A063] fill-[#C9A063]'
              }`}
            />
            <span className="text-xs font-semibold">
              {streak}d{isAtRisk ? ' ⚠️' : ''}
            </span>
          </button>

          {/* Theme Toggle */}
          <button
            id="theme-toggle-button"
            onClick={onToggleTheme}
            className={`w-9 h-9 rounded-full border flex items-center justify-center transition-all ${
              isDark
                ? 'bg-[#12161D]/80 border-[#C9A063]/25 text-[#DFBA7F] hover:text-white hover:bg-[#1A202A]'
                : 'bg-white/90 border-stone-200 text-stone-700 hover:text-stone-950 hover:bg-stone-100 shadow-sm'
            }`}
            aria-label="Toggle theme"
          >
            {isDark ? <Sun className="w-4 h-4 text-[#DFBA7F]" /> : <Moon className="w-4 h-4 text-stone-700" />}
          </button>
        </div>
      </div>
    </header>
  );
});
