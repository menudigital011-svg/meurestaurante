export interface Restaurant {
  id: string;
  name: string;
  slogan?: string;
  logo: string;
  banner: string;
  bannerMode?: 'single' | 'carousel';
  banners?: string[];
  description: string;
  hours: string; // Legacy field, keeping for compatibility
  openingHours?: Record<string, { open: string; close: string; active: boolean }>;
  hoursObservation?: string;
  address: string;
  whatsapp: string;
  country?: string;
  primaryColor: string;
  rating: number;
  ownerUid?: string;
  paymentMethods?: {
    iban?: string;
    multicaixa?: string;
  };
  orderTypes?: {
    local?: boolean;
    counter?: boolean;
    delivery?: boolean;
    deliveryFees?: { city: string; fee: number }[];
  },
  socialLinks?: {
    facebook?: string;
    instagram?: string;
    tiktok?: string;
  };
  managerPin?: string;
  slug?: string;
  directCallPhone?: string;
}

export interface Category {
  id: string;
  name: string;
  order: number;
  icon?: string;
  image?: string;
}

export interface Product {
  id: string;
  name: string;
  description: string; // Descrição curta
  fullDescription?: string; // Descrição completa
  price: number;
  oldPrice?: number; // Para promoções
  image: string;
  categoryId: string;
  active: boolean;
  isPromotion?: boolean;
  isFeatured?: boolean;
  options?: { name: string; price: number }[];
}

export interface OrderItem {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  notes?: string;
}

export interface Order {
  id: string;
  customerName: string;
  customerPhone: string;
  customerAddress?: string;
  deliveryMethod: 'table' | 'counter' | 'delivery';
  tableNumber?: string;
  paymentMethod: 'delivery' | 'transfer';
  transferProof?: string;
  items: OrderItem[];
  total: number;
  tipAmount?: number;
  status: 'pending' | 'preparing' | 'delivered' | 'cancelled';
  createdAt: string;
}

export interface RestaurantTable {
  id: string;
  restaurantId: string;
  number: string;
  status: 'active' | 'inactive';
  qrCodeUrl?: string;
  createdAt: string;
}
