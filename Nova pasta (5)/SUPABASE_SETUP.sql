--- SCRIPT DE CONFIGURAÇÃO DO BANCO DE DADOS (SUPABASE) ---
--- Cole este script no SQL Editor do seu projeto Supabase ---

-- 1. Habilitar EXTENSÕES (se necessário)
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. Tabela de RESTAURANTES
CREATE TABLE IF NOT EXISTS public.restaurants (
    id TEXT PRIMARY KEY DEFAULT 'default',
    name TEXT NOT NULL,
    slogan TEXT,
    logo TEXT,
    banner TEXT,
    banner_mode TEXT DEFAULT 'single',
    banners TEXT[],
    description TEXT,
    hours TEXT,
    opening_hours JSONB DEFAULT '{
        "Segunda-feira": {"open": "08:00", "close": "22:00", "active": true},
        "Terça-feira": {"open": "08:00", "close": "22:00", "active": true},
        "Quarta-feira": {"open": "08:00", "close": "22:00", "active": true},
        "Quinta-feira": {"open": "08:00", "close": "22:00", "active": true},
        "Sexta-feira": {"open": "08:00", "close": "22:00", "active": true},
        "Sábado": {"open": "08:00", "close": "23:00", "active": true},
        "Domingo": {"open": "08:00", "close": "21:00", "active": true}
    }'::jsonb,
    hours_observation TEXT,
    address TEXT,
    whatsapp TEXT,
    country TEXT,
    primary_color TEXT DEFAULT '#e11d48',
    rating DECIMAL DEFAULT 4.5,
    owner_uid TEXT,
    payment_methods JSONB,
    order_types JSONB,
    social_links JSONB,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Tabela de CATEGORIAS
CREATE TABLE IF NOT EXISTS public.categories (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id TEXT REFERENCES public.restaurants(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    "order" INTEGER DEFAULT 0,
    icon TEXT,
    image TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Tabela de PRODUTOS
CREATE TABLE IF NOT EXISTS public.products (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id TEXT REFERENCES public.restaurants(id) ON DELETE CASCADE,
    category_id UUID REFERENCES public.categories(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,
    full_description TEXT,
    price DECIMAL NOT NULL,
    old_price DECIMAL,
    image TEXT,
    active BOOLEAN DEFAULT true,
    is_promotion BOOLEAN DEFAULT false,
    is_featured BOOLEAN DEFAULT false,
    options JSONB DEFAULT '[]',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. Tabela de PEDIDOS
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id TEXT REFERENCES public.restaurants(id) ON DELETE CASCADE,
    customer_name TEXT NOT NULL,
    customer_phone TEXT NOT NULL,
    customer_address TEXT,
    delivery_method TEXT NOT NULL,
    table_number TEXT,
    payment_method TEXT NOT NULL,
    transfer_proof TEXT,
    items JSONB NOT NULL,
    total DECIMAL NOT NULL,
    status TEXT DEFAULT 'pending',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5.0 ÍNDICES para performance (CRITICAL para Dashboards)
CREATE INDEX IF NOT EXISTS idx_orders_restaurant_id ON public.orders(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);

-- 5.1 Tabela de MESAS
CREATE TABLE IF NOT EXISTS public.tables (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    restaurant_id TEXT REFERENCES public.restaurants(id) ON DELETE CASCADE,
    number TEXT NOT NULL,
    status TEXT DEFAULT 'active',
    qr_code_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5.2 Função para atualizar o updated_at automaticamente
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ language 'plpgsql';

-- 5.3 Triggers para updated_at
DROP TRIGGER IF EXISTS update_restaurants_updated_at ON public.restaurants;
CREATE TRIGGER update_restaurants_updated_at BEFORE UPDATE ON public.restaurants FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_products_updated_at ON public.products;
CREATE TRIGGER update_products_updated_at BEFORE UPDATE ON public.products FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS update_tables_updated_at ON public.tables;
CREATE TRIGGER update_tables_updated_at BEFORE UPDATE ON public.tables FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- 6. Habilitar SECURITY (RLS)
-- Por enquanto, habilitaremos acesso total para testes rápidos (conforme pedido de "começar a usar")
-- Em produção, deve-se restringir as permissões.

ALTER TABLE public.restaurants ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tables ENABLE ROW LEVEL SECURITY;

-- Remover políticas se existirem para evitar erro de "already exists"
DROP POLICY IF EXISTS "Leitura pública para restaurantes" ON public.restaurants;
DROP POLICY IF EXISTS "Leitura pública para categorias" ON public.categories;
DROP POLICY IF EXISTS "Leitura pública para produtos" ON public.products;
DROP POLICY IF EXISTS "Leitura pública para mesas" ON public.tables;
DROP POLICY IF EXISTS "Inserção pública para pedidos" ON public.orders;
DROP POLICY IF EXISTS "Leitura de pedidos para admin" ON public.orders;
DROP POLICY IF EXISTS "Acesso total de desenvolvimento (RESTAURANTS)" ON public.restaurants;
DROP POLICY IF EXISTS "Acesso total de desenvolvimento (CATEGORIES)" ON public.categories;
DROP POLICY IF EXISTS "Acesso total de desenvolvimento (PRODUCTS)" ON public.products;
DROP POLICY IF EXISTS "Acesso total de desenvolvimento (ORDERS)" ON public.orders;
DROP POLICY IF EXISTS "Acesso total de desenvolvimento (TABLES)" ON public.tables;

-- POLICIES: Permitir leitura pública para tudo (menu)
CREATE POLICY "Leitura pública para restaurantes" ON public.restaurants FOR SELECT USING (true);
CREATE POLICY "Leitura pública para categorias" ON public.categories FOR SELECT USING (true);
CREATE POLICY "Leitura pública para produtos" ON public.products FOR SELECT USING (true);
CREATE POLICY "Leitura pública para mesas" ON public.tables FOR SELECT USING (true);

-- POLICIES: Permitir inserção de pedidos por qualquer pessoa
CREATE POLICY "Inserção pública para pedidos" ON public.orders FOR INSERT WITH CHECK (true);
CREATE POLICY "Leitura de pedidos para admin" ON public.orders FOR SELECT USING (true);

-- POLICIES: Permitir TODAS as operações para desenvolvimento (CUIDADO EM PRODUÇÃO)
CREATE POLICY "Acesso total de desenvolvimento (RESTAURANTS)" ON public.restaurants FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total de desenvolvimento (CATEGORIES)" ON public.categories FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total de desenvolvimento (PRODUCTS)" ON public.products FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total de desenvolvimento (ORDERS)" ON public.orders FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Acesso total de desenvolvimento (TABLES)" ON public.tables FOR ALL USING (true) WITH CHECK (true);

-- 7. Inserir dados padrão (MIGRAÇÃO)
INSERT INTO public.restaurants (id, name, logo, banner, description, primary_color, whatsapp, address)
VALUES ('default', 'Meu Restaurante', 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?q=80&w=200&auto=format&fit=crop', 'https://images.unsplash.com/photo-1514933651103-005eec06c04b?q=80&w=1200&auto=format&fit=crop', 'O melhor da culinária regional', '#e11d48', '244900000000', 'Rua Exemplo, Luanda')
ON CONFLICT (id) DO UPDATE SET
    logo = EXCLUDED.logo,
    banner = EXCLUDED.banner,
    description = EXCLUDED.description,
    primary_color = EXCLUDED.primary_color,
    whatsapp = EXCLUDED.whatsapp,
    address = EXCLUDED.address;

-- Inserir Categorias Iniciais
INSERT INTO public.categories (id, restaurant_id, name, "order")
VALUES 
    ('c1111111-1111-1111-1111-111111111111', 'default', 'Pratos Principais', 1),
    ('c2222222-2222-2222-2222-222222222222', 'default', 'Bebidas', 2),
    ('c3333333-3333-3333-3333-333333333333', 'default', 'Sobremesas', 3)
ON CONFLICT (id) DO NOTHING;

-- Inserir Produtos Iniciais (Com IDs fixos para evitar duplicatas em re-execução)
INSERT INTO public.products (id, restaurant_id, name, description, price, image, category_id, active)
VALUES 
    ('11111111-1111-1111-1111-111111111111', 'default', 'Risoto de Cogumelos', 'Arroz arbóreo cremoso com mix de cogumelos frescos e finalizado com trufas.', 12500, 'https://images.unsplash.com/photo-1476124369491-e7addf5db371?q=80&w=1000&auto=format&fit=crop', 'c1111111-1111-1111-1111-111111111111', true),
    ('22222222-2222-2222-2222-222222222222', 'default', 'Suco de Laranja', 'Suco 100% natural, espremido na hora.', 2500, 'https://images.unsplash.com/photo-1613478223719-2ab802602423?q=80&w=1000&auto=format&fit=crop', 'c2222222-2222-2222-2222-222222222222', true),
    ('33333333-3333-3333-3333-333333333333', 'default', 'Petit Gâteau', 'Bolo de chocolate com recheio cremoso, servido com sorvete de baunilha.', 5500, 'https://images.unsplash.com/photo-1563805042-7684c019e1cb?q=80&w=1000&auto=format&fit=crop', 'c3333333-3333-3333-3333-333333333333', true)
ON CONFLICT (id) DO NOTHING;

-- Inserir Mesas Iniciais
INSERT INTO public.tables (restaurant_id, number, status)
VALUES 
    ('default', '01', 'active'),
    ('default', '02', 'active'),
    ('default', '03', 'active')
ON CONFLICT DO NOTHING;

-- 8. Habilitar REALTIME para as tabelas (Usando DO para ignorar se já estiver habilitado)
DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'restaurants') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.restaurants;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'categories') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.categories;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'products') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.products;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'orders') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.orders;
    END IF;
    IF NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'tables') THEN
        ALTER PUBLICATION supabase_realtime ADD TABLE public.tables;
    END IF;
END $$;
