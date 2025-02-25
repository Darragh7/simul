import { sendFriendRequest } from "../firebase/friendFunctions";

const handleSendRequest = async () => {
    const userEmail = "user1@gmail.com"; // Get from logged-in user
    const friendEmail = "user2@gmail.com"; // Get from input field
    await sendFriendRequest(userEmail, friendEmail);
};
