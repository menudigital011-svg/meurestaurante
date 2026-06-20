import { supabase, isSupabaseHealthy, updateSupabaseCache } from './supabase';
import { getLocalData, setLocalData } from './statusUtils';
import { Restaurant, Category, Product, Order, RestaurantTable, OrderItem } from '../types';

const DEFAULT_RESTAURANT_ID = 'default';

// Cache global em memória para aceleração SWR (0ms ao alternar de abas)
const memoryCache: Record<string, any> = {};

// Helper para mapear os dados do DB para tipagem do App
export interface MenuVisit {
  id: string;
  restaurant_id: string;
  table_number: string;
  visited_at: string;
}

const MOCK_RESTAURANT: Restaurant = {
  id: 'default',
  name: 'Talatona Grill House',
  slug: 'talatona-grill',
  theme_color: '#ea580c',
  logo_url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=200&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
  cover_url: 'https://images.unsplash.com/photo-1517248135467-4c7edcad34c4?w=1200&auto=format&fit=crop&q=60&ixlib=rb-4.0.3',
  phone: '+244 923 000 000',
  address: 'Via AL14, Talatona, Luanda',
  instagram: 'talatonagrill',
  facebook: 'talatonagrill',
  delivery_tax: 1500,
  min_order_value: 3000,
  is_active: true,
  payment_methods: ['cash', 'card', 'transfer']
};

const MOCK_CATEGORIES: Category[] = [
  { id: 'cat1', name: 'Grelhados na Brasa', order: 1 },
  { id: 'cat2', name: 'Acompanhados', order: 2 },
  { id: 'cat3', name: 'Bebidas Tropicais', order: 3 },
];

const MOCK_PRODUCTS: Product[] = [
  {
    id: 'p1',
    name: 'Picanha Premium Familiar',
    description: 'Generosa porção de picanha grelhada na brasa, acompanhada por arroz de feijão, farofa, batata frita e molho vinagrete artesanal.',
    price: 12500,
    image: 'https://images.unsplash.com/photo-1544025162-d76694265947?w=600&auto=format&fit=crop&q=80',
    categoryId: 'cat1',
    isFeatured: true,
    isPromotion: false,
    restaurantId: 'default'
  },
  {
    id: 'p2',
    name: 'Misto de Carnes Especial',
    description: 'Churrasco misto com as melhores carnes grelhadas: costeleta, salsicha toscana, peito de frango e bifinhos de lombo suculentos.',
    price: 14000,
    image: 'https://images.unsplash.com/photo-1555939594-58d7cb561ad1?w=600&auto=format&fit=crop&q=80',
    categoryId: 'cat1',
    isFeatured: false,
    isPromotion: true,
    restaurantId: 'default'
  },
  {
    id: 'p3',
    name: 'Batata Frita Rústica',
    description: 'Batatas naturais bem estaladiças por fora e macias por dentro, salpicadas com ervas finas e o nosso tempero especial da casa.',
    price: 2500,
    image: 'https://images.unsplash.com/photo-1573080496219-bb080dd4f877?w=600&auto=format&fit=crop&q=80',
    categoryId: 'cat2',
    isFeatured: false,
    isPromotion: false,
    restaurantId: 'default'
  },
  {
    id: 'p4',
    name: 'Arroz de Feijão Tradicional',
    description: 'Arroz soltinho cozinhado num delicioso caldo rústico de feijão preto com especiarias e chouriço seco.',
    price: 2000,
    image: 'https://images.unsplash.com/photo-1536304997881-a372c179924b?w=600&auto=format&fit=crop&q=80',
    categoryId: 'cat2',
    isFeatured: false,
    isPromotion: false,
    restaurantId: 'default'
  }
];

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
  // --- SEGMENTO DE RESTAURANTES ---
  async getRestaurants() {
    try {
      if (!isSupabaseHealthy) {
        return [getLocalData('local_restaurant_default', MOCK_RESTAURANT)];
      }
      const { data, error } = await supabase
        .from('restaurants')
        .select('*');
      if (error) throw error;
      return data || [];
    } catch {
      return [getLocalData('local_restaurant_default', MOCK_RESTAURANT)];
    }
  },

  async getRestaurantBySlug(slug: string): Promise<Restaurant | null> {
    try {
      if (!isSupabaseHealthy) {
        const cached = getLocalData('local_restaurant_default', MOCK_RESTAURANT);
        return cached.slug === slug ? cached : null;
      }
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .eq('slug', slug)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        id: data.id,
        name: data.name,
        slug: data.slug,
        theme_color: data.theme_color || '#ea580c',
        logo_url: data.logo_url || '',
        cover_url: data.cover_url || '',
        phone: data.phone || '',
        address: data.address || '',
        instagram: data.instagram || '',
        facebook: data.facebook || '',
        delivery_tax: data.delivery_tax || 0,
        min_order_value: data.min_order_value || 0,
        is_active: data.is_active ?? true,
        payment_methods: data.payment_methods || ['cash', 'card', 'transfer']
      };
    } catch (e) {
      console.warn('Erro ao obter restaurante por slug, buscando local:', e);
      const cached = getLocalData('local_restaurant_default', MOCK_RESTAURANT);
      return cached.slug === slug ? cached : null;
    }
  },

  async getRestaurantById(id: string): Promise<Restaurant | null> {
    const dbId = id === 'default' ? DEFAULT_RESTAURANT_ID : id;
    try {
      if (!isSupabaseHealthy) {
        return getLocalData(`local_restaurant_${dbId}`, MOCK_RESTAURANT);
      }
      const { data, error } = await supabase
        .from('restaurants')
        .select('*')
        .eq('id', dbId)
        .maybeSingle();

      if (error) throw error;
      if (!data) return null;

      return {
        id: data.id,
        name: data.name,
        slug: data.slug,
        theme_color: data.theme_color || '#ea580c',
        logo_url: data.logo_url || '',
        cover_url: data.cover_url || '',
        phone: data.phone || '',
        address: data.address || '',
        instagram: data.instagram || '',
        facebook: data.facebook || '',
        delivery_tax: data.delivery_tax || 0,
        min_order_value: data.min_order_value || 0,
        is_active: data.is_active ?? true,
        payment_methods: data.payment_methods || ['cash', 'card', 'transfer']
      };
    } catch (e) {
      console.warn('Erro ao obter restaurante por id, buscando local:', e);
      return getLocalData(`local_restaurant_${dbId}`, MOCK_RESTAURANT);
    }
  },

  async saveRestaurant(restaurant: Restaurant) {
    const dbId = restaurant.id === 'default' ? DEFAULT_RESTAURANT_ID : restaurant.id;
    setLocalData(`local_restaurant_${dbId}`, restaurant);
    triggerLocalUpdate(`rt-restaurant-${dbId}`);

    try {
      if (!isSupabaseHealthy) return;

      const payload = {
        name: restaurant.name,
        slug: restaurant.slug,
        theme_color: restaurant.theme_color,
        logo_url: restaurant.logo_url,
        cover_url: restaurant.cover_url,
        phone: restaurant.phone,
        address: restaurant.address,
        instagram: restaurant.instagram,
        facebook: restaurant.facebook,
        delivery_tax: restaurant.delivery_tax,
        min_order_value: restaurant.min_order_value,
        is_active: restaurant.is_active,
        payment_methods: restaurant.payment_methods
      };

      const { error } = await supabase
        .from('restaurants')
        .update(payload)
        .eq('id', dbId);

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
      console.log('🔄 Sincronizando dados do restaurante...', actualId);
      try {
        const data = await this.getRestaurantById(actualId);
        if (data && data.id !== actualId) {
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
        if (channel) supabase.removeChannel(channel);

        channel = supabase
          .channel(`public:restaurants:id=eq.${actualId}`)
          .on('postgres_changes', {
            event: 'UPDATE',
            schema: 'public',
            table: 'restaurants',
            filter: `id=eq.${actualId}`
          }, (payload) => {
            console.log('⚡ Mudança detectada no Restaurante (Realtime):', payload.eventType);
            fetch();
          })
          .subscribe();
      } catch (subscriptionErr) {
        console.error('Erro ao configurar realtime do restaurante:', subscriptionErr);
      }
    };

    fetch();
    setupSubscription();

    return () => {
      if (channel) {
        try {
          supabase.removeChannel(channel);
        } catch {}
      }
    };
  },

  // --- SEGMENTO DE CATEGORIAS ---
  async getCategories(restaurantId: string): Promise<Category[]> {
    const dbId = restaurantId === 'default' ? DEFAULT_RESTAURANT_ID : restaurantId;
    try {
      if (!isSupabaseHealthy) {
        const cached = getLocalData(`local_categories_${dbId}`, MOCK_CATEGORIES);
        return cached.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
      }

      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('restaurant_id', dbId)
        .order('order', { ascending: true });

      if (error) throw error;
      return (data || []).map(cat => ({
        id: cat.id,
        name: cat.name,
        order: cat.order
      }));
    } catch (e) {
      console.warn('Erro ao carregar categorias, retornando mock/local:', e);
      const cached = getLocalData(`local_categories_${dbId}`, MOCK_CATEGORIES);
      return cached.sort((a: any, b: any) => (a.order || 0) - (b.order || 0));
    }
  },

  async addCategory(restaurantId: string, name: string, orderValue: number): Promise<Category> {
    const dbId = restaurantId === 'default' ? DEFAULT_RESTAURANT_ID : restaurantId;
    const tempId = `cat_${Date.now()}`;
    const newCat: Category = { id: tempId, name, order: orderValue };

    const currentCached = getLocalData(`local_categories_${dbId}`, MOCK_CATEGORIES);
    setLocalData(`local_categories_${dbId}`, [...currentCached, newCat]);
    triggerLocalUpdate(`rt-categories-${dbId}`);

    try {
      if (!isSupabaseHealthy) return newCat;

      const { data, error } = await supabase
        .from('categories')
        .insert([{
          restaurant_id: dbId,
          name: name,
          order: orderValue
        }])
        .select()
        .single();

      if (error) throw error;
      
      const saved: Category = { id: data.id, name: data.name, order: data.order };
      const nonTemp = getLocalData(`local_categories_${dbId}`, MOCK_CATEGORIES).filter((c: any) => c.id !== tempId);
      setLocalData(`local_categories_${dbId}`, [...nonTemp, saved]);
      triggerLocalUpdate(`rt-categories-${dbId}`);
      return saved;
    } catch (e) {
      console.error('Inserido apenas localmente por erro ao adicionar categoria:', e);
      return newCat;
    }
  },

  async updateCategory(restaurantId: string, category: Category) {
    const dbId = restaurantId === 'default' ? DEFAULT_RESTAURANT_ID : restaurantId;
    const currentCached = getLocalData(`local_categories_${dbId}`, MOCK_CATEGORIES);
    const updated = currentCached.map((c: any) => c.id === category.id ? category : c);
    setLocalData(`local_categories_${dbId}`, updated);
    triggerLocalUpdate(`rt-categories-${dbId}`);

    try {
      if (!isSupabaseHealthy) return;

      const { error } = await supabase
        .from('categories')
        .update({
          name: category.name,
          order: category.order
        })
        .eq('id', category.id)
        .eq('restaurant_id', dbId);

      if (error) throw error;
    } catch (e) {
      console.error('Erro ao editar categoria no Supabase:', e);
    }
  },

  async deleteCategory(restaurantId: string, categoryId: string) {
    const dbId = restaurantId === 'default' ? DEFAULT_RESTAURANT_ID : restaurantId;
    const currentCached = getLocalData(`local_categories_${dbId}`, MOCK_CATEGORIES);
    setLocalData(`local_categories_${dbId}`, currentCached.filter((c: any) => c.id !== categoryId));
    triggerLocalUpdate(`rt-categories-${dbId}`);

    try {
      if (!isSupabaseHealthy) return 1;

      const { error } = await supabase
        .from('categories')
        .delete({ count: 'exact' })
        .eq('id', categoryId)
        .eq('restaurant_id', dbId);

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
        .channel(`public:categories:restaurant_id=eq.${dbId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'categories',
          filter: `restaurant_id=eq.${dbId}`
        }, (payload) => {
          console.log('⚡ Mudança detectada em Categorias (Realtime):', payload.eventType);
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

  // --- SEGMENTO DE PRODUTOS ---
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
      return (data || []).map(p => ({
        id: p.id,
        name: p.name,
        description: p.description || '',
        price: p.price,
        image: p.image || '',
        categoryId: p.category_id,
        isPromotion: p.is_promotion ?? false,
        isFeatured: p.is_featured ?? false,
        restaurantId: dbId
      }));
    } catch (e) {
      console.warn('Erro ao carregar produtos, usando mock local:', e);
      return getLocalData(`local_products_${dbId}`, MOCK_PRODUCTS);
    }
  },

  async addProduct(restaurantId: string, product: Omit<Product, 'id'>): Promise<Product> {
    const dbId = restaurantId === 'default' ? DEFAULT_RESTAURANT_ID : restaurantId;
    const tempId = `p_${Date.now()}`;
    const newProd: Product = { ...product, id: tempId, restaurantId: dbId };

    const currentCached = getLocalData(`local_products_${dbId}`, MOCK_PRODUCTS);
    setLocalData(`local_products_${dbId}`, [...currentCached, newProd]);
    triggerLocalUpdate(`rt-products-${dbId}`);

    try {
      if (!isSupabaseHealthy) return newProd;

      const { data, error } = await supabase
        .from('products')
        .insert([{
          restaurant_id: dbId,
          name: product.name,
          description: product.description,
          price: product.price,
          image: product.image,
          category_id: product.categoryId,
          is_promotion: product.isPromotion,
          is_featured: product.isFeatured
        }])
        .select()
        .single();

      if (error) throw error;

      const saved: Product = {
        id: data.id,
        name: data.name,
        description: data.description || '',
        price: data.price,
        image: data.image || '',
        categoryId: data.category_id,
        isPromotion: data.is_promotion ?? false,
        isFeatured: data.is_featured ?? false,
        restaurantId: dbId
      };

      const nonTemp = getLocalData(`local_products_${dbId}`, MOCK_PRODUCTS).filter((p: any) => p.id !== tempId);
      setLocalData(`local_products_${dbId}`, [...nonTemp, saved]);
      triggerLocalUpdate(`rt-products-${dbId}`);
      return saved;
    } catch (e) {
      console.error('Produto adicionado apenas localmente:', e);
      return newProd;
    }
  },

  async updateProduct(restaurantId: string, product: Product) {
    const dbId = restaurantId === 'default' ? DEFAULT_RESTAURANT_ID : restaurantId;
    const currentCached = getLocalData(`local_products_${dbId}`, MOCK_PRODUCTS);
    const updated = currentCached.map((p: any) => p.id === product.id ? product : p);
    setLocalData(`local_products_${dbId}`, updated);
    triggerLocalUpdate(`rt-products-${dbId}`);

    try {
      if (!isSupabaseHealthy) return;

      const { error } = await supabase
        .from('products')
        .update({
          name: product.name,
          description: product.description,
          price: product.price,
          image: product.image,
          category_id: product.categoryId,
          is_promotion: product.isPromotion,
          is_featured: product.isFeatured
        })
        .eq('id', product.id)
        .eq('restaurant_id', dbId);

      if (error) throw error;
    } catch (e) {
      console.error('Erro ao editar produto no Supabase:', e);
    }
  },

  async deleteProduct(restaurantId: string, productId: string) {
    const dbId = restaurantId === 'default' ? DEFAULT_RESTAURANT_ID : restaurantId;
    const currentCached = getLocalData(`local_products_${dbId}`, MOCK_PRODUCTS);
    setLocalData(`local_products_${dbId}`, currentCached.filter((p: any) => p.id !== productId));
    triggerLocalUpdate(`rt-products-${dbId}`);

    try {
      if (!isSupabaseHealthy) return 1;

      const { error } = await supabase
        .from('products')
        .delete({ count: 'exact' })
        .eq('id', productId)
        .eq('restaurant_id', dbId);

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
            price: p.price,
            image: p.image || '',
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
        console.warn('Erro ao assinar carregamento de produtos, usando local:', err);
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
        .channel(`public:products:restaurant_id=eq.${dbId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'products',
          filter: `restaurant_id=eq.${dbId}`
        }, (payload) => {
          console.log('⚡ Mudança detectada em Produtos (Realtime):', payload.eventType);
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

  // --- SEGMENTO DE QR CODES E RASTREIO DE ACESSOS ---
  async handleTableAccess(restaurantId: string, tableNumber: string): Promise<string> {
    const dbId = restaurantId === 'default' ? DEFAULT_RESTAURANT_ID : restaurantId;
    console.log(`👁️ Registando acesso à Mesa ${tableNumber} do Restaurante ${dbId}`);
    
    // Guardar rasto na sessão local
    const historic = getLocalData(`local_visits_${dbId}`, []);
    const newVisitNum = { id: `visit_${Date.now()}`, tableNumber, visitedAt: new Date().toISOString() };
    setLocalData(`local_visits_${dbId}`, [newVisitNum, ...historic].slice(0, 50));

    try {
      if (!isSupabaseHealthy) return '';

      const { data, error } = await supabase
        .from('menu_visits')
        .insert([{
          restaurant_id: dbId,
          table_number: tableNumber
        }])
        .select()
        .single();

      if (error) throw error;
      return data.id;
    } catch (e) {
      console.warn('Rastreio registado na memória apenas por offline ou erro:', e);
      return '';
    }
  },

  async getTableVisits(restaurantId: string): Promise<any[]> {
    const dbId = restaurantId === 'default' ? DEFAULT_RESTAURANT_ID : restaurantId;
    try {
      if (!isSupabaseHealthy) {
        return getLocalData(`local_visits_${dbId}`, []);
      }

      const { data, error } = await supabase
        .from('menu_visits')
        .select('*')
        .eq('restaurant_id', dbId)
        .order('visited_at', { ascending: false })
        .limit(100);

      if (error) throw error;
      return (data || []).map(v => ({
        id: v.id,
        tableNumber: v.table_number,
        visitedAt: v.visited_at
      }));
    } catch (err) {
      return getLocalData(`local_visits_${dbId}`, []);
    }
  },

  // --- SEGMENTO DE PEDIDOS ---
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
      tableNumber: o.table_number || '',
      items: (o.items || []).map((item: any) => ({
        id: item.id || Math.random().toString(),
        productId: item.productId,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        notes: item.notes
      })),
      total: o.total || 0,
      status: o.status || 'pending',
      paymentMethod: o.payment_method || 'cash',
      createdAt: o.created_at,
      paymentStatus: o.payment_status || 'pending',
      notes: o.notes || '',
      type: o.type || 'table',
      phone: o.phone || '',
      address: o.address || ''
    });

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
          .order('created_at', { ascending: false });

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
        console.warn('Erro ao assinar canal de pedidos, usando local:', err);
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

    let subscription: any = null;
    try {
      subscription = supabase
        .channel(`public:orders:restaurant_id=eq.${dbId}`)
        .on('postgres_changes', {
          event: '*',
          schema: 'public',
          table: 'orders',
          filter: `restaurant_id=eq.${dbId}`
        }, (payload) => {
          console.log('⚡ Mudança de Pedidos detetada pelo Realtime:', payload.eventType);
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

  async createOrder(restaurantId: string, orderData: Omit<Order, 'id' | 'createdAt'>): Promise<Order> {
    const dbId = restaurantId === 'default' ? DEFAULT_RESTAURANT_ID : restaurantId;
    const tempId = `ord_${Date.now()}`;
    const newOrder: Order = {
      ...orderData,
      id: tempId,
      createdAt: new Date().toISOString()
    };

    const currentCached = getLocalData(`local_orders_${dbId}`, []);
    setLocalData(`local_orders_${dbId}`, [newOrder, ...currentCached]);
    triggerLocalUpdate(`rt-orders-${dbId}`);

    try {
      if (!isSupabaseHealthy) return newOrder;

      // Sanitizar itens em formato JSON simples para a tabela Postgres
      const dbItems = orderData.items.map(item => ({
        productId: item.productId,
        name: item.name,
        price: item.price,
        quantity: item.quantity,
        notes: item.notes || ''
      }));

      const { data, error } = await supabase
        .from('orders')
        .insert([{
          restaurant_id: dbId,
          customer_name: orderData.customerName,
          table_number: orderData.tableNumber || null,
          items: dbItems,
          total: orderData.total,
          status: orderData.status,
          payment_method: orderData.paymentMethod,
          payment_status: orderData.paymentStatus || 'pending',
          notes: orderData.notes || '',
          type: orderData.type || 'table',
          phone: orderData.phone || '',
          address: orderData.address || ''
        }])
        .select()
        .single();

      if (error) throw error;

      const saved: Order = {
        id: data.id,
        customerName: data.customer_name,
        tableNumber: data.table_number || '',
        items: (data.items || []).map((x: any) => ({
          id: Math.random().toString(),
          productId: x.productId,
          name: x.name,
          price: x.price,
          quantity: x.quantity,
          notes: x.notes || ''
        })),
        total: data.total,
        status: data.status,
        paymentMethod: data.payment_method,
        createdAt: data.created_at,
        paymentStatus: data.payment_status || 'pending',
        notes: data.notes || '',
        type: data.type || 'table',
        phone: data.phone || '',
        address: data.address || ''
      };

      const nonTemp = getLocalData(`local_orders_${dbId}`, []).filter((o: any) => o.id !== tempId);
      setLocalData(`local_orders_${dbId}`, [saved, ...nonTemp]);
      triggerLocalUpdate(`rt-orders-${dbId}`);
      return saved;
    } catch (e) {
      console.warn('Pedido guardado apenas em sessão local:', e);
      return newOrder;
    }
  },

  async updateOrderStatus(restaurantId: string, orderId: string, status: Order['status'], paymentStatus?: Order['paymentStatus']) {
    const dbId = restaurantId === 'default' ? DEFAULT_RESTAURANT_ID : restaurantId;
    const currentCached = getLocalData(`local_orders_${dbId}`, []);
    const updated = currentCached.map((o: any) => {
      if (o.id === orderId) {
        return {
          ...o,
          status,
          paymentStatus: paymentStatus !== undefined ? paymentStatus : o.paymentStatus
        };
      }
      return o;
    });
    setLocalData(`local_orders_${dbId}`, updated);
    triggerLocalUpdate(`rt-orders-${dbId}`);

    try {
      if (!isSupabaseHealthy) return;

      const payload: any = { status };
      if (paymentStatus !== undefined) {
        payload.payment_status = paymentStatus;
      }

      const { error } = await supabase
        .from('orders')
        .update(payload)
        .eq('id', orderId)
        .eq('restaurant_id', dbId);

      if (error) throw error;
    } catch (e) {
      console.error('Erro ao atualizar status do pedido no Supabase:', e);
    }
  },

  async deleteOrder(restaurantId: string, orderId: string) {
    const dbId = restaurantId === 'default' ? DEFAULT_RESTAURANT_ID : restaurantId;
    const currentCached = getLocalData(`local_orders_${dbId}`, []);
    setLocalData(`local_orders_${dbId}`, currentCached.filter((o: any) => o.id !== orderId));
    triggerLocalUpdate(`rt-orders-${dbId}`);

    try {
      if (!isSupabaseHealthy) return 1;

      const { error } = await supabase
        .from('orders')
        .delete({ count: 'exact' })
        .eq('id', orderId)
        .eq('restaurant_id', dbId);

      if (error) throw error;
      return 1;
    } catch (e) {
      console.error('Erro ao excluir no Supabase:', e);
      return 1;
    }
  },

  // --- SEGMENTO DE MESAS DO GERENCIADOR ---
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
      
      const mapped = (data || []).map(t => ({
        id: t.id,
        number: t.number,
        seats: t.seats || 4,
        status: t.status || 'available',
        activeSession: t.active_session || undefined,
        activeClient: t.active_client || undefined
      }));

      return mapped.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
    } catch (err) {
      const cached = getLocalData(`local_tables_${dbId}`, []) as RestaurantTable[];
      return cached.sort((a, b) => a.number.localeCompare(b.number, undefined, { numeric: true }));
    }
  },

  async addTable(restaurantId: string, number: string, seats: number = 4): Promise<RestaurantTable> {
    const dbId = restaurantId === 'default' ? DEFAULT_RESTAURANT_ID : restaurantId;
    const tempId = `tab_${Date.now()}`;
    const newTable: RestaurantTable = { id: tempId, number, seats, status: 'available' };

    const currentCached = getLocalData(`local_tables_${dbId}`, []) as RestaurantTable[];
    const updated = [...currentCached, newTable];
    setLocalData(`local_tables_${dbId}`, updated);
    triggerLocalUpdate(`rt-tables-${dbId}`);

    try {
      if (!isSupabaseHealthy) return newTable;

      const { data, error } = await supabase
        .from('tables')
        .insert([{
          restaurant_id: dbId,
          number: number,
          seats: seats,
          status: 'available'
        }])
        .select()
        .single();

      if (error) throw error;

      const saved: RestaurantTable = {
        id: data.id,
        number: data.number,
        seats: data.seats || 4,
        status: data.status || 'available'
      };

      const nonTemp = (getLocalData(`local_tables_${dbId}`, []) as RestaurantTable[]).filter(t => t.id !== tempId);
      setLocalData(`local_tables_${dbId}`, [...nonTemp, saved]);
      triggerLocalUpdate(`rt-tables-${dbId}`);
      return saved;
    } catch (e) {
      console.error('Mesa criada temporariamente local por erro ou offline:', e);
      return newTable;
    }
  },

  async updateTable(restaurantId: string, table: RestaurantTable) {
    const dbId = restaurantId === 'default' ? DEFAULT_RESTAURANT_ID : restaurantId;
    const currentCached = getLocalData(`local_tables_${dbId}`, []) as RestaurantTable[];
    const updated = currentCached.map(t => t.id === table.id ? table : t);
    setLocalData(`local_tables_${dbId}`, updated);
    triggerLocalUpdate(`rt-tables-${dbId}`);

    try {
      if (!isSupabaseHealthy) return;

      const { error } = await supabase
        .from('tables')
        .update({
          number: table.number,
          seats: table.seats,
          status: table.status,
          active_session: table.activeSession || null,
          active_client: table.activeClient || null
        })
        .eq('id', table.id)
        .eq('restaurant_id', dbId);

      if (error) throw error;
    } catch (error) {
      console.error('Erro ao atualizar mesa no Supabase:', error);
    }
  },

  async deleteTable(restaurantId: string, tableId: string) {
    const dbId = restaurantId === 'default' ? DEFAULT_RESTAURANT_ID : restaurantId;
    const currentCached = getLocalData(`local_tables_${dbId}`, []) as RestaurantTable[];
    setLocalData(`local_tables_${dbId}`, currentCached.filter(t => t.id !== tableId));
    triggerLocalUpdate(`rt-tables-${dbId}`);

    try {
      if (!isSupabaseHealthy) return 1;

      const { error } = await supabase
        .from('tables')
        .delete({ count: 'exact' })
        .eq('id', tableId)
        .eq('restaurant_id', dbId);

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
          const mappedTables: RestaurantTable[] = data.map(t => ({
            id: t.id,
            number: t.number,
            seats: t.seats || 4,
            status: t.status || 'available',
            activeSession: t.active_session || undefined,
            activeClient: t.active_client || undefined
          }));

          mappedTables.sort((a, b) => 
            a.number.localeCompare(b.number, undefined, { numeric: true })
          );

          memoryCache[cacheKey] = mappedTables;
          callback(mappedTables);
        } else {
          memoryCache[cacheKey] = [];
          callback([]);
        }
      } catch (err) {
        console.warn('Erro ao restaurar mesas via realtime, usando cópia offline:', err);
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
        .channel(`public:tables:restaurant_id=eq.${dbId}`)
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
