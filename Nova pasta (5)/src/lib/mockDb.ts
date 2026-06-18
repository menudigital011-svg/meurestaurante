import { Restaurant, Category, Product, Order } from '../types';

// Mock data for initial development
export const MOCK_RESTAURANT: Restaurant = {
  id: 'default',
  name: 'Gourmet Haven',
  slogan: 'Sabor que conquista',
  logo: 'https://picsum.photos/seed/restaurant-logo/200/200',
  banner: 'https://picsum.photos/seed/restaurant-banner/1920/1080',
  bannerMode: 'single',
  banners: [],
  description: 'A experiência gastronômica definitiva com ingredientes frescos e selecionados.',
  hours: '11:00 - 23:00',
  openingHours: {
    'Segunda-feira': { open: '11:00', close: '23:00', active: true },
    'Terça-feira': { open: '11:00', close: '23:00', active: true },
    'Quarta-feira': { open: '11:00', close: '23:00', active: true },
    'Quinta-feira': { open: '11:00', close: '23:00', active: true },
    'Sexta-feira': { open: '11:00', close: '23:00', active: true },
    'Sábado': { open: '11:00', close: '23:00', active: true },
    'Domingo': { open: '11:00', close: '20:00', active: true },
  },
  hoursObservation: 'Feriados: horário reduzido',
  address: 'Av. Direita da Samba, Luanda',
  whatsapp: '244932456234',
  country: 'Angola (KZ)',
  primaryColor: '#e11d48',
  rating: 4.8,
  paymentMethods: {
    iban: 'AO06 0055 0000 1234 5678 9123 5',
    multicaixa: '932 456 234'
  },
  orderTypes: {
    local: true,
    counter: true,
    delivery: true
  },
  socialLinks: {
    facebook: '',
    instagram: '',
    tiktok: ''
  }
};

export const MOCK_CATEGORIES: Category[] = [
  { id: 'cat1', name: 'Pratos Principais', order: 1, image: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?q=80&w=400&auto=format&fit=crop' },
  { id: 'cat2', name: 'Bebidas', order: 2, image: 'https://images.unsplash.com/photo-1513558161293-cdaf765ed2fd?q=80&w=400&auto=format&fit=crop' },
  { id: 'cat3', name: 'Sobremesas', order: 3, image: 'https://images.unsplash.com/photo-1488477181946-6428a0291777?q=80&w=400&auto=format&fit=crop' },
];

export const MOCK_PRODUCTS: Product[] = [
  {
    id: 'p1',
    name: 'Bruschetta Italiana',
    description: 'Pão artesanal tostado com tomates frescos, manjericão e azeite extra virgem.',
    price: 4500,
    image: 'https://images.unsplash.com/photo-1572656631137-7935297eff55?q=80&w=1000&auto=format&fit=crop',
    categoryId: 'cat1',
    active: true
  },
  {
    id: 'p2',
    name: 'Risoto de Cogumelos',
    description: 'Arroz arbóreo cremoso com mix de cogumelos frescos e finalizado com trufas.',
    price: 12500,
    image: 'https://images.unsplash.com/photo-1476124369491-e7addf5db371?q=80&w=1000&auto=format&fit=crop',
    categoryId: 'cat1',
    active: true
  },
  {
    id: 'p3',
    name: 'Petit Gâteau',
    description: 'Bolo de chocolate com recheio cremoso, servido com sorvete de baunilha.',
    price: 5500,
    image: 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?q=80&w=1000&auto=format&fit=crop',
    categoryId: 'cat3',
    active: true
  },
  {
    id: 'p4',
    name: 'Suco Natural de Laranja',
    description: 'Suco 100% natural, espremido na hora.',
    price: 2500,
    image: 'https://images.unsplash.com/photo-1613478223719-2ab802602423?q=80&w=1000&auto=format&fit=crop',
    categoryId: 'cat2',
    active: true
  }
];

// Mock Firestore Service
export const db = {
  getRestaurant: async () => MOCK_RESTAURANT,
  getCategories: async () => MOCK_CATEGORIES,
  getProducts: async () => MOCK_PRODUCTS,
  getOrders: async () => [] as Order[],
  saveOrder: async (order: Omit<Order, 'id'>) => {
    console.log('Order saved:', order);
    return { id: Math.random().toString(36).substr(2, 9) };
  }
};
