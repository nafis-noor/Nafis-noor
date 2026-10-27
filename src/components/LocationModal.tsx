import React, { useState } from 'react';
import {
  MapPin,
  Compass,
  Search,
  Check,
  X,
  Sparkles,
  Settings2,
  Globe2,
  Sliders,
  Info
} from 'lucide-react';
import { UserStats, CalculationMethodKey, AsrMadhabKey } from '../types';
import { POPULAR_CITIES, CALCULATION_METHODS_META, findCityByName } from '../data/citiesData';
import { calculatePrayerTimes } from '../utils/prayerTimes';
import { useModalScrollLock } from '../utils/useModalScrollLock';

interface LocationModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
  userStats: UserStats;
  onUpdateStats: (stats: Partial<UserStats>) => void;
}

export const LocationModal: React.FC<LocationModalProps> = ({
  isOpen,
  onClose,
  isDark,
  userStats,
  onUpdateStats,
}) => {
  // Lock background scroll and return user to exact click position upon closing
  useModalScrollLock(isOpen, 'location-settings-modal');

  const [searchQuery, setSearchQuery] = useState('');
  const [isDetectingLocation, setIsDetectingLocation] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'city' | 'method'>('city');

  if (!isOpen) return null;

  const currentMethod: CalculationMethodKey = userStats.prayerCalculationMethod || 'UmmAlQura';
  const currentMadhab: AsrMadhabKey = userStats.asrJuristicMethod || 'Shafi';

  // Filter cities by search query
  const filteredCities = POPULAR_CITIES.filter((c) => {
    if (!searchQuery.trim()) return true;
    const q = searchQuery.toLowerCase();
    return (
      c.name.toLowerCase().includes(q) ||
      c.country.toLowerCase().includes(q) ||
      `${c.name}, ${c.country}`.toLowerCase().includes(q)
    );
  });

  const handleSelectCity = (city: typeof POPULAR_CITIES[0]) => {
    onUpdateStats({
      userLocation: city.name,
      userCountry: city.country,
      userLatitude: city.latitude,
      userLongitude: city.longitude,
      prayerCalculationMethod: city.defaultMethod,
    });
    setGeoError(null);
  };

  const handleDetectGPS = () => {
    setIsDetectingLocation(true);
    setGeoError(null);

    if (!('geolocation' in navigator)) {
      setGeoError('Geolocation is not supported in this browser. Please pick a city from the list.');
      setIsDetectingLocation(false);
      return;
    }

    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        const lat = pos.coords.latitude;
        const lng = pos.coords.longitude;
        
        let detectedCityName = 'Detected Location';
        try {
          // Find closest city in our list as friendly name if nearby
          let closest = POPULAR_CITIES[0];
          let minDist = Infinity;
          for (const c of POPULAR_CITIES) {
            const dist = Math.hypot(c.latitude - lat, c.longitude - lng);
            if (dist < minDist) {
              minDist = dist;
              closest = c;
            }
          }
          if (minDist < 1.0) {
            detectedCityName = closest.name;
          } else {
            detectedCityName = `${lat.toFixed(2)}°, ${lng.toFixed(2)}°`;
          }
        } catch {
          detectedCityName = `${lat.toFixed(2)}°, ${lng.toFixed(2)}°`;
        }

        onUpdateStats({
          userLocation: detectedCityName,
          userLatitude: lat,
          userLongitude: lng,
        });
        setIsDetectingLocation(false);
      },
      (err) => {
        console.warn('Geolocation error:', err);
        setGeoError('Location permission denied or unavailable. Please select your city manually below.');
        setIsDetectingLocation(false);
      },
      { timeout: 8000, enableHighAccuracy: true }
    );
  };

  // Preview prayer times under current settings
  const preview = calculatePrayerTimes({
    latitude: userStats.userLatitude,
    longitude: userStats.userLongitude,
    locationName: userStats.userLocation,
    calculationMethod: currentMethod,
    asrMadhab: currentMadhab,
  });

  return (
    <div
      id="location-settings-modal-backdrop"
      className="fixed inset-0 z-50 overflow-y-auto flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn"
      onClick={onClose}
    >
      <div
        id="location-settings-modal-content"
        onClick={(e) => e.stopPropagation()}
        className={`w-full max-w-md rounded-3xl p-5 sm:p-6 border transition-all duration-200 shadow-md relative ${
          isDark
            ? 'liquid-glass border-[#C9A063]/30 text-stone-100'
            : 'liquid-glass-light border-[#C9A063]/40 text-stone-900'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#C9A063]/20">
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-[#C9A063]/20 border border-[#C9A063]/40 flex items-center justify-center text-[#DFBA7F]">
              <MapPin className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-cinzel text-sm font-bold tracking-wider text-[#DFBA7F]">
                LOCATION & CALCULATION
              </h3>
              <p className="text-[11px] text-stone-400">
                Accurate astronomical Salah schedule
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#141A22]/80 border border-[#C9A063]/20 flex items-center justify-center text-stone-400 hover:text-white transition-all"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switch: City Selector vs Calculation Method */}
        <div className="flex items-center gap-1.5 p-1 rounded-2xl bg-[#0E1217]/80 border border-[#C9A063]/20 mb-3.5">
          <button
            onClick={() => setActiveTab('city')}
            className={`flex-1 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'city'
                ? 'bg-gradient-to-r from-[#C9A063] to-[#DFBA7F] text-[#090B0E] font-bold shadow-sm'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Globe2 className="w-3.5 h-3.5" />
            <span>Select City</span>
          </button>
          <button
            onClick={() => setActiveTab('method')}
            className={`flex-1 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all ${
              activeTab === 'method'
                ? 'bg-gradient-to-r from-[#C9A063] to-[#DFBA7F] text-[#090B0E] font-bold shadow-sm'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            <Sliders className="w-3.5 h-3.5" />
            <span>Method & Asr</span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: CITY & GPS DETECT */}
        {/* ========================================================================= */}
        {activeTab === 'city' && (
          <div className="space-y-3">
            {/* GPS Auto-Detect Button */}
            <button
              id="gps-auto-detect-btn"
              onClick={handleDetectGPS}
              disabled={isDetectingLocation}
              className="w-full py-2.5 px-3.5 rounded-2xl border border-[#C9A063]/40 bg-gradient-to-r from-[#C9A063]/20 via-[#DFBA7F]/15 to-[#C9A063]/20 hover:border-[#DFBA7F] text-[#DFBA7F] text-xs font-semibold flex items-center justify-center gap-2 transition-all shadow-sm group"
            >
              <Compass className={`w-4 h-4 ${isDetectingLocation ? 'animate-spin' : 'group-hover:rotate-45'} transition-transform`} />
              <span>{isDetectingLocation ? 'Determining GPS Coordinates...' : 'Use Current Device Location (GPS)'}</span>
            </button>

            {geoError && (
              <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 text-amber-300 text-[11px] flex items-center gap-2">
                <Info className="w-4 h-4 shrink-0" />
                <span>{geoError}</span>
              </div>
            )}

            {/* City Search Bar */}
            <div className="relative">
              <Search className="w-4 h-4 text-stone-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search city (e.g. London, New York, Cairo, Dubai)..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-3 py-2 rounded-2xl bg-[#12161D] border border-[#C9A063]/25 text-stone-100 text-xs focus:outline-none focus:border-[#DFBA7F] placeholder:text-stone-500"
              />
            </div>

            {/* City List */}
            <div className="max-h-52 overflow-y-auto no-scrollbar space-y-1 pr-0.5">
              {filteredCities.map((city) => {
                const isSelected = userStats.userLocation === city.name;
                return (
                  <button
                    key={`${city.name}-${city.country}`}
                    onClick={() => handleSelectCity(city)}
                    className={`w-full p-2.5 rounded-xl border text-left text-xs transition-all flex items-center justify-between ${
                      isSelected
                        ? 'bg-[#C9A063]/25 border-[#DFBA7F] text-[#DFBA7F] font-semibold shadow-inner'
                        : 'bg-[#12161D]/70 border-white/5 text-stone-300 hover:border-[#C9A063]/30 hover:bg-[#12161D]'
                    }`}
                  >
                    <div>
                      <div className="font-semibold text-stone-100 flex items-center gap-1.5">
                        <span>{city.name}</span>
                        <span className="text-[10px] text-stone-400 font-normal">({city.country})</span>
                      </div>
                      <div className="text-[10px] text-stone-400 font-mono">
                        {city.latitude.toFixed(2)}° N, {city.longitude.toFixed(2)}° E
                      </div>
                    </div>

                    {isSelected && (
                      <div className="w-5 h-5 rounded-full bg-[#C9A063] text-[#090B0E] flex items-center justify-center">
                        <Check className="w-3 h-3 stroke-[3]" />
                      </div>
                    )}
                  </button>
                );
              })}

              {filteredCities.length === 0 && (
                <div className="text-center py-6 text-xs text-stone-400">
                  No cities matching "{searchQuery}". You can use GPS auto-detect or enter nearby major city.
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: CALCULATION METHOD & ASR JURISTIC SCHOOL */}
        {/* ========================================================================= */}
        {activeTab === 'method' && (
          <div className="space-y-3.5">
            {/* Calculation Method */}
            <div>
              <label className="text-[11px] font-semibold text-stone-300 block mb-1.5">
                Calculation Authority / Standard:
              </label>
              <div className="max-h-48 overflow-y-auto no-scrollbar space-y-1">
                {CALCULATION_METHODS_META.map((method) => {
                  const isSelected = currentMethod === method.key;
                  return (
                    <button
                      key={method.key}
                      onClick={() => onUpdateStats({ prayerCalculationMethod: method.key })}
                      className={`w-full p-2.5 rounded-xl border text-left text-xs transition-all ${
                        isSelected
                          ? 'bg-[#C9A063]/25 border-[#DFBA7F] text-[#DFBA7F] font-semibold'
                          : 'bg-[#12161D]/70 border-white/5 text-stone-300 hover:border-[#C9A063]/30'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-stone-100">{method.name}</span>
                        {isSelected && <Check className="w-3.5 h-3.5 text-[#DFBA7F]" />}
                      </div>
                      <p className="text-[10px] text-stone-400 mt-0.5 font-light leading-tight">
                        {method.description}
                      </p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Asr Juristic School */}
            <div className="pt-2 border-t border-[#C9A063]/15">
              <label className="text-[11px] font-semibold text-stone-300 block mb-1.5">
                'Asr Jurisprudence (Madhab):
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  onClick={() => onUpdateStats({ asrJuristicMethod: 'Shafi' })}
                  className={`p-2.5 rounded-xl border text-center text-xs transition-all ${
                    currentMadhab === 'Shafi'
                      ? 'bg-[#C9A063]/25 border-[#DFBA7F] text-[#DFBA7F] font-semibold'
                      : 'bg-[#12161D]/70 border-white/5 text-stone-400'
                  }`}
                >
                  <div className="font-semibold text-stone-200">Standard / Shafi'i</div>
                  <div className="text-[10px] text-stone-400 mt-0.5">Maliki, Hanbali, Shafi'i</div>
                </button>

                <button
                  onClick={() => onUpdateStats({ asrJuristicMethod: 'Hanafi' })}
                  className={`p-2.5 rounded-xl border text-center text-xs transition-all ${
                    currentMadhab === 'Hanafi'
                      ? 'bg-[#C9A063]/25 border-[#DFBA7F] text-[#DFBA7F] font-semibold'
                      : 'bg-[#12161D]/70 border-white/5 text-stone-400'
                  }`}
                >
                  <div className="font-semibold text-stone-200">Hanafi</div>
                  <div className="text-[10px] text-stone-400 mt-0.5">Shadow = 2x object</div>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Live Calculation Preview Footer */}
        <div className="mt-4 pt-3 border-t border-[#C9A063]/20 flex items-center justify-between text-xs">
          <div className="truncate pr-2">
            <span className="text-stone-400 text-[11px]">Active: </span>
            <span className="text-[#DFBA7F] font-semibold">{preview.locationName}</span>
            <span className="text-[10px] text-stone-400 block truncate">{preview.methodName}</span>
          </div>

          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl font-bold text-xs bg-gradient-to-r from-[#C9A063] via-[#DFBA7F] to-[#C9A063] text-[#090B0E] shadow-sm hover:opacity-95 transition-all"
          >
            Apply Times
          </button>
        </div>
      </div>
    </div>
  );
};
