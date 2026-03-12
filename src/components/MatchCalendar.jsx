// src/components/MatchCalendar.jsx
import { useState, useRef, useEffect, useMemo } from 'react';
import { useActiveDates } from '../hooks/hooks';

export default function MatchCalendar({ onSelectDate, onTourFilter, tourFilter = 'All' }) {
  const todayRef = useRef((() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  })());
  const today = todayRef.current;

  const dates = useMemo(() => Array.from({ length: 30 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - 14 + i);
    return d;
  }), [today]);

  const windowStart = dates[0];
  const windowEnd   = dates[dates.length - 1];

  const [selectedDate, setSelectedDate] = useState(today);
  const scrollRef = useRef(null);
  const { activeDates } = useActiveDates(windowStart, windowEnd);

  // Scroll today into centre on mount
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      if (scrollRef.current) {
        const el = scrollRef.current.querySelector('[data-today="true"]');
        if (el) el.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  // Fire today immediately on mount
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

  return (
    <div style={{ width: '100%', marginBottom: '28px' }}>

      {/* ── Tour filter pills ── */}
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
            onClick={() => onTourFilter?.(t)}
            style={{
              padding: '5px 16px',
              borderRadius: '999px',
              border: tourFilter === t ? 'none' : '1px solid var(--border)',
              background: tourFilter === t
                ? t === 'WTA' ? '#f472b6' : t === 'All' ? 'var(--lime)' : 'var(--lime)'
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

      {/* ── Date strip ── */}
      {/* 
        KEY FIX for laptop scroll:
        - position: relative + overflow: visible on wrapper ensures no clipping
        - The scrollable div uses overflow-x: scroll (not auto) for reliable desktop behaviour
        - min-width: 0 prevents flex parent from squashing it
      */}
      <div style={{ position: 'relative', overflow: 'visible', minWidth: 0 }}>
        <style>{`
          .tv-cal-strip { -ms-overflow-style: none; scrollbar-width: none; }
          .tv-cal-strip::-webkit-scrollbar { display: none; }
          .tv-cal-btn:hover { border-color: rgba(159,239,102,0.4) !important; opacity: 1 !important; }
        `}</style>
        <div
          ref={scrollRef}
          className="tv-cal-strip"
          style={{
            display: 'flex',
            gap: '8px',
            overflowX: 'scroll',       /* scroll not auto — more reliable on desktop */
            paddingBottom: '8px',
            paddingTop: '2px',
            paddingLeft: '2px',
            paddingRight: '2px',
            WebkitOverflowScrolling: 'touch',
            cursor: 'grab',            /* visual hint on desktop that it's scrollable */
          }}
          /* Drag-to-scroll on desktop */
          onMouseDown={e => {
            const el = e.currentTarget;
            el.style.cursor = 'grabbing';
            el.style.userSelect = 'none';
            const startX = e.pageX - el.offsetLeft;
            const scrollLeft = el.scrollLeft;
            const onMove = ev => { el.scrollLeft = scrollLeft - (ev.pageX - el.offsetLeft - startX); };
            const onUp   = ()  => {
              el.style.cursor = 'grab';
              el.style.userSelect = '';
              window.removeEventListener('mousemove', onMove);
              window.removeEventListener('mouseup', onUp);
            };
            window.addEventListener('mousemove', onMove);
            window.addEventListener('mouseup', onUp);
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
                className="tv-cal-btn"
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
                  userSelect: 'none',
                }}
              >
                <span style={{
                  fontSize: '10px', fontWeight: 700,
                  letterSpacing: '0.07em', textTransform: 'uppercase',
                  color: isSelected || isToday ? 'var(--lime)' : 'var(--text-faint)',
                  pointerEvents: 'none',
                }}>
                  {isToday ? 'TODAY' : dayName}
                </span>

                <span style={{
                  fontSize: '20px', fontWeight: 700,
                  fontFamily: 'var(--font-display)',
                  color: isSelected ? 'var(--lime)' : 'var(--text)',
                  lineHeight: 1,
                  pointerEvents: 'none',
                }}>
                  {dayNum}
                </span>

                <span style={{
                  fontSize: '10px', fontWeight: 500,
                  letterSpacing: '0.05em', textTransform: 'uppercase',
                  color: 'var(--text-faint)',
                  pointerEvents: 'none',
                }}>
                  {monthName}
                </span>

                <span style={{
                  width: '5px', height: '5px',
                  borderRadius: '50%',
                  background: hasMatches ? 'var(--lime)' : 'rgba(255,255,255,0.08)',
                  marginTop: '2px',
                  transition: 'background 0.25s',
                  flexShrink: 0,
                  pointerEvents: 'none',
                }} />
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}