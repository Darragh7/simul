import React, { useState, useEffect } from "react";
import { db } from "../firebase/firebase";
import { collection, doc, getDoc, setDoc, addDoc, onSnapshot } from "firebase/firestore";
import { useAuth } from "./AuthContext"; // Assuming you have an AuthContext for logged-in user info

const FriendsList = () => {
    const { currentUser } = useAuth(); // Get logged-in user's email
    const [friends, setFriends] = useState([]);
    const [friendEmail, setFriendEmail] = useState("");

    useEffect(() => {
        if (!currentUser?.email) return;

        // Real-time listener for friend's list updates
        const userRef = doc(db, "users", currentUser.email);
        const unsubscribe = onSnapshot(userRef, (docSnap) => {
            if (docSnap.exists()) {
                setFriends(docSnap.data().friends || []);
            }
        });

        return () => unsubscribe(); // Cleanup listener
    }, [currentUser]);

    const handleAddFriend = async () => {
        if (!friendEmail.trim() || friendEmail === currentUser.email) {
            alert("Invalid email or you can't add yourself!");
            return;
        }

        try {
            // Send friend request
            await addDoc(collection(db, "friendRequests"), {
                from: currentUser.email,
                to: friendEmail,
                status: "pending"
            });

            alert("Friend request sent!");
            setFriendEmail(""); // Clear input field
        } catch (error) {
            console.error("Error sending friend request:", error);
        }
    };

    return (
        <div className="friends-container">
            <h2>Friends List</h2>

            {/* Add Friend Input & Button */}
            <div className="add-friend">
                <input
                    type="email"
                    placeholder="Enter friend's email"
                    value={friendEmail}
                    onChange={(e) => setFriendEmail(e.target.value)}
                    className="friend-email-input"
                />
                <button onClick={handleAddFriend} className="add-friend-btn">Add Friend</button>
            </div>

            {/* Friends List */}
            <ul className="friends-list">
                {friends.length > 0 ? (
                    friends.map((friend, index) => (
                        <li key={index} className="friend-item">
                            <span>{friend}</span>
                        </li>
                    ))
                ) : (
                    <p>No friends yet.</p>
                )}
            </ul>
        </div>
    );
};

export default FriendsList;
