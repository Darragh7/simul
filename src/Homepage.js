import React from 'react';

function HomePage() {
    return (
        <div className="app-container">
            {/* Header */}
            <header className="header">
                <h1>Simul</h1>
            </header>

            <div className="main-layout">
                {/* Left Sidebar */}
                <aside className="sidebar-left">
                    <h2>Groups</h2>
                    <ul>
                        <li>Group 1</li>
                        <li>Group 2</li>
                        <li>Group 3</li>
                    </ul>
                </aside>

                {/* Main Calendar Section */}
                <main className="calendar-section">
                    <h2>Calendar</h2>
                    {/* Placeholder for Calendar */}
                    <div className="calendar-placeholder">
                        <p>Your calendar will go here</p>
                    </div>
                </main>

                {/* Right Sidebar */}
                <aside className="sidebar-right">
                    <div className="icon">
                        <span>➕</span> {/* Add Icon */}
                    </div>
                    <div className="icon">
                        <span>💬</span> {/* Message Icon */}
                    </div>
                    <div className="icon">
                        <span>👥</span> {/* People Icon */}
                    </div>
                </aside>
            </div>
        </div>
    );
}

export default HomePage;
