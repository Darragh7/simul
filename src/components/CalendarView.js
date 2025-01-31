import React, { useState } from 'react';
import './CalendarView.css';

function CalendarView({ group }) {
    const hours = Array.from({ length: 14 }, (_, i) => i + 8); // Hours from 8 AM - 9 PM
    const [selectedSlots, setSelectedSlots] = useState([]);

    const toggleSlot = (hour) => {
        setSelectedSlots((prevSlots) =>
            prevSlots.includes(hour) ? prevSlots.filter((h) => h !== hour) : [...prevSlots, hour]
        );
    };

    return (
        <div className="calendar-container">
            <h2>{group ? `${group} Calendar` : "Select a Group"}</h2>
            <div className="calendar-grid">
                {hours.map((hour) => (
                    <button
                        key={hour}
                        className={`calendar-slot ${selectedSlots.includes(hour) ? 'selected' : ''}`}
                        onClick={() => toggleSlot(hour)}
                    >
                        {hour}:00 - {hour + 1}:00
                    </button>
                ))}
            </div>
        </div>
    );
}

export default CalendarView;
