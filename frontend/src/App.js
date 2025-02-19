import React, { useState, useEffect } from 'react';
import './App.css';
import CalendarView from './components/CalendarView';
import CreateGroup from './components/CreateGroup';
import Inbox from './components/Inbox';
import FriendsList from './components/FriendsList';
import Login from './components/Login';

function App() {
    const [activePanel, setActivePanel] = useState('calendar'); 
    const [selectedGroup, setSelectedGroup] = useState(null);
    const [isAuthenticated, setIsAuthenticated] = useState(false);
    const groups = ["Work", "Friends", "Family"];

    useEffect(() => {
        const verifyToken = async () => {
          const token = localStorage.getItem('token');
          if (token) {
            try {
              const response = await fetch('http://localhost:5000/api/auth/verify', {
                headers: {
                  'Authorization': `Bearer ${token}`
                }
              });
              const data = await response.json();
              setIsAuthenticated(data.isAuthenticated);
            } catch (error) {
              console.error('Token verification failed:', error);
              localStorage.removeItem('token');
              setIsAuthenticated(false);
            }
          }
        };
    
        verifyToken();
      }, []);

    const handleLoginSuccess = () => {
        setIsAuthenticated(true);
    };

    const handleLogout = () => {
        localStorage.removeItem('token');
        setIsAuthenticated(false);
        window.location.href = 'http://localhost:5000/logout';
    };

    // If not authenticated, show login page
    if (!isAuthenticated) {
        return <Login onLoginSuccess={handleLoginSuccess} />;
    }

    return (
        <div className="app-container">
            {/* Header */}
            <header className="header">
                Simul
                <button 
                    onClick={handleLogout}
                    className="logout-button"
                >
                    Logout
                </button>
            </header>

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
                    <button onClick={() => setIsLoggedIn(false)}>🚪 Logout</button> {/* Logout Button */}

                </aside>
            </div>
        </div>
    );
}

export default App;
