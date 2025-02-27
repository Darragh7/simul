import React, { useState, useEffect } from 'react';
import './App.css';
import Login from './components/Login';
import CalendarView from './components/CalendarView';
import CreateGroup from './components/CreateGroup';
import Inbox from './components/Inbox';
import FriendsList from './components/FriendsList';
import { useAuth } from './components/AuthContext';
import GoogleCalendarConnector from './components/GoogleCalendarConnector';
import { collection, query, where, onSnapshot, getDocs, doc, updateDoc } from "firebase/firestore";
import { db } from './firebase/firebase';

function App() {
  const [activePanel, setActivePanel] = useState('calendar');
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groups, setGroups] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const { user, logout } = useAuth();

  // Fetch groups from Firestore
  useEffect(() => {
    if (!user?.email) return;

    const unsubscribe = onSnapshot(
      query(collection(db, "groups"), where("members", "array-contains", user.email)),
      (snapshot) => {
        const groupsData = [];
        snapshot.forEach((doc) => {
          groupsData.push({
            id: doc.id,
            ...doc.data()
          });
        });
        setGroups(groupsData);
      },
      (error) => {
        console.error("Error fetching groups:", error);
      }
    );

    return () => unsubscribe();
  }, [user]);

  // Fetch friend requests (inbox notifications)
  useEffect(() => {
    if (!user?.email) return;

    const requestsQuery = query(
      collection(db, "inbox"),
      where("to", "==", user.email),
      where("status", "==", "pending")
    );

    const unsubscribe = onSnapshot(requestsQuery, (snapshot) => {
      const requests = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setFriendRequests(requests.filter(req => req.type === "friend-request" || req.type === "group-invite"));
    });

    return () => unsubscribe();
  }, [user]);

  // If no user is logged in, show the Login component
  if (!user) {
    return <Login />;
  }

  // Handle sidebar plus button click
  const handlePlusClick = () => {
    setActivePanel('create-group');
  };

  // Delete a group (you would add Firestore delete functionality here)
  const handleDeleteGroup = (groupId) => {
    // This would need to be updated with Firestore delete logic
    setGroups((prevGroups) => prevGroups.filter((group) => group.id !== groupId));
    if (selectedGroup?.id === groupId) {
      setSelectedGroup(null);
      setActivePanel('calendar');
    }
  };

  // Handle accepting a friend request
  const acceptFriendRequest = async (requestId, fromEmail) => {
    // Update the request status to 'accepted'
    const requestDoc = doc(db, "inbox", requestId);
    await updateDoc(requestDoc, {
      status: 'accepted'
    });

    // Add the user to each other's friend list (example implementation)
    const userRef = doc(db, "users", user.email);
    const friendRef = doc(db, "users", fromEmail);

    await updateDoc(userRef, {
      friends: [...user.friends, fromEmail]
    });

    await updateDoc(friendRef, {
      friends: [...friendRef.friends, user.email]
    });

    // Re-fetch friend requests
    setFriendRequests(prevRequests => prevRequests.filter(request => request.id !== requestId));
  };

  // Handle rejecting a friend request
  const rejectFriendRequest = async (requestId) => {
    const requestDoc = doc(db, "inbox", requestId);
    await updateDoc(requestDoc, {
      status: 'rejected'
    });

    // Re-fetch friend requests
    setFriendRequests(prevRequests => prevRequests.filter(request => request.id !== requestId));
  };

  // Handle accepting a group invitation
  const acceptGroupInvite = async (requestId, groupId) => {
    const requestDoc = doc(db, "inbox", requestId);
    const groupDoc = doc(db, "groups", groupId);

    // Add the user to the group
    await updateDoc(groupDoc, {
      members: [...groupId.members, user.email]
    });

    // Update request status to accepted
    await updateDoc(requestDoc, {
      status: 'accepted'
    });

    // Re-fetch friend requests
    setFriendRequests(prevRequests => prevRequests.filter(request => request.id !== requestId));
  };

  // Handle rejecting a group invitation
  const rejectGroupInvite = async (requestId) => {
    const requestDoc = doc(db, "inbox", requestId);
    await updateDoc(requestDoc, {
      status: 'rejected'
    });

    // Re-fetch friend requests
    setFriendRequests(prevRequests => prevRequests.filter(request => request.id !== requestId));
  };

  return (
    <div className="app-container">
      {/* Header */}
      <header className="header">
        Simul
        <div className="user-info">
          {user.displayName || user.email}
        </div>
        <button className="logout-button" onClick={logout}>Logout</button>
      </header>
    
      <div className="main-container">
        {/* Left Sidebar - Groups */}
        <aside className="left-sidebar">
          <h3>Groups</h3>
          <ul>
            {groups.map((group) => (
              <li key={group.id} className="group-item">
                <button
                  className="group-button"
                  onClick={() => {
                    setSelectedGroup(group);
                    setActivePanel('calendar');
                  }}
                >
                  {group.name}
                </button>
                {group.createdBy === user.email && (
                  <button
                    className="delete-button"
                    onClick={() => handleDeleteGroup(group.id)}
                    title={`Delete ${group.name}`}
                  >
                    ❌
                  </button>
                )}
              </li>
            ))}
          </ul>
        </aside>

        {/* Center Panel - Dynamic Content */}
        <main className="center-panel">
          {activePanel === 'calendar' && <CalendarView group={selectedGroup} userEmail={user.email} />}
          {activePanel === 'create-group' && <CreateGroup userEmail={user.email} onGroupCreated={() => setActivePanel('calendar')} />}
          {activePanel === 'inbox' && <Inbox userEmail={user.email} friendRequests={friendRequests} acceptFriendRequest={acceptFriendRequest} rejectFriendRequest={rejectFriendRequest} acceptGroupInvite={acceptGroupInvite} rejectGroupInvite={rejectGroupInvite} />}
          {activePanel === 'friends-list' && <FriendsList userEmail={user.email} />}
        </main>

        {/* Right Sidebar - Icons for Changing Panel */}
        <aside className="right-sidebar">
          <GoogleCalendarConnector 
            groupNames={groups.map(group => group.name)} 
            onSync={() => console.log('Calendar synced!')} 
          />
          <button onClick={handlePlusClick} title="Create Group">➕</button>
          <button onClick={() => setActivePanel('inbox')} title="Inbox">💬</button>
          <button onClick={() => setActivePanel('friends-list')} title="Friends List">👥</button>
        </aside>
      </div>
    </div>
  );
}

export default App;
