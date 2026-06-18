# Plano de Base de Dados Real - Menu Digital Inteligente

Este documento descreve a arquitetura de base de dados escalável e robusta para substituir o armazenamento local atual (`localStorage`).

## 1. Arquitetura Proposta (Relacional)

A estrutura abaixo foi desenhada para garantir máxima performance, integridade referencial e facilidade de análise de dados.

### Tabela: `restaurants`
Armazena as configurações globais e identidade visual.
- `id` (UUID, Primary Key)
- `name` (String, NOT NULL)
- `slogan` (String)
- `description` (Text)
- `logo_url` (Text)
- `banner_url` (Text)
- `banner_mode` (Enum: single, carousel)
- `banners` (Array of Text)
- `opening_hours` (JSONB) - Estrutura: `{ "monday": { "open": "08:00", "close": "22:00", "active": true } ... }`
- `address` (Text)
- `whatsapp` (String)
- `primary_color` (String) - Ex: "#e11d48"
- `payment_config` (JSONB) - IBAN, Multicaixa, etc.
- `social_links` (JSONB)
- `owner_id` (UUID, Link com Auth)
- `created_at` (Timestamp)

### Tabela: `categories`
- `id` (UUID, PK)
- `restaurant_id` (UUID, FK -> restaurants.id)
- `name` (String, NOT NULL)
- `order_index` (Integer) - Para ordenar o menu
- `active` (Boolean, default: true)

### Tabela: `products`
- `id` (UUID, PK)
- `category_id` (UUID, FK -> categories.id)
- `restaurant_id` (UUID, FK -> restaurants.id)
- `name` (String, NOT NULL)
- `description` (Text)
- `price` (Decimal, NOT NULL)
- `image_url` (Text)
- `active` (Boolean)
- `options` (JSONB) - Ex: Adicionais, tamanhos.

### Tabela: `orders`
- `id` (String - Ex: "ORD-12345")
- `restaurant_id` (UUID, FK)
- `customer_name` (String)
- `customer_phone` (String)
- `customer_address` (Text, Nullable)
- `delivery_method` (Enum: table, counter, delivery)
- `table_number` (String, Nullable)
- `payment_method` (Enum: delivery, transfer)
- `transfer_proof_url` (Text, Nullable)
- `total_price` (Decimal)
- `status` (Enum: pending, preparing, delivered, cancelled)
- `created_at` (Timestamp)

## 2. Auditoria de Funcionalidades (Status Atual)

| Funcionalidade | Estado Actual | Acção Necessária |
| :--- | :--- | :--- |
| **Login Adm** | ✅ Ativo (Supabase Auth) | N/A |
| **Nova Categoria** | ✅ Ativo | CRUD via SupabaseService |
| **Editar Categoria** | ✅ Ativo | CRUD via SupabaseService |
| **Editar Produto** | ✅ Ativo | CRUD via SupabaseService |
| **Busca de Produtos** | ✅ Ativo | Filtro reativo implementado |
| **Filtro Categoria** | ✅ Ativo | Filtro reativo implementado |
| **Estatísticas Dash** | ✅ Ativo | Calculado via Supabase Orders |
| **Upload Imagens** | ✅ Ativo | Integrado com Supabase Storage |
| **Checkout Cliente** | ✅ Ativo | Persistência em Banco + WhatsApp |
| **Mesas/QR Code** | ✅ Ativo | Gerenciamento completo de mesas |

## 3. Próximos Passos Sugeridos

1. **Monitoramento**: Verificar logs do Supabase para garantir que não existam erros de RLS.
2. **Performance**: Adicionar índices em colunas de busca frequente (já sugerido no `REPARAR_BANCO.sql`).
3. **Escalabilidade**: Implementar paginação em tabelas de muitos registros no Admin.

---
*Este plano reflete o estado atual do sistema com integração total ao Supabase.*
