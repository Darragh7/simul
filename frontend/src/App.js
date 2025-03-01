import React, { useState, useEffect } from 'react';
import './App.css';
import Login from './components/Login';
import CalendarView from './components/CalendarView';
import CreateGroup from './components/CreateGroup';
import Inbox from './components/Inbox';
import FriendsList from './components/FriendsList';
import { useAuth } from './components/AuthContext';
import GoogleCalendarConnector from './components/GoogleCalendarConnector';
import { collection, query, where, onSnapshot, doc, updateDoc, getDoc, arrayUnion, setDoc} from "firebase/firestore";
import { db } from './firebase/firebase';

function App() {
  const [activePanel, setActivePanel] = useState('calendar');
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groups, setGroups] = useState([]);
  const [friendRequests, setFriendRequests] = useState([]);
  const [isLoggingOut, setIsLoggingOut] = useState(false);
  const { user, logout } = useAuth();

  useEffect(() => {
    // Clear selected group when user changes
    setSelectedGroup(null);
  }, [user?.email]);
  
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

  // Handle logout with Google Calendar disconnection
  const handleLogout = async () => {
    try {
      setIsLoggingOut(true);
      setSelectedGroup(null);
      await logout(); // This will call our updated logout function that disconnects calendar
      // No need for redirect as AuthContext will handle the state change
    } catch (error) {
      console.error('Error logging out:', error);
      alert('There was a problem logging out. Please try again.');
    } finally {
      setIsLoggingOut(false);
    }
  };

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
  // Updated group invitation acceptance function for App.js
const acceptGroupInvite = async (requestId, groupId, groupName) => {
  const requestDoc = doc(db, "inbox", requestId);
  const groupDoc = doc(db, "groups", groupId);

  try {
    // Get the current group data
    const groupSnapshot = await getDoc(groupDoc);
    if (!groupSnapshot.exists()) {
      console.error("Group not found:", groupId);
      return;
    }

    const groupData = groupSnapshot.data();
    
    // 1. Update the group document to add the user to members and remove from pendingMembers
    await updateDoc(groupDoc, {
      members: arrayUnion(user.email),
      pendingMembers: groupData.pendingMembers.filter(email => email !== user.email)
    });

    // 2. Add the user to the members subcollection
    await setDoc(doc(db, `groups/${groupId}/members`, user.email), {
      email: user.email,
      displayName: user.displayName || user.email.split('@')[0],
      role: 'member',
      joinedAt: new Date().toISOString()
    });

    // 3. Update user_groups collection to include this group
    const userGroupsRef = doc(db, "user_groups", user.email);
    const userGroupsSnap = await getDoc(userGroupsRef);
    
    if (userGroupsSnap.exists()) {
      // Update existing document
      await updateDoc(userGroupsRef, {
        groups: arrayUnion(groupId)
      });
    } else {
      // Create new document
      await setDoc(userGroupsRef, {
        email: user.email,
        groups: [groupId]
      });
    }

    // 4. Update request status to accepted
    await updateDoc(requestDoc, {
      status: 'accepted'
    });

    // Re-fetch friend requests
    setFriendRequests(prevRequests => prevRequests.filter(request => request.id !== requestId));
    
    // Show success notification
    alert(`You have successfully joined the group "${groupName}"`);
  } catch (error) {
    console.error("Error accepting group invitation:", error);
    alert("Failed to join group. Please try again.");
  }
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
        <button 
          className="logout-button" 
          onClick={handleLogout}
          disabled={isLoggingOut}
        >
          {isLoggingOut ? 'Logging out...' : 'Logout'}
        </button>
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
                
                  {group.createdBy === user.email && (
                    <button
                      className="delete-button"
                      onClick={() => handleDeleteGroup(group.id)}
                      title={`Delete ${group.name}`}
                    >
                      ❌
                    </button>
                  )}
                </button>
              </li>
            ))}
          </ul>
        </aside>

        {/* Center Panel - Dynamic Content */}
        <main className="center-panel">
          {activePanel === 'calendar' && <CalendarView group={selectedGroup} user={user} />}
          {activePanel === 'create-group' && <CreateGroup userEmail={user.email} onGroupCreated={() => setActivePanel('calendar')} />}
          {activePanel === 'inbox' && <Inbox userEmail={user.email} friendRequests={friendRequests} acceptFriendRequest={acceptFriendRequest} rejectFriendRequest={rejectFriendRequest} acceptGroupInvite={acceptGroupInvite} rejectGroupInvite={rejectGroupInvite} />}
          {activePanel === 'friends-list' && <FriendsList userEmail={user.email} />}
        </main>

        {/* Right Sidebar - Icons for Changing Panel */}
        <aside className="right-sidebar">
          <div className="google-sync">
            <GoogleCalendarConnector 
            groups={groups}
            onSync={() => console.log('Calendar synced!')} 
            />
          </div>
          <button onClick={handlePlusClick} title="Create Group">➕</button>
          <button onClick={() => setActivePanel('inbox')} title="Inbox">💬</button>
          <button onClick={() => setActivePanel('friends-list')} title="Friends List">👥</button>
        </aside>
      </div>
    </div>
  );
}

export default App;