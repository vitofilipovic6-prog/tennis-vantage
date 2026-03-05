import { useState, useRef, useEffect } from 'react';

export default function MatchCalendar({ onSelectDate }) {
  const [selectedDate, setSelectedDate] = useState(new Date());
  const scrollRef = useRef(null);

  // Generate an array of 15 dates: 7 days before, today, and 7 days after
  const dates = Array.from({ length: 15 }, (_, i) => {
    const d = new Date();
    d.setDate(d.getDate() - 7 + i);
    return d;
  });

  // Center the calendar on "Today" when the component first loads
  useEffect(() => {
    if (scrollRef.current) {
      const activeEl = scrollRef.current.querySelector('.active-date');
      if (activeEl) {
        activeEl.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
      }
    }
  }, []);

  const handleSelect = (date) => {
    setSelectedDate(date);
    if (onSelectDate) onSelectDate(date);
  };

  const isToday = (date) => {
    const today = new Date();
    return date.getDate() === today.getDate() &&
           date.getMonth() === today.getMonth() &&
           date.getFullYear() === today.getFullYear();
  };

  return (
    <div className="tv-calendar-wrapper">
      <div className="tv-calendar-scroll" ref={scrollRef}>
        {dates.map((date, index) => {
          const isSelected = selectedDate.toDateString() === date.toDateString();
          const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
          const dayNum = date.getDate();
          const monthName = date.toLocaleDateString('en-US', { month: 'short' });

          return (
            <button
              key={index}
              onClick={() => handleSelect(date)}
              className={`tv-date-btn ${isSelected ? 'active-date' : ''} ${isToday(date) ? 'is-today' : ''}`}
            >
              <span className="tv-date-day">{isToday(date) ? 'TODAY' : dayName}</span>
              <span className="tv-date-num">{dayNum}</span>
              <span className="tv-date-month">{monthName}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}