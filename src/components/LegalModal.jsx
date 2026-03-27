// src/components/LegalModal.jsx
// ─────────────────────────────────────────────────────────────────────────────
// Lightweight modal for Privacy Policy, Terms of Service, and Contact page.
// Matches TennisVantage dark design system exactly. Centered via Flexbox.
// ─────────────────────────────────────────────────────────────────────────────
import { useEffect } from 'react';

const CONTENT = {
  privacy: {
    title: 'Privacy Policy',
    icon: '🔒',
    lastUpdated: 'March 2025',
    sections: [
      {
        heading: 'Overview',
        body: 'TennisVantage ("we", "our", or "us") is a university project created for educational purposes. We are committed to being transparent about the limited data we collect and how it is used.',
      },
      {
        heading: 'Data We Collect',
        body: null,
        bullets: [
          'Email address and display name — collected when you create an account via Supabase Auth',
          'OAuth data — if you sign in with Google, we receive your public profile (name, email, avatar)',
          'Favourite players list — stored in your profile in our Supabase database',
          'Usage data — Supabase and Vercel may collect anonymised analytics',
        ],
      },
      {
        heading: 'Data We Do NOT Collect',
        body: null,
        bullets: [
          'Payment information of any kind — TennisVantage is free',
          'Precise location data',
          'Device identifiers or advertising IDs',
          'Any data sold or shared with third-party advertisers',
        ],
      },
      {
        heading: 'How We Use Your Data',
        body: 'Your email is used solely for authentication. Your profile data is used to personalise your experience. We do not send marketing emails.',
      },
      {
        heading: 'Third-Party Services',
        body: null,
        bullets: [
          'Supabase — database and auth (supabase.com/privacy)',
          'Vercel — hosting (vercel.com/legal/privacy-policy)',
          'Google OAuth — optional sign-in only',
          'RapidAPI (Tennis API) — live match data',
          'Google Gemini — AI predictions (anonymised match data only)',
        ],
      },
      {
        heading: 'Data Retention & Deletion',
        body: 'You may delete your account at any time. Upon deletion, data is removed from our database within 30 days.',
      },
      {
        heading: 'Cookies',
        body: 'We use only essential cookies for authentication. No tracking or advertising cookies.',
      },
      {
        heading: 'Contact',
        body: 'For privacy questions, please use the Contact page or email the address listed there.',
      },
    ],
  },
  terms: {
    title: 'Terms of Service',
    icon: '📄',
    lastUpdated: 'March 2025',
    sections: [
      {
        heading: 'About TennisVantage',
        body: 'TennisVantage is a university final-year project developed at Elektrotehnička škola Split. It is free with no commercial intent.',
      },
      {
        heading: 'Acceptance of Terms',
        body: 'By using TennisVantage, you agree to these terms. If you do not agree, please do not use the service.',
      },
      {
        heading: 'Permitted Use',
        body: null,
        bullets: [
          'Personal, non-commercial purposes only',
          'Must be at least 13 years old',
          'Responsible for your own account security',
          'No scraping, abuse, or reverse-engineering',
        ],
      },
      {
        heading: 'AI Predictions Disclaimer',
        body: 'Predictions by Google Gemini are for entertainment only. They are not professional advice or gambling recommendations. Inaccuracy is possible.',
      },
      {
        heading: 'Data Accuracy',
        body: 'Live data is sourced from third-party APIs "as-is". We do not warrant accuracy or completeness.',
      },
      {
        heading: 'Intellectual Property',
        body: 'Codebase and design are original work. Player names and trademarks belong to their respective owners (ATP/WTA).',
      },
      {
        heading: 'Limitation of Liability',
        body: 'Provided "as is" without warranty. We are not liable for damages, data loss, or service interruptions.',
      },
      {
        heading: 'Service Availability',
        body: 'As a student project, the site may be modified or taken offline at any time without notice.',
      },
      {
        heading: 'Changes to Terms',
        body: 'We may update these terms at any time. Continued use constitutes acceptance.',
      },
    ],
  },
  contact: {
    title: 'Contact',
    icon: '✉️',
    lastUpdated: null,
    sections: [
      {
        heading: 'About This Project',
        body: 'TennisVantage is a final-year "završni rad" developed at Elektrotehnička škola Split, Croatia, demonstrating modern full-stack development.',
      },
      {
        heading: 'Project Author',
        body: null,
        card: {
          name: 'Vito',
          school: 'Elektrotehnička škola Split',
          programme: 'Tehničar za računalstvo',
          mentor: 'Marin Ivandić',
          year: '2024 / 2025',
        },
      },
      {
        heading: 'Get in Touch',
        body: 'For technical feedback or academic enquiries, please reach out via the school.',
      },
      {
        heading: 'Tech Stack',
        body: null,
        bullets: [
          'Frontend: React 18 + Vite (Vercel)',
          'Backend: Supabase (Auth + DB + Functions)',
          'Data: RapidAPI Tennis API',
          'AI: Google Gemini 1.5 Flash',
          'Flags: flagcdn.com',
        ],
      },
      {
        heading: 'Feedback',
        body: 'Feedback on bugs or functionality is appreciated as part of the project evaluation process.',
      },
    ],
  },
};

export default function LegalModal({ page, onClose }) {
  const content = CONTENT[page];

  // ESC to close
  useEffect(() => {
    const fn = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', fn);
    return () => window.removeEventListener('keydown', fn);
  }, [onClose]);

  // Lock body scroll logic
  useEffect(() => {
    const originalStyle = window.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    return () => (document.body.style.overflow = originalStyle);
  }, []);

  if (!content) return null;

  return (
    /* New Flexbox Wrapper: This handles the centering perfectly */
    <div 
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.8)',
        backdropFilter: 'blur(8px)',
        WebkitBackdropFilter: 'blur(8px)',
        padding: '16px', // Padding prevents modal hitting edges on small screens
      }}
    >
      {/* Modal Container */}
      <div 
        onClick={(e) => e.stopPropagation()} // Important: Prevents closing when clicking modal content
        style={{
          width: 'min(680px, 100%)',
          maxHeight: 'min(800px, 85dvh)',
          display: 'flex',
          flexDirection: 'column',
          background: 'var(--bg-card, #111)',
          border: '1px solid var(--border-md, #333)',
          borderRadius: 'var(--radius-lg, 16px)',
          boxShadow: '0 40px 100px rgba(0,0,0,0.8), 0 0 60px rgba(159,239,102,0.05)',
          animation: 'tv-pop 0.35s cubic-bezier(0.34,1.56,0.64,1) both',
          overflow: 'hidden',
          position: 'relative'
        }}
      >
        {/* Sticky header */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          padding: '20px 24px',
          borderBottom: '1px solid var(--border, #222)',
          flexShrink: 0,
          background: 'var(--bg-card, #111)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
            <span style={{ fontSize: '26px' }}>{content.icon}</span>
            <div>
              <h2 style={{
                fontFamily: 'var(--font-display, sans-serif)', fontWeight: 800,
                fontSize: 'clamp(18px, 4vw, 22px)',
                letterSpacing: '-0.02em', margin: 0, color: '#fff'
              }}>
                {content.title}
              </h2>
              {content.lastUpdated && (
                <p style={{ fontSize: '11px', color: 'var(--text-faint, #666)', margin: '2px 0 0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Last updated: {content.lastUpdated}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            style={{
              width: '32px', height: '32px', borderRadius: '50%',
              background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
              color: '#fff', cursor: 'pointer', flexShrink: 0,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: '14px', transition: 'all 0.2s ease',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'rgba(248,113,113,0.15)'; e.currentTarget.style.color = '#f87171'; e.currentTarget.style.borderColor = 'rgba(248,113,113,0.3)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'rgba(255,255,255,0.05)'; e.currentTarget.style.color = '#fff'; e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'; }}
          >
            ✕
          </button>
        </div>

        {/* Scrollable body */}
        <div style={{
          overflowY: 'auto',
          padding: '28px 24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '28px',
          WebkitOverflowScrolling: 'touch',
        }}>
          {content.sections.map((section, i) => (
            <div key={i}>
              <h3 style={{
                fontFamily: 'var(--font-display, sans-serif)', fontWeight: 700,
                fontSize: '14px', color: 'var(--lime, #9fef66)',
                letterSpacing: '0.02em', marginBottom: '12px',
                display: 'flex', alignItems: 'center', gap: '10px',
                textTransform: 'uppercase'
              }}>
                <span style={{
                  width: '3px', height: '14px', borderRadius: '2px',
                  background: 'var(--lime, #9fef66)', flexShrink: 0,
                }} />
                {section.heading}
              </h3>

              {section.body && (
                <p style={{
                  fontSize: '14px', color: 'rgba(255,255,255,0.7)',
                  lineHeight: 1.7, margin: 0, fontWeight: 400
                }}>
                  {section.body}
                </p>
              )}

              {section.bullets && (
                <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '10px' }}>
                  {section.bullets.map((b, j) => (
                    <li key={j} style={{
                      display: 'flex', alignItems: 'flex-start', gap: '12px',
                      fontSize: '14px', color: 'rgba(255,255,255,0.7)', lineHeight: 1.6,
                    }}>
                      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--lime, #9fef66)" strokeWidth="3" style={{ flexShrink: 0, marginTop: '3px' }}>
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      {b}
                    </li>
                  ))}
                </ul>
              )}

              {section.card && (
                <div style={{
                  padding: '20px',
                  background: 'rgba(159,239,102,0.04)',
                  border: '1px solid rgba(159,239,102,0.12)',
                  borderRadius: '12px',
                  display: 'grid',
                  gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))',
                  gap: '16px',
                }}>
                  {[
                    { label: 'Author',      value: section.card.name      },
                    { label: 'School',      value: section.card.school     },
                    { label: 'Programme',   value: section.card.programme  },
                    { label: 'Mentor',      value: section.card.mentor     },
                    { label: 'School Year', value: section.card.year       },
                  ].map(row => (
                    <div key={row.label}>
                      <p style={{ fontSize: '9px', fontWeight: 800, color: 'rgba(255,255,255,0.3)', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '4px' }}>
                        {row.label}
                      </p>
                      <p style={{ fontSize: '14px', fontWeight: 600, color: '#fff', margin: 0 }}>
                        {row.value}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
          <div style={{ height: '1px' }} />
        </div>
      </div>
      
      {/* Required CSS for the animation */}
      <style>{`
        @keyframes tv-pop {
          0% { transform: scale(0.96) translateY(10px); opacity: 0; }
          100% { transform: scale(1) translateY(0); opacity: 1; }
        }
      `}</style>
    </div>
  );
}