# BhumiAdm

E-commerce administration panel for the Bhumisparsha School online store. Built with Vue 3, TypeScript, Pinia, and Supabase Edge Functions. Manages products, orders, payments, shipping, analytics, and third-party integrations.

[![Vue 3](https://img.shields.io/badge/Vue-3.5-4FC08D?logo=vue.js&logoColor=white)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-6.0-3178C6?logo=typescript&logoColor=white)](https://www.typescriptlang.org/)
[![Vite 7](https://img.shields.io/badge/Vite-7.3-646CFF?logo=vite&logoColor=white)](https://vitejs.dev/)
[![Supabase](https://img.shields.io/badge/Supabase-PostgreSQL-3ECF8E?logo=supabase&logoColor=white)](https://supabase.com/)
[![Pinia](https://img.shields.io/badge/Pinia-3.0-FFDD55?logo=pinia&logoColor=black)](https://pinia.vuejs.org/)
[![License](https://img.shields.io/badge/License-MIT-yellow)](LICENSE)

**Live Demo:** [a-shop-2026.bhumisparshaschool.org](https://a-shop-2026.bhumisparshaschool.org)

---

## Table of Contents

- [Overview](#overview)
- [Architecture](#architecture)
- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Database Schema](#database-schema)
- [Edge Functions](#edge-functions)
- [Getting Started](#getting-started)
- [Configuration](#configuration)
- [State Management](#state-management)
- [API Layer](#api-layer)
- [Deployment](#deployment)
- [CI/CD](#cicd)
- [Testing](#testing)
- [Contributing](#contributing)
- [License](#license)

---

## Overview

BhumiAdm is a full-featured e-commerce admin panel designed for managing a multi-fulfillment online store. It provides comprehensive tools for catalog management, order processing, payment tracking, shipping zone configuration, real-time analytics, and third-party platform synchronization.

The frontend communicates exclusively with Supabase Edge Functions -- there are no direct database queries from the client. This ensures all business logic, authentication, and data access are server-side.

---

## Architecture

```
+-------------------+          +---------------------------+
|   Vue 3 SPA       |  HTTPS   |   Supabase Edge Functions |
|   (Browser)       |--------->|   (Deno / TypeScript)     |
|                   |          |                           |
|  Pinia Stores     |          |  27+ edge functions:      |
|  Vue Router       |          |  - admin-auth             |
|  Edge API Client  |          |  - list-products          |
|  vis-network      |          |  - manage-orders-advanced |
|  jsPDF            |          |  - dashboard-metrics      |
+-------------------+          |  - shipping-calculator    |
                               |  - create-billing         |
                               |  - manage-integrations    |
                               +------------+--------------+
                                            |
                               +------------v--------------+
                               |   Supabase Platform       |
                               |   PostgreSQL + Auth       |
                               |   + Third-party APIs      |
                               |   (MercadoPago, AbacatePay|
                               |    UmaPenca, UICLAP)      |
                               +---------------------------+
```

---

## Features

### Catalog Management

| Feature | Description |
|---------|-------------|
| Products CRUD | Full create, read, update, delete with search, filtering, pagination |
| Collections | Top-level organizational units with icons and sort ordering |
| Subcollections | Nested groupings with fulfillment type assignment |
| Variants | Size/color variants with SKU generation and stock management |
| Bulk Operations | Archive, activate, or delete multiple products at once |
| Image CDN | Upload product images to GitHub repository served via jsDelivr CDN |

### Order Management

| Feature | Description |
|---------|-------------|
| Order Listing | Filter by status, search, detail view with item breakdown |
| Status Updates | Change order status with tracking number support |
| Order Tracking | Full history of status changes per order |
| Fulfillment Groups | Orders split by fulfillment type (dropshipping, handcrafted, print-on-demand) |

### Payments

| Feature | Description |
|---------|-------------|
| PIX Payments | Create and check PIX payment status via AbacatePay |
| Credit Card Billing | Process card payments through AbacatePay |
| Payment Tracking | Track payment status across all orders |

### Shipping

| Feature | Description |
|---------|-------------|
| Shipping Zones | Brazilian state-based shipping zone configuration |
| Delivery Types | Multiple delivery method definitions |
| CEP Calculator | Client-side shipping cost calculation by postal code |
| Free Shipping Threshold | Automatic free shipping above configured minimum |

### Analytics & Dashboards

| Feature | Description |
|---------|-------------|
| Live Dashboard | Real-time KPIs, store activity, gateway status, order flow, event feed |
| Network Graph | Force-directed visualization of stores, gateways, orders, products, customers |
| Sales Dashboard | Revenue analytics filtered by gateway, location, payment method |
| Metrics View | Business metrics: daily revenue, fulfillment averages, top products |

### System Configuration

| Feature | Description |
|---------|-------------|
| Shop Configurator | Visual graph-based configuration of payment gateways per product type and location |
| Integrations | Third-party sync management (UmaPenca, UICLAP), webhook configuration, sync logs |
| User Roles | Role-based access control: admin, moderator, support |

### Authentication

- Google OAuth via Identity Services (One Tap + fallback)
- JWT validation through edge function
- Admin users table with role-based access (`admin`, `super_admin`)
- Router guards redirect unauthenticated users to `/login`

---

## Tech Stack

| Layer | Technology | Version |
|-------|------------|---------|
| Framework | Vue 3 (Composition API, `<script setup>`) | 3.5.29 |
| Language | TypeScript | 6.0.2 |
| Build Tool | Vite | 7.3.1 |
| State Management | Pinia | 3.0.4 |
| Routing | Vue Router | 5.0.3 |
| Database | Supabase (PostgreSQL) | SDK 2.98.0 |
| Visualization | vis-network | 9.1.9 |
| PDF Export | jsPDF + jsPDF-autoTable | 2.5.1 / 3.8.1 |
| OAuth | Google Identity Services | External |
| Serverless | Supabase Edge Functions (Deno 2) | 27+ functions |
| Image CDN | jsDelivr via GitHub repository | External |
| CI/CD | GitHub Actions | External |

---

## Project Structure

```
BhumiAdm/
├── .github/workflows/
│   ├── deploy.yml                    # CI/CD deployment workflow
│   ├── sync-products.yml             # Product sync automation
│   └── scripts/
│       ├── umapenca.py               # UmaPenca scraper
│       ├── uiclap.py                 # UICLAP scraper
│       └── sync.sh                   # Sync orchestration
├── docs/
│   ├── GERAL.md                      # General documentation
│   ├── PAINEL_ADMIN.md               # Admin panel documentation
│   └── LOJA.md                       # Store documentation
├── public/
│   ├── favicon.svg
│   └── images/backgrounds/           # Background images for UI
├── supabase/
│   ├── config.toml                   # Supabase CLI configuration
│   ├── functions/                    # 27+ Edge Functions (TypeScript/Deno)
│   │   ├── admin-auth/               # Google OAuth JWT verification
│   │   ├── list-products/            # Product listing with filters
│   │   ├── list-orders/              # Order listing
│   │   ├── list-collections/         # Collection listing
│   │   ├── manage-variants/          # Product variant management
│   │   ├── manage-orders-advanced/   # Advanced order operations
│   │   ├── manage-shipping/          # Shipping configuration
│   │   ├── manage-users/             # User role management
│   │   ├── dashboard-metrics/        # Dashboard KPIs
│   │   ├── sales-analytics/          # Sales analytics
│   │   ├── inventory-management/     # Stock management
│   │   ├── manage-integrations/      # Third-party sync
│   │   ├── shipping-calculator/      # Shipping cost calculation
│   │   ├── create-billing/           # Payment creation
│   │   ├── check-pix-status/         # PIX status check
│   │   ├── abacatepay-webhook/       # Payment webhook handler
│   │   ├── network-graph/            # Network graph data
│   │   ├── storefront-auth/          # Storefront authentication
│   │   ├── storefront-products/      # Storefront product listing
│   │   ├── storefront-orders/        # Storefront order creation
│   │   ├── storefront-cart/          # Storefront cart operations
│   │   ├── storefront-shipping/      # Storefront shipping
│   │   ├── user-roles/               # User role CRUD
│   │   ├── shop-config/              # Shop configuration
│   │   ├── upload-cdn-image/         # CDN image upload
│   │   ├── uma-penca-proxy/          # UmaPenca API proxy
│   │   ├── uma-penca-shipping/       # UmaPenca shipping
│   │   └── umapenca-prefill/         # UmaPenca prefill
│   └── migrations/                   # 25 database migrations
│       ├── 001_create_collections.sql
│       ├── 002_create_subcollections.sql
│       ├── 003_create_products.sql
│       ├── 004_create_product_variants.sql
│       ├── 005_create_categories.sql
│       ├── 006_create_orders_and_items.sql
│       ├── 007_create_order_tracking.sql
│       ├── 008_create_shipping_zones.sql
│       ├── 009_create_metrics_and_inventory.sql
│       ├── 010_create_third_party_integrations.sql
│       ├── 011_enable_rls_and_policies.sql
│       ├── 012_create_functions_and_triggers.sql
│       ├── 013_add_rate_limiting_and_security_improvements.sql
│       ├── 014_add_color_swatches_to_products.sql
│       ├── 015_create_user_roles_table.sql
│       ├── 016_storefront_read_only.sql
│       ├── 017_fix_production_issues.sql
│       ├── 018_create_admin_users_table.sql
│       ├── 019_update_rls_block_direct_anon_access.sql
│       ├── 020_fix_rls_policies_security_hardening.sql
│       ├── 021_comprehensive_security_hardening.sql
│       ├── 022_add_uiclap_and_custom_fulfillment_types.sql
│       ├── 023_create_carts_table.sql
│       ├── 024_create_rate_limits_table.sql
│       └── 025_create_umapenca_prefill_logs.sql
├── src/
│   ├── api/
│   │   └── edgeApi.ts                # Centralized API client for all edge function calls
│   ├── assets/
│   │   └── main.css                  # Global CSS (cyberpunk/hacker theme)
│   ├── router/
│   │   └── index.ts                  # Vue Router with auth guards
│   ├── stores/                       # 14 Pinia composition stores
│   │   ├── adminAuth.ts              # Google OAuth, session management
│   │   ├── products.ts               # Product CRUD, caching, filtering
│   │   ├── collections.ts            # Collection CRUD
│   │   ├── subcollections.ts         # Subcollection with fulfillment types
│   │   ├── variants.ts               # Product variants, stock management
│   │   ├── orders.ts                 # Order listing, status updates, tracking
│   │   ├── payments.ts               # Payment methods, PIX, billing
│   │   ├── dashboard.ts              # Dashboard stats, revenue, top products
│   │   ├── sales.ts                  # Sales analytics with gateway breakdowns
│   │   ├── shipping.ts               # Shipping zones, delivery types, CEP
│   │   ├── inventory.ts              # Stock movements, low-stock alerts
│   │   ├── integrations.ts           # Webhooks, sync logs, product mappings
│   │   ├── network.ts                # Network graph data, real-time events
│   │   ├── shopConfig.ts             # Payment gateway config, visual graph
│   │   └── userRoles.ts              # User management, role assignment
│   ├── types/
│   │   ├── index.ts                  # Comprehensive TypeScript interfaces (700+ lines)
│   │   └── declarations.d.ts         # Module declarations for untyped packages
│   ├── utils/
│   │   ├── githubCdn.js              # GitHub CDN image upload utilities
│   │   └── githubCdn.d.ts            # TypeScript declarations
│   ├── views/                        # 18 Vue view components
│   │   ├── AdminView.vue             # Main admin layout with sidebar
│   │   ├── HomeView.vue              # Home/landing page
│   │   ├── LoginView.vue             # Google OAuth login
│   │   ├── ProductsView.vue          # Product management
│   │   ├── CollectionsView.vue       # Collection management
│   │   ├── SubcollectionsView.vue    # Subcollection management
│   │   ├── VariantsView.vue          # Variant management
│   │   ├── OrdersView.vue            # Order management
│   │   ├── PaymentsView.vue          # Payment management
│   │   ├── ShippingView.vue          # Shipping configuration
│   │   ├── LiveDashboard.vue         # Real-time dashboard
│   │   ├── NetworkGraph.vue          # Interactive network visualization
│   │   ├── SalesDashboard.vue        # Sales analytics
│   │   ├── MetricsView.vue           # Business metrics
│   │   ├── IntegrationsView.vue      # Third-party integrations
│   │   ├── ShopConfigurator.vue      # Visual shop configuration
│   │   ├── UserRolesView.vue         # User role management
│   │   ├── ConfigView.vue            # System configurations
│   │   ├── VideosView.vue            # Videos page
│   │   ├── AboutView.vue             # About page
│   │   └── NotFoundView.vue          # 404 page
│   ├── App.vue                       # Root component
│   ├── main.js                       # Application entry point
│   ├── supabase.js                   # Supabase client initialization
│   └── supabase.d.ts                 # TypeScript declarations for supabase module
├── .env.example                      # Environment variable template
├── .gitignore
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.node.json
└── vite.config.js
```

---

## Database Schema

Key PostgreSQL tables managed through 25 migration files:

| Table | Purpose |
|-------|---------|
| `collections` | Top-level organizational units (BhumiPrint, PrataPrint, etc.) |
| `subcollections` | Child collections with fulfillment_type |
| `products` | Full product catalog with categories, pricing, SEO, third-party sync |
| `product_variants` | Size/color variants with SKU and stock |
| `orders` + `order_items` | Order management with fulfillment groups |
| `order_tracking` | Tracking history and status changes |
| `shipping_zones` | Brazilian state-based shipping calculation |
| `inventory_movements` | Stock movement audit trail |
| `daily_metrics` | Aggregated daily analytics |
| `fulfillment_metrics` | Order fulfillment timing |
| `third_party_sync_log` | Sync status with external platforms |
| `product_mappings` | Cross-platform product ID mapping |
| `webhook_events` | Webhook processing audit |
| `admin_users` | Google OAuth admin accounts |
| `user_roles` | RBAC (admin, moderator, support) |
| `carts` + `cart_items` | Server-side shopping cart |
| `rate_limits` | API rate limiting |
| `shop_config` | Store configuration with gateway rules |

Row Level Security (RLS) is enabled on all tables with policies restricting direct anonymous access. All data operations go through edge functions using the `service_role` key.

---

## Edge Functions

The frontend communicates with 27+ Supabase Edge Functions written in TypeScript/Deno. Each function handles JWT validation, business logic, database queries, and response formatting.

| Function | Purpose |
|----------|---------|
| `admin-auth` | Google OAuth JWT verification, admin session creation |
| `list-products` | Product listing with search, filtering, pagination |
| `list-orders` | Order listing with status filtering |
| `list-collections` | Collection and subcollection listing |
| `manage-variants` | Product variant CRUD with stock updates |
| `manage-orders-advanced` | Bulk order operations, status updates |
| `manage-shipping` | Shipping zone and delivery type CRUD |
| `manage-users` | User role assignment and management |
| `dashboard-metrics` | Real-time dashboard KPIs |
| `sales-analytics` | Revenue analytics by gateway, location, payment method |
| `inventory-management` | Stock movement recording and low-stock alerts |
| `manage-integrations` | Third-party sync configuration, webhook management |
| `shipping-calculator` | CEP-based shipping cost calculation |
| `create-billing` | Payment creation via AbacatePay |
| `check-pix-status` | PIX payment status polling |
| `abacatepay-webhook` | Payment webhook handler |
| `network-graph` | Network graph data for visualization |
| `storefront-auth` | Storefront authentication (shared with BhumiShop) |
| `storefront-products` | Storefront product listing (shared with BhumiShop) |
| `storefront-orders` | Storefront order creation (shared with BhumiShop) |
| `storefront-cart` | Storefront cart operations (shared with BhumiShop) |
| `storefront-shipping` | Storefront shipping calculation |
| `user-roles` | User role CRUD operations |
| `shop-config` | Shop configuration management |
| `upload-cdn-image` | Image upload to GitHub CDN |
| `uma-penca-proxy` | UmaPenca API proxy |
| `uma-penca-shipping` | UmaPenca shipping calculation |
| `umapenca-prefill` | UmaPenca prefill logging |

---

## Getting Started

### Prerequisites

- Node.js 20+
- pnpm (recommended) or npm
- Supabase project with Edge Functions deployed

### Installation

```bash
# Clone the repository
git clone https://github.com/BhumisparshaSchool/BhumiAdm.git
cd BhumiAdm

# Install dependencies
pnpm install

# Copy environment file and configure
cp .env.example .env
# Edit .env with your Supabase credentials

# Start development server
pnpm dev
```

The application will be available at `http://localhost:5173`.

### Build for Production

```bash
pnpm build
```

Output is written to `dist/`. Serve with any static file server.

### Preview Production Build

```bash
pnpm preview
```

---

## Configuration

### Environment Variables

Create a `.env` file based on `.env.example`:

```env
# Supabase Connection (required)
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_KEY=your-anon-key-here

# Google OAuth for Admin Login (required)
VITE_GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com

# GitHub CDN for product images (required)
VITE_GITHUB_OWNER=YourOrg
VITE_GITHUB_REPO=YourRepo
VITE_CDN_BRANCH=cdn

# Application Settings (optional)
VITE_APP_NAME=BhumiShop Admin
VITE_APP_ENV=development
```

### Supabase Setup

1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Run all migrations in `supabase/migrations/` sequentially (001 through 025)
3. Deploy all edge functions in `supabase/functions/`
4. Configure Google OAuth in Supabase Auth settings
5. Set up the admin_users table with initial admin accounts

---

## State Management

14 Pinia composition stores manage application state:

| Store | Responsibility |
|-------|---------------|
| `adminAuth` | Google OAuth login, session management, token refresh |
| `products` | Product CRUD, categories, 5-min TTL caching, filtering |
| `collections` | Collection CRUD operations |
| `subcollections` | Subcollection CRUD with fulfillment type handling |
| `variants` | Product variants, bulk creation, stock updates |
| `orders` | Order listing, filtering, status updates, tracking |
| `payments` | Payment methods (PIX, billing), status management |
| `dashboard` | Dashboard stats, revenue by day, top products |
| `sales` | Sales analytics with gateway/location/payment breakdowns |
| `shipping` | Shipping zones, delivery types, CEP calculation |
| `inventory` | Stock movements, low-stock alerts |
| `integrations` | Webhooks, sync logs, product mappings |
| `network` | Network graph data, real-time event handling |
| `shopConfig` | Payment gateway config, product rules, visual graph |
| `userRoles` | User management, role assignment |

---

## API Layer

All API communication goes through `src/api/edgeApi.ts`. This centralized client:

- Attaches JWT tokens from localStorage to every request
- Calls Supabase Edge Functions at `{SUPABASE_URL}/functions/v1/{endpoint}`
- Handles error responses and network failures
- Provides typed request/response through TypeScript interfaces

Example usage:

```typescript
import { edgeApi } from './api/edgeApi'

// Fetch products with filters
const products = await edgeApi.products.list({
  category: 'livros',
  page: 1,
  limit: 20
})

// Update order status
const order = await edgeApi.orders.updateStatus(orderId, 'shipped', {
  trackingNumber: 'BR123456789'
})
```

---

## Deployment

### GitHub Pages

The project is configured for GitHub Pages deployment through `.github/workflows/deploy.yml`:

```yaml
# Trigger on push to master
- Builds with Vite
- Deploys to GitHub Pages
```

### Manual Deploy

```bash
# Build
pnpm build

# Upload dist/ folder to your static hosting provider
```

### Supported Platforms

- GitHub Pages (primary)
- Vercel
- Netlify
- Any static file server (Nginx, Apache, Cloudflare Pages)

---

## CI/CD

GitHub Actions workflows:

| Workflow | Trigger | Purpose |
|----------|---------|---------|
| `deploy.yml` | Push to master | Build and deploy to GitHub Pages |
| `sync-products.yml` | Scheduled / Manual | Sync products from third-party stores (UmaPenca, UICLAP) |

The sync workflow runs Python scrapers that pull product data from external platforms, upload images to the CDN branch, and sync records to Supabase via edge functions.

---

## Testing

The admin panel focuses is on data management rather than user-facing interactions. For testing the storefront, see the [BhumiShop](https://github.com/BhumisparshaSchool/BhumiShop) repository which includes Vitest unit tests.

Manual testing checklist:

- [ ] Google OAuth login flow
- [ ] Product CRUD operations
- [ ] Collection and subcollection management
- [ ] Variant creation and stock updates
- [ ] Order status updates and tracking
- [ ] Payment status tracking
- [ ] Shipping zone configuration
- [ ] Dashboard real-time updates
- [ ] Network graph visualization
- [ ] Sales analytics filtering
- [ ] Integration sync logs
- [ ] User role assignment
- [ ] Shop configurator graph
- [ ] CSV/PDF export
- [ ] Image upload to CDN

---

## Design

The UI uses a cyberpunk/hacker terminal aesthetic:

- Dark base background (`#08080a`)
- Accent colors: Purple (`#8B5CF6`), Green (`#00FF41`), Red (`#EF4444`), Cyan (`#06B6D4`)
- Fonts: Inter (sans-serif), JetBrains Mono (monospace), Space Grotesk (display)
- Zero border-radius for a sharp, brutalist feel
- Monospace text for headers with `>` prefix
- All UI text in Portuguese (Brazil)

---

## Related Projects

- [BhumiShop](https://github.com/BhumisparshaSchool/BhumiShop) - The customer-facing storefront
- Both projects share the same Supabase backend and edge functions

---

## License

MIT
