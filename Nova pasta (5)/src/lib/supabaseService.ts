import { supabase, isSupabaseHealthy } from './supabase';
import { Restaurant, Category, Product, Order, RestaurantTable, BusinessHours, PaymentMethod } from '../types';
import { MOCK_RESTAURANT, MOCK_CATEGORIES, MOCK_PRODUCTS } from './mockDb';

const DEFAULT_RESTAURANT_ID = 'default';

// Cache em memória global para aceleração de performance de carregamento secundário (SWR)
const memoryCache: Record<string, any> = {};

// Helper para mapear registro do banco de dados para o tipo Restaurant
export interface MenuVisit {
  id: string;
  restaurant_id: string;
  table_number?: string;
  user_agent?: string;
  referrer?: string;
  created_at: string;
}

const getLocalData = (key: string, fallback: any) => {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
};

const setLocalData = (key: string, val: any) => {
  try {
    localStorage.setItem(key, JSON.stringify(val));
    // Dispara evento local para atualização reativa offline
    window.dispatchEvent(new CustomEvent('local_db_change', { detail: { key } }));
  } catch (error) {
    console.error('Erro ao salvar localmente:', error);
  }
};

const triggerLocalUpdate = (channelName: string) => {
  window.dispatchEvent(new CustomEvent('local_db_change', { detail: { channel: channelName } }));
};

const subscribeLocal = (channelName: string, onUpdate: () => void) => {
  const handler = (e: any) => {
    if (e.detail?.channel === channelName || e.detail?.channel === 'all') {
      onUpdate();
    }
  };
  window.addEventListener('local_db_change', handler);
  return () => window.removeEventListener('local_db_change', handler);
};

export const supabaseService = {
  // RESTAURANTS
  async getRestaurant(id: string): Promise<Restaurant | null> {
    const dbId = id === 'default' ? DEFAULT_RESTAURANT_ID : id;
    let actualId = dbId;
    
    // Tenta obter por slug primeiro se não for uuid padrão
    const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(dbId);
    
    try {
      if (!isSupabaseHealthy) {
        return getLocalData(`local_restaurant_${dbId}`, MOCK_RESTAURANT);
      }

      let query = supabase.from('restaurants').select('*');
      
      if (isUUID) {
        query = query.or(`id.eq.${dbId},owner_uid.eq.${dbId}`);
      } else {
        query = query.eq('slug', dbId);
      }

      const { data, error } = await query.maybeSingle();

      if (error) throw error;
      if (!data) return null;

      const mapped: Restaurant = {
        id: data.id,
        name: data.name,
        slug: data.slug || data.id,
        description: data.description || '',
        logoUrl: data.logo_url || '',
        coverUrl: data.cover_url || '',
        phone: data.phone || '',
        address: data.address || '',
        primaryColor: data.primary_color || '#ea580c',
        accentColor: data.accent_color || '#ffedd5',
        instagramUrl: data.instagram_url || '',
        facebookUrl: data.facebook_url || '',
        ownerUid: data.owner_uid || '',
        deliveryFee: Number(data.delivery_fee ?? 0),
        minDeliveryTime: data.min_delivery_time || 30,
        maxDeliveryTime: data.max_delivery_time || 45,
        isActive: data.is_active ?? true,
        businessHours: (data.business_hours as unknown as BusinessHours) || {
          monday: { open: '08:00', close: '22:00', closed: false },
          tuesday: { open: '08:00', close: '22:00', closed: false },
          wednesday: { open: '08:00', close: '22:00', closed: false },
          thursday: { open: '08:00', close: '22:00', closed: false },
          friday: { open: '08:00', close: '22:00', closed: false },
          saturday: { open: '08:00', close: '22:00', closed: false },
          sunday: { open: '08:00', close: '22:00', closed: false }
        },
        paymentMethods: (data.payment_methods as unknown as PaymentMethod[]) || [
          { id: 'cash', name: 'Dinheiro', type: 'cash', enabled: true },
          { id: 'card', name: 'Cartão de Crédito/Débito', type: 'card', enabled: true }
        ]
      };

      setLocalData(`local_restaurant_${mapped.id}`, mapped);
      if (mapped.slug) {
        setLocalData(`local_restaurant_${mapped.slug}`, mapped);
      }
      return mapped;
    } catch (err) {
      console.warn('Erro ao carregar restaurante do Supabase, usando local:', err);
      return getLocalData(`local_restaurant_${dbId}`, MOCK_RESTAURANT);
    }
  },

  async updateRestaurant(id: string, updates: Partial<Restaurant>): Promise<void> {
    const dbId = id === 'default' ? DEFAULT_RESTAURANT_ID : id;
    let actualId = dbId;

    // Atualização local imediata para sensação instantânea
    const localKey = `local_restaurant_${dbId}`;
    const current = getLocalData(localKey, MOCK_RESTAURANT);
    const updated = { ...current, ...updates };
    setLocalData(localKey, updated);
    
    // Atualiza cache em memória
    memoryCache[`restaurant_${actualId}`] = updated;

    if (!isSupabaseHealthy) {
      triggerLocalUpdate(`rt-restaurant-${dbId}`);
      return;
    }

    try {
      // Descobrir ID real caso seja um slug
      const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(dbId);
      if (!isUUID) {
        const { data } = await supabase.from('restaurants').select('id').eq('slug', dbId).maybeSingle();
        if (data) actualId = data.id;
      }

      const dbUpdates: any = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.slug !== undefined) dbUpdates.slug = updates.slug;
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.logoUrl !== undefined) dbUpdates.logo_url = updates.logoUrl;
      if (updates.coverUrl !== undefined) dbUpdates.cover_url = updates.coverUrl;
      if (updates.phone !== undefined) dbUpdates.phone = updates.phone;
      if (updates.address !== undefined) dbUpdates.address = updates.address;
      if (updates.primaryColor !== undefined) dbUpdates.primary_color = updates.primaryColor;
      if (updates.accentColor !== undefined) dbUpdates.accent_color = updates.accentColor;
      if (updates.instagramUrl !== undefined) dbUpdates.instagram_url = updates.instagramUrl;
      if (updates.facebookUrl !== undefined) dbUpdates.facebook_url = updates.facebookUrl;
      if (updates.deliveryFee !== undefined) dbUpdates.delivery_fee = updates.deliveryFee;
      if (updates.minDeliveryTime !== undefined) dbUpdates.min_delivery_time = updates.minDeliveryTime;
      if (updates.maxDeliveryTime !== undefined) dbUpdates.max_delivery_time = updates.maxDeliveryTime;
      if (updates.isActive !== undefined) dbUpdates.is_active = updates.isActive;
      if (updates.businessHours !== undefined) dbUpdates.business_hours = updates.businessHours;
      if (updates.paymentMethods !== undefined) dbUpdates.payment_methods = updates.paymentMethods;

      const { error } = await supabase
        .from('restaurants')
        .update(dbUpdates)
        .eq('id', actualId);

      if (error) throw error;
    } catch (error: any) {
      console.error('Erro ao atualizar restaurante no Supabase. Salvo apenas local:', error);
    }
  },

  subscribeRestaurant(id: string, callback: (restaurant: Restaurant | null) => void) {
    const dbId = id === 'default' ? DEFAULT_RESTAURANT_ID : id;
    let actualId = dbId;
    let channel: any = null;
    
    const cacheKey = `restaurant_${actualId}`;
    if (memoryCache[cacheKey]) {
      callback(memoryCache[cacheKey]);
    }
    
    const fetch = async () => {
      try {
        const data = await this.getRestaurant(actualId);
        if (data) {
          actualId = data.id;
          setupSubscription();
        }
        if (data) {
          memoryCache[cacheKey] = data;
        }
        callback(data);
      } catch (err) {
        console.error('Erro em subscribeRestaurant fetch, usando local:', err);
        const cached = getLocalData(`local_restaurant_${actualId}`, MOCK_RESTAURANT);
        memoryCache[cacheKey] = cached;
        callback(cached);
      }
    };

    const setupSubscription = () => {
      if (!isSupabaseHealthy) {
        // Usa eventos locais
        return subscribeLocal(`rt-restaurant-${actualId}`, () => {
          const cached = getLocalData(`local_restaurant_${actualId}`, MOCK_RESTAURANT);
          memoryCache[cacheKey] = cached;
          callback(cached);
        });
      }

      try {
        channel = supabase
          .channel(`restaurant-changes-${actualId}`)
          .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'restaurants',
            filter: `id=eq.${actualId}`
          }, (payload) => {
            fetch();
          })
          .subscribe();
      } catch (subscriptionErr) {
        console.error('Erro ao configurar realtime do restaurante:', subscriptionErr);
      }
    };

    fetch();

    return () => {
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch {}
      }
    };
  },

  // CATEGORIES
  async getCategories(restaurantId: string): Promise<Category[]> {
    const dbId = restaurantId === 'default' ? DEFAULT_RESTAURANT_ID : restaurantId;
    try {
      if (!isSupabaseHealthy) {
        return getLocalData(`local_categories_${dbId}`, MOCK_CATEGORIES);
      }

      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('restaurant_id', dbId)
        .order('order', { ascending: true });

      if (error) throw error;
      const categories = (data || []).map(c => ({
        id: c.id,
        name: c.name,
        order: c.order || 0
      }));

      setLocalData(`local_categories_${dbId}`, categories);
      return categories;
    } catch {
      return getLocalData(`local_categories_${dbId}`, MOCK_CATEGORIES);
    }
  },

  async addCategory(restaurantId: string, category: Omit<Category, 'id'>): Promise<Category> {
    const dbId = restaurantId === 'default' ? DEFAULT_RESTAURANT_ID : restaurantId;
    const newId = crypto.randomUUID();
    const newCategory: Category = { ...category, id: newId };

    const localKey = `local_categories_${dbId}`;
    const current = getLocalData(localKey, MOCK_CATEGORIES);
    setLocalData(localKey, [...current, newCategory].sort((a, b) => (a.order || 0) - (b.order || 0)));
    
    // Invalidar cache em memória
    delete memoryCache[`categories_${dbId}`];

    if (!isSupabaseHealthy) {
      triggerLocalUpdate(`rt-categories-${dbId}`);
      return newCategory;
    }

    try {
      const { error } = await supabase
        .from('categories')
        .insert([{
          id: newId,
          restaurant_id: dbId,
          name: category.name,
          order: category.order || 0
        }]);

      if (error) throw error;
    } catch (e) {
      console.error('Adicionado apenas localmente devido a indisponibilidade do banco:', e);
    }

    return newCategory;
  },

  async updateCategory(restaurantId: string, categoryId: string, updates: Partial<Category>): Promise<void> {
    const dbId = restaurantId === 'default' ? DEFAULT_RESTAURANT_ID : restaurantId;
    const localKey = `local_categories_${dbId}`;
    const current = getLocalData(localKey, MOCK_CATEGORIES);
    const updated = current.map((c: any) => c.id === categoryId ? { ...c, ...updates } : c);
    setLocalData(localKey, updated.sort((a: any, b: any) => (a.order || 0) - (b.order || 0)));

    // Invalidar cache em memória
    delete memoryCache[`categories_${dbId}`];

    if (!isSupabaseHealthy) {
      triggerLocalUpdate(`rt-categories-${dbId}`);
      return;
    }

    try {
      const { error } = await supabase
        .from('categories')
        .update({
          name: updates.name,
          order: updates.order
        })
        .eq('id', categoryId);

      if (error) throw error;
    } catch (e) {
      console.error('Atualizado apenas local devido a erro no Supabase:', e);
    }
  },

  async deleteCategory(restaurantId: string, categoryId: string) {
    const dbId = restaurantId === 'default' ? DEFAULT_RESTAURANT_ID : restaurantId;
    const localKey = `local_categories_${dbId}`;
    const current = getLocalData(localKey, MOCK_CATEGORIES);
    setLocalData(localKey, current.filter((c: any) => c.id !== categoryId));

    // Invalidar cache em memória
    delete memoryCache[`categories_${dbId}`];

    if (!isSupabaseHealthy) {
      triggerLocalUpdate(`rt-categories-${dbId}`);
      return 1;
    }

    try {
      const { error } = await supabase
        .from('categories')
        .delete({ count: 'exact' })
        .eq('id', categoryId);

      if (error) throw error;
      return 1;
    } catch (e) {
      console.error('Erro ao excluir no Supabase:', e);
      return 1;
    }
  },

  subscribeCategories(restaurantId: string, callback: (categories: Category[]) => void) {
    const dbId = restaurantId === 'default' ? DEFAULT_RESTAURANT_ID : restaurantId;
    let channel: any = null;

    const cacheKey = `categories_${dbId}`;
    if (memoryCache[cacheKey]) {
      callback(memoryCache[cacheKey]);
    }

    const fetch = async () => {
      if (!dbId || dbId === 'undefined') {
        callback([]);
        return;
      }

      if (!isSupabaseHealthy) {
        const cached = getLocalData(`local_categories_${dbId}`, MOCK_CATEGORIES);
        const sorted = cached.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
        memoryCache[cacheKey] = sorted;
        callback(sorted);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('categories')
          .select('*')
          .eq('restaurant_id', dbId)
          .order('order', { ascending: true });
        
        if (error) throw error;
        const result = data || [];
        memoryCache[cacheKey] = result;
        callback(result);
      } catch (err) {
        console.warn('Erro ao buscar categorias do Supabase. Usando cache local:', err);
        const cached = getLocalData(`local_categories_${dbId}`, MOCK_CATEGORIES);
        const sorted = cached.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
        memoryCache[cacheKey] = sorted;
        callback(sorted);
      }
    };

    fetch();

    if (!isSupabaseHealthy) {
      return subscribeLocal(`rt-categories-${dbId}`, () => {
        const cached = getLocalData(`local_categories_${dbId}`, MOCK_CATEGORIES);
        const sorted = cached.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
        memoryCache[cacheKey] = sorted;
        callback(sorted);
      });
    }

    try {
      channel = supabase
        .channel(`categories-changes-${dbId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'categories',
          filter: `restaurant_id=eq.${dbId}`
        }, (payload) => {
          fetch();
        })
        .subscribe();
    } catch (err) {
      console.error('Erro ao assinar canal realtime de categorias:', err);
    }

    return () => {
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch {}
      }
    };
  },

  // PRODUCTS
  async getProducts(restaurantId: string): Promise<Product[]> {
    const dbId = restaurantId === 'default' ? DEFAULT_RESTAURANT_ID : restaurantId;
    try {
      if (!isSupabaseHealthy) {
        return getLocalData(`local_products_${dbId}`, MOCK_PRODUCTS);
      }

      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('restaurant_id', dbId);

      if (error) throw error;
      const products = (data || []).map(p => ({
        id: p.id,
        name: p.name,
        description: p.description || '',
        price: Number(p.price),
        image: p.image_url || '',
        available: p.available ?? true,
        categoryId: p.category_id,
        isPromotion: p.is_promotion ?? false,
        isFeatured: p.is_featured ?? false
      }));

      setLocalData(`local_products_${dbId}`, products);
      return products;
    } catch {
      return getLocalData(`local_products_${dbId}`, MOCK_PRODUCTS);
    }
  },

  async addProduct(restaurantId: string, product: Omit<Product, 'id'>): Promise<Product> {
    const dbId = restaurantId === 'default' ? DEFAULT_RESTAURANT_ID : restaurantId;
    const newId = crypto.randomUUID();
    const newProduct: Product = { ...product, id: newId };

    const localKey = `local_products_${dbId}`;
    const current = getLocalData(localKey, MOCK_PRODUCTS);
    setLocalData(localKey, [...current, newProduct]);

    // Invalidar cache em memória
    delete memoryCache[`products_${dbId}`];

    if (!isSupabaseHealthy) {
      triggerLocalUpdate(`rt-products-${dbId}`);
      return newProduct;
    }

    try {
      const { error } = await supabase
        .from('products')
        .insert([{
          id: newId,
          restaurant_id: dbId,
          name: product.name,
          description: product.description,
          price: product.price,
          image_url: product.image,
          available: product.available,
          category_id: product.categoryId,
          is_promotion: product.isPromotion,
          is_featured: product.isFeatured
        }]);

      if (error) throw error;
    } catch (e) {
      console.error('Produto adicionado apenas local devido a falha de conexão:', e);
    }

    return newProduct;
  },

  async updateProduct(restaurantId: string, productId: string, updates: Partial<Product>): Promise<void> {
    const dbId = restaurantId === 'default' ? DEFAULT_RESTAURANT_ID : restaurantId;
    const localKey = `local_products_${dbId}`;
    const current = getLocalData(localKey, MOCK_PRODUCTS);
    setLocalData(localKey, current.map((p: any) => p.id === productId ? { ...p, ...updates } : p));

    // Invalidar cache em memória
    delete memoryCache[`products_${dbId}`];

    if (!isSupabaseHealthy) {
      triggerLocalUpdate(`rt-products-${dbId}`);
      return;
    }

    try {
      const dbUpdates: any = {};
      if (updates.name !== undefined) dbUpdates.name = updates.name;
      if (updates.description !== undefined) dbUpdates.description = updates.description;
      if (updates.price !== undefined) dbUpdates.price = updates.price;
      if (updates.image !== undefined) dbUpdates.image_url = updates.image;
      if (updates.available !== undefined) dbUpdates.available = updates.available;
      if (updates.categoryId !== undefined) dbUpdates.category_id = updates.categoryId;
      if (updates.isPromotion !== undefined) dbUpdates.is_promotion = updates.isPromotion;
      if (updates.isFeatured !== undefined) dbUpdates.is_featured = updates.isFeatured;

      const { error } = await supabase
        .from('products')
        .update(dbUpdates)
        .eq('id', productId);

      if (error) throw error;
    } catch (e) {
      console.error('Produto atualizado apenas localmente devido a falha no Supabase:', e);
    }
  },

  async deleteProduct(restaurantId: string, productId: string) {
    const dbId = restaurantId === 'default' ? DEFAULT_RESTAURANT_ID : restaurantId;
    const localKey = `local_products_${dbId}`;
    const current = getLocalData(localKey, MOCK_PRODUCTS);
    setLocalData(localKey, current.filter((p: any) => p.id !== productId));

    // Invalidar cache em memória
    delete memoryCache[`products_${dbId}`];

    if (!isSupabaseHealthy) {
      triggerLocalUpdate(`rt-products-${dbId}`);
      return 1;
    }

    try {
      const { error } = await supabase
        .from('products')
        .delete({ count: 'exact' })
        .eq('id', productId);

      if (error) throw error;
      return 1;
    } catch (e) {
      console.error('Erro ao excluir produto no Supabase:', e);
      return 1;
    }
  },

  subscribeProducts(restaurantId: string, callback: (products: Product[]) => void) {
    const dbId = restaurantId === 'default' ? DEFAULT_RESTAURANT_ID : restaurantId;
    let channel: any = null;

    const cacheKey = `products_${dbId}`;
    if (memoryCache[cacheKey]) {
      callback(memoryCache[cacheKey]);
    }

    const fetch = async () => {
      if (!dbId || dbId === 'undefined') {
        callback([]);
        return;
      }

      if (!isSupabaseHealthy) {
        const cached = getLocalData(`local_products_${dbId}`, MOCK_PRODUCTS);
        memoryCache[cacheKey] = cached;
        callback(cached);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('restaurant_id', dbId);
        
        if (error) throw error;
        
        if (data) {
          const mapped = data.map(p => ({
            id: p.id,
            name: p.name,
            description: p.description || '',
            price: Number(p.price),
            image: p.image_url || '',
            available: p.available ?? true,
            categoryId: p.category_id,
            isPromotion: p.is_promotion,
            isFeatured: p.is_featured
          }));
          memoryCache[cacheKey] = mapped;
          callback(mapped);
        } else {
          memoryCache[cacheKey] = [];
          callback([]);
        }
      } catch (err) {
        const cached = getLocalData(`local_products_${dbId}`, MOCK_PRODUCTS);
        memoryCache[cacheKey] = cached;
        callback(cached);
      }
    };

    fetch();

    if (!isSupabaseHealthy) {
      return subscribeLocal(`rt-products-${dbId}`, () => {
        const cached = getLocalData(`local_products_${dbId}`, MOCK_PRODUCTS);
        memoryCache[cacheKey] = cached;
        callback(cached);
      });
    }

    try {
      channel = supabase
        .channel(`products-changes-${dbId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'products',
          filter: `restaurant_id=eq.${dbId}`
        }, (payload) => {
          fetch();
        })
        .subscribe();
    } catch (err) {
      console.error('Erro ao assinar canal realtime de produtos:', err);
    }

    return () => {
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch {}
      }
    };
  },

  // REGISTRAR ACESSO / VISITA AO CARDÁPIO
  async registerMenuVisit(restaurantId: string, tableNumber?: string, userAgent?: string, referrer?: string): Promise<void> {
    const dbId = restaurantId === 'default' ? DEFAULT_RESTAURANT_ID : restaurantId;
    if (!isSupabaseHealthy) {
      const visits = getLocalData(`local_visits_${dbId}`, []);
      setLocalData(`local_visits_${dbId}`, [...visits, { 
        id: crypto.randomUUID(), 
        created_at: new Date().toISOString() 
      }]);
      return;
    }

    try {
      await supabase
        .from('menu_visits')
        .insert([{
          restaurant_id: dbId,
          table_number: tableNumber || null,
          user_agent: userAgent || null,
          referrer: referrer || null
        }]);
    } catch (err) {
      console.warn('Erro ao registrar visita no banco (salvo localmente):', err);
    }
  },

  // ESTATÍSTICAS DO DASHBOARD / VISITAS HISTÓRICAS
  async getMenuVisits(restaurantId: string): Promise<MenuVisit[]> {
    const dbId = restaurantId === 'default' ? DEFAULT_RESTAURANT_ID : restaurantId;
    if (!isSupabaseHealthy) {
      return getLocalData(`local_visits_${dbId}`, []);
    }

    try {
      const { data, error } = await supabase
        .from('menu_visits')
        .select('*')
        .eq('restaurant_id', dbId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setLocalData(`local_visits_${dbId}`, data || []);
      return data || [];
    } catch (err) {
      return getLocalData(`local_visits_${dbId}`, []);
    }
  },

  // ORDERS
  subscribeOrders(restaurantId: string, callback: (orders: Order[]) => void) {
    const dbId = restaurantId === 'default' ? DEFAULT_RESTAURANT_ID : restaurantId;
    let localOrders: Order[] = [];

    const cacheKey = `orders_${dbId}`;
    if (memoryCache[cacheKey]) {
      localOrders = memoryCache[cacheKey];
      callback(localOrders);
    }

    const mapOrder = (o: any): Order => ({
      id: o.id,
      customerName: o.customer_name || 'Cliente',
      customerPhone: o.customer_phone || '',
      items: typeof o.items === 'string' ? JSON.parse(o.items) : (o.items || []),
      total: Number(o.total),
      type: o.type || 'table',
      status: o.status || 'pending',
      tableNumber: o.table_number,
      address: o.address,
      paymentMethod: o.payment_method,
      createdAt: o.created_at,
      changeFor: o.change_for ? Number(o.change_for) : undefined
    });

    let subscription: any = null;

    const fetch = async () => {
      if (!dbId || dbId === 'undefined') {
        callback([]);
        return;
      }

      if (!isSupabaseHealthy) {
        const cached = getLocalData(`local_orders_${dbId}`, []);
        memoryCache[cacheKey] = cached;
        callback(cached);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('orders')
          .select('*')
          .eq('restaurant_id', dbId)
          .order('created_at', { ascending: false })
          .limit(200);

        if (error) throw error;
        
        if (data) {
          localOrders = data.map(mapOrder);
          memoryCache[cacheKey] = localOrders;
          callback([...localOrders]);
        } else {
          memoryCache[cacheKey] = [];
          callback([]);
        }
      } catch (err) {
        const cached = getLocalData(`local_orders_${dbId}`, []);
        memoryCache[cacheKey] = cached;
        callback(cached);
      }
    };

    fetch();

    if (!isSupabaseHealthy) {
      return subscribeLocal(`rt-orders-${dbId}`, () => {
        const cached = getLocalData(`local_orders_${dbId}`, []);
        memoryCache[cacheKey] = cached;
        callback(cached);
      });
    }

    try {
      subscription = supabase
        .channel(`orders-changes-${dbId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${dbId}`
        }, (payload) => {
          if (payload.eventType === 'INSERT') {
            const newOrder = mapOrder(payload.new);
            localOrders = [newOrder, ...localOrders].slice(0, 200);
            memoryCache[cacheKey] = localOrders;
            callback([...localOrders]);
          } else if (payload.eventType === 'UPDATE') {
            const updatedOrder = mapOrder(payload.new);
            localOrders = localOrders.map(o => o.id === updatedOrder.id ? updatedOrder : o);
            memoryCache[cacheKey] = localOrders;
            callback([...localOrders]);
          } else if (payload.eventType === 'DELETE') {
            localOrders = localOrders.filter(o => o.id !== payload.old.id);
            memoryCache[cacheKey] = localOrders;
            callback([...localOrders]);
          } else {
            fetch();
          }
        })
        .subscribe();
    } catch {}

    return () => {
      try {
        if (subscription) supabase.removeChannel(subscription);
      } catch {}
    };
  },

  async createOrder(restaurantId: string, order: Omit<Order, 'id' | 'createdAt'>): Promise<Order> {
    const dbId = restaurantId === 'default' ? DEFAULT_RESTAURANT_ID : restaurantId;
    const newId = crypto.randomUUID();
    const newOrder: Order = {
      ...order,
      id: newId,
      createdAt: new Date().toISOString()
    };

    const localKey = `local_orders_${dbId}`;
    const current = getLocalData(localKey, []);
    setLocalData(localKey, [newOrder, ...current]);

    // Invalidar cache em memória
    delete memoryCache[`orders_${dbId}`];

    if (!isSupabaseHealthy) {
      triggerLocalUpdate(`rt-orders-${dbId}`);
      return newOrder;
    }

    try {
      const { error } = await supabase
        .from('orders')
        .insert([{
          id: newId,
          restaurant_id: dbId,
          customer_name: order.customerName,
          customer_phone: order.customerPhone,
          items: order.items,
          total: order.total,
          type: order.type,
          status: order.status,
          table_number: order.tableNumber || null,
          address: order.address || null,
          payment_method: order.paymentMethod,
          change_for: order.changeFor || null
        }]);

      if (error) throw error;
    } catch (e) {
      console.error('Pedido salvo apenas localmente:', e);
    }

    return newOrder;
  },

  async updateOrderStatus(restaurantId: string, orderId: string, status: Order['status']): Promise<void> {
    const dbId = restaurantId === 'default' ? DEFAULT_RESTAURANT_ID : restaurantId;
    const localKey = `local_orders_${dbId}`;
    const current = getLocalData(localKey, []);
    setLocalData(localKey, current.map((o: any) => o.id === orderId ? { ...o, status } : o));

    // Invalidar cache em memória
    delete memoryCache[`orders_${dbId}`];

    if (!isSupabaseHealthy) {
      triggerLocalUpdate(`rt-orders-${dbId}`);
      return;
    }

    try {
      const { error } = await supabase
        .from('orders')
        .update({ status })
        .eq('id', orderId);

      if (error) throw error;
    } catch (e) {
      console.error('Atualizado apenas localmente:', e);
    }
  },

  async deleteOrder(restaurantId: string, orderId: string) {
    const dbId = restaurantId === 'default' ? DEFAULT_RESTAURANT_ID : restaurantId;
    const localKey = `local_orders_${dbId}`;
    const current = getLocalData(localKey, []);
    setLocalData(localKey, current.filter((o: any) => o.id !== orderId));

    // Invalidar cache em memória
    delete memoryCache[`orders_${dbId}`];

    if (!isSupabaseHealthy) {
      triggerLocalUpdate(`rt-orders-${dbId}`);
      return 1;
    }

    try {
      const { error } = await supabase
        .from('orders')
        .delete({ count: 'exact' })
        .eq('id', orderId);

      if (error) throw error;
      return 1;
    } catch (e) {
      console.error('Erro ao excluir pedido:', e);
      return 1;
    }
  },

  // TABLES
  async getTables(restaurantId: string): Promise<RestaurantTable[]> {
    const dbId = restaurantId === 'default' ? DEFAULT_RESTAURANT_ID : restaurantId;
    try {
      if (!isSupabaseHealthy) {
        const cached = getLocalData(`local_tables_${dbId}`, []) as RestaurantTable[];
        return cached.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
      }

      const { data, error } = await supabase
        .from('tables')
        .select('*')
        .eq('restaurant_id', dbId);

      if (error) throw error;
      const tables = (data || []).map(t => ({
        id: t.id,
        number: t.number,
        qrCodeUrl: t.qr_code_url || ''
      })).sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));

      setLocalData(`local_tables_${dbId}`, tables);
      return tables;
    } catch {
      const cached = getLocalData(`local_tables_${dbId}`, []) as RestaurantTable[];
      return cached.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
    }
  },

  async addTable(restaurantId: string, tableNumber: string, qrCodeUrl: string): Promise<RestaurantTable> {
    const dbId = restaurantId === 'default' ? DEFAULT_RESTAURANT_ID : restaurantId;
    const newId = crypto.randomUUID();
    const newTable: RestaurantTable = { id: newId, number: tableNumber, qrCodeUrl };

    const localKey = `local_tables_${dbId}`;
    const current = getLocalData(localKey, []) as RestaurantTable[];
    const updated = [...current, newTable].sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
    setLocalData(localKey, updated);

    // Invalidar cache em memória
    delete memoryCache[`tables_${dbId}`];

    if (!isSupabaseHealthy) {
      triggerLocalUpdate(`rt-tables-${dbId}`);
      return newTable;
    }

    try {
      const { error } = await supabase
        .from('tables')
        .insert([{
          id: newId,
          restaurant_id: dbId,
          number: tableNumber,
          qr_code_url: qrCodeUrl
        }]);

      if (error) throw error;
    } catch (error) {
      console.error('Mesa adicionada local apenas:', error);
    }

    return newTable;
  },

  async deleteTable(restaurantId: string, tableId: string) {
    const dbId = restaurantId === 'default' ? DEFAULT_RESTAURANT_ID : restaurantId;
    const localKey = `local_tables_${dbId}`;
    const current = getLocalData(localKey, []) as RestaurantTable[];
    setLocalData(localKey, current.filter(t => t.id !== tableId));

    // Invalidar cache em memória
    delete memoryCache[`tables_${dbId}`];

    if (!isSupabaseHealthy) {
      triggerLocalUpdate(`rt-tables-${dbId}`);
      return 1;
    }

    try {
      const { error } = await supabase
        .from('tables')
        .delete({ count: 'exact' })
        .eq('id', tableId);

      if (error) throw error;
      return 1;
    } catch (error) {
      console.error('Erro ao excluir mesa no Supabase:', error);
      return 1;
    }
  },

  subscribeTables(restaurantId: string, callback: (tables: RestaurantTable[]) => void) {
    const dbId = restaurantId === 'default' ? DEFAULT_RESTAURANT_ID : restaurantId;
    
    const cacheKey = `tables_${dbId}`;
    if (memoryCache[cacheKey]) {
      callback(memoryCache[cacheKey]);
    }

    const fetchTables = async () => {
      if (!dbId || dbId === 'undefined') {
        callback([]);
        return;
      }

      if (!isSupabaseHealthy) {
        const cached = getLocalData(`local_tables_${dbId}`, []) as RestaurantTable[];
        cached.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
        memoryCache[cacheKey] = cached;
        callback(cached);
        return;
      }

      try {
        const { data, error } = await supabase
          .from('tables')
          .select('*')
          .eq('restaurant_id', dbId);

        if (error) throw error;
        
        if (data) {
          const mappedTables = data.map(t => ({
            id: t.id,
            number: t.number,
            qrCodeUrl: t.qr_code_url || ''
          })).sort((a, b) => 
            a.number.localeCompare(b.number, undefined, { numeric: true })
          );

          memoryCache[cacheKey] = mappedTables;
          callback(mappedTables);
        } else {
          memoryCache[cacheKey] = [];
          callback([]);
        }
      } catch (err) {
        const cached = getLocalData(`local_tables_${dbId}`, []) as RestaurantTable[];
        cached.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
        memoryCache[cacheKey] = cached;
        callback(cached);
      }
    };

    fetchTables();

    if (!isSupabaseHealthy) {
      return subscribeLocal(`rt-tables-${dbId}`, () => {
        const cached = getLocalData(`local_tables_${dbId}`, []) as RestaurantTable[];
        cached.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
        memoryCache[cacheKey] = cached;
        callback(cached);
      });
    }

    let subscription: any = null;
    try {
      subscription = supabase
        .channel(`tables-changes-${dbId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'tables',
          filter: `restaurant_id=eq.${dbId}`
        }, () => {
          fetchTables();
        })
        .subscribe();
    } catch {}

    return () => {
      try {
        if (subscription) supabase.removeChannel(subscription);
      } catch {}
    };
  }
};
