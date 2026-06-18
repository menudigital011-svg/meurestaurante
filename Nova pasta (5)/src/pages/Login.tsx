import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Button } from '../components/ui/button';
import { Input } from '../components/ui/input';
import { Label } from '../components/ui/label';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '../components/ui/card';
import { LogIn, Loader2, Store, AlertTriangle } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'motion/react';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [isConfigured] = useState(isSupabaseConfigured());
  const navigate = useNavigate();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isConfigured) {
      toast.error('Erro de Configuração: As variáveis de ambiente do Supabase não foram encontradas no Vercel!');
      return;
    }

    setLoading(true);

    try {
      // Limpeza preventiva de chaves obsoletas do Supabase antes do login
      try {
        for (let i = localStorage.length - 1; i >= 0; i--) {
          const key = localStorage.key(i);
          if (key && (key.startsWith('sb-') || key.includes('supabase.auth.token'))) {
            localStorage.removeItem(key);
          }
        }
      } catch {}

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });
      if (error) throw error;
      toast.success('Login realizado com sucesso!');
      navigate('/admin');
    } catch (error: any) {
      if (error?.message === 'Failed to fetch' || error?.message?.includes('fetch')) {
        toast.error('Erro de Rede (Failed to Fetch): O seu domínio não consegue conectar ao banco de dados do Supabase. Verifique se as variáveis de ambiente estão corretas no Vercel!');
      } else {
        toast.error(error.message || 'Erro ao entrar. Verifique suas credenciais.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-neutral-50 flex items-center justify-center p-6 bg-[url('https://images.unsplash.com/photo-1517248135467-4c7ed9d42c77?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center">
      <div className="absolute inset-0 bg-neutral-900/60 backdrop-blur-sm" />
      
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md relative z-10"
      >
        <Card className="rounded-[2.5rem] border-none shadow-2xl overflow-hidden">
          <div className="bg-rose-600 p-8 flex justify-center">
            <div className="bg-white/20 p-4 rounded-[2rem] backdrop-blur-md">
              <Store className="w-12 h-12 text-white" />
            </div>
          </div>
          
          <CardHeader className="pt-8 text-center">
            <CardTitle className="text-3xl font-black">
              Painel do Restaurante
            </CardTitle>
            <CardDescription className="text-neutral-500">
              Gerencie seu cardápio, mesas e pedidos
            </CardDescription>
          </CardHeader>
          
          <CardContent className="p-8 pt-0">
            {!isConfigured && (
              <div className="mb-6 p-4 bg-amber-50 border border-amber-200 rounded-3xl text-amber-800 text-sm flex gap-3 animate-pulse">
                <AlertTriangle className="w-5 h-5 shrink-0 text-amber-600 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold">Supabase não Configurado!</p>
                  <p className="text-neutral-600 leading-relaxed text-xs">
                    Para que o login funcione no seu domínio do Vercel, adicione as seguintes <strong>Variáveis de Ambiente (Environment Variables)</strong> no painel de configurações do seu projeto na Vercel:
                  </p>
                  <ul className="list-disc list-inside text-xs text-neutral-500 font-mono pt-1 space-y-0.5">
                    <li>VITE_SUPABASE_URL</li>
                    <li>VITE_SUPABASE_ANON_KEY</li>
                  </ul>
                  <p className="text-neutral-600 text-xs pt-1">
                    Lembre-se de fazer um novo <strong>Redeploy</strong> na Vercel após adicionar as variáveis.
                  </p>
                </div>
              </div>
            )}
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="email">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="seu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="rounded-2xl h-12 border-neutral-200 focus:ring-rose-500 focus:border-rose-500"
                  required
                />
              </div>
              
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="password">Senha</Label>
                </div>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="rounded-2xl h-12 border-neutral-200 focus:ring-rose-500 focus:border-rose-500"
                  required
                />
              </div>

              <Button
                type="submit"
                disabled={loading}
                className="w-full h-14 rounded-2xl bg-rose-600 hover:bg-rose-700 text-lg font-bold shadow-xl shadow-rose-200 transition-all active:scale-[0.98]"
              >
                {loading ? (
                  <Loader2 className="w-6 h-6 animate-spin" />
                ) : (
                  <>
                    <LogIn className="w-5 h-5 mr-2" />
                    Entrar
                  </>
                )}
              </Button>
            </form>
            
            <div className="mt-8 pt-8 border-t border-neutral-100 text-center">
              <p className="text-sm text-neutral-400">
                Ainda não tem acesso?
              </p>
              <p className="mt-1 text-sm font-semibold text-neutral-900">
                Entre em contato com o administrador para criar sua conta.
              </p>
              <p className="mt-2 text-sm font-bold text-rose-600">
                941 030 642 / 951 660 416
              </p>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
