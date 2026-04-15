# UmaPenca API Reference

Reverse engineered from production traffic on 2026-04-15.

## Base URLs

- **Storefront**: `https://prataprint.bhumisparshaschool.org`
- **API Gateway**: `https://arcoiro.chicorei.com/umapenca`
- **reCAPTCHA Site Key**: `6LeJ7boqAAAAAA6-1dOz7vaFaLuummobxGd5QXyb`

## Authentication

### API Key Header
```
cr-api-auth: {api_key}
```
Dynamic key extracted from storefront JavaScript bundles.

### Session Cookie
```
up_session={session_id}
```
Set after successful login.

---

## Endpoints

### 1. Customer Registration

**URL**: `POST https://arcoiro.chicorei.com/umapenca/customers?defaultGroup=1`

**Headers**:
```http
Content-Type: application/json
cr-api-auth: {api_key}
Origin: https://prataprint.bhumisparshaschool.org
```

**Request Body**:
```json
{
  "tipo_pessoa": 0,
  "first_name": "JOHN",
  "last_name": "DOE",
  "contato": null,
  "id_gender": 0,
  "phone": "11999999999",
  "ddi": 55,
  "doc_number": "12345678901",
  "birthdate": { "date": "1990-01-01" },
  "country_id": 245,
  "email": "john@example.com",
  "ie": null,
  "tributacao": null,
  "lojista": 0,
  "news_whatsapp": false,
  "news_sms": false,
  "filial_id": null,
  "ip": "189.111.87.175",
  "langId": 4,
  "from_store": "prata-print",
  "optin": true,
  "password": "SecurePass123!",
  "passwordConfirmation": "SecurePass123!",
  "recaptcha": "0cAFcWeA5Ju1HKV71RkTJj..."
}
```

**Response** (Success 200):
```json
{
  "data": {
    "id": 5204941,
    "email": "john@example.com",
    "first_name": "JOHN",
    "last_name": "DOE",
    ...
  }
}
```

**Response** (Error 422):
```json
{
  "message": "Erro ao validar reCaptcha. Atualiza a página. Se o erro persistir, entre em contato com o Atendimento."
}
```

**Country IDs**:
- Brazil: `245`
- Argentina: `41`
- United States: `243`
- Portugal: `183`
- Germany: `82`
- France: `75`
- Spain: `203`
- United Kingdom: `232`
- Canada: `39`
- Australia: `14`

---

### 2. Customer Login

**URL**: `POST https://prataprint.bhumisparshaschool.org/login.php?defaultGroup=1`

**Headers**:
```http
Content-Type: multipart/form-data
Origin: https://prataprint.bhumisparshaschool.org
```

**Form Data**:
```
email: john@example.com
password: SecurePass123!
```

**Response**: Sets `up_session` cookie on success.

---

### 3. Shipping Carriers

**URL**: `GET https://arcoiro.chicorei.com/umapenca/carriers`

**Query Parameters**:
- `cart` (required): Cart ID (e.g., `4911900`)
- `pais` (required): Country ID (e.g., `245` for Brazil, `41` for Argentina)
- `cep` (optional): Brazilian CEP (8 digits, with or without hyphen)
- `defaultGroup`: `1`

**Headers**:
```http
cr-api-auth: {api_key}
Origin: https://prataprint.bhumisparshaschool.org
```

**Example Request**:
```
GET /umapenca/carriers?cart=4911900&pais=245&cep=12313-131&defaultGroup=1
```

**Example Response**:
```json
{
  "data": {
    "id": 5204941,
    "cep": "12313131",
    "cep_validation": "909a6a2c3b94aadc...",
    "formated_cep": "12313-131",
    "is_jf": false,
    "min_shipping": null,
    "responses": [
      {
        "id": 25370930,
        "carrier_id": 45110,
        "frete_id": null,
        "name": "EMS",
        "price": 172.9,
        "price_real": "172.90",
        "weight": 0.3,
        "delivery_time": "5-7",
        "description": "Express delivery"
      },
      {
        "id": 25370931,
        "carrier_id": 45111,
        "name": "PAC",
        "price": 89.50,
        "price_real": "89.50",
        "weight": 0.3,
        "delivery_time": "10-15"
      }
    ]
  }
}
```

**International Shipping** (no CEP):
```
GET /umapenca/carriers?cart=4911900&pais=41&defaultGroup=1
```

Returns carriers for Argentina (country_id: 41) with international rates.

---

### 4. Checkout URL

**URL**: `GET https://prataprint.bhumisparshaschool.org/sacola/checkout`

**Query Parameters** (from JWT token):
- `token`: Signed JWT containing cart data
- `ref`: Source reference (e.g., `bhumi-shop`)

**Cookies Required**:
- `up_session`: User session
- `cep`: User's CEP (set during checkout flow)
- `country_id`: User's country ID

**Example**:
```
GET /sacola/checkout?token=eyJhbGciOiJIUzI1NiJ9...&ref=bhumi-shop
```

---

### 5. Cart Management

**Add to Cart** (via Facebook Pixel tracking):
```javascript
fbq('track', 'AddToCart', {
  content_ids: ["141324"],
  content_type: "product",
  content_category: "Camiseta",
  contents: [{ id: "141324", quantity: 1, item_price: 75.11 }],
  value: 75.11,
  currency: "BRL"
})
```

---

## Edge Functions (Our Implementation)

### 1. uma-penca-proxy
**Path**: `/functions/v1/uma-penca-proxy`

Creates signed JWT for checkout redirect.

**Request**:
```json
POST {
  "items": [
    { "id": 141324, "qty": 2, "size": "M" }
  ]
}
```

**Response**:
```json
{
  "url": "https://prataprint.bhumisparshaschool.org/sacola/checkout?token=JWT&ref=bhumi-shop",
  "expiresIn": "10m",
  "itemCount": 1
}
```

---

### 2. umapenca-prefill
**Path**: `/functions/v1/umapenca-prefill`

Generates JWT with user data for pre-filled registration.

**Request**:
```json
POST {
  "user": {
    "name": "John Doe",
    "email": "john@example.com",
    "phone": "11999999999",
    "cpf": "12345678901",
    "country": "BR",
    "address": "Rua Example",
    "number": "123",
    "city": "São Paulo",
    "state": "SP",
    "postalCode": "12313-131"
  },
  "redirect": true
}
```

**Response**:
```json
{
  "url": "https://prataprint.bhumisparshaschool.org/cadastrar?token=JWT&ref=bhumi-shop",
  "token": "eyJhbGciOiJIUzI1NiJ9...",
  "expiresIn": "30m",
  "message": "Redirect to UmaPenca registration"
}
```

---

### 3. uma-penca-shipping
**Path**: `/functions/v1/uma-penca-shipping`

Proxies requests to UmaPenca carriers API.

**Request**:
```json
POST {
  "cart_id": "4911900",
  "cep": "12313-131",
  "country_id": 245
}
```

**Response**:
```json
{
  "success": true,
  "cart_id": "4911900",
  "country_id": 245,
  "cep": "12313-131",
  "carriers": [
    {
      "id": 25370930,
      "name": "EMS",
      "price": 172.90,
      "price_real": "172.90",
      "weight": 0.3,
      "delivery_time": "5-7",
      "description": "Express delivery"
    },
    {
      "id": 25370931,
      "name": "PAC",
      "price": 89.50,
      "price_real": "89.50",
      "weight": 0.3,
      "delivery_time": "10-15"
    }
  ]
}
```

---

## reCAPTCHA v2 Invisible

**Site Key**: `6LeJ7boqAAAAAA6-1dOz7vaFaLuummobxGd5QXyb`

**Required for**: Customer registration endpoint.

**Domain Validation**: Tokens are validated against the domain where they were generated. Tokens from `localhost:8443` are rejected by UmaPenca API.

**Workaround**: Use JWT pre-fill approach where user completes registration on UmaPenca domain with pre-filled data.

---

## Important Notes

1. **Checkout URL Path**: Must use `/sacola/checkout`, NOT `/checkout`
2. **Payment Provider Value**: Use `'uma penca'` (with space), NOT `'uma_penca'`
3. **CEP Format**: Can be sent with or without hyphen, API normalizes
4. **Cart ID**: Obtained after adding items to cart on UmaPenca
5. **API Key**: Dynamic, extracted from storefront JavaScript bundles (`cr-api-auth` header)
6. **International Shipping**: Supported via `pais` parameter without `cep`

---

## Error Codes

| Status | Meaning |
|--------|---------|
| 200 | Success |
| 400 | Bad Request (missing required fields) |
| 422 | Validation Error (reCAPTCHA invalid, duplicate email, etc.) |
| 500 | Internal Server Error |

---

## Testing

### Test Registration Pre-fill
```bash
curl -X POST https://YOUR-PROJECT.supabase.co/functions/v1/umapenca-prefill \
  -H "Content-Type: application/json" \
  -d '{
    "user": {
      "name": "Test User",
      "email": "test@example.com",
      "phone": "11999999999",
      "country": "BR"
    }
  }'
```

### Test Shipping Carriers
```bash
curl -X POST https://YOUR-PROJECT.supabase.co/functions/v1/uma-penca-shipping \
  -H "Content-Type: application/json" \
  -d '{
    "cart_id": "4911900",
    "cep": "12313-131",
    "country_id": 245
  }'
```

### Test Checkout Redirect
```bash
curl -X POST https://YOUR-PROJECT.supabase.co/functions/v1/uma-penca-proxy \
  -H "Content-Type: application/json" \
  -d '{
    "items": [
      { "id": 141324, "qty": 1 }
    ]
  }'
```
