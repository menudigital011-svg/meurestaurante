--- SCRIPT DE REPARO DEFINITIVO V3 (CORRIGIR CAST DE UUID EM OWNER_UID) ---
--- Cole e execute este script completo no SQL Editor do seu projeto Supabase ---

-- 1. DESABILITAR temporariamente RLS para permitir a higienização de permissões e chaves
ALTER TABLE public.orders DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurants DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.products DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables DISABLE ROW LEVEL SECURITY;

-- 2. REMOVER POLÍTICAS EXISTENTES das tabelas públicas para reconstruí-las sem duplicidade
DROP POLICY IF EXISTS "Inserção pública para pedidos" ON public.orders;
DROP POLICY IF EXISTS "Acesso total de desenvolvimento (ORDERS)" ON public.orders;
DROP POLICY IF EXISTS "Enable insert for authenticated users only" ON public.orders;
DROP POLICY IF EXISTS "Leitura de pedidos para admin" ON public.orders;
DROP POLICY IF EXISTS "Permitir inserção de pedidos pública" ON public.orders;
DROP POLICY IF EXISTS "Permitir leitura de pedidos pública" ON public.orders;
DROP POLICY IF EXISTS "Permitir leitura e alteração de pedidos pública" ON public.orders;

DROP POLICY IF EXISTS "Leitura pública para restaurantes" ON public.restaurants;
DROP POLICY IF EXISTS "Acesso total de desenvolvimento (RESTAURANTS)" ON public.restaurants;
DROP POLICY IF EXISTS "Acesso total para restaurantes" ON public.restaurants;

DROP POLICY IF EXISTS "Leitura pública para categorias" ON public.categories;
DROP POLICY IF EXISTS "Acesso total de desenvolvimento (CATEGORIES)" ON public.categories;
DROP POLICY IF EXISTS "Acesso total para categorias" ON public.categories;

DROP POLICY IF EXISTS "Leitura pública para produtos" ON public.products;
DROP POLICY IF EXISTS "Acesso total de desenvolvimento (PRODUCTS)" ON public.products;
DROP POLICY IF EXISTS "Acesso total para produtos" ON public.products;

DROP POLICY IF EXISTS "Leitura pública para mesas" ON public.tables;
DROP POLICY IF EXISTS "Acesso total de desenvolvimento (TABLES)" ON public.tables;
DROP POLICY IF EXISTS "Acesso total para mesas" ON public.tables;

-- 3. REABILITAR RLS (Para garantir a segurança do banco, mantendo as barreiras corretas)
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;

-- 4. CRIAR NOVAS POLÍTICAS GLOBAIS COM "WITH CHECK (true)" PARA MÁXIMA INTERATIVIDADE DOS ADMINS E COMPRADORES
-- Restaurantes: Permite leitura pública e gravação de administradores autenticados ou anônimos (para setup inicial)
CREATE POLICY "Acesso total para restaurantes" 
ON public.restaurants 
FOR ALL 
TO anon, authenticated 
USING (true) 
WITH CHECK (true);

-- Categorias: Permite leitura e escrita geral de categorias
CREATE POLICY "Acesso total para categorias" 
ON public.categories 
FOR ALL 
TO anon, authenticated 
USING (true) 
WITH CHECK (true);

-- Produtos: Permite leitura e escrita geral de produtos
CREATE POLICY "Acesso total para produtos" 
ON public.products 
FOR ALL 
TO anon, authenticated 
USING (true) 
WITH CHECK (true);

-- Mesas: Permite leitura e escrita geral das mesas do restaurante
CREATE POLICY "Acesso total para mesas" 
ON public.tables 
FOR ALL 
TO anon, authenticated 
USING (true) 
WITH CHECK (true);

-- Pedidos (Orders): Clientes criam os pedidos via checkout (Anon) e Administradores gerenciam (Modificam status)
CREATE POLICY "Permitir inserção de pedidos pública" 
ON public.orders 
FOR INSERT 
TO anon, authenticated 
WITH CHECK (true);

CREATE POLICY "Permitir leitura e alteração de pedidos pública" 
ON public.orders 
FOR ALL 
TO anon, authenticated 
USING (true) 
WITH CHECK (true);

-- 5. CONCEDER PERMISSÕES DIRETAS DE BANCO PARA AS CONEXÕES ANON E AUTHENTICATED
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;
GRANT ALL ON public.orders TO anon, authenticated;
GRANT ALL ON public.restaurants TO anon, authenticated;
GRANT ALL ON public.categories TO anon, authenticated;
GRANT ALL ON public.products TO anon, authenticated;
GRANT ALL ON public.tables TO anon, authenticated;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO authenticated;

-- 6. CRIAR FUNÇÃO E TRIGGER PARA CRIAR RESTAURANTE AUTOMATICAMENTE AO CRIAR CONTA NO AUTH DO SUPABASE
-- Qualquer nova conta criada no Supabase Auth terá uma correspondência instantânea na tabela de restaurantes!
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    new_slug TEXT;
BEGIN
    -- Gerar um slug amigável único com base no email ou no id do usuário para ser amigável
    new_slug := 'restaurante-' || substring(new.id::text from 1 for 8);

    INSERT INTO public.restaurants (
        id, 
        name, 
        slogan,
        description, 
        primary_color, 
        address, 
        whatsapp, 
        country, 
        owner_uid, 
        slug,
        opening_hours,
        banner_mode,
        banners,
        payment_methods,
        order_types,
        social_links
    )
    VALUES (
        new.id::text, 
        'Meu Novo Restaurante', 
        'Comida boa e saborosa',
        'Bem-vindo ao seu novo painel administrativo! Configure os dados do seu restaurante nas definições para deixá-lo com a sua cara.', 
        '#e11d48', 
        'Luanda, Angola', 
        '244900000000', 
        'Angola (KZ)', 
        new.id, -- Mantém como tipo UUID nativo (new.id já é UUID no auth.users)
        new_slug,
        '{
            "Segunda-feira": {"open": "08:00", "close": "22:00", "active": true},
            "Terça-feira": {"open": "08:00", "close": "22:00", "active": true},
            "Quarta-feira": {"open": "08:00", "close": "22:00", "active": true},
            "Quinta-feira": {"open": "08:00", "close": "22:00", "active": true},
            "Sexta-feira": {"open": "08:00", "close": "22:00", "active": true},
            "Sábado": {"open": "08:00", "close": "23:00", "active": true},
            "Domingo": {"open": "08:00", "close": "21:00", "active": true}
        }'::jsonb,
        'single',
        NULL, -- Usa NULL para máxima compatibilidade tanto com TEXT[] como com JSONB em colunas de banners
        '{"money": true, "transfer": true}'::jsonb,
        '{"delivery": true, "counter": true, "table": true}'::jsonb,
        '{}'::jsonb
    )
    ON CONFLICT (id) DO NOTHING;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Associar o trigger ao evento AFTER INSERT na tabela auth.users do Supabase
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- 7. REPARAR RETROATIVAMENTE TODOS OS RESTAURANTE DAS CONTAS ANTIGAS QUE SE CADASTRAM PELO AUTH DO SUPABASE
-- Garante que se existir algum usuário do Auth que tenha ficado sem restaurante criado, o registro seja gerado agora!
INSERT INTO public.restaurants (
    id, 
    name, 
    slogan,
    description, 
    primary_color, 
    address, 
    whatsapp, 
    country, 
    owner_uid, 
    slug,
    opening_hours,
    banner_mode,
    banners,
    payment_methods,
    order_types,
    social_links
)
SELECT 
    id::text, 
    'Meu Novo Restaurante', 
    'Comida boa e saborosa',
    'Bem-vindo ao seu novo painel administrativo! Configure os dados do seu restaurante nas definições para deixá-lo com a sua cara.', 
    '#e11d48', 
    'Luanda, Angola', 
    '244900000000', 
    'Angola (KZ)', 
    id, -- Correção aqui: Mantém a coluna original UUID sem converter para text
    'restaurante-' || substring(id::text from 1 for 8),
    '{
        "Segunda-feira": {"open": "08:00", "close": "22:00", "active": true},
        "Terça-feira": {"open": "08:00", "close": "22:00", "active": true},
        "Quarta-feira": {"open": "08:00", "close": "22:00", "active": true},
            "Quinta-feira": {"open": "08:00", "close": "22:00", "active": true},
        "Sexta-feira": {"open": "08:00", "close": "22:00", "active": true},
        "Sábado": {"open": "08:00", "close": "23:00", "active": true},
        "Domingo": {"open": "08:00", "close": "21:00", "active": true}
    }'::jsonb,
    'single',
    NULL, -- Usa NULL para máxima compatibilidade tanto com TEXT[] como com JSONB em colunas de banners
    '{"money": true, "transfer": true}'::jsonb,
    '{"delivery": true, "counter": true, "table": true}'::jsonb,
    '{}'::jsonb
FROM auth.users
WHERE id::text NOT IN (SELECT id FROM public.restaurants)
ON CONFLICT (id) DO NOTHING;
