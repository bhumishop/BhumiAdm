# 🛒 BHUMI SHOP - Documentação Geral

> Sistema completo de e-commerce com painel administrativo e loja pública.

---

## 📋 Visão Geral

O **BHUMI SHOP** é uma solução completa de e-commerce desenvolvida com **Vue.js 3** e **Supabase** (backend como serviço). O sistema é dividido em dois projetos:

| Projeto | Descrição | URL |
|---------|-----------|-----|
| **Painel Admin** | Gestão de produtos, categorias e configurações | [a-shop-2026.bhumisparshaschool.org](https://a-shop-2026.bhumisparshaschool.org) |
| **Loja Pública** | Loja online para clientes | [shop.bhumisparshaschool.org](https://shop.bhumisparshaschool.org) |

---

## 🏗️ Arquitetura

```
┌─────────────────────────────────────────────────────────────────┐
│                         BHUMI SHOP                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────────┐         ┌─────────────────────────┐   │
│  │   PAINEL ADMIN    │         │      LOJA PÚBLICA       │   │
│  │   (Vue 3 + Vite)  │         │    (Vue 3 + Vite)       │   │
│  │                    │         │                         │   │
│  │  - CRUD Produtos  │         │  - Catálogo Produtos   │   │
│  │  - CRUD Categorias│         │  - Carrinho           │   │
│  │  - Configurações  │         │  - Checkout            │   │
│  │  - Export (CSV/PDF│         │  - Login/Cadastro      │   │
│  └────────┬──────────┘         └───────────┬─────────────┘   │
│           │                               │                   │
│           └───────────┬───────────────────┘                   │
│                       ▼                                       │
│              ┌────────────────┐                               │
│              │    SUPABASE    │                               │
│              │  (PostgreSQL)  │                               │
│              │                │                               │
│              │  - Products    │                               │
│              │  - Categories  │                               │
│              │  - Orders      │                               │
│              │  - Auth        │                               │
│              └────────────────┘                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## 🚀 Tecnologias

| Camada | Tecnologia |
|--------|------------|
| Frontend | Vue.js 3, Vite, Pinia |
| Backend | Supabase (PostgreSQL, Auth, Storage) |
| Estilização | CSS3 (variáveis customizadas) |
| Deploy | Vercel |

---

## 📦 Estrutura de Dados

### Tabela: `products`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | integer | ID único |
| name | text | Nome do produto |
| category | text | ID da categoria |
| price | numeric | Preço em R$ |
| description | text | Descrição detalhada |
| stock | text | "print-on-demand" ou "estoque" |
| image | text | URL ou base64 |
| artist | text | Nome do artista/autor |
| info | text | Informações adicionais |
| sizes | text | Tamanhos (ex: "P,M,G,GG") |
| created_at | timestamp | Data de criação |

### Tabela: `categories`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | text | Slug único (ex: "livros") |
| name | text | Nome (ex: "Livros") |
| icon | text | Emoji (ex: "📚") |

### Tabela: `orders`

| Campo | Tipo | Descrição |
|-------|------|-----------|
| id | UUID | ID único |
| user_id | UUID | FK para auth.users |
| order_number | VARCHAR | Número único (BH2026000001) |
| status | VARCHAR | pending, paid, preparing, shipped, delivered |
| total | DECIMAL | Valor total |
| payment_method | VARCHAR | pix, mercadopago, paypal |
| customer_name | VARCHAR | Nome do cliente |
| customer_email | VARCHAR | Email do cliente |
| customer_phone | VARCHAR | Telefone |
| shipping_address | TEXT | Endereço |
| created_at | timestamp | Data de criação |

---

## 🔐 Credenciais

### Acesso Admin
- **URL:** https://a-shop-2026.bhumisparshaschool.org/login
### Supabase
- **URL:** https://nuypyyxnacvglpqwqihx.supabase.co
- **Anon Key:** (ver arquivo src/supabase.js de cada projeto)

### OAuth Google
- **Client ID:** (obtenha em Google Cloud Console)
- **Client Secret:** (obtenha em Google Cloud Console)

---

## ⚙️ Instalação Local

### 1. Clone os repositórios
```bash
git clone https://github.com/anattamodels/bhumi-shop-admin.git
git clone https://github.com/anattamodels/bhumi-shop.git
```

### 2. Instale as dependências
```bash
cd bhumi-shop-admin && npm install
cd bhumi-shop && npm install
```

### 3. Configure as variáveis de ambiente
Crie um arquivo `.env` em cada projeto:
```
VITE_SUPABASE_URL=https://nuypyyxnacvglpqwqihx.supabase.co
VITE_SUPABASE_KEY=your_anon_key_here
```

### 4. Execute localmente
```bash
npm run dev
```

### 5. Build para produção
```bash
npm run build
```

---

## 📂 Documentação Específica

- [Documentação do Painel Admin](./docs/PAINEL_ADMIN.md)
- [Documentação da Loja](./docs/LOJA.md)

---

## 🎨 Categorias Disponíveis

| ID | Nome | Ícone |
|----|------|-------|
| todos | Todos | 🏪 |
| livros | Livros | 📚 |
| camisetas | Camisetas | 👕 |
| posters | Posters | 🖼️ |
| acessorios | Acessórios | 💎 |
| outros | Outros | 📦 |
| parceiros | Parceiros | 🤝 |

---

## 📄 Licença

MIT License - Bhumi Shop 2026
