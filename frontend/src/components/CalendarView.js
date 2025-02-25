import React, { useState, useEffect } from 'react';
import { db } from "../firebase/firebase";
import { collection, getDocs, setDoc, doc } from "firebase/firestore";
import './CalendarView.css';

const CalendarView = ({ group, user }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(null);
    const [events, setEvents] = useState({});
    const [eventInput, setEventInput] = useState("");
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);

    const timeSlots = Array.from({ length: 24 }, (_, i) => `${i}:00 - ${i + 1}:00`);
    const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December"
    ];

    // Fetch booked slots from Firestore when component mounts or group changes
    useEffect(() => {
        if (!group) return;

        const fetchEvents = async () => {
            try {
                const querySnapshot = await getDocs(collection(db, `events/${group}/dates`));
                const fetchedEvents = {};
                querySnapshot.forEach((doc) => {
                    fetchedEvents[doc.id] = doc.data().bookedSlots || {};
                });
                setEvents(fetchedEvents);
            } catch (error) {
                console.error("Error fetching events: ", error);
            }
        };

        fetchEvents();
    }, [group]);

    const handleDayClick = (day) => {
        setSelectedDate(day);
    };

    const handleSlotClick = (time) => {
        setSelectedSlot(time);
    };

    const handleAddEvent = async () => {
        if (!group || !selectedDate || !selectedSlot || eventInput.trim() === "") {
            alert("Please select a group, date, time, and enter an event title.");
            return;
        }

        const dateKey = `${currentDate.getFullYear()}-${currentDate.getMonth() + 1}-${selectedDate}`;
        
        // Use user email from the props or display name if available
        const userIdentifier = user?.email || user?.displayName || "anonymous";
        
        const updatedSlots = { ...events[dateKey] } || {};
        updatedSlots[selectedSlot] = { 
            title: eventInput, 
            user: userIdentifier,
            userId: user?.uid || "unknown", // Store the user ID for additional reference
            createdAt: new Date().toISOString() // Add timestamp
        };

        setEvents((prev) => ({
            ...prev,
            [dateKey]: updatedSlots,
        }));

        try {
            await setDoc(doc(db, `events/${group}/dates`, dateKey), {
                bookedSlots: updatedSlots,
            });
            setEventInput(""); // Clear input after saving
            setSelectedSlot(null);
        } catch (error) {
            console.error("Error saving event: ", error);
        }
    };

    const handleMonthSelect = (monthIndex) => {
        const newDate = new Date(currentDate);
        newDate.setMonth(monthIndex);
        setCurrentDate(newDate);
        setSelectedDate(null);
        setIsMonthDropdownOpen(false);
    };

    const changeMonth = (direction) => {
        const newDate = new Date(currentDate);
        newDate.setMonth(currentDate.getMonth() + direction);
        setCurrentDate(newDate);
        setSelectedDate(null);
    };

    // Format the display of the event including the creator's info
    const formatEventDisplay = (event) => {
        if (!event) return "";
        return `${event.title} (by ${event.user})`;
    };

    return (
        <div className="calendar-container">
            <div className="calendar-header">
                <button className="arrow-btn" onClick={() => changeMonth(-1)}>◀</button>
                <div className="month-dropdown-container">
                    <h2 onClick={() => setIsMonthDropdownOpen(!isMonthDropdownOpen)} style={{ cursor: 'pointer' }}>
                        {currentDate.toLocaleString('default', { month: 'long', year: 'numeric' })} - {group || "No Group Selected"} ▼
                    </h2>
                    {isMonthDropdownOpen && (
                        <div className="month-dropdown">
                            {months.map((month, index) => (
                                <div
                                    key={month}
                                    className="month-option"
                                    onClick={() => handleMonthSelect(index)}
                                >
                                    {month} {currentDate.getFullYear()}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
                <button className="arrow-btn" onClick={() => changeMonth(1)}>▶</button>
                {group && <button className="find-free-time-btn">Find Free Time</button>}
            </div>

            {!selectedDate && (
                <div className="month-view">
                    <div className="weekdays">
                        {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
                            <div key={day} className="weekday">{day}</div>
                        ))}
                    </div>
                    {/* Make the days grid scrollable */}
                    <div className="days-grid">
                        {Array.from({ length: new Date(currentDate.getFullYear(), currentDate.getMonth(), 1).getDay() }, (_, i) => (
                            <div key={`empty-${i}`} className="empty-day"></div>
                        ))}
                        {Array.from({ length: new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0).getDate() }, (_, i) => (
                            <div key={i} className="day" onClick={() => handleDayClick(i + 1)}>
                                {i + 1}
                            </div>
                        ))}
                    </div>
                </div>
            )}

            {selectedDate && (
                <div className="day-view">
                    <h3>{currentDate.toLocaleString('default', { month: 'long' })} {selectedDate}</h3>
                    <button className="back-btn" onClick={() => setSelectedDate(null)}>⬅ Back</button>

                    {/* Make the hourly grid scrollable */}
                    <div className="hourly-grid">
                        {timeSlots.map((slot, index) => {
                            const dateKey = `${currentDate.getFullYear()}-${currentDate.getMonth() + 1}-${selectedDate}`;
                            const event = events[dateKey]?.[slot];
                            
                            return (
                                <div 
                                    key={index} 
                                    className={`hour-slot ${event ? 'booked' : ''}`} 
                                    onClick={() => handleSlotClick(slot)}
                                >
                                    <div className="slot-time">{slot}</div>
                                    {event && (
                                        <div className="event-details">
                                            <div className="event-title">{event.title}</div>
                                            <div className="event-creator">Created by: {event.user}</div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {selectedSlot && (
                        <div className="event-input-container">
                            <h4>Adding Event for {selectedSlot}</h4>
                            <input 
                                type="text" 
                                placeholder="Event title..." 
                                value={eventInput} 
                                onChange={(e) => setEventInput(e.target.value)}
                            />
                            <button onClick={handleAddEvent}>Add Event</button>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

export default CalendarView;