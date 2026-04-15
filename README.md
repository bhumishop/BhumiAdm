# 📊 Bhumi Shop Admin

> Painel administrativo para gestão da loja Bhumi Shop.

![Vue.js](https://img.shields.io/badge/Vue.js-3-green)
![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-yellow)
![Vercel](https://img.shields.io/badge/Vercel-Deploy-black)

---

## 📋 Descrição

Painel administrativo para gestão de produtos, categorias e configurações da loja Bhumi Shop. Desenvolvido com **Vue.js 3**, **Vite** e integrado ao **Supabase**.

🔗 **URL de Produção:** https://a-shop-2026.bhumisparshaschool.org

---

## ✨ Funcionalidades

### Produtos
- ✅ Listar, buscar e filtrar produtos
- ✅ Adicionar novos produtos
- ✅ Editar produtos existentes
- ✅ Excluir produtos
- ✅ Upload de imagens (URL ou base64)
- ✅ Gerenciar tamanhos
- ✅ Definir tipo de estoque

### Categorias
- ✅ CRUD completo de categorias
- ✅ Ícones emoji para categorias
- ✅ Categorias: Livros, Camisetas, Posters, Acessórios, Parceiros e mais

### Exportação
- ✅ Exportar para CSV
- ✅ Exportar para PDF

### Configurações
- ✅ Chave PIX
- ✅ WhatsApp
- ✅ Email PayPal
- ✅ Token Mercado Pago

---

## 🛠️ Tecnologias

| Tecnologia | Descrição |
|-----------|-----------|
| Vue.js 3 | Framework frontend |
| Vite | Build tool |
| Pinia | Gerenciamento de estado |
| Supabase | Backend (PostgreSQL) |
| Vercel | Deploy |

---

## 🚀 Instalação

### 1. Clone o repositório
```bash
git clone https://github.com/anattamodels/bhumi-shop-admin.git
cd bhumi-shop-admin
```

### 2. Instale as dependências
```bash
npm install
```

### 3. Execute localmente
```bash
npm run dev
```

### 4. Build para produção
```bash
npm run build
```

---

## ⚙️ Configuração

### Variáveis de Ambiente

Crie um arquivo `.env`:
```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_KEY=sua_chave_anon
```

### Credenciais de Acesso

- **URL:** https://a-shop-2026.bhumisparshaschool.org/login
- **Senha:** (configure via Supabase)

---

## 📁 Estrutura

```
src/
├── App.vue                    # Layout principal
├── main.js                   # Entry point
├── router/
│   └── index.js              # Rotas
├── supabase.js               # Config Supabase
├── stores/
│   ├── products.js           # Store de produtos
│   └── cart.js               # Store do carrinho
└── views/
    ├── HomeView.vue          # Home
    ├── ProductsView.vue      # Lista produtos
    ├── ProductDetailView.vue  # Detalhes produto
    ├── CartView.vue          # Carrinho
    ├── VideosView.vue       # Vídeos
    ├── AboutView.vue         # Sobre
    ├── ConfigView.vue        # Configurações
    ├── AdminView.vue         # Painel admin
    └── LoginView.vue         # Login
```

---

## 🗂️ Categorias Disponíveis

| Categoria | Ícone |
|-----------|-------|
| Livros | 📚 |
| Camisetas | 👕 |
| Posters | 🖼️ |
| Acessórios | 💎 |
| Outros | 📦 |
| Parceiros | 🤝 |

---

## 📄 Documentação

- [Documentação Geral](./docs/GERAL.md)
- [Documentação Admin](./docs/PAINEL_ADMIN.md)
- [Documentação Loja](./docs/LOJA.md)

---

## 🔐 Segurança

- Autenticação via sessionStorage
- Row Level Security (RLS) no Supabase
- Variáveis de ambiente para credenciais

---

## 🚢 Deploy

### Vercel

1. Conecte o repositório ao [Vercel](https://vercel.com)
2. Adicione as variáveis de ambiente
3. Deploy automático em push

```bash
git add .
git commit -m "Update"
git push origin master
```

---

## 📞 Contato

- **GitHub:** https://github.com/anattamodels/bhumi-shop-admin
- **Loja:** https://shop.bhumisparshaschool.org

---

## 📝 Licença

MIT License - Bhumi Shop 2026
