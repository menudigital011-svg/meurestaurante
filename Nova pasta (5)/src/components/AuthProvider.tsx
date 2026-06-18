import React, { createContext, useContext, useEffect, useState } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  session: Session | null;
  restaurantId: string | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [restaurantId, setRestaurantId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const resolveRestaurantId = async (userId: string) => {
    try {
      // 1. Verificar se existe algum restaurante de propriedade deste usuário ou se o próprio ID do restaurante coincide com o ID do usuário
      const { data: restaurants, error } = await supabase
        .from('restaurants')
        .select('id, owner_uid')
        .or(`id.eq.${userId},owner_uid.eq.${userId}`);

      if (error) {
        console.error('Erro ao buscar restaurante no roteamento dinâmico:', error);
        setRestaurantId(userId);
        return;
      }

      if (restaurants && restaurants.length > 0) {
        const byOwner = restaurants.find(r => r.owner_uid === userId);
        const byId = restaurants.find(r => r.id === userId);
        setRestaurantId(byOwner ? byOwner.id : (byId ? byId.id : userId));
      } else {
        // 2. Se nenhum restaurante correspondente for encontrado, verifique se ele é o administrador da conta "default" legada
        // Se a conta 'default' legada não tiver owner_uid atribuído ou correspondente
        const { data: defaultRes } = await supabase
          .from('restaurants')
          .select('id, owner_uid')
          .eq('id', 'default')
          .maybeSingle();

        if (defaultRes && (!defaultRes.owner_uid || defaultRes.owner_uid === userId)) {
          // É o usuário administrador antigo do restaurante default! Mantém 'default' como ID para não perder as categorias/produtos
          setRestaurantId('default');
          // Atualiza o owner_uid preventivamente no banco para associar em definitivo
          await supabase
            .from('restaurants')
            .update({ owner_uid: userId })
            .eq('id', 'default');
        } else {
          // É uma conta nova totalmente independente
          setRestaurantId(userId);
        }
      }
    } catch (err) {
      console.error('Erro geral ao mapear ID do restaurante:', err);
      setRestaurantId(userId); // Fallback para ID do usuário
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) {
          console.warn('Erro ao inicializar sessão:', error.message);
          
          // Tratamento para "Refresh Token Not Found" ou erro de token inválido
          const isRefreshTokenError = 
            error.message?.toLowerCase().includes('refresh token') || 
            error.message?.toLowerCase().includes('refresh_token') ||
            error.message?.toLowerCase().includes('invalid_grant') ||
            error.message?.toLowerCase().includes('not found');
          
          if (isRefreshTokenError) {
            console.warn('Limpando tokens expirados do localStorage...');
            try {
              for (let i = localStorage.length - 1; i >= 0; i--) {
                const key = localStorage.key(i);
                if (key && (key.startsWith('sb-') || key.includes('supabase.auth.token'))) {
                  localStorage.removeItem(key);
                }
              }
            } catch {}
            await supabase.auth.signOut().catch(() => {});
          }
          setSession(null);
          setUser(null);
          setRestaurantId(null);
        } else {
          const currentSession = data?.session ?? null;
          setSession(currentSession);
          
          const currentUser = currentSession?.user ?? null;
          setUser(currentUser);
          
          if (currentUser) {
            await resolveRestaurantId(currentUser.id);
          } else {
            setRestaurantId(null);
          }
        }
      } catch (error: any) {
        console.error('Erro geral ao inicializar Auth:', error);
        const errorMsg = error?.message || '';
        if (errorMsg.toLowerCase().includes('refresh token') || errorMsg.toLowerCase().includes('refresh_token')) {
          try {
            for (let i = localStorage.length - 1; i >= 0; i--) {
              const key = localStorage.key(i);
              if (key && (key.startsWith('sb-') || key.includes('supabase.auth.token'))) {
                localStorage.removeItem(key);
              }
            }
          } catch {}
          await supabase.auth.signOut().catch(() => {});
        }
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_event, session) => {
      setSession(session);
      const currentUser = session?.user ?? null;
      setUser(currentUser);
      if (currentUser) {
        await resolveRestaurantId(currentUser.id);
      } else {
        setRestaurantId(null);
      }
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const signOut = async () => {
    await supabase.auth.signOut();
    setRestaurantId(null);
  };

  return (
    <AuthContext.Provider value={{ user, session, restaurantId, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
