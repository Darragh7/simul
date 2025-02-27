import React, { useState, useEffect } from "react";
import { db } from "../firebase/firebase";
import {
    collection,
    query,
    where,
    doc,
    updateDoc,
    onSnapshot,
    arrayUnion,
    arrayRemove,
} from "firebase/firestore";
import { useAuth } from "./AuthContext";

const Inbox = () => {
    const { user } = useAuth();
    const [friendRequests, setFriendRequests] = useState([]);
    const [groupInvites, setGroupInvites] = useState([]);
    const [notifications, setNotifications] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    useEffect(() => {
        if (!user?.email) {
            setLoading(false);
            return;
        }

        // Friend Requests Query
        const requestsQuery = query(
            collection(db, "friendRequests"),
            where("to", "==", user.email),
            where("status", "==", "pending")
        );

        const unsubscribeRequests = onSnapshot(requestsQuery, (snapshot) => {
            const requests = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            }));
            setFriendRequests(requests);
        });

        // Group Invitations Query
        const groupsQuery = query(
            collection(db, "groups"),
            where("pendingMembers", "array-contains", user.email)
        );

        const unsubscribeGroups = onSnapshot(groupsQuery, (snapshot) => {
            const groups = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            }));
            const filteredGroups = groups.filter(
                (group) => !group.members?.includes(user.email)
            );
            setGroupInvites(filteredGroups);
        });

        // Notifications Query
        const notificationsQuery = query(
            collection(db, "inbox"),
            where("to", "==", user.email)
        );

        const unsubscribeNotifications = onSnapshot(notificationsQuery, (snapshot) => {
            const notifications = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            }));
            setNotifications(notifications);
        });

        setLoading(false);

        return () => {
            unsubscribeRequests();
            unsubscribeGroups();
            unsubscribeNotifications();
        };
    }, [user]);

    // Handle Accepting Friend Request
    const handleAcceptRequest = async (requestId, fromEmail) => {
        try {
            setError("");
            setSuccess("");

            const requestRef = doc(db, "friendRequests", requestId);
            await updateDoc(requestRef, { status: "accepted" });

            const currentUserRef = doc(db, "users", user.email);
            await updateDoc(currentUserRef, {
                friends: arrayUnion(fromEmail),
            });

            const senderRef = doc(db, "users", fromEmail);
            await updateDoc(senderRef, {
                friends: arrayUnion(user.email),
            });

            setFriendRequests(friendRequests.filter((req) => req.id !== requestId));
            setSuccess(`You are now friends with ${fromEmail}`);
        } catch (err) {
            console.error("Error accepting friend request:", err);
            setError("Failed to accept friend request");
        }
    };

    // Handle Rejecting Friend Request
    const handleRejectRequest = async (requestId) => {
        try {
            setError("");
            setSuccess("");

            const requestRef = doc(db, "friendRequests", requestId);
            await updateDoc(requestRef, { status: "rejected" });

            setFriendRequests(friendRequests.filter((req) => req.id !== requestId));
            setSuccess("Friend request rejected");
        } catch (err) {
            console.error("Error rejecting friend request:", err);
            setError("Failed to reject friend request");
        }
    };

    // Handle Joining Group
    const handleJoinGroup = async (groupId) => {
        try {
            setError("");
            setSuccess("");

            const groupRef = doc(db, "groups", groupId);
            await updateDoc(groupRef, {
                members: arrayUnion(user.email),
                pendingMembers: arrayRemove(user.email),
            });

            setGroupInvites(groupInvites.filter((invite) => invite.id !== groupId));
            setSuccess(`You have joined the group`);
        } catch (err) {
            console.error("Error joining group:", err);
            setError("Failed to join group");
        }
    };

    // Handle Rejecting Group Invitation
    const handleRejectGroupInvite = async (groupId) => {
        try {
            setError("");
            setSuccess("");

            const groupRef = doc(db, "groups", groupId);
            await updateDoc(groupRef, {
                pendingMembers: arrayRemove(user.email),
            });

            setGroupInvites(groupInvites.filter((invite) => invite.id !== groupId));
            setSuccess("Group invitation rejected");
        } catch (err) {
            console.error("Error rejecting group invitation:", err);
            setError("Failed to reject group invitation");
        }
    };

    // Handle Marking Notification as Read
    const handleMarkAsRead = async (notificationId) => {
        try {
            setError("");
            setSuccess("");

            const notificationRef = doc(db, "inbox", notificationId);
            await updateDoc(notificationRef, { status: "read" });

            setNotifications((prev) =>
                prev.map((n) =>
                    n.id === notificationId ? { ...n, status: "read" } : n
                )
            );
            setSuccess("Notification marked as read");
        } catch (err) {
            console.error("Error marking notification as read:", err);
            setError("Failed to mark notification as read");
        }
    };

    return (
        <div className="inbox-container">
            <h2>Inbox</h2>
            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">{success}</div>}

            {/* Friend Requests Section */}
            <div className="friend-requests-section">
                <h3>Friend Requests ({friendRequests.length})</h3>
                {friendRequests.length > 0 ? (
                    <ul className="friend-requests-list">
                        {friendRequests.map((request) => (
                            <li key={request.id} className="request-item">
                                <div className="request-info">
                                    <span className="from-email">{request.from}</span>
                                </div>
                                <div className="request-actions">
                                    <button onClick={() => handleAcceptRequest(request.id, request.from)}>
                                        Accept
                                    </button>
                                    <button onClick={() => handleRejectRequest(request.id)}>Reject</button>
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p>No pending friend requests</p>
                )}
            </div>

            {/* Group Invitations Section */}
            <div className="group-invites-section">
                <h3>Group Invitations ({groupInvites.length})</h3>
                {groupInvites.length > 0 ? (
                    <ul className="group-invites-list">
                        {groupInvites.map((invite) => (
                            <li key={invite.id} className="invite-item">
                                <div className="invite-info">
                                    <span className="from-email">{invite.createdBy}</span>
                                    <span className="group-name">{invite.name}</span>
                                </div>
                                <div className="invite-actions">
                                    <button onClick={() => handleJoinGroup(invite.id)}>Join</button>
                                    <button onClick={() => handleRejectGroupInvite(invite.id)}>Reject</button>
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p>No pending group invitations</p>
                )}
            </div>

            {/* Notifications Section */}
            <div className="notifications-section">
                <h3>Notifications ({notifications.length})</h3>
                {notifications.length > 0 ? (
                    <ul className="notifications-list">
                        {notifications.map((notification) => (
                            <li key={notification.id} className="notification-item">
                                <div className="notification-info">
                                    <span className="message">{notification.message}</span>
                                    <span className="status">{notification.status}</span>
                                </div>
                                {notification.status === "unread" && (
                                    <button onClick={() => handleMarkAsRead(notification.id)}>
                                        Mark as Read
                                    </button>
                                )}
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p>No new notifications</p>
                )}
            </div>
        </div>
    );
};

export default Inbox;