// supabase/functions/ai-chat/index.ts
// ─────────────────────────────────────────────────────────────────────────────
// AI Chat Edge Function — TennisVantage
// Calls Google Gemini API using the secret stored in Supabase.
// The key is NEVER sent to the browser — it only lives here on the server.
//
// Secret required in Supabase Dashboard → Project Settings → Edge Functions:
//   GEMINI_API_KEY  ← your Google AI Studio key
// ─────────────────────────────────────────────────────────────────────────────

const CORS_HEADERS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
};

// Gemini role mapping — Gemini uses "model" where everyone else uses "assistant"
function toGeminiRole(role: string): 'user' | 'model' {
  return role === 'assistant' ? 'model' : 'user';
}

Deno.serve(async (req: Request) => {
  // ── CORS pre-flight ────────────────────────────────────────────────────────
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  // ── Read API key from Supabase Secrets ─────────────────────────────────────
  const GEMINI_API_KEY = Deno.env.get('GEMINI_API_KEY');
  if (!GEMINI_API_KEY) {
    console.error('[ai-chat] GEMINI_API_KEY secret is not set');
    return new Response(
      JSON.stringify({ error: 'AI service is not configured. Add GEMINI_API_KEY to Supabase Secrets.' }),
      { status: 503, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  // ── Parse request body ─────────────────────────────────────────────────────
  let messages: Array<{ role: string; content: string }>;
  let systemContext: string;

  try {
    const body    = await req.json();
    messages      = body.messages      ?? [];
    systemContext = body.systemContext ?? 'You are a professional tennis analyst. Provide insightful, data-driven analysis.';
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  if (!messages.length) {
    return new Response(JSON.stringify({ error: 'messages array is empty' }), {
      status: 400,
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
    });
  }

  // ── Build Gemini `contents` array ──────────────────────────────────────────
  // Gemini requires the conversation to start with a "user" turn, so we strip
  // any leading "model" messages (the greeting) before sending.
  const geminiContents = messages
    .filter(m => m.content?.trim())
    .map(m => ({
      role:  toGeminiRole(m.role),
      parts: [{ text: m.content }],
    }));

  // Drop any leading model turns so the first turn is always "user"
  while (geminiContents.length && geminiContents[0].role === 'model') {
    geminiContents.shift();
  }

  if (!geminiContents.length) {
    return new Response(
      JSON.stringify({ error: 'No valid user messages to send.' }),
      { status: 400, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }

  // ── Call Gemini API ────────────────────────────────────────────────────────
  const GEMINI_MODEL = 'gemini-2.0-flash';
  const geminiUrl    = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${GEMINI_API_KEY}`;

  try {
    const geminiRes = await fetch(geminiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // systemInstruction injects the match context without polluting the
        // conversation history — this is the correct Gemini pattern.
        systemInstruction: {
          parts: [{ text: systemContext }],
        },
        contents: geminiContents,
        generationConfig: {
          maxOutputTokens: 512,
          temperature:     0.7,
        },
      }),
    });

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('[ai-chat] Gemini error', geminiRes.status, errText);
      return new Response(
        JSON.stringify({ error: `AI API error: ${geminiRes.status}` }),
        { status: 502, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
      );
    }

    const data = await geminiRes.json();

    // Gemini response shape:
    // { candidates: [{ content: { parts: [{ text: "..." }] } }] }
    const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
      ?? "Sorry, I couldn't generate a response right now.";

    // Return in the same shape the frontend already expects:
    // { content: [{ text: "..." }] }
    return new Response(
      JSON.stringify({ content: [{ text }] }),
      { status: 200, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );

  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[ai-chat] Unexpected error:', msg);
    return new Response(
      JSON.stringify({ error: 'Internal server error', detail: msg }),
      { status: 500, headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' } },
    );
  }
});