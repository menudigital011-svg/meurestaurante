import { useState, useEffect, useRef, ChangeEvent } from 'react';
import { 
  Store, 
  Palette, 
  Clock, 
  MapPin, 
  Phone, 
  Image as ImageIcon,
  QrCode,
  Save,
  Loader2,
  Upload,
  Globe,
  CreditCard,
  ShoppingBag,
  Facebook,
  Instagram,
  Twitter,
  ExternalLink,
  Copy,
  Check,
  Download,
  Printer,
  Search,
  Type,
  AlignLeft,
  Smartphone,
  Info,
  Sparkles,
  Utensils,
  Truck,
  ShieldCheck,
  Lock,
  Eye,
  EyeOff,
  PhoneCall,
  Trash2,
  Plus
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { QRCodeSVG } from 'qrcode.react';
import { restaurantService } from '../../lib/supabaseService';
import { Restaurant } from '../../types';
import { MOCK_RESTAURANT } from '../../lib/mockDb';
import { toast } from 'sonner';
import { useAuth } from '../../components/AuthProvider';
import { cn } from '@/lib/utils';

const DAYS_OF_WEEK = [
  'Segunda-feira',
  'Terça-feira',
  'Quarta-feira',
  'Quinta-feira',
  'Sexta-feira',
  'Sábado',
  'Domingo'
];

const SLOGAN_SUGGESTIONS = [
  "Sabor que conquista",
  "A melhor experiência gastronómica",
  "Feito com amor para você",
  "O sabor da felicidade",
  "Qualidade em cada detalhe"
];

export default function AdminSettings() {
  const { user, restaurantId } = useAuth();

  const [restaurant, setRestaurant] = useState<Restaurant | null>(null);
  const [isSaving, setIsSaving] = useState<string | null>(null);
  const [showPin, setShowPin] = useState(false);
  const [showCurrentPin, setShowCurrentPin] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [currentPinInput, setCurrentPinInput] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [copied, setCopied] = useState(false);
  
  const logoInputRef = useRef<HTMLInputElement>(null);
  const bannerInputRef = useRef<HTMLInputElement>(null);
  const carouselInputRef = useRef<HTMLInputElement>(null);
  const uploadTaskRef = useRef<any>(null);

  const [activeCarouselIndex, setActiveCarouselIndex] = useState<number | null>(null);
  const [previewBannerIndex, setPreviewBannerIndex] = useState(0);

  const [newCityName, setNewCityName] = useState('');
  const [newCityFee, setNewCityFee] = useState('');

  useEffect(() => {
    if (!restaurantId) return;

    // Usar assinatura para manter os dados sempre atualizados em tempo real
    const unsubscribe = restaurantService.subscribeRestaurant(restaurantId, (data) => {
      if (data) {
        setRestaurant(data);
        setIsLoading(false);
      } else {
        // Inicialização para novos restaurantes
        const newRest = { ...MOCK_RESTAURANT, id: restaurantId, ownerUid: restaurantId };
        setRestaurant(newRest);
        restaurantService.updateRestaurant(restaurantId, newRest).catch(() => {});
        setIsLoading(false);
      }
    });

    return () => {
      unsubscribe();
    };
  }, [restaurantId]);

  useEffect(() => {
    if (restaurant?.bannerMode === 'carousel' && restaurant.banners && restaurant.banners.length > 0) {
      const interval = setInterval(() => {
        setPreviewBannerIndex((prev) => (prev + 1) % (restaurant.banners?.length || 1));
      }, 10000);
      return () => clearInterval(interval);
    }
  }, [restaurant?.bannerMode, restaurant?.banners]);

  const compressImage = (file: File, maxWidth: number, maxHeight: number): Promise<Blob> => {
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error('Tempo limite de processamento excedido')), 15000);
      
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onload = () => {
          clearTimeout(timeout);
          const canvas = document.createElement('canvas');
          let width = img.width;
          let height = img.height;

          const ratio = Math.min(maxWidth / width, maxHeight / height);
          if (ratio < 1) {
            width *= ratio;
            height *= ratio;
          }

          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.drawImage(img, 0, 0, width, height);
          }
          
          const outputType = file.type === 'image/png' ? 'image/png' : 'image/jpeg';
          canvas.toBlob((blob) => {
            if (blob) resolve(blob);
            else reject(new Error('Falha ao gerar o arquivo comprimido'));
          }, outputType, 0.7);
        };
        img.onerror = () => {
          clearTimeout(timeout);
          reject(new Error('Erro ao carregar a imagem'));
        };
      };
      reader.onerror = () => {
        clearTimeout(timeout);
        reject(new Error('Erro ao ler o arquivo'));
      };
    });
  };

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>, type: 'logo' | 'banner' | 'carousel', index?: number) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast.error('O arquivo selecionado não é uma imagem válida.');
      return;
    }

    if (!file.type.includes('png') && !file.type.includes('jpeg') && !file.type.includes('webp')) {
      toast.error('Formato não suportado. Use PNG, JPG ou WEBP.');
      return;
    }

    const uploadKey = type === 'carousel' ? `carousel_${index}` : type;
    setIsUploading(uploadKey);
    setUploadProgress(0);
    const loadingToast = toast.loading(`Enviando ${type === 'logo' ? 'logotipo' : 'imagem'}...`);
    
    try {
      const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const bucket = 'restaurant-images';
      const path = type === 'logo' ? `${restaurantId}/brand/${fileName}` : 
                 type === 'banner' ? `${restaurantId}/brand/${fileName}` : 
                 `${restaurantId}/brand/carousel/${fileName}`;
      
      const publicUrl = await restaurantService.uploadFile(bucket, path, file);

      setRestaurant(prev => {
        if (!prev) return prev;
        if (type === 'carousel' && index !== undefined) {
          const newBanners = [...(prev.banners || [])];
          newBanners[index] = publicUrl;
          return { ...prev, banners: newBanners };
        }
        return { ...prev, [type]: publicUrl };
      });

      toast.dismiss(loadingToast);
      toast.success('Imagem carregada e pronta para salvar!');
    } catch (error: any) {
      toast.dismiss(loadingToast);
      console.error('Upload error details:', error);
      toast.error('Erro ao subir imagem para o Supabase.');
    } finally {
      setIsUploading(null);
      setUploadProgress(0);
      if (e.target) e.target.value = '';
    }
  };

  const cancelUpload = () => {
    if (uploadTaskRef.current) {
      uploadTaskRef.current.cancel();
    }
    setIsUploading(null);
  };

  const handleSave = async (section: string) => {
    if (!restaurant) return;

    // Validação de PIN se for a seção de segurança
    if (section === 'security' && restaurant.managerPin) {
      if (currentPinInput !== restaurant.managerPin) {
        toast.error('PIN Atual incorreto! Você precisa confirmar o PIN antigo para cadastrar um novo.');
        return;
      }
    }

    setIsSaving(section);
    try {
      // SEGURANÇA: Se houver um novo PIN digitado, usamos ele. 
      // Caso contrário, mantemos o que já está no estado do restaurante.
      const finalPin = newPin || restaurant.managerPin;
      const dataToSave = { 
        ...restaurant, 
        id: restaurantId, 
        ownerUid: restaurantId,
        managerPin: finalPin,
        country: 'Angola (KZ)'
      };
      
      console.log('Salvando dados do restaurante:', dataToSave);
      await restaurantService.updateRestaurant(restaurantId, dataToSave);
      
      setRestaurant(dataToSave);
      setNewPin(''); // Limpa o campo de novo PIN após salvar
      setCurrentPinInput(''); // Limpa o campo de confirmação
      toast.success('Configurações salvas com sucesso!');
    } catch (error: any) {
      console.error('Erro detalhado ao salvar:', error);
      // Extrair mensagem de erro mais amigável ou técnica para diagnóstico
      const msg = error.message || error.error_description || 'Erro desconhecido';
      toast.error(`Erro ao salvar: ${msg}`);
    } finally {
      setIsSaving(null);
    }
  };

  const copyToClipboard = () => {
    const url = `${window.location.origin}/r/${restaurantId}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('Link do cardápio copiado!');
    setTimeout(() => setCopied(false), 2000);
  };

  const downloadQRCode = () => {
    const container = document.getElementById('qr-code-container');
    const svg = container?.querySelector('svg');
    if (!svg) {
      toast.error('Erro ao identificar o QR Code');
      return;
    }
    
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new Image();
    
    img.onload = () => {
      // Usar um tamanho maior para download (ex: 1024) para qualidade de impressão
      canvas.width = 1024;
      canvas.height = 1024;
      
      // Fundo Branco (importante se o QR code for transparente)
      if (ctx) {
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      }
      
      const url = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.download = `qr-code-${restaurant?.name?.toLowerCase().replace(/\s+/g, '-') || 'menu'}.png`;
      link.href = url;
      link.click();
      toast.success('QR Code baixado em alta resolução!');
    };
    
    img.onerror = () => {
      toast.error('Erro ao processar o download do QR Code');
    };
    
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-[60vh]">
        <Loader2 className="w-8 h-8 animate-spin text-rose-600" />
      </div>
    );
  }

  if (!restaurant) return null;

  return (
    <div className="max-w-5xl mx-auto space-y-12 pb-20">
      <div className="flex flex-col gap-2">
        <h1 className="text-4xl font-black tracking-tight text-neutral-900 uppercase">Configurações do Sistema</h1>
        <p className="text-neutral-500 text-lg">Gerencie todos os aspectos do seu restaurante e menu digital em um só lugar.</p>
      </div>

      {/* 1. INFORMAÇÕES DO RESTAURANTE */}
      <Card className="rounded-[2.5rem] border-none shadow-xl shadow-neutral-200/50 overflow-hidden bg-white">
        <CardHeader className="p-8 border-b border-neutral-50">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-rose-50 rounded-2xl text-rose-600">
              <Store className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-2xl font-black text-neutral-900">1. INFORMAÇÕES DO RESTAURANTE</CardTitle>
              <CardDescription className="text-neutral-500 text-base">Gerencie as informações principais que serão exibidas no seu menu digital.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <Label className="text-sm font-bold text-neutral-700 flex items-center gap-2">
                <Type className="w-4 h-4 text-rose-500" /> Nome do Restaurante
              </Label>
              <Input 
                value={restaurant.name} 
                onChange={e => setRestaurant({...restaurant, name: e.target.value})}
                className="rounded-2xl h-12 border-neutral-200 focus:ring-rose-500 focus:border-rose-500" 
                placeholder="Ex: Gourmet Haven"
              />
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-bold text-neutral-700 flex items-center gap-2">
                <Sparkles className="w-4 h-4 text-rose-500" /> Slogan
              </Label>
              <Input 
                value={restaurant.slogan || ''} 
                onChange={e => setRestaurant({...restaurant, slogan: e.target.value})}
                className="rounded-2xl h-12 border-neutral-200" 
                placeholder="Ex: Sabor que conquista"
              />
              <div className="flex flex-wrap gap-2 mt-2">
                {SLOGAN_SUGGESTIONS.map(s => (
                  <button 
                    key={s}
                    onClick={() => setRestaurant({...restaurant, slogan: s})}
                    className="text-[10px] bg-neutral-50 hover:bg-rose-50 hover:text-rose-600 text-neutral-500 px-3 py-1.5 rounded-full transition-all border border-neutral-100"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>

            <div className="space-y-3 md:col-span-2">
              <Label className="text-sm font-bold text-neutral-700 flex items-center gap-2">
                <AlignLeft className="w-4 h-4 text-rose-500" /> Descrição curta
              </Label>
              <textarea 
                className="flex min-h-[100px] w-full rounded-2xl border border-neutral-200 bg-transparent px-4 py-3 text-sm shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-500 transition-all" 
                value={restaurant.description} 
                onChange={e => setRestaurant({...restaurant, description: e.target.value})}
                placeholder="Conte um pouco sobre o seu restaurante..."
              />
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-bold text-neutral-700 flex items-center gap-2">
                <Phone className="w-4 h-4 text-rose-500" /> WhatsApp (Pedidos)
              </Label>
              <Input 
                value={restaurant.whatsapp} 
                onChange={e => setRestaurant({...restaurant, whatsapp: e.target.value})}
                className="rounded-2xl h-12 border-neutral-200" 
                placeholder="Ex: 244932456234"
              />
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-bold text-neutral-700 flex items-center gap-2">
                <PhoneCall className="w-4 h-4 text-emerald-500" /> Botão de Chamada Direta
              </Label>
              <Input 
                value={restaurant.directCallPhone || ''} 
                onChange={e => setRestaurant({...restaurant, directCallPhone: e.target.value})}
                className="rounded-2xl h-12 border-neutral-200" 
                placeholder="Ex: 244926522345"
              />
              <p className="text-[10px] text-neutral-400 font-medium">Ideal para reservas e encomendas rápidas.</p>
            </div>

            <div className="space-y-3">
              <Label className="text-sm font-bold text-neutral-700 flex items-center gap-2">
                <Globe className="w-4 h-4 text-rose-500" /> País (Padrão do Sistema)
              </Label>
              <div className="relative">
                <Input 
                  value="Angola (KZ)" 
                  readOnly
                  className="rounded-2xl h-12 border-neutral-200 bg-neutral-50 text-neutral-900 font-bold cursor-not-allowed pl-10" 
                />
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                   <img src="https://flagcdn.com/w20/ao.png" alt="Angola" className="w-5 h-auto rounded-sm" />
                </div>
              </div>
              <p className="text-[10px] text-neutral-400 font-medium italic">Configurado automaticamente para o mercado de Angola.</p>
            </div>

            <div className="space-y-3 md:col-span-2">
              <Label className="text-sm font-bold text-neutral-700 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-rose-500" /> Endereço
              </Label>
              <Input 
                value={restaurant.address} 
                onChange={e => setRestaurant({...restaurant, address: e.target.value})}
                className="rounded-2xl h-12 border-neutral-200" 
                placeholder="Endereço completo do restaurante"
              />
            </div>

            <div className="space-y-4 md:col-span-2 pt-4">
              <div className="flex justify-between items-end">
                <Label className="text-sm font-bold text-neutral-700">Logotipo</Label>
                <span className="text-[10px] text-neutral-400 font-medium bg-neutral-50 px-2 py-1 rounded-md">Tamanho recomendado: 500x500px | Formato: PNG ou JPG</span>
              </div>
              <div className="flex items-center gap-8 p-6 bg-neutral-50 rounded-[2rem] border border-dashed border-neutral-200">
                <div className="relative group shrink-0">
                  <div className="w-32 h-32 rounded-3xl overflow-hidden border-4 border-white shadow-lg bg-white">
                    <img 
                      src={restaurant.logo || undefined} 
                      className="w-full h-full object-cover" 
                      alt="Logo" 
                      referrerPolicy="no-referrer" 
                    />
                  </div>
                  {isUploading === 'logo' && (
                    <div className="absolute inset-0 bg-white/80 backdrop-blur-[2px] rounded-3xl flex flex-col items-center justify-center gap-2">
                      <Loader2 className="w-8 h-8 animate-spin text-rose-600" />
                      <span className="text-[10px] font-bold text-rose-600">{uploadProgress}%</span>
                      <button 
                        onClick={cancelUpload}
                        className="text-[10px] font-bold text-rose-600 hover:underline"
                      >
                        Cancelar
                      </button>
                    </div>
                  )}
                </div>
                <div className="flex-1 space-y-4">
                  <p className="text-sm text-neutral-500">Suporte a transparência (PNG) para um visual mais profissional.</p>
                  <div className="flex flex-col gap-3">
                    <div className="flex gap-2">
                      <input 
                        type="file" 
                        ref={logoInputRef} 
                        style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
                        accept="image/*"
                        onChange={(e) => handleFileUpload(e, 'logo')}
                      />
                      <Button 
                        variant="outline" 
                        className="rounded-xl gap-2 border-neutral-200 bg-white hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-all flex-1"
                        onClick={() => logoInputRef.current?.click()}
                        disabled={!!isUploading}
                      >
                        <Upload className="w-4 h-4" /> Upload
                      </Button>
                    </div>
                    <div className="relative">
                      <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                        <Globe className="w-4 h-4 text-neutral-400" />
                      </div>
                      <Input 
                        placeholder="Ou cole o link da imagem aqui..."
                        value={restaurant.logo}
                        onChange={(e) => setRestaurant({...restaurant, logo: e.target.value})}
                        className="pl-10 rounded-xl border-neutral-200 text-xs"
                      />
                    </div>
                    <p className="text-[10px] text-amber-600 font-medium flex items-center gap-1">
                      <Info className="w-3 h-3" />
                      Não está carregando a imagem pelo computador? Use a opção de link acima.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button 
              className="rounded-2xl bg-rose-600 hover:bg-rose-700 gap-2 px-10 h-14 text-lg font-bold shadow-lg shadow-rose-200 transition-all active:scale-95"
              onClick={() => handleSave('info')}
              disabled={isSaving === 'info'}
            >
              {isSaving === 'info' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              Salvar Informações
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 2. HORÁRIO DE ATENDIMENTO */}
      <Card className="rounded-[2.5rem] border-none shadow-xl shadow-neutral-200/50 overflow-hidden bg-white">
        <CardHeader className="p-8 border-b border-neutral-50">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-rose-50 rounded-2xl text-rose-600">
              <Clock className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-2xl font-black text-neutral-900">2. HORÁRIO DE ATENDIMENTO</CardTitle>
              <CardDescription className="text-neutral-500 text-base">Configure o horário de funcionamento do restaurante. O status será calculado automaticamente.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-8 space-y-8">
          <div className="grid grid-cols-1 gap-4">
            {DAYS_OF_WEEK.map(day => {
              const config = restaurant.openingHours?.[day] || { open: '08:00', close: '22:00', active: false };
              return (
                <div key={day} className={cn(
                  "flex flex-col md:flex-row md:items-center justify-between p-5 rounded-3xl border transition-all",
                  config.active ? "bg-rose-50/30 border-rose-100 shadow-sm" : "bg-neutral-50/50 border-neutral-100 opacity-60"
                )}>
                  <div className="flex items-center gap-4 mb-4 md:mb-0">
                    <Checkbox 
                      checked={!!config.active}
                      onCheckedChange={(checked) => {
                        const newHours = { ...restaurant.openingHours };
                        newHours[day] = { ...config, active: !!checked };
                        setRestaurant({ ...restaurant, openingHours: newHours });
                      }}
                      className="w-6 h-6 rounded-lg border-neutral-300 data-[state=checked]:bg-rose-600 data-[state=checked]:border-rose-600"
                    />
                    <span className={cn("font-bold text-lg", config.active ? "text-neutral-900" : "text-neutral-400")}>{day}</span>
                  </div>
                  
                  {config.active && (
                    <div className="flex items-center gap-4">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-neutral-400 uppercase">Abertura</span>
                        <Input 
                          type="time" 
                          value={config.open}
                          onChange={(e) => {
                            const newHours = { ...restaurant.openingHours };
                            newHours[day] = { ...config, open: e.target.value };
                            setRestaurant({ ...restaurant, openingHours: newHours });
                          }}
                          className="w-32 rounded-xl h-10 border-neutral-200"
                        />
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-bold text-neutral-400 uppercase">Fechamento</span>
                        <Input 
                          type="time" 
                          value={config.close}
                          onChange={(e) => {
                            const newHours = { ...restaurant.openingHours };
                            newHours[day] = { ...config, close: e.target.value };
                            setRestaurant({ ...restaurant, openingHours: newHours });
                          }}
                          className="w-32 rounded-xl h-10 border-neutral-200"
                        />
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>

          <div className="space-y-3">
            <Label className="text-sm font-bold text-neutral-700 flex items-center gap-2">
              <Info className="w-4 h-4 text-rose-500" /> Observação (opcional)
            </Label>
            <Input 
              value={restaurant.hoursObservation || ''} 
              onChange={e => setRestaurant({...restaurant, hoursObservation: e.target.value})}
              className="rounded-2xl h-12 border-neutral-200" 
              placeholder="Ex: Feriados: fechado ou Domingos horário reduzido"
            />
          </div>

          <div className="flex justify-end pt-4">
            <Button 
              className="rounded-2xl bg-rose-600 hover:bg-rose-700 gap-2 px-10 h-14 text-lg font-bold shadow-lg shadow-rose-200 transition-all active:scale-95"
              onClick={() => handleSave('hours')}
              disabled={isSaving === 'hours'}
            >
              {isSaving === 'hours' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              Salvar Horários
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 3. PAGAMENTOS */}
      <Card className="rounded-[2.5rem] border-none shadow-xl shadow-neutral-200/50 overflow-hidden bg-white">
        <CardHeader className="p-8 border-b border-neutral-50">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-rose-50 rounded-2xl text-rose-600">
              <CreditCard className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-2xl font-black text-neutral-900">3. PAGAMENTOS</CardTitle>
              <CardDescription className="text-neutral-500 text-base">Configure os métodos de pagamento disponíveis para os seus clientes.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-3">
              <Label className="text-sm font-bold text-neutral-700">IBAN / Transferência bancária</Label>
              <Input 
                value={restaurant.paymentMethods?.iban || ''} 
                onChange={e => setRestaurant({
                  ...restaurant, 
                  paymentMethods: { ...restaurant.paymentMethods, iban: e.target.value }
                })}
                className="rounded-2xl h-12 border-neutral-200" 
                placeholder="Ex: AO06 0055 0000 1234 5678 9123 5"
              />
            </div>
            <div className="space-y-3">
              <Label className="text-sm font-bold text-neutral-700">Multicaixa Express</Label>
              <Input 
                value={restaurant.paymentMethods?.multicaixa || ''} 
                onChange={e => setRestaurant({
                  ...restaurant, 
                  paymentMethods: { ...restaurant.paymentMethods, multicaixa: e.target.value }
                })}
                className="rounded-2xl h-12 border-neutral-200" 
                placeholder="Ex: 923 456 789"
              />
            </div>
          </div>
          
          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3 items-start">
            <Info className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <p className="text-sm text-amber-700 font-medium">Os exemplos exibidos são apenas ilustrativos. Insira seus dados reais para receber pagamentos.</p>
          </div>

          <div className="flex justify-end pt-4">
            <Button 
              className="rounded-2xl bg-rose-600 hover:bg-rose-700 gap-2 px-10 h-14 text-lg font-bold shadow-lg shadow-rose-200 transition-all active:scale-95"
              onClick={() => handleSave('payments')}
              disabled={isSaving === 'payments'}
            >
              {isSaving === 'payments' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              Salvar Pagamentos
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 4. TIPOS DE PEDIDO */}
      <Card className="rounded-[2.5rem] border-none shadow-xl shadow-neutral-200/50 overflow-hidden bg-white">
        <CardHeader className="p-8 border-b border-neutral-50">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-rose-50 rounded-2xl text-rose-600">
              <ShoppingBag className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-2xl font-black text-neutral-900">4. TIPOS DE PEDIDO</CardTitle>
              <CardDescription className="text-neutral-500 text-base">Escolha os tipos de pedidos disponíveis no menu digital.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { id: 'local', label: 'Comer no local', desc: 'Cliente informa o número da mesa', icon: Utensils },
              { id: 'counter', label: 'Retirada no balcão', desc: 'Cliente retira o pedido no restaurante', icon: Store },
              { id: 'delivery', label: 'Delivery', desc: 'Entrega no endereço do cliente', icon: Truck },
            ].map(type => {
              const isActive = !!(restaurant.orderTypes && (restaurant.orderTypes as any)[type.id]);
              return (
                <div key={type.id} className={cn(
                  "p-6 rounded-[2rem] border transition-all cursor-pointer flex flex-col items-center text-center",
                  isActive 
                    ? "bg-rose-50/50 border-rose-300 shadow-sm" 
                    : "bg-neutral-50 border-neutral-100 opacity-60"
                )} onClick={() => {
                  const currentTypes = restaurant.orderTypes || {};
                  const newTypes = { 
                    ...currentTypes,
                    [type.id]: !isActive
                  };
                  setRestaurant({ ...restaurant, orderTypes: newTypes });
                }}>
                  <div className={cn(
                    "w-16 h-16 rounded-3xl flex items-center justify-center mb-4 transition-all duration-300",
                    isActive 
                      ? "bg-rose-600 text-white shadow-lg shadow-rose-200" 
                      : "bg-neutral-200 text-neutral-500"
                  )}>
                    <type.icon className="w-8 h-8" />
                  </div>
                  <div className="flex items-center gap-2 mb-2">
                    <Checkbox 
                      checked={isActive}
                      onCheckedChange={() => {
                        const currentTypes = restaurant.orderTypes || {};
                        const newTypes = { 
                          ...currentTypes,
                          [type.id]: !isActive
                        };
                        setRestaurant({ ...restaurant, orderTypes: newTypes });
                      }}
                      className="w-5 h-5 rounded-md border-neutral-300 data-[state=checked]:bg-rose-600 data-[state=checked]:border-rose-600"
                    />
                    <span className="font-black text-lg text-neutral-900 uppercase tracking-tight">{type.label}</span>
                  </div>
                  <p className="text-xs text-neutral-500 font-bold leading-relaxed max-w-[140px]">{type.desc}</p>
                </div>
              );
            })}
          </div>

          {restaurant.orderTypes?.delivery && (
            <div className="space-y-6 border-t border-neutral-100 pt-8 animate-fade-in">
              <div className="flex items-center gap-3 animate-fade-in">
                <div className="p-2.5 bg-rose-50 rounded-2xl text-rose-600">
                  <MapPin className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-neutral-900 uppercase tracking-tight">Taxas de Entrega por Localidade</h3>
                  <p className="text-sm text-neutral-400 font-semibold leading-relaxed">Cadastre as cidades ou bairros que você atende e defina o preço da entrega correspondente.</p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-12 gap-4 p-5 bg-neutral-50 rounded-[2rem] border border-neutral-150">
                <div className="md:col-span-6 space-y-2">
                  <Label className="text-xs font-black text-neutral-500 uppercase tracking-widest">Cidade / Bairro / Região de Luanda</Label>
                  <Input 
                    value={newCityName}
                    onChange={(e) => setNewCityName(e.target.value)}
                    placeholder="Ex: Talatona, Benfica, Kilamba, Maianga..."
                    className="rounded-xl h-12 border-neutral-200 bg-white"
                  />
                </div>
                <div className="md:col-span-4 space-y-2">
                  <Label className="text-xs font-black text-neutral-500 uppercase tracking-widest">Taxa de Entrega (Kz)</Label>
                  <Input 
                    type="number"
                    value={newCityFee}
                    onChange={(e) => setNewCityFee(e.target.value)}
                    placeholder="Ex: 2500"
                    className="rounded-xl h-12 border-neutral-200 bg-white font-black text-rose-600"
                  />
                </div>
                <div className="md:col-span-2 flex items-end">
                  <Button 
                    type="button"
                    onClick={() => {
                      if (!newCityName.trim()) {
                        toast.error("Por favor, digite o nome do local.");
                        return;
                      }
                      const feeVal = parseFloat(newCityFee);
                      if (isNaN(feeVal) || feeVal < 0) {
                        toast.error("Por favor, digite uma taxa de entrega válida.");
                        return;
                      }
                      const currentFees = restaurant.orderTypes?.deliveryFees || [];
                      const updatedFees = [...currentFees, { city: newCityName.trim(), fee: feeVal }];
                      setRestaurant({ 
                        ...restaurant, 
                        orderTypes: { 
                          ...restaurant.orderTypes, 
                          deliveryFees: updatedFees 
                        } 
                      });
                      setNewCityName('');
                      setNewCityFee('');
                      toast.success("Local de entrega adicionado temporariamente! Não esqueça de clicar em 'Salvar Tipos de Pedido' abaixo.");
                    }}
                    className="w-full rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white font-bold h-12 gap-1.5"
                  >
                    <Plus className="w-4 h-4" /> Adicionar
                  </Button>
                </div>
              </div>

              {/* List of Locations */}
              <div className="space-y-3">
                <Label className="text-xs font-black text-neutral-400 uppercase tracking-widest pl-1">Locais e Preços Cadastrados</Label>
                {(!restaurant.orderTypes?.deliveryFees || restaurant.orderTypes.deliveryFees.length === 0) ? (
                  <div className="text-center py-8 border border-dashed border-neutral-200 rounded-[2rem] bg-neutral-50/50">
                    <p className="text-sm text-neutral-400 font-semibold px-6">Nenhum local de entrega cadastrado ainda. Se não houver locais listados, o cliente informará o endereço manualmente sem taxas adicionais de entrega.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {restaurant.orderTypes.deliveryFees.map((feeObj, idx) => (
                      <div key={idx} className="flex justify-between items-center p-4 bg-white border border-neutral-100 rounded-2xl shadow-sm hover:border-rose-100 transition-all">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-neutral-50 rounded-xl flex items-center justify-center border border-neutral-100 shrink-0 text-rose-500">
                            <Truck className="w-5 h-5" />
                          </div>
                          <div>
                            <p className="text-base font-bold text-neutral-800 leading-tight">{feeObj.city}</p>
                            <p className="text-xs text-rose-600 font-black">Adicional: Kz {feeObj.fee.toLocaleString()}</p>
                          </div>
                        </div>
                        <Button 
                          type="button"
                          variant="ghost" 
                          size="icon"
                          onClick={() => {
                            const currentFees = restaurant.orderTypes?.deliveryFees || [];
                            const updatedFees = currentFees.filter((_, i) => i !== idx);
                            setRestaurant({ 
                              ...restaurant, 
                              orderTypes: { 
                                ...restaurant.orderTypes, 
                                deliveryFees: updatedFees 
                              } 
                            });
                            toast.success("Local removido! Lembre-se de salvar.");
                          }}
                          className="text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-xl w-9 h-9 shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          <div className="p-4 bg-neutral-50 rounded-2xl border border-neutral-100 flex gap-3 items-center">
            <Info className="w-5 h-5 text-neutral-400" />
            <p className="text-sm text-neutral-500 font-medium">O cliente verá apenas as opções ativadas no menu digital.</p>
          </div>

          <div className="flex justify-end pt-4">
            <Button 
              className="rounded-2xl bg-rose-600 hover:bg-rose-700 gap-2 px-10 h-14 text-lg font-bold shadow-lg shadow-rose-200 transition-all active:scale-95"
              onClick={() => handleSave('orderTypes')}
              disabled={isSaving === 'orderTypes'}
            >
              {isSaving === 'orderTypes' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              Salvar Tipos de Pedido
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 5. REDES SOCIAIS */}
      <Card className="rounded-[2.5rem] border-none shadow-xl shadow-neutral-200/50 overflow-hidden bg-white">
        <CardHeader className="p-8 border-b border-neutral-50">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-rose-50 rounded-2xl text-rose-600">
              <Smartphone className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-2xl font-black text-neutral-900">5. REDES SOCIAIS</CardTitle>
              <CardDescription className="text-neutral-500 text-base">Adicione os links das redes sociais do restaurante.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="space-y-3">
              <Label className="text-sm font-bold text-neutral-700 flex items-center gap-2">
                <Facebook className="w-4 h-4 text-blue-600" /> Facebook
              </Label>
              <Input 
                id="social-facebook"
                name="facebook"
                value={restaurant.socialLinks?.facebook || ''} 
                onChange={e => setRestaurant({
                  ...restaurant, 
                  socialLinks: { ...restaurant.socialLinks, facebook: e.target.value }
                })}
                className="rounded-2xl h-12 border-neutral-200" 
                placeholder="Link do perfil"
                autoComplete="off"
              />
            </div>
            <div className="space-y-3">
              <Label className="text-sm font-bold text-neutral-700 flex items-center gap-2">
                <Instagram className="w-4 h-4 text-pink-600" /> Instagram
              </Label>
              <Input 
                id="social-instagram"
                name="instagram"
                value={restaurant.socialLinks?.instagram || ''} 
                onChange={e => setRestaurant({
                  ...restaurant, 
                  socialLinks: { ...restaurant.socialLinks, instagram: e.target.value }
                })}
                className="rounded-2xl h-12 border-neutral-200" 
                placeholder="Link do perfil"
                autoComplete="off"
              />
            </div>
            <div className="space-y-3">
              <Label className="text-sm font-bold text-neutral-700 flex items-center gap-2">
                <svg className="w-4 h-4 text-neutral-900 fill-current" viewBox="0 0 24 24"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1.04-.1z"/></svg> TikTok
              </Label>
              <Input 
                id="stk_link_v2"
                name="stk_link_v2"
                type="text"
                value={restaurant.socialLinks?.tiktok || ''} 
                onChange={e => setRestaurant({
                  ...restaurant, 
                  socialLinks: { ...restaurant.socialLinks, tiktok: e.target.value }
                })}
                className="rounded-2xl h-12 border-neutral-200" 
                placeholder="Link do perfil"
                autoComplete="new-password"
              />
            </div>
          </div>

          <div className="flex justify-end pt-4">
            <Button 
              className="rounded-2xl bg-rose-600 hover:bg-rose-700 gap-2 px-10 h-14 text-lg font-bold shadow-lg shadow-rose-200 transition-all active:scale-95"
              onClick={() => handleSave('social')}
              disabled={isSaving === 'social'}
            >
              {isSaving === 'social' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              Salvar Redes Sociais
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 6. SEGURANÇA (ACESSO AO DASHBOARD) */}
      <Card className="rounded-[2.5rem] border-none shadow-xl shadow-neutral-200/50 overflow-hidden bg-white">
        <CardHeader className="p-8 border-b border-neutral-50">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-rose-50 rounded-2xl text-rose-600">
              <ShieldCheck className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-2xl font-black text-neutral-900">6. SEGURANÇA (ACESSO AO DASHBOARD)</CardTitle>
              <CardDescription className="text-neutral-500 text-base">Restrinja o acesso ao Dashboard Financeiro apenas para quem possui as credenciais.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-8 space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Campo PIN ATUAL (SÓ APARECE SE JÁ EXISTIR UM) */}
            {restaurant.managerPin && (
              <div className="space-y-3">
                <Label className="text-sm font-bold text-rose-600 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4" /> PIN Atual (Obrigatório para alterar)
                </Label>
                <div className="relative">
                  <Input 
                    id="current-pin"
                    name="current-pin"
                    type={showCurrentPin ? "text" : "password"}
                    value={currentPinInput} 
                    onChange={e => setCurrentPinInput(e.target.value.replace(/[^0-9]/g, ''))}
                    className="rounded-2xl h-12 border-rose-200 bg-rose-50/30 pl-10 pr-12 focus-visible:ring-rose-500" 
                    placeholder="Digite o PIN atual"
                    maxLength={6}
                    autoComplete="current-password"
                  />
                  <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                    <Lock className="w-4 h-4 text-rose-400" />
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowCurrentPin(!showCurrentPin)}
                    className="absolute inset-y-0 right-3 flex items-center text-neutral-400 hover:text-rose-600 transition-colors"
                  >
                    {showCurrentPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            )}

            <div className="space-y-3">
              <Label className="text-sm font-bold text-neutral-700 flex items-center gap-2">
                <Lock className="w-4 h-4 text-rose-500" /> {restaurant.managerPin ? "Novo PIN de Acesso" : "Definir PIN de Acesso"}
              </Label>
              <div className="relative">
                <Input 
                  id="new-pin"
                  name="new-pin"
                  type={showPin ? "text" : "password"}
                  value={newPin} 
                  onChange={e => {
                    const val = e.target.value.replace(/[^0-9]/g, '');
                    setNewPin(val);
                  }}
                  className="rounded-2xl h-12 border-neutral-200 pl-10 pr-12" 
                  placeholder={restaurant.managerPin ? "•••••• (PIN Já Definido)" : "Digite um novo PIN (5-6 dígitos)"}
                  maxLength={6}
                  autoComplete="new-password"
                />
                <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                  <ShieldCheck className="w-4 h-4 text-neutral-400" />
                </div>
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="absolute inset-y-0 right-3 flex items-center text-neutral-400 hover:text-rose-600 transition-colors"
                >
                  {showPin ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
              <p className="text-[10px] text-neutral-500 font-medium">
                {restaurant.managerPin 
                  ? "Para alterar o PIN, você deve primeiro confirmar o PIN atual no campo ao lado." 
                  : "Recomendado: 5 a 6 dígitos numéricos. Somente números são permitidos."}
              </p>
            </div>
          </div>

          <div className="p-4 bg-amber-50 rounded-2xl border border-amber-100 flex gap-3 items-start">
            <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <p className="text-sm text-amber-900 font-bold">Recuperação de Acesso</p>
              <p className="text-xs text-amber-700 leading-relaxed">
                Se você perder o seu PIN de Gestor, por questões de segurança absoluta, o sistema não permite a recuperação automática. 
                Neste caso, <strong>entre em contacto direto comigo (Administrador)</strong> para realizar o reset manual via banco de dados.
              </p>
            </div>
          </div>

          <div className="p-4 bg-rose-50 rounded-2xl border border-rose-100 flex gap-3 items-start">
            <Info className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
            <p className="text-sm text-rose-700 font-medium">
              O PIN protege apenas a aba "Dashboard". Áreas como Pedidos, Menu e Mesas continuam acessíveis para a equipe operacional.
            </p>
          </div>

          <div className="flex justify-end pt-4">
            <Button 
              className="rounded-2xl bg-rose-600 hover:bg-rose-700 gap-2 px-10 h-14 text-lg font-bold shadow-lg shadow-rose-200 transition-all active:scale-95"
              onClick={() => handleSave('security')}
              disabled={isSaving === 'security'}
            >
              {isSaving === 'security' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              Salvar PIN de Segurança
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 7. PERSONALIZAÇÃO VISUAL */}
      <Card className="rounded-[2.5rem] border-none shadow-xl shadow-neutral-200/50 overflow-hidden bg-white">
        <CardHeader className="p-8 border-b border-neutral-50">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-rose-50 rounded-2xl text-rose-600">
              <Palette className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-2xl font-black text-neutral-900 leading-tight">7. PERSONALIZAÇÃO VISUAL</CardTitle>
              <CardDescription className="text-neutral-500 text-base">Defina a identidade visual e o impacto da marca no menu digital.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-8 space-y-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
            <div className="space-y-8">
              {/* Seção de Cores */}
              <div className="space-y-4">
                <Label className="text-base font-black text-neutral-800 uppercase tracking-wider">Paleta de Cores</Label>
                <p className="text-sm font-bold text-neutral-500 leading-relaxed">
                  Personalize a cor principal do seu menu digital para que ele reflita perfeitamente a identidade visual da sua marca.
                </p>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="flex items-center gap-4 p-4 bg-neutral-50 rounded-2xl border border-neutral-100">
                    <Input 
                      type="color" 
                      value={restaurant.primaryColor}
                      onChange={e => setRestaurant({...restaurant, primaryColor: e.target.value})}
                      className="w-16 h-12 p-1 rounded-xl cursor-pointer border-white shadow-sm"
                    />
                    <div className="flex-1">
                      <Input 
                        value={restaurant.primaryColor}
                        onChange={e => setRestaurant({...restaurant, primaryColor: e.target.value})}
                        className="font-mono text-sm tracking-widest h-12 rounded-xl border-neutral-200 uppercase"
                        placeholder="#000000"
                      />
                    </div>
                  </div>
                </div>
                <p className="text-xs text-neutral-400 font-medium italic">Esta cor será aplicada aos elementos estruturais, botões e destaques do menu.</p>
              </div>

              {/* Seção de Banner */}
              <div className="space-y-8">
                <div className="flex flex-col gap-4">
                  <div className="flex items-center justify-between">
                    <Label className="text-base font-black text-neutral-800 uppercase tracking-wider">Modo de Exibição da Capa</Label>
                    <div className="flex bg-neutral-100 p-1 rounded-xl border border-neutral-200">
                      <button
                        onClick={() => setRestaurant(prev => prev ? ({ ...prev, bannerMode: 'single' }) : prev)}
                        className={cn(
                          "px-4 py-2 rounded-lg text-xs font-black transition-all",
                          restaurant.bannerMode !== 'carousel' ? "bg-white text-rose-600 shadow-sm" : "text-neutral-500 hover:text-neutral-700"
                        )}
                      >
                        Imagem Única
                      </button>
                      <button
                        onClick={() => setRestaurant(prev => prev ? ({ ...prev, bannerMode: 'carousel' }) : prev)}
                        className={cn(
                          "px-4 py-2 rounded-lg text-xs font-black transition-all flex items-center gap-2",
                          restaurant.bannerMode === 'carousel' ? "bg-white text-rose-600 shadow-sm" : "text-neutral-500 hover:text-neutral-700"
                        )}
                      >
                        Carrossel (Sequencial)
                        <Sparkles className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                  <p className="text-xs text-neutral-400 font-medium italic">
                    {restaurant.bannerMode === 'carousel' 
                      ? "O modo Carrossel permite exibir até 4 imagens em sequência, criando um movimento dinâmico no topo do seu menu."
                      : "O modo Imagem Única foca em um banner estático profissional."
                    }
                  </p>
                </div>

                {restaurant.bannerMode === 'carousel' ? (
                  <div className="space-y-6">
                    <div className="grid grid-cols-2 gap-4">
                      {[0, 1, 2, 3].map((index) => (
                        <div key={index} className="space-y-2">
                          <div className="relative rounded-2xl border-2 border-neutral-100 bg-neutral-50 aspect-video overflow-hidden group">
                            {restaurant.banners?.[index] ? (
                              <>
                                <img 
                                  src={restaurant.banners[index]} 
                                  className="w-full h-full object-cover" 
                                  alt={`Banner ${index + 1}`} 
                                  referrerPolicy="no-referrer" 
                                />
                                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-2">
                                  <Button 
                                    variant="secondary" 
                                    size="sm" 
                                    className="h-8 rounded-lg text-[10px] font-black"
                                    onClick={() => {
                                      setActiveCarouselIndex(index);
                                      carouselInputRef.current?.click();
                                    }}
                                  >
                                    Trocar
                                  </Button>
                                  <Button 
                                    variant="destructive" 
                                    size="sm" 
                                    className="h-8 rounded-lg text-[10px] font-black"
                                    onClick={() => {
                                      const newBanners = [...(restaurant.banners || [])];
                                      newBanners[index] = '';
                                      setRestaurant({ ...restaurant, banners: newBanners });
                                    }}
                                  >
                                    Remover
                                  </Button>
                                </div>
                              </>
                            ) : (
                              <button 
                                onClick={() => {
                                  setActiveCarouselIndex(index);
                                  carouselInputRef.current?.click();
                                }}
                                className="absolute inset-0 flex flex-col items-center justify-center gap-2 hover:bg-neutral-100 transition-colors"
                              >
                                <div className="p-2 bg-neutral-200 rounded-full">
                                  <Upload className="w-4 h-4 text-neutral-500" />
                                </div>
                                <span className="text-[10px] font-black text-neutral-400 uppercase tracking-widest leading-tight">Adicionar Imagem {index + 1}<br/><span className="text-[8px] opacity-60">1920x1080</span></span>
                              </button>
                            )}

                            {isUploading === `carousel_${index}` && (
                              <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center gap-2">
                                <Loader2 className="w-6 h-6 animate-spin text-rose-600" />
                                <span className="text-[10px] font-black text-rose-600">{uploadProgress}%</span>
                              </div>
                            )}
                          </div>
                          <Input 
                            placeholder={`Link da Imagem ${index + 1}...`}
                            value={restaurant.banners?.[index] || ''}
                            onChange={(e) => {
                              const newBanners = [...(restaurant.banners || [])];
                              // Ensure array is at least as long as needed
                              while(newBanners.length <= index) newBanners.push('');
                              newBanners[index] = e.target.value;
                              setRestaurant({ ...restaurant, banners: newBanners });
                            }}
                            className="h-9 text-xs rounded-xl border-neutral-200 bg-white"
                          />
                        </div>
                      ))}
                    </div>
                    <input 
                      type="file" 
                      ref={carouselInputRef} 
                      style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
                      accept="image/*"
                      onChange={(e) => handleFileUpload(e, 'carousel', activeCarouselIndex ?? undefined)}
                    />
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="relative rounded-[2rem] border-4 border-white shadow-2xl bg-neutral-100 aspect-video overflow-hidden">
                      <img 
                        src={restaurant.banner || undefined} 
                        className="w-full h-full object-cover" 
                        alt="Preview Banner" 
                        referrerPolicy="no-referrer" 
                      />
                      {isUploading === 'banner' && (
                        <div className="absolute inset-0 bg-white/90 backdrop-blur-sm flex flex-col items-center justify-center gap-3">
                          <Loader2 className="w-8 h-8 animate-spin text-rose-600" />
                          <div className="flex flex-col items-center">
                            <span className="text-xs font-black text-rose-600 uppercase tracking-tighter">Enviando Arquivo ({uploadProgress}%)</span>
                            <div className="w-40 h-1.5 bg-rose-100 rounded-full mt-2 overflow-hidden">
                              <div className="h-full bg-rose-600 transition-all duration-300" style={{ width: `${uploadProgress}%` }} />
                            </div>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className="space-y-4 bg-neutral-50 p-6 rounded-[2rem] border border-neutral-100">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <input 
                          type="file" 
                          ref={bannerInputRef} 
                          style={{ opacity: 0, width: 0, height: 0, position: 'absolute' }}
                          accept="image/*"
                          onChange={(e) => handleFileUpload(e, 'banner')}
                        />
                        <div className="flex flex-col gap-2">
                          <Button 
                            variant="outline" 
                            className="rounded-xl h-12 gap-2 border-neutral-200 bg-white hover:bg-rose-50 hover:text-rose-600 hover:border-rose-200 transition-all font-bold"
                            onClick={() => bannerInputRef.current?.click()}
                            disabled={!!isUploading}
                          >
                            <Upload className="w-4 h-4" /> Enviar do Dispositivo
                          </Button>
                          <div className="flex flex-col px-2">
                            <span className="text-[10px] text-neutral-500 font-black uppercase tracking-tighter">Proporção Obrigatória: 16:9</span>
                            <span className="text-[9px] text-neutral-400 font-bold">Resolução Ideal: 1920x1080px</span>
                          </div>
                        </div>
                        <div className="relative flex-1">
                          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none">
                            <Globe className="w-4 h-4 text-neutral-400" />
                          </div>
                          <Input 
                            placeholder="Ou insira o link direto (.jpg, .png)..."
                            value={restaurant.banner || ''}
                            onChange={(e) => setRestaurant({...restaurant, banner: e.target.value})}
                            className="pl-10 rounded-xl h-12 border-neutral-200 bg-white text-sm"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Central de Ajuda para Upload Estruturada */}
                <div className="pt-8 border-t border-neutral-100">
                  <div className="bg-emerald-50/40 rounded-[2.5rem] border border-emerald-100/60 p-6 md:p-8 space-y-6">
                    <div className="flex items-start gap-4">
                      <div className="bg-emerald-600 p-3 rounded-2xl shadow-lg shadow-emerald-100">
                        <Info className="w-6 h-6 text-white" />
                      </div>
                      <div className="space-y-1">
                        <h5 className="text-sm font-black text-emerald-900 uppercase tracking-tighter">Dificuldade no carregamento do computador?</h5>
                        <p className="text-[12px] font-bold text-emerald-800 leading-relaxed opacity-90">
                          Caso o processamento direto apresente instabilidade, siga nosso guia profissional para utilizar links externos:
                        </p>
                      </div>
                    </div>

                    <div className="flex flex-col gap-3">
                      <div className="bg-white p-4 md:p-6 rounded-[2rem] border border-emerald-100 shadow-sm hover:shadow-md transition-all group flex items-center gap-6">
                        <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center text-base font-black shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-colors">01</div>
                        <div className="flex-1 space-y-1">
                          <h6 className="text-xs font-black text-emerald-900 uppercase tracking-wider">Passo 01: Pesquisa Técnica</h6>
                          <p className="text-[13px] font-bold text-neutral-600 leading-relaxed">
                            Acesse o Google e pesquise por: <span className="text-emerald-700 italic underline">"EdgeOne Pages links"</span> ou <span className="text-emerald-700 italic underline">"PostImages"</span> para iniciar o processo.
                          </p>
                        </div>
                      </div>

                      <div className="bg-white p-4 md:p-6 rounded-[2rem] border border-emerald-100 shadow-sm hover:shadow-md transition-all group flex items-center gap-6">
                        <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center text-base font-black shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-colors">02</div>
                        <div className="flex-1 space-y-1">
                          <h6 className="text-xs font-black text-emerald-900 uppercase tracking-wider">Passo 02: Processamento e Upload</h6>
                          <p className="text-[13px] font-bold text-neutral-600 leading-relaxed">
                            Realize o upload da sua imagem no serviço escolhido e gere o <span className="text-emerald-700 underline">Link Direto / Public URL</span> da imagem.
                          </p>
                        </div>
                      </div>

                      <div className="bg-white p-4 md:p-6 rounded-[2rem] border border-emerald-100 shadow-sm hover:shadow-md transition-all group flex items-center gap-6">
                        <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center text-base font-black shrink-0 group-hover:bg-emerald-600 group-hover:text-white transition-colors">03</div>
                        <div className="flex-1 space-y-1">
                          <h6 className="text-xs font-black text-emerald-900 uppercase tracking-wider">Passo 03: Integração no Sistema</h6>
                          <p className="text-[13px] font-bold text-neutral-600 leading-relaxed">
                            Copie o link final e cole no campo de texto acima. Verifique se o link termina em <span className="text-emerald-600 italic">.jpg</span> ou <span className="text-emerald-600 italic">.png</span>.
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Preview do Mobile (Mockup) */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <Label className="text-base font-black text-neutral-800 uppercase tracking-wider">Simulação do Menu</Label>
                <div className="flex items-center gap-1.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-full">
                  <div className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="text-[10px] font-black uppercase">Visualização Real</span>
                </div>
              </div>
              
              <div className="relative mx-auto w-full max-w-[280px] aspect-[9/18.5] bg-neutral-900 rounded-[3rem] p-3 border-[6px] border-neutral-900 shadow-2xl">
                <div className="absolute top-0 inset-x-0 h-8 flex items-center justify-center pointer-events-none z-10">
                  <div className="w-16 h-4 bg-black rounded-b-2xl" />
                </div>
                
                <div className="bg-white h-full w-full rounded-[2rem] overflow-hidden flex flex-col">
                  {/* Banner no Preview */}
                  <div className="h-1/3 relative bg-neutral-100 shrink-0">
                    <img 
                      src={
                        (restaurant.bannerMode === 'carousel' && restaurant.banners?.[previewBannerIndex])
                          ? restaurant.banners[previewBannerIndex] 
                          : (restaurant.banner || undefined)
                      } 
                      key={previewBannerIndex}
                      className="w-full h-full object-cover transition-opacity duration-1000" 
                      alt="" 
                      referrerPolicy="no-referrer" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                    <div className="absolute bottom-4 inset-x-0 px-4 flex flex-col items-center">
                      <div className="w-12 h-12 rounded-full border-2 border-white shadow-lg overflow-hidden bg-white mb-2">
                        <img 
                          src={restaurant.logo || undefined} 
                          className="w-full h-full object-cover" 
                          alt="" 
                          referrerPolicy="no-referrer" 
                        />
                      </div>
                      <h4 className="text-white font-black text-[10px] uppercase truncate w-full text-center tracking-tight">{restaurant.name}</h4>
                    </div>
                    {restaurant.bannerMode === 'carousel' && restaurant.banners && restaurant.banners.filter(b => !!b).length > 1 && (
                      <div className="absolute top-2 right-2 flex gap-1">
                        {restaurant.banners.filter(b => !!b).map((_, i) => (
                          <div 
                            key={i} 
                            className={cn(
                              "w-1 h-1 rounded-full transition-all",
                              i === previewBannerIndex ? "bg-white w-3" : "bg-white/40"
                            )} 
                          />
                        ))}
                      </div>
                    )}
                  </div>
                  
                  {/* Conteúdo no Preview */}
                  <div className="p-4 flex-1 space-y-4">
                    <div className="h-2 w-1/2 bg-neutral-100 rounded-full" />
                    <div className="flex gap-2">
                      <div className="h-6 w-16 rounded-full border" style={{ backgroundColor: `${restaurant.primaryColor}15`, borderColor: restaurant.primaryColor }} />
                      <div className="h-6 w-16 bg-neutral-50 rounded-full" />
                    </div>
                    <div className="space-y-2">
                      {[1, 2, 3].map(i => (
                        <div key={i} className="flex gap-2 p-2 bg-neutral-50 rounded-xl">
                          <div className="w-8 h-8 rounded-lg bg-white" />
                          <div className="flex-1 space-y-1">
                            <div className="h-1.5 w-full bg-neutral-200 rounded-full" />
                            <div className="h-1.5 w-1/2 bg-rose-100 rounded-full" style={{ backgroundColor: `${restaurant.primaryColor}20` }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex justify-end pt-6 border-t border-neutral-50">
            <Button 
              className="rounded-2xl bg-rose-600 hover:bg-rose-700 gap-2 px-10 h-14 text-lg font-bold shadow-xl shadow-rose-200 transition-all active:scale-95"
              onClick={() => handleSave('visual')}
              disabled={isSaving === 'visual' || !!isUploading}
            >
              {isSaving === 'visual' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
              Salvar Identidade Visual
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 8. LINK E QR CODE DO MENU */}
      <Card className="rounded-[2.5rem] border-none shadow-xl shadow-neutral-200/50 overflow-hidden bg-white">
        <CardHeader className="p-8 border-b border-neutral-50">
          <div className="flex items-center gap-4 mb-2">
            <div className="p-3 bg-rose-50 rounded-2xl text-rose-600">
              <QrCode className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-2xl font-black text-neutral-900 uppercase">8. Link e QR Code do Menu</CardTitle>
              <CardDescription className="text-neutral-500 text-base">Compartilhe o seu cardápio digital através de um link direto ou QR Code.</CardDescription>
            </div>
          </div>
        </CardHeader>
        <CardContent className="p-8 space-y-10">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-start">
            {/* Lado Esquerdo: Link e Botões */}
            <div className="space-y-8">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-bold text-neutral-700">Link Personalizado (Slug)</Label>
                  <span className="text-[10px] font-bold text-rose-600 bg-rose-50 px-2 py-0.5 rounded-full">NOVO</span>
                </div>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Input 
                      value={restaurant.slug || ''} 
                      onChange={e => {
                        const val = e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-');
                        setRestaurant({...restaurant, slug: val});
                      }}
                      className="rounded-2xl h-14 border-neutral-200 pr-12 font-bold text-neutral-900" 
                      placeholder="viana-grill"
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2 text-[10px] font-black text-neutral-400 uppercase tracking-widest bg-neutral-50 px-2 py-1 rounded-md border border-neutral-100">
                      EDITÁVEL
                    </div>
                  </div>
                  <Button 
                    onClick={() => handleSave('slug')}
                    disabled={isSaving === 'slug'}
                    className="rounded-2xl h-14 px-6 bg-neutral-900 hover:bg-black font-bold gap-2 shadow-lg active:scale-95 transition-all"
                  >
                    {isSaving === 'slug' ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />}
                    Definir
                  </Button>
                </div>
                <p className="text-[11px] text-neutral-500 font-medium">Use letras minúsculas, números e hifens. <br/><span className="text-rose-600 font-bold">Ex: restaurante-lulu</span></p>
              </div>

              <div className="space-y-3 pt-4 border-t border-dotted border-neutral-200">
                <Label className="text-sm font-bold text-neutral-700">Link de Compartilhamento</Label>
                <div className="flex gap-2">
                  <div className="flex-1 relative">
                    <Input 
                      value={`${window.location.origin}/r/${restaurant.slug || restaurantId}`} 
                      readOnly
                      className="rounded-2xl h-14 border-neutral-200 bg-neutral-50 pr-12 font-medium text-neutral-600 text-sm" 
                    />
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                      <Globe className="w-5 h-5 text-neutral-300" />
                    </div>
                  </div>
                  <Button 
                    onClick={() => {
                      const url = `${window.location.origin}/r/${restaurant.slug || restaurantId}`;
                      navigator.clipboard.writeText(url);
                      setCopied(true);
                      toast.success('Link do cardápio copiado!');
                      setTimeout(() => setCopied(false), 2000);
                    }}
                    className={cn(
                      "rounded-2xl h-14 px-6 font-bold gap-2 transition-all shrink-0",
                      copied ? "bg-emerald-500 hover:bg-emerald-600" : "bg-rose-600 hover:bg-rose-700"
                    )}
                  >
                    {copied ? <Check className="w-5 h-5" /> : <Copy className="w-5 h-5" />}
                    {copied ? 'Copiado!' : 'Copiar'}
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <Button 
                  onClick={() => window.open(`${window.location.origin}/r/${restaurant.slug || restaurantId}`, '_blank')}
                  variant="outline"
                  className="rounded-2xl h-14 font-bold gap-2 border-neutral-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100 transition-all"
                >
                  <ExternalLink className="w-5 h-5" /> Abrir Menu
                </Button>
                <Button 
                  onClick={() => {
                    const container = document.getElementById('qr-code-container');
                    const svg = container?.querySelector('svg');
                    if (!svg) return;
                    const svgData = new XMLSerializer().serializeToString(svg);
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    const img = new Image();
                    img.onload = () => {
                      canvas.width = 1024; canvas.height = 1024;
                      if (ctx) {
                        ctx.fillStyle = 'white';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                      }
                      const url = canvas.toDataURL('image/png');
                      const link = document.createElement('a');
                      link.download = `qr-code-${restaurant?.slug || 'menu'}.png`;
                      link.href = url;
                      link.click();
                      toast.success('QR Code baixado!');
                    };
                    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
                  }}
                  variant="outline"
                  className="rounded-2xl h-14 font-bold gap-2 border-neutral-200 hover:bg-rose-50 hover:text-rose-600 hover:border-rose-100 transition-all"
                >
                  <Download className="w-5 h-5" /> Baixar QR
                </Button>
              </div>

              <div className="p-5 bg-neutral-50 rounded-2xl border border-neutral-100 flex gap-3 items-start">
                <Info className="w-5 h-5 text-neutral-400 shrink-0 mt-0.5" />
                <p className="text-xs text-neutral-500 font-medium leading-relaxed">
                  <strong>Sugestão:</strong> Imprima o QR Code e coloque-o nas mesas do seu restaurante para que os clientes possam acessar o menu instantaneamente com seus telemóveis.
                </p>
              </div>
            </div>

            {/* Lado Direito: Preview do QR Code */}
            <div className="flex flex-col items-center justify-center p-8 bg-neutral-50 rounded-[3rem] border border-neutral-100 space-y-4">
              <div className="relative group">
                <div id="qr-code-container" className="p-6 bg-white rounded-[2.5rem] shadow-xl border border-neutral-100 transition-transform hover:scale-105 duration-500">
                  <QRCodeSVG 
                    value={`${window.location.origin}/r/${restaurant.slug || restaurantId}`} 
                    size={220}
                    level="M"
                    includeMargin={true}
                  />
                </div>
              </div>
              <p className="text-[10px] font-black uppercase text-neutral-400 tracking-widest">QR Code Padrão</p>
            </div>
          </div>
        </CardContent>
      </Card>

    </div>
  );
}
