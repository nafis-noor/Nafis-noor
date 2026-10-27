import React, { useState } from 'react';
import {
  ShieldCheck,
  Lock,
  Download,
  Trash2,
  AlertTriangle,
  X,
  CheckCircle2,
  FileText,
  EyeOff,
  Server,
  Layers,
  Sparkles
} from 'lucide-react';
import { UserStats } from '../types';
import { exportUserDataJSON, deleteAccount } from '../utils/accountManager';
import { useModalScrollLock } from '../utils/useModalScrollLock';

interface PrivacyModalProps {
  isOpen: boolean;
  onClose: () => void;
  isDark: boolean;
  userStats: UserStats;
  onUpdateStats: (stats: Partial<UserStats>) => void;
  onResetAllData?: () => void;
}

export const PrivacyModal: React.FC<PrivacyModalProps> = ({
  isOpen,
  onClose,
  isDark,
  userStats,
  onUpdateStats,
  onResetAllData,
}) => {
  // Lock background scroll and return user to exact click position upon closing
  useModalScrollLock(isOpen, 'privacy-sanctuary-modal');

  const [activeTab, setActiveTab] = useState<'policy' | 'manage' | 'delete'>('policy');
  const [deleteConfirmText, setDeleteConfirmText] = useState('');
  const [copiedExport, setCopiedExport] = useState(false);
  const [hasClearedChat, setHasClearedChat] = useState(false);

  if (!isOpen) return null;

  const handleExportData = () => {
    const jsonString = exportUserDataJSON(userStats);
    const blob = new Blob([jsonString], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `noor-data-export-${new Date().toISOString().split('T')[0]}.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    setCopiedExport(true);
    setTimeout(() => setCopiedExport(false), 3000);
  };

  const handleClearAiChatHistory = () => {
    onUpdateStats({
      noorAiConversation: [],
    });
    setHasClearedChat(true);
    setTimeout(() => setHasClearedChat(false), 3000);
  };

  const handleDeleteAccountPermanent = () => {
    if (userStats.accountId) {
      deleteAccount(userStats.accountId);
    }
    if (onResetAllData) {
      onResetAllData();
    }
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md animate-fadeIn">
      <div
        id="privacy-modal-container"
        className={`w-full max-w-lg rounded-[32px] p-6 sm:p-7 border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] ${
          isDark
            ? 'bg-[#0E1217] border-[#C9A063]/30 text-stone-100'
            : 'bg-white border-stone-200 text-stone-900'
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-stone-700/20 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-[#C9A063] to-[#DFBA7F] text-[#090B0E] flex items-center justify-center font-bold shadow-md">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-serif-heading font-bold text-[#DFBA7F]">
                Privacy & Data Sanctuary
              </h2>
              <p className="text-xs text-stone-400">Clear, transparent & respectful data control</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-stone-400 hover:text-stone-200 hover:bg-stone-800/40 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-1.5 p-1 my-4 rounded-2xl bg-stone-900/60 border border-stone-800 shrink-0 text-xs">
          <button
            onClick={() => setActiveTab('policy')}
            className={`flex-1 py-2 rounded-xl font-semibold transition-all ${
              activeTab === 'policy'
                ? 'bg-[#C9A063]/25 text-[#DFBA7F] border border-[#C9A063]/40'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            Privacy Principles
          </button>
          <button
            onClick={() => setActiveTab('manage')}
            className={`flex-1 py-2 rounded-xl font-semibold transition-all ${
              activeTab === 'manage'
                ? 'bg-[#C9A063]/25 text-[#DFBA7F] border border-[#C9A063]/40'
                : 'text-stone-400 hover:text-stone-200'
            }`}
          >
            Manage My Data
          </button>
          <button
            onClick={() => setActiveTab('delete')}
            className={`flex-1 py-2 rounded-xl font-semibold transition-all ${
              activeTab === 'delete'
                ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                : 'text-stone-400 hover:text-red-400'
            }`}
          >
            Delete Account
          </button>
        </div>

        {/* Tab 1: Privacy Principles */}
        {activeTab === 'policy' && (
          <div className="overflow-y-auto space-y-4 pr-1 text-xs leading-relaxed text-stone-300 no-scrollbar">
            {/* Core Privacy Promise Callout */}
            <div className="p-4 rounded-2xl bg-[#C9A063]/10 border border-[#C9A063]/30 space-y-2">
              <h3 className="font-serif-heading font-bold text-sm text-[#DFBA7F] flex items-center gap-1.5">
                <Sparkles className="w-4 h-4" />
                <span>Your privacy matters.</span>
              </h3>
              <p className="text-stone-200">
                We only use the information you choose to provide to personalize Noor and improve your spiritual experience.
              </p>
              <p className="text-stone-300 text-[11px]">
                • Your private information is never displayed publicly.<br />
                • Some information is stored securely with your Noor account so your settings and progress can follow you across devices.<br />
                • No ads, no data selling, no tracking pixels.
              </p>
            </div>

            <div className="space-y-3">
              <div className="p-3.5 rounded-2xl bg-[#12161D] border border-white/5 space-y-1.5">
                <div className="flex items-center gap-2 font-semibold text-stone-200">
                  <Server className="w-4 h-4 text-[#DFBA7F]" />
                  <span>What We Store & Why</span>
                </div>
                <p className="text-stone-400 text-[11px]">
                  <strong>Account ID & Preferences:</strong> To maintain your chosen language, theme, and location for astronomical prayer calculations.<br />
                  <strong>Legitimate Activity Records:</strong> Only the Qur'an pages you read, Dhikr counts, completed lessons, and earned XP you actually finish.<br />
                  <strong>Noor AI Questions:</strong> Saved locally / with your account only to preserve your conversational thread across screens.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#12161D] border border-white/5 space-y-1.5">
                <div className="flex items-center gap-2 font-semibold text-stone-200">
                  <Lock className="w-4 h-4 text-[#DFBA7F]" />
                  <span>Password Security</span>
                </div>
                <p className="text-stone-400 text-[11px]">
                  Passwords are cryptographically hashed using industry-standard SHA-256 with salting. Plaintext passwords are never stored in any database.
                </p>
              </div>

              <div className="p-3.5 rounded-2xl bg-[#12161D] border border-white/5 space-y-1.5">
                <div className="flex items-center gap-2 font-semibold text-stone-200">
                  <EyeOff className="w-4 h-4 text-[#DFBA7F]" />
                  <span>Who Can Access Your Data</span>
                </div>
                <p className="text-stone-400 text-[11px]">
                  Only you have access to your personal stats and conversation history. You can export or delete your entire record at any time with complete autonomy.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Manage My Data */}
        {activeTab === 'manage' && (
          <div className="overflow-y-auto space-y-4 pr-1 text-xs text-stone-300 no-scrollbar">
            <div className="p-4 rounded-2xl bg-[#12161D] border border-[#C9A063]/25 space-y-3">
              <h3 className="font-semibold text-stone-200 flex items-center gap-2">
                <FileText className="w-4 h-4 text-[#DFBA7F]" />
                <span>Current Data Footprint</span>
              </h3>

              <div className="grid grid-cols-2 gap-2 text-[11px]">
                <div className="p-2.5 rounded-xl bg-[#090B0E] border border-white/5">
                  <div className="text-stone-400">Account ID</div>
                  <div className="font-mono text-[#DFBA7F] truncate">{userStats.accountId || 'Guest Session'}</div>
                </div>
                <div className="p-2.5 rounded-xl bg-[#090B0E] border border-white/5">
                  <div className="text-stone-400">Overall Streak</div>
                  <div className="font-bold text-stone-200">{userStats.overallStreak} days</div>
                </div>
                <div className="p-2.5 rounded-xl bg-[#090B0E] border border-white/5">
                  <div className="text-stone-400">Pages Read</div>
                  <div className="font-bold text-stone-200">{userStats.quranPagesRead} pages</div>
                </div>
                <div className="p-2.5 rounded-xl bg-[#090B0E] border border-white/5">
                  <div className="text-stone-400">Saved Bookmarks</div>
                  <div className="font-bold text-stone-200">{userStats.bookmarks.length} ayahs</div>
                </div>
                <div className="p-2.5 rounded-xl bg-[#090B0E] border border-white/5">
                  <div className="text-stone-400">Total XP</div>
                  <div className="font-bold text-stone-200">{userStats.totalXP} XP</div>
                </div>
                <div className="p-2.5 rounded-xl bg-[#090B0E] border border-white/5">
                  <div className="text-stone-400">AI Chat Messages</div>
                  <div className="font-bold text-stone-200">{userStats.noorAiConversation?.length || 0} messages</div>
                </div>
              </div>
            </div>

            {/* Actions: Export Data & Clear AI History */}
            <div className="space-y-2">
              <button
                onClick={handleExportData}
                className="w-full py-3 px-4 rounded-2xl bg-[#C9A063]/15 hover:bg-[#C9A063]/25 border border-[#C9A063]/35 text-[#DFBA7F] font-semibold flex items-center justify-center gap-2 transition-all"
              >
                {copiedExport ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Download className="w-4 h-4" />}
                <span>{copiedExport ? 'Data Exported to Download File!' : 'Export My Data as JSON'}</span>
              </button>

              <button
                onClick={handleClearAiChatHistory}
                className="w-full py-3 px-4 rounded-2xl bg-[#12161D] hover:bg-stone-800/80 border border-white/10 text-stone-300 font-semibold flex items-center justify-center gap-2 transition-all"
              >
                {hasClearedChat ? <CheckCircle2 className="w-4 h-4 text-emerald-400" /> : <Trash2 className="w-4 h-4 text-stone-400" />}
                <span>{hasClearedChat ? 'AI Chat History Cleared' : 'Clear Noor AI Conversation History'}</span>
              </button>
            </div>
          </div>
        )}

        {/* Tab 3: Delete Account */}
        {activeTab === 'delete' && (
          <div className="overflow-y-auto space-y-4 pr-1 text-xs text-stone-300 no-scrollbar">
            <div className="p-4 rounded-2xl bg-red-500/10 border border-red-500/30 space-y-2">
              <div className="flex items-center gap-2 text-red-400 font-bold">
                <AlertTriangle className="w-5 h-5" />
                <span>Irreversible Account Deletion</span>
              </div>
              <p className="text-stone-300 text-[11px] leading-relaxed">
                Deleting your account will permanently purge your progress records, Qur'an bookmarks, learning XP, streaks, and saved duas from this device and our persistent database.
              </p>
            </div>

            <div className="space-y-2">
              <label className="block text-[11px] text-stone-400">
                To confirm, type <strong className="text-red-400">DELETE</strong> in the box below:
              </label>
              <input
                type="text"
                value={deleteConfirmText}
                onChange={(e) => setDeleteConfirmText(e.target.value)}
                placeholder="Type DELETE to confirm"
                className="w-full py-2.5 px-3.5 rounded-xl bg-[#12161D] border border-stone-700 text-stone-100 text-xs focus:outline-none focus:border-red-500"
              />

              <button
                disabled={deleteConfirmText.trim() !== 'DELETE'}
                onClick={handleDeleteAccountPermanent}
                className="w-full py-3 px-4 rounded-2xl bg-red-500 hover:bg-red-600 disabled:opacity-30 disabled:pointer-events-none text-white font-bold transition-all shadow-md mt-2 flex items-center justify-center gap-2"
              >
                <Trash2 className="w-4 h-4" />
                <span>Permanently Delete My Account & Data</span>
              </button>
            </div>
          </div>
        )}

        {/* Bottom Close */}
        <div className="pt-4 mt-auto border-t border-stone-800 shrink-0 flex justify-end">
          <button
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-stone-800 hover:bg-stone-700 text-stone-200 text-xs font-semibold transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};
