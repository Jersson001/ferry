import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { doc, updateDoc, arrayUnion, arrayRemove } from 'firebase/firestore';
import { storage, db, auth } from '../firebase';
import { PortfolioItem } from '../types';

const MAX_IMAGE_BYTES = 5 * 1024 * 1024;   // 5 MB
const MAX_VIDEO_BYTES = 30 * 1024 * 1024;  // 30 MB

export function validatePortfolioFile(file: File, type: 'image' | 'video'): string | null {
  if (type === 'image' && file.size > MAX_IMAGE_BYTES) return 'La imagen no puede superar 5 MB.';
  if (type === 'video' && file.size > MAX_VIDEO_BYTES) return 'El video no puede superar 30 MB.';
  return null;
}

export async function uploadPortfolioFile(file: File, type: 'image' | 'video'): Promise<string> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Debes iniciar sesión.');

  const timestamp = Date.now();
  const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
  const path = `users/${uid}/portfolio/${timestamp}_${safeName}`;
  const storageRef = ref(storage, path);

  await uploadBytes(storageRef, file);
  return getDownloadURL(storageRef);
}

export async function addPortfolioItem(item: PortfolioItem): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Debes iniciar sesión.');
  await updateDoc(doc(db, 'users', uid), { portfolio: arrayUnion(item) });
}

export async function removePortfolioItem(item: PortfolioItem): Promise<void> {
  const uid = auth.currentUser?.uid;
  if (!uid) throw new Error('Debes iniciar sesión.');

  // Remove from Firestore first
  await updateDoc(doc(db, 'users', uid), { portfolio: arrayRemove(item) });

  // Delete from Storage only if it's a Firebase Storage URL (not an external link)
  if ((item.type === 'image' || item.type === 'video') && item.url.includes('firebasestorage')) {
    try {
      const storageRef = ref(storage, item.url);
      await deleteObject(storageRef);
    } catch {
      // Non-blocking: if the file is already gone, silently continue
    }
  }
}
