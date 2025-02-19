/******FUNCTIONS FOR CREATING USER PROFILES AND SENDING FRIEND REQUESTS CONNECTING TO FIREBASE */
import { db } from "./firebase"; // Import Firestore instance
import { doc, setDoc, collection, addDoc } from "firebase/firestore";

/**
 * Create a new user profile in Firestore when they sign up.
 */
export const createUserProfile = async (email) => {
    try {
        await setDoc(doc(db, "users", email), {
            email: email,
            friends: []
        });
        console.log("User profile created successfully.");
    } catch (error) {
        console.error("Error creating user profile:", error);
    }
};

/**
 * Send a friend request from one user to another.
 */
export const sendFriendRequest = async (fromEmail, toEmail) => {
    try {
        await addDoc(collection(db, "friendRequests"), {
            from: fromEmail,
            to: toEmail,
            status: "pending"
        });
        console.log("Friend request sent.");
    } catch (error) {
        console.error("Error sending friend request:", error);
    }
};
