// ─────────────────────────────────────────────────────────────────────────────
// api/chat.js  ← project root (same level as /src)
// Vercel Edge Function — proxies requests to Google Gemini API.
// ─────────────────────────────────────────────────────────────────────────────

export const config = {
  runtime: 'edge',
};

const GEMINI_MODEL = 'gemini-2.0-flash';

export default async function handler(req) {
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

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    return new Response(JSON.stringify({ error: 'AI service is not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const geminiContents = messages.map(m => ({
    role:  m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  // ── Retry logic: attempt up to 2 times on transient failures ──────────────
  const MAX_RETRIES = 2;
  let lastError = null;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      // ── Per-attempt timeout: 25s (safely inside Vercel's 30s edge limit) ──
      const controller = new AbortController();
      const timeoutId  = setTimeout(() => controller.abort(), 25_000);

      const geminiRes = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
        {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          signal:  controller.signal,
          body: JSON.stringify({
            system_instruction: {
              parts: [{
                text: systemContext?.trim()
                  // Keep the system prompt tight so the model focuses on tennis
                  ? `${systemContext.trim()} Keep your answer focused and under 120 words unless the question genuinely requires more detail.`
                  : 'You are a professional tennis analyst. Give accurate, insightful, data-driven answers. Be concise — aim for 2-4 short paragraphs max.',
              }],
            },
            contents: geminiContents,
            generationConfig: {
              temperature:     0.65,
              // ── FIX: raised from 1024 → 2048 so responses never truncate ──
              maxOutputTokens: 2048,
              // Stop the model before it rambles — soft guide via stopSequences
              stopSequences:   [],
            },
          }),
        }
      );

      clearTimeout(timeoutId);

      if (!geminiRes.ok) {
        const errText = await geminiRes.text();
        // 429 = quota exceeded; 503 = model overloaded — both worth retrying
        if ((geminiRes.status === 429 || geminiRes.status === 503) && attempt < MAX_RETRIES) {
          lastError = `Gemini ${geminiRes.status}`;
          await new Promise(r => setTimeout(r, 800 * attempt)); // back-off
          continue;
        }
        console.error('Gemini API error:', geminiRes.status, errText);
        return new Response(
          JSON.stringify({ error: 'The AI service is temporarily unavailable. Please try again in a moment.' }),
          { status: 502, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const geminiData = await geminiRes.json();
      const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

      if (!text) {
        // Check finish reason — SAFETY means content was blocked
        const finishReason = geminiData?.candidates?.[0]?.finishReason;
        if (finishReason === 'SAFETY') {
          return new Response(
            JSON.stringify({ content: [{ text: "I can't answer that question. Try asking something else about tennis!" }] }),
            { status: 200, headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' } }
          );
        }
        console.error('Unexpected Gemini response shape:', JSON.stringify(geminiData).slice(0, 400));
        return new Response(
          JSON.stringify({ error: 'Unexpected response from AI. Please try again.' }),
          { status: 502, headers: { 'Content-Type': 'application/json' } }
        );
      }

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
      if (err.name === 'AbortError') {
        lastError = 'Request timed out';
        if (attempt < MAX_RETRIES) continue;
        return new Response(
          JSON.stringify({ error: 'The AI took too long to respond. Please try again.' }),
          { status: 504, headers: { 'Content-Type': 'application/json' } }
        );
      }
      lastError = err.message;
      if (attempt < MAX_RETRIES) continue;
    }
  }

  console.error('All retries failed:', lastError);
  return new Response(
    JSON.stringify({ error: 'Connection error. Please check your connection and try again.' }),
    { status: 500, headers: { 'Content-Type': 'application/json' } }
  );
}