// ─────────────────────────────────────────────────────────────────────────────
// MatchCalendar.jsx – Horizontal date strip + ATP/WTA tour filter pills
//
// NEW IN THIS VERSION:
//  + 30-day window (14 past, today, 15 future)
//  + Green dot indicators on dates that have stored matches in Supabase
//  + ATP / WTA / All filter pills — emits tourFilter to parent
//  + Fires today's date on mount so the parent loads data immediately
//  + Past dates dimmed slightly; today always highlighted
//  + Timezone-safe: uses local date comparison, not UTC
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useRef, useEffect, useMemo } from 'react';
import { useActiveDates } from '../hooks/hooks';

export default function MatchCalendar({ onSelectDate, onTourFilter }) {
  // Build today at midnight local time — avoids UTC off-by-one issues
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
  const [tourFilter, setTourFilter]     = useState('All'); // 'All' | 'ATP' | 'WTA'
  const scrollRef = useRef(null);

  // Fetch which dates have stored matches (for dot indicators)
  const { activeDates } = useActiveDates(windowStart, windowEnd);

  // Scroll "today" into center on mount
  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current.querySelector('[data-today="true"]');
      el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, []);

  // Fire today on mount so the parent immediately loads today's matches
  useEffect(() => {
    const str = toDateStr(today);
    onSelectDate?.(today, str);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toDateStr(d) {
    // Local YYYY-MM-DD — avoids UTC shift
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

  function isPast(d) {
    return d < today;
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

      {/* ── ATP / WTA / All filter pills ─────────────────────────────────── */}
      <div style={{
        display: 'flex', gap: '8px', marginBottom: '14px',
        flexWrap: 'wrap', alignItems: 'center',
      }}>
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
                ? t === 'WTA' ? '#f472b6' : t === 'ATP' ? 'var(--lime)' : 'var(--lime)'
                : 'var(--bg-glass-md)',
              color: tourFilter === t ? '#070B14' : 'var(--text-muted)',
              fontFamily: 'var(--font-body)',
              fontWeight: 700,
              fontSize: '12px',
              cursor: 'pointer',
              transition: 'var(--t)',
              letterSpacing: '0.04em',
            }}
          >
            {t}
          </button>
        ))}
      </div>

      {/* ── Date strip ───────────────────────────────────────────────────── */}
      <div style={{ width: '100%', overflowX: 'hidden' }}>
        <div
          ref={scrollRef}
          style={{
            display: 'flex',
            gap: '8px',
            overflowX: 'auto',
            paddingBottom: '6px',
            scrollbarWidth: 'none',
            msOverflowStyle: 'none',
            WebkitOverflowScrolling: 'touch',
          }}
        >
          {dates.map((date, i) => {
            const isSelected = isSameDay(date, selectedDate);
            const isToday    = isSameDay(date, today);
            const past       = isPast(date) && !isToday;
            const dateStr    = toDateStr(date);
            const hasMatches = activeDates.has(dateStr);
            const dayName    = date.toLocaleDateString('en-US', { weekday: 'short' });
            const dayNum     = date.getDate();
            const monthName  = date.toLocaleDateString('en-US', { month: 'short' });

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
                  minWidth:       '60px',
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
                  cursor:         'pointer',
                  transition:     'var(--t)',
                  outline:        'none',
                  opacity:        past && !isSelected ? 0.5 : 1,
                  fontFamily:     'var(--font-body)',
                }}
              >
                {/* Day name */}
                <span style={{
                  fontSize: '10px', fontWeight: 700,
                  letterSpacing: '0.07em', textTransform: 'uppercase',
                  color: isSelected || isToday ? 'var(--lime)' : 'var(--text-faint)',
                }}>
                  {isToday ? 'TODAY' : dayName}
                </span>

                {/* Day number */}
                <span style={{
                  fontSize: '20px', fontWeight: 700,
                  fontFamily: 'var(--font-display)',
                  color: isSelected ? 'var(--lime)' : 'var(--text)',
                  lineHeight: 1,
                }}>
                  {dayNum}
                </span>

                {/* Month */}
                <span style={{
                  fontSize: '10px', fontWeight: 500,
                  letterSpacing: '0.05em', textTransform: 'uppercase',
                  color: 'var(--text-faint)',
                }}>
                  {monthName}
                </span>

                {/* Dot indicator — green if matches exist, faint dot placeholder otherwise */}
                <span style={{
                  width: '5px', height: '5px',
                  borderRadius: '50%',
                  background: hasMatches
                    ? 'var(--lime)'
                    : 'rgba(255,255,255,0.08)',
                  marginTop: '2px',
                  transition: 'background 0.25s',
                  flexShrink: 0,
                }} />
              </button>
            );
          })}
        </div>
        <style>{`div::-webkit-scrollbar { display: none; }`}</style>
      </div>
    </div>
  );
}