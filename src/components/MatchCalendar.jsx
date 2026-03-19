import { useState, useRef, useEffect, useMemo } from 'react';
import { useActiveDates, useEarliestMatchDate } from '../hooks/hooks';

export default function MatchCalendar({ onSelectDate }) {
  const todayRef = useRef((() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  })());
  const today = todayRef.current;

  const { earliestDate, loading: earliestLoading } = useEarliestMatchDate();

  // Build date array from earliest DB date up to today — no future dates
  const dates = useMemo(() => {
    if (!earliestDate) return [];

    const result = [];
    const cursor = new Date(earliestDate);
    cursor.setHours(0, 0, 0, 0);

    while (cursor <= today) {
      result.push(new Date(cursor));
      cursor.setDate(cursor.getDate() + 1);
    }

    return result;
  }, [earliestDate, today]);

  const windowStart = dates[0] ?? today;
  const windowEnd   = today;

  const [selectedDate, setSelectedDate] = useState(today);
  const scrollRef = useRef(null);
  const { activeDates } = useActiveDates(windowStart, windowEnd);

  // Scroll to today (rightmost) once dates are loaded
  useEffect(() => {
    if (!dates.length) return;
    const frame = requestAnimationFrame(() => {
      if (scrollRef.current) {
        scrollRef.current.scrollLeft = scrollRef.current.scrollWidth;
      }
    });
    return () => cancelAnimationFrame(frame);
  }, [dates]);

  // Default select today on mount
  useEffect(() => {
    onSelectDate?.(today, toDateStr(today));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function toDateStr(d) {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Paris',
      year:     'numeric',
      month:    '2-digit',
      day:      '2-digit',
    }).format(d);
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

  // Show skeleton strip while loading earliest date
  if (earliestLoading || !dates.length) {
    return (
      <div style={{ width: '100%', marginBottom: '16px' }}>
        <div style={{ display: 'flex', gap: '8px', overflowX: 'hidden', padding: '2px' }}>
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="tv-skeleton"
              style={{ minWidth: '64px', height: '88px', borderRadius: 'var(--radius-sm)', flexShrink: 0 }}
            />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div style={{ width: '100%', marginBottom: '16px' }}>
      <div style={{ position: 'relative', overflow: 'visible', minWidth: 0 }}>
        <style>{`
          .tv-cal-strip { -ms-overflow-style: none; scrollbar-width: none; }
          .tv-cal-strip::-webkit-scrollbar { display: none; }
          .tv-cal-btn:hover { border-color: rgba(159,239,102,0.4) !important; }
        `}</style>
        <div
          ref={scrollRef}
          className="tv-cal-strip"
          style={{
            display:    'flex',
            gap:        '8px',
            overflowX:  'scroll',
            paddingBottom: '8px',
            paddingTop:    '2px',
            paddingLeft:   '2px',
            paddingRight:  '2px',
            WebkitOverflowScrolling: 'touch',
            cursor: 'grab',
          }}
          onMouseDown={e => {
            const el = e.currentTarget;
            el.style.cursor    = 'grabbing';
            el.style.userSelect = 'none';
            const startX     = e.pageX - el.offsetLeft;
            const scrollLeft = el.scrollLeft;
            const onMove = ev => {
              el.scrollLeft = scrollLeft - (ev.pageX - el.offsetLeft - startX);
            };
            const onUp = () => {
              el.style.cursor    = 'grab';
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
                    isSelected ? 'rgba(159,239,102,0.5)'
                    : isToday  ? 'rgba(159,239,102,0.25)'
                    :            'var(--border)'
                  }`,
                  borderRadius: 'var(--radius-sm)',
                  background: isSelected ? 'rgba(159,239,102,0.12)'
                    : isToday            ? 'rgba(159,239,102,0.05)'
                    :                      'var(--bg-card)',
                  cursor:     'pointer',
                  transition: 'var(--t)',
                  outline:    'none',
                  fontFamily: 'var(--font-body)',
                  WebkitTapHighlightColor: 'transparent',
                  userSelect: 'none',
                  // Fade days with no matches
                  opacity: !hasMatches && !isSelected && !isToday ? 0.4 : 1,
                }}
              >
                <span style={{
                  fontSize:      '10px',
                  fontWeight:    700,
                  letterSpacing: '0.07em',
                  textTransform: 'uppercase',
                  color:         isSelected || isToday ? 'var(--lime)' : 'var(--text-faint)',
                  pointerEvents: 'none',
                }}>
                  {isToday ? 'TODAY' : dayName}
                </span>

                <span style={{
                  fontSize:   '20px',
                  fontWeight: 700,
                  fontFamily: 'var(--font-display)',
                  color:      isSelected ? 'var(--lime)' : 'var(--text)',
                  lineHeight: 1,
                  pointerEvents: 'none',
                }}>
                  {dayNum}
                </span>

                <span style={{
                  fontSize:      '10px',
                  fontWeight:    500,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  color:         'var(--text-faint)',
                  pointerEvents: 'none',
                }}>
                  {monthName}
                </span>

                <span style={{
                  width:        '5px',
                  height:       '5px',
                  borderRadius: '50%',
                  background:   hasMatches ? 'var(--lime)' : 'rgba(255,255,255,0.08)',
                  marginTop:    '2px',
                  transition:   'background 0.25s',
                  flexShrink:   0,
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