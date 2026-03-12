// src/components/MatchCalendar.jsx
// ─────────────────────────────────────────────────────────────────────────────
// FIXES vs original:
//  + 30-day window (14 past, today, 15 future) instead of 15 days
//  + Removed overflow:hidden from wrapper — was clipping the scroll strip
//  + Green dot on dates that have matches in Supabase (useActiveDates)
//  + ATP / WTA / All tour filter pills — emits choice via onTourFilter prop
//  + Fires today's date on mount so parent loads immediately (no blank screen)
//  + Past dates dimmed at 50% opacity
//  + Timezone-safe date comparison (local midnight, not UTC)
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useRef, useEffect, useMemo } from 'react';
import { useActiveDates } from '../hooks/hooks';

export default function MatchCalendar({ onSelectDate, onTourFilter }) {
  // Build today at local midnight — avoids UTC off-by-one on the date strip
  const todayRef = useRef((() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  })());
  const today = todayRef.current;

  // 30-day window: 14 days before today through 15 days after
  const dates = useMemo(() => Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - 14 + i);
    return d;
  }), [today]);

  const windowStart = dates[0];
  const windowEnd   = dates[dates.length - 1];

  const [selectedDate, setSelectedDate] = useState(today);
  const [tourFilter, setTourFilter]     = useState('All');
  const scrollRef = useRef(null);

  const { activeDates } = useActiveDates(windowStart, windowEnd);

  // Scroll today into centre of strip on mount
  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current.querySelector('[data-today="true"]');
      el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, []);

  // Fire today immediately on mount so MatchesTab loads without waiting for a click
  useEffect(() => {
    onSelectDate?.(today, toDateStr(today));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toDateStr(d) {
    const y  = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const dy = String(d.getDate()).padStart(2, '0');
    return `${y}-${mo}-${dy}`;
  }

  function isSameDay(a, b) {
    return (
      a.getFullYear() === b.getFullYear() &&
      a.getMonth()    === b.getMonth()    &&
      a.getDate()     === b.getDate()
    );
  }

  function handleDateSelect(date) {
    setSelectedDate(date);
    onSelectDate?.(date, toDateStr(date));
  }

  function handleTourFilter(tour) {
    setTourFilter(tour);
    onTourFilter?.(tour);
  }

  return (
    <div style={{ width: '100%', marginBottom: '28px' }}>

      {/* ── Tour filter pills ─────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '14px', flexWrap: 'wrap', alignItems: 'center' }}>
        <span style={{
          fontSize: '11px', fontWeight: 700, letterSpacing: '0.08em',
          textTransform: 'uppercase', color: 'var(--text-faint)',
          alignSelf: 'center', marginRight: '4px',
        }}>
          Tour
        </span>
        {['All', 'ATP', 'WTA'].map(t => (
          <button
            key={t}
            onClick={() => handleTourFilter(t)}
            style={{
              padding: '5px 16px',
              borderRadius: '999px',
              border: tourFilter === t ? 'none' : '1px solid var(--border)',
              background: tourFilter === t
                ? t === 'WTA' ? '#f472b6' : 'var(--lime)'
                : 'var(--bg-glass-md)',
              color: tourFilter === t ? '#070B14' : 'var(--text-muted)',
              fontFamily: 'var(--font-body)',
              fontWeight: 700,
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'var(--t)',
              letterSpacing: '0.04em',
              WebkitTapHighlightColor: 'transparent',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── Date strip ───────────────────────────────────────────────────── */}
      {/* NOTE: outer div must NOT have overflow:hidden — it clips the scroll */}
      <div style={{ width: '100%' }}>
        <style>{`.tv-cal-strip::-webkit-scrollbar { display: none; }`}</style>
        <div
          ref={scrollRef}
          className="tv-cal-strip"
          style={{
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            paddingBottom: '6px',
            paddingTop: '2px',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {dates.map((date, i) => {
            const isSelected = isSameDay(date, selectedDate);
            const isToday    = isSameDay(date, today);
            const isPast     = date < today && !isToday;
            const dateStr    = toDateStr(date);
            const hasMatches = activeDates.has(dateStr);
            const dayName    = date.toLocaleDateString('en-US', { weekday: 'short' }).toUpperCase();
            const dayNum     = date.getDate();
            const monthName  = date.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();

            return (
              <button
                key={i}
                data-today={isToday ? 'true' : 'false'}
                onClick={() => handleDateSelect(date)}
                style={{
                  display:        'flex',
                  flexDirection:  'column',
                  alignItems:     'center',
                  justifyContent: 'center',
                  gap:            '3px',
                  flexShrink:     0,
                  minWidth:       '64px',
                  padding:        '10px 8px',
                  border: `1px solid ${
                    isSelected
                      ? 'rgba(159,239,102,0.5)'
                      : isToday
                        ? 'rgba(159,239,102,0.25)'
                        : 'var(--border)'
                  }`,
                  borderRadius:   'var(--radius-sm)',
                  background: isSelected
                    ? 'rgba(159,239,102,0.12)'
                    : isToday
                      ? 'rgba(159,239,102,0.05)'
                      : 'var(--bg-card)',
                  cursor:     'pointer',
                  transition: 'var(--t)',
                  outline:    'none',
                  opacity:    isPast && !isSelected ? 0.5 : 1,
                  fontFamily: 'var(--font-body)',
                  WebkitTapHighlightColor: 'transparent',
                }}
              >
                <span style={{
                  fontSize: '10px', fontWeight: 700,
                  letterSpacing: '0.07em', textTransform: 'uppercase',
                  color: isSelected || isToday ? 'var(--lime)' : 'var(--text-faint)',
                }}>
                  {isToday ? 'TODAY' : dayName}
                </span>

                <span style={{
                  fontSize: '20px', fontWeight: 700,
                  fontFamily: 'var(--font-display)',
                  color: isSelected ? 'var(--lime)' : 'var(--text)',
                  lineHeight: 1,
                }}>
                  {dayNum}
                </span>

                <span style={{
                  fontSize: '10px', fontWeight: 500,
                  letterSpacing: '0.05em', textTransform: 'uppercase',
                  color: 'var(--text-faint)',
                }}>
                  {monthName}
                </span>

                {/* Green dot if matches stored for this date, faint placeholder otherwise */}
                <span style={{
                  width: '5px', height: '5px',
                  borderRadius: '50%',
                  background: hasMatches ? 'var(--lime)' : 'rgba(255,255,255,0.08)',
                  marginTop: '2px',
                  transition: 'background 0.25s',
                  flexShrink: 0,
                }} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}