import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import {
  getAuth,
  Auth,
  GoogleAuthProvider,
  signInWithPopup,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  updateProfile,
  signOut,
  onAuthStateChanged,
  User as FirebaseUser,
  sendPasswordResetEmail,
} from 'firebase/auth';
import {
  getFirestore,
  Firestore,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  onSnapshot,
  serverTimestamp,
} from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';
import { UserStats } from '../types';

// Check if Firebase config is present and possesses real credentials
export const isFirebaseConfigValid = Boolean(
  firebaseConfig &&
  firebaseConfig.apiKey &&
  !firebaseConfig.apiKey.includes('dummy') &&
  !firebaseConfig.apiKey.includes('placeholder') &&
  !firebaseConfig.apiKey.startsWith('AIzaSyD-dummy')
);

// Initialize Firebase App singleton only when config is valid
export let app: FirebaseApp | null = null;
export let auth: Auth | null = null;
export let db: Firestore | null = null;

if (isFirebaseConfigValid) {
  try {
    app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
    auth = getAuth(app);
    db = getFirestore(app);
  } catch (err) {
    console.warn('Firebase initialization note:', err);
  }
}

export interface UserProfileDocument {
  id: string; // Auth UID
  email: string;
  displayName: string;
  photoURL?: string | null;
  authProvider: string;
  isNewUser: boolean;
  loginCount: number;
  createdAt: string;
  lastLoginAt: string;
  updatedAt: string;
  role: 'user' | 'admin';
  stats: UserStats;
}

export interface AuthResult {
  success: boolean;
  isNewUser?: boolean;
  user?: FirebaseUser;
  profile?: UserProfileDocument;
  stats?: UserStats;
  error?: string;
}

/**
 * Recognizes and syncs every user (new or old) with Firestore.
 * If user exists in /users/{userId}, loads their data and marks as returning user.
 * If user is brand new, creates their initial profile and zero-baseline stats.
 */
export async function syncAndRecognizeUser(
  firebaseUser: FirebaseUser,
  customName?: string,
  initialZeroStats?: UserStats
): Promise<AuthResult> {
  const uid = firebaseUser.uid;
  const email = firebaseUser.email || '';
  const displayName = customName || firebaseUser.displayName || email.split('@')[0] || 'Servant of Allah';
  const photoURL = firebaseUser.photoURL || null;
  const authProvider = firebaseUser.providerData?.[0]?.providerId || 'password';

  if (!db) {
    const fallbackStats: UserStats = {
      ...(initialZeroStats || ({} as UserStats)),
      accountId: uid,
      accountEmail: email,
      userName: displayName,
      isLoggedIn: true,
      hasCompletedWelcome: true,
    };
    return {
      success: true,
      isNewUser: false,
      user: firebaseUser,
      stats: fallbackStats,
    };
  }

  try {
    const userDocRef = doc(db, 'users', uid);
    const docSnap = await getDoc(userDocRef);

    const now = new Date().toISOString();

    if (docSnap.exists()) {
      // RETURNING / OLD USER DETECTED
      const existingData = docSnap.data() as UserProfileDocument;
      const newLoginCount = (existingData.loginCount || 1) + 1;

      const updatedProfile: UserProfileDocument = {
        ...existingData,
        displayName: existingData.displayName || displayName,
        photoURL: photoURL || existingData.photoURL,
        lastLoginAt: now,
        updatedAt: now,
        isNewUser: false,
        loginCount: newLoginCount,
      };

      // Save updated login metadata to Firestore
      try {
        await setDoc(userDocRef, {
          lastLoginAt: now,
          updatedAt: now,
          isNewUser: false,
          loginCount: newLoginCount,
        }, { merge: true });
      } catch (e) {
        console.warn('Could not update last login time in Firestore:', e);
      }

      const mergedStats: UserStats = {
        ...existingData.stats,
        accountId: uid,
        accountEmail: email,
        userName: updatedProfile.displayName,
        isLoggedIn: true,
        hasCompletedWelcome: true,
      };

      return {
        success: true,
        isNewUser: false,
        user: firebaseUser,
        profile: updatedProfile,
        stats: mergedStats,
      };
    } else {
      // BRAND NEW USER DETECTED
      const cleanZeroStats: UserStats = {
        ...(initialZeroStats || ({} as UserStats)),
        accountId: uid,
        accountEmail: email,
        userName: displayName,
        isLoggedIn: true,
        hasCompletedWelcome: false,
        overallStreak: 0,
        quranStreak: 0,
        learningStreak: 0,
        dhikrStreak: 0,
        completedLessonIds: [],
        quranPagesRead: 0,
        totalXP: 0,
        lessonsCompleted: 0,
        dhikrCount: 0,
        bookmarks: [],
        savedDuas: [],
        prayerHistory: [],
        unlockedAchievements: [],
        activityHistory: [],
        noorAiConversation: [],
      };

      const newProfile: UserProfileDocument = {
        id: uid,
        email,
        displayName,
        photoURL,
        authProvider,
        isNewUser: true,
        loginCount: 1,
        createdAt: now,
        lastLoginAt: now,
        updatedAt: now,
        role: 'user',
        stats: cleanZeroStats,
      };

      try {
        await setDoc(userDocRef, newProfile);
      } catch (e) {
        console.warn('Could not write new user profile to Firestore:', e);
      }

      return {
        success: true,
        isNewUser: true,
        user: firebaseUser,
        profile: newProfile,
        stats: cleanZeroStats,
      };
    }
  } catch (err: any) {
    console.error('Firestore user lookup error:', err);
    // Graceful offline fallback
    const fallbackStats: UserStats = {
      ...(initialZeroStats || ({} as UserStats)),
      accountId: uid,
      accountEmail: email,
      userName: displayName,
      isLoggedIn: true,
    };
    return {
      success: true,
      isNewUser: false,
      user: firebaseUser,
      stats: fallbackStats,
    };
  }
}

/**
 * Sign In with Google via Firebase Auth popup
 */
export async function signInWithGoogle(initialZeroStats?: UserStats): Promise<AuthResult> {
  if (!isFirebaseConfigValid || !auth) {
    return {
      success: false,
      error: 'Google Sign-In is unavailable in preview mode. Please sign in or create an account with Email.',
    };
  }

  try {
    const provider = new GoogleAuthProvider();
    provider.addScope('profile');
    provider.addScope('email');
    // Force Google Account Chooser so user can select their account
    provider.setCustomParameters({
      prompt: 'select_account',
    });

    const userCredential = await signInWithPopup(auth, provider);
    if (!userCredential || !userCredential.user) {
      return { success: false, error: 'Google sign in was not completed.' };
    }

    return await syncAndRecognizeUser(userCredential.user, undefined, initialZeroStats);
  } catch (err: any) {
    if (
      err.code === 'auth/popup-closed-by-user' ||
      err.code === 'auth/cancelled-popup-request' ||
      (err.message && err.message.includes('popup-closed-by-user'))
    ) {
      return { success: false, error: 'CANCELLED' };
    }
    if (
      err.code === 'auth/api-key-not-valid' ||
      err.code === 'auth/invalid-api-key' ||
      (err.message && err.message.includes('api-key-not-valid'))
    ) {
      return {
        success: false,
        error: 'Google Sign-In is currently in sandbox mode. Please sign in with Email & Password.',
      };
    }
    if (err.code === 'auth/popup-blocked') {
      return { success: false, error: 'Sign-in pop-up was blocked by your browser. Please allow pop-ups for this site and try again.' };
    }
    if (err.code === 'auth/network-request-failed') {
      return { success: false, error: 'Network connection issue. Please check your internet.' };
    }
    console.warn('Google Sign In notice:', err.message || err);
    return { success: false, error: err.message || 'Failed to sign in with Google.' };
  }
}

/**
 * Sign In with Email & Password via Firebase Auth
 */
export async function signInWithEmail(
  email: string,
  pass: string,
  initialZeroStats?: UserStats
): Promise<AuthResult> {
  if (!isFirebaseConfigValid || !auth) {
    return { success: false, error: 'FIREBASE_NOT_CONFIGURED' };
  }

  try {
    const userCredential = await signInWithEmailAndPassword(auth, email.trim(), pass);
    return await syncAndRecognizeUser(userCredential.user, undefined, initialZeroStats);
  } catch (err: any) {
    if (
      err.code === 'auth/api-key-not-valid' ||
      err.code === 'auth/invalid-api-key' ||
      (err.message && err.message.includes('api-key-not-valid'))
    ) {
      return { success: false, error: 'FIREBASE_NOT_CONFIGURED' };
    }
    console.warn('Email Sign In notice:', err.message || err);
    let msg = 'Invalid email or password.';
    if (err.code === 'auth/user-not-found') {
      msg = 'No account found with this email address.';
    } else if (err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
      msg = 'Incorrect password. Please try again.';
    } else if (err.code === 'auth/invalid-email') {
      msg = 'Invalid email format.';
    } else if (err.message) {
      msg = err.message;
    }
    return { success: false, error: msg };
  }
}

/**
 * Register a new user with Email & Password via Firebase Auth
 */
export async function registerWithEmail(
  name: string,
  email: string,
  pass: string,
  initialZeroStats?: UserStats
): Promise<AuthResult> {
  if (!isFirebaseConfigValid || !auth) {
    return { success: false, error: 'FIREBASE_NOT_CONFIGURED' };
  }

  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), pass);
    
    // Update Firebase Auth user display name
    try {
      await updateProfile(userCredential.user, {
        displayName: name.trim() || 'Servant of Allah',
      });
    } catch (e) {
      console.warn('Could not update profile display name:', e);
    }

    return await syncAndRecognizeUser(userCredential.user, name, initialZeroStats);
  } catch (err: any) {
    if (
      err.code === 'auth/api-key-not-valid' ||
      err.code === 'auth/invalid-api-key' ||
      (err.message && err.message.includes('api-key-not-valid'))
    ) {
      return { success: false, error: 'FIREBASE_NOT_CONFIGURED' };
    }
    console.warn('Register Email notice:', err.message || err);
    let msg = 'Failed to create account.';
    if (err.code === 'auth/email-already-in-use') {
      msg = 'An account with this email already exists. Please log in.';
    } else if (err.code === 'auth/weak-password') {
      msg = 'Password is too weak. Please use at least 6 characters.';
    } else if (err.code === 'auth/invalid-email') {
      msg = 'Please provide a valid email address.';
    } else if (err.message) {
      msg = err.message;
    }
    return { success: false, error: msg };
  }
}

/**
 * Send password reset email
 */
export async function sendPasswordReset(email: string): Promise<{ success: boolean; error?: string }> {
  if (!isFirebaseConfigValid || !auth) return { success: true };
  try {
    await sendPasswordResetEmail(auth, email.trim());
    return { success: true };
  } catch (err: any) {
    if (
      err.code === 'auth/api-key-not-valid' ||
      err.code === 'auth/invalid-api-key' ||
      (err.message && err.message.includes('api-key-not-valid'))
    ) {
      // In sandbox/local mode, proceed smoothly with the 6-digit OTP verification code flow
      return { success: true };
    }
    console.warn('Password reset notice:', err.message || err);
    return { success: false, error: err.message || 'Could not send reset email.' };
  }
}

/**
 * Sign out user from Firebase Auth
 */
export async function signOutUser(): Promise<void> {
  if (!auth) return;
  try {
    await signOut(auth);
  } catch (err) {
    console.warn('Sign out error:', err);
  }
}

/**
 * Persist user stats in Firestore document /users/{userId}
 */
export async function saveUserStatsToFirestore(uid: string, stats: UserStats): Promise<void> {
  if (!uid || !db) return;
  try {
    const userDocRef = doc(db, 'users', uid);
    await setDoc(
      userDocRef,
      {
        stats,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (err) {
    console.warn('Error saving stats to Firestore:', err);
  }
}

/**
 * Real-time listener for user document in Firestore
 */
export function subscribeToUserDocument(
  uid: string,
  onUpdate: (data: UserProfileDocument) => void
): () => void {
  if (!uid || !db) return () => {};
  try {
    const userDocRef = doc(db, 'users', uid);
    return onSnapshot(
      userDocRef,
      (snapshot) => {
        if (snapshot.exists()) {
          onUpdate(snapshot.data() as UserProfileDocument);
        }
      },
      (error) => {
        console.warn('Firestore subscription error:', error);
      }
    );
  } catch (e) {
    console.warn('Could not setup Firestore listener:', e);
    return () => {};
  }
}
