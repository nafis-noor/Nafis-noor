import React, { useState, useEffect, useRef } from 'react';
import {
  X,
  Clock,
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Heart,
  Sparkles,
  ChevronRight,
  Info,
  Calendar,
  Compass,
  ArrowRight,
  Lock,
  Unlock,
} from 'lucide-react';
import { PrayerName, PrayerCheckStatus, PrayerCheckStep, PrayerRecord } from '../../types/prayerCheck';
import { PRAYER_ARABIC_NAMES } from '../../utils/aladhanService';
import { savePrayerRecord, buildPrayerId, markPrayerAsMissed } from '../../utils/prayerCheckDb';
import { OathFaqModal } from './OathFaqModal';
import { useModalScrollLock } from '../../utils/useModalScrollLock';

interface PrayerCheckModalProps {
  isOpen: boolean;
  onClose: () => void;
  prayerName: PrayerName;
  scheduledTimeStr: string;
  prayerDate?: Date;
  onComplete?: (record: PrayerRecord) => void;
  isDark?: boolean;
}

export const PrayerCheckModal: React.FC<PrayerCheckModalProps> = ({
  isOpen,
  onClose,
  prayerName,
  scheduledTimeStr,
  prayerDate = new Date(),
  onComplete,
  isDark = true,
}) => {
  useModalScrollLock(isOpen, 'prayer-check-modal');

  // Step state
  const [currentStep, setCurrentStep] = useState<PrayerCheckStep>(1);
  const [selectedTimingStatus, setSelectedTimingStatus] = useState<'on_time' | 'late'>('on_time');
  const [oathGiven, setOathGiven] = useState<boolean>(false);
  const [finalStatus, setFinalStatus] = useState<PrayerCheckStatus>('on_time');
  const [isFaqOpen, setIsFaqOpen] = useState<boolean>(false);

  // 20-second oath countdown timer (persisted across app close and reload via timestamp delta)
  const [countdownRemaining, setCountdownRemaining] = useState<number>(20);
  const countdownIntervalRef = useRef<any>(null);

  // 30-minute auto-miss timer
  const [autoMissMinutesLeft, setAutoMissMinutesLeft] = useState<number>(30);

  const dateStr = prayerDate.toISOString().split('T')[0];
  const prayerId = buildPrayerId(dateStr, prayerName);

  // Format date readable
  const formattedDate = prayerDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Calculate 30-min auto miss countdown based on current time vs scheduled time
  useEffect(() => {
    if (!isOpen || currentStep === 4) return;

    const calculateAutoMiss = () => {
      const now = new Date();
      const [hours, mins] = scheduledTimeStr.split(':').map(Number);
      const scheduledDate = new Date(prayerDate);
      scheduledDate.setHours(hours, mins, 0, 0);

      const elapsedMs = Math.max(0, now.getTime() - scheduledDate.getTime());
      const elapsedMinutes = Math.floor(elapsedMs / (1000 * 60));
      const remaining = Math.max(0, 30 - elapsedMinutes);
      setAutoMissMinutesLeft(remaining);

      // If 30 minutes expired and still in Step 1 with no response, auto-log as missed
      if (remaining === 0 && currentStep === 1) {
        handleAutoMiss();
      }
    };

    calculateAutoMiss();
    const interval = setInterval(calculateAutoMiss, 15000);
    return () => clearInterval(interval);
  }, [isOpen, currentStep, scheduledTimeStr, prayerDate]);

  const handleAutoMiss = async () => {
    const record = await markPrayerAsMissed(prayerId, dateStr, prayerName, scheduledTimeStr);
    setFinalStatus('missed');
    setOathGiven(false);
    setCurrentStep(4);
    if (onComplete) onComplete(record);
  };

  // STEP 2: 20-Second Locked Countdown with Timestamp Delta Persistence
  useEffect(() => {
    if (currentStep !== 2) return;

    const timerStorageKey = `noor_oath_timer_target_${prayerId}`;
    let targetTimestamp: number;

    const savedTarget = localStorage.getItem(timerStorageKey);
    const now = Date.now();

    if (savedTarget && !isNaN(Number(savedTarget))) {
      targetTimestamp = Number(savedTarget);
      // If the saved target was from a completely different day or expired long ago, refresh
      if (targetTimestamp < now - 600000) {
        targetTimestamp = now + 20000;
        localStorage.setItem(timerStorageKey, targetTimestamp.toString());
      }
    } else {
      // First time entering Step 2: Set exactly 20 seconds ahead
      targetTimestamp = now + 20000;
      localStorage.setItem(timerStorageKey, targetTimestamp.toString());
    }

    const updateTimer = () => {
      const currentNow = Date.now();
      const diffMs = targetTimestamp - currentNow;
      const remainingSeconds = Math.max(0, Math.ceil(diffMs / 1000));
      setCountdownRemaining(remainingSeconds);

      if (remainingSeconds <= 0 && countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };

    updateTimer();
    countdownIntervalRef.current = setInterval(updateTimer, 250);

    return () => {
      if (countdownIntervalRef.current) {
        clearInterval(countdownIntervalRef.current);
      }
    };
  }, [currentStep, prayerId]);

  if (!isOpen) return null;

  // STEP 1 Action: User selects On Time or Late
  const handleSelectTiming = (timing: 'on_time' | 'late') => {
    setSelectedTimingStatus(timing);
    setCurrentStep(2); // Advance to Step 2: Oath Education
  };

  // STEP 2 Action: User acknowledges oath education after 20-second countdown
  const handleAcknowledgeOath = () => {
    if (countdownRemaining > 0) return;
    setCurrentStep(3); // Advance to Step 3: Confirmation under Oath
  };

  // STEP 3 Actions
  // A: Confirmed under oath
  const handleConfirmUnderOath = async () => {
    const record: PrayerRecord = {
      prayerId,
      date: dateStr,
      prayerName,
      status: selectedTimingStatus,
      confirmedAt: new Date().toISOString(),
      oathGiven: true,
      scheduledTime: scheduledTimeStr,
      createdAt: new Date().toISOString(),
    };

    await savePrayerRecord(record);
    setFinalStatus(selectedTimingStatus);
    setOathGiven(true);
    setCurrentStep(4);
    if (onComplete) onComplete(record);
  };

  // B: Did not pray (no oath required)
  const handleDidNotPray = async () => {
    const record: PrayerRecord = {
      prayerId,
      date: dateStr,
      prayerName,
      status: 'did_not_pray',
      confirmedAt: new Date().toISOString(),
      oathGiven: false,
      scheduledTime: scheduledTimeStr,
      createdAt: new Date().toISOString(),
    };

    await savePrayerRecord(record);
    setFinalStatus('did_not_pray');
    setOathGiven(false);
    setCurrentStep(4);
    if (onComplete) onComplete(record);
  };

  const arabicPrayerName = PRAYER_ARABIC_NAMES[prayerName] || prayerName;

  return (
    <>
      <div
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-[#03060C]/90 backdrop-blur-xl animate-fadeIn select-none overflow-y-auto"
        role="dialog"
        aria-modal="true"
        aria-label="Prayer Check Oath Confirmation"
      >
        {/* Full-Screen Container Card */}
        <div
          className={`w-full max-w-lg min-h-[540px] max-h-[92vh] rounded-3xl border shadow-[0_4px_30px_rgba(0,0,0,0.5)] relative overflow-hidden flex flex-col justify-between transition-all duration-300 ${
            isDark
              ? 'bg-[#080D1A] border-[#C9A063]/30 text-stone-100 shadow-[0_0_50px_rgba(201,160,99,0.12)]'
              : 'bg-[#0A1122] border-[#C9A063]/40 text-stone-100 shadow-2xl'
          }`}
        >
          {/* Luminous Top Gold Trim */}
          <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-transparent via-[#DFBA7F] to-transparent opacity-90 z-20" />

          {/* Background Ambient Glow */}
          <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30">
            <div className="absolute -top-24 -left-24 w-80 h-80 rounded-full bg-[#C9A063]/15 blur-3xl" />
            <div className="absolute -bottom-24 -right-24 w-80 h-80 rounded-full bg-[#DFBA7F]/10 blur-3xl" />
          </div>

          {/* Modal Header Bar with Step Indicator */}
          <div className="relative z-10 flex items-center justify-between px-6 pt-5 pb-3 border-b border-[#C9A063]/15 bg-[#050914]/60 backdrop-blur-md">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-2xl bg-[#C9A063]/15 border border-[#C9A063]/30 flex items-center justify-center text-[#DFBA7F]">
                <Clock className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm font-cinzel font-bold text-[#DFBA7F] tracking-wider uppercase">
                  Prayer Check — Step {currentStep} of 4
                </h3>
                <p className="text-[11px] text-stone-400 font-sans">
                  {currentStep === 1 && 'Prayer Arrival & Timing'}
                  {currentStep === 2 && 'Solemn Oath Education'}
                  {currentStep === 3 && 'Confirmation Under Oath'}
                  {currentStep === 4 && 'Covenant Logged'}
                </p>
              </div>
            </div>

            {/* Step 4 allows exit or close button */}
            <button
              onClick={onClose}
              className="p-2 rounded-xl text-stone-400 hover:text-white hover:bg-white/10 transition-colors cursor-pointer"
              title="Close modal"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Step Progress Pill Indicator */}
          <div className="relative z-10 px-6 pt-3 flex items-center gap-1.5">
            {[1, 2, 3, 4].map((step) => (
              <div
                key={step}
                className={`h-1.5 flex-1 rounded-full transition-all duration-300 ${
                  currentStep >= step
                    ? 'bg-gradient-to-r from-[#C9A063] to-[#DFBA7F] shadow-[0_0_8px_rgba(201,160,99,0.5)]'
                    : 'bg-white/10'
                }`}
              />
            ))}
          </div>

          {/* ========================================================================= */}
          {/* STEP 1: TRIGGER & TIME DETAILS                                            */}
          {/* ========================================================================= */}
          {currentStep === 1 && (
            <div className="relative z-10 p-6 flex-1 flex flex-col justify-between space-y-6 animate-fadeIn">
              <div className="text-center space-y-3 pt-2">
                <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-amber-500/10 border border-amber-500/25 text-amber-300 text-xs font-mono font-medium">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>{formattedDate}</span>
                </div>

                {/* Prayer Name & Calligraphy */}
                <div className="space-y-1">
                  <h2 className="text-3xl sm:text-4xl font-serif-heading font-bold text-white tracking-wide">
                    {prayerName} Prayer
                  </h2>
                  <p className="text-2xl font-arabic text-[#DFBA7F]" dir="rtl">
                    صلاة {arabicPrayerName}
                  </p>
                </div>

                {/* Scheduled Time Banner with 10-Minute Grace Period Callout */}
                <div className="p-4 rounded-2xl bg-white/[0.04] border border-[#C9A063]/20 max-w-sm mx-auto shadow-inner">
                  <div className="text-xs text-stone-400 uppercase tracking-widest font-mono">
                    Scheduled Prayer Time
                  </div>
                  <div className="text-2xl font-bold font-mono text-[#DFBA7F] mt-0.5">
                    {scheduledTimeStr}
                  </div>
                  <div className="text-[11px] text-emerald-400 flex items-center justify-center gap-1 mt-1 font-sans">
                    <Sparkles className="w-3 h-3" />
                    <span>10-Minute Grace Period counts as On-Time</span>
                  </div>
                </div>

                {/* Auto-Miss Countdown Warning */}
                <div className="inline-flex items-center gap-1.5 text-xs text-stone-400 bg-black/40 px-3 py-1.5 rounded-xl border border-white/5">
                  <Clock className="w-3.5 h-3.5 text-amber-400" />
                  <span>
                    Auto-logs as missed in <strong className="text-amber-300">{autoMissMinutesLeft}m</strong> if no response
                  </span>
                </div>
              </div>

              {/* Action Buttons: On Time vs Late */}
              <div className="space-y-3 pt-2">
                <p className="text-xs text-center text-stone-400 font-sans">
                  How did you perform this prayer?
                </p>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {/* On Time Button */}
                  <button
                    type="button"
                    onClick={() => handleSelectTiming('on_time')}
                    className="p-4 rounded-2xl bg-gradient-to-b from-emerald-500/20 to-emerald-950/40 border border-emerald-500/40 hover:border-emerald-400 text-left hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer group shadow-lg"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-emerald-300 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                        On Time
                      </span>
                      <ChevronRight className="w-4 h-4 text-emerald-400 group-hover:translate-x-1 transition-transform" />
                    </div>
                    <p className="text-[11px] text-emerald-200/70 mt-1 font-light">
                      Within scheduled time or 10-minute grace period.
                    </p>
                  </button>

                  {/* Late Button */}
                  <button
                    type="button"
                    onClick={() => handleSelectTiming('late')}
                    className="p-4 rounded-2xl bg-gradient-to-b from-amber-500/20 to-amber-950/40 border border-amber-500/40 hover:border-amber-400 text-left hover:scale-[1.02] active:scale-[0.98] transition-all cursor-pointer group shadow-lg"
                  >
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-amber-300 flex items-center gap-1.5">
                        <Clock className="w-4 h-4 text-amber-400" />
                        Late
                      </span>
                      <ChevronRight className="w-4 h-4 text-amber-400 group-hover:translate-x-1 transition-transform" />
                    </div>
                    <p className="text-[11px] text-amber-200/70 mt-1 font-light">
                      Performed after the initial 10-minute grace window.
                    </p>
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 2: OATH EDUCATION & 20-SECOND LOCKED COUNTDOWN                       */}
          {/* ========================================================================= */}
          {currentStep === 2 && (
            <div className="relative z-10 p-6 flex-1 flex flex-col justify-between space-y-5 animate-fadeIn">
              <div className="space-y-4">
                {/* Solemn Warning Icon */}
                <div className="w-14 h-14 rounded-3xl bg-amber-500/15 border border-amber-500/35 flex items-center justify-center text-amber-400 mx-auto shadow-[0_0_20px_rgba(245,158,11,0.2)]">
                  <ShieldAlert className="w-7 h-7 animate-pulse" />
                </div>

                <div className="text-center space-y-1.5">
                  <h2 className="text-xl sm:text-2xl font-serif-heading font-bold text-[#DFBA7F]">
                    Solemn Warning: Swearing by Allah
                  </h2>
                  <p className="text-base font-arabic text-amber-300" dir="rtl">
                    خطر اليمين الغموس وعِظَم القَسَم بالله
                  </p>
                </div>

                {/* Solemn Education Card */}
                <div className="p-4 rounded-2xl bg-black/50 border border-amber-500/30 text-stone-200 space-y-2.5 text-xs sm:text-sm leading-relaxed">
                  <p>
                    In Islam, swearing falsely by Allah (<strong>Al-Yameen Al-Ghamoos</strong>) is classified among the <span className="text-amber-400 font-semibold">greatest major sins</span>. The Prophet Muhammad ﷺ ranked it alongside taking an innocent life and associating partners with Allah (Sahih al-Bukhari 6675).
                  </p>
                  <p className="text-stone-300">
                    Swear <strong className="text-white">only if you truly and completely prayed</strong>. If you did not pray, choose <em>"I Did Not Pray"</em> without hesitation in Step 3. There is no shame in honesty, and Allah is Oft-Forgiving.
                  </p>
                </div>

                {/* Learn More Link to FAQ */}
                <div className="text-center">
                  <button
                    type="button"
                    onClick={() => setIsFaqOpen(true)}
                    className="inline-flex items-center gap-1.5 text-xs text-[#DFBA7F] hover:text-[#F3D7A4] underline underline-offset-4 font-medium cursor-pointer transition-colors"
                  >
                    <Info className="w-3.5 h-3.5" />
                    <span>Learn more about the gravity of false oaths in Islam (FAQ)</span>
                  </button>
                </div>
              </div>

              {/* Locked Countdown Timer & Unlock Button */}
              <div className="space-y-3 pt-2">
                {/* Visible 20-Second Countdown Display */}
                <div className="text-center">
                  {countdownRemaining > 0 ? (
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-xs font-mono font-bold animate-pulse">
                      <Lock className="w-3.5 h-3.5 text-amber-400" />
                      <span>Take time to reflect: {countdownRemaining}s remaining</span>
                    </div>
                  ) : (
                    <div className="inline-flex items-center gap-2 px-4 py-2 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono font-bold">
                      <Unlock className="w-3.5 h-3.5 text-emerald-400" />
                      <span>Reflection period elapsed. You may now proceed.</span>
                    </div>
                  )}
                </div>

                {/* "I Understand" Locked Button */}
                <button
                  type="button"
                  onClick={handleAcknowledgeOath}
                  disabled={countdownRemaining > 0}
                  className={`w-full py-3.5 px-6 rounded-2xl font-cinzel text-xs font-bold tracking-wider transition-all duration-200 flex items-center justify-center gap-2 ${
                    countdownRemaining > 0
                      ? 'bg-stone-800/80 text-stone-500 border border-white/5 cursor-not-allowed opacity-60'
                      : 'bg-gradient-to-r from-[#C9A063] via-[#DFBA7F] to-[#C9A063] text-[#080B12] shadow-[0_0_20px_rgba(201,160,99,0.4)] hover:brightness-110 active:scale-95 cursor-pointer'
                  }`}
                >
                  <span>I Understand & Acknowledge the Weight of this Oath</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 3: CONFIRMATION UNDER OATH (OR DID NOT PRAY)                         */}
          {/* ========================================================================= */}
          {currentStep === 3 && (
            <div className="relative z-10 p-6 flex-1 flex flex-col justify-between space-y-6 animate-fadeIn">
              <div className="text-center space-y-4 pt-2">
                <div className="w-12 h-12 rounded-2xl bg-[#C9A063]/20 border border-[#C9A063]/40 flex items-center justify-center text-[#DFBA7F] mx-auto shadow-[0_0_20px_rgba(201,160,99,0.25)]">
                  <Compass className="w-6 h-6" />
                </div>

                <div>
                  <div className="text-xs uppercase font-mono tracking-widest text-stone-400">
                    Confirmation for {prayerName} Prayer
                  </div>
                  <h2 className="text-2xl font-serif-heading font-bold text-white mt-1">
                    Solemn Declaration
                  </h2>
                </div>

                {/* Atmospheric Arabic Calligraphy Oath Box */}
                <div className="p-6 rounded-3xl bg-gradient-to-b from-[#0F182A]/90 to-[#0A101D]/90 border border-[#C9A063]/30 shadow-2xl space-y-3 relative overflow-hidden">
                  <div className="absolute -top-12 -right-12 w-32 h-32 rounded-full bg-[#C9A063]/10 blur-xl pointer-events-none" />

                  <p className="text-stone-400 text-xs font-sans uppercase tracking-wider">
                    Oath Statement in Arabic:
                  </p>

                  <div className="text-2xl sm:text-3xl font-arabic font-bold text-[#DFBA7F] leading-loose py-2 selection:bg-[#C9A063]/30" dir="rtl">
                    « أُقْسِمُ بِاللَّهِ الْعَظِيمِ أَنِّي قَدْ أَدَّيْتُ صَلَاةَ {arabicPrayerName} »
                  </div>

                  <p className="text-xs text-stone-300 font-serif italic border-t border-[#C9A063]/15 pt-3">
                    "I swear by Allah the Almighty that I have performed the {prayerName} prayer."
                  </p>
                </div>

                <p className="text-[11px] text-stone-400 font-sans max-w-sm mx-auto">
                  By clicking the gold button below, you take a sacred oath before Allah. If you did not pray, choose the secondary option freely.
                </p>
              </div>

              {/* Two Buttons: Primary Gold (Swear) vs Secondary Ghost (Did Not Pray) */}
              <div className="space-y-2.5 pt-2">
                {/* Primary Gold Button */}
                <button
                  type="button"
                  onClick={handleConfirmUnderOath}
                  className="w-full py-4 px-6 rounded-2xl bg-gradient-to-r from-[#C9A063] via-[#DFBA7F] to-[#C9A063] text-[#07090F] font-cinzel text-xs font-bold tracking-widest uppercase shadow-[0_0_25px_rgba(201,160,99,0.35)] hover:brightness-110 active:scale-[0.98] transition-all cursor-pointer flex items-center justify-center gap-2"
                >
                  <Sparkles className="w-4 h-4 text-[#07090F]" />
                  <span>I Swear by Allah I Have Prayed</span>
                </button>

                {/* Secondary Ghost Button: Did Not Pray */}
                <button
                  type="button"
                  onClick={handleDidNotPray}
                  className="w-full py-3 px-6 rounded-2xl bg-white/[0.04] hover:bg-white/[0.08] text-stone-300 hover:text-white border border-white/10 hover:border-white/20 font-sans text-xs font-semibold tracking-wider transition-all cursor-pointer flex items-center justify-center gap-1.5"
                >
                  <Heart className="w-3.5 h-3.5 text-purple-400" />
                  <span>I Did Not Pray (No Oath Required)</span>
                </button>
              </div>
            </div>
          )}

          {/* ========================================================================= */}
          {/* STEP 4: COMPLETION (ACCEPTANCE OR MERCY)                                  */}
          {/* ========================================================================= */}
          {currentStep === 4 && (
            <div className="relative z-10 p-6 flex-1 flex flex-col justify-between space-y-6 animate-fadeIn">
              <div className="text-center space-y-5 pt-4">
                {/* Result Emblem */}
                {oathGiven ? (
                  <div className="w-16 h-16 rounded-3xl bg-emerald-500/20 border border-emerald-500/40 flex items-center justify-center text-emerald-400 mx-auto shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                    <CheckCircle2 className="w-9 h-9" />
                  </div>
                ) : (
                  <div className="w-16 h-16 rounded-3xl bg-purple-500/20 border border-purple-500/40 flex items-center justify-center text-purple-400 mx-auto shadow-[0_0_30px_rgba(168,85,247,0.3)]">
                    <Heart className="w-9 h-9" />
                  </div>
                )}

                {/* Result Title & Calligraphy */}
                <div className="space-y-2">
                  <h2 className="text-2xl sm:text-3xl font-serif-heading font-bold text-white">
                    {oathGiven ? 'May Allah Accept It From You' : 'Allah is Most Merciful'}
                  </h2>
                  <p className="text-2xl font-arabic text-[#DFBA7F]" dir="rtl">
                    {oathGiven ? 'تَقَبَّلَ اللَّهُ مِنَّا وَمِنْكُمْ صَالِحَ الْأَعْمَالِ' : 'إِنَّ اللَّهَ غَفُورٌ رَحِيمٌ'}
                  </p>
                </div>

                {/* Subtext explanation */}
                <div className="p-4 rounded-2xl bg-black/40 border border-[#C9A063]/20 text-xs sm:text-sm text-stone-300 max-w-sm mx-auto leading-relaxed">
                  {oathGiven ? (
                    <p>
                      Your prayer for <strong>{prayerName}</strong> has been confirmed under oath and securely recorded in your local sanctuary. May Allah make your prayers a light on your countenance and in your grave.
                    </p>
                  ) : (
                    <p>
                      Your honesty before Allah is truly valued. Do not lose hope in Allah's boundless mercy. Make wudu now, turn your heart in repentance, and perform this prayer (Qada).
                    </p>
                  )}
                </div>

                {/* Summary Details Badge */}
                <div className="inline-flex flex-wrap items-center justify-center gap-3 text-[11px] font-mono text-stone-400">
                  <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10">
                    Status: <strong className="text-white uppercase">{finalStatus.replace('_', ' ')}</strong>
                  </span>
                  <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10">
                    Oath: <strong className={oathGiven ? 'text-emerald-400' : 'text-purple-400'}>{oathGiven ? 'Yes' : 'No'}</strong>
                  </span>
                  <span className="px-3 py-1 rounded-full bg-white/5 border border-white/10">
                    Storage: <strong className="text-[#DFBA7F]">Local IndexedDB</strong>
                  </span>
                </div>
              </div>

              {/* Done Button */}
              <div className="pt-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-full py-3.5 px-6 rounded-2xl bg-gradient-to-r from-[#C9A063] via-[#DFBA7F] to-[#C9A063] text-[#050811] font-cinzel text-xs font-bold tracking-wider uppercase shadow-lg hover:brightness-110 active:scale-95 transition-all cursor-pointer"
                >
                  Return to Sanctuary
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* FAQ Modal */}
      <OathFaqModal
        isOpen={isFaqOpen}
        onClose={() => setIsFaqOpen(false)}
        isDark={isDark}
      />
    </>
  );
};
