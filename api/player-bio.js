// ─────────────────────────────────────────────────────────────────────────────
// api/player-bio.js
// ─────────────────────────────────────────────────────────────────────────────

const GEMINI_MODEL          = 'gemini-2.5-flash';
const GEMINI_MODEL_FALLBACK = 'gemini-2.0-flash';

async function callGemini(apiKey, model, prompt) {
  return fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
    {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        system_instruction: {
          parts: [{
            text: 'You are a professional tennis statistics database. Always respond with valid JSON only. No markdown fences. No explanations. No extra text. Just the raw JSON object.',
          }],
        },
        contents: [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: {
          temperature:     0.3,
          maxOutputTokens: 2048,
          topP:            0.8,
          // NOTE: no responseMimeType — not universally supported, causes empty responses
        },
      }),
    }
  );
}

function buildPrompt(player) {
  return `Generate comprehensive stats and analysis for this tennis player.

Player: ${player.name}
Country: ${player.country ?? 'Unknown'}
Current Rank: ${player.rank && player.rank < 999 ? `#${player.rank}` : 'Unknown'}
Surface preference: ${player.surface_pref ?? 'Unknown'}

Respond ONLY with this JSON object, no markdown, no extra text:
{
  "full_name": "full official name",
  "turned_pro": "year as string e.g. '2015'",
  "plays": "Right-handed or Left-handed",
  "height": "e.g. 185 cm / 6'1\\"",
  "coach": "current coach name or null",
  "career_titles": 0,
  "peak_rank": 1,
  "career_win_pct": 80,
  "grand_slams": {
    "total_titles": 0,
    "australian_open": 0,
    "french_open": 0,
    "wimbledon": 0,
    "us_open": 0
  },
  "current_season": {
    "wins": 0,
    "losses": 0,
    "titles": 0,
    "form": "W W L W W"
  },
  "surface_stats": {
    "clay":  { "win_pct": 70, "titles": 0 },
    "hard":  { "win_pct": 75, "titles": 0 },
    "grass": { "win_pct": 65, "titles": 0 }
  },
  "playing_style": "description here",
  "strengths": ["strength 1", "strength 2", "strength 3"],
  "weaknesses": ["weakness 1", "weakness 2"],
  "best_rivals": [
    { "name": "rival name", "h2h": "14-12 in favor of ${player.name}" }
  ],
  "career_highlight": "most impressive career achievement"
}`;
}

function extractJson(text) {
  if (!text) throw new Error('Empty response from Gemini');

  // Try direct parse first
  try {
    return JSON.parse(text.trim());
  } catch {}

  // Strip markdown fences
  const stripped = text
    .replace(/```json\s*/gi, '')
    .replace(/```\s*/gi, '')
    .trim();

  try {
    return JSON.parse(stripped);
  } catch {}

  // Find first { ... } block
  const start = text.indexOf('{');
  const end   = text.lastIndexOf('}');
  if (start !== -1 && end !== -1 && end > start) {
    try {
      return JSON.parse(text.slice(start, end + 1));
    } catch {}
  }

  throw new Error('Could not parse JSON from Gemini response');
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin',  '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST')   return res.status(405).json({ error: 'Method not allowed' });

  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return res.status(503).json({ error: 'AI service not configured' });

  const { player } = req.body ?? {};
  if (!player?.name) return res.status(400).json({ error: 'player.name is required' });

  const prompt = buildPrompt(player);

  try {
    // Try primary model
    let geminiRes = await callGemini(apiKey, GEMINI_MODEL, prompt);

    // Fallback on quota exceeded
    if (geminiRes.status === 429) {
      console.warn('[/api/player-bio] flash quota exceeded — trying 2.0-flash fallback');
      geminiRes = await callGemini(apiKey, GEMINI_MODEL_FALLBACK, prompt);
    }

    if (!geminiRes.ok) {
      const errText = await geminiRes.text();
      console.error('[/api/player-bio] Gemini error:', geminiRes.status, errText);
      return res.status(502).json({ error: 'Gemini API error', status: geminiRes.status });
    }

    const geminiData = await geminiRes.json();
    const text = geminiData?.candidates?.[0]?.content?.parts?.[0]?.text ?? '';

    console.log('[/api/player-bio] raw response length:', text.length);

    const parsed = extractJson(text);
    return res.status(200).json({ data: parsed });

  } catch (err) {
    console.error('[/api/player-bio] error:', err.message);
    return res.status(500).json({ error: err.message });
  }
};