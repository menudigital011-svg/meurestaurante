import { Outlet, Link, useLocation, useNavigate } from 'react-router-dom';
import { 
  LayoutDashboard, 
  UtensilsCrossed, 
  ClipboardList, 
  Settings, 
  LogOut,
  ChevronRight,
  Menu as MenuIcon,
  X,
  Lock,
  Loader2,
  QrCode
} from 'lucide-react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import { useAuth } from '../AuthProvider';
import { restaurantService } from '@/lib/supabaseService';

export default function AdminLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const { user, restaurantId, signOut, loading } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && restaurantId && !loading) {
      // Garantir que o restaurante existe para este usuário
      restaurantService.getRestaurant(restaurantId).then(res => {
        if (!res) {
          console.log('🆕 Novo usuário detectado. Criando ambiente isolado...', restaurantId);
          restaurantService.updateRestaurant(restaurantId, {
            name: 'Meu Novo Restaurante',
            description: 'Bem-vindo! Configure os dados do seu restaurante nas definições.',
            primaryColor: '#e11d48',
            address: 'Luanda, Angola',
            whatsapp: '244900000000',
            country: 'Angola (KZ)'
          }).then(() => {
            toast.success('Ambiente inicializado com sucesso!');
          }).catch(err => {
            console.error('Erro ao inicializar:', err);
          });
        }
      });
    }
  }, [user, restaurantId, loading]);

  const handleLogout = async () => {
    try {
      await signOut();
      navigate('/login');
      toast.success('Sessão encerrada');
    } catch (error) {
      toast.error('Erro ao sair');
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50">
        <Loader2 className="w-8 h-8 animate-spin text-rose-600" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-neutral-50 p-4">
        <div className="max-w-md w-full bg-white rounded-[2rem] shadow-xl border border-neutral-100 p-8 text-center space-y-6">
          <div className="w-20 h-20 bg-rose-50 rounded-3xl flex items-center justify-center mx-auto">
            <Lock className="w-10 h-10 text-rose-600" />
          </div>
          <div className="space-y-2">
            <h1 className="text-2xl font-black text-neutral-900">Área Restrita</h1>
            <p className="text-neutral-500">Faça login com sua conta para acessar o painel administrativo.</p>
          </div>
          <Button 
            onClick={() => navigate('/login')}
            className="w-full h-12 rounded-xl bg-rose-600 hover:bg-rose-700 text-lg font-bold gap-3"
          >
            Ir para Login
          </Button>
          <Link to="/" className="block text-sm font-medium text-neutral-400 hover:text-rose-600 transition-colors">
            Voltar para o Menu
          </Link>
        </div>
      </div>
    );
  }

  const menuItems = [
    { icon: LayoutDashboard, label: 'Dashboard', path: '/admin' },
    { icon: UtensilsCrossed, label: 'Menu', path: '/admin/menu' },
    { icon: QrCode, label: 'Mesas e QR Codes', path: '/admin/tables' },
    { icon: ClipboardList, label: 'Pedidos', path: '/admin/orders' },
    { icon: Settings, label: 'Configurações', path: '/admin/settings' },
  ];

  return (
    <div className="min-h-screen bg-neutral-50 flex">
      {/* Sidebar */}
      <aside 
        className={cn(
          "fixed inset-y-0 left-0 z-50 bg-white border-r border-neutral-200 transition-all duration-300 ease-in-out",
          isSidebarOpen ? "w-64" : "w-20"
        )}
      >
        <div className="h-full flex flex-col">
          <div className="p-6 flex items-center justify-between">
            {isSidebarOpen && (
              <span className="font-black text-xl tracking-tighter text-rose-600">ADMIN</span>
            )}
            <Button 
              variant="ghost" 
              size="icon" 
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
              className="rounded-xl"
            >
              {isSidebarOpen ? <X className="w-5 h-5" /> : <MenuIcon className="w-5 h-5" />}
            </Button>
          </div>

          <nav className="flex-1 px-3 space-y-1">
            {menuItems.map((item) => {
              const isActive = location.pathname === item.path;
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={cn(
                    "flex items-center gap-3 px-3 py-3 rounded-xl transition-all group",
                    isActive 
                      ? "bg-rose-50 text-rose-600" 
                      : "text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900"
                  )}
                >
                  <item.icon className={cn("w-5 h-5", isActive ? "text-rose-600" : "text-neutral-400 group-hover:text-neutral-900")} />
                  {isSidebarOpen && <span className="font-semibold">{item.label}</span>}
                  {isSidebarOpen && isActive && <ChevronRight className="w-4 h-4 ml-auto" />}
                </Link>
              );
            })}
          </nav>

          <div className="p-4 border-t border-neutral-100">
            <Button 
              variant="ghost" 
              onClick={handleLogout}
              className={cn(
                "w-full justify-start gap-3 text-neutral-500 hover:text-rose-600 hover:bg-rose-50 rounded-xl",
                !isSidebarOpen && "px-2"
              )}
            >
              <LogOut className="w-5 h-5" />
              {isSidebarOpen && <span className="font-semibold">Sair</span>}
            </Button>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main 
        className={cn(
          "flex-1 transition-all duration-300",
          isSidebarOpen ? "ml-64" : "ml-20"
        )}
      >
        <div className="p-8 max-w-7xl mx-auto">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
