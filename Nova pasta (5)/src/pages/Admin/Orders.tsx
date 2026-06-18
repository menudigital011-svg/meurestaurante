import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Filter, 
  Clock, 
  CheckCircle2, 
  XCircle, 
  ChefHat,
  MessageSquare,
  Trash2,
  Loader2,
  Info
} from 'lucide-react';
import { restaurantService } from '../../lib/supabaseService';
import { formatCurrency } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Phone, MapPin, User, CreditCard, Receipt, Utensils, Store, Truck, ShoppingBag } from 'lucide-react';

const MOCK_ORDERS = [
  {
    id: 'ORD-001',
    customerName: 'João Silva',
    customerPhone: '923000000',
    deliveryMethod: 'table',
    tableNumber: '05',
    paymentMethod: 'delivery',
    items: [
      { name: 'Risoto de Cogumelos', quantity: 1, price: 12500 },
      { name: 'Suco de Laranja', quantity: 2, price: 5000 }
    ],
    total: 17500,
    status: 'preparing',
    createdAt: new Date().toISOString(),
  },
  {
    id: 'ORD-002',
    customerName: 'Maria Oliveira',
    customerPhone: '934000000',
    deliveryMethod: 'delivery',
    customerAddress: 'Rua Direita da Samba, Luanda',
    paymentMethod: 'transfer',
    items: [
      { name: 'Bruschetta Italiana', quantity: 2, price: 9000 },
      { name: 'Petit Gâteau', quantity: 1, price: 5500 }
    ],
    total: 14500,
    status: 'pending',
    createdAt: new Date().toISOString(),
  }
];

import { Order } from '../../types';
import { toast } from 'sonner';
import { cn } from '@/lib/utils';

import { useAuth } from '../../components/AuthProvider';

export default function AdminOrders() {
  const { user, restaurantId } = useAuth();

  const [filter, setFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isDeleting, setIsDeleting] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);

  useEffect(() => {
    if (!restaurantId) return;
    
    let isMounted = true;

    // Timeout para evitar carregamento infinito
    const timer = setTimeout(() => {
      if (isMounted && isLoading) {
        setIsLoading(false);
      }
    }, 5000);

    const unsub = restaurantService.subscribeOrders(restaurantId, (o) => {
      if (isMounted) {
        setOrders(o);
        setIsLoading(false);
        clearTimeout(timer);
      }
    });

    return () => {
      isMounted = false;
      unsub();
      clearTimeout(timer);
    };
  }, [restaurantId]);

  const handleStatusChange = async (orderId: string, newStatus: Order['status']) => {
    const previousOrders = [...orders];
    try {
      // Atualização Otimista
      setOrders(prev => prev.map(o => 
        o.id === orderId ? { ...o, status: newStatus } : o
      ));
      
      await restaurantService.updateOrderStatus(restaurantId, orderId, newStatus);
      toast.success(`Pedido em ${newStatus === 'preparing' ? 'preparo' : 'entregue'}`);
    } catch (error) {
      console.error('Erro ao atualizar status:', error);
      setOrders(previousOrders);
      toast.error('Erro ao atualizar status');
    }
  };

  const handleDeleteOrder = (orderId: string) => {
    setDeleteId(orderId);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deleteId) return;
    
    setIsDeleting(deleteId);
    const previousOrders = [...orders];
    
    try {
      // Remoção Otimista
      setOrders(prev => prev.filter(o => o.id !== deleteId));
      
      await restaurantService.deleteOrder(restaurantId, deleteId);
      toast.success('Pedido excluído com sucesso');
      setIsDeleteDialogOpen(false);
    } catch (error: any) {
      console.error('Erro ao excluir pedido:', error);
      setOrders(previousOrders);
      toast.error(`Erro ao excluir: ${error.message || 'Verifique as permissões'}`);
    } finally {
      setIsDeleting(null);
      setDeleteId(null);
    }
  };

  const filteredOrders = orders
    .filter(o => filter === 'all' || o.status === filter)
    .filter(o => 
      o.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      o.id.toLowerCase().includes(searchQuery.toLowerCase())
    );

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-black tracking-tight text-neutral-900">Pedidos</h1>
          <p className="text-neutral-500 font-medium">Fluxo de gestão e monitoramento em tempo real.</p>
        </div>

        <div className="flex flex-col md:flex-row gap-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
            <Input 
              placeholder="Buscar pedido ou cliente..." 
              className="pl-10 rounded-xl border-none bg-white shadow-sm w-full md:w-64"
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
          </div>
          <div className="flex gap-2 bg-white p-1 rounded-2xl shadow-sm border border-neutral-100">
            {['all', 'pending', 'preparing', 'delivered'].map((s) => (
              <Button
                key={s}
                variant={filter === s ? 'default' : 'ghost'}
                size="sm"
                className={cn(
                  "rounded-xl px-4 capitalize",
                  filter === s ? "bg-rose-600 hover:bg-rose-700 text-white" : "text-neutral-500"
                )}
                onClick={() => setFilter(s)}
              >
                {s === 'all' ? 'Todos' : s === 'pending' ? 'Pendentes' : s === 'preparing' ? 'Em Preparo' : 'Entregues'}
              </Button>
            ))}
          </div>
        </div>
      </div>

      {/* Aviso de Conciliação Financeira - Melhor visibilidade */}
      <div className="flex items-center gap-3 px-4 py-2 bg-neutral-50 rounded-xl border border-neutral-100/50 w-fit">
        <div className="p-1.5 bg-indigo-50 rounded-lg">
          <Info className="w-4 h-4 text-indigo-500" />
        </div>
        <p className="text-xs font-semibold text-neutral-600">
          Nota: O faturamento é contabilizado no <span className="text-indigo-600 font-bold">Dashboard</span> somente após o status ser definido como <span className="text-emerald-600 font-black uppercase tracking-tight">Entregue</span>.
        </p>
      </div>

      {isLoading ? (
        <div className="flex flex-col items-center justify-center py-20 grayscale opacity-50">
          <Clock className="w-12 h-12 mb-4 animate-pulse" />
          <p className="font-bold">Carregando pedidos...</p>
        </div>
      ) : filteredOrders.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-20 bg-white rounded-[3rem] border-2 border-dashed border-neutral-100">
          <div className="p-6 bg-neutral-50 rounded-full mb-4">
            <ShoppingBag className="w-12 h-12 text-neutral-300" />
          </div>
          <h3 className="text-xl font-bold text-neutral-900">Nenhum pedido encontrado</h3>
          <p className="text-neutral-500 mt-1">Os novos pedidos aparecerão aqui automaticamente.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {filteredOrders.map((order) => (
            <OrderCard 
              key={order.id} 
              order={order} 
              onStatusChange={handleStatusChange} 
              onDelete={handleDeleteOrder}
              isDeleting={isDeleting === order.id}
            />
          ))}
        </div>
      )}

      {/* Confirm Delete Order Dialog */}
      <Dialog open={isDeleteDialogOpen} onOpenChange={setIsDeleteDialogOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-rose-600">
              <Trash2 className="w-5 h-5" /> Excluir Pedido
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-neutral-600">
              Tem certeza que deseja excluir este pedido permanentemente? 
            </p>
            <p className="text-xs text-neutral-400 mt-2 italic">Esta ação removerá o pedido da base de dados e não pode ser desfeita.</p>
          </div>
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              className="flex-1 rounded-xl"
              onClick={() => setIsDeleteDialogOpen(false)}
              disabled={isDeleting !== null}
            >
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              className="flex-1 rounded-xl gap-2"
              onClick={confirmDelete}
              disabled={isDeleting !== null}
            >
              {isDeleting !== null ? <><Loader2 className="w-4 h-4 animate-spin" /> Excluindo...</> : 'Excluir Agora'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

interface OrderCardProps {
  order: Order;
  onStatusChange: (id: string, s: Order['status']) => void | Promise<void>;
  onDelete: (id: string) => void;
  isDeleting: boolean;
}

const OrderCard: React.FC<OrderCardProps> = ({ order, onStatusChange, onDelete, isDeleting }) => {
  return (
    <Card className="rounded-3xl border-none shadow-sm overflow-hidden group hover:shadow-md transition-all">
      <div className={cn(
        "h-2 w-full",
        order.status === 'pending' ? "bg-amber-400" : 
        order.status === 'preparing' ? "bg-rose-500" : "bg-emerald-500"
      )} />
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div>
            <p className="text-[10px] font-bold text-neutral-400 uppercase tracking-wider mb-2">{order.id}</p>
            <h3 className="font-black text-neutral-900 leading-none text-xl">{order.customerName}</h3>
            <div className="flex items-center gap-2 mt-2 text-sm text-neutral-500">
              <Phone className="w-3.5 h-3.5" /> 
              <span className="font-medium">{order.customerPhone}</span>
            </div>
            
            <div className="flex items-center gap-2 mt-4 bg-neutral-50 border border-neutral-100 px-3 py-1.5 rounded-xl w-fit">
              <Clock className="w-3.5 h-3.5 text-rose-600" />
              <span className="text-xs font-black text-neutral-700 tracking-tight">
                {new Date(order.createdAt || Date.now()).toLocaleDateString('pt-AO')} 
                <span className="text-rose-600 mx-1.5">•</span>
                {new Date(order.createdAt || Date.now()).toLocaleTimeString('pt-AO', { hour: '2-digit', minute: '2-digit' })}
              </span>
            </div>
          </div>
          <div className="text-right">
            <Badge className={cn(
              "rounded-lg",
              order.status === 'pending' ? "bg-amber-50 text-amber-600 hover:bg-amber-50" : 
              order.status === 'preparing' ? "bg-rose-50 text-rose-600 hover:bg-rose-50" : 
              "bg-emerald-50 text-emerald-600 hover:bg-emerald-50"
            )}>
              {order.status === 'pending' ? 'Pendente' : order.status === 'preparing' ? 'Em Preparo' : 'Entregue'}
            </Badge>
            <div className="mt-2 text-xs font-bold text-neutral-400 flex items-center gap-1 justify-end">
              {order.deliveryMethod === 'table' ? (
                <><Utensils className="w-3 h-3" /> Mesa {order.tableNumber}</>
              ) : order.deliveryMethod === 'counter' ? (
                <><Store className="w-3 h-3" /> Balcão</>
              ) : (
                <><Truck className="w-3 h-3" /> Delivery</>
              )}
            </div>
          </div>
        </div>

        {order.customerAddress && (
          <div className="mb-4 p-3 bg-neutral-50 rounded-xl flex gap-2 items-start text-sm text-neutral-600">
            <MapPin className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
            <span>{order.customerAddress}</span>
          </div>
        )}

        <div className="space-y-3 mb-6">
          {order.items.map((item, i) => (
            <div key={i} className="flex justify-between text-sm">
              <span className="text-neutral-600 font-medium flex-1">
                <span className="font-bold text-neutral-900">{item.quantity}x</span> {item.name}
              </span>
              <span className="text-neutral-400 ml-2 whitespace-nowrap">{formatCurrency(item.price)}</span>
            </div>
          ))}
          <div className="pt-3 border-t border-neutral-100 flex justify-between items-center">
            <div className="flex items-center gap-2 text-[10px] font-bold text-neutral-400">
              <CreditCard className="w-3 h-3" />
              {order.paymentMethod === 'delivery' ? 'Entrega' : 'Transf.'}
            </div>
            <span className="font-black text-rose-600 text-xl">{formatCurrency(order.total)}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          {order.status === 'pending' && (
            <Button 
              className="rounded-xl bg-rose-600 hover:bg-rose-700 gap-2 h-10 text-xs"
              onClick={() => onStatusChange(order.id, 'preparing')}
            >
              <ChefHat className="w-3.5 h-3.5" /> Preparar
            </Button>
          )}
          {order.status === 'preparing' && (
            <Button 
              className="rounded-xl bg-emerald-600 hover:bg-emerald-700 gap-2 h-10 text-xs"
              onClick={() => onStatusChange(order.id, 'delivered')}
            >
              <CheckCircle2 className="w-3.5 h-3.5" /> Entregar
            </Button>
          )}
          <Button 
            variant="outline" 
            className="rounded-xl gap-2 border-neutral-200 h-10 text-xs"
            onClick={(e) => {
              e.stopPropagation();
              window.open(`https://wa.me/${order.customerPhone}`, '_blank');
            }}
          >
            <MessageSquare className="w-4 h-4 text-[#25D366]" /> WhatsApp
          </Button>
          <div className="flex gap-2">
            <Button 
              variant="ghost" 
              size="icon"
              className="flex-1 h-10 rounded-xl text-neutral-400 hover:text-rose-600 hover:bg-rose-50 border border-neutral-100"
              onClick={(e) => {
                e.stopPropagation();
                window.open(`tel:${order.customerPhone}`);
              }}
            >
              <Phone className="w-4 h-4" />
            </Button>
            <Button 
              variant="ghost" 
              size="icon"
              className={cn(
                "flex-1 h-10 rounded-xl text-neutral-400 hover:text-rose-600 hover:bg-rose-50 border border-neutral-100",
                isDeleting && "animate-pulse"
              )}
              onClick={(e) => {
                e.stopPropagation();
                onDelete(order.id);
              }}
              disabled={isDeleting}
            >
              {isDeleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
