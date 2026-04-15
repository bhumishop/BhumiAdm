# 🛒 Loja - BHUMI SHOP

> Interface pública de e-commerce para clientes finais.

---

## 📋 Descrição

A **Loja BHUMI SHOP** é a interface pública onde os clientes navegam pelos produtos, adicionam ao carrinho e finalizam compras. Desenvolvida com **Vue.js 3**, **Pinia** e integrada ao **Supabase**.

**URL de Produção:** https://shop.bhumisparshaschool.org

---

## ✨ Funcionalidades

### Catálogo
- ✅ Visualizar todos os produtos
- ✅ Filtrar por categoria
- ✅ Buscar produtos
- ✅ Ver detalhes do produto
- ✅ Visualizar imagens em tamanho grande

### Carrinho
- ✅ Adicionar produtos
- ✅ Alterar quantidade
- ✅ Remover produtos
- ✅ Selecionar tamanho
- ✅ Persistência (localStorage)
- ✅ Cálculo automático de total

### Checkout
- ✅ Escolha de forma de pagamento (PIX, Mercado Pago, PayPal)
- ✅ Gerar QR Code PIX
- ✅ Integração com WhatsApp para pedidos
- ✅ Confirmação de pedido

### Conta do Cliente
- ✅ Cadastro com email/senha
- ✅ Login com email/senha
- ✅ Login com Google OAuth
- ✅ Visualizar pedidos
- ✅ Acompanhar status do pedido
- ✅ Editar perfil

### Funcionalidades Adicionais
- ✅ Página de vídeos
- ✅ Página sobre
- ✅ Design responsivo

---

## 📁 Estrutura de Arquivos

```
BHUMI-SHOP/
├── src/
│   ├── App.vue                    # Layout (header, footer, router)
│   ├── main.js                    # Entry point
│   ├── router/
│   │   └── index.js              # Rotas do Vue Router
│   ├── supabase.js               # Configuração do Supabase
│   ├── stores/
│   │   ├── products.js           # Store de produtos e categorias
│   │   ├── cart.js               # Store do carrinho (c/ localStorage)
│   │   ├── auth.js               # Store de autenticação
│   │   └── orders.js             # Store de pedidos
│   └── views/
│       ├── HomeView.vue           # Página inicial
│       ├── ProductsView.vue      # Lista de produtos
│       ├── ProductDetailView.vue # Detalhes do produto
│       ├── CartView.vue          # Carrinho + Checkout
│       ├── VideosView.vue        # Vídeos
│       ├── AboutView.vue         # Sobre
│       ├── AuthView.vue          # Login / Cadastro
│       ├── MyOrdersView.vue      # Meus pedidos
│       └── ProfileView.vue       # Perfil do usuário
├── public/
├── index.html
└── package.json
```

---

## 🔌 Integrações

### Supabase (Backend)

| Tabela | Uso |
|--------|-----|
| products | Catálogo de produtos |
| categories | Categorias |
| orders | Pedidos dos clientes |
| order_items | Itens de cada pedido |
| order_status_history | Histórico de status |
| auth.users | Usuários cadastrados |

### Autenticação

- **Email/Senha:** Cadastro e login tradicional
- **Google OAuth:** Login com conta Google

---

## 🖥️ Rotas

| Rota | Descrição | Acesso |
|------|-----------|--------|
| `/` | Home com categorias em destaque | Público |
| `/produtos` | Lista de produtos | Público |
| `/produtos/:id` | Detalhes do produto | Público |
| `/carrinho` | Carrinho e checkout | Público |
| `/videos` | Vídeos | Público |
| `/sobre` | Sobre a Bhumi | Público |
| `/login` | Login / Cadastro | Público |
| `/minhas-compras` | Meus pedidos | **Requer login** |
| `/perfil` | Perfil do usuário | **Requer login** |

---

## 🛒 Fluxo de Compra

```
1. CLIENTE NAVEGA → Home / Produtos
         ↓
2. SELECIONA PRODUTO → Detalhes
         ↓
3. ADICIONA AO CARRINHO → Seleciona tamanho/qtd
         ↓
4. VAI PARA CARRINHO → Revisa itens
         ↓
5. FINALIZA PEDIDO → Escolhe pagamento
         ↓
6. CONFIRMAÇÃO → Pedido registrado
         ↓
7. PAGAMENTO → PIX / Mercado Pago / PayPal
         ↓
8. ACOMPANHA → Minhas Compras
```

---

## 💳 Formas de Pagamento

### PIX
- Gera QR Code para pagamento
- Chave PIX configurada no admin

### Mercado Pago
- Integração via token
- Checkout redirecionado

### PayPal
- Integração via email
- Checkout redirecionado

---

## 👤 Sistema de Contas

### Cadastro
```
POST /auth/signup
{
  email: "cliente@email.com",
  password: "senha123"
}
```

### Login
```
POST /auth/login
{
  email: "cliente@email.com",
  password: "senha123"
}
```

### Login Google
```
POST /auth/signin_with_oauth
{
  provider: "google"
}
```

---

## 📦 Pedidos

### Estrutura do Pedido

```javascript
{
  id: "uuid",
  user_id: "uuid_usuario",
  order_number: "BH2026000001",
  status: "pending", // pending → paid → preparing → shipped → delivered
  total: 150.00,
  payment_method: "pix",
  payment_status: "pending",
  customer_name: "João Silva",
  customer_email: "joao@email.com",
  customer_phone: "11999999999",
  shipping_address: "Rua ABC, 123 - São Paulo/SP",
  created_at: "2026-01-01T00:00:00Z"
}
```

### Status do Pedido

| Status | Descrição |
|--------|-----------|
| pending | Aguardando Pagamento |
| paid | Pagamento Confirmado |
| preparing | Preparando Pedido |
| shipped | Pedido Enviado |
| delivered | Entregue |
| cancelled | Cancelado |

---

## 💾 Persistência

### Carrinho
O carrinho é persistido no `localStorage`:

```javascript
// Estrutura
{
  items: [
    {
      id: 1,
      name: "Produto X",
      price: 50.00,
      quantity: 2,
      size: "M",
      category: "camisetas",
      image: "url..."
    }
  ],
  paymentMethod: "pix"
}
```

### Usuário
O estado de autenticação é gerenciado pelo Supabase Auth e persistido automaticamente.

---

## 🎨 Componentes Principais

### Header
- Logo
- Menu de navegação
- Ícone do carrinho (com badge de quantidade)

### ProductCard
- Imagem do produto
- Nome
- Preço
- Badge de categoria

### CartItem
- Imagem
- Nome
- Tamanho
- Quantidade (+/-)
- Preço unitário
- Total item
- Botão remover

### OrderTimeline
- Timeline visual do status
- Histórico de alterações

---

## 🎨 Estilos

O projeto usa o mesmo design system do painel admin:

```css
:root {
  --bg-primary: #0a0a0a;
  --bg-secondary: #1a1a2e;
  --bg-card: #12121f;
  --accent-purple: #7B2CBF;
  --accent-purple-light: #9D4EDD;
  --accent-green: #00FF41;
  --text-primary: #FFFFFF;
  --text-secondary: #B8B8B8;
  --text-muted: #6B6B6B;
  --border-color: #2a2a4a;
}
```

---

## 🐛 Bugs Conhecidos

1. **Filtro de categorias:** Usar `toString()` na comparação
2. **Imagens:** Aceita base64 e URLs http/https
3. **Login Google:** Redirect URL hardcoded para produção

---

## 🚀 Deploy

### Vercel

1. Conecte o repositório ao Vercel
2. Configure as variáveis de ambiente:
   ```
   VITE_SUPABASE_URL=https://nuypyyxnacvglpqwqihx.supabase.co
   VITE_SUPABASE_KEY=eyJhbGciOiJIUzI1NiIs...
   ```
3. Deploy automático em push para master

### URLs de Produção

- **Loja:** https://shop.bhumisparshaschool.org
- **Admin:** https://a-shop-2026.bhumisparshaschool.org

---

## 📞 Suporte

Consulte a [Documentação Geral](./GERAL.md) ou a [Documentação do Painel Admin](./PAINEL_ADMIN.md) para mais informações.
