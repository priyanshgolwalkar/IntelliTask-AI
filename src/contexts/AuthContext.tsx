import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  User,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  signOut,
  sendPasswordResetEmail,
  sendEmailVerification,
  updateProfile,
  onAuthStateChanged,
  setPersistence,
  browserLocalPersistence,
  browserSessionPersistence,
} from 'firebase/auth';
import { auth } from '../services/firebase';
import { userService } from '../services/userService';
import { UserProfile } from '../types';

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  loading: boolean;
  error: string | null;
  login: (email: string, password: string, rememberMe?: boolean) => Promise<void>;
  register: (fullName: string, email: string, password: string) => Promise<void>;
  loginWithGoogle: () => Promise<void>;
  resetPassword: (email: string) => Promise<void>;
  sendVerification: () => Promise<void>;
  logout: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function getFriendlyAuthErrorMessage(errorCode: string): string {
  switch (errorCode) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
    case 'auth/user-not-found':
      return 'Invalid email or password. Please verify your credentials and try again.';
    case 'auth/email-already-in-use':
      return 'An account with this email address already exists. Please sign in instead.';
    case 'auth/invalid-email':
      return 'Please enter a valid email address.';
    case 'auth/weak-password':
      return 'Password should be at least 6 characters long and include numbers or symbols.';
    case 'auth/too-many-requests':
      return 'Access to this account has been temporarily disabled due to many failed login attempts. Try again later or reset your password.';
    case 'auth/popup-closed-by-user':
      return 'Google sign-in was closed before completion. Please try again.';
    case 'auth/network-request-failed':
      return 'Network connection error. Please check your internet connectivity.';
    case 'auth/requires-recent-login':
      return 'This action requires recent authentication. Please sign in again.';
    default:
      return 'An authentication error occurred. Please try again.';
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const clearError = () => setError(null);

  // Synchronize profile document whenever auth state changes
  const fetchAndSyncProfile = async (user: User | null) => {
    if (!user) {
      setUserProfile(null);
      return;
    }

    try {
      let profile = await userService.getUserProfile(user.uid);
      if (!profile) {
        // Create initial profile document if not found (e.g. initial Google sign-in)
        profile = await userService.createUserProfile(user.uid, {
          fullName: user.displayName || user.email?.split('@')[0] || 'IntelliTask User',
          email: user.email || '',
          emailVerified: user.emailVerified,
          photoURL: user.photoURL || undefined,
        });
      }
      setUserProfile(profile);
    } catch (err: any) {
      console.warn('Could not sync user profile from Firestore:', err);
      // Fallback local memory profile so user is not blocked
      setUserProfile({
        uid: user.uid,
        fullName: user.displayName || user.email?.split('@')[0] || 'IntelliTask User',
        email: user.email || '',
        createdAt: new Date().toISOString(),
        emailVerified: user.emailVerified,
        photoURL: user.photoURL || undefined,
      });
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (user) => {
      setCurrentUser(user);
      await fetchAndSyncProfile(user);
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  const login = async (email: string, password: string, rememberMe = true) => {
    setError(null);
    try {
      await setPersistence(
        auth,
        rememberMe ? browserLocalPersistence : browserSessionPersistence
      );
      const userCredential = await signInWithEmailAndPassword(auth, email.trim(), password);
      await fetchAndSyncProfile(userCredential.user);
    } catch (err: any) {
      const message = getFriendlyAuthErrorMessage(err.code || '');
      setError(message);
      throw new Error(message);
    }
  };

  const register = async (fullName: string, email: string, password: string) => {
    setError(null);
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email.trim(), password);
      const user = userCredential.user;

      // Update displayName in Firebase Auth
      await updateProfile(user, { displayName: fullName.trim() });

      // Create user profile in Firestore
      const profile = await userService.createUserProfile(user.uid, {
        fullName: fullName.trim(),
        email: user.email || email.trim(),
        emailVerified: user.emailVerified,
      });
      setUserProfile(profile);

      // Attempt to send verification email
      try {
        await sendEmailVerification(user);
      } catch (e) {
        console.warn('Optional verification email send failed:', e);
      }
    } catch (err: any) {
      const message = getFriendlyAuthErrorMessage(err.code || '');
      setError(message);
      throw new Error(message);
    }
  };

  const loginWithGoogle = async () => {
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      // Ensure popup prompt allows clean account selection
      provider.setCustomParameters({ prompt: 'select_account' });
      const result = await signInWithPopup(auth, provider);
      await fetchAndSyncProfile(result.user);
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') {
        // User voluntarily closed popup
        return;
      }
      const message = getFriendlyAuthErrorMessage(err.code || '');
      setError(message);
      throw new Error(message);
    }
  };

  const resetPassword = async (email: string) => {
    setError(null);
    try {
      await sendPasswordResetEmail(auth, email.trim());
    } catch (err: any) {
      const message = getFriendlyAuthErrorMessage(err.code || '');
      setError(message);
      throw new Error(message);
    }
  };

  const sendVerification = async () => {
    if (!currentUser) return;
    try {
      await sendEmailVerification(currentUser);
    } catch (err: any) {
      const message = getFriendlyAuthErrorMessage(err.code || '');
      setError(message);
      throw new Error(message);
    }
  };

  const logout = async () => {
    setError(null);
    try {
      await signOut(auth);
      setCurrentUser(null);
      setUserProfile(null);
    } catch (err: any) {
      setError(err.message || 'Logout failed');
      throw err;
    }
  };

  const refreshProfile = async () => {
    if (currentUser) {
      await fetchAndSyncProfile(currentUser);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        userProfile,
        loading,
        error,
        login,
        register,
        loginWithGoogle,
        resetPassword,
        sendVerification,
        logout,
        refreshProfile,
        clearError,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
