import { doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '../firebase';
import { UserProfile } from '../types';

export interface StoreProfileData {
  displayName: string;
  description: string;
  specialties: string[];
  rut?: string;
  photoURL?: string;
  location?: { lat: number; lng: number; address?: string };
}

/**
 * Saves (or updates) a store's public profile in the `stores` collection.
 * Always uses auth.currentUser.uid as the document ID so Firestore rules pass.
 */
export const saveStoreProfile = async (data: StoreProfileData): Promise<void> => {
  const uid = auth.currentUser?.uid;

  if (!uid) {
    throw new Error('El usuario no está autenticado. Inicia sesión e inténtalo de nuevo.');
  }

  const ref = doc(db, 'stores', uid);

  try {
    await setDoc(
      ref,
      {
        uid,
        displayName: data.displayName || '',
        description: data.description || '',
        specialties: data.specialties || [],
        rut: data.rut || '',
        photoURL: data.photoURL || '',
        location: data.location ?? null,
        updatedAt: serverTimestamp(),
      },
      { merge: true }
    );
  } catch (error: any) {
    console.error('Error exacto de Firebase:', error?.code, error?.message, error);
    throw error;
  }
};

/**
 * Builds a StoreProfileData payload from a UserProfile object.
 */
export const profileToStoreData = (profile: UserProfile): StoreProfileData => ({
  displayName: profile.displayName || '',
  description: profile.description || '',
  specialties: profile.specialties || [],
  rut: profile.rut,
  photoURL: profile.photoURL,
  location: profile.location,
});
