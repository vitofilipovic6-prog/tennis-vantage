# 🎾 TennisVantage
### AI-Powered Tennis Match Predictor

> A production-grade React application built for university project.

---

## 🚀 Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Set up environment
cp .env.example .env   # then add your RapidAPI key

# 3. Start dev server
npm run dev
```

---

## 🏗️ Architecture

```
src/
├── services/
│   ├── supabase.js        ← Supabase client (your existing credentials)
│   └── tennisApi.js       ← Tennis API + AI stubs (swap mocks → real API here)
│
├── context/
│   └── AuthContext.jsx    ← Global auth state (useReducer, all Supabase patterns)
│
├── hooks/
│   └── hooks.js           ← useMatches · useRankings · usePrediction · useAiChat · useToast
│
├── components/
│   ├── ui.jsx             ← Design system: Btn · Input · Card · Badge · Logo · SocialBtn
│   ├── AuthLayout.jsx     ← Shared auth page wrapper
│   └── ToastContainer.jsx ← Notification system
│
├── pages/
│   ├── LandingPage.jsx    ← Hero · Features · CTA
│   ├── LoginPage.jsx      ← Email/pass + Google + Apple
│   ├── SignupPage.jsx     ← Registration with profiles insert
│   ├── ResetPage.jsx      ← Forgot password (email link)
│   └── Dashboard.jsx      ← Live Matches · Predictions · Rankings · AI Chat
│
├── App.jsx                ← Root router + auth gate
├── main.jsx               ← React entry
└── index.css              ← Design tokens (CSS variables) + animations
```

---

## 🎨 Design System

All tokens live in `src/index.css` as CSS custom properties:

| Token | Value | Usage |
|-------|-------|-------|
| `--lime` | `#9fef66` | Primary action, CTA buttons, highlights |
| `--clay` | `#f97316` | Secondary, Player 2 bars, surface badge |
| `--bg` | `#070B14` | App background |
| `--bg-card` | `#111827` | Card backgrounds |
| `--font-display` | Syne 800 | All headings |
| `--font-body` | DM Sans | Body text, buttons |
| `--font-mono` | JetBrains Mono | Scores, stats, percentages |

---

## 🔐 Auth Flow (Supabase)

Migrated from your MaturaPrep project. All original patterns preserved:

| Feature | Implementation |
|---------|----------------|
| Email/Password login | `supabase.auth.signInWithPassword()` |
| Registration | `supabase.auth.signUp()` + `profiles` table insert |
| Google OAuth | `signInWithOAuth({ provider: 'google', prompt: 'select_account' })` |
| Apple Sign-In | `signInWithOAuth({ provider: 'apple' })` |
| Forgot password | `supabase.auth.resetPasswordForEmail()` |
| Session restore | `getSession()` on mount |
| Auth listener | `onAuthStateChange()` with `userWasSignedIn` guard |
| OAuth hash cleanup | `history.replaceState()` after redirect |

### Supabase Table Required
```sql
-- Run in your Supabase SQL editor:
create table if not exists public.profiles (
  id        uuid references auth.users primary key,
  full_name text,
  avatar_url text,
  created_at timestamptz default now()
);

-- Enable Row Level Security
alter table public.profiles enable row level security;
create policy "Users can manage own profile"
  on public.profiles for all using (auth.uid() = id);
```

---

## 🎾 Tennis API Integration

**Recommended: API-Tennis on RapidAPI**
- URL: https://rapidapi.com/api-sports/api/api-tennis
- Free: 100 req/day | Pro: $10/mo

To activate:
1. Subscribe and grab your key
2. Add `VITE_RAPIDAPI_KEY=your_key` to `.env`
3. Open `src/services/tennisApi.js`
4. In each function, comment out the mock `return` and uncomment the `apiFetch()` call

---

## 🤖 AI Chat Integration

The chat UI and `useAiChat` hook are fully built. To connect a real model:

1. Open `src/services/tennisApi.js` → `sendChatMessage()`
2. Replace the mock with your API call:

```js
// Anthropic example:
const res = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-api-key': import.meta.env.VITE_ANTHROPIC_KEY,
    'anthropic-version': '2023-06-01',
  },
  body: JSON.stringify({
    model: 'claude-opus-4-6',
    max_tokens: 512,
    system: 'You are an expert tennis analyst. Answer concisely.',
    messages,
  }),
});
return res.json();
```

---

## 🗺️ Development Roadmap

- [ ] **Phase 1 (Done)**: Auth + Landing + Design System
- [ ] **Phase 2**: Wire real Tennis API, remove mocks
- [ ] **Phase 3**: Connect AI model to chat panel
- [ ] **Phase 4**: User saved matches, personal predictions history
- [ ] **Phase 5**: Tournament bracket view, head-to-head deep dive
- [ ] **Phase 6**: Push notifications for live match updates

---

## 🐛 Bug Fixes vs Original Project

| Original Issue | Fix Applied |
|----------------|-------------|
| Global state mutations (`let questions = []`) | `useReducer` in AuthContext, hook-local state everywhere |
| Memory leak: `setInterval` not cleaned up | `useEffect` cleanup returns `clearInterval(intervalRef.current)` |
| Double `addEventListener` on btn-start-confirm | Event listeners attached once in setup function |
| `document.getElementById` scattered | All DOM access replaced by React state/refs |
| No form validation feedback | Field-level error state with inline messages |
| Toast overwrites previous (single DOM node) | `useToast` queue with unique IDs |
| No loading state on OAuth buttons | Per-provider `oauthLoading` state |
| Spurious SIGNED_OUT on load | `userWasSignedIn` guard in `onAuthStateChange` |
