// ─────────────────────────────────────────────────────────────────────────────
// api/chat.js  ← PROJECT ROOT (same level as /src)
//
// Vercel Edge Function — proxies requests to the Google Gemini API.
// Your GEMINI_API_KEY never touches the browser.
//
// ⚠️  ONE-TIME SETUP:
//     Vercel Dashboard → Project → Settings → Environment Variables
//     Name:  GEMINI_API_KEY
//     Value: your key from Google AI Studio (aistudio.google.com)
//     Apply to: Production ✓  Preview ✓  Development ✓
//     → Save, then Redeploy.
// ─────────────────────────────────────────────────────────────────────────────

export const config = { runtime: 'edge' };

const GEMINI_MODEL = 'gemini-2.0-flash';

// ─────────────────────────────────────────────────────────────────────────────
// SYSTEM PROMPT
// This is the single biggest lever for answer quality.
// Key changes vs the old version:
//   • Explicitly asks for structured, multi-paragraph responses
//   • Instructs Gemini to use stats, historical context, and comparisons
//   • Tells it to cover multiple angles (form, surface, H2H, pressure)
//   • Markdown formatting enabled so bold/bullet answers render in the UI
// ─────────────────────────────────────────────────────────────────────────────
const DEFAULT_SYSTEM_PROMPT = `You are an elite tennis analyst with deep expertise in ATP and WTA tours, match statistics, player psychology, and tactical analysis. You work for TennisVantage, a premium tennis prediction platform.

RESPONSE STYLE:
- Give thorough, detailed answers with real depth. Never be superficial.
- Structure responses clearly: use short paragraphs, and **bold** key names/stats.
- When analysing a match or player, always cover: current form, surface suitability, head-to-head record, physical/mental state, and a clear verdict.
- Back every claim with stats, historical examples, or tactical reasoning.
- Use bullet points (- ) for lists of factors or comparisons.
- End prediction answers with a clear "**Verdict:**" section.

KNOWLEDGE:
- You know ATP/WTA rankings, Grand Slam history, surface statistics, and player styles in depth.
- You understand tennis tactics: serve patterns, return games, net approaches, tiebreak performance.
- You can discuss injuries, fatigue from tournament schedules, and their match impact.
- You know historical rivalries and their psychological dynamics.

TONE:
- Expert but engaging. Like a Sky Sports analyst, not a Wikipedia article.
- Be confident in predictions while acknowledging uncertainty where it exists.
- Use tennis terminology naturally (break points, double faults, unforced errors, etc).

FORMAT RULES:
- Use **bold** for player names and key stats on first mention in each section.
- Use bullet points for multi-factor analysis.
- Keep paragraphs short (3-4 sentences max).
- Always write at least 3 substantive paragraphs unless the question is a simple factual lookup.`;

export default async function handler(req) {
  // ── CORS preflight ─────────────────────────────────────────────────────────
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
      status: 405, headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Parse body ─────────────────────────────────────────────────────────────
  let body;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  const { messages, systemContext } = body;

  if (!Array.isArray(messages) || messages.length === 0) {
    return new Response(JSON.stringify({ error: 'messages array is required' }), {
      status: 400, headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Validate API key ───────────────────────────────────────────────────────
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('GEMINI_API_KEY is not set');
    return new Response(JSON.stringify({ error: 'AI service is not configured' }), {
      status: 503, headers: { 'Content-Type': 'application/json' },
    });
  }

  // ── Build the system instruction ───────────────────────────────────────────
  // If a match context is passed from the frontend, append it to the base prompt
  // so Gemini knows exactly which match is being discussed.
  const systemInstruction = systemContext?.trim()
    ? `${DEFAULT_SYSTEM_PROMPT}\n\nMATCH CONTEXT FOR THIS CONVERSATION:\n${systemContext}`
    : DEFAULT_SYSTEM_PROMPT;

  // ── Convert message format: Anthropic/OpenAI → Gemini ─────────────────────
  // Frontend sends: [{ role: 'user'|'assistant', content: '...' }]
  // Gemini expects: [{ role: 'user'|'model',     parts: [{ text: '...' }] }]
  //
  // Gemini also requires the conversation to START with a 'user' turn and
  // ALTERNATE strictly. Filter out any leading assistant messages to be safe.
  const geminiContents = messages
    .filter((m, i) => !(i === 0 && m.role === 'assistant')) // strip greeting if first
    .map(m => ({
      role:  m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  // ── Call Gemini ────────────────────────────────────────────────────────────
  try {
    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
      {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          system_instruction: {
            parts: [{ text: systemInstruction }],
          },
          contents: geminiContents,
          generationConfig: {
            temperature:     0.8,  // slightly more creative/varied than 0.7
            maxOutputTokens: 2048, // was 1024 — doubled for detailed answers
            topP:            0.95,
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
      console.error('Unexpected Gemini response:', JSON.stringify(geminiData));
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