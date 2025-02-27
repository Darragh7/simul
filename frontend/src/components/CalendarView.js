import React, { useState, useEffect } from 'react';
import { db } from "../firebase/firebase";
import { collection, getDocs, setDoc, doc, getDoc } from "firebase/firestore";
import './CalendarView.css';

const CalendarView = ({ group, user }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(null);
    const [events, setEvents] = useState({});
    const [eventInput, setEventInput] = useState("");
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);
    const [groupMembers, setGroupMembers] = useState([]);
    const [memberBusyPeriods, setMemberBusyPeriods] = useState({}); // Store busy periods from members' calendars
    const [isLoading, setIsLoading] = useState(false);

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
                setIsLoading(true);
                const querySnapshot = await getDocs(collection(db, `events/${group}/dates`));
                const fetchedEvents = {};
                querySnapshot.forEach((doc) => {
                    fetchedEvents[doc.id] = doc.data().bookedSlots || {};
                });
                setEvents(fetchedEvents);
                setIsLoading(false);
            } catch (error) {
                console.error("Error fetching events: ", error);
                setIsLoading(false);
            }
        };

        fetchEvents();
    }, [group]);

    // Fetch group members and their busy periods
    useEffect(() => {
        if (!group) return;

        const fetchGroupMembers = async () => {
            try {
                setIsLoading(true);
                
                // Step 1: Get all members from the group/groupId/members collection directly
                const membersSnapshot = await getDocs(collection(db, `groups/${group}/members`));
                const members = [];
                membersSnapshot.forEach(doc => {
                    members.push({
                        userId: doc.id, // Using the document ID as userId
                        ...doc.data()
                    });
                });
                setGroupMembers(members);
                
                // Step 2: Fetch busy periods for each member from the users collection
                const busyPeriodsMap = {};
                
                for (const member of members) {
                    // Use email as userId since that's what your backend is using
                    const userId = member.email;
                    if (!userId) continue;
                    
                    const userDoc = await getDoc(doc(db, 'users', userId));
                    if (!userDoc.exists()) continue;
                    
                    const userData = userDoc.data();
                    const busyPeriods = userData.busyPeriods || [];
                    
                    // Process busy periods into hourly slots for easier display
                    busyPeriods.forEach(period => {
                        if (period.start && period.start.includes('T')) { // Has time component
                            // Parse dates properly
                            const startTime = new Date(period.start);
                            const endTime = new Date(period.end);
                            
                            // Round to the nearest hour
                            let currentHour = new Date(
                                startTime.getFullYear(),
                                startTime.getMonth(),
                                startTime.getDate(),
                                startTime.getHours(),
                                0, 0
                            );
                            
                            // Iterate through each hour slot
                            while (currentHour < endTime) {
                                const dateKey = `${currentHour.getFullYear()}-${currentHour.getMonth() + 1}-${currentHour.getDate()}`;
                                const timeSlot = `${currentHour.getHours()}:00 - ${currentHour.getHours() + 1}:00`;
                                
                                if (!busyPeriodsMap[dateKey]) {
                                    busyPeriodsMap[dateKey] = {};
                                }
                                
                                if (!busyPeriodsMap[dateKey][timeSlot]) {
                                    busyPeriodsMap[dateKey][timeSlot] = [];
                                }
                                
                                // Add this user to the list of busy members for this slot
                                busyPeriodsMap[dateKey][timeSlot].push({
                                    userId,
                                    displayName: member.displayName || userData.displayName || userId,
                                    source: period.source || 'google'
                                });
                                
                                // Move to next hour
                                currentHour.setHours(currentHour.getHours() + 1);
                            }
                        }
                    });
                }
                
                setMemberBusyPeriods(busyPeriodsMap);
                setIsLoading(false);
            } catch (error) {
                console.error("Error fetching group members: ", error);
                setIsLoading(false);
            }
        };

        fetchGroupMembers();
    }, [group]);

    const handleDayClick = (day) => {
        setSelectedDate(day);
    };

    const handleSlotClick = (time) => {
        // Only allow selecting non-busy slots
        const dateKey = `${currentDate.getFullYear()}-${currentDate.getMonth() + 1}-${selectedDate}`;
        const event = events[dateKey]?.[time];
        const busyMembers = memberBusyPeriods[dateKey]?.[time] || [];
        
        if (!event && busyMembers.length === 0) {
            setSelectedSlot(time);
        } else if (event) {
            // Show event details when clicking on a booked slot
            alert(`Event: ${event.title}\nCreated by: ${event.user}\nCreated at: ${new Date(event.createdAt).toLocaleString()}`);
        } else if (busyMembers.length > 0) {
            // Show busy members when clicking on a busy slot
            const names = busyMembers.map(member => member.displayName).join(', ');
            alert(`This time slot is busy for: ${names}`);
        }
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

    // Check if a time slot is busy due to members' busy periods
    const isBusyFromMemberCalendars = (dateKey, timeSlot) => {
        return memberBusyPeriods[dateKey]?.[timeSlot]?.length > 0;
    };

    // Get busy members for a time slot
    const getBusyMembers = (dateKey, timeSlot) => {
        return memberBusyPeriods[dateKey]?.[timeSlot] || [];
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

            {isLoading && <div className="loading">Loading calendar data...</div>}

            {!selectedDate && !isLoading && (
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

            {selectedDate && !isLoading && (
                <div className="day-view">
                    <h3>{currentDate.toLocaleString('default', { month: 'long' })} {selectedDate}</h3>
                    <button className="back-btn" onClick={() => setSelectedDate(null)}>⬅ Back</button>

                    {/* Make the hourly grid scrollable */}
                    <div className="hourly-grid">
                        {timeSlots.map((slot, index) => {
                            const dateKey = `${currentDate.getFullYear()}-${currentDate.getMonth() + 1}-${selectedDate}`;
                            const event = events[dateKey]?.[slot];
                            const isBusyFromCalendar = isBusyFromMemberCalendars(dateKey, slot);
                            const busyMembers = getBusyMembers(dateKey, slot);
                            
                            return (
                                <div 
                                    key={index} 
                                    className={`hour-slot ${event ? 'booked' : ''} ${isBusyFromCalendar ? 'calendar-busy' : ''}`} 
                                    onClick={() => handleSlotClick(slot)}
                                >
                                    <div className="slot-time">{slot}</div>
                                    {event && (
                                        <div className="event-details">
                                            <div className="event-title">{event.title}</div>
                                            <div className="event-creator">Created by: {event.user}</div>
                                        </div>
                                    )}
                                    {!event && isBusyFromCalendar && (
                                        <div className="busy-details">
                                            <div className="busy-title">Busy</div>
                                            <div className="busy-members">
                                                {busyMembers.length === 1 
                                                    ? `${busyMembers[0].displayName} is busy` 
                                                    : `${busyMembers.length} members are busy`}
                                            </div>
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