// ─────────────────────────────────────────────────────────────────────────────
// api/chat.js  ← PROJECT ROOT
// ─────────────────────────────────────────────────────────────────────────────

const GEMINI_MODEL         = 'gemini-2.5-flash';
const GEMINI_MODEL_FALLBACK = 'gemini-1.5-flash'; // free tier fallback

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

// ── Call Gemini with a specific model ────────────────────────────────────────
async function callGemini(apiKey, model, systemInstruction, geminiContents) {
  const res = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: { parts: [{ text: systemInstruction }] },
        contents: geminiContents,
        generationConfig: {
          temperature: 0.8,
          maxOutputTokens: 2048,
          topP: 0.95,
        },
      }),
    }
  );
  return res;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    console.error('[/api/chat] GEMINI_API_KEY is not set');
    return res.status(503).json({ error: 'AI service is not configured' });
  }

  const { messages, systemContext } = req.body ?? {};
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages array is required' });
  }

  const systemInstruction = systemContext?.trim()
    ? `${DEFAULT_SYSTEM_PROMPT}\n\nMATCH CONTEXT FOR THIS CONVERSATION:\n${systemContext}`
    : DEFAULT_SYSTEM_PROMPT;

  const geminiContents = messages
    .filter((m, i) => !(i === 0 && m.role === 'assistant'))
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  try {
    // ── Try primary model ───────────────────────────────────────────────────
    let geminiRes = await callGemini(apiKey, GEMINI_MODEL, systemInstruction, geminiContents);

    // ── If quota exceeded, try fallback model ───────────────────────────────
    if (geminiRes.status === 429) {
      console.warn(`[/api/chat] ${GEMINI_MODEL} quota exceeded — trying fallback ${GEMINI_MODEL_FALLBACK}`);
      geminiRes = await callGemini(apiKey, GEMINI_MODEL_FALLBACK, systemInstruction, geminiContents);
    }

    // ── If still failing ────────────────────────────────────────────────────
    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('[/api/chat] Gemini error:', geminiRes.status, errText);

      // Return a user-friendly 429 message instead of a raw 502
      if (geminiRes.status === 429) {
        return res.status(429).json({
          error: 'rate_limit',
          message: 'The AI analyst is taking a short break due to high demand. Please wait 30 seconds and try again.',
        });
      }

      return res.status(502).json({ error: 'Gemini API error', detail: geminiRes.status });
    }

    const geminiData = await geminiRes.json();
    const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text;

    if (!text) {
      console.error('[/api/chat] Unexpected Gemini response:', JSON.stringify(geminiData));
      return res.status(502).json({ error: 'Unexpected response from Gemini' });
    }

    return res.status(200).json({ content: [{ text }] });

  } catch (err) {
    console.error('[/api/chat] Unexpected error:', err);
    return res.status(500).json({ error: 'Internal server error' });
  }
};