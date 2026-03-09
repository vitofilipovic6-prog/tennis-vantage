// ─────────────────────────────────────────────────────────────────────────────
// MatchCalendar.jsx – Horizontal date-strip for selecting match days
// FIX: Replaced className-based styles (which had no corresponding CSS rules)
//      with inline styles using design tokens so it renders correctly everywhere.
// FIX: `onSelectDate` null-guard added.
// ─────────────────────────────────────────────────────────────────────────────
import { useState, useRef, useEffect } from 'react';

export default function MatchCalendar({ onSelectDate }) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const scrollRef = useRef(null);

  // 15 days: 7 before today, today, 7 after
  const dates = Array.from({ length: 15 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 7 + i);
    return d;
  });

  // On mount, scroll "Today" into the centre of the strip
  useEffect(() => {
    if (scrollRef.current) {
      const activeEl = scrollRef.current.querySelector('[data-today="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }, []);

  const isToday = (date) => {
    const today = new Date();
    return (
      date.getDate()     === today.getDate() &&
      date.getMonth()    === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const handleSelect = (date) => {
    setSelectedDate(date);
    onSelectDate?.(date); // null-safe optional call
  };

  return (
    <div style={{
      width: '100%',
      overflowX: 'hidden',
      marginBottom: '28px',
    }}>
      {/* Scroll container */}
      <div
        ref={scrollRef}
        style={{
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          paddingBottom: '8px',
          scrollbarWidth: 'none', // Firefox
          msOverflowStyle: 'none', // IE/Edge
          WebkitOverflowScrolling: 'touch',
        }}
      >
        {dates.map((date, index) => {
          const selected  = selectedDate.toDateString() === date.toDateString();
          const today     = isToday(date);
          const dayName   = date.toLocaleDateString('en-US', { weekday: 'short' });
          const dayNum    = date.getDate();
          const monthName = date.toLocaleDateString('en-US', { month: 'short' });

          return (
            <button
              key={index}
              data-today={today ? 'true' : 'false'}
              onClick={() => handleSelect(date)}
              style={{
                display:        'flex',
                flexDirection:  'column',
                alignItems:     'center',
                justifyContent: 'center',
                gap:            '4px',
                flexShrink:     0,
                minWidth:       '60px',
                padding:        '10px 8px',
                border:         `1px solid ${selected
                                  ? 'rgba(159,239,102,0.5)'
                                  : today
                                    ? 'rgba(159,239,102,0.25)'
                                    : 'var(--border)'}`,
                borderRadius:   'var(--radius-sm)',
                background:     selected
                                  ? 'rgba(159,239,102,0.12)'
                                  : today
                                    ? 'rgba(159,239,102,0.05)'
                                    : 'var(--bg-card)',
                cursor:         'pointer',
                transition:     'var(--t)',
                outline:        'none',
                fontFamily:     'var(--font-body)',
              }}
            >
              {/* Day label */}
              <span style={{
                fontSize:      '10px',
                fontWeight:    700,
                letterSpacing: '0.07em',
                textTransform: 'uppercase',
                color:         selected ? 'var(--lime)' : today ? 'var(--lime)' : 'var(--text-faint)',
              }}>
                {today ? 'TODAY' : dayName}
              </span>

              {/* Day number */}
              <span style={{
                fontSize:   '20px',
                fontWeight: 700,
                fontFamily: 'var(--font-display)',
                color:      selected ? 'var(--lime)' : 'var(--text)',
                lineHeight: 1,
              }}>
                {dayNum}
              </span>

              {/* Month label */}
              <span style={{
                fontSize:      '10px',
                fontWeight:    500,
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                color:         'var(--text-faint)',
              }}>
                {monthName}
              </span>

              {/* Active dot indicator */}
              {selected && (
                <span style={{
                  width:        '4px',
                  height:       '4px',
                  borderRadius: '50%',
                  background:   'var(--lime)',
                  marginTop:    '2px',
                }} />
              )}
            </button>
          );
        })}
      </div>

      {/* Hide native scrollbar in WebKit */}
      <style>{`
        div::-webkit-scrollbar { display: none; }
      `}</style>
    </div>
  );
}