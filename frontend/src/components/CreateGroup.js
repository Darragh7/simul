import React, { useState, useEffect } from "react";
import { db } from "../firebase/firebase";
import {
    collection,
    addDoc,
    Timestamp,
    query,
    where,
    getDocs,
    doc,
    setDoc,
    getDoc,
    updateDoc,
    arrayUnion
} from "firebase/firestore";

function CreateGroup({ userEmail, onGroupCreated }) {
    const [groupName, setGroupName] = useState("");
    const [friends, setFriends] = useState([]);
    const [selectedFriends, setSelectedFriends] = useState([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");
    const [existingGroups, setExistingGroups] = useState([]); // State for existing groups
    const [selectedGroup, setSelectedGroup] = useState(""); // State for selected existing group

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

    // Fetch existing groups
    useEffect(() => {
        const fetchExistingGroups = async () => {
            if (!userEmail) return;

            try {
                setLoading(true);
                const userGroupsRef = doc(db, "user_groups", userEmail);
                const userGroupsSnap = await getDoc(userGroupsRef);

                if (userGroupsSnap.exists()) {
                    const groupIds = userGroupsSnap.data().groups || [];
                    const groupsQuery = query(collection(db, "groups"), where("__name__", "in", groupIds));
                    const groupsSnap = await getDocs(groupsQuery);
                    const groups = groupsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
                    setExistingGroups(groups);
                } else {
                    setExistingGroups([]);
                }
            } catch (err) {
                console.error("Error fetching existing groups:", err);
                setError("Failed to load existing groups");
            } finally {
                setLoading(false);
            }
        };

        fetchExistingGroups();
    }, [userEmail]);

    const handleCreate = async () => {
        if (!userEmail) {
            setError("You must be logged in to create a group");
            return;
        }

        if (!groupName.trim() && !selectedGroup) {
            setError("Please enter a group name or select an existing group");
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
            let groupId;

            if (selectedGroup) {
                // Add friends to an existing group
                groupId = selectedGroup;
                await updateDoc(doc(db, "groups", groupId), {
                    pendingMembers: arrayUnion(...selectedFriends)
                });
            } else {
                // Create a new group
                const groupRef = await addDoc(collection(db, "groups"), {
                    name: groupName.trim(),
                    members: [userEmail],
                    pendingMembers: selectedFriends,
                    createdBy: userEmail,
                    createdAt: Timestamp.now(),
                    isActive: true
                });

                groupId = groupRef.id;

                await setDoc(doc(db, `groups/${groupId}/members`, userEmail), {
                    email: userEmail,
                    displayName: userEmail.split('@')[0],
                    role: 'admin',
                    joinedAt: Timestamp.now()
                });

                const userGroupsRef = doc(db, "user_groups", userEmail);
                const userGroupsSnap = await getDoc(userGroupsRef);

                if (userGroupsSnap.exists()) {
                    await updateDoc(userGroupsRef, {
                        groups: arrayUnion(groupId)
                    });
                } else {
                    await setDoc(userGroupsRef, {
                        email: userEmail,
                        groups: [groupId]
                    });
                }
            }

            // Send invitations to selected friends
            const invitationPromises = selectedFriends.map(async (friendEmail) => {
                return addDoc(collection(db, "inbox"), {
                    to: friendEmail,
                    from: userEmail,
                    type: "group-invite",
                    groupName: selectedGroup ? existingGroups.find(g => g.id === selectedGroup).name : groupName.trim(),
                    groupId: groupId,
                    status: "pending",
                    createdAt: Timestamp.now(),
                    message: `${userEmail} invited you to join the group "${selectedGroup ? existingGroups.find(g => g.id === selectedGroup).name : groupName.trim()}"`
                });
            });

            await Promise.all(invitationPromises);

            setSuccess(selectedGroup ? "Friends added to group and invitations sent!" : "Group created and invitations sent!");
            setGroupName("");
            setSelectedFriends([]);
            setSelectedGroup("");

            if (onGroupCreated) {
                setTimeout(() => {
                    onGroupCreated();
                }, 1500);
            }
        } catch (error) {
            console.error("Error creating group or adding friends:", error);
            setError("Failed to create group or add friends");
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
            <h2>Create a New Group or Add Friends to an Existing Group</h2>

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
                        disabled={!!selectedGroup}
                    />
                </div>

                <div className="select-existing-group">
                    <h3>Or Add Friends to an Existing Group</h3>
                    <select
                        value={selectedGroup}
                        onChange={(e) => setSelectedGroup(e.target.value)}
                        disabled={loading || existingGroups.length === 0}
                    >
                        <option value="">Select a group</option>
                        {existingGroups.map((group) => (
                            <option key={group.id} value={group.id}>
                                {group.name}
                            </option>
                        ))}
                    </select>
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
                    disabled={creating || (!groupName.trim() && !selectedGroup) || selectedFriends.length === 0}
                    className="create-group-btn"
                >
                    {creating ? (selectedGroup ? "Adding Friends..." : "Creating...") : (selectedGroup ? "Add Friends to Group" : "Create Group")}
                </button>
            </div>
        </div>
    );
}

export default CreateGroup;