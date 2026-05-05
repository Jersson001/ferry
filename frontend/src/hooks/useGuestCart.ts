import { MaterialItem } from '../types';

const STORAGE_KEY = 'ferry_guest_cart';
const EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 horas

export interface GuestCart {
  items: MaterialItem[];
  selectedCategory: string | null;
  deliveryAddress: string;
  quoteTitle: string;
  savedAt: number;
}

export const saveGuestCart = (cart: Omit<GuestCart, 'savedAt'>): void => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...cart, savedAt: Date.now() }));
  } catch {
    // localStorage no disponible (modo privado, cuota llena)
  }
};

export const loadGuestCart = (): GuestCart | null => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const cart = JSON.parse(raw) as GuestCart;
    if (Date.now() - cart.savedAt > EXPIRY_MS) {
      localStorage.removeItem(STORAGE_KEY);
      return null;
    }
    return cart.items?.length > 0 ? cart : null;
  } catch {
    return null;
  }
};

export const clearGuestCart = (): void => {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
};
