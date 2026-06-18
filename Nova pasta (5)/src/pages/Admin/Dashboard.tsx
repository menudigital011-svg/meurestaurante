import { useState, useEffect, useMemo, useRef } from 'react';
import { 
  TrendingUp, 
  Users, 
  ShoppingBag, 
  DollarSign,
  ArrowUpRight,
  ArrowDownRight,
  Loader2,
  Lock,
  ChevronRight,
  ShieldAlert,
  Eye,
  Volume2,
  VolumeX
} from 'lucide-react';
import { 
  Card, 
  CardContent, 
  CardHeader, 
  CardTitle,
  CardDescription
} from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  Cell
} from 'recharts';

import { restaurantService } from '../../lib/supabaseService';
import { Order } from '../../types';
import { cn, formatCurrency } from '@/lib/utils';

import { useAuth } from '../../components/AuthProvider';

export default function AdminDashboard() {
  const { user, restaurantId } = useAuth();

  const [orders, setOrders] = useState<Order[]>([]);
  const prevCountRef = useRef(0);
  const [soundEnabled, setSoundEnabled] = useState(() => {
    return localStorage.getItem('admin_sound_enabled') === 'true';
  });
  const [visits, setVisits] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Pré-carregar o áudio e "aquecer" no primeiro clique
  useEffect(() => {
    if (!audioRef.current) {
      audioRef.current = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
      audioRef.current.load();
    }
  }, []);

  useEffect(() => {
    localStorage.setItem('admin_sound_enabled', soundEnabled.toString());
  }, [soundEnabled]);

  const playNotificationSound = () => {
    if (!soundEnabled || !audioRef.current) return;
    
    // Reiniciar som se já estiver tocando
    audioRef.current.currentTime = 0;
    audioRef.current.play().catch(err => {
      console.warn("Autoplay bloqueado ou erro de áudio:", err);
      // Se falhar, tentamos novamente na próxima interação
    });
  };
  
  // Função para "desbloquear" o áudio no navegador
  const warmUpAudio = () => {
    if (audioRef.current) {
      audioRef.current.play().then(() => {
        audioRef.current?.pause();
        if (audioRef.current) audioRef.current.currentTime = 0;
      }).catch(() => {});
    }
  };
  
  // PIN Protection State
  const [isAuthorized, setIsAuthorized] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [managerPin, setManagerPin] = useState<string | null>(null);
  const [checkingPin, setCheckingPin] = useState(true);

  useEffect(() => {
    if (!restaurantId) return;
    
    // Fetch restaurant to get PIN
    restaurantService.getRestaurant(restaurantId).then(res => {
      if (res?.managerPin) {
        setManagerPin(res.managerPin);
      }
      setCheckingPin(false);
    });
  }, [restaurantId]);

  useEffect(() => {
    if (!pinInput || !managerPin) return;
    if (pinInput === managerPin) {
      setIsAuthorized(true);
      warmUpAudio(); // Aproveita o clique de autorização para liberar o áudio
      toast.success('Acesso autorizado!');
    }
  }, [pinInput, managerPin]);

  useEffect(() => {
    if (!restaurantId) return;
    
    let isMounted = true;
    
    // Timeout de segurança: se carregar por mais de 5 segundos, tenta mostrar o que tem
    const timer = setTimeout(() => {
      if (isMounted && loading) {
        setLoading(false);
        setError("O carregamento está demorando mais que o esperado.");
      }
    }, 5000);

    const unsub = restaurantService.subscribeOrders(restaurantId, (o) => {
      if (isMounted) {
        // Se o número de pedidos aumentou em relação ao Ref (que sempre tem o valor atual)
        if (o.length > prevCountRef.current && prevCountRef.current > 0) {
          playNotificationSound();
          const latestOrder = o[0];
          toast.success(`Novo Pedido Recebido! (#${latestOrder.id.slice(-6)})`, {
            icon: '🔔',
            duration: 10000
          });
        }
        
        setOrders(o);
        prevCountRef.current = o.length;
        setLoading(false);
        setError(null);
        clearTimeout(timer);
      }
    });

    // Fetch visits analytics
    const fetchAnalytics = async () => {
      const v = await restaurantService.getVisits(restaurantId);
      if (isMounted) setVisits(v);
    };
    fetchAnalytics();

    return () => {
      isMounted = false;
      unsub();
      clearTimeout(timer);
    };
  }, [restaurantId]);

  const { todaySales, totalSales, totalOrders, uniqueCustomers, chartData, popularProducts, peakHoursData, visitStats, visitChartData } = useMemo(() => {
    // Filtrar apenas pedidos entregues para o financeiro
    const deliveredOrders = orders.filter(o => o.status === 'delivered');
    
    // Vendas de hoje
    const today = new Date().toLocaleDateString('pt-PT');
    const todaySalesAmount = deliveredOrders
      .filter(o => new Date(o.createdAt).toLocaleDateString('pt-PT') === today)
      .reduce((acc, curr) => acc + curr.total, 0);

    const sales = deliveredOrders.reduce((acc, curr) => acc + curr.total, 0);
    const count = deliveredOrders.length;
    const customers = new Set(deliveredOrders.map(o => o.customerPhone)).size;

    // Group sales by day for the main chart
    const days = [...Array(7)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      return d.toLocaleDateString('pt-PT', { weekday: 'short' });
    }).reverse();

    const chart = days.map(day => {
      const dayOrders = deliveredOrders.filter(o => {
        const orderDate = new Date(o.createdAt).toLocaleDateString('pt-PT', { weekday: 'short' });
        return orderDate === day;
      });
      return {
        name: day.charAt(0).toUpperCase() + day.slice(1),
        vlr: dayOrders.reduce((acc, curr) => acc + curr.total, 0)
      };
    });

    // Peak Hours Data (Distribution of all orders throughout the day)
    const hourSlots = [...Array(24)].map((_, i) => ({
      hour: `${i}h`,
      pedidos: 0
    }));

    orders.forEach(order => {
      const hour = new Date(order.createdAt).getHours();
      hourSlots[hour].pedidos += 1;
    });

    // Popular Products (Top 5)
    const productSales: Record<string, { name: string, sales: number, price: number }> = {};
    deliveredOrders.forEach(order => {
      order.items.forEach(item => {
        if (!productSales[item.name]) {
          productSales[item.name] = { name: item.name, sales: 0, price: item.price };
        }
        productSales[item.name].sales += item.quantity;
      });
    });

    const popular = Object.values(productSales)
      .sort((a, b) => b.sales - a.sales)
      .slice(0, 5);

    // Visit Stats
    const todayStr = new Date().toLocaleDateString('pt-PT');
    const todayVisits = visits.filter(v => new Date(v.visitedAt).toLocaleDateString('pt-PT') === todayStr).length;
    
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const weekVisits = visits.filter(v => new Date(v.visitedAt) >= sevenDaysAgo).length;

    const monthVisits = visits.length; // Assumindo histórico recente ou filtrado no futuro

    // Visit Chart Data (last 7 days)
    const visitChart = [...Array(7)].map((_, i) => {
      const d = new Date();
      d.setDate(d.getDate() - i);
      const dateStr = d.toLocaleDateString('pt-PT');
      return {
        name: d.toLocaleDateString('pt-PT', { weekday: 'short' }),
        acessos: visits.filter(v => new Date(v.visitedAt).toLocaleDateString('pt-PT') === dateStr).length
      };
    }).reverse();

    return {
      todaySales: todaySalesAmount,
      totalSales: sales,
      totalOrders: count,
      uniqueCustomers: customers,
      chartData: chart,
      popularProducts: popular,
      peakHoursData: hourSlots,
      visitStats: { today: todayVisits, week: weekVisits, total: monthVisits },
      visitChartData: visitChart
    };
  }, [orders, visits]);

  if (checkingPin) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-rose-600" />
      </div>
    );
  }

  if (managerPin && !isAuthorized) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-6">
        <Card className="w-full max-w-md rounded-[2.5rem] border-none shadow-2xl overflow-hidden bg-white">
          <CardHeader className="bg-rose-600 p-10 text-white text-center">
            <div className="w-20 h-20 bg-white/20 backdrop-blur-md rounded-3xl flex items-center justify-center mx-auto mb-6">
              <Lock className="w-10 h-10 text-white" />
            </div>
            <CardTitle className="text-3xl font-black uppercase tracking-tight">Área Restrita</CardTitle>
            <CardDescription className="text-rose-100 text-lg mt-2">
              Somente o Gestor Principal tem acesso ao dashboard financeiro.
            </CardDescription>
          </CardHeader>
          <CardContent className="p-10 space-y-8">
            <div className="space-y-4">
              <Label className="text-sm font-black text-neutral-800 uppercase tracking-widest text-center block">Digite o PIN de acesso</Label>
              <div className="flex justify-center gap-3">
                {[...Array(managerPin.length)].map((_, i) => (
                  <div 
                    key={i} 
                    className={cn(
                      "w-4 h-4 rounded-full border-2 transition-all duration-300",
                      pinInput.length > i ? "bg-rose-600 border-rose-600 scale-125 shadow-lg shadow-rose-200" : "bg-neutral-100 border-neutral-300"
                    )}
                  />
                ))}
              </div>
              <Input 
                type="password"
                inputMode="numeric"
                pattern="[0-9]*"
                autoFocus
                value={pinInput}
                onChange={e => {
                  const val = e.target.value.replace(/[^0-9]/g, '');
                  if (val.length <= (managerPin?.length || 4)) {
                    setPinInput(val);
                  }
                }}
                className="opacity-0 absolute inset-0 cursor-default"
                style={{ height: '1px' }}
              />
              <div className="grid grid-cols-3 gap-3">
                {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                  <Button 
                    key={num}
                    variant="outline"
                    className="h-16 rounded-2xl text-2xl font-black hover:bg-neutral-100 active:scale-90 transition-all border-neutral-100"
                    onClick={() => {
                      if (pinInput.length < (managerPin?.length || 4)) {
                        setPinInput(prev => prev + num);
                      }
                    }}
                  >
                    {num}
                  </Button>
                ))}
                <Button 
                  variant="ghost" 
                  className="h-16 rounded-2xl text-rose-600 font-bold hover:bg-rose-50"
                  onClick={() => setPinInput('')}
                >
                  Limpar
                </Button>
                <Button 
                  key={0}
                  variant="outline"
                  className="h-16 rounded-2xl text-2xl font-black hove:bg-neutral-100 active:scale-90 transition-all border-neutral-100"
                  onClick={() => {
                    if (pinInput.length < (managerPin?.length || 4)) {
                      setPinInput(prev => prev + '0');
                    }
                  }}
                >
                  0
                </Button>
                <div className="flex items-center justify-center p-2">
                  <ShieldAlert className="w-6 h-6 text-neutral-200" />
                </div>
              </div>
            </div>
            
            <p className="text-center text-xs text-neutral-400 font-medium leading-relaxed">
              Dica: O PIN pode ser configurado na aba de <span className="text-rose-600 font-bold uppercase">Configurações</span>.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading && orders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-rose-600" />
        <p className="text-neutral-500 animate-pulse">Sincronizando dados...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-neutral-900 uppercase tracking-tight">Painel Executivo</h1>
          <p className="text-neutral-500 font-medium">Bem-vindo ao centro de comando da sua operação.</p>
        </div>

        <div className="flex items-center gap-3">
          <Button
            variant={soundEnabled ? "outline" : "secondary"}
            onClick={() => {
              const newState = !soundEnabled;
              if (newState) warmUpAudio();
              setSoundEnabled(newState);
            }}
            className={cn(
              "rounded-2xl border-none shadow-sm h-12 px-6 font-bold flex items-center gap-2",
              soundEnabled ? "bg-emerald-50 text-emerald-600" : "bg-neutral-100 text-neutral-400"
            )}
          >
            {soundEnabled ? (
              <>
                <Volume2 className="w-5 h-5" />
                <span>SONORO: LIGADO</span>
              </>
            ) : (
              <>
                <VolumeX className="w-5 h-5" />
                <span>SONORO: DESLIGADO</span>
              </>
            )}
          </Button>
          {error && (
            <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-2 rounded-xl text-sm font-medium">
              {error.includes('Failed to fetch') ? 'Erro de Conexão: Verifique se o Supabase está configurado corretamente nas variáveis de ambiente.' : error}
            </div>
          )}
          <div className="hidden sm:flex bg-white p-1 rounded-2xl shadow-sm items-center gap-1 border border-neutral-100">
            <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse ml-3"></span>
            <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest px-3 py-2">LIVE CONNECT</span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <StatCard 
          title="Faturamento Hoje" 
          value={formatCurrency(todaySales)} 
          trend="Tempo Real" 
          trendUp={true} 
          icon={TrendingUp} 
          highlight={true}
        />
        <StatCard 
          title="Acessos Hoje" 
          value={visitStats.today.toString()} 
          trend={`Semana: ${visitStats.week}`} 
          trendUp={true} 
          icon={Eye} 
        />
        <StatCard 
          title="Vendas Totais" 
          value={formatCurrency(totalSales)} 
          trend="Total Acumulado" 
          trendUp={true} 
          icon={DollarSign} 
        />
        <StatCard 
          title="Total de Pedidos" 
          value={totalOrders.toString()} 
          trend="Concluídos" 
          trendUp={true} 
          icon={ShoppingBag} 
        />
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Gráfico de Vendas Semanais */}
        <Card className="rounded-3xl border-none shadow-sm overflow-hidden bg-white">
          <CardHeader className="p-6 border-b border-neutral-50">
            <CardTitle className="text-lg font-black text-neutral-900 uppercase tracking-tight">Evolução de Vendas</CardTitle>
            <CardDescription>Desempenho semanal (Pedidos entregues)</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData}>
                  <defs>
                    <linearGradient id="colorVlr" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#e11d48" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#e11d48" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#666', fontWeight: 600}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#666', fontWeight: 600}} tickFormatter={(value) => `Kz ${value}`} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px' }}
                    itemStyle={{ fontWeight: 'bold' }}
                  />
                  <Area type="monotone" dataKey="vlr" stroke="#e11d48" strokeWidth={4} fillOpacity={1} fill="url(#colorVlr)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Gráfico de Acessos ao Menu */}
        <Card className="rounded-3xl border-none shadow-sm overflow-hidden bg-white">
          <CardHeader className="p-6 border-b border-neutral-50">
            <CardTitle className="text-lg font-black text-neutral-900 uppercase tracking-tight">Tráfego do Menu (Leads)</CardTitle>
            <CardDescription>Quantidade de clientes que abriram o cardápio</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={visitChartData}>
                  <defs>
                    <linearGradient id="colorVisits" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#0ea5e9" stopOpacity={0.1}/>
                      <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#666', fontWeight: 600}} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 11, fill: '#666', fontWeight: 600}} />
                  <Tooltip 
                    contentStyle={{ borderRadius: '16px', border: 'none', boxShadow: '0 20px 25px -5px rgb(0 0 0 / 0.1)', padding: '12px' }}
                  />
                  <Area type="monotone" dataKey="acessos" stroke="#0ea5e9" strokeWidth={4} fillOpacity={1} fill="url(#colorVisits)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Gráfico de Horários de Pico */}
        <Card className="rounded-3xl border-none shadow-sm overflow-hidden bg-white">
          <CardHeader className="p-6 border-b border-neutral-50">
            <CardTitle className="text-lg font-black text-neutral-900 uppercase tracking-tight">Horários de Pico</CardTitle>
            <CardDescription>Concentração de pedidos por hora</CardDescription>
          </CardHeader>
          <CardContent className="p-6">
            <div className="h-[300px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={peakHoursData}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f0f0f0" />
                  <XAxis dataKey="hour" axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#999'}} interval={2} />
                  <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fill: '#999'}} />
                  <Tooltip 
                    cursor={{fill: '#f8f8f8'}}
                    contentStyle={{ borderRadius: '12px', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)' }}
                  />
                  <Bar dataKey="pedidos" radius={[4, 4, 0, 0]}>
                    {peakHoursData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.pedidos > 0 ? '#e11d48' : '#f0f0f0'} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Top 5 Produtos */}
        <Card className="rounded-3xl border-none shadow-sm overflow-hidden bg-white lg:col-span-2">
          <CardHeader className="p-6 border-b border-neutral-50 flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-lg font-black text-neutral-900 uppercase tracking-tight">🏆 TOP 5 Produtos</CardTitle>
              <CardDescription>Os itens favoritos dos seus clientes</CardDescription>
            </div>
          </CardHeader>
          <CardContent className="p-6">
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
              {popularProducts.length > 0 ? popularProducts.map((product, i) => (
                <div key={i} className="flex flex-col items-center text-center p-4 rounded-3xl bg-neutral-50 border border-neutral-100 hover:scale-105 transition-transform duration-300">
                  <div className={cn(
                    "w-12 h-12 rounded-2xl flex items-center justify-center font-black text-xl mb-4 shadow-sm",
                    i === 0 ? "bg-amber-400 text-amber-900" : 
                    i === 1 ? "bg-slate-300 text-slate-700" :
                    i === 2 ? "bg-orange-300 text-orange-900" : "bg-white text-neutral-400 border border-neutral-200"
                  )}>
                    {i + 1}
                  </div>
                  <p className="font-bold text-neutral-900 text-sm mb-1 line-clamp-2 h-10">{product.name}</p>
                  <p className="text-xs text-neutral-500 font-medium mb-3">{product.sales} unidades</p>
                  <p className="font-black text-rose-600 text-xs py-1 px-3 bg-white rounded-full shadow-sm">
                    {formatCurrency(product.price)}
                  </p>
                </div>
              )) : (
                <div className="col-span-5 text-center py-12 text-neutral-400 font-medium">
                  Nenhum dado de venda disponível para o ranking.
                </div>
              )}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function StatCard({ title, value, trend, trendUp, icon: Icon, highlight }: any) {
  return (
    <Card className={cn(
      "rounded-3xl border-none shadow-sm transition-all duration-300 hover:shadow-md",
      highlight ? "bg-rose-600 text-white" : "bg-white text-neutral-900"
    )}>
      <CardContent className="p-6">
        <div className="flex justify-between items-start mb-4">
          <div className={cn(
            "p-3 rounded-2xl",
            highlight ? "bg-white/20 text-white" : "bg-neutral-100 text-neutral-600"
          )}>
            <Icon className="w-6 h-6" />
          </div>
          <div className={cn(
            "flex items-center gap-1 text-[10px] font-black uppercase tracking-wider px-2 py-1 rounded-lg",
            highlight 
              ? "bg-white/20 text-white" 
              : trendUp ? "text-emerald-600 bg-emerald-50" : "text-rose-600 bg-rose-50"
          )}>
            {trendUp ? <ArrowUpRight className="w-3 h-3" /> : <ArrowDownRight className="w-3 h-3" />}
            {trend}
          </div>
        </div>
        <div>
          <p className={cn(
            "text-xs font-bold uppercase tracking-widest mb-1",
            highlight ? "text-rose-100" : "text-neutral-400"
          )}>{title}</p>
          <h3 className="text-2xl font-black">{value}</h3>
        </div>
      </CardContent>
    </Card>
  );
}
