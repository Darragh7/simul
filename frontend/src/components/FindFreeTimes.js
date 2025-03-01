import React, { useState, useEffect } from 'react';
import { 
  collection, 
  getDocs, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  Timestamp,
  query,
  where,
  addDoc,
  collectionGroup,
  deleteDoc,
  onSnapshot
} from 'firebase/firestore';
import { db } from '../firebase/firebase';
import './FindFreeTimes.css';

const FindFreeTimes = ({ group, bucketItem, user, onClose, onScheduleEvent }) => {
  const [freeTimes, setFreeTimes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [selectedTimeSlot, setSelectedTimeSlot] = useState(null);
  const [searchDays, setSearchDays] = useState(14); // Default to searching 2 weeks ahead
  const [searchStartDate, setSearchStartDate] = useState(
    new Date(new Date().setHours(0, 0, 0, 0)).toISOString().split('T')[0]
  );
  const [businessHoursOnly, setBusinessHoursOnly] = useState(true);
  const [timeSlots, setTimeSlots] = useState([]); // Stored time slots with votes
  const [groupMembers, setGroupMembers] = useState([]);
  const [confirmingEvent, setConfirmingEvent] = useState(false);

  useEffect(() => {
    // Fetch group members for availability calculations
    const fetchGroupMembers = async () => {
      try {
        const membersSnapshot = await getDocs(collection(db, `groups/${group.id}/members`));
        const members = [];
        membersSnapshot.forEach(doc => {
          members.push({
            userId: doc.id,
            email: doc.id,
            ...doc.data()
          });
        });
        setGroupMembers(members);
      } catch (error) {
        console.error("Error fetching group members:", error);
      }
    };

    fetchGroupMembers();
  }, [group]);

  // Listen for time slot votes in real-time
  useEffect(() => {
    if (!group?.id || !bucketItem?.id) return;

    const timeSlotsRef = collection(db, `groups/${group.id}/bucketList/${bucketItem.id}/timeSlots`);
    
    const unsubscribe = onSnapshot(timeSlotsRef, (snapshot) => {
      const slots = [];
      snapshot.forEach((doc) => {
        slots.push({
          id: doc.id,
          ...doc.data(),
          votes: doc.data().votes || {},
          totalVotes: doc.data().totalVotes || 0
        });
      });
      
      // Sort time slots by votes (descending) and then by availability (descending)
      slots.sort((a, b) => {
        if (b.totalVotes !== a.totalVotes) return b.totalVotes - a.totalVotes;
        return b.availability - a.availability;
      });
      
      setTimeSlots(slots);
    });

    return () => unsubscribe();
  }, [group, bucketItem]);

  const findAvailableTimes = async () => {
    if (!group?.id || !bucketItem) return;
    
    setLoading(true);
    setError('');
    setFreeTimes([]);
    
    try {
      const startDateObj = new Date(searchStartDate);
      const endDateObj = new Date(startDateObj);
      endDateObj.setDate(endDateObj.getDate() + searchDays);
      
      // Format dates for comparison
      const formattedStartDate = startDateObj.toISOString().split('T')[0];
      const formattedEndDate = endDateObj.toISOString().split('T')[0];
      
      // Get all members in the group
      const membersSnapshot = await getDocs(collection(db, `groups/${group.id}/members`));
      const memberEmails = [];
      membersSnapshot.forEach(doc => {
        memberEmails.push(doc.id); // Email is the document ID
      });
      
      if (memberEmails.length === 0) {
        setError('No members found in this group');
        setLoading(false);
        return;
      }
      
      // Fetch busy periods for all members
      const memberBusyPeriods = {};
      
      for (const email of memberEmails) {
        const userDoc = await getDoc(doc(db, 'users', email));
        if (userDoc.exists()) {
          const userData = userDoc.data();
          memberBusyPeriods[email] = userData.busyPeriods || [];
        }
      }
      
      // Fetch group events
      const groupEvents = {};
      const datesSnapshot = await getDocs(collection(db, `events/${group.id}/dates`));
      
      datesSnapshot.forEach(doc => {
        const dateKey = doc.id;
        const dateData = doc.data();
        groupEvents[dateKey] = dateData.bookedSlots || {};
      });
      
      // Generate all possible time slots
      const possibleTimes = [];
      const currentDate = new Date(startDateObj);
      
      // The duration in hours from the bucket item
      const durationHours = bucketItem.durationHours || 2;
      
      while (currentDate < endDateObj) {
        const dateKey = `${currentDate.getFullYear()}-${currentDate.getMonth() + 1}-${currentDate.getDate()}`;
        const dayOfWeek = currentDate.getDay(); // 0 = Sunday, 6 = Saturday
        
        // Skip weekends if business hours only is selected
        if (businessHoursOnly && (dayOfWeek === 0 || dayOfWeek === 6)) {
          currentDate.setDate(currentDate.getDate() + 1);
          continue;
        }
        
        // For each hour of the day
        const startHour = businessHoursOnly ? 9 : 0; // 9 AM if business hours, 0 otherwise
        const endHour = businessHoursOnly ? 17 : 24; // 5 PM if business hours, midnight otherwise
        
        for (let hour = startHour; hour <= endHour - durationHours; hour++) {
          const timeSlot = {
            date: new Date(currentDate),
            dateKey,
            startHour: hour,
            endHour: hour + durationHours,
            startTime: `${hour}:00`,
            endTime: `${hour + durationHours}:00`,
            conflicts: [],
            availableMembers: [],
            busyMembers: []
          };
          
          // Check if this time slot conflicts with group events
          if (groupEvents[dateKey]) {
            let hasConflict = false;
            
            // Check each hour in the duration
            for (let h = hour; h < hour + durationHours; h++) {
              const hourSlot = `${h}:00 - ${h + 1}:00`;
              if (groupEvents[dateKey][hourSlot]) {
                hasConflict = true;
                timeSlot.conflicts.push({
                  type: 'event',
                  title: groupEvents[dateKey][hourSlot].title,
                  user: groupEvents[dateKey][hourSlot].user
                });
                break;
              }
            }
            
            if (hasConflict) {
              continue; // Skip this time slot if there's a conflict
            }
          }
          
          // Check if this time slot conflicts with any member's busy periods
          let memberConflicts = [];
          
          for (const [email, busyPeriods] of Object.entries(memberBusyPeriods)) {
            // For each busy period of this member
            let isBusy = false;
            
            for (const period of busyPeriods) {
              if (!period.start || !period.end) continue;
              
              const periodStart = new Date(period.start);
              const periodEnd = new Date(period.end);
              
              // Convert the time slot to Date objects for comparison
              const slotStart = new Date(currentDate);
              slotStart.setHours(hour, 0, 0, 0);
              
              const slotEnd = new Date(currentDate);
              slotEnd.setHours(hour + durationHours, 0, 0, 0);
              
              // Check if there's an overlap
              if (periodStart < slotEnd && periodEnd > slotStart) {
                memberConflicts.push({
                  email,
                  period
                });
                isBusy = true;
                break;
              }
            }
            
            // Record if the member is available or busy
            if (isBusy) {
              timeSlot.busyMembers.push(email);
            } else {
              timeSlot.availableMembers.push(email);
            }
          }
          
          // Calculate availability percentage
          const totalMembers = memberEmails.length;
          timeSlot.availability = totalMembers > 0 ? 
            Math.round((timeSlot.availableMembers.length / totalMembers) * 100) : 0;
          
          // Add this time slot to possible times
          possibleTimes.push(timeSlot);
        }
        
        // Move to next day
        currentDate.setDate(currentDate.getDate() + 1);
      }
      
      // Sort by availability (high to low) and then by date (earliest first)
      possibleTimes.sort((a, b) => {
        if (b.availability !== a.availability) return b.availability - a.availability;
        return a.date - b.date;
      });
      
      setFreeTimes(possibleTimes);
    } catch (error) {
      console.error('Error finding free times:', error);
      setError('Failed to find free times. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    findAvailableTimes();
  }, [group, bucketItem, groupMembers]);

  const formatDate = (date) => {
    return new Date(date).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric'
    });
  };

  const formatTime = (hour) => {
    const ampm = hour >= 12 ? 'PM' : 'AM';
    const formattedHour = hour % 12 || 12;
    return `${formattedHour}:00 ${ampm}`;
  };

  // Save a time slot suggestion with initial vote
  const handleSaveTimeSlot = async (timeSlot) => {
    if (!timeSlot || !group?.id || !bucketItem?.id || !user?.email) return;
    
    try {
      // Create a unique ID for this time slot
      const timeSlotId = `${timeSlot.dateKey}-${timeSlot.startHour}-${timeSlot.endHour}`;
      
      // Check if this time slot already exists
      const timeSlotRef = doc(db, `groups/${group.id}/bucketList/${bucketItem.id}/timeSlots`, timeSlotId);
      const timeSlotDoc = await getDoc(timeSlotRef);
      
      if (timeSlotDoc.exists()) {
        // Time slot already exists, just update it
        await updateDoc(timeSlotRef, {
          availability: timeSlot.availability,
          availableMembers: timeSlot.availableMembers,
          busyMembers: timeSlot.busyMembers,
        });
      } else {
        // Create new time slot
        const votesObj = {};
        votesObj[user.email] = 1; // Creator automatically votes for it
        
        await setDoc(timeSlotRef, {
          date: timeSlot.dateKey,
          dateObj: Timestamp.fromDate(timeSlot.date),
          startHour: timeSlot.startHour,
          endHour: timeSlot.endHour,
          votes: votesObj,
          totalVotes: 1,
          availability: timeSlot.availability,
          availableMembers: timeSlot.availableMembers,
          busyMembers: timeSlot.busyMembers,
          suggestedBy: user.email,
          suggestedAt: Timestamp.now()
        });
        
        // Notify the bucket item creator
        if (user.email !== bucketItem.createdBy) {
          await addDoc(collection(db, "inbox"), {
            to: bucketItem.createdBy,
            from: user.email,
            type: "time-suggestion",
            status: "unread",
            createdAt: new Date().toISOString(),
            message: `${user.email} suggested a time for "${bucketItem.title}": ${formatDate(timeSlot.date)} at ${formatTime(timeSlot.startHour)}`,
            groupId: group.id,
            bucketItemId: bucketItem.id,
            timeSlotId: timeSlotId
          });
        }
      }
      
      setSelectedTimeSlot(timeSlot);
    } catch (error) {
      console.error('Error saving time slot:', error);
      setError('Failed to save time slot. Please try again.');
    }
  };

  // Vote for a time slot
  const handleVoteTimeSlot = async (timeSlotId) => {
    if (!timeSlotId || !group?.id || !bucketItem?.id || !user?.email) return;
    
    try {
      const timeSlotRef = doc(db, `groups/${group.id}/bucketList/${bucketItem.id}/timeSlots`, timeSlotId);
      const timeSlotDoc = await getDoc(timeSlotRef);
      
      if (!timeSlotDoc.exists()) {
        console.error("Time slot not found");
        return;
      }
      
      const timeSlotData = timeSlotDoc.data();
      const currentVotes = timeSlotData.votes || {};
      
      // Check if user has already voted
      if (currentVotes[user.email] === 1) {
        // User is removing their vote
        const updatedVotes = { ...currentVotes };
        delete updatedVotes[user.email];
        
        await updateDoc(timeSlotRef, {
          votes: updatedVotes,
          totalVotes: (timeSlotData.totalVotes || 0) - 1
        });
      } else {
        // User is voting
        const updatedVotes = { ...currentVotes };
        updatedVotes[user.email] = 1;
        
        await updateDoc(timeSlotRef, {
          votes: updatedVotes,
          totalVotes: (timeSlotData.totalVotes || 0) + 1
        });
      }
    } catch (error) {
      console.error("Error voting for time slot:", error);
      setError("Failed to vote for time slot. Please try again.");
    }
  };

  // Schedule the event using the selected time slot
  const handleScheduleEvent = async () => {
    if (!selectedTimeSlot || !group?.id || !bucketItem?.id) return;
    
    try {
      setConfirmingEvent(true);
      
      // Get the selected time slot from Firestore if it exists
      const timeSlotId = selectedTimeSlot.id || 
        `${selectedTimeSlot.dateKey}-${selectedTimeSlot.startHour}-${selectedTimeSlot.endHour}`;
      
      let timeSlotData = null;
      let timeSlotRef = null;
      
      if (selectedTimeSlot.id) {
        // This is a stored time slot
        timeSlotRef = doc(db, `groups/${group.id}/bucketList/${bucketItem.id}/timeSlots`, selectedTimeSlot.id);
        const timeSlotDoc = await getDoc(timeSlotRef);
        
        if (timeSlotDoc.exists()) {
          timeSlotData = timeSlotDoc.data();
        }
      } else {
        // This is a suggested time slot that hasn't been saved yet
        await handleSaveTimeSlot(selectedTimeSlot);
        timeSlotRef = doc(db, `groups/${group.id}/bucketList/${bucketItem.id}/timeSlots`, timeSlotId);
      }
      
      // Format date for the events collection
      const date = selectedTimeSlot.date;
      const dateKey = selectedTimeSlot.dateKey || 
        `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
      
      // Get existing events for that date or create a new object
      const eventsRef = doc(db, `events/${group.id}/dates`, dateKey);
      const eventsDoc = await getDoc(eventsRef);
      
      let bookedSlots = {};
      if (eventsDoc.exists()) {
        bookedSlots = eventsDoc.data().bookedSlots || {};
      }
      
      // Add event for each hour in the duration
      const startHour = selectedTimeSlot.startHour;
      const endHour = selectedTimeSlot.endHour;
      
      for (let hour = startHour; hour < endHour; hour++) {
        const slotKey = `${hour}:00 - ${hour + 1}:00`;
        bookedSlots[slotKey] = {
          title: bucketItem.title,
          description: bucketItem.description || '',
          user: user.email,
          userId: user.uid || user.email,
          createdAt: new Date().toISOString(),
          bucketItemId: bucketItem.id
        };
      }
      
      // Save to events collection
      await setDoc(eventsRef, { bookedSlots }, { merge: true });
      
      // Update the bucket item status to scheduled
      const bucketItemRef = doc(db, `groups/${group.id}/bucketList`, bucketItem.id);
      await updateDoc(bucketItemRef, {
        status: 'scheduled',
        scheduledDate: dateKey,
        scheduledStartHour: startHour,
        scheduledEndHour: endHour,
        scheduledBy: user.email,
        scheduledAt: Timestamp.now()
      });
      
      // Notify all group members about the scheduled event
      for (const member of groupMembers) {
        if (member.email !== user.email) {
          await addDoc(collection(db, "inbox"), {
            to: member.email,
            from: user.email,
            type: "event-scheduled",
            status: "unread",
            createdAt: new Date().toISOString(),
            message: `"${bucketItem.title}" has been scheduled for ${formatDate(date)} at ${formatTime(startHour)}`,
            groupId: group.id,
            bucketItemId: bucketItem.id
          });
        }
      }
      
      // Call callback to notify parent component
      if (onScheduleEvent) {
        onScheduleEvent({
          ...bucketItem,
          scheduledDate: dateKey,
          scheduledTime: `${formatTime(startHour)} - ${formatTime(endHour)}`
        });
      }
      
      // Close the modal
      if (onClose) {
        onClose();
      }
    } catch (error) {
      console.error('Error scheduling event:', error);
      setError('Failed to schedule the event. Please try again.');
    } finally {
      setConfirmingEvent(false);
    }
  };

  const getAvailabilityColorClass = (availability) => {
    if (availability >= 75) return 'high-availability';
    if (availability >= 50) return 'medium-availability';
    if (availability >= 25) return 'low-availability';
    return 'very-low-availability';
  };

  const getUserVote = (votes, email) => {
    if (!votes || !email) return 0;
    return votes[email] || 0;
  };

  const handleSearchChange = (e) => {
    const { name, value } = e.target;
    if (name === 'searchDays') {
      setSearchDays(Number(value));
    } else if (name === 'searchStartDate') {
      setSearchStartDate(value);
    } else if (name === 'businessHoursOnly') {
      setBusinessHoursOnly(e.target.checked);
    }
  };

  // Check if a time slot has reached voting threshold
  const hasReachedVoteThreshold = (timeSlot) => {
    if (!timeSlot || !timeSlot.votes) return false;
    
    const upvotes = Object.values(timeSlot.votes).filter(v => v === 1).length;
    return upvotes >= (bucketItem.voteThreshold || 3);
  };

  return (
    <div className="find-times-container">
      <div className="find-times-header">
        <h2>Find Free Times for "{bucketItem.title}"</h2>
        <button className="close-btn" onClick={onClose}>×</button>
      </div>
      
      <div className="find-times-settings">
        <div className="form-group">
          <label htmlFor="searchStartDate">Start Date:</label>
          <input
            type="date"
            id="searchStartDate"
            name="searchStartDate"
            value={searchStartDate}
            onChange={handleSearchChange}
            min={new Date().toISOString().split('T')[0]}
          />
        </div>
        
        <div className="form-group">
          <label htmlFor="searchDays">Search Range (days):</label>
          <input
            type="number"
            id="searchDays"
            name="searchDays"
            value={searchDays}
            onChange={handleSearchChange}
            min="1"
            max="60"
          />
        </div>
        
        <div className="form-group checkbox">
          <input
            type="checkbox"
            id="businessHoursOnly"
            name="businessHoursOnly"
            checked={businessHoursOnly}
            onChange={handleSearchChange}
          />
          <label htmlFor="businessHoursOnly">Business Hours Only (9 AM - 5 PM, weekdays)</label>
        </div>
        
        <button className="search-btn" onClick={findAvailableTimes}>Search</button>
      </div>
      
      {error && <div className="error-message">{error}</div>}
      
      {/* Saved Time Slots with Votes */}
      {timeSlots.length > 0 && (
        <div className="saved-time-slots">
          <h3>Suggested Time Slots ({timeSlots.length})</h3>
          <div className="time-slots-grid">
            {timeSlots.map((slot) => {
              const userVoted = getUserVote(slot.votes, user.email) === 1;
              const votesCount = Object.values(slot.votes || {}).filter(v => v === 1).length;
              const reachedThreshold = hasReachedVoteThreshold(slot);
              
              return (
                <div 
                  key={slot.id} 
                  className={`saved-time-slot ${getAvailabilityColorClass(slot.availability)} ${selectedTimeSlot?.id === slot.id ? 'selected' : ''} ${reachedThreshold ? 'threshold-reached' : ''}`}
                  onClick={() => setSelectedTimeSlot(slot)}
                >
                  <div className="time-slot-date">{formatDate(slot.dateObj.toDate())}</div>
                  <div className="time-slot-time">
                    {formatTime(slot.startHour)} - {formatTime(slot.endHour)}
                  </div>
                  <div className="time-slot-availability">
                    {slot.availability}% available ({slot.availableMembers.length}/{groupMembers.length})
                  </div>
                  <div className="time-slot-votes">
                    <span className="votes-count">{votesCount} votes</span>
                    <button 
                      className={`vote-btn ${userVoted ? 'voted' : ''}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        handleVoteTimeSlot(slot.id);
                      }}
                    >
                      {userVoted ? '✓ Voted' : 'Vote'}
                    </button>
                  </div>
                  {reachedThreshold && (
                    <div className="threshold-badge">Ready!</div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
      
      {loading ? (
        <div className="loading">Finding free times...</div>
      ) : (
        <div className="free-times-results">
          <h3>Available Times ({freeTimes.length})</h3>
          
          {freeTimes.length > 0 ? (
            <div className="time-slots-list">
              {freeTimes.map((slot, index) => {
                // Check if this slot is already saved
                const savedSlot = timeSlots.find(ts => 
                  ts.date === slot.dateKey && 
                  ts.startHour === slot.startHour && 
                  ts.endHour === slot.endHour
                );
                
                return (
                  <div 
                    key={index} 
                    className={`time-slot ${getAvailabilityColorClass(slot.availability)} ${selectedTimeSlot === slot ? 'selected' : ''} ${savedSlot ? 'already-saved' : ''}`}
                    onClick={() => setSelectedTimeSlot(slot)}
                  >
                    <div className="time-slot-date">{formatDate(slot.date)}</div>
                    <div className="time-slot-time">
                      {formatTime(slot.startHour)} - {formatTime(slot.endHour)}
                    </div>
                    <div className="time-slot-availability">
                      <div className="availability-bar">
                        <div 
                          className={`availability-fill ${getAvailabilityColorClass(slot.availability)}`}
                          style={{ width: `${slot.availability}%` }}
                        ></div>
                      </div>
                      <div className="availability-text">
                        {slot.availability}% available ({slot.availableMembers.length}/{groupMembers.length})
                      </div>
                    </div>
                    
                    {savedSlot ? (
                      <div className="time-slot-saved">Already Suggested</div>
                    ) : (
                      <button 
                        className="suggest-time-btn"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleSaveTimeSlot(slot);
                        }}
                      >
                        Suggest This Time
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="no-times-found">
              <p>No free times found in the selected period. Try adjusting your search criteria.</p>
            </div>
          )}
        </div>
      )}
      
      {/* Show details about selected time slot */}
      {selectedTimeSlot && (
        <div className="selected-time-details">
          <h3>Selected Time Details</h3>
          <div className="time-details">
            <p><strong>Date:</strong> {formatDate(selectedTimeSlot.date || selectedTimeSlot.dateObj?.toDate())}</p>
            <p><strong>Time:</strong> {formatTime(selectedTimeSlot.startHour)} - {formatTime(selectedTimeSlot.endHour)}</p>
            <p><strong>Duration:</strong> {bucketItem.durationHours} hour{bucketItem.durationHours !== 1 ? 's' : ''}</p>
            <p><strong>Availability:</strong> {selectedTimeSlot.availability}% of group members</p>
            
            {selectedTimeSlot.availableMembers?.length > 0 && (
              <div className="members-list">
                <p><strong>Available Members:</strong></p>
                <ul>
                  {selectedTimeSlot.availableMembers.map((email, i) => (
                    <li key={`available-${i}`}>{email}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {selectedTimeSlot.busyMembers?.length > 0 && (
              <div className="members-list">
                <p><strong>Busy Members:</strong></p>
                <ul>
                  {selectedTimeSlot.busyMembers.map((email, i) => (
                    <li key={`busy-${i}`}>{email}</li>
                  ))}
                </ul>
              </div>
            )}
            
            {selectedTimeSlot.votes && Object.keys(selectedTimeSlot.votes).length > 0 && (
              <div className="votes-list">
                <p><strong>Votes:</strong> {Object.values(selectedTimeSlot.votes).filter(v => v === 1).length}</p>
                <ul>
                  {Object.entries(selectedTimeSlot.votes)
                    .filter(([_, vote]) => vote === 1)
                    .map(([email, _], i) => (
                      <li key={`vote-${i}`}>{email}</li>
                    ))
                  }
                </ul>
              </div>
            )}
            
            <div className="selected-actions">
              {/* Show different buttons based on whether it's a saved time slot with votes */}
              {selectedTimeSlot.id ? (
                <>
                  <button 
                    className={`vote-btn ${getUserVote(selectedTimeSlot.votes, user.email) === 1 ? 'voted' : ''}`}
                    onClick={() => handleVoteTimeSlot(selectedTimeSlot.id)}
                  >
                    {getUserVote(selectedTimeSlot.votes, user.email) === 1 ? 'Remove Vote' : 'Vote for This Time'}
                  </button>
                  
                  {(user.email === bucketItem.createdBy || hasReachedVoteThreshold(selectedTimeSlot)) && (
                    <button 
                      className="schedule-btn"
                      onClick={handleScheduleEvent}
                      disabled={confirmingEvent}
                    >
                      {confirmingEvent ? 'Scheduling...' : 'Confirm & Schedule Event'}
                    </button>
                  )}
                </>
              ) : (
                <>
                  <button 
                    className="suggest-btn"
                    onClick={() => handleSaveTimeSlot(selectedTimeSlot)}
                  >
                    Suggest This Time
                  </button>
                  
                  {user.email === bucketItem.createdBy && (
                    <button 
                      className="schedule-btn"
                      onClick={handleScheduleEvent}
                      disabled={confirmingEvent}
                    >
                      {confirmingEvent ? 'Scheduling...' : 'Schedule Without Voting'}
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default FindFreeTimes;