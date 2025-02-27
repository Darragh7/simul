import React, { useState, useEffect } from "react";
import { db } from "../firebase/firebase";
import { collection, addDoc, Timestamp, query, where, getDocs } from "firebase/firestore";

function CreateGroup({ userEmail, onGroupCreated }) {
    const [groupName, setGroupName] = useState("");
    const [friends, setFriends] = useState([]);
    const [selectedFriends, setSelectedFriends] = useState([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    // Fetch friends list
    useEffect(() => {
        const fetchFriends = async () => {
            if (!userEmail) return;
            
            try {
                setLoading(true);
                const userSnap = await getDocs(query(collection(db, "users"), where("email", "==", userEmail)));
                
                if (!userSnap.empty) {
                    const userData = userSnap.docs[0].data();
                    setFriends(userData.friends || []);
                } else {
                    setFriends([]);
                }
            } catch (err) {
                console.error("Error fetching friends:", err);
                setError("Failed to load friends list");
            } finally {
                setLoading(false);
            }
        };

        fetchFriends();
    }, [userEmail]);

    const handleCreate = async () => {
        if (!userEmail) {
            setError("You must be logged in to create a group");
            return;
        }

        if (!groupName.trim()) {
            setError("Please enter a group name");
            return;
        }

        if (selectedFriends.length === 0) {
            setError("Please select at least one friend");
            return;
        }

        setError("");
        setSuccess("");
        setCreating(true);

        try {
            // Create a new group document in Firestore
            const groupRef = await addDoc(collection(db, "groups"), {
                name: groupName.trim(),
                members: [userEmail], // Start with just the creator
                pendingMembers: selectedFriends, // Track pending members
                createdBy: userEmail,
                createdAt: Timestamp.now(),
                isActive: false // Calendar not active until all members accept
            });

            // Send invitations to selected friends
            const invitationPromises = selectedFriends.map(async (friendEmail) => {
                return addDoc(collection(db, "inbox"), {
                    to: friendEmail,
                    from: userEmail,
                    type: "group-invite",
                    groupName: groupName.trim(),
                    groupId: groupRef.id,
                    status: "pending",
                    createdAt: Timestamp.now(),
                });
            });

            await Promise.all(invitationPromises);

            setSuccess("Group created and invitations sent!");
            setGroupName("");
            setSelectedFriends([]);
            
            // Optionally navigate back to calendar view after creation
            if (onGroupCreated) {
                setTimeout(() => {
                    onGroupCreated();
                }, 1500);
            }
        } catch (error) {
            console.error("Error creating group:", error);
            setError("Failed to create group");
        } finally {
            setCreating(false);
        }
    };

    const handleFriendToggle = (friend) => {
        setSelectedFriends((prevSelected) =>
            prevSelected.includes(friend)
                ? prevSelected.filter((f) => f !== friend)
                : [...prevSelected, friend]
        );
    };

    return (
        <div className="create-group-container">
            <h2>Create a New Group</h2>
            
            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">{success}</div>}

            <div className="group-form">
                <div className="group-name-input">
                    <label htmlFor="group-name">Group Name:</label>
                    <input
                        type="text"
                        id="group-name"
                        placeholder="Enter group name"
                        value={groupName}
                        onChange={(e) => setGroupName(e.target.value)}
                    />
                </div>

                <div className="select-friends">
                    <h3>Select Friends to Invite</h3>
                    {loading ? (
                        <div>Loading your friends list...</div>
                    ) : friends.length > 0 ? (
                        <div className="friends-selection-list">
                            {friends.map((friend, index) => (
                                <div key={index} className="friend-selection-item">
                                    <input
                                        type="checkbox"
                                        id={`friend-${index}`}
                                        checked={selectedFriends.includes(friend)}
                                        onChange={() => handleFriendToggle(friend)}
                                    />
                                    <label htmlFor={`friend-${index}`}>{friend}</label>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p>You don't have any friends yet. Add friends first!</p>
                    )}
                </div>

                <div className="selected-count">
                    Selected: {selectedFriends.length} friend(s)
                </div>

                <button 
                    onClick={handleCreate} 
                    disabled={creating || !groupName.trim() || selectedFriends.length === 0}
                    className="create-group-btn"
                >
                    {creating ? "Creating..." : "Create Group"}
                </button>
            </div>
        </div>
    );
}

export default CreateGroup;

