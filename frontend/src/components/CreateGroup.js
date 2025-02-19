import React, { useState } from 'react';

function CreateGroup({ onCreateGroup }) {
    const [groupName, setGroupName] = useState('');

    const handleCreate = () => {
        if (groupName.trim()) {
            onCreateGroup(groupName.trim());
            setGroupName('');
        }
    };

    return (
        <div className="panel-content">
            <h2>Create a New Group</h2>
            <input 
                type="text" 
                placeholder="Group Name" 
                value={groupName} 
                onChange={(e) => setGroupName(e.target.value)} 
            />
            <button onClick={handleCreate}>Create</button>
        </div>
    );
}

export default CreateGroup;
