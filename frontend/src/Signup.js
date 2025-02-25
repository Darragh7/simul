import { createUserProfile } from "../firebase/friendFunctions";

const handleSignup = async (email) => {
    await createUserProfile(email);
};
