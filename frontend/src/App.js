import React, { useState } from 'react';
import './App.css';
import CalendarView from './components/CalendarView';
import CreateGroup from './components/CreateGroup';
import Inbox from './components/Inbox';
import FriendsList from './components/FriendsList';
import { useAuth } from './components/AuthContext'; // Make sure your AuthContext is correctly set up

function App() {
    const [activePanel, setActivePanel] = useState('calendar'); 
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [groups, setGroups] = useState(["Work", "Friends", "Family"]);

    const { logout } = useAuth(); // Get the logout function from the AuthContext

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
                                    {group}
                                </button>
                                <button 
                                    className="delete-button" 
                                    onClick={() => handleDeleteGroup(group)}
                                    title={`Delete ${group}`}
                                >
                                    ❌
                                </button>
                            </li>
                        ))}
                    </ul>
                </aside>

                {/* Center Panel - Dynamic Content */}
                <main className="center-panel">
                    {activePanel === 'calendar' && <CalendarView group={selectedGroup} />}
                    {activePanel === 'create-group' && <CreateGroup onCreateGroup={handleCreateGroup} />}
                    {activePanel === 'inbox' && <Inbox />}
                    {activePanel === 'friends-list' && <FriendsList />}
                </main>

                {/* Right Sidebar - Icons for Changing Panel */}
                <aside className="right-sidebar">
                    <button onClick={() => setActivePanel('create-group')}>➕</button>
                    <button onClick={() => setActivePanel('inbox')}>💬</button>
                    <button onClick={() => setActivePanel('friends-list')}>👥</button>
                </aside>
            </div>
        </div>
    );
}

export default App;


