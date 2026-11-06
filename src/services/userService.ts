import { doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from './firebase';
import { UserProfile } from '../types';

export class UserService {
  /**
   * Retrieves the user profile from Firestore path `/users/{uid}`
   */
  public async getUserProfile(uid: string): Promise<UserProfile | null> {
    const path = `users/${uid}`;
    try {
      const docRef = doc(db, 'users', uid);
      const snapshot = await getDoc(docRef);
      if (snapshot.exists()) {
        return snapshot.data() as UserProfile;
      }
      return null;
    } catch (error) {
      handleFirestoreError(error, OperationType.GET, path);
    }
  }

  /**
   * Creates initial profile document upon registration or Google sign-in
   */
  public async createUserProfile(
    uid: string,
    profileData: {
      fullName: string;
      email: string;
      emailVerified: boolean;
      photoURL?: string;
    }
  ): Promise<UserProfile> {
    const path = `users/${uid}`;
    const newProfile: UserProfile = {
      uid,
      fullName: profileData.fullName || profileData.email.split('@')[0],
      email: profileData.email,
      createdAt: new Date().toISOString(),
      emailVerified: profileData.emailVerified,
      photoURL: profileData.photoURL || '',
      preferences: {
        theme: 'dark',
        autoSyncTasks: true,
        defaultAgent: 'Supervisor Orchestrator',
        notificationsEnabled: true,
      },
    };

    try {
      const docRef = doc(db, 'users', uid);
      await setDoc(docRef, newProfile, { merge: true });
      return newProfile;
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    }
  }

  /**
   * Updates user profile fields or preferences
   */
  public async updateUserProfile(
    uid: string,
    updates: Partial<UserProfile>
  ): Promise<void> {
    const path = `users/${uid}`;
    try {
      const docRef = doc(db, 'users', uid);
      await updateDoc(docRef, {
        ...updates,
        updatedAt: new Date().toISOString(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  }
}

export const userService = new UserService();
