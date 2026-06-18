import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { toast } from 'sonner';
import { 
  ShoppingCart, 
  Star, 
  Search, 
  ChevronRight, 
  ShoppingBag,
  Check,
  Volume2,
  VolumeX,
  Facebook,
  Instagram,
  Clock,
  MapPin,
  Calendar,
  Info,
  Utensils,
  Tag,
  ExternalLink,
  PhoneCall,
  MessageCircle
} from 'lucide-react';
import { Restaurant, Category, Product } from '../types';
import { restaurantService } from '../lib/supabaseService';
import { MOCK_RESTAURANT } from '../lib/mockDb';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle,
  DialogTrigger 
} from '@/components/ui/dialog';
import { getRestaurantStatus, days } from '../lib/statusUtils';
import CartDrawer from '../components/CartDrawer';
import AddToCartDialog from '../components/AddToCartDialog';
import { useCartStore } from '../lib/cartStore';
import { cn } from '@/lib/utils';

export default function MenuPage() {
  const { restaurantId, tableId } = useParams();
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [categories, setCategories] = useState<Category[]>([]);
  const [searchParams] = useSearchParams();
  const tableParam = tableId || searchParams.get('table');
  
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  
  // Sound preference state
  const [isSoundEnabled, setIsSoundEnabled] = useState(() => {
    const saved = localStorage.getItem('soundEnabled');
    return saved === null ? true : saved === 'true';
  });

  const isSoundEnabledRef = useRef(isSoundEnabled);

  useEffect(() => {
    localStorage.setItem('soundEnabled', String(isSoundEnabled));
    isSoundEnabledRef.current = isSoundEnabled;
  }, [isSoundEnabled]);

  const isInitialLoad = useRef(true);
  const lastNotificationTime = useRef(0);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  useEffect(() => {
    // Inicializa o objeto de áudio
    const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
    audio.volume = 0.8;
    audio.preload = 'auto';
    audioRef.current = audio;

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, []);
  const [lastAddedId, setLastAddedId] = useState<string | null>(null);
  const initialCategorySet = useRef(false);
  const unsubCatsRef = useRef<(() => void) | null>(null);
  const unsubProdsRef = useRef<(() => void) | null>(null);
  
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const cartItems = useCartStore(state => state.items);
  const cartCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);
  const cartTotal = useCartStore(state => state.total);
  const addItem = useCartStore(state => state.addItem);
  const [addingId, setAddingId] = useState<string | null>(null);

  const handleQuickAdd = (product: Product, e: React.MouseEvent) => {
    e.preventDefault();
    if (!isOpen) {
      toast.error('O restaurante está fechado no momento.');
      return;
    }

    setAddingId(product.id);
    addItem({
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity: 1
    });

    toast.success(`${product.name} no pedido!`, {
      description: 'Item adicionado com sucesso',
      position: 'top-center'
    });

    setLastAddedId(product.id);
    
    // Reset confirmation state after 2 seconds
    setTimeout(() => {
      setAddingId(null);
    }, 2000);
  };

  const [isScheduleOpen, setIsScheduleOpen] = useState(false);
  const [currentBannerIndex, setCurrentBannerIndex] = useState(0);

  useEffect(() => {
    if (restaurant?.bannerMode === 'carousel' && restaurant.banners) {
      const activeBanners = restaurant.banners.filter(b => !!b);
      if (activeBanners.length > 1) {
        const interval = setInterval(() => {
          setCurrentBannerIndex((prev) => (prev + 1) % activeBanners.length);
        }, 10000);
        return () => clearInterval(interval);
      }
    }
  }, [restaurant?.bannerMode, restaurant?.banners]);

  useEffect(() => {
    if (!restaurantId) {
      setIsLoading(false);
      return;
    }
    // Função para "desbloquear" o áudio e solicitar permissão de notificação no navegador após a primeira interação
    const unlockInteraction = () => {
      console.log('Interação detectada, desbloqueando recursos...');
      
      // 1. Áudio Principal
      if (audioRef.current) {
        audioRef.current.play()
          .then(() => {
            audioRef.current?.pause();
            if (audioRef.current) audioRef.current.currentTime = 0;
            console.log('Áudio principal desbloqueado');
          })
          .catch(e => console.log('Erro ao desbloquear áudio principal:', e));
      }

      // 2. Tenta desbloquear um Audio Context genérico (ajuda em alguns dispositivos móveis)
      try {
        const AudioContext = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioContext) {
          const context = new AudioContext();
          if (context.state === 'suspended') {
            context.resume();
          }
        }
      } catch (e) {
        console.warn('Erro ao desbloquear AudioContext:', e);
      }

      // 2. Notificações do Sistema
      if ('Notification' in window) {
        if (Notification.permission === 'default') {
          Notification.requestPermission().then(permission => {
            console.log('Permissão concedida:', permission);
            if (permission === 'granted') {
              new Notification('Notificações Ativadas!', {
                body: 'Você receberá avisos sobre novidades no cardápio aqui.',
                icon: restaurant?.logo || '/favicon.ico'
              });
            }
          });
        }
      }

      document.removeEventListener('click', unlockInteraction);
      document.removeEventListener('touchstart', unlockInteraction);
      document.removeEventListener('scroll', unlockInteraction);
    };

    document.addEventListener('click', unlockInteraction);
    document.addEventListener('touchstart', unlockInteraction, { passive: true });
    document.addEventListener('scroll', unlockInteraction, { passive: true });

    const unsubRestaurant = restaurantService.subscribeRestaurant(restaurantId, (r) => {
      setRestaurant(r);
      setIsLoading(false);
      
      // Se encontramos o restaurante, registra o acesso
      if (r && r.id) {
        restaurantService.logVisit(r.id);
        
        if (typeof unsubCatsRef.current === 'function') unsubCatsRef.current();
        if (typeof unsubProdsRef.current === 'function') unsubProdsRef.current();

        unsubCatsRef.current = restaurantService.subscribeCategories(r.id, (c) => {
          setCategories(c);
        });

        unsubProdsRef.current = restaurantService.subscribeProducts(r.id, (p) => {
          if (!isInitialLoad.current) {
            const now = Date.now();
            // Evita múltiplas notificações em um intervalo de 5 segundos
            if (now - lastNotificationTime.current > 5000) {
              // 1. Toast UI
              toast.info('Cardápio Atualizado!', {
                description: 'Novos pratos ou preços foram atualizados.',
                duration: 5000,
                icon: <div className="bg-rose-100 p-1.5 rounded-lg"><div className="w-2 h-2 bg-rose-600 rounded-full animate-ping" /></div>
              });
              
              // 2. Alerta sonoro
              if (isSoundEnabledRef.current) {
                try {
                  // Objeto de áudio principal pre-carregado
                  if (audioRef.current) {
                    audioRef.current.currentTime = 0;
                    audioRef.current.volume = 0.8;
                    const playPromise = audioRef.current.play();
                    
                    if (playPromise !== undefined) {
                      playPromise.catch(e => {
                        console.warn('Bloqueio de reprodução automática:', e);
                        // Fallback imediato com som nativo do sistema via notificação já lida pela barra
                      });
                    }
                  }
                } catch (err) {
                  console.error('Erro ao tocar som:', err);
                }
              }

              // 3. Notificação Nativa (Barra do Telefone / System Tray / Heads-up)
              if ('Notification' in window && Notification.permission === 'granted') {
                const notificationTitle = '🔔 NOVIDADE NO MENU!';
                const notificationOptions = {
                  body: 'Temos atualizações fresquinhas no cardápio! Deslize para ver agora.',
                  icon: restaurant?.logo || '/favicon.ico',
                  badge: '/favicon.ico',
                  vibrate: [500, 110, 500, 110, 450, 110, 200, 110, 170, 40, 450, 110, 200, 110, 170],
                  tag: 'menu-update-alert',
                  renotify: true, 
                  requireInteraction: true,
                  silent: !isSoundEnabledRef.current, // Se o som estiver ativado no app, o sistema toca o som padrão
                  data: {
                    url: window.location.href
                  }
                };

                // Tenta enviar via Service Worker (mais eficiente para o sistema mobile)
                if (navigator.serviceWorker.controller) {
                  navigator.serviceWorker.controller.postMessage({
                    type: 'SHOW_NOTIFICATION',
                    title: notificationTitle,
                    options: notificationOptions
                  });
                } else {
                  // Fallback para registro direto
                  navigator.serviceWorker.ready.then(registration => {
                    registration.showNotification(notificationTitle, notificationOptions);
                  });
                }
              }

              // 4. Vibração hática (Android/Mobile)
              if ('vibrate' in navigator) {
                navigator.vibrate([200, 100, 200]);
              }
              
              lastNotificationTime.current = now;
            }
          }
          setProducts(p);
          isInitialLoad.current = false;
        });
      }
    });

    return () => {
      unsubRestaurant();
      if (unsubCatsRef.current) unsubCatsRef.current();
      if (unsubProdsRef.current) unsubProdsRef.current();
      document.removeEventListener('click', unlockInteraction);
      document.removeEventListener('touchstart', unlockInteraction);
    };
  }, [restaurantId]);

  // Set initial category to the first one available instead of "All"
  useEffect(() => {
    if (categories.length > 0 && !initialCategorySet.current) {
      const sorted = [...categories].sort((a, b) => (a.order || 0) - (b.order || 0));
      if (sorted.length > 0) {
        setSelectedCategory(sorted[0].id);
        initialCategorySet.current = true;
      }
    }
  }, [categories]);

  const featuredProducts = products.filter(p => p.isFeatured && p.active);
  const promotionProducts = products.filter(p => p.isPromotion && p.active);
  const filteredProducts = products.filter(p => 
    p.active && (selectedCategory === 'all' || p.categoryId === selectedCategory)
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <div className="text-center space-y-4">
          <div className="w-12 h-12 border-4 border-rose-200 border-t-rose-600 rounded-full animate-spin mx-auto"></div>
          <p className="text-neutral-500 font-medium">Carregando cardápio...</p>
        </div>
      </div>
    );
  }

  if (!restaurant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-6">
        <div className="text-center space-y-4">
          <Utensils className="w-16 h-16 mx-auto text-neutral-200" />
          <h1 className="text-2xl font-black text-neutral-900">Restaurante não encontrado</h1>
          <p className="text-neutral-500">O cardápio que você procura pode ter sido removido ou o link está incorreto.</p>
          <Button variant="outline" className="rounded-full" render={<Link to="/login" />}>
            Acessar Painel
          </Button>
        </div>
      </div>
    );
  }

  const status = getRestaurantStatus(restaurant.openingHours);
  const isOpen = status.isOpen;

  return (
    <div className="min-h-screen bg-neutral-50 pb-24">
      {/* Status Bar */}
      <div className={cn(
        "py-2 px-4 text-center text-xs font-bold transition-colors duration-500",
        isOpen ? "bg-emerald-50 text-emerald-600" : "bg-rose-50 text-rose-600"
      )}>
        <div className="flex items-center justify-center gap-2">
          <div className={cn("w-2 h-2 rounded-full animate-pulse", isOpen ? "bg-emerald-500" : "bg-rose-500")} />
          {status.statusText}
        </div>
      </div>

      {/* Hero Section */}
      <header className="relative w-full h-[450px] sm:h-[700px] lg:h-[800px] overflow-hidden bg-neutral-900 border-b border-neutral-100 shadow-2xl">
        <AnimatePresence>
          {restaurant.bannerMode === 'carousel' && restaurant.banners && restaurant.banners.filter(b => !!b).length > 0 ? (
            <motion.img 
              key={currentBannerIndex}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 1.5, ease: "easeInOut" }}
              src={restaurant.banners.filter(b => !!b)[currentBannerIndex]} 
              alt={restaurant.name}
              className="absolute inset-0 w-full h-full object-cover object-center"
              referrerPolicy="no-referrer"
              loading="eager"
            />
          ) : (
            <img 
              src={restaurant.banner || 'https://images.unsplash.com/photo-1514362545857-3bc16c4c7d1b?auto=format&fit=crop&q=80&w=1920'} 
              alt={restaurant.name}
              className="absolute inset-0 w-full h-full object-cover object-center"
              referrerPolicy="no-referrer"
            />
          )}
        </AnimatePresence>
        
        {/* Cinematic Framing Overlay */}
        <div className="absolute inset-0 bg-black/40 z-10" />
        <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-transparent to-black/40 z-10" />

        {/* Top Controls */}
        <div className="absolute top-6 left-6 right-6 z-30 flex justify-between items-start pointer-events-none">
          <div className="flex gap-2">
            <Button 
              variant="ghost" 
              size="icon" 
              className="pointer-events-auto relative rounded-full bg-black/20 backdrop-blur-md text-white hover:bg-black/40 border border-white/10 w-10 h-10 sm:w-12 sm:h-12 shadow-xl"
              onClick={() => setIsCartOpen(true)}
            >
              <ShoppingBag className="w-5 h-5 sm:w-6 sm:h-6" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[9px] sm:text-[10px] font-black w-4.5 h-4.5 sm:w-5 sm:h-5 rounded-full flex items-center justify-center border-2 border-neutral-900 shadow-lg">
                  {cartCount}
                </span>
              )}
            </Button>

            {restaurant.directCallPhone && (
              <Button 
                variant="ghost" 
                size="icon" 
                className="pointer-events-auto relative rounded-full bg-emerald-500/20 backdrop-blur-md text-white hover:bg-emerald-500/40 border border-white/10 w-10 h-10 sm:w-12 sm:h-12 shadow-xl group overflow-hidden transition-all duration-500 hover:w-32 active:scale-95"
                onClick={() => window.open(`tel:${restaurant.directCallPhone}`)}
              >
                <div className="flex items-center gap-2 px-1">
                  <PhoneCall className="w-5 h-5 sm:w-6 sm:h-6 shrink-0" />
                  <span className="hidden group-hover:block text-[10px] sm:text-xs font-black uppercase whitespace-nowrap animate-in fade-in slide-in-from-left-2">Ligar agora</span>
                </div>
              </Button>
            )}
          </div>

          {restaurant.bannerMode === 'carousel' && restaurant.banners && restaurant.banners.filter(b => !!b).length > 1 && (
            <div className="flex gap-1.5 sm:gap-2 pt-3 sm:pt-5">
              {restaurant.banners.filter(b => !!b).map((_, i) => (
                <div 
                  key={i} 
                  className={cn(
                    "h-1 sm:h-1.5 rounded-full transition-all duration-500 shadow-sm",
                    i === currentBannerIndex ? "w-6 sm:w-8 bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)]" : "w-1 sm:w-1.5 bg-white/40"
                  )} 
                />
              ))}
            </div>
          )}
        </div>

        {/* Center Content: Logo + Text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center text-white p-4 sm:p-6 z-20">
          <div className="flex flex-col items-center w-full max-w-4xl mx-auto space-y-3.5 sm:space-y-6 md:space-y-8 -mt-10 sm:-mt-24">
            {/* Logo Wrapper */}
            <motion.div
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className="relative shrink-0"
            >
              <div className="p-1 rounded-full border-[2px] sm:border-[3px] border-white/20 backdrop-blur-md shadow-[0_20px_50px_rgba(0,0,0,0.5)]">
                <img 
                  src={restaurant.logo || undefined} 
                  alt="Logo"
                  className="w-24 h-24 sm:w-48 sm:h-48 rounded-full border border-white/50 object-cover bg-white"
                  referrerPolicy="no-referrer"
                />
              </div>
              <div className={cn(
                "absolute -bottom-1.5 sm:bottom-[-8px] left-1/2 -translate-x-1/2 px-4 py-1 sm:px-10 sm:py-2.5 rounded-full text-[9px] sm:text-[15px] font-black uppercase tracking-wider sm:tracking-widest shadow-2xl border border-white/20",
                isOpen ? "bg-[#00c5a3] text-white" : "bg-rose-600 text-white"
              )}>
                {isOpen ? 'Aberto' : 'Fechado'}
              </div>
            </motion.div>
            
            <div className="flex flex-col items-center space-y-2.5 sm:space-y-5 w-full">
              {/* Restaurant Name */}
              <motion.h1 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                className="text-3xl xs:text-4xl sm:text-7xl lg:text-9xl font-black tracking-tighter uppercase leading-none drop-shadow-[0_10px_30px_rgba(0,0,0,0.8)] text-center px-4"
              >
                {restaurant.name}
              </motion.h1>

              {/* Minimal Line Divider */}
              <motion.div 
                initial={{ scaleX: 0 }}
                animate={{ scaleX: 1 }}
                className="w-12 sm:w-40 h-1 sm:h-2 rounded-full shadow-lg"
                style={{ backgroundColor: restaurant.primaryColor }}
              />

              {/* Slogan & Description */}
              <div className="space-y-1.5 sm:space-y-4 max-w-2xl text-center px-6">
                {restaurant.slogan && (
                  <motion.p
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.1 }}
                    className="text-lg sm:text-3xl lg:text-5xl font-black italic opacity-100 drop-shadow-[0_8px_20px_rgba(0,0,0,0.8)] leading-tight"
                  >
                    "{restaurant.slogan}"
                  </motion.p>
                )}
                {restaurant.description && (
                  <motion.p
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    transition={{ delay: 0.12 }}
                    className="text-[15px] sm:text-2xl md:text-3xl font-black sm:font-bold opacity-95 leading-relaxed max-w-[300px] sm:max-w-2xl mx-auto drop-shadow-md text-neutral-100"
                  >
                    {restaurant.description}
                  </motion.p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Information Control Bar */}
        <div className="absolute bottom-6 sm:bottom-10 left-6 right-6 z-30 flex items-center justify-between pointer-events-none">
          
          {/* Rating (Bottom Left) - Smaller */}
          <div className="pointer-events-auto flex items-center gap-2 sm:gap-2.5 bg-black/60 backdrop-blur-2xl px-3.5 py-1.5 sm:px-5 sm:py-2.5 rounded-full border border-white/20 shadow-2xl transition-all hover:scale-105 hover:bg-black/70">
            <Star className="w-3.5 h-3.5 sm:w-5 sm:h-5 text-yellow-500 fill-current drop-shadow-[0_0_8px_rgba(234,179,8,0.3)]" />
            <span className="font-black text-xs sm:text-lg text-white tracking-tighter">{restaurant.rating}</span>
          </div>

          {/* Location / Address - Lowered to Bottom Center */}
          <div className="flex-1 flex justify-center px-4">
            {restaurant.address && (
              <motion.div 
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: 0.15 }}
                className="pointer-events-auto flex items-center gap-2 sm:gap-3 px-6 py-2.5 sm:px-10 sm:py-3.5 rounded-full border border-white/20 bg-black/60 backdrop-blur-md text-white shadow-xl hover:bg-black/70 transition-all cursor-default max-w-[160px] xs:max-w-[220px] sm:max-w-xl lg:max-w-2xl"
              >
                <MapPin className="w-4 h-4 sm:w-6 sm:h-6 text-rose-500 shrink-0" />
                <span className="text-[12px] sm:text-xl md:text-2xl font-black tracking-tight truncate">
                  {restaurant.address}
                </span>
              </motion.div>
            )}
          </div>

          {/* Social Links (Bottom Right) */}
          <motion.div 
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
            className="pointer-events-auto flex items-center gap-2.5 sm:gap-4"
          >
            {!!restaurant.socialLinks?.facebook && (
              <a href={restaurant.socialLinks.facebook} target="_blank" rel="noreferrer" className="w-9 h-9 sm:w-14 sm:h-14 flex items-center justify-center bg-white/95 backdrop-blur-md rounded-full shadow-2xl hover:scale-110 hover:bg-white active:scale-95 transition-all border border-white/20">
                <Facebook className="w-4.5 h-4.5 sm:w-7 sm:h-7 text-[#1877F2]" />
              </a>
            )}
            {!!restaurant.socialLinks?.instagram && (
              <a href={restaurant.socialLinks.instagram} target="_blank" rel="noreferrer" className="w-9 h-9 sm:w-14 sm:h-14 flex items-center justify-center bg-white/95 backdrop-blur-md rounded-full shadow-2xl hover:scale-110 hover:bg-white active:scale-95 transition-all border border-white/20">
                <Instagram className="w-4.5 h-4.5 sm:w-7 sm:h-7 text-[#E4405F]" />
              </a>
            )}
            {!!restaurant.socialLinks?.tiktok && (
              <a href={restaurant.socialLinks.tiktok} target="_blank" rel="noreferrer" className="w-9 h-9 sm:w-14 sm:h-14 flex items-center justify-center bg-white/95 backdrop-blur-md rounded-full shadow-2xl hover:scale-110 hover:bg-white active:scale-95 transition-all border border-white/20">
                <svg className="w-4.5 h-4.5 sm:w-7 sm:h-7 fill-black" viewBox="0 0 24 24"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.04-.1z"/></svg>
              </a>
            )}
          </motion.div>
        </div>
      </header>

      {/* Categories */}
      <div id="category-selector" className="sticky top-0 z-30 bg-white/95 backdrop-blur-xl border-b-2 border-neutral-100">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:py-6">
          <ScrollArea className="w-full whitespace-nowrap">
            <div className="flex gap-3 sm:gap-5 pb-1">
              {categories.slice().sort((a, b) => (a.order || 0) - (b.order || 0)).map((cat) => (
                <Button
                  key={cat.id}
                  variant={selectedCategory === cat.id ? 'default' : 'outline'}
                  className={cn(
                    "rounded-full px-6 sm:px-10 h-11 sm:h-14 font-black text-[12px] sm:text-lg uppercase tracking-widest transition-all border-2",
                    selectedCategory === cat.id 
                      ? "shadow-xl shadow-rose-200/40 border-transparent scale-105" 
                      : "text-neutral-600 border-neutral-200 hover:border-neutral-400 hover:bg-neutral-50"
                  )}
                  style={selectedCategory === cat.id ? { backgroundColor: restaurant.primaryColor } : {}}
                  onClick={() => setSelectedCategory(cat.id)}
                >
                  {cat.name}
                </Button>
              ))}
              <Button
                variant={selectedCategory === 'all' ? 'default' : 'outline'}
                className={cn(
                  "rounded-full px-6 sm:px-10 h-11 sm:h-14 font-black text-[12px] sm:text-lg uppercase tracking-widest transition-all border-2",
                  selectedCategory === 'all' 
                    ? "shadow-xl shadow-rose-200/40 border-transparent scale-105" 
                    : "text-neutral-600 border-neutral-200 hover:border-neutral-400 hover:bg-neutral-50"
                )}
                style={selectedCategory === 'all' ? { backgroundColor: restaurant.primaryColor } : {}}
                onClick={() => setSelectedCategory('all')}
              >
                Tudo
              </Button>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      </div>

      {/* Promotions List */}
      {promotionProducts.length > 0 && selectedCategory === 'all' && (
        <section className="max-w-7xl mx-auto px-4 pt-12 pb-2">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 rounded-2xl bg-rose-50">
              <Tag className="w-6 h-6 text-rose-600" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-neutral-900 tracking-tight flex items-center gap-2">
                Ofertas Imperdíveis
              </h2>
              <p className="text-neutral-500 font-medium">Preços especiais por tempo limitado</p>
            </div>
          </div>
          
          <div className="flex overflow-x-auto pb-6 gap-6 scrollbar-hide -mx-4 px-4 snap-x">
            {promotionProducts.map((product) => (
              <motion.div
                key={`promo-${product.id}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex-shrink-0 w-[280px] sm:w-[320px] snap-start"
              >
                <div className="group relative bg-white rounded-[2rem] overflow-hidden shadow-sm hover:shadow-xl transition-all duration-500 border border-neutral-100 h-full flex flex-col">
                  {product.oldPrice && product.oldPrice > product.price && (
                    <div className="absolute top-4 left-4 z-10">
                      <Badge className="bg-rose-600 text-white border-none rounded-full font-black px-3 py-1 shadow-sm uppercase tracking-wider text-[10px]">
                        -{Math.round((1 - product.price / product.oldPrice) * 100)}% OFF
                      </Badge>
                    </div>
                  )}
                  
                  <Link to={`/r/${restaurantId}/product/${product.id}`} className="block relative aspect-[4/3] overflow-hidden">
                    <img 
                      src={product.image || undefined} 
                      alt={product.name}
                      className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                      referrerPolicy="no-referrer"
                    />
                  </Link>

                  <div className="p-4 sm:p-6 flex flex-col flex-1">
                    <Link to={`/r/${restaurantId}/product/${product.id}`}>
                      <h3 className="font-black text-lg sm:text-xl text-neutral-900 group-hover:text-rose-600 transition-colors leading-tight mb-1">
                        {product.name}
                      </h3>
                    </Link>
                    <p className="text-neutral-600 text-xs sm:text-sm font-bold line-clamp-2 mb-4 flex-1">
                      {product.description}
                    </p>
                    <div className="flex items-center justify-between mt-auto">
                      <div className="flex flex-col">
                        {product.oldPrice && product.oldPrice > 0 && (
                          <span className="text-base sm:text-lg text-neutral-500 line-through font-black decoration-rose-500/50 decoration-2">
                             {formatCurrency(product.oldPrice)}
                          </span>
                        )}
                        <span className="font-black text-lg sm:text-xl text-rose-600">
                          {formatCurrency(product.price)}
                        </span>
                      </div>
                      <div className="flex flex-col gap-1 items-end">
                        <Button 
                          size="sm"
                          className={cn(
                            "rounded-xl transition-all shadow-md font-bold px-3 sm:px-4 h-9 sm:h-10 text-xs sm:text-sm flex items-center gap-1.5",
                            addingId === product.id ? "bg-emerald-500 hover:bg-emerald-600" : "bg-neutral-900 hover:bg-rose-600 text-white"
                          )}
                          style={addingId !== product.id ? { backgroundColor: restaurant.primaryColor } : {}}
                          onClick={(e) => handleQuickAdd(product, e)}
                        >
                          {addingId === product.id ? (
                            <>
                              <Check className="w-3.5 h-3.5" />
                              <span className="hidden xs:inline">Adicionado</span>
                            </>
                          ) : (
                            <>
                              <ShoppingCart className="w-3.5 h-3.5" />
                              Pedir
                            </>
                          )}
                        </Button>
                        {lastAddedId === product.id && (
                          <motion.button
                            initial={{ opacity: 0, y: -10 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="text-[10px] font-black text-rose-600 uppercase tracking-widest hover:underline"
                            onClick={() => setIsCartOpen(true)}
                          >
                            Ver Carrinho
                          </motion.button>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Featured Products List */}
      {featuredProducts.length > 0 && selectedCategory === 'all' && (
        <section className="max-w-7xl mx-auto px-4 pt-12 pb-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="p-2 rounded-2xl bg-amber-50">
              <Star className="w-6 h-6 text-amber-500 fill-amber-500" />
            </div>
            <div>
              <h2 className="text-3xl font-black text-neutral-900 tracking-tight flex items-center gap-2">
                Nossos Destaques
              </h2>
              <p className="text-neutral-500 font-medium">Os pratos favoritos da casa</p>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
            {featuredProducts.map((product) => (
              <motion.div
                layout
                key={`featured-${product.id}`}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                className="group relative bg-white rounded-[2rem] overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-500 border border-neutral-100 flex flex-col"
              >
                <div className="absolute top-4 left-4 z-10 flex flex-col gap-2">
                  <Badge className="bg-amber-100 text-amber-600 hover:bg-amber-100 border-amber-200 rounded-full font-black px-3 py-1 flex items-center gap-1 shadow-sm uppercase tracking-wider text-[10px]">
                    <Star className="w-3 h-3 fill-amber-500" /> Destaque
                  </Badge>
                  {product.isPromotion && (
                    <Badge className="bg-rose-600 text-white hover:bg-rose-600 border-none rounded-full font-black px-3 py-1 shadow-sm uppercase tracking-wider text-[10px]">
                      Oferta Especial
                    </Badge>
                  )}
                </div>

                <Link 
                  to={`/r/${restaurantId}/product/${product.id}`}
                  className="block relative aspect-square overflow-hidden cursor-pointer"
                >
                  <img 
                    src={product.image || undefined} 
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-end p-6">
                    <span className="text-white text-sm font-bold flex items-center gap-2 uppercase tracking-wider">
                      Ver detalhes <ChevronRight className="w-4 h-4" />
                    </span>
                  </div>
                </Link>
                <div className="p-6 flex flex-col flex-1">
                  <Link to={`/r/${restaurantId}/product/${product.id}`}>
                    <h3 className="font-black text-2xl text-neutral-900 group-hover:text-rose-600 transition-colors leading-tight mb-2">
                      {product.name}
                    </h3>
                  </Link>
                  <p className="text-neutral-600 text-base font-bold line-clamp-2 mb-6 flex-1">
                    {product.description}
                  </p>
                  <div className="flex items-center justify-between mt-auto">
                    <div className="flex flex-col">
                      {product.isPromotion && product.oldPrice && product.oldPrice > 0 && (
                        <span className="text-xl text-neutral-500 line-through font-black decoration-rose-500/50 decoration-2 mb-0.5">
                          {formatCurrency(product.oldPrice)}
                        </span>
                      )}
                      <span className="font-black text-2xl text-neutral-900">
                        {formatCurrency(product.price)}
                      </span>
                    </div>
                    <div className="flex flex-col gap-2 items-end">
                      <Button 
                        className={cn(
                          "rounded-2xl px-6 h-12 transition-all shadow-lg active:scale-95 font-bold flex items-center gap-2",
                          addingId === product.id ? "bg-emerald-500 hover:bg-emerald-600" : "bg-neutral-900 hover:bg-rose-600 text-white"
                        )}
                        style={addingId !== product.id ? { backgroundColor: restaurant.primaryColor } : {}}
                        onClick={(e) => handleQuickAdd(product, e)}
                      >
                        {addingId === product.id ? (
                          <>
                            <Check className="w-5 h-5" />
                            Adicionado
                          </>
                        ) : (
                          <>
                            <ShoppingCart className="w-5 h-5" />
                            Pedir
                          </>
                        )}
                      </Button>
                      {lastAddedId === product.id && (
                        <motion.button
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-[10px] font-black text-rose-600 uppercase tracking-widest hover:underline"
                          onClick={() => setIsCartOpen(true)}
                        >
                          Ver Carrinho
                        </motion.button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </section>
      )}

      {/* Products Grid */}
      <main className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h2 className="text-3xl font-black text-neutral-900 tracking-tight">
            {selectedCategory === 'all' ? 'Cardápio Completo' : categories.find(c => c.id === selectedCategory)?.name}
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-8">
          <AnimatePresence mode="popLayout">
            {filteredProducts.map((product) => (
              <motion.div
                layout
                key={product.id}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9 }}
                className="group relative bg-white rounded-[2rem] overflow-hidden shadow-sm hover:shadow-2xl transition-all duration-500 border border-neutral-100 flex flex-col"
              >
                {product.isPromotion && (
                  <div className="absolute top-4 left-4 z-10">
                    <Badge className="bg-rose-600 text-white hover:bg-rose-600 border-none rounded-full font-black px-3 py-1 shadow-sm uppercase tracking-wider text-[10px]">
                      PROMOÇÃO
                    </Badge>
                  </div>
                )}
                <Link 
                  to={`/r/${restaurantId}/product/${product.id}`}
                  className="block relative aspect-square overflow-hidden cursor-pointer"
                >
                  <img 
                    src={product.image || undefined} 
                    alt={product.name}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
                    referrerPolicy="no-referrer"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500 flex items-end p-6">
                    <span className="text-white text-sm font-bold flex items-center gap-2 uppercase tracking-wider">
                      Ver detalhes <ChevronRight className="w-4 h-4" />
                    </span>
                  </div>
                </Link>
                <div className="p-5 sm:p-6 flex flex-col flex-1">
                  <div className="flex justify-between items-start mb-2 sm:mb-3">
                    <Link to={`/r/${restaurantId}/product/${product.id}`}>
                      <h3 className="font-black text-xl sm:text-2xl text-neutral-900 group-hover:text-rose-600 transition-colors leading-tight">
                        {product.name}
                      </h3>
                    </Link>
                  </div>
                  <p className="text-neutral-600 text-sm sm:text-base font-bold line-clamp-1 sm:line-clamp-2 mb-4 sm:mb-6 flex-1">
                    {product.description}
                  </p>
                  <div className="flex items-center justify-between mt-auto">
                    <div className="flex flex-col">
                      {product.isPromotion && product.oldPrice && product.oldPrice > 0 && (
                        <span className="text-lg sm:text-xl text-neutral-500 line-through font-black decoration-rose-500/50 decoration-2 mb-0.5">
                          {formatCurrency(product.oldPrice)}
                        </span>
                      )}
                      <span className="font-black text-xl sm:text-2xl text-neutral-900">
                        {formatCurrency(product.price)}
                      </span>
                    </div>
                    <div className="flex flex-col gap-1 items-end">
                      <Button 
                        className={cn(
                          "rounded-2xl px-5 sm:px-6 h-10 sm:h-12 transition-all shadow-lg active:scale-95 font-bold text-sm flex items-center gap-2",
                          addingId === product.id ? "bg-emerald-500 hover:bg-emerald-600" : "bg-neutral-900 hover:bg-rose-600 text-white"
                        )}
                        style={addingId !== product.id ? { backgroundColor: restaurant.primaryColor } : {}}
                        onClick={(e) => handleQuickAdd(product, e)}
                      >
                        {addingId === product.id ? (
                          <>
                            <Check className="w-4 h-4 sm:w-5 sm:h-5" />
                            <span className="hidden xs:inline">Adicionado</span>
                          </>
                        ) : (
                          <>
                            <ShoppingCart className="w-4 h-4 sm:w-5 sm:h-5" />
                            Pedir
                          </>
                        )}
                      </Button>
                      {lastAddedId === product.id && (
                        <motion.button
                          initial={{ opacity: 0, y: -10 }}
                          animate={{ opacity: 1, y: 0 }}
                          className="text-[10px] font-black text-rose-600 uppercase tracking-widest hover:underline"
                          onClick={() => setIsCartOpen(true)}
                        >
                          Ver Carrinho
                        </motion.button>
                      )}
                    </div>
                  </div>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </main>

      {/* Footer / Admin Link */}
      <footer className="max-w-7xl mx-auto px-4 py-16 text-center border-t border-neutral-200 mt-20">
        <div className="flex flex-col items-center gap-6">
          <img src={restaurant.logo || undefined} className="w-12 h-12 rounded-full grayscale opacity-30" alt="" referrerPolicy="no-referrer" />
          <p className="text-neutral-400 text-sm font-medium">
            © 2026 {restaurant.name}. Todos os direitos reservados.
          </p>
          <Link 
            to="/admin" 
            className="text-[10px] font-black text-neutral-300 hover:text-rose-600 transition-colors uppercase tracking-[0.3em]"
          >
            Painel Administrativo
          </Link>
        </div>
      </footer>

      {/* Floating Cart Button */}
      {cartCount > 0 && (
        <motion.div 
          initial={{ y: 100 }}
          animate={{ y: 0 }}
          className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 w-full max-w-md px-6"
        >
          <Button 
            className="w-full h-20 rounded-[2rem] bg-rose-600 hover:bg-rose-700 text-white shadow-[0_20px_50px_rgba(225,29,72,0.3)] flex items-center justify-between px-8 transition-all active:scale-95"
            style={{ backgroundColor: restaurant.primaryColor }}
            onClick={() => setIsCartOpen(true)}
          >
            <div className="flex items-center gap-4">
              <div className="bg-white/20 p-3 rounded-2xl">
                <ShoppingBag className="w-7 h-7" />
              </div>
              <div className="text-left">
                <p className="text-[10px] opacity-80 uppercase font-black tracking-widest">Ver Carrinho</p>
                <p className="font-black text-lg">{cartCount} {cartCount === 1 ? 'item' : 'itens'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <span className="font-black text-2xl">{formatCurrency(cartTotal)}</span>
              <ChevronRight className="w-6 h-6" />
            </div>
          </Button>
        </motion.div>
      )}

      <AddToCartDialog 
        product={selectedProduct}
        restaurant={restaurant}
        isOpen={!!selectedProduct}
        onClose={() => setSelectedProduct(null)}
        onProductAdded={(id) => setLastAddedId(id)}
        onViewCart={() => setIsCartOpen(true)}
      />

      <CartDrawer 
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        whatsappNumber={restaurant.whatsapp}
        restaurant={restaurant}
        initialTableNumber={tableParam || undefined}
      />

      {/* Floating Action Buttons */}
      <div className="fixed bottom-6 left-6 z-40 flex flex-col gap-3">
        {restaurant.whatsapp && (
          <motion.a
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            href={`https://wa.me/${(restaurant.whatsapp || '').replace(/\D/g, '')}`}
            target="_blank"
            rel="noreferrer"
            className="w-14 h-14 bg-[#25D366] text-white rounded-full flex items-center justify-center shadow-2xl border-4 border-white hover:bg-[#20ba59] transition-colors"
          >
            <svg 
              viewBox="0 0 24 24" 
              className="w-8 h-8 fill-current" 
              xmlns="http://www.w3.org/2000/svg"
            >
              <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z" />
            </svg>
          </motion.a>
        )}
      </div>

      {/* Floating WhatsApp Button - Bottom Left */}
      {restaurant.whatsapp && (
        <div className="fixed bottom-6 left-6 z-50">
          <motion.a
            href={`https://wa.me/${restaurant.whatsapp.replace(/\D/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            whileHover={{ scale: 1.1 }}
            whileTap={{ scale: 0.9 }}
            className="flex items-center justify-center w-14 h-14 sm:w-16 sm:h-16 bg-[#25D366] text-white rounded-full shadow-2xl hover:shadow-[0_0_20px_rgba(37,211,102,0.4)] transition-all"
            title="Fale conosco no WhatsApp"
          >
            <MessageCircle className="w-8 h-8 sm:w-10 sm:h-10 fill-current" />
          </motion.a>
        </div>
      )}

      {/* Floating Sound Toggle - Discrete */}
      <div className="fixed bottom-6 right-6 z-50 pointer-events-none hidden sm:block">
        <motion.div 
          initial={{ scale: 0, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ delay: 1 }}
          className="pointer-events-auto"
        >
          <Button 
            variant="outline" 
            size="icon" 
            className={cn(
              "rounded-full w-10 h-10 shadow-lg border-neutral-200 backdrop-blur-md transition-all hover:scale-110 active:scale-95",
              isSoundEnabled ? "bg-white/90 text-rose-600" : "bg-neutral-100/90 text-neutral-400"
            )}
            onClick={() => {
              const newValue = !isSoundEnabled;
              setIsSoundEnabled(newValue);
              
              // Se ativou, toca um som de teste para "desbloquear" o áudio no navegador
              if (newValue && audioRef.current) {
                audioRef.current.currentTime = 0;
                audioRef.current.play().catch(() => {});
              }

              toast.info(newValue ? 'Sons Ativados' : 'Sons Desativados', {
                duration: 2000,
                position: 'top-center'
              });
            }}
            title={isSoundEnabled ? "Desativar sons" : "Ativar sons"}
          >
            {isSoundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
          </Button>
        </motion.div>
      </div>

      {/* Mobile Floating Sound Toggle */}
      <div className="fixed bottom-24 left-4 z-40 sm:hidden">
        <Button 
          variant="secondary" 
          size="icon" 
          className={cn(
            "rounded-full w-9 h-9 shadow-md border-neutral-100 transition-all",
            isSoundEnabled ? "bg-white text-rose-600" : "bg-neutral-100 text-neutral-400"
          )}
          onClick={() => {
            const newValue = !isSoundEnabled;
            setIsSoundEnabled(newValue);
            if (newValue && audioRef.current) {
              audioRef.current.currentTime = 0;
              audioRef.current.play().catch(() => {});
            }
          }}
        >
          {isSoundEnabled ? <Volume2 className="w-4 h-4" /> : <VolumeX className="w-4 h-4" />}
        </Button>
      </div>

      {/* Floating Status Button */}
      <div className="fixed bottom-24 right-6 z-40">
        <Dialog open={isScheduleOpen} onOpenChange={setIsScheduleOpen}>
          <DialogTrigger
            render={
              <motion.button
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={cn(
                  "flex items-center gap-2 px-5 py-3 rounded-full shadow-2xl border transition-all duration-300",
                  isOpen 
                    ? "bg-white text-emerald-600 border-emerald-100" 
                    : "bg-white text-rose-600 border-rose-100"
                )}
              >
                <div className={cn("w-2.5 h-2.5 rounded-full animate-pulse", isOpen ? "bg-emerald-500" : "bg-rose-500")} />
                <span className="font-bold text-sm tracking-tight">{status.message}</span>
                <Calendar className="w-4 h-4 ml-1 opacity-50" />
              </motion.button>
            }
          />
          <DialogContent className="sm:max-w-md rounded-[2.5rem] border-none shadow-2xl p-8 bg-white">
            <DialogHeader className="mb-6">
              <DialogTitle className="text-2xl font-black text-neutral-900 flex items-center gap-2">
                <Clock className="w-6 h-6 text-rose-600" />
                Horário de Funcionamento
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-3">
              {days.map((day) => {
                const config = restaurant.openingHours?.[day];
                const isToday = day === days[new Date().getDay()];
                
                return (
                  <div 
                    key={day} 
                    className={cn(
                      "flex items-center justify-between p-4 rounded-2xl transition-all",
                      isToday ? "bg-rose-50 border border-rose-100" : "bg-neutral-50"
                    )}
                  >
                    <span className={cn("font-bold text-sm", isToday ? "text-rose-600" : "text-neutral-700")}>
                      {day}
                      {isToday && <span className="ml-2 text-[10px] uppercase tracking-wider bg-rose-200 text-rose-700 px-2 py-0.5 rounded-full">Hoje</span>}
                    </span>
                    <span className="text-sm font-medium text-neutral-500">
                      {config?.active ? `${config.open} — ${config.close}` : <span className="text-rose-400 italic font-medium">Fechado</span>}
                    </span>
                  </div>
                );
              })}
            </div>

            {restaurant.hoursObservation && (
              <div className="mt-6 p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3 text-sm text-amber-700">
                <Info className="w-5 h-5 shrink-0 mt-0.5" />
                <p className="font-medium italic leading-relaxed">{restaurant.hoursObservation}</p>
              </div>
            )}
            
            <Button 
              className="w-full mt-8 h-12 rounded-2xl bg-neutral-900 hover:bg-black text-white font-bold transition-all shadow-lg active:scale-95"
              onClick={() => setIsScheduleOpen(false)}
            >
              Entendi
            </Button>
          </DialogContent>
        </Dialog>
      </div>
      {/* Hidden preloader for carousel banners */}
      {restaurant.bannerMode === 'carousel' && restaurant.banners && (
        <div className="hidden" aria-hidden="true">
          {restaurant.banners.filter(b => !!b).map((url, i) => (
            <img key={i} src={url} referrerPolicy="no-referrer" />
          ))}
        </div>
      )}
    </div>
  );
}
