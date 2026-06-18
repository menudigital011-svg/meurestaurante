/// <reference types="vite/client" />
import { createClient, SupabaseClient } from '@supabase/supabase-js';

let rawUrl = (import.meta.env.VITE_SUPABASE_URL || 'https://placeholder-url.supabase.co').trim();
// Sanitização completa: remove barras finais e o sufixo /rest/v1 adicionado de forma incorreta por vezes
rawUrl = rawUrl.replace(/\/$/, '').replace(/\/rest\/v1\/?$/, '').trim();

const rawKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || 'placeholder-key').trim();

export const supabase: SupabaseClient = createClient(rawUrl, rawKey);

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

export function getSupabase(): SupabaseClient {
  return supabase;
}
