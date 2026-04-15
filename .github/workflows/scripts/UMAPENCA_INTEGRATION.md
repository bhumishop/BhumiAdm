# UmaPenca Integration - JWT Pre-fill Approach

## Overview

Since reCAPTCHA tokens are domain-specific and cannot be reused across domains, we use a JWT pre-fill approach to minimize user friction when creating accounts on both BhumiShop and UmaPenca.

## Architecture

### Flow Diagram

```
User fills BhumiShop checkout form
         ↓
User selects "Uma Penca" payment provider
         ↓
If cart has ONLY UmaPenca items:
    → Call uma-penca-proxy with cart items
    → Get signed JWT URL
    → Redirect to /sacola/checkout?token=JWT
    → User completes checkout on UmaPenca

If cart has MIXED items (BhumiShop + UmaPenca):
    → Process BhumiShop order normally
    → Show "Complete Registration" overlay with shipping info
    → User clicks "Continue to UmaPenca"
    → Generate JWT pre-fill token with user data + address
    → Open UmaPenca registration in new tab with pre-filled form
    → User confirms registration and completes checkout (no re-typing)

Shipping Calculation:
    → Call uma-penca-shipping with cart_id + CEP + country
    → Get real-time carrier rates from UmaPenca
    → Display shipping options to user
```

### Components

#### 1. Edge Function: umapenca-prefill
**Location**: `supabase/functions/umapenca-prefill/index.ts`

Generates a signed JWT containing user registration data and returns a redirect URL to UmaPenca's registration page.

**Features**:
- International shipping support (country_id mapping)
- Brazilian CPF validation
- Address pre-fill for domestic and international
- JWT expires in 30 minutes
- Audit logging

**Endpoint**: `POST /umapenca-prefill`

**Request Body**:
```json
{
  "user": {
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "11999999999",
    "cpf": "12345678901"
  }
}
```

**Response**:
```json
{
  "url": "https://prataprint.bhumisparshaschool.org/cadastrar?token=JWT_TOKEN&ref=bhumi-shop",
  "expiresIn": "30m",
  "message": "Redirect to UmaPenca registration"
}
```

**JWT Payload**:
```json
{
  "type": "umapenca_prefill",
  "user": {
    "first_name": "JOHN",
    "last_name": "DOE",
    "email": "john@example.com",
    "phone": "11999999999",
    "ddi": 55,
    "doc_number": "12345678901",
    "birthdate": { "date": "1990-01-01" },
    "country_id": 245,
    "tipo_pessoa": 0,
    "from_store": "bhumisprint"
  },
  "ref": "bhumi-shop",
  "created_at": "2026-04-15T..."
}
```

#### 2. Edge Function: uma-penca-shipping
**Location**: `supabase/functions/uma-penca-shipping/index.ts`

Proxies requests to UmaPenca's carriers API to get real-time shipping rates.

**Features**:
- Supports Brazil (CEP-based) and international (country_id-based) shipping
- Real-time carrier rates from UmaPenca
- Rate limiting (60 req/min)
- Returns carrier name, price, delivery time, weight

**Endpoint**: `POST /uma-penca-shipping/rates`

**Request**:
```json
{
  "cart_id": "4911900",
  "cep": "12313-131",
  "country_id": 245
}
```

**Response**:
```json
{
  "success": true,
  "carriers": [
    { "name": "EMS", "price": 172.90, "delivery_time": "5-7" },
    { "name": "PAC", "price": 89.50, "delivery_time": "10-15" }
  ]
}
```

#### 3. Vue Component: `UmaPencaPrefillOverlay`
**Location**: `BhumiShop/src/components/checkout/UmaPencaPrefillOverlay.vue`

Enhanced overlay component with:
- User info display (name, email, phone, country)
- International shipping indicator
- Shipping information card
- Step-by-step "What happens next" guide
- Loading states and error handling

#### 3. Checkout Store Updates
**Location**: `BhumiShop/src/stores/checkout.js`

- Fixed: `paymentProvider` value mismatch (line 194 now checks `'uma penca'` not `'uma_penca'`)
- Updated: Mixed cart handling now returns `{ showUmaPencaPrefill: true }` instead of throwing error
- Checkout URL fixed to use `/sacola/checkout` instead of `/checkout`

#### 4. Checkout View Integration
**Location**: `BhumiShop/src/views/CheckoutView.vue`

- Added `UmaPencaPrefillOverlay` component
- Added `showUmaPencaPrefill()` function
- Updated `handlePayment()` to detect pre-fill signal and show overlay

## Bugs Fixed

### 1. Payment Provider Value Mismatch
**File**: `BhumiShop/src/stores/checkout.js:194`

**Before**:
```javascript
if (paymentProvider.value === 'uma_penca') {  // Never matched!
```

**After**:
```javascript
if (paymentProvider.value === 'uma penca') {  // Correct
```

**Issue**: `selectPaymentProvider()` sets value with space (`'uma penca'`), but checkout check used underscore (`'uma_penca'`), causing redirect to never trigger.

### 2. Wrong Checkout URL
**Files**:
- `supabase/functions/uma-penca-proxy/index.ts:153`
- `BhumiShop/src/stores/checkout.js:232`
- `BhumiShop/src/views/CheckoutView.vue:608`

**Before**:
```typescript
const checkoutUrl = `${UMA_PENCA_STORE_URL}/checkout?token=...`
```

**After**:
```typescript
const checkoutUrl = `${UMA_PENCA_STORE_URL}/sacola/checkout?token=...`
```

**Issue**: UmaPenca checkout URL is `/sacola/checkout`, not `/checkout`.

## Security Considerations

### JWT Token Security
- Tokens expire in 30 minutes
- Tokens are signed with `JWT_SECRET` (same as Supabase service role key)
- Tokens contain unique `jti` for audit logging
- User data is sanitized to prevent XSS

### Rate Limiting
- `uma-penca-proxy`: 30 requests per minute per IP
- `umapenca-prefill`: Same rate limiting applies

### Audit Logging
Both edge functions attempt to log to database tables:
- `checkout_redirects` - for checkout redirects
- `umapenca_prefill_logs` - for pre-fill token generation

Tables may not exist yet - silent failure is acceptable.

## Deployment

### 1. Deploy Edge Function
```bash
supabase functions deploy umapenca-prefill
```

### 2. Environment Variables
Ensure these are set:
- `JWT_SECRET` (already used by uma-penca-proxy)
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `UMA_PENCA_STORE_URL` (default: https://prataprint.bhumisparshaschool.org)
- `ALLOWED_ORIGINS`

### 3. Frontend Deployment
Build and deploy BhumiShop frontend - changes are in:
- `src/stores/checkout.js`
- `src/views/CheckoutView.vue`
- `src/components/checkout/UmaPencaPrefillOverlay.vue` (new file)

## User Experience

### Before (Problem)
1. User fills BhumiShop registration form
2. User completes checkout
3. User redirected to UmaPenca
4. User must fill entire UmaPenca registration form again (duplicate work)

### After (Solution)
1. User fills BhumiShop registration form
2. User completes checkout
3. Overlay appears: "Complete Your Registration"
4. Shows pre-filled user info (name, email)
5. User clicks "Continue to UmaPenca Registration"
6. Opens UmaPenca in new tab with data pre-filled
7. User only needs to set password and confirm (no re-typing)

## Limitations

- **Cannot fully automate**: UmaPenca requires reCAPTCHA validation on their domain
- **Two-step process**: User must still manually complete UmaPenca registration
- **No account linking**: Accounts are linked by email, not by API integration
- **Requires UmaPenca changes**: UmaPenca must implement JWT token parsing on their registration page to pre-fill form

## Next Steps (If Needed)

### Option A: Contact Chico Rei for Partner API
- Request special API access without reCAPTCHA requirement
- Get partner API key for automated registration
- Enables true unified registration

### Option B: Implement 2Captcha Service
- Cost: ~$1-3 per 1000 solves
- Adds 10-30 seconds to registration
- Fully automated but slower UX

### Option C: UmaPenca Webhook
- UmaPenca sends webhook when user registers
- BhumiShop automatically links accounts by email
- Requires UmaPenca to implement webhook
