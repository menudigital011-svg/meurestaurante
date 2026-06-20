/// <reference types="vite/client" />
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let rawUrl = (import.meta.env.VITE_SUPABASE_URL || 'https://placeholder-url.supabase.co').trim();
// Sanitização completa: remove barras finais e o sufixo /rest/v1 adicionado de forma incorreta por vezes
rawUrl = rawUrl.replace(/\/$/, '').replace(/\/rest\/v1\/?$/, '').trim();

const rawKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key').trim();

export const supabase: SupabaseClient = createClient(rawUrl, rawKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
    // Ignora o Web Locks API do navegador (conflito comum em iframes, sandboxes e abas concorrentes)
    // para prevenir o erro "was released because another request stole it".
    lock: async <R>(name: string, acquireTimeout: number, fn: () => Promise<R>): Promise<R> => {
      return await fn();
    }
  }
});

// Variáveis reativas de saúde do Supabase em cache na memória para evitar múltiplos checks lentos
export let isSupabaseHealthy = false;
export let isSupabaseChecked = false;

export function isSupabaseConfigured(): boolean {
  const urlEnv = import.meta.env.VITE_SUPABASE_URL;
  const keyEnv = import.meta.env.VITE_SUPABASE_ANON_KEY;
  if (!urlEnv || !keyEnv) return false;
  
  const cleanedUrl = urlEnv.trim();
  const cleanedKey = keyEnv.trim();
  
  const isUrlValid = cleanedUrl !== '' && 
                     cleanedUrl !== 'https://placeholder-url.supabase.co' && 
                     cleanedUrl !== 'placeholder' &&
                     !cleanedUrl.includes('nome-do-seu-projeto') &&
                     cleanedUrl.startsWith('https://');
                     
  const isKeyValid = cleanedKey !== '' && 
                     cleanedKey !== 'placeholder-key' && 
                     cleanedKey !== 'placeholder';
                     
  return isUrlValid && isKeyValid;
}

export async function checkSupabaseHealth(): Promise<boolean> {
  if (isSupabaseChecked) {
    return isSupabaseHealthy;
  }

  if (!isSupabaseConfigured()) {
    isSupabaseHealthy = false;
    isSupabaseChecked = true;
    return false;
  }

  try {
    const timeoutPromise = new Promise<{ data: any; error: any }>((_, reject) => {
      setTimeout(() => reject(new Error('TIMEOUT')), 2500); // 2.5s de timeout para maior velocidade
    });

    // Tenta uma consulta simples para validar o estado das tabelas no banco de dados ativo
    const queryPromise = supabase.from('restaurants').select('id').limit(1);
    
    // Executa o que responder mais rápido
    await Promise.race([queryPromise, timeoutPromise]);
    
    isSupabaseHealthy = true;
    isSupabaseChecked = true;
    console.log('✅ [Supabase Status] Conexão bem-sucedida e tabelas encontradas.');
    return true;
  } catch (error: any) {
    console.warn('⚠️ [Supabase Status] Falha ou lentidão severa detetada. O sistema entrará em Modo de Segurança com Banco de Dados Local (Vantagem de velocidade).', error);
    isSupabaseHealthy = false;
    isSupabaseChecked = true;
    return false;
  }
}

export function getSupabase(): SupabaseClient {
  return supabase;
}
