import React, { useState } from 'react';
import './App.css';
import Login from './components/Login';
import CalendarView from './components/CalendarView';
import CreateGroup from './components/CreateGroup';
import Inbox from './components/Inbox';
import FriendsList from './components/FriendsList';
import { useAuth } from './components/AuthContext'; // Make sure your AuthContext is correctly set up
import GoogleCalendarConnector from './components/GoogleCalendarConnector';

function App() {
  const [activePanel, setActivePanel] = useState('calendar');
  const [selectedGroup, setSelectedGroup] = useState(null);
  const [groups, setGroups] = useState(["Work", "Friends", "Family"]);
  const { user, logout } = useAuth(); // Get the logout function from the AuthContext

  // If no user is logged in, show the Login component
  if (!user) {
    return <Login />;
  }

  // Add a new group
  const handleCreateGroup = (groupName) => {
    if (groupName && !groups.includes(groupName)) {
      setGroups((prevGroups) => [...prevGroups, groupName]);
      setActivePanel('calendar');
      setSelectedGroup(groupName);
    }
  };

  // Delete a group
  const handleDeleteGroup = (groupName) => {
    setGroups((prevGroups) => prevGroups.filter((group) => group !== groupName));
    if (selectedGroup === groupName) {
      setSelectedGroup(null);
      setActivePanel('calendar');
    }
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
            {groups.map((group, index) => (
              <li key={index} className="group-item">
                <button
                  className="group-button"
                  onClick={() => {
                    setSelectedGroup(group);
                    setActivePanel('calendar');
                  }}
                >
                  <span className="group-text">{group}</span>
                  <button
                    className="delete-button"
                    onClick={(e) => {
                      e.stopPropagation(); // Prevent clicking the group button
                      handleDeleteGroup(group);
                    }}
                    title={`Delete ${group}`}
                  >
                    ❌
                  </button>
                </button>
                {/* <button
                  className="delete-button"
                  onClick={() => handleDeleteGroup(group)}
                  title={`Delete ${group}`}
                >
                  ❌
                </button> */}
              </li>
            ))}
          </ul>
        </aside>

        {/* Center Panel - Dynamic Content */}
        <main className="center-panel">
          {activePanel === 'calendar' && <CalendarView group={selectedGroup} user={user} />}
          {activePanel === 'create-group' && <CreateGroup onCreateGroup={handleCreateGroup} />}
          {activePanel === 'inbox' && <Inbox user={user} />}
          {activePanel === 'friends-list' && <FriendsList user={user} />}
        </main>

        {/* Right Sidebar - Icons for Changing Panel */}
        <aside className="right-sidebar">
          <GoogleCalendarConnector 
          groups={groups}
          onSync={() => console.log('Calendar synced!')} 
          />
          <button onClick={() => setActivePanel('create-group')}>➕</button>
          <button onClick={() => setActivePanel('inbox')}>💬</button>
          <button onClick={() => setActivePanel('friends-list')}>👥</button>
        </aside>
      </div>
    </div>
  );
}

export default App;