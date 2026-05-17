
export interface PortfolioItem {
  id: string;
  type: 'image' | 'video' | 'link';
  url: string;
  description: string;
  createdAt: any; // Firestore Timestamp
}

export interface UserProfile {
  uid: string;
  email?: string;
  phoneNumber?: string;
  role: UserRole;
  displayName?: string;
  photoURL?: string;
  rut?: string;
  description?: string;
  specialties?: string[];
  portfolio?: PortfolioItem[];
  createdAt: any; // Firestore Timestamp
  isEmailVerified?: boolean;
  isProfileComplete?: boolean;
  location?: {
    lat: number;
    lng: number;
    address?: string;
  };
}


export enum UserRole {
  USER = 'USER', // Merged Client + Contractor
  ADMIN = 'ADMIN', // "God Mode"
  STORE = 'STORE'
}

export interface MaterialItem {
  name: string;
  quantity: string;
  unit: string;
  nombreComercial?: string;
  medidaNominal?: string;
  caracteristica?: string;
  tipoCorredera?: string;
  observacion?: string;
}

export interface QuoteLineItem {
  name: string;
  quantity: string;
  unit: string;
  status: 'AVAILABLE' | 'MISSING';
  price?: number; // Unit price * quantity
}

export interface Quote {
  id: string;
  storeName: string;
  totalPrice: number;
  deliveryTime: string;
  availability: string; // e.g., "5/5 ítems"
  rating: number;
  includesTransport: boolean;
  itemsDetails: QuoteLineItem[]; // New detailed breakdown
}

export enum RequestStatus {
  DRAFT = 'DRAFT',
  PENDING_QUOTES = 'PENDING_QUOTES',
  QUOTED = 'QUOTED',
  PAID = 'PAID',
  DELIVERED = 'DELIVERED'
}

export interface MaterialRequest {
  id: string;
  title: string;
  date: string;
  category?: string; // New field for specialty filter
  items: MaterialItem[];
  status: RequestStatus;
  quotes: Quote[];
  selectedQuoteId?: string;
  imageUrl?: string; // Base64 of the uploaded list
}

export interface Project {
  id: string;
  title: string;
  location: string;
  description: string;
  budget: string;
  isUrgent: boolean;
  category: 'Plomería' | 'Eléctricos' | 'Depósito' | 'Pintura' | 'Carpintería' | 'Iluminación' | 'Cerrajería' | 'Gas' | 'Estructural';
  postedBy: string;
  status: 'OPEN' | 'IN_PROGRESS' | 'COMPLETED';
}

export interface Review {
  id: string;
  author: string;
  rating: number;
  comment: string;
  date: string;
}

export interface Reference {
  id: string;
  name: string;
  role: string;
  phone: string;
  comment: string;
}

export interface ContractorProfile {
  id: string;
  name: string;
  role: string;
  isVerified: boolean;
  rating: number;
  completedJobs: number;
  yearsExperience: number;
  bio: string;
  skills: string[];
  portfolioImages: string[];
  reviews: Review[];
  references?: Reference[];
}

export interface Product {
  id: string;
  storeId: string;
  name: string;
  price: number;
  stock: number;
  category: string;
  description: string;
  image: string;
  lat?: number;
  lng?: number;
}
