import React, { useState, useEffect } from "react";
import { db } from "../firebase/firebase";
import { 
    collection, 
    query, 
    where, 
    getDocs, 
    addDoc, 
    Timestamp,
    doc,
    getDoc,
    updateDoc,
    arrayUnion
} from "firebase/firestore";

function InviteToGroup({ group, userEmail, onClose }) {
    const [friends, setFriends] = useState([]);
    const [selectedFriends, setSelectedFriends] = useState([]);
    const [loading, setLoading] = useState(true);
    const [sending, setSending] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [existingMembers, setExistingMembers] = useState([]);
    const [pendingMembers, setPendingMembers] = useState([]);

    // Get group ID based on group object or string
    const getGroupId = () => {
        if (!group) return null;
        return typeof group === 'object' ? group.id : group;
    };

    const getGroupName = () => {
        if (!group) return "Unknown Group";
        return typeof group === 'object' ? group.name : "Group";
    };

    // Fetch friends list and existing group members
    useEffect(() => {
        const fetchData = async () => {
            if (!userEmail || !group) return;
            
            try {
                setLoading(true);
                
                // Fetch friends list
                const userSnap = await getDocs(query(collection(db, "users"), where("email", "==", userEmail)));
                
                if (!userSnap.empty) {
                    const userData = userSnap.docs[0].data();
                    setFriends(userData.friends || []);
                } else {
                    setFriends([]);
                }
                
                // Fetch existing group members
                const groupId = getGroupId();
                const groupSnap = await getDoc(doc(db, "groups", groupId));
                
                if (groupSnap.exists()) {
                    const groupData = groupSnap.data();
                    setExistingMembers(groupData.members || []);
                    setPendingMembers(groupData.pendingMembers || []);
                }
            } catch (err) {
                console.error("Error fetching data:", err);
                setError("Failed to load data");
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [userEmail, group]);

    const handleFriendToggle = (friend) => {
        setSelectedFriends((prevSelected) =>
            prevSelected.includes(friend)
                ? prevSelected.filter((f) => f !== friend)
                : [...prevSelected, friend]
        );
    };

    const handleSendInvites = async () => {
        if (!userEmail) {
            setError("You must be logged in to invite friends");
            return;
        }

        if (selectedFriends.length === 0) {
            setError("Please select at least one friend to invite");
            return;
        }

        const groupId = getGroupId();
        if (!groupId) {
            setError("Invalid group");
            return;
        }

        setError("");
        setSuccess("");
        setSending(true);

        try {
            // Update group's pendingMembers list
            await updateDoc(doc(db, "groups", groupId), {
                pendingMembers: arrayUnion(...selectedFriends)
            });

            // Send invitations to selected friends
            const invitationPromises = selectedFriends.map(async (friendEmail) => {
                return addDoc(collection(db, "inbox"), {
                    to: friendEmail,
                    from: userEmail,
                    type: "group-invite",
                    groupName: getGroupName(),
                    groupId: groupId,
                    status: "pending",
                    createdAt: Timestamp.now(),
                    message: `${userEmail} invited you to join the group "${getGroupName()}"`
                });
            });

            await Promise.all(invitationPromises);

            setSuccess("Invitations sent successfully!");
            setSelectedFriends([]);
            
            // Close modal after a delay
            setTimeout(() => {
                if (onClose) onClose();
            }, 1500);
        } catch (error) {
            console.error("Error sending invitations:", error);
            setError("Failed to send invitations");
        } finally {
            setSending(false);
        }
    };

    // Filter out friends who are already members or have pending invites
    const availableFriends = friends.filter(
        friend => !existingMembers.includes(friend) && !pendingMembers.includes(friend)
    );

    return (
        <div className="invite-to-group-container">
            <h2>Invite Friends to {getGroupName()}</h2>
            
            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">{success}</div>}

            <div className="invite-form">
                <div className="select-friends">
                    <h3>Select Friends to Invite</h3>
                    {loading ? (
                        <div>Loading your friends list...</div>
                    ) : availableFriends.length > 0 ? (
                        <div className="friends-selection-list">
                            {availableFriends.map((friend, index) => (
                                <div key={index} className="friend-selection-item">
                                    <input
                                        type="checkbox"
                                        id={`invite-friend-${index}`}
                                        checked={selectedFriends.includes(friend)}
                                        onChange={() => handleFriendToggle(friend)}
                                    />
                                    <label htmlFor={`invite-friend-${index}`}>{friend}</label>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p>No friends available to invite. All your friends are already in this group or have pending invitations.</p>
                    )}
                </div>

                <div className="selected-count">
                    Selected: {selectedFriends.length} friend(s)
                </div>

                <div className="button-container">
                    <button 
                        onClick={handleSendInvites} 
                        disabled={sending || selectedFriends.length === 0}
                        className="send-invites-btn"
                    >
                        {sending ? "Sending..." : "Send Invitations"}
                    </button>
                    <button 
                        onClick={onClose} 
                        className="cancel-btn"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        </div>
    );
}

export default InviteToGroup;