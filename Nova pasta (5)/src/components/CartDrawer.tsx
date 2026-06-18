import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ArrowLeft,
  X, 
  Minus, 
  Plus, 
  ShoppingBag, 
  Utensils, 
  Store, 
  Truck, 
  CreditCard, 
  Upload,
  CheckCircle2,
  ChevronRight,
  MessageSquare,
  Search
} from 'lucide-react';
import { Product, OrderItem, Order, Restaurant, RestaurantTable } from '../types';
import { useCartStore } from '../lib/cartStore';
import { restaurantService } from '../lib/supabaseService';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Separator } from '@/components/ui/separator';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';

interface CartDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  whatsappNumber: string;
  restaurant: Restaurant;
  initialTableNumber?: string;
}

type Step = 'cart' | 'method' | 'details' | 'payment' | 'success';

export default function CartDrawer({ isOpen, onClose, whatsappNumber, restaurant, initialTableNumber }: CartDrawerProps) {
  const { items, removeItem, updateQuantity, clearCart, total } = useCartStore();
  const [step, setStep] = useState<Step>('cart');
  const [deliveryMethod, setDeliveryMethod] = useState<'table' | 'counter' | 'delivery' | null>(initialTableNumber ? 'table' : null);
  const [paymentMethod, setPaymentMethod] = useState<'delivery' | 'transfer'>('delivery');
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [tipAmount, setTipAmount] = useState<number>(0);
  const [selectedTipPercentage, setSelectedTipPercentage] = useState<number | 'custom' | null>(null);
  const [selectedDeliveryLocation, setSelectedDeliveryLocation] = useState<{ city: string; fee: number } | null>(null);
  const [customerData, setCustomerData] = useState({
    name: '',
    phone: '',
    address: '',
    tableNumber: initialTableNumber || ''
  });
  const [transferProof, setTransferProof] = useState<File | null>(null);

  useEffect(() => {
    if (initialTableNumber) {
      setCustomerData(prev => ({ ...prev, tableNumber: initialTableNumber }));
      setDeliveryMethod('table');
    }
  }, [initialTableNumber]);

  useEffect(() => {
    if (!isOpen || !restaurant.id) return;

    const unsubscribe = restaurantService.subscribeTables(restaurant.id, (data) => {
      // Tables are already naturally sorted by the service
      setTables(data.filter(t => t.status === 'active'));
    });

    return () => unsubscribe();
  }, [isOpen, restaurant.id]);

  const handleNext = () => {
    if (step === 'cart') setStep('method');
    else if (step === 'method') setStep('details');
    else if (step === 'details') setStep('payment');
    else if (step === 'payment') handleFinish();
  };

  const handleBack = () => {
    if (step === 'method') setStep('cart');
    else if (step === 'details') setStep('method');
    else if (step === 'payment') setStep('details');
  };

  const handleFinish = async () => {
    let proofBase64 = '';
    
    if (transferProof) {
      try {
        // Compress image before sending to avoid large payloads
        const compressImage = (file: File): Promise<string> => {
          return new Promise((resolve) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
              const img = new Image();
              img.src = event.target?.result as string;
              img.onload = () => {
                const canvas = document.createElement('canvas');
                const MAX_WIDTH = 800;
                const MAX_HEIGHT = 800;
                let width = img.width;
                let height = img.height;

                if (width > height) {
                  if (width > MAX_WIDTH) {
                    height *= MAX_WIDTH / width;
                    width = MAX_WIDTH;
                  }
                } else {
                  if (height > MAX_HEIGHT) {
                    width *= MAX_HEIGHT / height;
                    height = MAX_HEIGHT;
                  }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx?.drawImage(img, 0, 0, width, height);
                // Lower quality to reduce string size significantly
                resolve(canvas.toDataURL('image/jpeg', 0.6));
              };
            };
          });
        };
        proofBase64 = await compressImage(transferProof);
      } catch (e) {
        console.error('Erro ao processar comprovante:', e);
      }
    }

    const deliveryFee = deliveryMethod === 'delivery' && selectedDeliveryLocation ? selectedDeliveryLocation.fee : 0;
    const totalWithTipAndDelivery = total + tipAmount + deliveryFee;

    const deliveryAddressLine = deliveryMethod === 'delivery' 
      ? (selectedDeliveryLocation ? `[${selectedDeliveryLocation.city}] ${customerData.address}` : customerData.address)
      : undefined;

    const orderData: Omit<Order, 'id'> = {
      customerName: customerData.name,
      customerPhone: customerData.phone,
      customerAddress: deliveryAddressLine,
      tableNumber: deliveryMethod === 'table' ? customerData.tableNumber : undefined,
      deliveryMethod: deliveryMethod as any,
      paymentMethod,
      transferProof: proofBase64,
      items,
      total: totalWithTipAndDelivery,
      tipAmount: tipAmount > 0 ? tipAmount : undefined,
      status: 'pending',
      createdAt: new Date().toISOString()
    };

    try {
      // 1. Prepare message first
      const orderId = `ORD-${Math.random().toString(36).substr(2, 9).toUpperCase()}`;
      const itemsList = items.map(i => `- ${i.quantity}x ${i.name} - ${formatCurrency(i.price * i.quantity)}`).join('\n');
      
      const methodText = deliveryMethod === 'table' ? `Mesa: ${customerData.tableNumber}` : 
                        deliveryMethod === 'counter' ? 'Retirada no Balcão' : 
                        `Entrega: ${customerData.address}` + (selectedDeliveryLocation ? ` (${selectedDeliveryLocation.city})` : '');
      
      const paymentText = paymentMethod === 'delivery' ? 'Dinheiro / TPA' : 'Transferência / Express';
      const tipText = tipAmount > 0 ? `\n*Gorjeta:* ${formatCurrency(tipAmount)}` : '';
      const deliveryFeeText = deliveryMethod === 'delivery' && selectedDeliveryLocation && selectedDeliveryLocation.fee > 0
        ? `\n*Taxa de Entrega (${selectedDeliveryLocation.city}):* ${formatCurrency(selectedDeliveryLocation.fee)}`
        : '';

      const message = 
        `✅ *NOVO PEDIDO:* #${orderId}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `👤 *Cliente:* ${customerData.name}\n` +
        `📱 *Telefone:* ${customerData.phone}\n` +
        `📍 *Método:* ${methodText}\n` +
        `💳 *Pagamento:* ${paymentText}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `🛒 *ITENS DO PEDIDO:*\n` +
        `${itemsList}\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `${deliveryFeeText}` +
        `${tipText}` +
        `💰 *VALOR TOTAL: ${formatCurrency(totalWithTipAndDelivery)}*\n` +
        `━━━━━━━━━━━━━━━━━━━━\n` +
        `_Enviado via Menu Digital_`;

      const encodedMessage = encodeURIComponent(message);
      
      // Sanitize WhatsApp number
      const cleanPhone = (whatsappNumber || '').replace(/\D/g, '');
      const finalPhone = cleanPhone.length > 5 ? cleanPhone : (whatsappNumber || '');

      if (!finalPhone) {
        toast.error("O restaurante não configurou um número de WhatsApp válido.");
        return;
      }

      // 2. Try to save to database (optional background)
      try {
        await restaurantService.saveOrder(restaurant.id, orderData);
        console.log('✅ Pedido salvo no banco de dados.');
      } catch (dbError: any) {
        console.error('⚠️ Falha ao salvar no banco:', dbError);
      }
      
      // 3. Open WhatsApp - Using window.location for better reliability on some mobile devices, 
      // but window.open is usually preferred for not closing the app. 
      // To avoid pop-up blockers, we call it as close as possible to the interaction if we can.
      const waUrl = `https://wa.me/${finalPhone}?text=${encodedMessage}`;
      
      // Attempt window.open first, if it fails or we want to be sure, we can provide a fallback
      const waWindow = window.open(waUrl, '_blank');
      
      if (!waWindow || waWindow.closed || typeof waWindow.closed === 'undefined') {
        // Fallback for popup blockers
        window.location.href = waUrl;
      }

      setStep('success');
    } catch (error) {
      console.error('💥 Erro geral ao processar pedido:', error);
      toast.error('Ocorreu um erro ao processar. No entanto, você pode tentar novamente ou entrar em contato direto.');
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100] flex justify-end">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
      />
      
      <motion.div 
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        className="relative w-full max-w-md bg-white h-full shadow-2xl flex flex-col"
      >
        {/* Header */}
        <div className="p-6 border-b border-neutral-100 bg-white/50 backdrop-blur-md sticky top-0 z-10">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              {step !== 'cart' && step !== 'success' && (
                <Button 
                  variant="ghost" 
                  size="icon" 
                  onClick={handleBack} 
                  className="rounded-full h-10 w-10 hover:bg-neutral-100 transition-colors"
                >
                  <ArrowLeft className="w-5 h-5 text-neutral-600" />
                </Button>
              )}
              <div>
                <h2 className="text-2xl font-black text-neutral-900 tracking-tight">
                  {step === 'cart' && 'Meu Pedido'}
                  {step === 'method' && 'Como prefere?'}
                  {step === 'details' && 'Seus Dados'}
                  {step === 'payment' && 'Pagamento'}
                  {step === 'success' && 'Tudo Pronto!'}
                </h2>
                {step !== 'success' && (
                  <div className="flex items-center gap-2 mt-1">
                    <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
                    <p className="text-xs font-bold text-neutral-500 uppercase tracking-widest">
                      {items.length} {items.length === 1 ? 'item' : 'itens'} no carrinho
                    </p>
                  </div>
                )}
              </div>
            </div>
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={onClose} 
              className="rounded-full h-10 w-10 hover:bg-rose-50 hover:text-rose-600 transition-all"
            >
              <X className="w-6 h-6" />
            </Button>
          </div>

          {/* Progress Indicator - Refined */}
          {step !== 'success' && (
            <div className="flex gap-2 items-center px-1">
              {['cart', 'method', 'details', 'payment'].map((s, idx) => {
                const steps = ['cart', 'method', 'details', 'payment'];
                const currentIdx = steps.indexOf(step);
                const isActive = idx <= currentIdx;
                return (
                  <div 
                    key={s} 
                    className={cn(
                      "h-1.5 flex-1 rounded-full transition-all duration-500 ease-out",
                      isActive ? "bg-rose-600 shadow-[0_0_8px_rgba(225,29,72,0.3)]" : "bg-neutral-100"
                    )} 
                  />
                )
              })}
            </div>
          )}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          <ScrollArea className="h-full p-6">
            <AnimatePresence mode="wait">
              {step === 'cart' && (
                <motion.div 
                  key="cart"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6"
                >
                  {items.length === 0 ? (
                    <div className="text-center py-20 flex flex-col items-center">
                      <div className="w-24 h-24 bg-neutral-50 rounded-full flex items-center justify-center mb-6">
                        <ShoppingBag className="w-10 h-10 text-neutral-300" />
                      </div>
                      <h3 className="text-xl font-bold text-neutral-900 mb-2">Seu carrinho está vazio</h3>
                      <p className="text-neutral-500 max-w-[200px] mx-auto text-sm">
                        Adicione alguns sabores para começar o seu pedido!
                      </p>
                      <Button 
                        variant="link" 
                        className="mt-4 text-rose-600 font-bold"
                        onClick={onClose}
                      >
                        Ver todos os produtos
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {items.map((item, idx) => (
                        <motion.div 
                          key={item.productId}
                          initial={{ opacity: 0, y: 10 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: idx * 0.05 }}
                          className="flex gap-4 group bg-white border border-neutral-100 shadow-sm p-4 rounded-[20px] relative transition-all hover:shadow-md hover:border-rose-100"
                        >
                          <div className="flex-1">
                            <h4 className="font-bold text-neutral-900 leading-tight mb-2 text-lg">{item.name}</h4>
                            <div className="flex items-center gap-4">
                              <div className="flex items-center border border-neutral-200 rounded-xl bg-neutral-50 overflow-hidden h-9 px-1">
                                <button 
                                  onClick={() => updateQuantity(item.productId, item.quantity - 1)}
                                  className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg text-neutral-500 transition-all active:scale-90"
                                >
                                  <Minus className="w-3.5 h-3.5" />
                                </button>
                                <span className="w-8 text-center text-sm font-black text-neutral-900">
                                  {item.quantity}
                                </span>
                                <button 
                                  onClick={() => updateQuantity(item.productId, item.quantity + 1)}
                                  className="p-1.5 hover:bg-white hover:shadow-sm rounded-lg text-neutral-500 transition-all active:scale-90"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                </button>
                              </div>
                              <div className="flex flex-col">
                                <span className="text-[10px] uppercase font-black text-neutral-400 tracking-wider">Preço Unit.</span>
                                <span className="text-sm font-bold text-neutral-600">
                                  {formatCurrency(item.price)}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right flex flex-col justify-between items-end min-w-[80px]">
                            <p className="font-black text-lg text-neutral-900">{formatCurrency(item.price * item.quantity)}</p>
                            <button 
                              onClick={() => removeItem(item.productId)}
                              className="p-2 text-neutral-300 hover:text-rose-500 hover:bg-rose-50 rounded-xl transition-all group-hover:text-neutral-400"
                              title="Remover item"
                            >
                              <X className="w-5 h-5" />
                            </button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  )}
                  {items.length > 0 && (
                    <div className="mt-8 pt-8 border-t border-neutral-100 bg-neutral-50/50 p-6 rounded-[32px] border border-neutral-100">
                      <div className="space-y-3 mb-6">
                        <div className="flex justify-between items-center">
                          <span className="text-neutral-500 font-medium tracking-tight">Subtotal</span>
                          <span className="font-bold text-neutral-700">{formatCurrency(total)}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-neutral-500 font-medium tracking-tight">Taxa de Serviço</span>
                          <span className="text-emerald-500 font-bold text-sm uppercase">Grátis</span>
                        </div>
                        <Separator className="bg-neutral-200/50" />
                        <div className="flex justify-between items-center py-2">
                          <span className="text-lg font-bold text-neutral-900 tracking-tighter uppercase">Total do Pedido</span>
                          <span className="text-2xl font-black text-rose-600">{formatCurrency(total)}</span>
                        </div>
                      </div>
                      
                      <div className="bg-white p-4 rounded-2xl border border-neutral-200/50 flex items-center gap-3">
                        <div className="w-10 h-10 bg-emerald-50 rounded-full flex items-center justify-center shrink-0">
                          <MessageSquare className="w-5 h-5 text-emerald-600" />
                        </div>
                        <p className="text-[11px] leading-relaxed text-neutral-600 font-medium">
                          Finalize o pedido e receba o resumo detalhado no seu <span className="font-bold text-emerald-600">WhatsApp</span> para confirmação.
                        </p>
                      </div>

                      <Button 
                        variant="ghost" 
                        size="sm" 
                        className="w-full mt-4 text-xs text-neutral-400 hover:text-rose-500 transition-colors uppercase font-black tracking-widest"
                        onClick={clearCart}
                      >
                        Limpar Carrinho
                      </Button>
                    </div>
                  )}
                </motion.div>
              )}

              {step === 'method' && (
                <motion.div 
                  key="method"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4 px-1"
                >
                  <p className="text-sm font-medium text-neutral-500 mb-2">Selecione uma opção:</p>
                  <MethodCard 
                    active={deliveryMethod === 'table'}
                    onClick={() => setDeliveryMethod('table')}
                    icon={Utensils}
                    title="Comer no Local"
                    description="Escolha sua mesa e relaxe"
                    show={restaurant.orderTypes?.local}
                  />
                  <MethodCard 
                    active={deliveryMethod === 'counter'}
                    onClick={() => setDeliveryMethod('counter')}
                    icon={Store}
                    title="Retirada no Balcão"
                    description="Poupe tempo e retire aqui"
                    show={restaurant.orderTypes?.counter}
                  />
                  <MethodCard 
                    active={deliveryMethod === 'delivery'}
                    onClick={() => setDeliveryMethod('delivery')}
                    icon={Truck}
                    title="Entrega em Domicílio"
                    description="Receba onde você estiver"
                    show={restaurant.orderTypes?.delivery}
                  />
                </motion.div>
              )}

              {step === 'details' && (
                <motion.div 
                  key="details"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-8 px-1"
                >
                  <div className="space-y-6">
                    <div className="space-y-3">
                      <Label className="text-xs font-black uppercase text-neutral-400 tracking-widest px-1">Nome Completo</Label>
                      <div className="relative group">
                        <Input 
                          placeholder="Como podemos te chamar?" 
                          className="h-14 rounded-2xl bg-neutral-50/50 border-neutral-200 focus:bg-white focus:ring-rose-500/10 transition-all text-lg font-bold placeholder:font-normal placeholder:text-neutral-400"
                          value={customerData.name}
                          onChange={e => setCustomerData({...customerData, name: e.target.value})}
                        />
                      </div>
                    </div>
                    <div className="space-y-3">
                      <Label className="text-xs font-black uppercase text-neutral-400 tracking-widest px-1">WhatsApp de Contacto</Label>
                      <Input 
                        placeholder="Ex: 923 000 000" 
                        className="h-14 rounded-2xl bg-neutral-50/50 border-neutral-200 focus:bg-white focus:ring-rose-500/10 transition-all text-lg font-bold tracking-tight placeholder:font-normal placeholder:text-neutral-400"
                        value={customerData.phone}
                        onChange={e => setCustomerData({...customerData, phone: e.target.value})}
                      />
                    </div>
                    {deliveryMethod === 'table' && (
                      <div className="space-y-3">
                        <Label className="text-xs font-black uppercase text-neutral-400 tracking-widest px-1">Sua Mesa</Label>
                        <div className="relative">
                          <select 
                            className={cn(
                              "w-full h-14 pl-4 pr-10 rounded-2xl border bg-neutral-50/50 transition-all outline-none appearance-none font-bold text-lg",
                              customerData.tableNumber ? "text-neutral-900 border-rose-200 bg-rose-50/20" : "text-neutral-400 border-neutral-200"
                            )}
                            value={customerData.tableNumber}
                            onChange={e => setCustomerData({...customerData, tableNumber: e.target.value})}
                          >
                            <option value="" disabled>Escolha a sua mesa</option>
                            {tables.map(table => (
                              <option key={table.id} value={table.number}>
                                Mesa {table.number}
                              </option>
                            ))}
                          </select>
                          <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-neutral-400">
                            <ChevronRight className="w-5 h-5 rotate-90" />
                          </div>
                        </div>
                      </div>
                    )}
                    {deliveryMethod === 'delivery' && (
                      <div className="space-y-4">
                        {restaurant.orderTypes?.deliveryFees && restaurant.orderTypes.deliveryFees.length > 0 && (
                          <div className="space-y-3">
                            <Label className="text-xs font-black uppercase text-neutral-400 tracking-widest px-1">Selecione seu Bairro / Taxa de Entrega</Label>
                            <div className="relative">
                              <select 
                                className={cn(
                                  "w-full h-14 pl-4 pr-10 rounded-2xl border bg-neutral-50/50 transition-all outline-none appearance-none font-bold text-lg",
                                  selectedDeliveryLocation ? "text-neutral-900 border-rose-200 bg-rose-50/20" : "text-neutral-400 border-neutral-200"
                                )}
                                value={selectedDeliveryLocation ? JSON.stringify(selectedDeliveryLocation) : ""}
                                onChange={e => {
                                  const val = e.target.value;
                                  if (val) {
                                    setSelectedDeliveryLocation(JSON.parse(val));
                                  } else {
                                    setSelectedDeliveryLocation(null);
                                  }
                                }}
                              >
                                <option value="">Escolha a sua região de entrega...</option>
                                {restaurant.orderTypes.deliveryFees.map((feeObj, idx) => (
                                  <option key={idx} value={JSON.stringify(feeObj)}>
                                    {feeObj.city} (+ {formatCurrency(feeObj.fee)})
                                  </option>
                                ))}
                                <option value={JSON.stringify({ city: "Outro Local", fee: 0 })}>
                                  Outra Localidade (A Combinar)
                                </option>
                              </select>
                              <div className="absolute inset-y-0 right-4 flex items-center pointer-events-none text-neutral-400">
                                <ChevronRight className="w-5 h-5 rotate-90" />
                              </div>
                            </div>
                          </div>
                        )}

                        <div className="space-y-3">
                          <Label className="text-xs font-black uppercase text-neutral-400 tracking-widest px-1">Endereço Completo de Entrega</Label>
                          <textarea 
                            placeholder="Rua, Número de casa, Ponto de referência..." 
                            className="w-full min-h-[100px] p-4 rounded-2xl bg-neutral-50/50 border border-neutral-200 focus:bg-white focus:ring-2 focus:ring-rose-500/10 transition-all font-bold placeholder:font-normal placeholder:text-neutral-400 outline-none resize-none"
                            value={customerData.address}
                            onChange={e => setCustomerData({...customerData, address: e.target.value})}
                          />
                        </div>
                      </div>
                    )}
                  </div>
                </motion.div>
              )}

              {step === 'payment' && (
                <motion.div 
                  key="payment"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-6 px-1"
                >
                  <div className="bg-neutral-50 border border-neutral-100 p-6 rounded-[32px] space-y-4">
                    <h4 className="font-black text-xs uppercase tracking-[0.2em] text-neutral-400">Resumo Final</h4>
                    <div className="space-y-3">
                      {items.map(i => (
                        <div key={i.productId} className="flex justify-between text-sm items-center">
                          <span className="text-neutral-600">
                            <span className="font-black text-neutral-900 mr-2">{i.quantity}x</span> 
                            {i.name}
                          </span>
                          <span className="font-bold text-neutral-900">{formatCurrency(i.price * i.quantity)}</span>
                        </div>
                      ))}
                      {deliveryMethod === 'delivery' && selectedDeliveryLocation && selectedDeliveryLocation.fee > 0 && (
                        <div className="flex justify-between text-sm items-center text-rose-600 font-bold">
                          <span>Taxa de Entrega ({selectedDeliveryLocation.city})</span>
                          <span>{formatCurrency(selectedDeliveryLocation.fee)}</span>
                        </div>
                      )}
                      {tipAmount > 0 && (
                        <div className="flex justify-between text-sm items-center text-emerald-600 font-bold">
                          <span>Gorjeta para a Equipe</span>
                          <span>{formatCurrency(tipAmount)}</span>
                        </div>
                      )}
                    </div>
                    <Separator className="bg-neutral-200/50" />
                    <div className="flex justify-between items-center pt-2">
                      <span className="font-bold text-neutral-500">Total a Pagar</span>
                      <span className="text-2xl font-black text-rose-600">
                        {formatCurrency(total + tipAmount + (deliveryMethod === 'delivery' && selectedDeliveryLocation ? selectedDeliveryLocation.fee : 0))}
                      </span>
                    </div>
                  </div>

                  {/* discreet tip section */}
                  <div className="p-4 bg-emerald-50 rounded-2xl border-2 border-emerald-100 space-y-3 shadow-sm">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-black uppercase text-emerald-700 tracking-widest">Agradecer à Equipe?</p>
                      <span className="text-[9px] text-emerald-600 font-bold italic">Valor opcional</span>
                    </div>
                    
                    <div className="grid grid-cols-3 gap-2">
                      {[5, 10, 15].map((pct) => {
                        const calculated = total * (pct / 100);
                        const isSelected = selectedTipPercentage === pct;
                        return (
                          <button
                            key={pct}
                            onClick={() => {
                              setSelectedTipPercentage(pct);
                              setTipAmount(calculated);
                            }}
                            className={cn(
                              "py-2.5 px-1 rounded-xl border-2 text-[10px] sm:text-xs transition-all flex flex-col items-center gap-0.5",
                              isSelected 
                                ? "bg-emerald-600 border-emerald-600 text-white shadow-md shadow-emerald-200 scale-105" 
                                : "bg-white border-emerald-200 text-emerald-700 hover:bg-emerald-100 hover:border-emerald-300"
                            )}
                          >
                            <span className="font-black">{pct}%</span>
                            <span className={cn("text-[9px] font-bold", isSelected ? "text-emerald-100" : "text-emerald-500")}>
                               {formatCurrency(calculated)}
                            </span>
                          </button>
                        );
                      })}
                    </div>

                    <div className="pt-2">
                      <motion.div initial={{ opacity: 0, y: 5 }} animate={{ opacity: 1, y: 0 }}>
                        <div className="relative">
                          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-emerald-600">Kz</span>
                          <Input 
                            type="number"
                            placeholder="Digite um valor personalizado"
                            className="h-11 pl-8 rounded-xl bg-white border-2 border-emerald-200 text-sm font-black text-emerald-900 focus:ring-emerald-500/20 focus:border-emerald-500 transition-all"
                            value={tipAmount || ''}
                            onChange={(e) => {
                              const val = parseFloat(e.target.value) || 0;
                              setTipAmount(val);
                              setSelectedTipPercentage('custom');
                            }}
                          />
                        </div>
                      </motion.div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <Label className="text-xs font-black uppercase text-neutral-400 tracking-widest px-1">Escolha o Pagamento</Label>
                    <div className="grid grid-cols-1 gap-3">
                      <PaymentButton 
                        active={paymentMethod === 'delivery'}
                        onClick={() => setPaymentMethod('delivery')}
                        icon={CreditCard}
                        title="Pagamento na Entrega"
                        description="TPA ou Dinheiro no ato"
                      />
                      <PaymentButton 
                        active={paymentMethod === 'transfer'}
                        onClick={() => setPaymentMethod('transfer')}
                        icon={Upload}
                        title="Transferência / Express"
                        description="Anexe o seu comprovante abaixo"
                      />
                    </div>

                    {paymentMethod === 'transfer' && (
                      <motion.div 
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="space-y-4"
                      >
                        {(restaurant.paymentMethods?.iban || restaurant.paymentMethods?.multicaixa) && (
                          <div className="p-5 bg-neutral-900 rounded-[28px] text-white space-y-4 shadow-xl">
                            <h5 className="text-[10px] font-black uppercase tracking-[0.2em] text-white/50 px-1">Dados para Pagamento</h5>
                            <div className="space-y-4">
                              {restaurant.paymentMethods?.iban && (
                                <div className="space-y-1.5 p-3 rounded-2xl bg-white/5 border border-white/10">
                                  <p className="text-[9px] font-black uppercase text-rose-400 tracking-wider">IBAN / Transferência</p>
                                  <p className="text-sm font-mono font-bold break-all select-all">{restaurant.paymentMethods.iban}</p>
                                </div>
                              )}
                              {restaurant.paymentMethods?.multicaixa && (
                                <div className="space-y-1.5 p-3 rounded-2xl bg-white/5 border border-white/10">
                                  <p className="text-[9px] font-black uppercase text-emerald-400 tracking-wider">Multicaixa Express</p>
                                  <p className="text-xl font-black tracking-tight select-all">{restaurant.paymentMethods.multicaixa}</p>
                                </div>
                              )}
                            </div>
                          </div>
                        )}

                        <div className="p-6 bg-rose-50/50 border-2 border-dashed border-rose-200 rounded-[28px] text-center space-y-3">
                          <div className="w-12 h-12 bg-rose-100 rounded-full flex items-center justify-center mx-auto mb-2">
                            <Upload className="w-6 h-6 text-rose-600" />
                          </div>
                          <p className="text-sm text-rose-900 font-black">Comprovante de Pagamento</p>
                          <p className="text-[11px] text-rose-600/70 leading-relaxed px-4">
                            Precisamos do comprovante para agilizar o seu pedido.
                          </p>
                          <input 
                            type="file" 
                            className="hidden" 
                            id="proof" 
                            onChange={e => setTransferProof(e.target.files?.[0] || null)}
                          />
                          <Button 
                            variant="outline" 
                            className="w-full h-12 rounded-xl text-rose-600 border-rose-100 bg-white hover:bg-rose-50 shadow-sm font-bold"
                            onClick={() => document.getElementById('proof')?.click()}
                          >
                            {transferProof ? (
                              <span className="flex items-center gap-2">
                                <CheckCircle2 className="w-4 h-4" /> {transferProof.name}
                              </span>
                            ) : 'Selecionar Arquivo'}
                          </Button>
                        </div>
                      </motion.div>
                    )}
                  </div>
                </motion.div>
              )}

              {step === 'success' && (
                <motion.div 
                  key="success"
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  className="text-center py-16 px-4 space-y-8"
                >
                  <div className="relative mx-auto w-32 h-32">
                    <motion.div 
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      transition={{ delay: 0.2, type: 'spring', stiffness: 200 }}
                      className="absolute inset-0 bg-emerald-100 rounded-full animate-pulse"
                    />
                    <div className="relative z-10 w-full h-full bg-emerald-500 text-white rounded-full flex items-center justify-center shadow-xl shadow-emerald-100">
                      <CheckCircle2 className="w-16 h-16" />
                    </div>
                  </div>
                  
                  <div className="space-y-3">
                    <h3 className="text-3xl font-black text-neutral-900 tracking-tight">Pedido Enviado!</h3>
                    <p className="text-neutral-500 leading-relaxed font-medium">
                      Excelente escolha! Seu pedido já está a caminho do nosso WhatsApp para ser processado.
                    </p>
                  </div>

                  <div className="bg-neutral-50 p-6 rounded-[32px] border border-neutral-100 text-left space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-2 h-2 rounded-full bg-emerald-500" />
                      <p className="text-xs font-black uppercase text-neutral-400 tracking-widest">Próximos Passos</p>
                    </div>
                    <ul className="space-y-3 text-sm font-medium text-neutral-600">
                      <li className="flex gap-2">
                        <span className="text-emerald-500">1.</span>
                        Confirme a mensagem no WhatsApp
                      </li>
                      <li className="flex gap-2">
                        <span className="text-emerald-500">2.</span>
                        Aguarde a nossa confirmação
                      </li>
                      <li className="flex gap-2">
                        <span className="text-emerald-500">3.</span>
                        Bom apetite!
                      </li>
                    </ul>
                  </div>

                  <Button 
                    className="w-full rounded-[24px] bg-neutral-900 hover:bg-neutral-800 h-16 text-lg font-black transition-all shadow-xl active:scale-95"
                    onClick={() => {
                      clearCart();
                      onClose();
                      setStep('cart');
                    }}
                  >
                    Voltar ao Cardápio
                  </Button>
                </motion.div>
              )}
            </AnimatePresence>
          </ScrollArea>
        </div>

        {/* Footer Actions */}
        {step !== 'success' && items.length > 0 && (
          <div className="p-6 border-t border-neutral-100 bg-white/80 backdrop-blur-xl space-y-3 sticky bottom-0">
            <Button 
              className="w-full h-16 rounded-[24px] bg-rose-600 hover:bg-rose-700 text-white font-black text-lg gap-3 shadow-xl shadow-rose-100 transition-all active:scale-[0.98] group relative overflow-hidden"
              onClick={handleNext}
              disabled={
                (step === 'method' && !deliveryMethod) ||
                (step === 'details' && (!customerData.name || !customerData.phone || (deliveryMethod === 'delivery' && restaurant.orderTypes?.deliveryFees && restaurant.orderTypes.deliveryFees.length > 0 && !selectedDeliveryLocation))) ||
                (step === 'payment' && paymentMethod === 'transfer' && !transferProof)
              }
            >
              <div className="flex items-center gap-3 relative z-10">
                {step === 'payment' ? (
                  <>Finalizar no WhatsApp <MessageSquare className="w-5 h-5 fill-white/20" /></>
                ) : (
                  <>Continuar <ChevronRight className="w-6 h-6 group-hover:translate-x-1 transition-transform" /></>
                )}
              </div>
              <div className="absolute top-0 -left-[100%] w-full h-full bg-gradient-to-r from-transparent via-white/20 to-transparent skew-x-[-25deg] group-hover:left-[100%] transition-all duration-1000 ease-in-out" />
            </Button>
            
            {step !== 'cart' && (
              <Button 
                variant="ghost"
                className="w-full h-12 rounded-xl text-neutral-400 hover:text-neutral-900 font-black uppercase tracking-widest text-[10px] transition-all"
                onClick={handleBack}
              >
                Retornar ao passo anterior
              </Button>
            )}
          </div>
        )}
      </motion.div>
    </div>
  );
}

function MethodCard({ active, onClick, icon: Icon, title, description, show }: any) {
  if (show === false) return null;
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full p-5 rounded-[24px] border-2 text-left transition-all flex gap-4 items-center group relative overflow-hidden",
        active 
          ? "border-rose-600 bg-rose-50/50 shadow-lg shadow-rose-100 scale-[1.02]" 
          : "border-neutral-100 bg-white hover:border-neutral-200 hover:bg-neutral-50/50"
      )}
    >
      <div className={cn(
        "p-3.5 rounded-2xl transition-all duration-300",
        active 
          ? "bg-rose-600 text-white shadow-lg shadow-rose-200 scale-110" 
          : "bg-neutral-100 text-neutral-500 group-hover:scale-105"
      )}>
        <Icon className="w-6 h-6 shrink-0" />
      </div>
      <div className="flex-1">
        <h4 className={cn(
          "font-black tracking-tight transition-colors",
          active ? "text-rose-900" : "text-neutral-900"
        )}>{title}</h4>
        <p className={cn(
          "text-xs transition-colors",
          active ? "text-rose-600 font-medium" : "text-neutral-500"
        )}>{description}</p>
      </div>
      {active && (
        <div className="absolute right-4">
          <div className="w-6 h-6 bg-rose-600 rounded-full flex items-center justify-center text-white">
            <CheckCircle2 className="w-4 h-4" />
          </div>
        </div>
      )}
    </button>
  );
}

function PaymentButton({ active, onClick, icon: Icon, title, description }: any) {
  return (
    <button 
      onClick={onClick}
      className={cn(
        "w-full p-4 rounded-2xl border-2 text-left transition-all flex gap-4 items-center",
        active 
          ? "border-rose-600 bg-rose-50/40" 
          : "border-neutral-100 bg-white hover:border-neutral-200"
      )}
    >
      <div className={cn(
        "p-2.5 rounded-xl transition-all",
        active ? "bg-rose-600 text-white shadow-md shadow-rose-100" : "bg-neutral-50 text-neutral-400"
      )}>
        <Icon className="w-5 h-5 shrink-0" />
      </div>
      <div>
        <h4 className={cn(
          "font-bold text-sm tracking-tight",
          active ? "text-rose-900" : "text-neutral-900"
        )}>{title}</h4>
        <p className="text-[10px] text-neutral-400 uppercase font-black tracking-widest">{description}</p>
      </div>
    </button>
  );
}
