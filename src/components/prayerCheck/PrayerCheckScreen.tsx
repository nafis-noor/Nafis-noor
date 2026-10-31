import React, { useState, useEffect } from 'react';
import {
  Clock,
  ShieldAlert,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  HelpCircle,
  History,
  RotateCcw,
  Calendar,
  Compass,
  ArrowRight,
  ChevronRight,
  BellRing,
  Heart,
  ExternalLink,
  Lock,
} from 'lucide-react';
import { PrayerName, PrayerRecord, PrayerTimingItem } from '../../types/prayerCheck';
import {
  PRAYER_NAMES,
  PRAYER_ARABIC_NAMES,
  fetchAladhanPrayerTimes,
  getPrayerScheduleMetrics,
  isPrayerTimeArrived,
  ON_TIME_GRACE_PERIOD_MINUTES,
  AUTO_MISS_THRESHOLD_MINUTES,
} from '../../utils/aladhanService';
import {
  getRecordsByDate,
  getAllPrayerRecords,
  savePrayerRecord,
  buildPrayerId,
} from '../../utils/prayerCheckDb';
import { sendPrayerCheckNotification } from '../../utils/prayerNotificationHelper';
import { PrayerCheckModal } from './PrayerCheckModal';
import { OathFaqModal } from './OathFaqModal';

interface PrayerCheckScreenProps {
  isDark?: boolean;
  userLocation?: string;
  userLatitude?: number;
  userLongitude?: number;
  language?: string;
  onNavigate?: (tab: string) => void;
}

export const PrayerCheckScreen: React.FC<PrayerCheckScreenProps> = ({
  isDark = true,
  userLocation = 'Makkah',
  userLatitude,
  userLongitude,
  language = 'English',
  onNavigate,
}) => {
  // Prayer timings state from Aladhan API
  const [timings, setTimings] = useState<Record<PrayerName, string>>({
    Fajr: '05:08',
    Dhuhr: '12:15',
    Asr: '15:35',
    Maghrib: '17:58',
    Isha: '19:28',
  });
  const [dataSource, setDataSource] = useState<'aladhan' | 'local'>('aladhan');
  const [isLoadingTimings, setIsLoadingTimings] = useState<boolean>(true);

  // Today's prayer records from IndexedDB
  const todayStr = new Date().toISOString().split('T')[0];
  const [todayRecords, setTodayRecords] = useState<Record<PrayerName, PrayerRecord | undefined>>({
    Fajr: undefined,
    Dhuhr: undefined,
    Asr: undefined,
    Maghrib: undefined,
    Isha: undefined,
  });

  // Historical records from IndexedDB
  const [historyRecords, setHistoryRecords] = useState<PrayerRecord[]>([]);
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);

  // Active Oath Modal state
  const [activeCheckPrayer, setActiveCheckPrayer] = useState<{
    name: PrayerName;
    timeStr: string;
  } | null>(null);

  // FAQ Modal state
  const [isFaqOpen, setIsFaqOpen] = useState<boolean>(false);

  // Current time ticker for live countdowns
  const [currentTime, setCurrentTime] = useState<Date>(new Date());

  // Load timings from Aladhan API
  useEffect(() => {
    let isMounted = true;
    async function loadTimings() {
      setIsLoadingTimings(true);
      try {
        const result = await fetchAladhanPrayerTimes(userLocation, userLatitude, userLongitude);
        if (isMounted) {
          setTimings(result.timings);
          setDataSource(result.source);
        }
      } catch (err) {
        console.warn('Could not fetch from Aladhan API:', err);
      } finally {
        if (isMounted) setIsLoadingTimings(false);
      }
    }

    loadTimings();
    return () => {
      isMounted = false;
    };
  }, [userLocation, userLatitude, userLongitude]);

  // Load today's records and historical records from local IndexedDB
  const loadDbRecords = async () => {
    try {
      const records = await getRecordsByDate(todayStr);
      const mapped: Record<PrayerName, PrayerRecord | undefined> = {
        Fajr: undefined,
        Dhuhr: undefined,
        Asr: undefined,
        Maghrib: undefined,
        Isha: undefined,
      };

      records.forEach((r) => {
        mapped[r.prayerName] = r;
      });

      setTodayRecords(mapped);

      const all = await getAllPrayerRecords();
      setHistoryRecords(all);
    } catch (err) {
      console.warn('Error loading prayer check records from IndexedDB:', err);
    }
  };

  useEffect(() => {
    loadDbRecords();
  }, [todayStr]);

  // Update current time every second
  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  // Compute schedule metrics
  const metrics = getPrayerScheduleMetrics(timings, currentTime);
  const activePrayerItem = metrics.currentItem;
  const nextPrayerItem = metrics.nextItem;

  // Handler when oath flow completes
  const handleOathComplete = (record: PrayerRecord) => {
    setTodayRecords((prev) => ({
      ...prev,
      [record.prayerName]: record,
    }));
    loadDbRecords();
    setActiveCheckPrayer(null);
  };

  // Launch modal for prayer
  const handleOpenCheck = (name: PrayerName) => {
    setActiveCheckPrayer({
      name,
      timeStr: timings[name] || '12:00',
    });
  };

  // Quick test notification trigger
  const handleTestNotification = async (name: PrayerName) => {
    await sendPrayerCheckNotification(name, timings[name] || '12:00');
    handleOpenCheck(name);
  };

  // Stats calculation
  const totalCompleted = Object.values(todayRecords).filter((r) => r && (r.status === 'on_time' || r.status === 'late')).length;

  // Arrived prayers check
  const arrivedPrayers = PRAYER_NAMES.filter((p) => isPrayerTimeArrived(timings[p], currentTime));
  const unrecordedArrived = arrivedPrayers.find((p) => !todayRecords[p]);
  const quickCheckPrayer = unrecordedArrived || (arrivedPrayers.length > 0 ? arrivedPrayers[arrivedPrayers.length - 1] : null);

  return (
    <div className="min-h-screen py-6 px-3 sm:px-6 max-w-5xl mx-auto space-y-6">
      {/* Header Banner with Dark Navy & Gold Glassmorphism */}
      <div className="relative rounded-3xl p-6 sm:p-8 overflow-hidden border border-[#C9A063]/30 bg-gradient-to-b from-[#0B1222]/95 via-[#080D1A]/95 to-[#050811]/98 shadow-[0_4px_30px_rgba(0,0,0,0.5)]">
        {/* Subtle top gold highlight */}
        <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#DFBA7F] to-transparent opacity-80" />

        {/* Ambient celestial orb */}
        <div className="absolute -top-16 -right-16 w-64 h-64 rounded-full bg-[#C9A063]/10 blur-3xl pointer-events-none" />

        <div className="relative z-10 flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[#C9A063]/15 border border-[#C9A063]/30 text-[#DFBA7F] text-xs font-mono font-medium">
              <Compass className="w-3.5 h-3.5" />
              <span className="capitalize">{userLocation}</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-serif-heading font-bold text-white tracking-wide">
              Daily Prayer Check & Sanctuary
            </h1>
            <p className="text-xl font-arabic text-[#DFBA7F]" dir="rtl">
              تحقيق ومتابعة الصلوات الخمس اليومية
            </p>
            <p className="text-xs sm:text-sm text-stone-300 font-light max-w-2xl leading-relaxed">
              Confirm each of the 5 daily prayers when their time arrives. Each prayer unlocks at its scheduled time with authentic astronomical timings and honest accountability.
            </p>
          </div>

          {/* Quick Action */}
          <div className="flex flex-col sm:flex-row md:flex-col gap-2.5 shrink-0 w-full md:w-auto">
            {quickCheckPrayer ? (
              <button
                type="button"
                onClick={() => handleOpenCheck(quickCheckPrayer)}
                className="py-3 px-5 rounded-2xl bg-gradient-to-r from-[#C9A063] via-[#DFBA7F] to-[#C9A063] text-[#050811] text-xs font-bold font-cinzel tracking-wider uppercase shadow-[0_0_20px_rgba(201,160,99,0.35)] hover:brightness-110 active:scale-95 transition-all cursor-pointer flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-[#050811]" />
                <span>Check {quickCheckPrayer} Now</span>
              </button>
            ) : (
              <button
                type="button"
                disabled
                className="py-3 px-5 rounded-2xl bg-white/5 border border-white/10 text-stone-500 text-xs font-semibold flex items-center justify-center gap-2 cursor-not-allowed"
              >
                <Lock className="w-4 h-4 text-stone-500" />
                <span>Next: Fajr at {timings.Fajr} (Locked)</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Today's Daily Prayers Grid (Fajr, Dhuhr, Asr, Maghrib, Isha) */}
      <div className="space-y-3">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4 text-[#DFBA7F]" />
            <h2 className="text-base font-serif-heading font-bold text-stone-100">
              Today's 5 Daily Prayers
            </h2>
          </div>
          <div className="text-xs font-mono text-[#DFBA7F]">
            {totalCompleted} of 5 Completed
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
          {PRAYER_NAMES.map((prayer) => {
            const timeStr = timings[prayer] || '--:--';
            const record = todayRecords[prayer];
            const arabicName = PRAYER_ARABIC_NAMES[prayer];
            const hasArrived = isPrayerTimeArrived(timeStr, currentTime);
            const isCurrent = activePrayerItem.name === prayer && hasArrived;

            let statusBadge = (
              <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-white/5 text-stone-400 border border-white/10">
                Pending
              </span>
            );

            if (!hasArrived) {
              statusBadge = (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-stone-800/80 text-stone-400 border border-white/10 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-stone-400" />
                  <span>Locked</span>
                </span>
              );
            } else if (record) {
              if (record.status === 'on_time') {
                statusBadge = (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/40 font-bold">
                    On Time
                  </span>
                );
              } else if (record.status === 'late') {
                statusBadge = (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold">
                    Late
                  </span>
                );
              } else if (record.status === 'did_not_pray') {
                statusBadge = (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/40 font-bold">
                    Did Not Pray
                  </span>
                );
              } else if (record.status === 'missed') {
                statusBadge = (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/40 font-bold">
                    Missed
                  </span>
                );
              }
            } else {
              statusBadge = (
                <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 border border-amber-500/40 font-bold animate-pulse">
                  Time Arrived
                </span>
              );
            }

            return (
              <div
                key={prayer}
                className={`p-4 rounded-3xl border transition-all duration-200 flex flex-col justify-between space-y-3 relative overflow-hidden ${
                  !hasArrived
                    ? 'bg-[#060A14]/70 border-white/5 opacity-80'
                    : isCurrent
                    ? 'bg-gradient-to-b from-[#131D33] to-[#0A101E] border-[#DFBA7F]/60 shadow-[0_0_20px_rgba(201,160,99,0.15)] ring-1 ring-[#DFBA7F]/30'
                    : 'bg-[#0A101F]/80 border-[#C9A063]/20 hover:border-[#C9A063]/40'
                }`}
              >
                {/* Luminous indicator for active prayer */}
                {isCurrent && (
                  <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-[#DFBA7F] to-transparent" />
                )}

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="text-xs font-mono font-semibold text-stone-400 uppercase">
                      {prayer}
                    </span>
                    {statusBadge}
                  </div>

                  <div className="flex items-baseline justify-between">
                    <h3 className="text-lg font-bold text-white font-serif-heading">
                      {prayer}
                    </h3>
                    <span className="text-base font-arabic text-[#DFBA7F]" dir="rtl">
                      {arabicName}
                    </span>
                  </div>

                  <div className="text-xl font-bold font-mono text-[#DFBA7F] mt-1">
                    {timeStr}
                  </div>
                </div>

                {/* Card Action Button */}
                {!hasArrived ? (
                  <button
                    type="button"
                    disabled
                    className="w-full py-2.5 px-3 rounded-xl text-xs font-semibold bg-white/[0.03] text-stone-500 border border-white/5 cursor-not-allowed flex items-center justify-center gap-1.5"
                  >
                    <Lock className="w-3.5 h-3.5 text-stone-500" />
                    <span>Locked until {timeStr}</span>
                  </button>
                ) : record ? (
                  <button
                    type="button"
                    onClick={() => handleOpenCheck(prayer)}
                    className="w-full py-2.5 px-3 rounded-xl text-xs font-semibold bg-white/5 hover:bg-white/10 text-stone-300 border border-white/10 flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-[0.98]"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Recorded (Re-check)</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleOpenCheck(prayer)}
                    className="w-full py-2.5 px-3 rounded-xl text-xs font-bold bg-gradient-to-r from-[#C9A063] via-[#DFBA7F] to-[#C9A063] text-[#07090F] shadow-[0_0_15px_rgba(201,160,99,0.3)] hover:brightness-110 flex items-center justify-center gap-1.5 cursor-pointer transition-all active:scale-95"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-[#07090F]" />
                    <span>Did You Pray?</span>
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Educational Banner & Rules Explanation */}
      <div className="p-6 rounded-3xl bg-[#090E1C]/90 border border-[#C9A063]/20 shadow-lg space-y-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <ShieldAlert className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-sm font-serif-heading font-bold text-[#DFBA7F]">
                How the 4-Step Prayer Verification Operates
              </h3>
              <p className="text-xs text-stone-400 font-sans">
                Authentic Islamic accountability with zero cloud synchronization
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setIsFaqOpen(true)}
            className="text-xs font-semibold text-[#DFBA7F] hover:text-white bg-white/5 hover:bg-white/10 px-3.5 py-1.5 rounded-xl border border-[#C9A063]/30 transition-all flex items-center gap-1.5 cursor-pointer"
          >
            <HelpCircle className="w-3.5 h-3.5" />
            <span>Oath FAQ & Rulings</span>
          </button>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs text-stone-300 leading-relaxed">
          <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1">
            <strong className="text-[#DFBA7F] block">STEP 1: Unlocked on Time</strong>
            <p>
              Each prayer unlocks at its exact time. You are asked directly whether you prayed (On time or Late/Qada) or not.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1">
            <strong className="text-amber-400 block">STEP 2: Mindful Reflection</strong>
            <p>
              Reflect on truthfulness and Islamic accountability. <strong>"I Understand"</strong> is locked for 20 seconds of contemplation.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1">
            <strong className="text-emerald-400 block">STEP 3: Confirmation</strong>
            <p>
              Declare confirmation with Arabic testimony, or choose <em>"I Did Not Pray"</em> with zero guilt.
            </p>
          </div>

          <div className="p-3.5 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1">
            <strong className="text-purple-400 block">STEP 4: Record Saved</strong>
            <p>
              If completed: <em>"May Allah accept it"</em>. If not: <em>"Allah is Most Merciful"</em>. Saved exclusively to your browser's IndexedDB.
            </p>
          </div>
        </div>
      </div>

      {/* Historical Records & Testing Tools */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 p-5 rounded-3xl bg-[#090E1B]/70 border border-white/5">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-[#C9A063]/15 flex items-center justify-center text-[#DFBA7F]">
            <History className="w-5 h-5" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white">
              Local IndexedDB Records
            </h4>
            <p className="text-xs text-stone-400 font-sans">
              {historyRecords.length} total historical prayers logged on this device
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowHistoryModal(!showHistoryModal)}
            className="py-2.5 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-stone-200 border border-white/10 text-xs font-semibold cursor-pointer transition-all flex items-center gap-1.5"
          >
            <History className="w-3.5 h-3.5" />
            <span>{showHistoryModal ? 'Hide Log' : 'View Full History'}</span>
          </button>
        </div>
      </div>

      {/* History Drawer/View */}
      {showHistoryModal && (
        <div className="p-5 rounded-3xl bg-[#070B16] border border-[#C9A063]/25 shadow-xl space-y-3 animate-fadeIn">
          <div className="flex items-center justify-between pb-2 border-b border-white/10">
            <h4 className="text-xs font-mono uppercase tracking-wider text-[#DFBA7F]">
              IndexedDB Prayer Records (No Cloud Sync)
            </h4>
            <span className="text-[11px] text-stone-400 font-mono">Store: prayer_records</span>
          </div>

          {historyRecords.length === 0 ? (
            <p className="text-xs text-stone-400 py-4 text-center">
              No historical records found yet. Complete a prayer check above to record your first entry.
            </p>
          ) : (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {historyRecords.map((rec) => (
                <div
                  key={rec.prayerId}
                  className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-bold text-white font-serif-heading text-sm">
                      {rec.prayerName}
                    </span>
                    <span className="font-mono text-stone-400 text-[11px]">
                      {rec.date} ({rec.scheduledTime || 'Scheduled'})
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span
                      className={`font-mono text-[10px] px-2 py-0.5 rounded-full uppercase font-bold ${
                        rec.status === 'on_time'
                          ? 'bg-emerald-500/20 text-emerald-300'
                          : rec.status === 'late'
                          ? 'bg-amber-500/20 text-amber-300'
                          : rec.status === 'did_not_pray'
                          ? 'bg-purple-500/20 text-purple-300'
                          : 'bg-red-500/20 text-red-300'
                      }`}
                    >
                      {rec.status.replace('_', ' ')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Active Full-Screen Prayer Check Oath Modal */}
      {activeCheckPrayer && (
        <PrayerCheckModal
          isOpen={Boolean(activeCheckPrayer)}
          onClose={() => setActiveCheckPrayer(null)}
          prayerName={activeCheckPrayer.name}
          scheduledTimeStr={activeCheckPrayer.timeStr}
          prayerDate={new Date()}
          onComplete={handleOathComplete}
          isDark={isDark}
        />
      )}

      {/* FAQ Modal */}
      <OathFaqModal
        isOpen={isFaqOpen}
        onClose={() => setIsFaqOpen(false)}
        isDark={isDark}
      />
    </div>
  );
};
