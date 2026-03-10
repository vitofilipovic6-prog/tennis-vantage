// api/chat.js — Vercel Edge Function
// Place at PROJECT ROOT (same level as /src)
// Securely proxies requests to Google Gemini. Key never touches the browser.

export const config = { runtime: 'edge' };

const GEMINI_MODEL = 'gemini-2.5-flash'; // ← fixed: was gemini-2.0-flash (429 quota)

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
    console.error('GEMINI_API_KEY is not set in Vercel environment variables');
    return new Response(JSON.stringify({ error: 'AI service is not configured' }), {
      status: 503,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  // Convert { role: 'user'|'assistant', content } → Gemini { role: 'user'|'model', parts }
  const geminiContents = messages.map(m => ({
    role:  m.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: m.content }],
  }));

  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: {
            parts: [{
              text: systemContext?.trim()
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
    const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      console.error('Unexpected Gemini response shape:', JSON.stringify(geminiData));
      return new Response(
        JSON.stringify({ error: 'Unexpected response from Gemini' }),
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
    console.error('Unexpected error in /api/chat:', err);
    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}