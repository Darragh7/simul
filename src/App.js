import React, { useState } from 'react';
import './App.css';
import CalendarView from './components/CalendarView';
import CreateGroup from './components/CreateGroup';
import Inbox from './components/Inbox';
import FriendsList from './components/FriendsList';

function App() {
    const [activePanel, setActivePanel] = useState('calendar'); 
    const [selectedGroup, setSelectedGroup] = useState(null);

    const groups = ["Work", "Friends", "Family"];

    return (
        <div className="app-container">
            {/* Header */}
            <header className="header">Simul</header>

            <div className="main-container">
                {/* Left Sidebar - Groups */}
                <aside className="left-sidebar">
                    <h3>Groups</h3>
                    <ul>
                        {groups.map((group, index) => (
                            <li key={index}>
                                <button 
                                    className="group-button" 
                                    onClick={() => { 
                                        setSelectedGroup(group);
                                        setActivePanel('calendar');
                                    }}
                                >
                                    {group}
                                </button>
                            </li>
                        ))}
                    </ul>
                </aside>

                {/* Center Panel - Dynamic Content */}
                <main className="center-panel">
                    {activePanel === 'calendar' && <CalendarView group={selectedGroup} />}
                    {activePanel === 'create-group' && <CreateGroup />}
                    {activePanel === 'inbox' && <Inbox />}
                    {activePanel === 'friends-list' && <FriendsList />}
                </main>

                {/* Right Sidebar - Icons for Changing Panel */}
                <aside className="right-sidebar">
                    <button onClick={() => setActivePanel('create-group')}>➕</button>
                    <button onClick={() => setActivePanel('inbox')}>💬</button>
                    <button onClick={() => setActivePanel('friends-list')}>👥</button> {/* Group icon for friends list */}
                </aside>
            </div>
        </div>
    );
}

export default App;
