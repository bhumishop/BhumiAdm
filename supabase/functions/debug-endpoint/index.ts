import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
serve(async (req) => {
  const url = new URL(req.url)
  return new Response(JSON.stringify({
    url: url.pathname,
    path: url.pathname.split('/').filter(Boolean),
    method: req.method,
    origin: url.origin,
  }), { headers: { 'Content-Type': 'application/json' } })
})
