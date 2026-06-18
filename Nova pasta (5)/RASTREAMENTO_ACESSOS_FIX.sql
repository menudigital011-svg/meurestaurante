-- Script CORRIGIDO para rastreamento de acessos ao menu
-- O ID do restaurante na tabela 'restaurants' é TEXT, então a chave estrangeira precisa ser TEXT
CREATE TABLE IF NOT EXISTS public.restaurant_visits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id TEXT, -- Alterado de UUID para TEXT para compatibilidade
    visited_at TIMESTAMPTZ DEFAULT NOW(),
    session_id TEXT
);

-- Habilitar RLS
ALTER TABLE public.restaurant_visits ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso
DROP POLICY IF EXISTS "Permitir registro de visitas público" ON public.restaurant_visits;
CREATE POLICY "Permitir registro de visitas público" 
ON public.restaurant_visits FOR INSERT TO anon, authenticated 
WITH CHECK (true);

DROP POLICY IF EXISTS "Leitura de visitas para admin" ON public.restaurant_visits;
CREATE POLICY "Leitura de visitas para admin" 
ON public.restaurant_visits FOR SELECT TO authenticated 
USING (true);

-- Permissões
GRANT INSERT ON public.restaurant_visits TO anon;
GRANT ALL ON public.restaurant_visits TO authenticated;

-- Índice para performance
CREATE INDEX IF NOT EXISTS idx_visits_restaurant_date ON public.restaurant_visits(restaurant_id, visited_at);
