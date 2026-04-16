// ============================================
// Core Types for BhumiShop Admin
// ============================================

export interface AdminUser {
  admin_uuid: string
  email: string
  name?: string
  /** @deprecated Use 'name' instead - kept for backwards compatibility */
  nome?: string
  role?: 'admin' | 'super_admin'
}

export interface SessionToken {
  admin_uuid: string
  email: string
  role: string
  iat: number
  exp: number
}

// ============================================
// Product Types
// ============================================

export type StockType = 'print-on-demand' | 'in-stock' | 'digital' | 'dropshipping'
export type FulfillmentType = 'uma penca' | 'uiclap' | 'custom'
export type ProductCategory = string

export interface ProductVariant {
  id?: number
  product_id?: number
  size?: string
  color?: string
  variant_type?: string
  price_override?: number | null
  compare_at_price_override?: number | null
  sku?: string
  barcode?: string
  stock_quantity: number
  image_url?: string | null
  is_active: boolean
  sort_order: number
  metadata: Record<string, unknown>
}

export interface Product {
  id: number
  name: string
  slug: string
  description?: string | null
  short_description?: string | null
  category: ProductCategory | null
  collection_id: string | null
  subcollection_id: string | null
  price: number
  compare_at_price: number | null
  cost_price: number | null
  stock_type: StockType
  stock_quantity: number
  low_stock_threshold: number
  fulfillment_type: FulfillmentType
  artist: string | null
  brand: string | null
  info: string | null
  materials: string[]
  tags: string[]
  weight: number
  dimensions: Record<string, unknown> | null
  image: string | null
  images: string[]
  video_url: string | null
  shipping_zones: string[]
  shipping_class: string | null
  is_free_shipping: boolean
  is_active: boolean
  is_featured: boolean
  is_archived: boolean
  seo_title: string | null
  seo_description: string | null
  seo_keywords: string[]
  color_swatches: string[]
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string

  // Joined fields from product_details view
  collection_slug?: string
  collection_name?: string
  subcollection_slug?: string
  subcollection_name?: string
  subcollection_fulfillment_type?: string
  category_name?: string
  category_icon?: string
  variants?: ProductVariant[]
}

export interface ProductFilters {
  page?: number
  limit?: number
  category?: string
  collection_id?: string
  fulfillment_type?: string
  search?: string
  min_price?: number
  max_price?: number
  include_archived?: boolean
}

export interface ProductListResponse {
  data: Product[]
  count: number
  page: number
  limit: number
}

// ============================================
// Order Types
// ============================================

export type OrderStatus = 'pending' | 'paid' | 'preparing' | 'shipped' | 'delivered' | 'cancelled' | 'refunded'
export type PaymentStatus = 'pending' | 'processing' | 'paid' | 'failed' | 'refunded' | 'expired'
export type PaymentMethod = 'pix' | 'billing' | 'pix_bricks' | 'uma_penca' | 'paypal' | 'mercadopago'

export interface OrderItem {
  id: number
  order_id: string
  product_id: number | null
  product_name: string
  product_sku: string | null
  variant_id: number | null
  variant_details: Record<string, unknown> | null
  product_price: number
  quantity: number
  subtotal: number
  fulfillment_type: FulfillmentType
  shipping_cost: number
  weight: number | null
  status: OrderStatus
  tracking_number: string | null
  tracking_url: string | null
  carrier: string | null
  shipped_at: string | null
  delivered_at: string | null
  third_party_order_id: string | null
  third_party_source: string | null
}

export interface OrderStatusHistory {
  id: number
  order_id: string
  from_status: OrderStatus | null
  to_status: OrderStatus
  changed_by: string | null
  changed_by_role: string
  reason: string | null
  notes: string | null
  created_at: string
}

export interface Order {
  id: string
  order_number: string
  user_id: string | null
  guest_email: string | null
  status: OrderStatus
  payment_method: PaymentMethod
  payment_provider: string | null
  payment_status: PaymentStatus
  payment_reference: string | null
  payment_paid_at: string | null
  pix_key: string | null
  subtotal: number
  shipping_cost: number
  discount_amount: number
  tax_amount: number
  total: number
  currency: string
  customer_name: string
  customer_email: string
  customer_phone: string | null
  customer_tax_id: string | null
  shipping_address: string | null
  shipping_address_structured: Record<string, unknown> | null
  fulfillment_groups: Record<string, unknown>[]
  notes: string | null
  admin_notes: string | null
  cancelled_at: string | null
  cancellation_reason: string | null
  refunded_at: string | null
  refund_amount: number | null
  refund_reason: string | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string

  // Joined fields
  items?: OrderItem[]
  status_history?: OrderStatusHistory[]
}

export interface OrderFilters {
  page?: number
  limit?: number
  status?: OrderStatus
  payment_status?: PaymentStatus
  fulfillment_type?: string
  search?: string
  date_from?: string
  date_to?: string
}

export interface OrderStats {
  total_orders: number
  completed_orders: number
  pending_orders: number
  cancelled_orders: number
  gross_revenue: number
  net_revenue: number
  average_order_value: number
  total_items_sold: number
}

export interface OrderListResponse {
  data: Order[]
  count: number
  page: number
  limit: number
  stats: OrderStats
}

// ============================================
// Collection Types
// ============================================

export interface Collection {
  id: string
  slug: string
  name: string
  description: string | null
  icon: string | null
  logo_url: string | null
  banner_url: string | null
  is_active: boolean
  sort_order: number
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string

  // From collection_summary view
  active_subcollections_count?: number
  active_products_count?: number
  featured_products_count?: number
}

export type SubcollectionFulfillmentType = 'dropshipping' | 'handcrafted' | 'revenda' | 'print-on-demand' | 'digital' | 'own-stock'

export interface Subcollection {
  id: string
  collection_id: string
  slug: string
  name: string
  description: string | null
  icon: string | null
  fulfillment_type: SubcollectionFulfillmentType
  third_party_store_url: string | null
  third_party_api_endpoint: string | null
  third_party_sync_enabled: boolean
  third_party_sync_schedule: string | null
  is_active: boolean
  sort_order: number
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface Category {
  id: string
  name: string
  icon: string | null
  description: string | null
  parent_id: string | null
  collection_id: string | null
  sort_order: number
  is_active: boolean
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

// ============================================
// Shipping Types
// ============================================

export interface ShippingZone {
  id: string
  name: string
  description: string | null
  states: string[]
  countries: string[]
  cep_ranges: [number, number][]
  base_cost: number
  per_kg_cost: number
  estimated_days_min: number | null
  estimated_days_max: number | null
  free_shipping_above: number | null
  is_active: boolean
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface ShippingCalculationRequest {
  items: Array<{
    product_id: number
    quantity: number
    weight: number
    price: number
  }>
  destination_cep: string
}

export interface ShippingCalculationResult {
  cost: number
  days_min: number
  days_max: number
  weight_kg: number
  subtotal: number
  free_shipping_applied: boolean
}

// ============================================
// Dashboard/Metrics Types
// ============================================

export interface DailyMetrics {
  id: number
  date: string
  collection_id: string | null
  subcollection_id: string | null
  total_orders: number
  completed_orders: number
  cancelled_orders: number
  gross_revenue: number
  net_revenue: number
  refunds_amount: number
  total_items_sold: number
  orders_by_fulfillment: Record<string, unknown>
  product_views: number
  add_to_cart_count: number
  conversion_rate: number | null
  total_shipping_cost: number
  average_order_value: number | null
}

export interface FulfillmentMetrics {
  id: number
  order_id: string | null
  order_item_id: number | null
  fulfillment_type: string
  order_placed_at: string | null
  payment_confirmed_at: string | null
  preparation_started_at: string | null
  shipped_at: string | null
  delivered_at: string | null
  preparation_time_hours: number | null
  shipping_time_hours: number | null
  total_fulfillment_hours: number | null
  is_on_time: boolean | null
  expected_delivery_date: string | null
  actual_delivery_date: string | null
  has_issues: boolean
  issue_details: Record<string, unknown> | null
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

export interface DashboardOverview {
  orderStats: OrderStats
  recentOrders: Array<{
    id: string
    order_number: string
    status: OrderStatus
    payment_status: PaymentStatus
    total: number
    created_at: string
    customer_name: string
  }>
  lowStock: Array<{
    id: number
    name: string
    stock_quantity: number
    low_stock_threshold: number
  }>
  collections: Collection[]
  syncStatus: Array<{
    source: string
    status: string
    items_processed: number
    started_at: string
  }>
}

export interface FulfillmentAverages {
  preparation_time_hours: number
  shipping_time_hours: number
  on_time_rate_percent: number
}

// ============================================
// Inventory Types
// ============================================

export type MovementType =
  | 'inbound_purchase'
  | 'inbound_return'
  | 'inbound_adjustment'
  | 'outbound_sale'
  | 'outbound_damage'
  | 'outbound_adjustment'
  | 'outbound_fulfillment'

export interface InventoryMovement {
  id: number
  product_id: number
  variant_id: number | null
  movement_type: MovementType
  quantity: number
  previous_stock: number | null
  new_stock: number | null
  order_id: string | null
  order_item_id: number | null
  reference_number: string | null
  from_location: string | null
  to_location: string | null
  notes: string | null
  performed_by: string | null
  metadata: Record<string, unknown>
  created_at: string
}

export interface StockStatus {
  product_id: number
  product_name: string
  stock_type: StockType
  stock_quantity: number
  low_stock_threshold: number
  total_variants_stock: number
  is_low_stock: boolean
  is_out_of_stock: boolean
}

// ============================================
// Integration Types
// ============================================

export type SyncType = 'full' | 'incremental' | 'products' | 'inventory' | 'orders' | 'pricing'
export type SyncStatus = 'running' | 'success' | 'partial' | 'failed'

export interface SyncLog {
  id: number
  source: string
  sync_type: SyncType
  status: SyncStatus
  items_processed: number
  items_inserted: number
  items_updated: number
  items_failed: number
  errors: Record<string, unknown>[]
  started_at: string
  completed_at: string | null
  duration_seconds: number | null
  triggered_by: string
  github_run_id: string | null
  metadata: Record<string, unknown>
}

export interface ProductMapping {
  id: number
  internal_product_id: number
  source: string
  external_product_id: string
  external_product_url: string | null
  last_synced_at: string | null
  sync_status: 'synced' | 'pending' | 'error' | 'deleted_external'
  external_price: number | null
  external_currency: string | null
  raw_data: Record<string, unknown> | null
  metadata: Record<string, unknown>
}

export interface WebhookEvent {
  id: number
  webhook_id: string | null
  source: string
  event_type: string
  payload: Record<string, unknown>
  headers: Record<string, unknown> | null
  status: 'received' | 'processing' | 'processed' | 'failed' | 'ignored'
  processing_error: string | null
  processed_at: string | null
  idempotency_key: string | null
  metadata: Record<string, unknown>
  created_at: string
}

// ============================================
// API Response Types
// ============================================

export interface ApiResponse<T = unknown> {
  data: T
  error?: string
  message?: string
  count?: number
  page?: number
  limit?: number
}

export interface ApiError {
  error: string
}

// ============================================
// Bulk Operations
// ============================================

export type BulkAction = 'archive' | 'activate' | 'deactivate' | 'update'

export interface BulkOperationRequest {
  action: BulkAction
  ids: number[]
  data?: Record<string, unknown>
}

export interface BulkOperationResponse {
  message: string
  count: number
}

// ============================================
// Shop Configuration Types
// ============================================

export type ProductType = 'tshirt' | 'mug' | 'smug' | 'book' | 'accessory' | 'art' | 'digital'
export type PaymentProvider = 'umapenca' | 'uiclap' | 'custom'
export type PaymentGateway = 'mercadopago' | 'abacatepay' | 'pix_bricks' | 'umapenca_native' | 'paypal'
export type PaymentMethodType = 'pix' | 'card' | 'boleto'
export type CustomerLocation = 'brazil' | 'international'

export interface PaymentGatewayConfig {
  id: string
  gateway: PaymentGateway
  provider: PaymentProvider
  enabled: boolean
  supported_methods: PaymentMethodType[]
  credentials: Record<string, unknown>
  location_restriction: CustomerLocation | 'all'
  min_amount?: number
  max_amount?: number
  metadata: Record<string, unknown>
}

export interface ProductPaymentRule {
  id: string
  product_type: ProductType
  provider: PaymentProvider
  gateways: PaymentGateway[]
  location_overrides?: {
    brazil?: PaymentGateway[]
    international?: PaymentGateway[]
  }
  priority: number
  is_active: boolean
}

export interface ShopConfig {
  id: string
  store_name: string
  store_description: string
  contact_email: string
  whatsapp: string
  instagram: string
  external_links: {
    mercado_livre?: string
    umapenca?: string
    uiclap?: string
  }
  shipping: {
    free_shipping_above: number
    default_shipping: number
    production_days: number
  }
  policies: {
    return_policy: string
    shipping_info: string
  }
  banner: {
    title: string
    subtitle: string
    image_url: string
  }
  payment_gateways: PaymentGatewayConfig[]
  product_payment_rules: ProductPaymentRule[]
  location_rules: {
    brazil_gateways: PaymentGateway[]
    international_gateways: PaymentGateway[]
  }
  metadata: Record<string, unknown>
  created_at: string
  updated_at: string
}

// ============================================
// Sales Dashboard Types
// ============================================

export type SaleStatus =
  | 'payment_cancelled'
  | 'payment_pending'
  | 'payment_processing'
  | 'direct_umapenca'
  | 'sold_abacatepay'
  | 'sold_mercadopago'
  | 'sold_pix_bricks'
  | 'completed'
  | 'refunded'

export interface SaleRecord {
  id: string
  order_id: string
  order_number: string
  status: SaleStatus
  payment_gateway: PaymentGateway | null
  product_type: ProductType | null
  provider: PaymentProvider | null
  customer_location: CustomerLocation
  customer_name: string
  customer_email: string
  customer_address: string | null
  customer_state: string | null
  customer_country: string
  total: number
  currency: string
  items: Array<{
    product_name: string
    quantity: number
    price: number
  }>
  payment_method_type: PaymentMethodType | null
  created_at: string
  updated_at: string
  metadata: Record<string, unknown>
}

export interface SalesStats {
  total_sales: number
  total_revenue: number
  by_status: Record<SaleStatus, { count: number; revenue: number }>
  by_gateway: Record<PaymentGateway, { count: number; revenue: number }>
  by_location: {
    brazil: { count: number; revenue: number }
    international: { count: number; revenue: number }
  }
  by_product_type: Record<ProductType, { count: number; revenue: number }>
  by_payment_method: Record<PaymentMethodType, { count: number; revenue: number }>
  recent_orders: SaleRecord[]
}

// ============================================
// Visual Config Node Types
// ============================================

export type ConfigNodeType =
  | 'product_type'
  | 'provider'
  | 'payment_gateway'
  | 'location_rule'
  | 'payment_method'
  | 'product_specific'

export type ConfigEdgeType = 'assigns' | 'enables' | 'restricts' | 'overrides' | 'routes'

export interface ConfigNode {
  id: string
  type: ConfigNodeType
  label: string
  data: Record<string, unknown>
  enabled: boolean
  config?: Record<string, unknown>
}

export interface ConfigEdge {
  from: string
  to: string
  type: ConfigEdgeType
  label: string
  condition?: string
  enabled: boolean
}

// ============================================
// Infrastructure Orchestrator Types
// ============================================

export type EdgeFunctionStatus = 'active' | 'inactive' | 'degraded' | 'error'
export type OperationStatus = 'running' | 'success' | 'error' | 'timeout'
export type GeolocationSource = 'gps' | 'ip' | 'manual'
export type OtelSpanKind = 'INTERNAL' | 'SERVER' | 'CLIENT' | 'PRODUCER' | 'CONSUMER'
export type OtelStatusCode = 'UNSET' | 'OK' | 'ERROR'
export type OtelMetricType = 'COUNTER' | 'GAUGE' | 'HISTOGRAM' | 'SUMMARY'

export interface EdgeFunctionConfig {
  id: string
  function_name: string
  status: EdgeFunctionStatus
  last_execution: string | null
  last_status: string | null
  last_error: string | null
  total_calls: number
  success_calls: number
  error_calls: number
  avg_duration_ms: number | null
  config: Record<string, unknown>
  updated_at: string
}

export interface UserSession {
  id: string
  user_id: string
  email: string | null
  session_token: string | null
  ip_address: string | null
  user_agent: string | null
  started_at: string
  last_active: string
  ended_at: string | null
  is_active: boolean
  metadata: Record<string, unknown>
}

export interface UserGeolocation {
  id: string
  user_id: string
  session_id: string | null
  latitude: number | null
  longitude: number | null
  city: string | null
  region: string | null
  country: string | null
  country_code: string | null
  ip_address: string | null
  accuracy_meters: number | null
  source: GeolocationSource
  recorded_at: string
  metadata: Record<string, unknown>
}

export interface OperationLog {
  id: string
  operation: string
  entity_type: string | null
  entity_id: string | null
  user_id: string | null
  status: OperationStatus
  duration_ms: number | null
  request_payload: Record<string, unknown> | null
  response_payload: Record<string, unknown> | null
  error_message: string | null
  ip_address: string | null
  user_agent: string | null
  created_at: string
  metadata: Record<string, unknown>
}

export interface OtelSpan {
  id: string
  trace_id: string
  span_id: string
  parent_span_id: string | null
  name: string
  kind: OtelSpanKind
  start_time: string
  end_time: string | null
  duration_ns: number | null
  status_code: OtelStatusCode
  status_message: string | null
  service_name: string
  resource_attributes: Record<string, unknown>
  span_attributes: Record<string, unknown>
  events: unknown[]
  links: unknown[]
  created_at: string
}

export interface OtelMetric {
  id: string
  name: string
  description: string | null
  unit: string | null
  type: OtelMetricType
  value: number | null
  count: number | null
  sum: number | null
  min: number | null
  max: number | null
  bucket_bounds: number[] | null
  bucket_counts: number[] | null
  timestamp: string
  resource_attributes: Record<string, unknown>
  metric_attributes: Record<string, unknown>
  created_at: string
}

export interface InfraOverview {
  total_functions: number
  active_functions: number
  degraded_functions: number
  error_functions: number
  total_sessions: number
  active_sessions: number
  total_operations: number
  success_rate: number
  avg_response_time: number
  error_rate: number
}

export interface OrchestratorNode {
  id: string
  type: 'edge_function' | 'database' | 'user_session' | 'geolocation' | 'telemetry' | 'operation'
  label: string
  status: string
  data: Record<string, unknown>
  enabled: boolean
  config?: Record<string, unknown>
}

export interface OrchestratorEdge {
  from: string
  to: string
  type: 'calls' | 'queries' | 'tracks' | 'reports' | 'depends'
  label: string
  enabled: boolean
  condition?: string
}
