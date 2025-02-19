import React from 'react';

function Inbox() {
    return (
        <div className="panel-content">
            <h2>Inbox</h2>
            <p>Notifications and invitations will appear here.</p>

            {/* Notification Rectangles */}
            <div className="notification-list">
                <div className="notification-item">
                    <span className="notification-title">Friend Request</span>
                    <span className="notification-time">5 minutes ago</span>
                </div>
                <div className="notification-item">
                    <span className="notification-title">Calendar Group Invite</span>
                    <span className="notification-time">2 hours ago</span>
                </div>
                <div className="notification-item">
                    <span className="notification-title">New Message</span>
                    <span className="notification-time">1 day ago</span>
                </div>
            </div>
        </div>
    );
}

export default Inbox;
