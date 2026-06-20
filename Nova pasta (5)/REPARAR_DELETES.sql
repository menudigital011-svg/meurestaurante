--- SCRIPT DE AUTOMATIZAÇÃO DE DELETES E HIGIENIZAÇÃO (SUPABASE) ---
--- Cole e execute este script completo no SQL Editor do seu projeto Supabase ---

-- 1. LIMPEZA AUTOMÁTICA DE RESTAURANTES ÓRFÃOS (Cujo usuário administrador correspondente foi deletado do Auth)
-- Isto deletará "Only Kichen", "Talatona Grill House" e qualquer outro que não possua mais conta ativa,
-- e por efeito "ON DELETE CASCADE", removerá automaticamente todos os produtos, categorias, mesas e pedidos desses restaurantes órfãos.
DELETE FROM public.restaurants
WHERE (
    id NOT IN (SELECT id::text FROM auth.users) 
    OR (owner_uid::text NOT IN (SELECT id::text FROM auth.users) AND owner_uid IS NOT NULL)
)
AND id <> 'default'; -- Preserva a conta de demonstração/legada se houver

-- 2. CRIAR FUNÇÃO QUE TRATA A EXCLUSÃO DE USUÁRIOS NO SUPABASE AUTH
-- Sempre que um usuário administrador for excluído/deletado das credenciais da plataforma (auth.users),
-- este gatilho será acionado e apagará instantaneamente seu restaurante de forma limpa.
CREATE OR REPLACE FUNCTION public.handle_deleted_user()
RETURNS TRIGGER AS $$
BEGIN
    -- Apaga o restaurante pertencente ao usuário que foi deletado do Auth
    DELETE FROM public.restaurants 
    WHERE id = OLD.id::text OR owner_uid::text = OLD.id::text;
    
    RETURN OLD;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- 3. ASSOCIAR O TRIGGER DE EXCLUSÃO À TABELA auth.users DO SUPABASE
-- Registra o gatilho "AFTER DELETE" para garantir Sincronização e Integridade de 100% entre Contas e Restaurantes.
DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;
CREATE TRIGGER on_auth_user_deleted
    AFTER DELETE ON auth.users
    FOR EACH ROW EXECUTE FUNCTION public.handle_deleted_user();
