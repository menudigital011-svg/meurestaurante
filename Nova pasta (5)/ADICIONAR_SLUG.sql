-- Script para adicionar a funcionalidade de link personalizado (slug)
DO $$ 
BEGIN 
  -- 1. Adiciona a coluna slug à tabela de restaurantes se ela não existir
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'restaurants' AND column_name = 'slug') THEN
    ALTER TABLE restaurants ADD COLUMN slug TEXT;
    
    -- 2. Cria um índice único para o slug para garantir links exclusivos
    -- Ignora valores nulos da unicidade (podem haver vários restaurantes sem slug ainda)
    CREATE UNIQUE INDEX IF NOT EXISTS idx_restaurants_slug ON restaurants(slug) WHERE slug IS NOT NULL;
    
    RAISE NOTICE 'Coluna slug adicionada com sucesso.';
  ELSE
    RAISE NOTICE 'A coluna slug já existe.';
  END IF;
END $$;
