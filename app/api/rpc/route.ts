const PRIMARY = process.env.ALCHEMY_ETH_RPC;
const FALLBACK = process.env.INFURA_ETH_RPC;

async function tryRpc(url: string, body: string): Promise<{ ok: boolean; text: string }> {
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body,
    });
    const text = await res.text();
    // Alchemy (and similar) return non-JSON-RPC errors as plain JSON with an "error" key at the top level
    // but without a "jsonrpc" field — detect and treat as failure so we can fall back
    try {
      const parsed = JSON.parse(text);
      if (parsed.error && !parsed.jsonrpc) return { ok: false, text };
    } catch {
      return { ok: false, text };
    }
    return { ok: true, text };
  } catch {
    return { ok: false, text: '' };
  }
}

export async function POST(req: Request) {
  const body = await req.text();

  if (PRIMARY) {
    const result = await tryRpc(PRIMARY, body);
    if (result.ok) return new Response(result.text, { headers: { 'Content-Type': 'application/json' } });
  }

  if (FALLBACK) {
    const result = await tryRpc(FALLBACK, body);
    if (result.ok) return new Response(result.text, { headers: { 'Content-Type': 'application/json' } });
  }

  return Response.json(
    { jsonrpc: '2.0', error: { code: -32603, message: 'RPC unavailable' } },
    { status: 503 },
  );
}
