# 🍽️ Menu Digital Inteligente

Um sistema moderno e premium de cardápio digital (SaaS) para restaurantes, projetado para oferecer uma experiência de autoatendimento rápida, bonita e interativa. O projeto conta com painel administrativo completo, controle de mesas, gerenciamento em tempo real de pedidos e integração inteligente.

## 🚀 Tecnologias Utilizadas

- **Frontend:** React 18 com Vite e TypeScript
- **Estilização:** Tailwind CSS & componentes modernos
- **Banco de Dados & Autenticação:** Supabase (PostgreSQL para dados e armazenamento em tempo real)
- **Hospedagem:** Netlify (com suporte a rotas dinâmicas via `netlify.toml`)
- **Animações:** Motion (antigo Framer Motion)

---

## ⚙️ Configuração das Variáveis de Ambiente no Netlify

Para que o sistema de login, o gerenciamento de pedidos e o banco de dados funcionem corretamente na sua hospedagem do **Netlify**, você deve configurar as seguintes variáveis de ambiente no painel de controle do seu projeto Netlify:

| Nome da Variável | Descrição / Exemplo |
| :--- | :--- |
| **`VITE_SUPABASE_URL`** | URL da API do seu projeto no Supabase (ex: `https://xxxxxx.supabase.co`) |
| **`VITE_SUPABASE_ANON_KEY`** | Chave anônima pública de API do Supabase (Anon/Public key) |

### Passo a passo para configurar no Netlify:
1. Acesse o painel da **Netlify** e clique no seu projeto (`menudigitalll`).
2. Vá em **Site configurations** > **Environment variables** > **Add a variable**.
3. Adicione `VITE_SUPABASE_URL` com o seu link do Supabase.
4. Adicione `VITE_SUPABASE_ANON_KEY` com a sua chave anônima do Supabase.
5. Após cadastrar as duas chaves, acesse a aba **Deploys** no topo do painel do Netlify e clique em **Trigger deploy** > **Deploy site** para reconstruir o projeto aplicando os novos valores das chaves.

---

## 📂 Recursos de Segurança e Conectividade do Painel

- **Recuperação Automática de Conectividade:** Adicionado sistema de detecção de gargalos de rede (Fallback timeout) no fluxo de login para alertar o usuário rapidamente em caso de falha de conexão com os serviços essenciais.
- **Roteamento Inteligente de URL:** URLs do tipo `/r/seu_restaurante` e `/r/seu_restaurante/table/numero_mesa` são interpretadas de forma transparente para permitir que os clientes façam pedidos baseados em QR Code com zero atrito de instalação.
