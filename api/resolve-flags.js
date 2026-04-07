// ─────────────────────────────────────────────────────────────────────────────
// api/resolve-flags.js
// Uses Gemini to resolve nationality/country codes for doubles player name pairs
// when the DB country data is missing or incomplete.
// ─────────────────────────────────────────────────────────────────────────────

const GEMINI_MODEL          = 'gemini-2.5-flash';
const GEMINI_MODEL_FALLBACK = 'gemini-2.0-flash';

async function callGemini(apiKey, model, prompt) {
  return fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: {
          parts: [{
            text: 'You are a professional tennis database. You know the nationality of every ATP and WTA tennis player. Respond ONLY with valid JSON. No markdown, no backticks, no preamble.',
          }],
        },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.1,
          maxOutputTokens: 1024,
        },
      }),
    }
  );
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'AI service not configured' });

  const { players } = req.body ?? {};
  // players = array of { name: "A. Smith / B. Jones", id: "..." }
  if (!Array.isArray(players) || players.length === 0) {
    return res.status(400).json({ error: 'players array is required' });
  }

  // Build prompt asking Gemini to return ISO3 country codes for each half-name
  const playerList = players
    .map((p, i) => {
      const halves = p.name.split('/').map(n => n.trim());
      return `${i}: "${halves[0]}" and "${halves[1]}"`;
    })
    .join('\n');

  const prompt = `For each doubles tennis pair below, return the 3-letter ATP/WTA country code for each player.
Use standard ATP/WTA codes (e.g. ESP, USA, GBR, ARG, ITA, FRA, AUS, GER, SUI, etc).
If unknown, use "UNK".

Pairs:
${playerList}

Respond with ONLY this JSON structure, no extra text:
{
  "results": [
    { "index": 0, "player1_country": "ESP", "player2_country": "ARG" },
    ...
  ]
}`;

  try {
    let geminiRes = await callGemini(apiKey, GEMINI_MODEL, prompt);

    if (geminiRes.status === 429) {
      geminiRes = await callGemini(apiKey, GEMINI_MODEL_FALLBACK, prompt);
    }

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('[/api/resolve-flags] Gemini error:', geminiRes.status, errText);
      return res.status(502).json({ error: 'Gemini API error' });
    }

    const geminiData = await geminiRes.json();
    const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    // Parse JSON
    const cleaned = text.replace(/```json\s*/gi, '').replace(/```/g, '').trim();
    const parsed = JSON.parse(cleaned);

    if (!Array.isArray(parsed?.results)) {
      return res.status(502).json({ error: 'Unexpected Gemini response format' });
    }

    // Map results back to player IDs
    const flagMap = {};
    for (const r of parsed.results) {
      const originalPlayer = players[r.index];
      if (originalPlayer?.id) {
        const c1 = r.player1_country ?? 'UNK';
        const c2 = r.player2_country ?? 'UNK';
        flagMap[originalPlayer.id] = {
          country: c1 !== 'UNK' || c2 !== 'UNK'
            ? `${c1 !== 'UNK' ? c1 : ''}/${c2 !== 'UNK' ? c2 : ''}`
            : '',
          player1_country: c1,
          player2_country: c2,
        };
      }
    }

    return res.status(200).json({ flagMap });

  } catch (err) {
    console.error('[/api/resolve-flags] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};