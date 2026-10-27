import { UserAccount, UserStats } from '../types';
import {
  signInWithGoogle as fbSignInWithGoogle,
  signInWithEmail as fbSignInWithEmail,
  registerWithEmail as fbRegisterWithEmail,
  signOutUser as fbSignOutUser,
  saveUserStatsToFirestore,
  sendPasswordReset as fbSendPasswordReset,
  AuthResult,
} from '../lib/firebase';

const ACCOUNTS_STORAGE_KEY = 'noor_accounts_cloud_db';
const ACTIVE_SESSION_KEY = 'noor_active_session_id';

/**
 * Securely hashes a password using Web Crypto API SHA-256 for local fallback
 */
export async function hashPassword(password: string): Promise<string> {
  const encoder = new TextEncoder();
  const data = encoder.encode(password + '_noor_salt_v1');
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('');
}

/**
 * Retrieves all registered accounts from local store
 */
export function getAllAccounts(): Record<string, UserAccount> {
  try {
    const raw = localStorage.getItem(ACCOUNTS_STORAGE_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

/**
 * Saves all accounts back to the local registry
 */
function saveAllAccounts(accounts: Record<string, UserAccount>): void {
  localStorage.setItem(ACCOUNTS_STORAGE_KEY, JSON.stringify(accounts));
}

/**
 * Creates or registers a user account via Firebase with fallback
 */
export async function registerAccount(
  name: string,
  email: string,
  password: string,
  initialZeroStats: UserStats
): Promise<{ success: boolean; account?: UserAccount; isNewUser?: boolean; error?: string }> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@')) {
    return { success: false, error: 'Please enter a valid email address.' };
  }
  if (!password || password.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters.' };
  }

  // 1. Try Firebase Auth + Firestore
  try {
    const fbRes = await fbRegisterWithEmail(name, cleanEmail, password, initialZeroStats);
    if (fbRes.success && fbRes.stats) {
      const accountId = fbRes.user?.uid || `user_${Date.now()}`;
      const now = new Date().toISOString();
      const newAccount: UserAccount = {
        id: accountId,
        email: cleanEmail,
        name: name.trim() || 'Servant of Allah',
        createdAt: now,
        updatedAt: now,
        stats: fbRes.stats,
      };

      const accounts = getAllAccounts();
      accounts[accountId] = newAccount;
      saveAllAccounts(accounts);
      localStorage.setItem(ACTIVE_SESSION_KEY, accountId);

      return { success: true, account: newAccount, isNewUser: fbRes.isNewUser ?? true };
    } else if (fbRes.error) {
      // If Firebase returns a specific error (e.g. email already exists), bubble it up
      if (fbRes.error.includes('already exists') || fbRes.error.includes('invalid-email')) {
        return { success: false, error: fbRes.error };
      }
    }
  } catch (e) {
    console.warn('Firebase registration error, using local fallback:', e);
  }

  // 2. Local fallback storage
  const accounts = getAllAccounts();
  const existing = Object.values(accounts).find((a) => a.email.toLowerCase() === cleanEmail);
  if (existing) {
    return { success: false, error: 'An account with this email already exists. Please sign in.' };
  }

  const accountId = `user_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
  const passwordHash = await hashPassword(password);
  const now = new Date().toISOString();

  const cleanZeroStats: UserStats = {
    ...initialZeroStats,
    accountId,
    accountEmail: cleanEmail,
    userName: name.trim() || 'Servant of Allah',
    isLoggedIn: true,
    overallStreak: 0,
    quranStreak: 0,
    learningStreak: 0,
    dhikrStreak: 0,
    completedLessonIds: [],
    quranPagesRead: 0,
    dhikrCount: 0,
    totalXP: 0,
    lessonsCompleted: 0,
    bookmarks: [],
    savedDuas: [],
    prayerHistory: [],
    unlockedAchievements: [],
    activityHistory: [],
    noorAiConversation: [],
  };

  const newAccount: UserAccount = {
    id: accountId,
    email: cleanEmail,
    name: name.trim() || 'Servant of Allah',
    passwordHash,
    createdAt: now,
    updatedAt: now,
    stats: cleanZeroStats,
  };

  accounts[accountId] = newAccount;
  saveAllAccounts(accounts);
  localStorage.setItem(ACTIVE_SESSION_KEY, accountId);

  return { success: true, account: newAccount, isNewUser: true };
}

/**
 * Authenticates an existing user via Firebase Auth or local registry
 */
export async function authenticateAccount(
  email: string,
  password: string,
  initialZeroStats?: UserStats
): Promise<{ success: boolean; account?: UserAccount; isNewUser?: boolean; error?: string }> {
  const cleanEmail = email.trim().toLowerCase();

  // 1. Try Firebase Auth + Firestore
  try {
    const fbRes = await fbSignInWithEmail(cleanEmail, password, initialZeroStats);
    if (fbRes.success && fbRes.stats) {
      const accountId = fbRes.user?.uid || `user_${Date.now()}`;
      const now = new Date().toISOString();
      const account: UserAccount = {
        id: accountId,
        email: cleanEmail,
        name: fbRes.profile?.displayName || fbRes.stats.userName || 'Servant of Allah',
        createdAt: fbRes.profile?.createdAt || now,
        updatedAt: now,
        stats: fbRes.stats,
      };

      const accounts = getAllAccounts();
      accounts[accountId] = account;
      saveAllAccounts(accounts);
      localStorage.setItem(ACTIVE_SESSION_KEY, accountId);

      return { success: true, account, isNewUser: fbRes.isNewUser ?? false };
    } else if (fbRes.error && (fbRes.error.includes('Incorrect') || fbRes.error.includes('No account'))) {
      // Check local DB if Firebase fails with invalid credentials
      const accounts = getAllAccounts();
      const localAccount = Object.values(accounts).find((a) => a.email.toLowerCase() === cleanEmail);
      if (localAccount) {
        const inputHash = await hashPassword(password);
        if (localAccount.passwordHash === inputHash) {
          localStorage.setItem(ACTIVE_SESSION_KEY, localAccount.id);
          return { success: true, account: localAccount, isNewUser: false };
        }
      }
      return { success: false, error: fbRes.error };
    }
  } catch (e) {
    console.warn('Firebase login error, checking local storage:', e);
  }

  // 2. Local fallback verification
  const accounts = getAllAccounts();
  const account = Object.values(accounts).find((a) => a.email.toLowerCase() === cleanEmail);
  if (!account) {
    return { success: false, error: 'No account found with this email address.' };
  }

  const inputHash = await hashPassword(password);
  if (account.passwordHash && account.passwordHash !== inputHash) {
    return { success: false, error: 'Incorrect password. Please try again.' };
  }

  localStorage.setItem(ACTIVE_SESSION_KEY, account.id);
  return { success: true, account, isNewUser: false };
}

/**
 * Sign In with Google via Firebase Auth popup
 */
export async function authenticateWithGoogle(
  initialZeroStats?: UserStats
): Promise<{ success: boolean; account?: UserAccount; isNewUser?: boolean; cancelled?: boolean; error?: string }> {
  try {
    const res = await fbSignInWithGoogle(initialZeroStats);

    if (res.error === 'CANCELLED') {
      return { success: false, cancelled: true, error: 'Sign in was cancelled.' };
    }

    if (res.success && res.user && res.stats) {
      const accountId = res.user.uid;
      const email = res.user.email || '';
      const name =
        res.profile?.displayName ||
        res.user.displayName ||
        (email ? email.split('@')[0] : 'Servant of Allah');
      const now = new Date().toISOString();

      const account: UserAccount = {
        id: accountId,
        email,
        name,
        authProvider: 'google.com',
        createdAt: res.profile?.createdAt || now,
        updatedAt: now,
        stats: {
          ...res.stats,
          accountId,
          accountEmail: email,
          userName: name,
          isLoggedIn: true,
        },
      };

      const accounts = getAllAccounts();
      accounts[accountId] = account;
      saveAllAccounts(accounts);
      localStorage.setItem(ACTIVE_SESSION_KEY, accountId);

      return { success: true, account, isNewUser: res.isNewUser ?? false };
    }
    return { success: false, error: res.error || 'Google authentication could not be completed.' };
  } catch (e: any) {
    console.error('authenticateWithGoogle error:', e);
    return { success: false, error: e?.message || 'Google authentication was interrupted.' };
  }
}

// Cache and debounce mechanism to prevent redundant database writes
let lastSyncedStatsHash: Record<string, string> = {};
let pendingFirestoreTimer: any = null;
let pendingStatsToSync: { accountId: string; stats: UserStats } | null = null;

function getStatsSnapshotHash(stats: UserStats): string {
  // Generate lightweight signature of critical persisted fields
  return JSON.stringify({
    xp: stats.totalXP,
    streak: stats.overallStreak,
    qStreak: stats.quranStreak,
    lStreak: stats.learningStreak,
    dStreak: stats.dhikrStreak,
    dhikrCount: stats.dhikrCount,
    lastSurah: stats.lastReadSurah,
    lastAyah: stats.lastReadAyah,
    pagesRead: stats.quranPagesRead,
    lessonsCount: stats.completedLessonIds?.length || 0,
    bookmarksCount: stats.bookmarks?.length || 0,
    savedDuasCount: stats.savedDuas?.length || 0,
    loc: stats.userLocation,
    notif: stats.notificationsEnabled,
    calcMethod: stats.prayerCalculationMethod,
    asr: stats.asrJuristicMethod,
    theme: stats.themePreference,
    name: stats.userName,
    sessionsCount: stats.noorAiSessions?.length || 0,
  });
}

/**
 * Flushes any pending debounced Firestore writes immediately
 */
export function flushPendingSync(): void {
  if (pendingFirestoreTimer) {
    clearTimeout(pendingFirestoreTimer);
    pendingFirestoreTimer = null;
  }
  if (pendingStatsToSync) {
    const { accountId, stats } = pendingStatsToSync;
    pendingStatsToSync = null;
    saveUserStatsToFirestore(accountId, stats);
  }
}

/**
 * Syncs the in-memory stats to Firestore and local persistent account with smart deduplication & debouncing
 */
export function syncAccountData(accountId: string, stats: UserStats, immediate = false): void {
  if (!accountId) return;

  const currentHash = getStatsSnapshotHash(stats);
  const previousHash = lastSyncedStatsHash[accountId];

  // If exact duplicate of already synced state, skip all writes completely
  if (previousHash === currentHash && !immediate) {
    return;
  }

  lastSyncedStatsHash[accountId] = currentHash;

  // 1. Sync to local storage immediately (instant local persistence)
  try {
    const accounts = getAllAccounts();
    if (accounts[accountId]) {
      accounts[accountId].stats = {
        ...stats,
        accountId,
        isLoggedIn: true,
      };
      accounts[accountId].updatedAt = new Date().toISOString();
      saveAllAccounts(accounts);
    }
  } catch (err) {
    console.warn('Local account write note:', err);
  }

  // 2. Sync to Firestore: Debounce rapid changes (e.g. rapid Dhikr clicking) or write immediately if critical
  pendingStatsToSync = { accountId, stats };

  if (immediate) {
    flushPendingSync();
  } else {
    if (pendingFirestoreTimer) {
      clearTimeout(pendingFirestoreTimer);
    }
    pendingFirestoreTimer = setTimeout(() => {
      flushPendingSync();
    }, 600); // 600ms trailing debounce avoids database spam
  }
}

/**
 * Gets the active user account session if one exists
 */
export function getActiveSession(): UserAccount | null {
  try {
    const activeId = localStorage.getItem(ACTIVE_SESSION_KEY);
    if (!activeId) return null;
    const accounts = getAllAccounts();
    return accounts[activeId] || null;
  } catch {
    return null;
  }
}

/**
 * Logs out the active user
 */
export function logoutAccount(): void {
  localStorage.removeItem(ACTIVE_SESSION_KEY);
  fbSignOutUser();
}

/**
 * Checks whether an email address is registered to a Noor account
 */
export function isAccountRegistered(email: string): boolean {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail) return false;
  const accounts = getAllAccounts();
  return Object.values(accounts).some((a) => a.email && a.email.toLowerCase() === cleanEmail);
}

/**
 * In-memory secure password reset session management
 */
interface PasswordResetSession {
  email: string;
  hashedOtp: string;
  expiresAt: number;
  attemptsLeft: number;
  resendAvailableAt: number;
  verified: boolean;
  resetToken?: string;
  resetTokenExpiresAt?: number;
}

const activeResetSessions = new Map<string, PasswordResetSession>();

/**
 * Requests a 6-digit OTP verification code for password reset
 */
export async function requestPasswordResetOtp(
  email: string
): Promise<{ success: boolean; notFound?: boolean; message: string; cooldownSeconds: number; previewCode?: string; error?: string }> {
  const cleanEmail = email.trim().toLowerCase();
  if (!cleanEmail || !cleanEmail.includes('@') || cleanEmail.length < 5) {
    return { success: false, error: 'Please enter a valid email address.', message: '', cooldownSeconds: 0 };
  }

  // STEP 2: Check authentication system to determine whether the email belongs to a registered Noor account
  const registered = isAccountRegistered(cleanEmail);
  if (!registered) {
    return {
      success: false,
      notFound: true,
      error: "We couldn't find a Noor account with that email.",
      message: '',
      cooldownSeconds: 0,
    };
  }

  // Check cooldown if existing session
  const existing = activeResetSessions.get(cleanEmail);
  const now = Date.now();
  if (existing && existing.resendAvailableAt > now) {
    const remainingSecs = Math.ceil((existing.resendAvailableAt - now) / 1000);
    return {
      success: false,
      error: `Please wait ${remainingSecs}s before requesting a new code.`,
      message: '',
      cooldownSeconds: remainingSecs,
    };
  }

  // 1. Dispatch real email via server API
  try {
    const apiRes = await fetch('/api/send-verification-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail }),
    });

    const data = await apiRes.json().catch(() => ({}));
    if (!apiRes.ok || !data.success) {
      return {
        success: false,
        error: data.error || "We couldn't send the verification email right now. Please try again.",
        cooldownSeconds: data.cooldownSeconds || 0,
        message: '',
      };
    }

    // 2. Dispatch official Firebase password reset email in background (if configured)
    try {
      fbSendPasswordReset(cleanEmail).catch(() => {});
    } catch {
      // Non-blocking
    }

    // Update client tracking for resend cooldown
    activeResetSessions.set(cleanEmail, {
      email: cleanEmail,
      hashedOtp: '',
      expiresAt: now + 10 * 60 * 1000,
      attemptsLeft: 5,
      resendAvailableAt: now + 30 * 1000,
      verified: false,
    });

    // Return success without exposing the OTP to Noor
    return {
      success: true,
      message: 'We sent a verification code to your email.',
      cooldownSeconds: data.cooldownSeconds || 30,
    };
  } catch {
    return {
      success: false,
      error: "We couldn't send the verification email right now. Please try again.",
      message: '',
      cooldownSeconds: 0,
    };
  }
}

/**
 * Verifies the 6-digit OTP code submitted by the user
 */
export async function verifyPasswordResetOtp(
  email: string,
  enteredCode: string
): Promise<{ success: boolean; resetToken?: string; error?: string; expired?: boolean }> {
  const cleanEmail = email.trim().toLowerCase();
  const cleanCode = enteredCode.trim().replace(/\s+/g, '');

  if (!cleanCode || cleanCode.length !== 6) {
    return { success: false, error: 'Please enter the complete 6-digit verification code.' };
  }

  // 1. Server verification
  try {
    const apiRes = await fetch('/api/verify-verification-code', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, code: cleanCode }),
    });
    const data = await apiRes.json().catch(() => ({}));
    if (apiRes.ok && data.success && data.resetToken) {
      const existing = activeResetSessions.get(cleanEmail);
      if (existing) {
        existing.verified = true;
        existing.resetToken = data.resetToken;
      }
      return { success: true, resetToken: data.resetToken };
    } else if (data.expired) {
      return { success: false, expired: true, error: data.error || 'That verification code has expired.' };
    } else {
      return { success: false, error: data.error || 'That verification code is incorrect.' };
    }
  } catch {
    return { success: false, error: 'Connection error while verifying code. Please try again.' };
  }
}

/**
 * Completes the password reset by saving the new password hash
 * STRICTLY PRESERVES all existing account data and progress
 */
export async function completePasswordReset(
  email: string,
  resetToken: string,
  newPassword: string
): Promise<{ success: boolean; error?: string }> {
  const cleanEmail = email.trim().toLowerCase();

  if (!newPassword || newPassword.length < 6) {
    return { success: false, error: 'Password must be at least 6 characters.' };
  }

  // 1. Notify server endpoint
  try {
    const apiRes = await fetch('/api/complete-reset-password', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: cleanEmail, resetToken, newPassword }),
    });
    const data = await apiRes.json().catch(() => ({}));
    if (!apiRes.ok || !data.success) {
      return {
        success: false,
        error: data.error || 'Password reset session is invalid or expired. Please start over.',
      };
    }
  } catch {
    return { success: false, error: 'Network error occurred while saving password. Please try again.' };
  }

  const newHash = await hashPassword(newPassword);

  // Update password hash in local registry while preserving ALL data
  const accounts = getAllAccounts();
  const account = Object.values(accounts).find((a) => a.email.toLowerCase() === cleanEmail);

  if (account) {
    account.passwordHash = newHash;
    account.updatedAt = new Date().toISOString();
    accounts[account.id] = account;
    saveAllAccounts(accounts);
  }

  // Invalidate reset session
  activeResetSessions.delete(cleanEmail);

  return { success: true };
}

/**
 * Resets an account password (legacy compatibility wrapper)
 */
export async function resetPassword(
  email: string,
  newPassword?: string
): Promise<{ success: boolean; error?: string }> {
  const cleanEmail = email.trim().toLowerCase();

  // Try Firebase reset email
  try {
    await fbSendPasswordReset(cleanEmail);
  } catch (e) {
    console.warn('Firebase reset email note:', e);
  }

  // If local password provided, update local hash
  if (newPassword) {
    const accounts = getAllAccounts();
    const account = Object.values(accounts).find((a) => a.email.toLowerCase() === cleanEmail);
    if (account) {
      account.passwordHash = await hashPassword(newPassword);
      account.updatedAt = new Date().toISOString();
      accounts[account.id] = account;
      saveAllAccounts(accounts);
    }
  }

  return { success: true };
}

/**
 * Permanently deletes an account and all its associated data
 */
export function deleteAccount(accountId: string): boolean {
  const accounts = getAllAccounts();
  if (accounts[accountId]) {
    delete accounts[accountId];
    saveAllAccounts(accounts);
    if (localStorage.getItem(ACTIVE_SESSION_KEY) === accountId) {
      localStorage.removeItem(ACTIVE_SESSION_KEY);
    }
    return true;
  }
  return false;
}

/**
 * Exports user data as formatted JSON string for download/inspection
 */
export function exportUserDataJSON(stats: UserStats): string {
  const exportData = {
    app: 'NOOR Islamic Companion',
    exportDate: new Date().toISOString(),
    account: {
      id: stats.accountId || 'guest',
      email: stats.accountEmail || 'none',
      name: stats.userName,
    },
    preferences: {
      language: stats.language,
      location: stats.userLocation,
      prayerCalculationMethod: stats.prayerCalculationMethod,
      asrMadhab: stats.asrJuristicMethod,
      notifications: stats.notificationsEnabled,
      personalization: stats.personalization,
    },
    progress: {
      overallStreak: stats.overallStreak,
      quranStreak: stats.quranStreak,
      learningStreak: stats.learningStreak,
      quranPagesRead: stats.quranPagesRead,
      totalXP: stats.totalXP,
      lessonsCompleted: stats.lessonsCompleted,
      dhikrCount: stats.dhikrCount,
      bookmarksCount: stats.bookmarks.length,
      savedDuasCount: stats.savedDuas.length,
      achievementsUnlocked: stats.unlockedAchievements.length,
    },
    bookmarks: stats.bookmarks,
    savedDuas: stats.savedDuas,
    noorAiConversationsCount: stats.noorAiConversation?.length || 0,
  };
  return JSON.stringify(exportData, null, 2);
}

/**
 * Validates admin password securely against the server backend.
 * Never stores or reveals password in client-side code.
 */
export async function authenticateAdmin(
  password: string
): Promise<{
  success: boolean;
  user?: { id: string; name: string; role: 'admin'; email: string };
  token?: string;
  error?: string;
}> {
  try {
    const res = await fetch('/api/auth/admin-login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    });

    const data = await res.json().catch(() => ({}));
    if (res.ok && data.success) {
      if (data.token) {
        sessionStorage.setItem('noor_admin_token', data.token);
      }
      return {
        success: true,
        user: data.user || { id: 'admin_everyone', name: 'Everyone', role: 'admin', email: 'admin@nafisnoor.app' },
        token: data.token,
      };
    }

    return {
      success: false,
      error: data.error || 'Invalid admin credentials.',
    };
  } catch {
    return {
      success: false,
      error: 'Unable to connect to administration verification service.',
    };
  }
}

/**
 * Creates and registers the active Admin session ("Everyone")
 */
export function createAdminSession(initialZeroStats: UserStats): UserStats {
  const adminStats: UserStats = {
    ...initialZeroStats,
    accountId: 'admin_everyone',
    accountEmail: 'admin@nafisnoor.app',
    userName: 'Everyone',
    role: 'admin',
    isGuest: false,
    isLoggedIn: true,
    hasCompletedWelcome: true,
  };

  const adminAccount: UserAccount = {
    id: 'admin_everyone',
    name: 'Everyone',
    email: 'admin@nafisnoor.app',
    role: 'admin',
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    stats: adminStats,
  };

  const accounts = getAllAccounts();
  accounts['admin_everyone'] = adminAccount;
  saveAllAccounts(accounts);
  localStorage.setItem(ACTIVE_SESSION_KEY, 'admin_everyone');

  return adminStats;
}

/**
 * Generates an ephemeral, safe guest session without creating fake account data
 */
export function createGuestSession(initialZeroStats: UserStats): UserStats {
  // Clear any existing active account ID so we do not pretend the guest has an account
  localStorage.removeItem(ACTIVE_SESSION_KEY);

  const guestStats: UserStats = {
    ...initialZeroStats,
    userName: 'Guest',
    role: 'guest',
    isGuest: true,
    isLoggedIn: true,
    hasCompletedWelcome: true,
    accountId: undefined,
    accountEmail: undefined,
  };

  return guestStats;
}

