import { useState, useEffect, ChangeEvent } from 'react';
import { 
  Plus, 
  Search, 
  MoreVertical, 
  Edit2, 
  Trash2, 
  Eye, 
  EyeOff,
  Sparkles,
  LayoutGrid,
  Upload,
  Loader2,
  Info,
  Star,
  Tag
} from 'lucide-react';
import { restaurantService } from '../../lib/supabaseService';
import { MOCK_PRODUCTS, MOCK_CATEGORIES } from '../../lib/mockDb';
import { Product, Category } from '../../types';
import { Button } from '@/components/ui/button';
import { formatCurrency } from '@/lib/utils';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import { GoogleGenAI } from "@google/genai";
import { useAuth } from '../../components/AuthProvider';

import { toast } from 'sonner';

declare const process: any;

export default function AdminMenu() {
  const { user, restaurantId } = useAuth();

  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');

  // Dialog States
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [isDeleteConfirmOpen, setIsDeleteConfirmOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string, type: 'product' | 'category', name: string } | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [isUploading, setIsUploading] = useState(false);

  // Form States
  const [newProduct, setNewProduct] = useState({
    name: '',
    description: '',
    fullDescription: 'Nossa receita exclusiva utiliza apenas os melhores ingredientes locais, preparados com técnicas tradicionais para garantir o sabor autêntico que você merece.',
    price: '' as string | number,
    oldPrice: '' as string | number,
    categoryId: '',
    image: 'https://picsum.photos/seed/food/800/600',
    active: true,
    isPromotion: false,
    isFeatured: false
  });

  const [newCategory, setNewCategory] = useState({
    name: '',
    order: '' as string | number
  });

  useEffect(() => {
    if (!restaurantId) return;
    
    const unsubCats = restaurantService.subscribeCategories(restaurantId, (c) => {
      setCategories(c);
    });
    const unsubProds = restaurantService.subscribeProducts(restaurantId, (p) => {
      setProducts(p);
    });

    return () => {
      unsubCats();
      unsubProds();
    };
  }, [restaurantId]);

  const filteredProducts = products.filter(p => {
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                         p.description.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || p.categoryId === categoryFilter;
    return matchesSearch && matchesCategory;
  });

  const handleOpenEdit = (product: Product) => {
    setEditingProduct(product);
    setNewProduct({
      name: product.name,
      description: product.description,
      fullDescription: product.fullDescription || 'Nossa receita exclusiva utiliza apenas os melhores ingredientes locais, preparados com técnicas tradicionais para garantir o sabor autêntico que você merece.',
      price: product.price,
      oldPrice: product.oldPrice || '',
      categoryId: product.categoryId,
      image: product.image,
      active: product.active,
      isPromotion: !!product.isPromotion,
      isFeatured: !!product.isFeatured
    });
    setIsProductDialogOpen(true);
  };

  const handleOpenEditCategory = (category: Category) => {
    setEditingCategory(category);
    setNewCategory({
      name: category.name,
      order: category.order
    });
    setIsCategoryDialogOpen(true);
  };

  const handleSaveCategory = async () => {
    if (!restaurantId) return;
    if (!newCategory.name) {
      toast.error('Informe o nome da categoria');
      return;
    }

    setIsSaving(true);
    const previousCategories = [...categories];
    
    try {
      const categoryData = {
        name: newCategory.name,
        order: Number(newCategory.order) || 0,
        image: null
      };

      if (editingCategory) {
        // Atualização Otimista
        setCategories(prev => prev.map(c => 
          c.id === editingCategory.id ? { ...c, ...categoryData } : c
        ));
        
        await restaurantService.updateCategory(restaurantId, editingCategory.id, categoryData);
        toast.success('Categoria atualizada!');
      } else {
        // Adição Otimista com ID temporário
        const tempId = `temp-${Date.now()}`;
        const tempCategory = { id: tempId, ...categoryData } as Category;
        setCategories(prev => [...prev, tempCategory]);
        
        await restaurantService.addCategory(restaurantId, {
          ...categoryData,
          order: newCategory.order ?? categories.length
        });
        toast.success('Categoria adicionada!');
      }

      // Limpar formulário e fechar
      setNewCategory({ name: '', order: 0 });
      setEditingCategory(null);
      setIsCategoryDialogOpen(false);
    } catch (error: any) {
      console.error('Erro ao salvar categoria:', error);
      setCategories(previousCategories);
      toast.error(`Erro ao salvar categoria: ${error.message || 'Verifique sua conexão'}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleGenerateDescription = async (productName: string) => {
    setIsGenerating(true);
    try {
      const apiKey = typeof process !== 'undefined' ? process.env.GEMINI_API_KEY : '';
      if (!apiKey) {
        throw new Error('Chave de API Gemini não configurada');
      }
      const ai = new GoogleGenAI(apiKey);
      const prompt = `Crie uma descrição apetitosa e curta (máximo 150 caracteres) para um prato chamado "${productName}" em um restaurante premium. Retorne apenas o texto da descrição.`;
      
      const response = await ai.models.generateContent({
        model: "gemini-1.5-flash",
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
      });
      
      const description = response.text?.trim() || '';
      
      setNewProduct(prev => ({ ...prev, description }));
      toast.success('Descrição gerada!');
    } catch (error) {
      console.error('AI Error:', error);
      toast.error('Erro ao gerar descrição com IA');
    } finally {
      setIsGenerating(false);
    }
  };

  const handleSaveProduct = async () => {
    if (!restaurantId) return;
    if (!newProduct.name || newProduct.price === '' || !newProduct.categoryId) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    const productToSave = {
      ...newProduct,
      price: Number(newProduct.price),
      oldPrice: newProduct.oldPrice ? Number(newProduct.oldPrice) : 0
    };

    setIsSaving(true);
    const previousProducts = [...products];
    
    try {
      if (editingProduct) {
        // Atualização Otimista
        setProducts(prev => prev.map(p => 
          p.id === editingProduct.id ? { ...p, ...productToSave } : p
        ));
        
        await restaurantService.updateProduct(restaurantId, editingProduct.id, productToSave);
        toast.success('Produto atualizado!');
      } else {
        // Adição Otimista com ID temporário
        const tempId = `temp-${Date.now()}`;
        const tempProduct = { id: tempId, ...productToSave } as Product;
        setProducts(prev => [...prev, tempProduct]);
        
        await restaurantService.addProduct(restaurantId, productToSave);
        toast.success('Produto adicionado!');
      }
      
      // Fechar e limpar
      setIsProductDialogOpen(false);
      setNewProduct({
        name: '',
        description: '',
        fullDescription: 'Nossa receita exclusiva utiliza apenas os melhores ingredientes locais, preparados com técnicas tradicionais para garantir o sabor autêntico que você merece.',
        price: '',
        oldPrice: '',
        categoryId: '',
        image: 'https://picsum.photos/seed/food/800/600',
        active: true,
        isPromotion: false,
        isFeatured: false
      });
      setEditingProduct(null);
    } catch (error: any) {
      console.error('Erro ao salvar produto:', error);
      setProducts(previousProducts);
      toast.error(`Erro ao salvar: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    const product = products.find(p => p.id === id);
    if (!product) return;
    setDeleteTarget({ id, type: 'product', name: product.name });
    setIsDeleteConfirmOpen(true);
  };

  const handleDeleteCategory = (category: Category) => {
    setDeleteTarget({ id: category.id, type: 'category', name: category.name });
    setIsDeleteConfirmOpen(true);
  };

  const confirmDelete = async () => {
    if (!restaurantId || !deleteTarget) return;
    
    setIsDeleting(true);
    const previousProducts = [...products];
    const previousCategories = [...categories];
    
    try {
      const { id, type } = deleteTarget;
      
      if (type === 'product') {
        // Remoção Otimista
        setProducts(prev => prev.filter(p => p.id !== id));
        await restaurantService.deleteProduct(restaurantId, id);
        toast.success('Produto excluído com sucesso');
      } else {
        // Remoção Otimista
        setCategories(prev => prev.filter(c => c.id !== id));
        setProducts(prev => prev.filter(p => p.categoryId !== id));
        await restaurantService.deleteCategory(restaurantId, id);
        toast.success('Categoria excluída com sucesso');
      }
      setIsDeleteConfirmOpen(false);
    } catch (error: any) {
      console.error('Erro ao excluir:', error);
      setProducts(previousProducts);
      setCategories(previousCategories);
      toast.error(`Erro: ${error.message || 'Erro ao processar exclusão'}`);
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  };

  const handleToggleActive = async (product: Product) => {
    const previousProducts = [...products];
    try {
      const newActive = !product.active;
      // Atualização Otimista
      setProducts(prev => prev.map(p => 
        p.id === product.id ? { ...p, active: newActive } : p
      ));
      
      await restaurantService.updateProduct(restaurantId, product.id, { active: newActive });
      toast.success(`Produto ${newActive ? 'ativado' : 'desativado'}`);
    } catch (error: any) {
      console.error('Erro ao atualizar status:', error);
      setProducts(previousProducts);
      toast.error(`Erro ao atualizar status: ${error.message || ''}`);
    }
  };

  const handleFileUpload = async (event: ChangeEvent<HTMLInputElement>, type: 'product' | 'category') => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Check file type
    if (!file.type.startsWith('image/')) {
      toast.error('Por favor, selecione uma imagem válida (JPG, PNG, WEBP)');
      return;
    }

    // Check size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('A imagem deve ter no máximo 5MB');
      return;
    }

    setIsUploading(true);
    try {
      const fileName = `${Date.now()}-${file.name.replace(/[^a-zA-Z0-9.-]/g, '_')}`;
      const bucket = 'restaurant-images';
      const path = type === 'product' ? `products/${fileName}` : `categories/${fileName}`;
      
      const publicUrl = await restaurantService.uploadFile(bucket, path, file);
      
      if (type === 'product') {
        setNewProduct(prev => ({ ...prev, image: publicUrl }));
      } else {
        setNewCategory(prev => ({ ...prev, image: publicUrl }));
      }
      
      toast.success('Imagem carregada com sucesso!');
    } catch (error: any) {
      console.error('Upload error:', error);
      toast.error('Erro ao subir imagem. Verifique se o bucket "restaurant-images" existe publicamente.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-neutral-900">Menu</h1>
          <p className="text-neutral-500">Gerencie seus produtos e categorias.</p>
        </div>
        <div className="flex gap-3">
          <Dialog 
            open={isCategoryDialogOpen} 
            onOpenChange={(open) => {
              setIsCategoryDialogOpen(open);
              if (!open) {
                setEditingCategory(null);
                setNewCategory({ name: '', order: 0 });
              }
            }}
          >
            <DialogTrigger render={
              <Button variant="outline" className="rounded-xl gap-2 font-bold hover:bg-rose-50 hover:text-rose-600 transition-all">
                Nova Categoria
              </Button>
            } />
            <DialogContent className="sm:max-w-[400px] w-[95vw] max-h-[90vh] overflow-hidden flex flex-col rounded-[2rem] p-0">
              <div className="p-6 border-b border-neutral-100">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-bold">
                    {editingCategory ? 'Editar Categoria' : 'Nova Categoria'}
                  </DialogTitle>
                </DialogHeader>
              </div>
              <div className="flex-1 overflow-y-auto p-6 space-y-4">
                <div className="grid gap-2">
                  <Label htmlFor="catName">Nome da Categoria</Label>
                  <Input 
                    id="catName" 
                    placeholder="Ex: Entradas, Sobremesas..." 
                    className="rounded-xl h-11" 
                    value={newCategory.name}
                    onChange={e => setNewCategory({...newCategory, name: e.target.value})}
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="catOrder">Ordem de Exibição</Label>
                  <Input 
                    id="catOrder" 
                    type="number"
                    placeholder="Ex: 0, 1, 2..." 
                    className="rounded-xl h-11" 
                    value={newCategory.order}
                    onChange={e => setNewCategory({...newCategory, order: e.target.value})}
                  />
                </div>
                <div className="bg-rose-50 p-4 rounded-2xl border border-rose-100 space-y-2">
                  <div className="flex items-center gap-2 text-rose-600">
                    <Info className="w-4 h-4" />
                    <span className="text-[10px] font-bold uppercase tracking-wider">Dicas</span>
                  </div>
                  <p className="text-[11px] text-rose-700/80 leading-tight">
                    Use nomes curtos. A ordem define a sequência da esquerda para a direita no menu do cliente.
                  </p>
                </div>
              </div>
              <div className="p-6 border-t border-neutral-100 bg-neutral-50/50">
                <Button 
                  className="w-full rounded-xl bg-rose-600 hover:bg-rose-700 h-12 text-lg font-bold shadow-lg shadow-rose-200"
                  onClick={handleSaveCategory}
                  disabled={isSaving}
                >
                  {isSaving ? 'Salvando...' : editingCategory ? 'Atualizar' : 'Salvar'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>

          <Dialog open={isProductDialogOpen} onOpenChange={setIsProductDialogOpen}>
            <DialogTrigger render={
              <Button className="rounded-xl bg-rose-600 hover:bg-rose-700 gap-2 font-bold shadow-lg shadow-rose-200 transition-all active:scale-95">
                <Plus className="w-4 h-4" /> Novo Produto
              </Button>
            } />
            <DialogContent className="sm:max-w-[500px] w-[95vw] max-h-[90vh] overflow-hidden flex flex-col rounded-[2rem] p-0">
              <div className="p-6 border-b border-neutral-100">
                <DialogHeader>
                  <DialogTitle className="text-2xl font-bold">
                    {editingProduct ? 'Editar Produto' : 'Novo Produto'}
                  </DialogTitle>
                </DialogHeader>
              </div>
              
              <div className="flex-1 overflow-y-auto p-6 space-y-5">
                <div className="grid gap-2">
                  <Label htmlFor="name">Nome do Produto</Label>
                  <Input 
                    id="name" 
                    placeholder="Ex: Risoto de Camarão" 
                    className="rounded-xl h-11" 
                    value={newProduct.name}
                    onChange={e => setNewProduct({...newProduct, name: e.target.value})}
                  />
                </div>
                
                <div className="grid gap-2">
                  <div className="flex justify-between items-center">
                    <Label htmlFor="desc">Descrição Curta</Label>
                    <Button 
                      variant="ghost" 
                      size="sm" 
                      className="text-rose-600 hover:text-rose-700 gap-1 h-7 px-2 text-xs"
                      onClick={() => handleGenerateDescription(newProduct.name)}
                      disabled={isGenerating || !newProduct.name}
                    >
                      <Sparkles className="w-3 h-3" /> 
                      {isGenerating ? 'Gerando...' : 'IA'}
                    </Button>
                  </div>
                  <Input 
                    id="desc" 
                    placeholder="Ex: Risoto cremoso com camarões" 
                    className="rounded-xl h-11"
                    value={newProduct.description}
                    onChange={e => setNewProduct({...newProduct, description: e.target.value})}
                  />
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="fullDesc">Descrição Detalhada (Opcional)</Label>
                  <textarea 
                    id="fullDesc" 
                    className="flex min-h-[80px] w-full rounded-xl border border-neutral-200 bg-transparent px-3 py-2 text-sm shadow-sm placeholder:text-neutral-500 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-600"
                    placeholder="Dê mais detalhes sobre o prato..."
                    value={newProduct.fullDescription}
                    onChange={e => setNewProduct({...newProduct, fullDescription: e.target.value})}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="grid gap-2">
                    <Label htmlFor="price">Preço Atual (KZ)</Label>
                    <Input 
                      id="price" 
                      type="number" 
                      className="rounded-xl h-11" 
                      value={newProduct.price}
                      onChange={e => setNewProduct({...newProduct, price: e.target.value})}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="oldPrice">Preço Anterior (Opcional)</Label>
                    <Input 
                      id="oldPrice" 
                      type="number" 
                      placeholder="Ex: 5000"
                      className="rounded-xl h-11" 
                      value={newProduct.oldPrice}
                      onChange={e => setNewProduct({...newProduct, oldPrice: e.target.value})}
                    />
                  </div>
                </div>

                <div className="bg-neutral-50 p-4 rounded-2xl border border-neutral-100 space-y-4">
                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base font-bold flex items-center gap-2">
                        <Tag className="w-4 h-4 text-rose-600" />
                        Produto em Promoção
                      </Label>
                      <p className="text-xs text-neutral-500">Exibe uma etiqueta de oferta no menu.</p>
                    </div>
                    <Switch 
                      checked={newProduct.isPromotion}
                      onCheckedChange={(checked) => setNewProduct({...newProduct, isPromotion: checked})}
                    />
                  </div>

                  <div className="flex items-center justify-between">
                    <div className="space-y-0.5">
                      <Label className="text-base font-bold flex items-center gap-2">
                        <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                        Prato em Destaque
                      </Label>
                      <p className="text-xs text-neutral-500">Aparece no topo do cardápio para o cliente.</p>
                    </div>
                    <Switch 
                      checked={newProduct.isFeatured}
                      onCheckedChange={(checked) => setNewProduct({...newProduct, isFeatured: checked})}
                    />
                  </div>
                </div>

                <div className="grid gap-2">
                  <Label htmlFor="cat">Categoria</Label>
                    <select 
                      id="cat" 
                      className="flex h-11 w-full rounded-xl border border-neutral-200 bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-rose-600"
                      value={newProduct.categoryId}
                      onChange={e => setNewProduct({...newProduct, categoryId: e.target.value})}
                    >
                      <option value="">Selecionar...</option>
                      {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                    </select>
                  </div>

                <div className="grid gap-2">
                  <Label>Imagem</Label>
                  <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
                    <div className="relative w-full sm:w-24 h-24 rounded-2xl overflow-hidden border border-neutral-100 flex-shrink-0 bg-neutral-50">
                      {newProduct.image ? (
                        <img src={newProduct.image} alt="Preview" className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-neutral-300">
                          <Plus className="w-6 h-6" />
                        </div>
                      )}
                      {isUploading && (
                        <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
                          <Loader2 className="w-5 h-5 text-white animate-spin" />
                        </div>
                      )}
                    </div>
                    <div className="flex-1 w-full space-y-2">
                      <div className="flex gap-2">
                        <Input 
                          placeholder="Link da imagem..." 
                          className="rounded-xl flex-1 h-11"
                          value={newProduct.image}
                          onChange={e => setNewProduct({...newProduct, image: e.target.value})}
                        />
                        <div className="relative">
                          <Input 
                            type="file" 
                            className="absolute inset-0 opacity-0 cursor-pointer w-full h-full"
                            onChange={(e) => handleFileUpload(e, 'product')}
                            accept="image/*"
                          />
                          <Button variant="outline" size="icon" className="rounded-xl h-11 w-11">
                            <Upload className="w-4 h-4" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
              
              <div className="p-6 border-t border-neutral-100 bg-neutral-50/50">
                <Button 
                  className="w-full rounded-xl bg-rose-600 hover:bg-rose-700 h-12 text-lg font-bold shadow-lg shadow-rose-200"
                  onClick={handleSaveProduct}
                  disabled={isSaving}
                >
                  {isSaving ? 'Salvando...' : editingProduct ? 'Atualizar Produto' : 'Salvar Produto'}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {/* Categories Management */}
      <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-neutral-100">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
          <div className="flex items-center gap-2">
            <LayoutGrid className="w-5 h-5 text-rose-600" />
            <h2 className="text-xl font-bold text-neutral-900">Categorias</h2>
          </div>
          <div className="px-3 py-1.5 bg-neutral-50 rounded-lg flex items-center gap-2 border border-neutral-100">
            <div className="w-2 h-2 rounded-full bg-rose-500 animate-pulse" />
            <span className="text-[11px] text-neutral-500 font-medium">A categoria <strong>"Tudo"</strong> é gerada automaticamente ao final do Menu do Cliente.</span>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {categories.sort((a, b) => (a.order || 0) - (b.order || 0)).map((cat) => (
            <div key={cat.id} className="relative group p-4 border border-neutral-100 rounded-2xl flex items-center justify-between hover:bg-neutral-50 transition-colors">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold">
                  {cat.order || 0}
                </div>
                <p className="font-bold text-neutral-900">{cat.name}</p>
              </div>
              <div className="flex gap-1">
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="w-8 h-8 rounded-lg"
                    onClick={() => handleOpenEditCategory(cat)}
                  >
                    <Edit2 className="w-4 h-4 text-neutral-500" />
                  </Button>
                  <Button 
                    size="icon" 
                    variant="ghost" 
                    className="w-8 h-8 rounded-lg"
                    onClick={() => handleDeleteCategory(cat)}
                  >
                    <Trash2 className="w-4 h-4 text-rose-500" />
                  </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-4 items-center bg-white p-4 rounded-2xl shadow-sm">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-neutral-400" />
          <Input 
            placeholder="Buscar produto..." 
            className="pl-10 rounded-xl border-none bg-neutral-50 focus-visible:ring-rose-600" 
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </div>
        <select 
          className="bg-neutral-50 border-none rounded-xl px-4 py-2 text-sm font-medium focus:ring-rose-600"
          value={categoryFilter}
          onChange={e => setCategoryFilter(e.target.value)}
        >
          <option value="all">Todas as Categorias</option>
          {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      {/* Products List */}
      <div className="bg-white rounded-3xl shadow-sm overflow-hidden border border-neutral-100">
        <div className="overflow-x-auto">
          <table className="w-full text-left min-w-[800px] md:min-w-0">
            <thead className="bg-neutral-50 border-b border-neutral-100">
              <tr>
                <th className="px-6 py-4 text-sm font-bold text-neutral-500">Produto</th>
                <th className="px-6 py-4 text-sm font-bold text-neutral-500">Categoria</th>
                <th className="px-6 py-4 text-sm font-bold text-neutral-500">Preço</th>
                <th className="px-6 py-4 text-sm font-bold text-neutral-500">Status</th>
                <th className="px-6 py-4 text-sm font-bold text-neutral-500 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {filteredProducts.map((product) => (
                <tr key={product.id} className="hover:bg-neutral-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-4">
                      <img 
                        src={product.image || undefined} 
                        alt="" 
                        className="w-12 h-12 rounded-xl object-cover"
                        referrerPolicy="no-referrer"
                      />
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-neutral-900">{product.name}</p>
                          {product.isFeatured && (
                            <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                          )}
                          {product.isPromotion && (
                            <Badge variant="outline" className="h-5 px-1.5 py-0 text-[10px] bg-rose-50 text-rose-600 border-rose-100 rounded-lg">
                              PROMO
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-neutral-500 line-clamp-1">{product.description}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <Badge variant="secondary" className="rounded-lg font-medium">
                      {categories.find(c => c.id === product.categoryId)?.name}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 font-bold text-neutral-900">
                    {formatCurrency(product.price)}
                  </td>
                  <td className="px-6 py-4">
                    <Badge className={product.active ? "bg-emerald-100 text-emerald-600 hover:bg-emerald-100" : "bg-neutral-100 text-neutral-500 hover:bg-neutral-100"}>
                      {product.active ? 'Ativo' : 'Inativo'}
                    </Badge>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {/* Desktop Menu */}
                    <div className="hidden md:block">
                      <DropdownMenu>
                        <DropdownMenuTrigger render={
                          <Button variant="ghost" size="icon" className="rounded-xl">
                            <MoreVertical className="w-5 h-5" />
                          </Button>
                        } />
                        <DropdownMenuContent align="end" className="rounded-xl">
                          <DropdownMenuItem 
                            className="gap-2"
                            onClick={() => handleOpenEdit(product)}
                          >
                            <Edit2 className="w-4 h-4" /> Editar
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="gap-2"
                            onClick={() => handleToggleActive(product)}
                          >
                            {product.active ? <><EyeOff className="w-4 h-4" /> Desativar</> : <><Eye className="w-4 h-4" /> Ativar</>}
                          </DropdownMenuItem>
                          <DropdownMenuItem 
                            className="gap-2 text-rose-600 focus:text-rose-600"
                            onClick={() => handleDeleteProduct(product.id)}
                          >
                            <Trash2 className="w-4 h-4" /> Excluir
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {/* Mobile Direct Actions */}
                    <div className="flex md:hidden gap-1.5 justify-end">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="w-8 h-8 rounded-lg"
                        onClick={() => handleOpenEdit(product)}
                      >
                        <Edit2 className="w-4 h-4 text-neutral-500" />
                      </Button>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="w-8 h-8 rounded-lg"
                        onClick={() => handleDeleteProduct(product.id)}
                      >
                        <Trash2 className="w-4 h-4 text-rose-500" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {/* Confirm Delete Dialog */}
      <Dialog open={isDeleteConfirmOpen} onOpenChange={setIsDeleteConfirmOpen}>
        <DialogContent className="sm:max-w-[400px] rounded-3xl">
          <DialogHeader>
            <DialogTitle className="text-xl font-bold flex items-center gap-2 text-rose-600">
              <Trash2 className="w-5 h-5" /> Confirmar Exclusão
            </DialogTitle>
          </DialogHeader>
          <div className="py-4">
            <p className="text-neutral-600">
              Tem certeza que deseja excluir <strong>{deleteTarget?.name}</strong>? 
              {deleteTarget?.type === 'category' && " Todos os produtos desta categoria também serão removidos!"}
            </p>
            <p className="text-xs text-neutral-400 mt-2 italic">Esta ação não pode ser desfeita.</p>
          </div>
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              className="flex-1 rounded-xl"
              onClick={() => setIsDeleteConfirmOpen(false)}
              disabled={isDeleting}
            >
              Cancelar
            </Button>
            <Button 
              variant="destructive" 
              className="flex-1 rounded-xl gap-2"
              onClick={confirmDelete}
              disabled={isDeleting}
            >
              {isDeleting ? <><Loader2 className="w-4 h-4 animate-spin" /> Excluindo...</> : 'Excluir Agora'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
