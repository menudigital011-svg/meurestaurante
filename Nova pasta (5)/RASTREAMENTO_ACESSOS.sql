-- Script para rastreamento de acessos ao menu
CREATE TABLE IF NOT EXISTS public.restaurant_visits (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id UUID REFERENCES public.restaurants(id) ON DELETE CASCADE,
    visited_at TIMESTAMPTZ DEFAULT NOW(),
    session_id TEXT
);

ALTER TABLE public.restaurant_visits ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir registro de visitas público" ON public.restaurant_visits;
CREATE POLICY "Permitir registro de visitas público" 
ON public.restaurant_visits FOR INSERT TO anon, authenticated 
WITH CHECK (true);

DROP POLICY IF EXISTS "Leitura de visitas para admin" ON public.restaurant_visits;
CREATE POLICY "Leitura de visitas para admin" 
ON public.restaurant_visits FOR SELECT TO authenticated 
USING (true);

GRANT INSERT ON public.restaurant_visits TO anon;
GRANT ALL ON public.restaurant_visits TO authenticated;

CREATE INDEX IF NOT EXISTS idx_visits_restaurant_date ON public.restaurant_visits(restaurant_id, visited_at);
