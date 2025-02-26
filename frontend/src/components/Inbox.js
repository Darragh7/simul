import React, { useState, useEffect } from "react";
import { db } from "../firebase/firebase";
import { 
    collection, 
    query, 
    where, 
    getDocs, 
    doc, 
    updateDoc, 
    onSnapshot, 
    setDoc, 
    arrayUnion 
} from "firebase/firestore";
import { useAuth } from "./AuthContext";

const Inbox = () => {
    const { user } = useAuth();
    const [friendRequests, setFriendRequests] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");
    const [success, setSuccess] = useState("");

    useEffect(() => {
        if (!user?.email) {
            setLoading(false);
            return;
        }

        const requestsQuery = query(
            collection(db, "friendRequests"),
            where("to", "==", user.email),
            where("status", "==", "pending")
        );

        const unsubscribe = onSnapshot(requestsQuery, (snapshot) => {
            const requests = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            }));
            setFriendRequests(requests);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [user]);

    const handleAcceptRequest = async (requestId, fromEmail) => {
        try {
            setError("");
            setSuccess("");

            const requestRef = doc(db, "friendRequests", requestId);
            await updateDoc(requestRef, { status: "accepted" });

            const currentUserRef = doc(db, "users", user.email);
            await updateDoc(currentUserRef, {
                friends: arrayUnion(fromEmail)
            });

            const senderRef = doc(db, "users", fromEmail);
            await updateDoc(senderRef, {
                friends: arrayUnion(user.email)
            });

            setFriendRequests(friendRequests.filter(req => req.id !== requestId));
            setSuccess(`You are now friends with ${fromEmail}`);
        } catch (err) {
            console.error("Error accepting friend request:", err);
            setError("Failed to accept friend request");
        }
    };

    const handleRejectRequest = async (requestId) => {
        try {
            setError("");
            setSuccess("");

            const requestRef = doc(db, "friendRequests", requestId);
            await updateDoc(requestRef, { status: "rejected" });

            setFriendRequests(friendRequests.filter(req => req.id !== requestId));
            setSuccess("Friend request rejected");
        } catch (err) {
            console.error("Error rejecting friend request:", err);
            setError("Failed to reject friend request");
        }
    };

    return (
        <div className="inbox-container">
            <h2>Inbox</h2>
            {error && <div className="error-message">{error}</div>}
            {success && <div className="success-message">{success}</div>}
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
                                    <button onClick={() => handleAcceptRequest(request.id, request.from)}>Accept</button>
                                    <button onClick={() => handleRejectRequest(request.id)}>Reject</button>
                                </div>
                            </li>
                        ))}
                    </ul>
                ) : (
                    <p>No pending friend requests</p>
                )}
            </div>
        </div>
    );
};

export default Inbox;



