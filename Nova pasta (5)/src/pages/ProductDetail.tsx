import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, Minus, Plus, ShoppingCart, Star, ChevronRight, Utensils, PhoneCall } from 'lucide-react';
import { Product, Restaurant } from '../types';
import { MOCK_RESTAURANT } from '../lib/mockDb';
import { formatCurrency } from '@/lib/utils';
import { restaurantService } from '../lib/supabaseService';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useCartStore } from '../lib/cartStore';
import CartDrawer from '../components/CartDrawer';
import { toast } from 'sonner';

export default function ProductDetail() {
  const { restaurantId, id } = useParams();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [quantity, setQuantity] = useState(1);
  const [isCartOpen, setIsCartOpen] = useState(false);

  const addItem = useCartStore(state => state.addItem);
  const cartItems = useCartStore(state => state.items);
  const cartCount = cartItems.reduce((acc, item) => acc + item.quantity, 0);
  const cartTotal = useCartStore(state => state.total);

  const initialProductLoad = useRef(false);
  const unsubProductRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!restaurantId || !id) return;

    const unsubRestaurant = restaurantService.subscribeRestaurant(restaurantId, (r) => {
      setRestaurant(r || MOCK_RESTAURANT);
      
      // Se resolveu o restaurante ou o ID mudou (slug), busca os produtos com o ID real
      if (r && r.id) {
        if (typeof unsubProductRef.current === 'function') unsubProductRef.current();
        
        unsubProductRef.current = restaurantService.subscribeProducts(r.id, (products) => {
          const found = products.find(p => p.id === id && p.active);
          if (found) {
            setProduct(found);
          } else {
            setProduct(null);
          }
        });
      }
    });

    return () => {
      if (unsubProductRef.current) unsubProductRef.current();
      unsubRestaurant();
    };
  }, [restaurantId, id]);

  const isInCart = cartItems.some(item => item.productId === product?.id);

  const handleAddToCart = () => {
    if (!product) return;
    
    if (isInCart) {
      setIsCartOpen(true);
      return;
    }
    
    addItem({
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity: quantity,
      notes: ''
    });
    
    toast.success(`${quantity}x ${product.name} adicionado ao carrinho!`);
  };

  if (!restaurantId || !id) return (
    <div className="min-h-screen flex items-center justify-center bg-white p-6">
      <div className="text-center space-y-4">
        <Utensils className="w-16 h-16 mx-auto text-neutral-200" />
        <h1 className="text-2xl font-black text-neutral-900">Link Inválido</h1>
        <p className="text-neutral-500">O produto que você procura não pode ser encontrado.</p>
        <Button variant="outline" className="rounded-full" onClick={() => navigate(-1)}>
          Voltar
        </Button>
      </div>
    </div>
  );

  if (!product || !restaurant) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <div className="flex flex-col items-center gap-4">
          <div className="w-12 h-12 border-4 border-rose-600 border-t-transparent rounded-full animate-spin" />
          <p className="text-neutral-500 font-bold animate-pulse">Carregando detalhes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white pb-32">
      {/* Header */}
      <div className="fixed top-0 left-0 right-0 z-50 p-4 flex justify-between items-center bg-gradient-to-b from-black/50 to-transparent">
        <Button 
          variant="ghost" 
          size="icon" 
          className="rounded-full bg-white/20 backdrop-blur-md text-white hover:bg-white/40"
          onClick={() => navigate(-1)}
        >
          <ChevronLeft className="w-6 h-6" />
        </Button>
        <div className="flex gap-2">
          {restaurant?.directCallPhone && (
            <Button 
              variant="ghost" 
              size="icon" 
              className="rounded-full bg-white/20 backdrop-blur-md text-white hover:bg-emerald-500/40"
              onClick={() => window.open(`tel:${restaurant.directCallPhone}`)}
            >
              <PhoneCall className="w-5 h-5 text-white" />
            </Button>
          )}
          <Button 
            variant="ghost" 
            size="icon" 
            className="relative rounded-full bg-white/20 backdrop-blur-md text-white hover:bg-white/40"
            onClick={() => setIsCartOpen(true)}
          >
            <ShoppingCart className="w-6 h-6" />
            {cartCount > 0 && (
              <span className="absolute -top-1 -right-1 bg-rose-600 text-white text-[10px] font-bold w-5 h-5 rounded-full flex items-center justify-center border-2 border-white/20">
                {cartCount}
              </span>
            )}
          </Button>
        </div>
      </div>

      {/* Hero Image */}
      <div className="relative h-[50vh] md:h-[60vh] overflow-hidden">
        <motion.img 
          initial={{ scale: 1.1 }}
          animate={{ scale: 1 }}
          src={product.image || undefined} 
          alt={product.name}
          className="w-full h-full object-cover"
          referrerPolicy="no-referrer"
        />
      </div>

      {/* Content */}
      <div className="relative -mt-8 bg-white rounded-t-[32px] p-6 md:p-12 max-w-4xl mx-auto shadow-2xl min-h-[40vh]">
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="flex flex-wrap gap-2 mb-2">
              {product.isFeatured && (
                <Badge className="bg-amber-100 text-amber-600 hover:bg-amber-100 border-amber-200 px-3 py-1 flex items-center gap-1">
                  <Star className="w-3 h-3 fill-amber-500" /> Destaque
                </Badge>
              )}
              {product.isPromotion && (
                <Badge className="bg-rose-600 text-white hover:bg-rose-600 border-none px-3 py-1">
                  OFERTA ESPECIAL
                </Badge>
              )}
              {!product.isFeatured && !product.isPromotion && (
                <Badge className="bg-rose-100 text-rose-600 hover:bg-rose-100 border-none px-3 py-1">
                  Sugestão da Casa
                </Badge>
              )}
            </div>
            <h1 className="text-3xl md:text-5xl font-bold text-neutral-900 mb-2">
              {product.name}
            </h1>
            <div className="flex items-center gap-2 text-neutral-500">
              <div className="flex items-center text-yellow-400">
                <Star className="w-4 h-4 fill-current" />
                <Star className="w-4 h-4 fill-current" />
                <Star className="w-4 h-4 fill-current" />
                <Star className="w-4 h-4 fill-current" />
                <Star className="w-4 h-4 fill-current" />
              </div>
              <span className="text-sm font-medium">(120+ avaliações)</span>
            </div>
          </div>
          <div className="text-right">
            {product.isPromotion && product.oldPrice && product.oldPrice > 0 && (
              <p className="text-2xl text-neutral-500 line-through font-black decoration-rose-500/50 decoration-2 mb-1">
                {formatCurrency(product.oldPrice)}
              </p>
            )}
            <p className="text-3xl font-bold text-rose-600">
              {formatCurrency(product.price)}
            </p>
          </div>
        </div>

        <div className="prose prose-neutral max-w-none mb-8">
          {product.description && (
            <p className="text-neutral-600 text-lg font-bold leading-relaxed mb-3">
              {product.description}
            </p>
          )}
          <p className="text-neutral-500 leading-relaxed">
            {product.fullDescription || "Nossa receita exclusiva utiliza apenas os melhores ingredientes locais, preparados com técnicas tradicionais para garantir o sabor autêntico que você merece. Perfeito para compartilhar ou saborear sozinho."}
          </p>
        </div>

        {/* Bottom Action Bar */}
        <div className="fixed bottom-0 left-0 right-0 z-40 p-4 sm:p-8 bg-white/95 backdrop-blur-2xl border-t border-neutral-100 shadow-[0_-15px_40px_rgba(0,0,0,0.12)]">
          <div className="max-w-4xl mx-auto flex items-center gap-3 sm:gap-6">
            {/* Quantity Selector - Compact and Professional */}
            {!isInCart && (
              <div className="flex items-center bg-neutral-100 p-1 rounded-2xl border border-neutral-200 shrink-0">
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="rounded-xl w-12 h-12 sm:w-14 sm:h-14 bg-white shadow-sm hover:bg-neutral-50 transition-colors active:scale-90"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                >
                  <Minus className="w-5 h-5 text-neutral-600" />
                </Button>
                <span className="text-xl sm:text-2xl font-black w-10 sm:w-12 text-center text-neutral-900">{quantity}</span>
                <Button 
                  variant="ghost" 
                  size="icon" 
                  className="rounded-xl w-12 h-12 sm:w-14 sm:h-14 bg-white shadow-sm hover:bg-neutral-50 transition-colors active:scale-90"
                  onClick={() => setQuantity(quantity + 1)}
                >
                  <Plus className="w-5 h-5 text-neutral-600" />
                </Button>
              </div>
            )}

            {/* Main Action Button - Full Width and Robust */}
            <Button 
              className="flex-1 h-14 sm:h-20 rounded-2xl sm:rounded-[28px] bg-neutral-900 hover:bg-neutral-800 text-white transition-all shadow-xl flex items-center justify-between px-5 sm:px-10 active:scale-[0.97] group overflow-hidden relative"
              onClick={handleAddToCart}
              style={{ backgroundColor: restaurant.primaryColor }}
            >
              <div className="flex items-center gap-2 sm:gap-4">
                {isInCart ? (
                  <div 
                    className="bg-white w-8 h-8 sm:w-11 sm:h-11 rounded-lg sm:rounded-xl flex items-center justify-center text-sm sm:text-lg font-black transition-transform group-hover:scale-110 shadow-md"
                    style={{ color: restaurant.primaryColor }}
                  >
                    {cartCount}
                  </div>
                ) : (
                  <ShoppingCart className="w-5 h-5 sm:w-7 sm:h-7 group-hover:scale-110 transition-transform" />
                )}
                <span className="text-sm sm:text-xl font-black uppercase tracking-tight">
                  {isInCart ? 'Ver Pedido' : 'Pedir'}
                </span>
              </div>
              
              <div className="flex items-center gap-2 sm:gap-4">
                <div className="w-[1px] h-6 sm:h-10 bg-white/30" />
                <span className="text-base sm:text-2xl font-black whitespace-nowrap">
                  {formatCurrency(isInCart ? cartTotal : product.price * quantity)}
                </span>
              </div>
              
              {/* Premium Glossy Effect */}
              <div className="absolute top-0 -left-[100%] w-full h-full bg-gradient-to-r from-transparent via-white/10 to-transparent skew-x-[-25deg] group-hover:left-[100%] transition-all duration-1000 ease-in-out pointer-events-none" />
            </Button>
          </div>
          
          {/* Safe Area spacing for mobile */}
          <div className="h-2 sm:hidden" />
        </div>
      </div>

      <CartDrawer 
        isOpen={isCartOpen}
        onClose={() => setIsCartOpen(false)}
        whatsappNumber={restaurant.whatsapp}
        restaurant={restaurant}
      />
    </div>
  );
}
