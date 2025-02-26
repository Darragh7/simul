import React, { useState, useEffect } from "react";
import { db } from "../firebase/firebase";
import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  onSnapshot,
  doc,
  setDoc,
  updateDoc,
  arrayUnion,
} from "firebase/firestore";
import { useAuth } from "./AuthContext";

const FriendsList = () => {
  const { user } = useAuth();
  console.log("User in FriendsList:", user);

  const [friends, setFriends] = useState([]);
  const [friendEmail, setFriendEmail] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    if (!user?.email) {
      setLoading(false);
      return;
    }

    const fetchFriends = async () => {
      try {
        setLoading(true);

        const userRef = doc(db, "users", user.email);
        const userSnap = await getDocs(query(collection(db, "users"), where("email", "==", user.email)));

        if (!userSnap.empty) {
          const userData = userSnap.docs[0].data();
          setFriends(userData.friends || []);
        } else {
          await setDoc(userRef, { email: user.email, friends: [] });
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

    const unsubscribe = onSnapshot(query(collection(db, "users"), where("email", "==", user.email)), (snapshot) => {
      if (!snapshot.empty) {
        const userData = snapshot.docs[0].data();
        setFriends(userData.friends || []);
      }
    });

    return () => unsubscribe();
  }, [user]);

  const handleAddFriend = async () => {
    if (!user) {
      setError("You must be logged in to add a friend");
      return;
    }

    if (!friendEmail.trim()) {
      setError("Please enter an email address");
      return;
    }

    if (friendEmail === user.email) {
      setError("You can't add yourself as a friend");
      return;
    }

    if (friends.includes(friendEmail)) {
      setError("You are already friends with this user");
      return;
    }

    setError("");
    setSuccess("");

    try {
      const recipientQuery = query(collection(db, "users"), where("email", "==", friendEmail));
      const recipientSnapshot = await getDocs(recipientQuery);

      if (recipientSnapshot.empty) {
        setError("User not found. They need to sign up first.");
        return;
      }

      await addDoc(collection(db, "friendRequests"), {
        from: user.email,
        to: friendEmail,
        status: "pending",
        createdAt: new Date(),
      });

      setSuccess(`Friend request sent to ${friendEmail}`);
      setFriendEmail("");
    } catch (err) {
      console.error("Error sending friend request:", err);
      setError("Failed to send friend request");
    }
  };

  return (
    <div className="friends-container">
      <h2>Friends List</h2>

      {error && <div className="error-message">{error}</div>}
      {success && <div className="success-message">{success}</div>}

      <div className="add-friend">
        <input
          type="email"
          placeholder="Enter friend's email"
          value={friendEmail}
          onChange={(e) => setFriendEmail(e.target.value)}
          className="friend-email-input"
        />
        <button onClick={handleAddFriend} className="add-friend-btn">
          Add Friend
        </button>
      </div>

      <div className="friends-list-container">
        <h3>Your Friends ({friends.length})</h3>
        {loading ? (
          <div>Loading friends...</div>
        ) : friends.length > 0 ? (
          <ul className="friends-list">
            {friends.map((friend, index) => (
              <li key={index} className="friend-item">
                <span>{friend}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p>No friends yet. Add friends to share calendars!</p>
        )}
      </div>
    </div>
  );
};

export default FriendsList;
