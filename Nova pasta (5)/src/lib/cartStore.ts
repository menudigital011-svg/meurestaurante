import { create } from 'zustand';
import { OrderItem } from '../types';

interface CartStore {
  items: OrderItem[];
  addItem: (item: OrderItem) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  total: number;
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  total: 0,
  addItem: (newItem) => {
    const existingItem = get().items.find(i => i.productId === newItem.productId);
    let newItems;
    if (existingItem) {
      newItems = get().items.map(i => 
        i.productId === newItem.productId 
          ? { ...i, quantity: i.quantity + newItem.quantity, notes: newItem.notes || i.notes }
          : i
      );
    } else {
      newItems = [...get().items, newItem];
    }
    const newTotal = newItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    set({ items: newItems, total: newTotal });
  },
  removeItem: (productId) => {
    const newItems = get().items.filter(i => i.productId !== productId);
    const newTotal = newItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    set({ items: newItems, total: newTotal });
  },
  updateQuantity: (productId, quantity) => {
    if (quantity <= 0) {
      get().removeItem(productId);
      return;
    }
    const newItems = get().items.map(i => 
      i.productId === productId ? { ...i, quantity } : i
    );
    const newTotal = newItems.reduce((acc, item) => acc + (item.price * item.quantity), 0);
    set({ items: newItems, total: newTotal });
  },
  clearCart: () => set({ items: [], total: 0 }),
}));
