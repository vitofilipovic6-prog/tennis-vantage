// src/components/MatchCalendar.jsx
import { useState, useRef, useEffect } from 'react';
import { supabase } from '../services/supabase';

export default function MatchCalendar({ onSelectDate }) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [matchCounts,  setMatchCounts]  = useState({});
  const scrollRef = useRef(null);

  // 15-day window: 3 days back, today, 11 days forward
  const dates = Array.from({ length: 15 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 3 + i);
    return d;
  });

  // Fetch match counts for ALL visible dates in ONE single query
  useEffect(() => {
    const start = new Date(dates[0]);
    start.setHours(0, 0, 0, 0);
    const end = new Date(dates[dates.length - 1]);
    end.setHours(23, 59, 59, 999);

    supabase
      .from('matches')
      .select('match_date')
      .in('status', ['live', 'upcoming'])
      .gte('match_date', start.toISOString())
      .lte('match_date', end.toISOString())
      .then(({ data }) => {
        if (!data) return;
        const counts = {};
        data.forEach(row => {
          const key = new Date(row.match_date).toDateString();
          counts[key] = (counts[key] ?? 0) + 1;
        });
        setMatchCounts(counts);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Scroll today into center on mount
  useEffect(() => {
    if (scrollRef.current) {
      const el = scrollRef.current.querySelector('.tv-date-btn--today');
      el?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
    }
  }, []);

  function handleSelect(date) {
    setSelectedDate(date);
    onSelectDate?.(date);
  }

  function isToday(date) {
    return date.toDateString() === new Date().toDateString();
  }

  return (
    <>
      <style>{CAL_CSS}</style>
      <div className="tv-cal">
        <div className="tv-cal__scroll" ref={scrollRef}>
          {dates.map((date, i) => {
            const selected = selectedDate.toDateString() === date.toDateString();
            const today    = isToday(date);
            const count    = matchCounts[date.toDateString()] ?? 0;
            const dayName  = date.toLocaleDateString('en-US', { weekday: 'short' });
            const dayNum   = date.getDate();
            const month    = date.toLocaleDateString('en-US', { month: 'short' });

            return (
              <button
                key={i}
                onClick={() => handleSelect(date)}
                className={[
                  'tv-date-btn',
                  selected ? 'tv-date-btn--sel'  : '',
                  today    ? 'tv-date-btn--today' : '',
                ].filter(Boolean).join(' ')}
              >
                <span className="tv-date-btn__day">
                  {today ? 'TODAY' : dayName.toUpperCase()}
                </span>
                <span className="tv-date-btn__num">{dayNum}</span>
                <span className="tv-date-btn__month">{month}</span>
                {count > 0 && (
                  <span className="tv-date-btn__badge">{count}</span>
                )}
              </button>
            );
          })}
        </div>
      </div>
    </>
  );
}

const CAL_CSS = `
.tv-cal {
  background: var(--bg-card);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  padding: 14px 0;
  overflow: hidden;
  position: relative;
}
.tv-cal::before,
.tv-cal::after {
  content: '';
  position: absolute;
  top: 0; bottom: 0;
  width: 40px;
  z-index: 2;
  pointer-events: none;
}
.tv-cal::before {
  left: 0;
  background: linear-gradient(to right, var(--bg-card), transparent);
}
.tv-cal::after {
  right: 0;
  background: linear-gradient(to left, var(--bg-card), transparent);
}
.tv-cal__scroll {
  display: flex;
  gap: 6px;
  overflow-x: auto;
  padding: 4px 20px;
  scrollbar-width: none;
  -ms-overflow-style: none;
  scroll-snap-type: x proximity;
}
.tv-cal__scroll::-webkit-scrollbar { display: none; }

.tv-date-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 3px;
  padding: 10px 14px;
  border-radius: 10px;
  border: 1px solid transparent;
  background: transparent;
  cursor: pointer;
  transition: all 0.18s ease;
  flex-shrink: 0;
  position: relative;
  min-width: 58px;
  scroll-snap-align: center;
}
.tv-date-btn:hover {
  background: rgba(159,239,102,0.06);
  border-color: rgba(159,239,102,0.2);
}
.tv-date-btn--sel {
  background: rgba(159,239,102,0.12) !important;
  border-color: rgba(159,239,102,0.45) !important;
  box-shadow: 0 0 18px rgba(159,239,102,0.1);
}
.tv-date-btn--today .tv-date-btn__day {
  color: var(--lime) !important;
}
.tv-date-btn__day {
  font-size: 9px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: var(--text-faint);
  transition: color 0.18s;
}
.tv-date-btn--sel .tv-date-btn__day { color: var(--lime); }

.tv-date-btn__num {
  font-family: var(--font-mono);
  font-size: 20px;
  font-weight: 700;
  color: var(--text);
  line-height: 1;
  transition: color 0.18s;
}
.tv-date-btn--sel .tv-date-btn__num { color: var(--lime); }

.tv-date-btn__month {
  font-size: 9px;
  font-weight: 600;
  letter-spacing: 0.06em;
  color: var(--text-faint);
  text-transform: uppercase;
}
.tv-date-btn__badge {
  position: absolute;
  top: 6px;
  right: 6px;
  min-width: 16px;
  height: 16px;
  border-radius: 999px;
  background: var(--lime);
  color: #070B14;
  font-size: 9px;
  font-weight: 800;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 4px;
  line-height: 1;
}
`;