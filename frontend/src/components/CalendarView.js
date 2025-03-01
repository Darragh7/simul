import React, { useState, useEffect, useRef } from "react";
import { db } from "../firebase/firebase";
import { 
  collection, 
  doc, 
  setDoc, 
  onSnapshot, 
  addDoc, 
  getDoc, 
  getDocs 
} from "firebase/firestore";
import "./CalendarView.css";
import BucketListView from "./BucketListView";
import FindFreeTimes from "./FindFreeTimes";

const CalendarView = ({ group, user }) => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(null);
    const [events, setEvents] = useState({});
    const [eventInput, setEventInput] = useState("");
    const [selectedSlot, setSelectedSlot] = useState(null);
    const [isMonthDropdownOpen, setIsMonthDropdownOpen] = useState(false);
    const [showingFreeTime, setShowingFreeTime] = useState(false);
    const [groupMembers, setGroupMembers] = useState([]);
    const [memberBusyPeriods, setMemberBusyPeriods] = useState({});
    const [isLoading, setIsLoading] = useState(false);
    const userBusyPeriodsRef = useRef({});
    
    // Bucket list feature states
    const [viewMode, setViewMode] = useState('calendar'); // 'calendar' or 'bucketList'
    const [selectedBucketItem, setSelectedBucketItem] = useState(null);
    const [showFindTimes, setShowFindTimes] = useState(false);

    // Helper to handle different group formats (object or string)
    const getGroupId = () => {
        if (!group) return null;
        return typeof group === 'object' ? group.id : group;
    };

    const getGroupName = () => {
        if (!group) return "No Group Selected";
        return typeof group === 'object' ? group.name : group;
    };

    const getGroupMembers = () => {
        if (!group) return [];
        return typeof group === 'object' ? group.members || [] : [];
    };

    // All the existing calendar functionality remains the same - timeslots, months, etc.
    const timeSlots = Array.from({ length: 24 }, (_, i) => `${i}:00 - ${i + 1}:00`);
    const months = [
        "January", "February", "March", "April", "May", "June",
        "July", "August", "September", "October", "November", "December",
    ];

    // Get events useEffect and all other event-related useEffects remain the same
    
    // Fetch events in real time
    useEffect(() => {
        const groupId = getGroupId();
        if (!groupId) return;

        setIsLoading(true);
        const unsubscribe = onSnapshot(
            collection(db, `events/${groupId}/dates`), 
            (querySnapshot) => {
                const fetchedEvents = {};
                querySnapshot.forEach((doc) => {
                    fetchedEvents[doc.id] = doc.data().bookedSlots || {};
                });
                setEvents(fetchedEvents);
                setIsLoading(false);
            },
            (error) => {
                console.error("Error fetching events: ", error);
                setIsLoading(false);
            }
        );

        return () => unsubscribe(); // Cleanup listener on unmount
    }, [group]);

    // Fetch group members
    useEffect(() => {
        const groupId = getGroupId();
        if (!groupId) return;

        const fetchGroupMembers = async () => {
            try {
                setIsLoading(true);
                
                // Reset user busy periods when group changes
                userBusyPeriodsRef.current = {};
                
                // Get all members from the group/groupId/members collection directly
                const membersSnapshot = await getDocs(collection(db, `groups/${groupId}/members`));
                const members = [];
                membersSnapshot.forEach(doc => {
                    members.push({
                        userId: doc.id, // Using the document ID as userId
                        ...doc.data()
                    });
                });
                setGroupMembers(members);
                setIsLoading(false);
            } catch (error) {
                console.error("Error fetching group members: ", error);
                setIsLoading(false);
            }
        };

        fetchGroupMembers();
    }, [group]);

    // Calculate combined busy periods whenever any user's busy periods change
    const calculateCombinedBusyPeriods = () => {
        const busyPeriodsMap = {};
        
        // Process each user's busy periods
        Object.entries(userBusyPeriodsRef.current).forEach(([userId, periods]) => {
            periods.forEach(period => {
                if (period.start && period.start.includes('T')) { // Has time component
                    try {
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
                            
                            // Check if this user is already in the list
                            const existingEntry = busyPeriodsMap[dateKey][timeSlot]
                                .find(entry => entry.userId === userId);
                                
                            if (!existingEntry) {
                                // Add this user to the list of busy members for this slot
                                busyPeriodsMap[dateKey][timeSlot].push({
                                    userId,
                                    displayName: period.userDisplayName || userId,
                                    source: period.source || 'google'
                                });
                            }
                            
                            // Move to next hour
                            currentHour.setHours(currentHour.getHours() + 1);
                        }
                    } catch (error) {
                        console.error("Error processing busy period:", error, period);
                    }
                }
            });
        });
        
        return busyPeriodsMap;
    };

    // Set up real-time listeners for each member's busy periods
    useEffect(() => {
        if (!groupMembers.length) return;
        
        const userIds = groupMembers.map(member => member.email || member.userId)
                                   .filter(id => id); // Filter out any undefined/null
        
        if (!userIds.length) return;
        
        console.log("Setting up listeners for members:", userIds);
        setIsLoading(true);
        
        // Create listeners for each user
        const unsubscribes = userIds.map(userId => {
            return onSnapshot(
                doc(db, 'users', userId),
                (userDoc) => {
                    if (!userDoc.exists()) {
                        // If user document doesn't exist, clear their busy periods
                        if (userBusyPeriodsRef.current[userId]) {
                            delete userBusyPeriodsRef.current[userId];
                            setMemberBusyPeriods(calculateCombinedBusyPeriods());
                        }
                        return;
                    }
                    
                    const userData = userDoc.data();
                    const busyPeriods = userData.busyPeriods || [];
                    
                    // Store the display name with each busy period
                    const periodsWithUserInfo = busyPeriods.map(period => ({
                        ...period,
                        userDisplayName: userData.displayName || userId
                    }));
                    
                    // Store this user's busy periods separately
                    userBusyPeriodsRef.current[userId] = periodsWithUserInfo;
                    
                    // Recalculate combined busy periods
                    const combinedBusyPeriods = calculateCombinedBusyPeriods();
                    
                    // Update the state with the new busy periods
                    setMemberBusyPeriods(combinedBusyPeriods);
                    setIsLoading(false);
                },
                error => {
                    console.error(`Error listening to user ${userId} busy periods:`, error);
                    setIsLoading(false);
                }
            );
        });
        
        // Return cleanup function
        return () => {
            unsubscribes.forEach(unsubscribe => unsubscribe());
        };
    }, [groupMembers]);

    // All the existing event handlers remain the same
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

    const sendNotificationToMembers = async (groupId, creatorEmail, eventTitle, dateKey, timeSlot) => {
        const members = getGroupMembers();
        if (!members || members.length === 0) return;

        const [year, month, day] = dateKey.split("-");
        const formattedDate = `${months[parseInt(month) - 1]} ${day}, ${year}`;

        for (const memberEmail of members) {
            if (memberEmail === creatorEmail) continue;

            try {
                await addDoc(collection(db, "inbox"), {
                    to: memberEmail,
                    from: creatorEmail,
                    type: "event-notification",
                    status: "unread",
                    createdAt: new Date().toISOString(),
                    message: `${creatorEmail} added a new event "${eventTitle}" on ${formattedDate} at ${timeSlot} in group "${getGroupName()}"`,
                    groupId: groupId,
                    eventDate: dateKey,
                    eventTime: timeSlot,
                });
            } catch (error) {
                console.error("Error sending notification: ", error);
            }
        }
    };

    const handleAddEvent = async () => {
        const groupId = getGroupId();
        if (!groupId || !selectedDate || !selectedSlot || eventInput.trim() === "") {
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

        try {
            await setDoc(doc(db, `events/${groupId}/dates`, dateKey), {
                bookedSlots: updatedSlots,
            });
            setEventInput(""); // Clear input after saving
            setSelectedSlot(null);
            
            // Send notification to all group members except the creator
            await sendNotificationToMembers(groupId, userIdentifier, eventInput, dateKey, selectedSlot);
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

    const toggleFreeTimeView = () => {
        setShowingFreeTime(!showingFreeTime);
    };

    // Check if a time slot is busy due to members' busy periods
    const isBusyFromMemberCalendars = (dateKey, timeSlot) => {
        return memberBusyPeriods[dateKey]?.[timeSlot]?.length > 0;
    };

    // Get busy members for a time slot
    const getBusyMembers = (dateKey, timeSlot) => {
        return memberBusyPeriods[dateKey]?.[timeSlot] || [];
    };

    // Check if the slot is free (not booked and no busy members)
    const isSlotFree = (dateKey, timeSlot) => {
        return !events[dateKey]?.[timeSlot] && !isBusyFromMemberCalendars(dateKey, timeSlot);
    };

    // New handlers for bucket list functionality
    const toggleViewMode = () => {
        setViewMode(viewMode === 'calendar' ? 'bucketList' : 'calendar');
    };

    const handleFindTimes = (bucketItem) => {
        setSelectedBucketItem(bucketItem);
        setShowFindTimes(true);
    };

    const handleCloseFindTimes = () => {
        setShowFindTimes(false);
    };

    const handleScheduleEvent = (scheduledItem) => {
        console.log('Event scheduled:', scheduledItem);
        setShowFindTimes(false);
        // Optionally switch back to calendar view to show the newly scheduled event
        setViewMode('calendar');
    };

    if (!group) {
        return <div className="no-group-message">Please select a group to view the calendar.</div>;
    }

    return (
        <div className="calendar-container">
            <div className="view-mode-toggle">
                <button 
                    className={`toggle-btn ${viewMode === 'calendar' ? 'active' : ''}`}
                    onClick={() => setViewMode('calendar')}
                >
                    Calendar
                </button>
                <button 
                    className={`toggle-btn ${viewMode === 'bucketList' ? 'active' : ''}`}
                    onClick={() => setViewMode('bucketList')}
                >
                    Bucket List
                </button>
            </div>

            {viewMode === 'calendar' ? (
                <>
                    <div className="calendar-header">
                        <button className="arrow-btn" onClick={() => changeMonth(-1)}>◀</button>
                        <div className="month-dropdown-container">
                            <h2 onClick={() => setIsMonthDropdownOpen(!isMonthDropdownOpen)} style={{ cursor: "pointer" }}>
                                {currentDate.toLocaleString("default", { month: "long", year: "numeric" })} - {getGroupName()} ▼
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
                        <button
                            className={`find-free-time-btn ${showingFreeTime ? "active" : ""}`}
                            onClick={toggleFreeTimeView}
                        >
                            {showingFreeTime ? "Hide Free Time" : "Find Free Time"}
                        </button>
                    </div>

                    {isLoading && <div className="loading">Loading calendar data...</div>}

                    {!selectedDate && !isLoading && (
                        <div className="month-view">
                            <div className="weekdays">
                                {["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].map((day) => (
                                    <div key={day} className="weekday">{day}</div>
                                ))}
                            </div>
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
                            <h3>{currentDate.toLocaleString("default", { month: "long" })} {selectedDate}</h3>
                            <button className="back-btn" onClick={() => setSelectedDate(null)}>⬅ Back</button>

                            <div className="hourly-grid">
                                {timeSlots.map((slot, index) => {
                                    const dateKey = `${currentDate.getFullYear()}-${currentDate.getMonth() + 1}-${selectedDate}`;
                                    const event = events[dateKey]?.[slot];
                                    const isBusyFromCalendar = isBusyFromMemberCalendars(dateKey, slot);
                                    const busyMembers = getBusyMembers(dateKey, slot);
                                    const isFree = showingFreeTime && isSlotFree(dateKey, slot);
                                    
                                    return (
                                        <div 
                                            key={index} 
                                            className={`hour-slot ${event ? 'booked' : ''} ${isBusyFromCalendar ? 'calendar-busy' : ''} ${isFree ? 'free' : ''}`} 
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
                                            {isFree && <div className="free-indicator">Available</div>}
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
                </>
            ) : (
                <BucketListView group={group} user={user} onFindTimes={handleFindTimes} />
            )}

            {showFindTimes && selectedBucketItem && (
                <div className="modal-overlay">
                    <FindFreeTimes 
                        group={group} 
                        bucketItem={selectedBucketItem} 
                        user={user}
                        onClose={handleCloseFindTimes}
                        onScheduleEvent={handleScheduleEvent}
                    />
                </div>
            )}
        </div>
    );
};

export default CalendarView;