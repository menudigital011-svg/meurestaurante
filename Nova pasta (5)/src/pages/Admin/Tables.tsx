import { useState, useEffect, useRef } from 'react';
import { 
  QrCode, 
  Plus, 
  Trash2, 
  Download, 
  Printer, 
  ExternalLink, 
  Loader2,
  AlertCircle,
  MoreVertical,
  Edit2,
  Search,
  Grid,
  List as ListIcon,
  Palette
} from 'lucide-react';
import { StandardQRCode } from '../../components/Admin/StandardQRCode';
import { restaurantService } from '../../lib/supabaseService';
import { RestaurantTable, Restaurant } from '../../types';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { useAuth } from '../../components/AuthProvider';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import { cn } from '@/lib/utils';

export default function AdminTables() {
  const { user, restaurantId } = useAuth();
  
  const [tables, setTables] = useState<RestaurantTable[]>([]);
  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isBulkDialogOpen, setIsBulkDialogOpen] = useState(false);
  const [bulkData, setBulkData] = useState({ prefix: 'Mesa ', startNumber: 1, quantity: 5 });
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [tableToDelete, setTableToDelete] = useState<string | null>(null);
  const [editingTable, setEditingTable] = useState<RestaurantTable | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  
  const [newTable, setNewTable] = useState({
    number: '',
    status: 'active' as const
  });
  const [qrColor, setQrColor] = useState('#000000');

  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!restaurantId) return;
    
    console.log('🔍 Iniciando busca de mesas para restaurantId:', restaurantId);
    
    // Subscriber para os dados do restaurante
    const unsubRestaurant = restaurantService.subscribeRestaurant(restaurantId, (data) => {
      console.log('🏠 Dados do restaurante carregados:', data?.name);
      setRestaurant(data);
      if (data?.primaryColor) setQrColor(data.primaryColor);
    });

    const unsubscribe = restaurantService.subscribeTables(restaurantId, (data) => {
      console.log('📋 Mesas carregadas do Supabase:', data.length);
      setTables(data);
      setLoading(false);
    });

    return () => {
      unsubRestaurant();
      unsubscribe();
    };
  }, [restaurantId]);

  const handleBulkCreate = async () => {
    if (!restaurantId) return;
    if (bulkData.quantity <= 0) return;
    setIsSaving(true);
    try {
      const promises = [];
      for (let i = 0; i < bulkData.quantity; i++) {
        const num = bulkData.startNumber + i;
        promises.push(restaurantService.addTable(restaurantId, {
          number: `${bulkData.prefix}${num}`.trim(),
          status: 'active',
          restaurantId: restaurantId
        }));
      }
      await Promise.all(promises);
      toast.success(`${bulkData.quantity} mesas criadas com sucesso`);
      setIsBulkDialogOpen(false);
    } catch (error) {
      console.error('Erro na criação em lote:', error);
      toast.error('Erro ao criar mesas em lote');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (!restaurantId) return;
    if (!newTable.number) {
      toast.error('O número da mesa é obrigatório');
      return;
    }

    setIsSaving(true);
    // Guardar estado anterior para rollback se necessário
    const previousTables = [...tables];

    try {
      if (editingTable) {
        // Atualização Otimista
        const updatedTable = { ...editingTable, ...newTable };
        setTables(prev => prev.map(t => t.id === editingTable.id ? updatedTable : t));
        
        await restaurantService.updateTable(restaurantId, editingTable.id, newTable);
        toast.success('Mesa atualizada com sucesso');
      } else {
        // Adição Otimista (com ID temporário)
        const tempId = `temp-${Date.now()}`;
        const tempTable: RestaurantTable = {
          id: tempId,
          restaurantId,
          ...newTable,
          createdAt: new Date().toISOString()
        };
        setTables(prev => [...prev, tempTable].sort((a, b) => 
          a.number.localeCompare(b.number, undefined, { numeric: true })
        ));

        await restaurantService.addTable(restaurantId, {
          ...newTable,
          restaurantId: restaurantId
        });
        toast.success('Mesa adicionada com sucesso');
      }
      setIsDialogOpen(false);
      setEditingTable(null);
      setNewTable({ number: '', status: 'active' });
    } catch (error: any) {
      console.error(error);
      // Rollback em caso de erro
      setTables(previousTables);
      const detailedError = error?.message || error?.details || 'Erro desconhecido';
      toast.error(`Erro ao salvar mesa: ${detailedError}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!restaurantId || !tableToDelete) return;

    setIsSaving(true);
    const previousTables = [...tables];
    
    try {
      // Remoção Otimista
      setTables(prev => prev.filter(t => t.id !== tableToDelete));
      
      await restaurantService.deleteTable(restaurantId, tableToDelete);
      toast.success('Mesa excluída com sucesso');
      setTableToDelete(null);
    } catch (error) {
      console.error('Erro ao excluir:', error);
      setTables(previousTables);
      toast.error('Erro ao excluir mesa. Tente novamente.');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (table: RestaurantTable) => {
    setEditingTable(table);
    setNewTable({ number: table.number, status: table.status });
    setIsDialogOpen(true);
  };

  const getTableUrl = (tableNumber: string) => {
    const baseUrl = window.location.origin;
    // Garante que o ID do restaurante venha do user.id
    const rId = user?.id || restaurantId;
    return `${baseUrl}/r/${rId}/table/${tableNumber}`;
  };

  const downloadQRCode = (tableNumber: string) => {
    // Escapa o número da mesa para uso no seletor
    const escapedNumber = CSS.escape(tableNumber);
    const container = document.querySelector(`[data-table-number="${escapedNumber}"]`);
    const canvas = container?.querySelector('canvas');
    
    if (canvas) {
      try {
        const url = canvas.toDataURL("image/png");
        const link = document.createElement("a");
        link.download = `mesa-${tableNumber}-qrcode.png`;
        link.href = url;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        const name = tableNumber.toUpperCase().includes('MESA') ? tableNumber : `Mesa ${tableNumber}`;
        toast.success(`QR Code da ${name} baixado!`);
      } catch (err) {
        console.error('Download failed:', err);
        toast.error('Erro ao gerar arquivo de imagem.');
      }
    } else {
      toast.error('Não foi possível capturar o QR Code. Tente novamente.');
    }
  };

  const handlePrint = () => {
    if (tables.length === 0) {
      toast.error('Nenhuma mesa cadastrada para imprimir.');
      return;
    }

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('O bloqueador de popups impediu a abertura da página de impressão.');
      return;
    }

    const restaurantName = restaurant?.name || 'Menu Digital';
    const logoHtml = restaurant?.logo ? `<img src="${restaurant.logo}" style="height: 80px; margin-bottom: 20px;">` : '';

    const tablesHtml = filteredTables.map(table => {
      const tableNumber = table.number.toString();
      const needsMesa = !tableNumber.toUpperCase().includes('MESA');
      const displayTitle = needsMesa ? `MESA ${tableNumber}` : tableNumber.toUpperCase();
      
      return `
      <div style="break-inside: avoid; page-break-inside: avoid; border: 2px solid #000; border-radius: 12px; padding: 24px; display: flex; flex-direction: column; align-items: center; text-align: center; background: white; min-height: 400px; justify-content: center; position: relative; margin: 10px;">
        <div style="width: 100%; margin-bottom: 20px;">
          <h2 style="font-size: 24px; font-weight: 800; margin: 0; text-transform: uppercase; color: #000;">${displayTitle}</h2>
          <p style="font-size: 14px; font-weight: 600; color: #666; margin: 4px 0 0 0;">${restaurantName}</p>
        </div>
        
        <div style="display: flex; align-items: center; justify-content: center; width: 100%;">
          <img src="https://api.qrserver.com/v1/create-qr-code/?size=400x400&data=${encodeURIComponent(getTableUrl(table.number))}" style="width: 250px; height: 250px; display: block;" />
        </div>
        
        <div style="margin-top: 20px; width: 100%;">
          <p style="font-size: 14px; font-weight: 700; margin: 0; color: #000; letter-spacing: 0.05em;">ESCANEIE PARA VER O MENU</p>
        </div>
      </div>
    `;}).join('');

    printWindow.document.write(`
      <html>
        <head>
          <title>QR Codes - ${restaurantName}</title>
          <style>
            @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap');
            * { box-sizing: border-box; }
            body { 
              font-family: 'Inter', sans-serif; 
              margin: 0; 
              padding: 0;
              background: #fff;
              color: #111827;
            }
            .grid {
              display: grid;
              grid-template-columns: repeat(2, 1fr);
              gap: 40px;
              padding: 40px;
              max-width: 1200px;
              margin: 0 auto;
            }
            @media print {
              .grid { 
                gap: 20px;
                padding: 0;
              }
              @page {
                size: A4;
                margin: 1.5cm;
              }
            }
          </style>
        </head>
        <body>
          <div class="grid">
            ${tablesHtml}
          </div>
          <script>
            window.onload = () => {
              setTimeout(() => {
                window.print();
              }, 1000);
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const filteredTables = tables.filter(t => {
    const matchesSearch = (t.number || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesStatus = statusFilter === 'all' || t.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
        <Loader2 className="w-8 h-8 animate-spin text-rose-600" />
        <p className="text-neutral-500 font-medium">Carregando mesas...</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700 print:hidden">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-3">
              <h1 className="text-3xl font-black text-neutral-900 tracking-tight">Gestão de Mesas</h1>
            </div>
            <p className="text-neutral-500 font-medium">
              {tables.length} {tables.length === 1 ? 'mesa sincronizada' : 'mesas sincronizadas'}{restaurant ? ` para ${restaurant.name}` : ''}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              onClick={handlePrint}
              className="rounded-xl border-neutral-200 flex"
            >
              <Printer className="w-4 h-4 mr-2" />
              Imprimir Todos
            </Button>
            <Dialog open={isDialogOpen} onOpenChange={(open) => {
              setIsDialogOpen(open);
              if (!open) {
                setEditingTable(null);
                setNewTable({ number: '', status: 'active' });
              }
            }}>
              <DialogTrigger 
                render={
                  <Button className="rounded-xl bg-rose-600 hover:bg-rose-700 font-bold shadow-lg shadow-rose-200">
                    <Plus className="w-4 h-4 mr-2" />
                    Nova Mesa
                  </Button>
                }
              />
              <DialogContent className="rounded-[2.5rem] sm:max-w-md border-none p-0 overflow-hidden shadow-2xl">
                <div className="bg-gradient-to-br from-rose-500 to-rose-600 p-8 text-white">
                  <DialogHeader>
                    <DialogTitle className="text-3xl font-black tracking-tight text-white">
                      {editingTable ? 'Editar Mesa' : 'Nova Mesa'}
                    </DialogTitle>
                    <p className="text-rose-100 font-medium text-sm">
                      {editingTable ? 'Atualize as informações da mesa e do QR Code.' : 'Adicione uma nova mesa para gerar um QR Code exclusivo.'}
                    </p>
                  </DialogHeader>
                </div>
                
                <div className="p-8 space-y-8 bg-white">
                  <div className="space-y-3">
                    <Label htmlFor="tableNumber" className="text-xs font-black uppercase tracking-widest text-neutral-400 ml-1">
                      Identificação da Mesa
                    </Label>
                    <div className="relative group">
                      <div className="absolute inset-y-0 left-4 flex items-center pointer-events-none transition-colors group-focus-within:text-rose-500 text-neutral-400">
                        <Palette className="w-5 h-5" />
                      </div>
                      <Input 
                        id="tableNumber" 
                        placeholder="Ex: 01, VIP, Balcão..." 
                        className="rounded-2xl h-14 pl-12 border-neutral-100 bg-neutral-50/50 focus:bg-white focus:ring-rose-500/20 text-lg font-bold transition-all"
                        value={newTable.number}
                        onChange={e => setNewTable({...newTable, number: e.target.value})}
                      />
                    </div>
                  </div>
  
                  <div className="space-y-4">
                    <Label className="text-xs font-black uppercase tracking-widest text-neutral-400 ml-1">
                      Status da Mesa
                    </Label>
                    <div className="grid grid-cols-2 gap-3">
                      <button 
                        type="button"
                        className={cn(
                          "relative flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 transition-all duration-300",
                          newTable.status === 'active' 
                            ? "bg-green-50/50 border-green-500 text-green-700 shadow-sm" 
                            : "bg-white border-neutral-100 text-neutral-400 hover:border-neutral-200"
                        )}
                        onClick={() => setNewTable({...newTable, status: 'active'})}
                      >
                        <div className={cn(
                          "w-2 h-2 rounded-full animate-pulse",
                          newTable.status === 'active' ? "bg-green-500" : "bg-neutral-300"
                        )} />
                        <span className="font-bold text-sm">Ativa</span>
                      </button>
                      <button 
                        type="button"
                        className={cn(
                          "relative flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 transition-all duration-300",
                          newTable.status === 'inactive' 
                            ? "bg-neutral-50 border-neutral-900 text-neutral-900 shadow-sm" 
                            : "bg-white border-neutral-100 text-neutral-400 hover:border-neutral-200"
                        )}
                        onClick={() => setNewTable({...newTable, status: 'inactive'})}
                      >
                        <div className="w-2 h-2 rounded-full bg-neutral-400" />
                        <span className="font-bold text-sm">Inativa</span>
                      </button>
                    </div>
                  </div>
                </div>
  
                <div className="p-8 pt-0 bg-white">
                  <Button 
                    className="w-full rounded-2xl bg-neutral-900 hover:bg-black h-14 font-black text-lg shadow-xl shadow-neutral-200 transition-all active:scale-95 group"
                    onClick={handleSave}
                    disabled={isSaving}
                  >
                    {isSaving ? (
                      <Loader2 className="w-6 h-6 animate-spin" />
                    ) : (
                      <>
                        {editingTable ? 'Salvar Alterações' : 'Criar Mesa'}
                        <Plus className="w-5 h-5 ml-2 group-hover:rotate-90 transition-transform" />
                      </>
                    )}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>
  
        {/* Stats & Tools */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-white p-6 rounded-[2rem] border border-neutral-100 shadow-sm flex items-center gap-4">
            <div className="w-12 h-12 bg-rose-50 rounded-2xl flex items-center justify-center">
              <QrCode className="w-6 h-6 text-rose-600" />
            </div>
            <div>
              <p className="text-xs font-black text-neutral-400 uppercase tracking-widest">Total de Mesas</p>
              <p className="text-2xl font-black text-neutral-900">{tables.length}</p>
            </div>
          </div>
          
          <div className="bg-white p-4 rounded-[2rem] border border-neutral-100 shadow-sm md:col-span-2 flex flex-col md:flex-row items-center gap-4">
            <div className="relative flex-1 w-full">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
              <Input 
                placeholder="Buscar mesa..." 
                className="pl-10 rounded-xl border-neutral-100 bg-neutral-50/50"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
              />
            </div>
            
            <div className="flex items-center gap-3 w-full md:w-auto">
              {/* Status Filter */}
              <div className="flex items-center bg-neutral-100 p-1 rounded-xl">
                <button 
                  className={cn(
                    "rounded-lg h-8 px-2 text-[10px] font-bold transition-all",
                    statusFilter === 'all' ? "shadow-sm bg-white text-neutral-900" : "text-neutral-500 hover:bg-neutral-50"
                  )}
                  onClick={() => setStatusFilter('all')}
                >
                  Todas
                </button>
                <button 
                  className={cn(
                    "rounded-lg h-8 px-2 text-[10px] font-bold transition-all",
                    statusFilter === 'active' ? "shadow-sm bg-white text-green-600" : "text-neutral-500 hover:bg-neutral-50"
                  )}
                  onClick={() => setStatusFilter('active')}
                >
                  Ativas
                </button>
                <button 
                  className={cn(
                    "rounded-lg h-8 px-2 text-[10px] font-bold transition-all",
                    statusFilter === 'inactive' ? "shadow-sm bg-white text-rose-600" : "text-neutral-500 hover:bg-neutral-50"
                  )}
                  onClick={() => setStatusFilter('inactive')}
                >
                  Inativas
                </button>
              </div>
  
              <div className="h-6 w-[1px] bg-neutral-200 hidden md:block" />
  
              <div className="flex items-center bg-neutral-100 p-1 rounded-xl">
                <Dialog open={isBulkDialogOpen} onOpenChange={setIsBulkDialogOpen}>
                  <DialogTrigger 
                    render={
                      <button className="rounded-lg h-8 px-3 gap-2 flex items-center text-[10px] font-bold text-neutral-600 hover:bg-neutral-50 transition-all">
                        <Plus className="w-3 h-3" />
                        Lote
                      </button>
                    }
                  />
                  <DialogContent className="rounded-[2.5rem] sm:max-w-md border-none p-0 overflow-hidden shadow-2xl">
                    <div className="bg-gradient-to-br from-indigo-500 to-indigo-600 p-8 text-white">
                      <DialogHeader>
                        <DialogTitle className="text-2xl font-black text-white">Gerar em Lote</DialogTitle>
                        <p className="text-indigo-100 text-sm font-medium">Crie múltiplas mesas de uma só vez de forma profissional.</p>
                      </DialogHeader>
                    </div>
                    <div className="p-8 bg-white space-y-6">
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Prefixo</Label>
                          <Input 
                            placeholder="Ex: Mesa "
                            className="rounded-xl h-12"
                            value={bulkData.prefix}
                            onChange={e => setBulkData({...bulkData, prefix: e.target.value})}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Início</Label>
                          <Input 
                            type="number"
                            className="rounded-xl h-12"
                            value={bulkData.startNumber}
                            onChange={e => setBulkData({...bulkData, startNumber: parseInt(e.target.value) || 1})}
                          />
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-[10px] font-black uppercase tracking-widest text-neutral-400">Quantidade Total</Label>
                        <Input 
                          type="number"
                          min="1"
                          max="50"
                          className="rounded-xl h-12 text-lg font-bold"
                          value={bulkData.quantity}
                          onChange={e => setBulkData({...bulkData, quantity: Math.min(50, parseInt(e.target.value) || 1)})}
                        />
                        <p className="text-[10px] text-neutral-400">Máximo de 50 por vez para garantir estabilidade.</p>
                      </div>
                      <Button 
                        className="w-full h-14 rounded-2xl bg-indigo-600 hover:bg-indigo-700 font-black text-lg transition-all active:scale-95 shadow-lg shadow-indigo-100"
                        onClick={handleBulkCreate}
                        disabled={isSaving}
                      >
                        {isSaving ? <Loader2 className="w-6 h-6 animate-spin" /> : 'Gerar Mesas'}
                      </Button>
                    </div>
                  </DialogContent>
                </Dialog>
              </div>
  
              <div className="h-6 w-[1px] bg-neutral-200 hidden md:block" />
  
              <div className="flex items-center bg-neutral-100 p-1 rounded-xl">
                <button 
                  className={cn(
                    "rounded-lg h-8 px-3 gap-2 flex items-center text-sm font-semibold transition-all", 
                    viewMode === 'grid' ? "shadow-sm bg-white text-neutral-900" : "text-neutral-500 hover:bg-neutral-50"
                  )}
                  onClick={() => setViewMode('grid')}
                >
                  <Grid className="w-4 h-4" />
                </button>
                <button 
                  className={cn(
                    "rounded-lg h-8 px-3 gap-2 flex items-center text-sm font-semibold transition-all", 
                    viewMode === 'list' ? "shadow-sm bg-white text-neutral-900" : "text-neutral-500 hover:bg-neutral-50"
                  )}
                  onClick={() => setViewMode('list')}
                >
                  <ListIcon className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
  
        {/* Empty State */}
        {filteredTables.length === 0 && (
          <div className="bg-white rounded-[3rem] border-2 border-dashed border-neutral-200 p-20 text-center space-y-4">
            <div className="w-20 h-20 bg-neutral-50 rounded-full flex items-center justify-center mx-auto">
              <QrCode className="w-10 h-10 text-neutral-300" />
            </div>
            <div className="max-w-xs mx-auto">
              <h3 className="text-xl font-bold text-neutral-900">Nenhuma mesa encontrada</h3>
              <p className="text-neutral-500 mt-2">Comece adicionando as mesas do seu estabelecimento para gerar os QR Codes.</p>
            </div>
          </div>
        )}
  
        {/* Grid View */}
        {viewMode === 'grid' && filteredTables.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {filteredTables.map((table) => (
              <div 
                key={table.id}
                data-table-number={table.number}
                className={cn(
                  "group bg-white rounded-[2rem] border border-neutral-100 p-6 shadow-sm hover:shadow-xl transition-all duration-300 flex flex-col items-center text-center",
                  table.status === 'inactive' && "opacity-60"
                )}
              >
                <div className="mb-4">
                  <h3 className="text-sm font-black text-neutral-900 leading-tight uppercase tracking-wide">{table.number}</h3>
                </div>
  
                <div className="w-full bg-neutral-50/10 rounded-[1.5rem] p-4 mb-5 flex items-center justify-center">
                  <StandardQRCode 
                    value={getTableUrl(table.number)}
                  />
                </div>
  
                <div className="w-full flex items-center gap-2 mt-auto">
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="flex-1 rounded-xl h-10 text-[11px] font-bold border-neutral-200 hover:bg-neutral-50 transition-all active:scale-95"
                    onClick={() => downloadQRCode(table.number)}
                  >
                    Baixar
                  </Button>
                  <Button 
                    variant="outline" 
                    size="icon"
                    className="rounded-xl h-10 w-10 text-neutral-400 border-neutral-200 hover:bg-neutral-50 hover:text-neutral-900 transition-all active:scale-95"
                    onClick={() => handleEdit(table)}
                    title="Editar Mesa"
                  >
                    <Edit2 className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="outline" 
                    size="icon"
                    className="rounded-xl h-10 w-10 text-rose-600 border-rose-50 bg-rose-50/30 hover:bg-rose-100 hover:text-rose-700 hover:border-rose-200 transition-all active:scale-90"
                    onClick={(e) => {
                      e.stopPropagation();
                      setTableToDelete(table.id);
                    }}
                    title="Excluir Mesa"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
  
        {/* List View */}
        {viewMode === 'list' && filteredTables.length > 0 && (
          <div className="bg-white rounded-[2rem] border border-neutral-100 overflow-hidden shadow-sm">
            <table className="w-full text-left">
              <thead className="bg-neutral-50 border-bottom border-neutral-100">
                <tr>
                  <th className="px-6 py-4 text-xs font-black text-neutral-400 uppercase tracking-widest">Número</th>
                  <th className="px-6 py-4 text-xs font-black text-neutral-400 uppercase tracking-widest">Status</th>
                  <th className="px-6 py-4 text-xs font-black text-neutral-400 uppercase tracking-widest">URL do Atendimento</th>
                  <th className="px-6 py-4 text-xs font-black text-neutral-400 uppercase tracking-widest text-right">Ações</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100">
                {filteredTables.map((table) => (
                  <tr key={table.id} className="hover:bg-neutral-50/50 transition-colors">
                    <td className="px-6 py-4 font-bold text-neutral-900">
                      {table.number.toUpperCase().includes('MESA') ? table.number : `Mesa ${table.number}`}
                    </td>
                    <td className="px-6 py-4">
                      <span className={cn(
                        "inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider",
                        table.status === 'active' ? "bg-green-100 text-green-700" : "bg-neutral-100 text-neutral-600"
                      )}>
                        {table.status === 'active' ? 'Ativa' : 'Inativa'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <code className="text-[11px] bg-neutral-100 p-1.5 rounded-lg text-neutral-500 font-mono underline decoration-neutral-200">
                        {getTableUrl(table.number)}
                      </code>
                    </td>
                    <td className="px-6 py-4 flex items-center justify-end gap-2">
                      <Button variant="ghost" size="icon" className="rounded-lg h-9 w-9" onClick={() => handleEdit(table)}>
                        <Edit2 className="w-4 h-4 text-neutral-400" />
                      </Button>
                      <Button variant="ghost" size="icon" className="rounded-lg h-9 w-9" onClick={() => downloadQRCode(table.number)}>
                        <Download className="w-4 h-4 text-neutral-400" />
                      </Button>
                      <Button 
                        variant="outline" 
                        size="icon" 
                        className="rounded-lg h-9 w-9 text-rose-600 border-rose-50 bg-rose-50/30 hover:bg-rose-100 hover:text-rose-700 transition-all active:scale-90" 
                        onClick={(e) => {
                          e.stopPropagation();
                          setTableToDelete(table.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
  
        {/* Hint */}
        <div className="bg-rose-50 p-6 rounded-[2rem] border border-rose-100 flex gap-4">
          <div className="w-10 h-10 bg-white rounded-2xl flex items-center justify-center flex-shrink-0 shadow-sm">
            <AlertCircle className="w-5 h-5 text-rose-600" />
          </div>
          <div className="space-y-1">
            <h4 className="text-sm font-bold text-rose-900">Como funciona o atendimento por mesa?</h4>
            <p className="text-xs text-rose-700 leading-relaxed">
              Ao escanear o QR Code, o cliente acessa o cardápio e, ao finalizar o pedido, o número da mesa já virá preenchido 
              automaticamente no formulário de checkout. Isso garante que sua equipe saiba exatamente para onde levar o prato.
            </p>
          </div>
        </div>
  
        {/* Delete Confirmation Dialog */}
        <Dialog open={!!tableToDelete} onOpenChange={(open) => !open && !isSaving && setTableToDelete(null)}>
          <DialogContent className="rounded-[2rem] sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="text-2xl font-black text-center">Excluir Mesa?</DialogTitle>
            </DialogHeader>
            <div className="py-6 text-center">
              <div className="w-20 h-20 bg-rose-50 rounded-full flex items-center justify-center mx-auto mb-4 border-4 border-white shadow-sm">
                <Trash2 className="w-10 h-10 text-rose-600" />
              </div>
              <h3 className="text-xl font-bold text-neutral-900 mb-2">
                {(() => {
                  const table = tables.find(t => t.id === tableToDelete);
                  const name = table?.number || '';
                  const displayName = name.toUpperCase().includes('MESA') ? name : `Mesa ${name}`;
                  return `Confirmar exclusão da ${displayName}?`;
                })()}
              </h3>
              <p className="text-neutral-500 font-medium px-4">
                Esta ação removerá permanentemente a mesa do banco de dados e o QR Code deixará de funcionar.
              </p>
            </div>
            <DialogFooter className="flex-col sm:flex-row gap-2 p-4 pt-0">
              <Button 
                variant="outline" 
                onClick={() => setTableToDelete(null)}
                disabled={isSaving}
                className="flex-1 rounded-xl h-12 font-bold border-neutral-200"
              >
                Cancelar
              </Button>
              <Button 
                onClick={handleDelete}
                disabled={isSaving}
                className="flex-1 rounded-xl bg-rose-600 hover:bg-rose-700 h-12 font-bold shadow-lg shadow-rose-200"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin mr-2" />
                    Excluindo...
                  </>
                ) : (
                  'Sim, Excluir'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

    </>
  );
}
