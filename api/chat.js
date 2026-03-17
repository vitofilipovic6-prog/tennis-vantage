// ─────────────────────────────────────────────────────────────────────────────
// api/chat.js  ← PROJECT ROOT
// ─────────────────────────────────────────────────────────────────────────────

const GEMINI_MODEL          = 'gemini-2.5-flash';
const GEMINI_MODEL_FALLBACK = 'gemini-2.0-flash';

const DEFAULT_SYSTEM_PROMPT = `You are a concise tennis analyst for TennisVantage, a premium ATP/WTA analytics app.

RULES:
- Keep every answer under 120 words. No exceptions.
- Lead with the key insight immediately — no preamble.
- Use plain text only. No markdown headers. Bold player names only.
- For predictions: one sentence verdict + 2-3 bullet stats. Done.
- For rankings/records: answer directly with the number/name. No elaboration unless asked.
- Never repeat the question back. Never say "Great question" or "Certainly".
- Cover ATP, WTA, Grand Slams, surfaces, head-to-head, and current form.`;

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
          temperature:     0.7,
          maxOutputTokens: 512,   // was 2048 — this was killing your context budget
          topP:            0.9,
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

  // Cap conversation history to last 10 messages to prevent token bloat
  const recentMessages = messages.slice(-10);

  const systemInstruction = systemContext?.trim()
    ? `${DEFAULT_SYSTEM_PROMPT}\n\nMATCH CONTEXT: ${systemContext}`
    : DEFAULT_SYSTEM_PROMPT;

  const geminiContents = recentMessages
    .filter((m, i) => !(i === 0 && m.role === 'assistant'))
    .map(m => ({
      role: m.role === 'assistant' ? 'model' : 'user',
      parts: [{ text: m.content }],
    }));

  try {
    let geminiRes = await callGemini(apiKey, GEMINI_MODEL, systemInstruction, geminiContents);

    if (geminiRes.status === 429) {
      console.warn(`[/api/chat] ${GEMINI_MODEL} quota exceeded — trying fallback`);
      geminiRes = await callGemini(apiKey, GEMINI_MODEL_FALLBACK, systemInstruction, geminiContents);
    }

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('[/api/chat] Gemini error:', geminiRes.status, errText);
      if (geminiRes.status === 429) {
        return res.status(429).json({
          error: 'rate_limit',
          message: 'AI analyst is busy. Please wait 30 seconds and try again.',
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