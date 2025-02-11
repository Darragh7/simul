import React from "react";
import { GoogleLogin } from "@react-oauth/google";

const Login = ({ onLoginSuccess }) => {
    const handleSuccess = (response) => {
      console.log("Login Success:", response.credential);
      onLoginSuccess(); // Update login state in App.js
    };
  
    const handleFailure = () => {
      console.log("Login Failed");
    };

    return (
      <div className="login-container">
      <h2>Login to Simul</h2>
      <GoogleLogin onSuccess={handleSuccess} onError={handleFailure} />

      {/* Temporary Guest Login Button */}
      <button 
          onClick={() => onLoginSuccess()} 
          style={{
              marginTop: "20px",
              padding: "10px 20px",
              fontSize: "16px",
              cursor: "pointer",
              backgroundColor: "red",
              color: "white",
              border: "none",
              borderRadius: "5px"
          }}
      >
          Temporary sign in button
      </button>
  </div>
);
};

export default Login;


// Backend, verify the token with Google's API, 
// The token verification logic should go in your backend authentication route.
// Typically, this would be in an auth route handler inside an Express.js server if you're using Node.js.

// const { OAuth2Client } = require("google-auth-library");
// const client = new OAuth2Client("YOUR_GOOGLE_CLIENT_ID");

// async function verifyToken(token) {
//   const ticket = await client.verifyIdToken({
//     idToken: token,
//     audience: "YOUR_GOOGLE_CLIENT_ID",
//   });
//   const payload = ticket.getPayload();
//   console.log(payload);
// }
