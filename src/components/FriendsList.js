import React from 'react';

function FriendsList() {
    const friends = ["Alice", "Bob", "Charlie", "David"];

    return (
        <div className="panel-content">
            <h2>Friends List</h2>
            <ul>
                {friends.map((friend, index) => (
                    <li key={index}>{friend}</li>
                ))}
            </ul>
        </div>
    );
}

export default FriendsList;
