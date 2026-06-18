import { Restaurant, Category, Product, Order, RestaurantTable } from '../types';
import { supabase } from './supabase';

// Helper to map DB record to Restaurant type
export interface MenuVisit {
  id: string;
  restaurantId: string;
  visitedAt: string;
}

const mapRestaurant = (data: any): Restaurant => ({
  id: data.id,
  name: data.name || '',
  slogan: data.slogan || '',
  logo: data.logo || '',
  banner: data.banner || '',
  bannerMode: data.banner_mode,
  banners: data.banners || [],
  description: data.description || '',
  hours: data.hours || '',
  openingHours: data.opening_hours || {},
  hoursObservation: data.hours_observation || '',
  address: data.address || '',
  whatsapp: data.whatsapp || '',
  country: data.country || '',
  primaryColor: data.primary_color || '#e11d48',
  rating: Number(data.rating || 5),
  ownerUid: data.owner_uid,
  paymentMethods: (data.payment_methods && !Array.isArray(data.payment_methods)) ? data.payment_methods : {},
  orderTypes: (data.order_types && !Array.isArray(data.order_types)) ? data.order_types : {},
  socialLinks: (data.social_links && !Array.isArray(data.social_links)) ? data.social_links : {},
  managerPin: data.manager_pin || '',
  slug: data.slug || '',
  directCallPhone: data.direct_call_phone || '',
});

// Helper to map Restaurant type to DB record
const mapRestaurantToDB = (data: Partial<Restaurant>) => {
  const dbData: any = {};
  
  // Mapeamento rigoroso para bater com as colunas do SQL
  if (data.name !== undefined) dbData.name = data.name;
  if (data.slogan !== undefined) dbData.slogan = data.slogan;
  if (data.description !== undefined) dbData.description = data.description;
  if (data.address !== undefined) dbData.address = data.address;
  if (data.whatsapp !== undefined) dbData.whatsapp = data.whatsapp;
  if (data.country !== undefined) dbData.country = data.country;
  
  // Rating como número
  if (data.rating !== undefined) dbData.rating = Number(data.rating);
  
  // Horários
  if (data.hours !== undefined) dbData.opening_hours = data.hours;
  if (data.openingHours !== undefined) dbData.opening_hours = data.openingHours;
  if (data.hoursObservation !== undefined) dbData.hours_observation = data.hoursObservation;
  
  // Design e Cores
  if (data.primaryColor !== undefined) dbData.primary_color = data.primaryColor;
  if (data.bannerMode !== undefined) dbData.banner_mode = data.bannerMode;
  
  // JSONB Fields (Objetos para métodos de pagamento e tipos de pedido)
  if (data.banners !== undefined) dbData.banners = Array.isArray(data.banners) ? data.banners : [];
  if (data.paymentMethods !== undefined) dbData.payment_methods = data.paymentMethods || {};
  if (data.orderTypes !== undefined) dbData.order_types = data.orderTypes || {};
  if (data.socialLinks !== undefined) dbData.social_links = data.socialLinks || {};
  if (data.managerPin !== undefined) dbData.manager_pin = data.managerPin;
  if (data.slug !== undefined) dbData.slug = data.slug;
  if (data.directCallPhone !== undefined) dbData.direct_call_phone = data.directCallPhone;

  // Imagens
  if (data.logo !== undefined) dbData.logo = data.logo;
  if (data.banner !== undefined) dbData.banner = data.banner;

  return dbData;
};

const DEFAULT_RESTAURANT_ID = 'default';

export const restaurantService = {
  // --- RESTAURANT ---
  async getRestaurant(id: string): Promise<Restaurant | null> {
    // Se o ID for 'default', usamos o UUID fixo internamente
    const dbId = id === 'default' ? DEFAULT_RESTAURANT_ID : id;
    
    // Tenta buscar por ID (UUID)
    let { data, error } = await supabase
      .from('restaurants')
      .select('*')
      .eq('id', dbId)
      .maybeSingle();
      
    // Se não encontrou por ID, tenta buscar por SLUG
    if (!data && dbId !== DEFAULT_RESTAURANT_ID) {
      const { data: slugData, error: slugError } = await supabase
        .from('restaurants')
        .select('*')
        .eq('slug', dbId)
        .maybeSingle();
      
      if (slugData) {
        data = slugData;
        error = slugError;
      }
    }
    
    if (error || !data) return null;
    return mapRestaurant(data);
  },

  async updateRestaurant(id: string, data: Partial<Restaurant>) {
    const dbData = mapRestaurantToDB(data);
    const { data: userData } = await supabase.auth.getUser();
    
    if (!userData.user) throw new Error('Usuário não autenticado no Supabase');

    const dbId = id === 'default' ? DEFAULT_RESTAURANT_ID : id;

    const payload = { 
      ...dbData, 
      id: dbId,
      owner_uid: userData.user.id
    };

    console.log('Tentando salvar restaurante:', payload);

    const { error } = await supabase
      .from('restaurants')
      .upsert(payload, { onConflict: 'id' });
    
    if (error) {
      console.error('Erro detalhado do Supabase:', error);
      // Se o erro for de coluna ausente, orientamos o usuário
      if (error.message.includes('column') || error.message.includes('cache')) {
        throw new Error(`O banco de dados precisa ser atualizado. Rode o script SQL enviado pelo assistente. Erro original: ${error.message}`);
      }
      throw error;
    }
  },

  subscribeRestaurant(id: string, callback: (restaurant: Restaurant | null) => void) {
    const dbId = id === 'default' ? DEFAULT_RESTAURANT_ID : id;
    let actualId = dbId;
    let channel: any = null;
    
    const fetch = async () => {
      console.log('🔄 Sincronizando dados do restaurante...', actualId);
      try {
        const data = await this.getRestaurant(actualId);
        if (data && data.id !== actualId) {
          actualId = data.id;
          // Re-subscrever com o ID real se mudou (caso de slug)
          setupSubscription();
        }
        callback(data);
      } catch (err) {
        console.error('Erro em subscribeRestaurant fetch:', err);
        callback(null);
      }
    };

    const setupSubscription = () => {
      try {
        if (channel) {
          try {
            supabase.removeChannel(channel);
          } catch {}
        }
        
        channel = supabase
          .channel(`rt-restaurant-${actualId}`)
          .on('postgres_changes', { 
            event: '*', 
            schema: 'public', 
            table: 'restaurants',
            filter: `id=eq.${actualId}`
          }, (payload) => {
            console.log('⚡ Mudança detectada no Restaurante (Realtime):', payload.eventType);
            fetch();
          })
          .subscribe((status) => {
            console.log(`📡 Status da conexão Realtime (Restaurante): ${status}`);
          });
      } catch (subscriptionErr) {
        console.error('Erro ao configurar realtime do restaurante:', subscriptionErr);
      }
    };

    fetch();
    setupSubscription();

    return () => {
      try {
        if (channel) supabase.removeChannel(channel);
      } catch (err) {
        console.error('Erro ao fechar canal do restaurante:', err);
      }
    };
  },

  // --- STORAGE ---
  async uploadFile(bucket: string, path: string, file: File): Promise<string> {
    const { data, error } = await supabase.storage
      .from(bucket)
      .upload(path, file, {
        upsert: true
      });

    if (error) throw error;

    const { data: { publicUrl } } = supabase.storage
      .from(bucket)
      .getPublicUrl(data.path);

    return publicUrl;
  },

  // --- CATEGORIES ---
  async addCategory(restaurantId: string, category: Omit<Category, 'id'>) {
    const dbData: any = {
      restaurant_id: restaurantId,
      name: category.name,
      order: category.order || 0
    };

    // Adiciona imagem apenas se o campo existir no objeto
    if (category.image) dbData.image = category.image;

    const { data, error } = await supabase
      .from('categories')
      .insert([dbData])
      .select()
      .single();
    
    if (error) {
      console.error('Erro ao adicionar categoria:', error);
      if (error.message.includes('column') || error.message.includes('cache')) {
        throw new Error(`O banco de dados precisa ser atualizado (tabela categorias). Rode o script SQL. Erro: ${error.message}`);
      }
      throw error;
    }
    return data.id;
  },

  async updateCategory(restaurantId: string, categoryId: string, data: Partial<Category>) {
    const dbData: any = {};
    if (data.name !== undefined) dbData.name = data.name;
    if (data.order !== undefined) dbData.order = data.order;
    if (data.image !== undefined) dbData.image = data.image;

    const { error } = await supabase
      .from('categories')
      .update(dbData)
      .eq('id', categoryId)
      .eq('restaurant_id', restaurantId);
    
    if (error) {
      console.error('Erro ao atualizar categoria:', error);
      if (error.message.includes('column') || error.message.includes('cache')) {
        throw new Error(`O banco de dados precisa ser atualizado (tabela categorias). Rode o script SQL. Erro: ${error.message}`);
      }
      throw error;
    }
  },

  async deleteCategory(restaurantId: string, categoryId: string) {
    const { error, count } = await supabase
      .from('categories')
      .delete({ count: 'exact' })
      .eq('id', categoryId)
      .eq('restaurant_id', restaurantId);
    
    if (error) throw error;
    return count;
  },

  subscribeCategories(restaurantId: string, callback: (categories: Category[]) => void) {
    let channel: any = null;
    const fetch = async () => {
      if (!restaurantId || restaurantId === 'undefined') {
        callback([]);
        return;
      }

      console.log('🔄 Sincronizando categorias...', restaurantId);
      try {
        const { data, error } = await supabase
          .from('categories')
          .select('*')
          .eq('restaurant_id', restaurantId)
          .order('order', { ascending: true });
        
        if (error) {
          console.error('Erro ao buscar categorias:', error);
          callback([]);
          return;
        }

        if (data) {
          callback(data);
        } else {
          callback([]);
        }
      } catch (err) {
        console.error('Erro ao executar fetch de categorias:', err);
        callback([]);
      }
    };

    fetch();

    try {
      channel = supabase
        .channel(`rt-categories-${restaurantId}`)
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'categories',
          filter: `restaurant_id=eq.${restaurantId}`
        }, (payload) => {
          console.log('⚡ Mudança detectada em Categorias (Realtime):', payload.eventType);
          fetch();
        })
        .subscribe((status) => {
          console.log(`📡 Status da conexão Realtime (Categorias): ${status}`);
        });
    } catch (err) {
      console.error('Erro ao assinar canal realtime de categorias:', err);
    }

    return () => {
      try {
        if (channel) supabase.removeChannel(channel);
      } catch (err) {
        console.error('Erro ao fechar canal de categorias:', err);
      }
    };
  },

  // --- PRODUCTS ---
  async addProduct(restaurantId: string, product: Omit<Product, 'id'>) {
    const dbData: any = { 
      restaurant_id: restaurantId,
      name: product.name,
      description: product.description,
      price: product.price,
      old_price: product.oldPrice,
      image: product.image,
      active: product.active,
      category_id: product.categoryId,
      full_description: product.fullDescription,
      is_promotion: product.isPromotion,
      is_featured: product.isFeatured
    };
    
    const { data, error } = await supabase
      .from('products')
      .insert([dbData])
      .select()
      .single();
    
    if (error) {
      console.error('Erro ao adicionar produto:', error);
      if (error.message.includes('column') || error.message.includes('cache')) {
        throw new Error(`O banco de dados precisa ser atualizado (tabela produtos). Rode o script SQL. Erro: ${error.message}`);
      }
      throw error;
    }
    return data.id;
  },

  async updateProduct(restaurantId: string, productId: string, data: Partial<Product>) {
    const dbData: any = {};
    if (data.name !== undefined) dbData.name = data.name;
    if (data.description !== undefined) dbData.description = data.description;
    if (data.price !== undefined) dbData.price = data.price;
    if (data.oldPrice !== undefined) dbData.old_price = data.oldPrice;
    if (data.image !== undefined) dbData.image = data.image;
    if (data.active !== undefined) dbData.active = data.active;
    if (data.categoryId !== undefined) dbData.category_id = data.categoryId;
    if (data.fullDescription !== undefined) dbData.full_description = data.fullDescription;
    if (data.isPromotion !== undefined) dbData.is_promotion = data.isPromotion;
    if (data.isFeatured !== undefined) dbData.is_featured = data.isFeatured;

    const { error } = await supabase
      .from('products')
      .update(dbData)
      .eq('id', productId)
      .eq('restaurant_id', restaurantId);
    
    if (error) {
      console.error('Erro ao atualizar produto:', error);
      if (error.message.includes('column') || error.message.includes('cache')) {
        throw new Error(`O banco de dados precisa ser atualizado (tabela produtos). Rode o script SQL. Erro: ${error.message}`);
      }
      throw error;
    }
  },

  async deleteProduct(restaurantId: string, productId: string) {
    const { error, count } = await supabase
      .from('products')
      .delete({ count: 'exact' })
      .eq('id', productId)
      .eq('restaurant_id', restaurantId);
    
    if (error) throw error;
    return count;
  },

  subscribeProducts(restaurantId: string, callback: (products: Product[]) => void) {
    let channel: any = null;
    const fetch = async () => {
      if (!restaurantId || restaurantId === 'undefined') {
        callback([]);
        return;
      }

      console.log('🔄 Sincronizando produtos...', restaurantId);
      try {
        const { data, error } = await supabase
          .from('products')
          .select('*')
          .eq('restaurant_id', restaurantId);
        
        if (error) {
          console.error('Erro ao buscar produtos:', error);
          callback([]);
          return;
        }

        if (data) {
          callback(data.map(p => ({
            id: p.id,
            name: p.name,
            description: p.description,
            fullDescription: p.full_description,
            price: Number(p.price),
            oldPrice: p.old_price ? Number(p.old_price) : undefined,
            image: p.image,
            active: p.active,
            categoryId: p.category_id,
            isPromotion: p.is_promotion,
            isFeatured: p.is_featured
          })));
        } else {
          callback([]);
        }
      } catch (err) {
        console.error('Erro ao executar fetch de produtos:', err);
        callback([]);
      }
    };

    fetch();

    try {
      channel = supabase
        .channel(`rt-products-${restaurantId}`)
        .on('postgres_changes', { 
          event: '*', 
          schema: 'public', 
          table: 'products',
          filter: `restaurant_id=eq.${restaurantId}`
        }, (payload) => {
          console.log('⚡ Mudança detectada em Produtos (Realtime):', payload.eventType);
          fetch();
        })
        .subscribe((status) => {
          console.log(`📡 Status da conexão Realtime (Produtos): ${status}`);
        });
    } catch (err) {
      console.error('Erro ao assinar canal realtime de produtos:', err);
    }

    return () => {
      try {
        if (channel) supabase.removeChannel(channel);
      } catch (err) {
        console.error('Erro ao fechar canal de produtos:', err);
      }
    };
  },

  // --- ORDERS ---
  async saveOrder(restaurantId: string, order: Omit<Order, 'id'>) {
    console.log('📝 Salvando pedido no banco de dados:', restaurantId);
    
    // Normalização do ID para UUID se necessário
    const dbId = restaurantId === 'default' ? DEFAULT_RESTAURANT_ID : restaurantId;

    // Mapeamento limpo para o banco de dados
    const dbData = {
      restaurant_id: dbId,
      customer_name: order.customerName || 'Cliente',
      customer_phone: order.customerPhone || '',
      customer_address: order.customerAddress || '',
      delivery_method: order.deliveryMethod || 'delivery',
      table_number: order.tableNumber || '',
      payment_method: order.paymentMethod || 'money',
      transfer_proof: order.transferProof || '',
      items: order.items || [],
      total: Number(order.total || 0),
      status: order.status || 'pending',
      created_at: new Date().toISOString()
    };

    const { error, data } = await supabase
      .from('orders')
      .insert([dbData])
      .select();
    
    if (error) {
      console.error('❌ Erro ao salvar pedido:', error);
      throw error;
    }
    
    console.log('✅ Pedido salvo com sucesso:', data);
    return true;
  },

  async updateOrderStatus(restaurantId: string, orderId: string, status: Order['status']) {
    const { error } = await supabase
      .from('orders')
      .update({ status })
      .eq('id', orderId);
    
    if (error) throw error;
  },

  async deleteOrder(restaurantId: string, orderId: string) {
    const { error, count } = await supabase
      .from('orders')
      .delete({ count: 'exact' })
      .eq('id', orderId);
    
    if (error) throw error;
    return count;
  },

  async logVisit(restaurantId: string) {
    const dbId = restaurantId === 'default' ? DEFAULT_RESTAURANT_ID : restaurantId;
    
    const sessionKey = `vst_${dbId}`;
    const lastVisit = sessionStorage.getItem(sessionKey);
    const now = Date.now();
    
    if (lastVisit && now - parseInt(lastVisit) < 3600000) return;

    try {
      await supabase.from('restaurant_visits').insert({
        restaurant_id: dbId
      });
      sessionStorage.setItem(sessionKey, now.toString());
    } catch (e) {
      console.error('Erro ao registrar visita:', e);
    }
  },

  async getVisits(restaurantId: string): Promise<MenuVisit[]> {
    const dbId = restaurantId === 'default' ? DEFAULT_RESTAURANT_ID : restaurantId;
    const { data, error } = await supabase
      .from('restaurant_visits')
      .select('*')
      .eq('restaurant_id', dbId)
      .order('visited_at', { ascending: false });

    if (error) return [];
    return data.map(v => ({
      id: v.id,
      restaurantId: v.restaurant_id,
      visitedAt: v.visited_at
    }));
  },

  subscribeOrders(restaurantId: string, callback: (orders: Order[]) => void) {
    const dbId = restaurantId === 'default' ? DEFAULT_RESTAURANT_ID : restaurantId;
    let localOrders: Order[] = [];

    const mapOrder = (o: any): Order => ({
      id: o.id,
      customerName: o.customer_name || 'Cliente',
      customerPhone: o.customer_phone || '',
      customerAddress: o.customer_address || '',
      deliveryMethod: (o.delivery_method || 'delivery') as any,
      tableNumber: o.table_number || '',
      paymentMethod: (o.payment_method || 'money') as any,
      transferProof: o.transfer_proof || '',
      items: o.items || [],
      total: Number(o.total || 0),
      status: (o.status || 'pending') as any,
      createdAt: o.created_at
    });

    const fetch = async () => {
      // SEGURANÇA: Se não houver ID, não busca nada para evitar vazamento de dados
      if (!dbId || dbId === 'undefined') {
        callback([]);
        return;
      }

      let query = supabase
        .from('orders')
        .select('*')
        .eq('restaurant_id', dbId) // Filtro obrigatório
        .order('created_at', { ascending: false })
        .limit(200); 
      
      const { data, error } = await query;
      if (error) {
        console.error('Erro ao buscar pedidos:', error);
        return;
      }
      
      if (data) {
        localOrders = data.map(mapOrder);
        callback([...localOrders]);
      } else {
        callback([]);
      }
    };

    fetch();

    const subscription = supabase
      .channel(`rt-orders-${dbId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'orders',
        filter: dbId !== DEFAULT_RESTAURANT_ID ? `restaurant_id=eq.${dbId}` : undefined
      }, (payload) => {
        console.log('⚡ Evento realtime recebido:', payload.eventType);
        
        if (payload.eventType === 'INSERT') {
          const newOrder = mapOrder(payload.new);
          localOrders = [newOrder, ...localOrders].slice(0, 200);
          callback([...localOrders]);
        } else if (payload.eventType === 'UPDATE') {
          const updatedOrder = mapOrder(payload.new);
          localOrders = localOrders.map(o => o.id === updatedOrder.id ? updatedOrder : o);
          callback([...localOrders]);
        } else if (payload.eventType === 'DELETE') {
          localOrders = localOrders.filter(o => o.id !== payload.old.id);
          callback([...localOrders]);
        } else {
          // Fallback para outros casos (raro)
          fetch();
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  },

  // --- TABLES ---
  async addTable(restaurantId: string, table: Omit<RestaurantTable, 'id' | 'createdAt'>) {
    const dbId = restaurantId === 'default' ? DEFAULT_RESTAURANT_ID : restaurantId;
    const { data, error } = await supabase
      .from('tables')
      .insert([{
        restaurant_id: dbId,
        number: table.number,
        status: table.status,
        qr_code_url: table.qrCodeUrl
      }])
      .select()
      .single();
    
    if (error) {
      console.error('Erro ao adicionar mesa:', error);
      throw error;
    }
    return data.id;
  },

  async updateTable(restaurantId: string, tableId: string, data: Partial<RestaurantTable>) {
    const dbId = restaurantId === 'default' ? DEFAULT_RESTAURANT_ID : restaurantId;
    const dbData: any = {};
    if (data.number !== undefined) dbData.number = data.number;
    if (data.status !== undefined) dbData.status = data.status;
    if (data.qrCodeUrl !== undefined) dbData.qr_code_url = data.qrCodeUrl;

    const { error } = await supabase
      .from('tables')
      .update(dbData)
      .eq('id', tableId)
      .eq('restaurant_id', dbId);
    
    if (error) {
      console.error('Erro ao atualizar mesa:', error);
      throw error;
    }
  },

  async deleteTable(restaurantId: string, tableId: string) {
    const dbId = restaurantId === 'default' ? DEFAULT_RESTAURANT_ID : restaurantId;
    const { error, count } = await supabase
      .from('tables')
      .delete({ count: 'exact' })
      .eq('id', tableId)
      .eq('restaurant_id', dbId);
    
    if (error) {
      console.error('Erro ao excluir mesa:', error);
      throw error;
    }
    return count;
  },

  subscribeTables(restaurantId: string, callback: (tables: RestaurantTable[]) => void) {
    const dbId = restaurantId === 'default' ? DEFAULT_RESTAURANT_ID : restaurantId;
    
    const fetchTables = async () => {
      if (!dbId || dbId === 'undefined') {
        callback([]);
        return;
      }

      const { data, error } = await supabase
        .from('tables')
        .select('*')
        .eq('restaurant_id', dbId)
        .order('number', { ascending: true });
      
      if (error) {
        console.error('Erro ao buscar mesas:', error);
        return;
      }

      if (data) {
        const mappedTables = data.map(t => ({
          id: t.id,
          restaurantId: t.restaurant_id,
          number: t.number,
          status: t.status as any,
          qrCodeUrl: t.qr_code_url,
          createdAt: t.created_at
        }));

        mappedTables.sort((a, b) => 
          a.number.localeCompare(b.number, undefined, { numeric: true })
        );

        callback(mappedTables);
      } else {
        callback([]);
      }
    };

    fetchTables();

    const subscription = supabase
      .channel(`rt-tables-${dbId}`)
      .on('postgres_changes', { 
        event: '*', 
        schema: 'public', 
        table: 'tables',
        filter: `restaurant_id=eq.${dbId}`
      }, () => {
        fetchTables();
      })
      .subscribe();

    return () => {
      supabase.removeChannel(subscription);
    };
  }
};
