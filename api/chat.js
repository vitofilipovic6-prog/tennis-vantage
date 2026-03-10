// ─────────────────────────────────────────────────────────────────────────────
// api/chat.js  ← place this at the PROJECT ROOT (same level as /src, not inside it)
//
// Vercel Edge Function — securely proxies requests to the Google Gemini API.
// Your GEMINI_API_KEY never touches the browser.
//
// ⚠️  ONE-TIME SETUP — Add your key to Vercel:
//     Vercel Dashboard → Your Project → Settings → Environment Variables
//     Name:  GEMINI_API_KEY
//     Value: (paste your key from Supabase)
//     Apply to: Production ✓  Preview ✓  Development ✓
//     → Save, then Redeploy.
// ─────────────────────────────────────────────────────────────────────────────

export const config = {
  runtime: 'edge',
};

const GEMINI_MODEL = 'gemini-1.5-flash'; // fast, cheap, excellent for chat

export default async function handler(req) {
  // ── CORS preflight (needed if you ever call from a different origin) ────────
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin':  '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  if (req.method !== 'POST') {
    return new Response(JSON.stringify({ error: 'Method not allowed' }), {
      status: 405,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Parse request body ──────────────────────────────────────────────────────
  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const { messages, systemContext } = body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response(JSON.stringify({ error: 'messages array is required' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Validate API key ────────────────────────────────────────────────────────
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY is not set in Vercel environment variables');
    return new Response(JSON.stringify({ error: 'AI service is not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Convert from OpenAI/Anthropic message format → Gemini format ────────────
  // Our frontend sends: [{ role: 'user'|'assistant', content: '...' }]
  // Gemini expects:     [{ role: 'user'|'model',     parts: [{ text: '...' }] }]
  const geminiContents = messages.map(m => ({
    role:  m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  // ── Call Gemini ─────────────────────────────────────────────────────────────
  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          // System instruction — gives the AI its tennis analyst persona
          system_instruction: {
            parts: [{
              text: systemContext && systemContext.trim()
                ? systemContext
                : 'You are a professional tennis analyst. Provide insightful, accurate, data-driven tennis analysis. Be concise and engaging.',
            }],
          },
          contents: geminiContents,
          generationConfig: {
            temperature:     0.7,
            maxOutputTokens: 1024,
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('Gemini API error:', geminiRes.status, errText);
      return new Response(
        JSON.stringify({ error: 'Gemini API error', detail: geminiRes.status }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const geminiData = await geminiRes.json();

    // Extract the text response from Gemini's nested response structure
    const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      console.error('Unexpected Gemini response shape:', JSON.stringify(geminiData));
      return new Response(
        JSON.stringify({ error: 'Unexpected response from Gemini' }),
        { status: 502, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // ── Return in the shape the frontend already expects ─────────────────────
    // { content: [{ text: '...' }] }  ← same as Anthropic format our hooks use
    return new Response(
      JSON.stringify({ content: [{ text }] }),
      {
        status: 200,
        headers: {
          'Content-Type':                'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );

  } catch (err) {
    console.error('Unexpected error in /api/chat:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}