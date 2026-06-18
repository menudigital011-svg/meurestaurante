import { useState } from 'react';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogFooter 
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Minus, Plus, ShoppingCart, Star, ChevronRight } from 'lucide-react';
import { Restaurant, Product } from '../types';
import { useCartStore } from '../lib/cartStore';
import { formatCurrency } from '../lib/utils';
import { toast } from 'sonner';

interface AddToCartDialogProps {
  product: Product | null;
  restaurant?: Restaurant | null;
  isOpen: boolean;
  onClose: () => void;
  onProductAdded?: (productId: string) => void;
  onViewCart?: () => void;
}

export default function AddToCartDialog({ product, restaurant, isOpen, onClose, onProductAdded, onViewCart }: AddToCartDialogProps) {
  const [quantity, setQuantity] = useState(1);
  const addItem = useCartStore(state => state.addItem);
  const cartItems = useCartStore(state => state.items);

  if (!product) return null;

  const isInCart = cartItems.some(item => item.productId === product.id);

  const handleAdd = () => {
    if (isInCart && onViewCart) {
      onViewCart();
      onClose();
      return;
    }
    
    addItem({
      productId: product.id,
      name: product.name,
      price: product.price,
      quantity: quantity,
      notes: ''
    });
    toast.success(`${product.name} adicionado ao carrinho!`, {
      description: `${quantity}x por ${formatCurrency(product.price * quantity)}`,
    });
    
    if (onProductAdded) {
      onProductAdded(product.id);
    }
    
    onClose();
    setQuantity(1);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="w-[92%] sm:max-w-[425px] rounded-[32px] p-0 overflow-hidden border-none focus-visible:outline-none">
        <div className="h-40 sm:h-52 w-full relative">
          <img 
            src={product.image || undefined} 
            alt={product.name} 
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          <div className="absolute bottom-4 left-5 right-5 sm:left-8 sm:right-8">
            <h2 className="text-2xl sm:text-4xl font-black text-white drop-shadow-lg leading-tight uppercase">{product.name}</h2>
            <div className="flex items-center gap-2 mt-1 sm:mt-2">
              <div className="flex items-center text-yellow-400">
                <Star className="w-3.5 h-3.5 fill-current" />
                <Star className="w-3.5 h-3.5 fill-current" />
                <Star className="w-3.5 h-3.5 fill-current" />
                <Star className="w-3.5 h-3.5 fill-current" />
                <Star className="w-3.5 h-3.5 fill-current" />
              </div>
              <span className="text-white text-[10px] sm:text-xs font-black drop-shadow-md">(120+ críticas)</span>
            </div>
          </div>
        </div>

        <div className="p-5 sm:p-8 space-y-5 sm:space-y-6">
          <div className="flex items-center justify-between">
            <span className="text-rose-600 text-xl sm:text-2xl font-black tracking-tight">{formatCurrency(product.price)}</span>
            <Badge className="bg-emerald-50 text-emerald-600 border-emerald-100 rounded-full font-black px-3 py-1 text-[10px] uppercase tracking-wider">Disponível</Badge>
          </div>

          <div className="prose prose-neutral max-w-none">
            {product.description && (
              <p className="text-neutral-900 text-sm sm:text-base font-black leading-snug mb-2 sm:mb-3">
                {product.description}
              </p>
            )}
            <p className="text-neutral-500 text-xs sm:text-sm font-bold leading-relaxed opacity-80">
              {product.fullDescription || "Nossa receita exclusiva utiliza apenas os melhores ingredientes locais, preparados com técnicas tradicionais para garantir o sabor autêntico que você merece."}
            </p>
          </div>

          {!isInCart && (
            <div className="flex items-center justify-between bg-neutral-50 p-4 sm:p-5 rounded-3xl border border-neutral-100 transition-all hover:border-neutral-200">
              <span className="font-black text-neutral-900 text-sm sm:text-lg uppercase tracking-tight">Qtd</span>
              <div className="flex items-center gap-4 sm:gap-6">
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="rounded-full w-9 h-9 sm:w-11 sm:h-11 border-2 border-neutral-200 hover:border-rose-400 hover:text-rose-600 transition-all"
                  onClick={() => setQuantity(Math.max(1, quantity - 1))}
                >
                  <Minus className="w-4 h-4 sm:w-5 sm:h-5 font-black" />
                </Button>
                <span className="font-black text-xl sm:text-2xl w-6 sm:w-10 text-center text-neutral-900">{quantity}</span>
                <Button 
                  variant="outline" 
                  size="icon" 
                  className="rounded-full w-9 h-9 sm:w-11 sm:h-11 border-2 border-neutral-200 hover:border-rose-400 hover:text-rose-600 transition-all"
                  onClick={() => setQuantity(quantity + 1)}
                >
                  <Plus className="w-4 h-4 sm:w-5 sm:h-5 font-black" />
                </Button>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="p-5 sm:p-8 pt-0">
          <Button 
            className="w-full h-14 sm:h-16 rounded-[20px] sm:rounded-[24px] bg-rose-600 hover:bg-rose-700 text-white font-black text-lg sm:text-xl gap-2 sm:gap-3 shadow-xl shadow-rose-200 active:scale-95 transition-all"
            style={restaurant?.primaryColor ? { backgroundColor: restaurant.primaryColor } : {}}
            onClick={handleAdd}
          >
            {isInCart ? (
              <>Ir para o Carrinho <ChevronRight className="w-5 h-5 sm:w-6 sm:h-6" /></>
            ) : (
              <>Adicionar ao Pedido <ShoppingCart className="w-5 h-5 sm:w-6 sm:h-6" /></>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
