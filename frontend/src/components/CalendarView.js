import React, { useState, useEffect } from "react";
import { db } from "../firebase/firebase"; // Import Firestore
import { collection, getDocs, setDoc, doc } from "firebase/firestore";
import "./CalendarView.css";

function CalendarView({ group }) {
    // Generate time slots like "1:00 - 2:00", "2:00 - 3:00"
    const hours = Array.from({ length: 24 }, (_, i) => `${i + 1}:00 - ${i + 2}:00`);
    const [events, setEvents] = useState({});

    // Fetch events from Firebase
    useEffect(() => {
        if (group) {
            const fetchEvents = async () => {
                const eventsRef = collection(db, "calendars", group, "events");
                const snapshot = await getDocs(eventsRef);
                let eventData = {};
                snapshot.forEach(doc => {
                    eventData[doc.id] = doc.data().event;
                });
                setEvents(eventData);
            };
            fetchEvents();
        }
    }, [group]);

    
    const handleSlotClick = async (hour) => {
        const eventName = prompt(`Add an event for ${hour}:`);
        if (eventName) {
            setEvents((prevEvents) => ({
                ...prevEvents,
                [hour]: eventName
            }));

            // Save to Firebase
            await setDoc(doc(db, "calendars", group, "events", hour), {
                event: eventName
            });
        }
    };

    return (
        <div className="calendar-container">
            <h2>{group ? `${group}'s Calendar` : "Select a Group"}</h2>
            <div className="calendar-grid">
                {hours.map((hour) => (
                    <button 
                        key={hour} 
                        className={`time-slot ${events[hour] ? "booked" : "free"}`} 
                        onClick={() => handleSlotClick(hour)}
                    >
                        {hour} {events[hour] ? `- ${events[hour]}` : "(Free)"}
                    </button>
                ))}
            </div>
        </div>
    );
}



export default CalendarView;

