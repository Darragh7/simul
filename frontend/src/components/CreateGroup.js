import React, { useState } from 'react';

function CreateGroup({ onCreateGroup, friends = [] }) {
    const [groupName, setGroupName] = useState('');
    const [selectedFriends, setSelectedFriends] = useState([]);

    const handleCreate = () => {
        if (groupName.trim()) {
            // If no friends are selected, still allow creation of the group
            onCreateGroup(groupName.trim(), selectedFriends);
            setGroupName('');
            setSelectedFriends([]);
        }
    };

    const handleFriendClick = (friend) => {
        setSelectedFriends((prevSelected) =>
            prevSelected.includes(friend)
                ? prevSelected.filter((f) => f !== friend)
                : [...prevSelected, friend]
        );
    };

    return (
        <div className="panel-content">
            <h2>Create a New Group</h2>

            {/* Group Name Input */}
            <input
                type="text"
                placeholder="Group Name"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
            />

            {/* Friends List with Clickable Boxes */}
            <div className="friends-list">
                {friends.length > 0 ? (
                    friends.map((friend, index) => (
                        <div
                            key={index}
                            className={`friend-box ${selectedFriends.includes(friend) ? 'selected' : ''}`}
                            onClick={() => handleFriendClick(friend)}
                        >
                            {friend}
                        </div>
                    ))
                ) : (
                    <p>No friends to display.</p>
                )}
            </div>

            {/* Create Button */}
            <button
                onClick={handleCreate}
                disabled={!groupName.trim()} // Disable if the group name is empty
            >
                Create
            </button>
        </div>
    );
}

export default CreateGroup;
