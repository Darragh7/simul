// import React from "react";

// const Login = ({ onLoginSuccess }) => {
//   const handleGoogleLogin = async () => {
//     try {
//       // Redirect to Flask backend's login route
//       window.location.href = "http://127.0.0.1:5000/login";
//     } catch (error) {
//       console.error("Login Failed:", error);
//     }
//   };

//   // Check if we're returning from OAuth
//   React.useEffect(() => {
//     const checkAuth = async () => {
//       try {
//         const response = await fetch('http://127.0.0.1:5000/api/auth/status', {
//           credentials: 'include'
//         });
//         const data = await response.json();
//         if (data.isAuthenticated) {
//           onLoginSuccess();
//         }
//       } catch (error) {
//         console.error('Auth check failed:', error);
//       }
//     };

//     checkAuth();
//   }, [onLoginSuccess]);

//   return (
//     <div className="login-container">
//       <h2>Login to Simul</h2>
//       <button
//         onClick={handleGoogleLogin}
//         style={{
//           marginTop: "20px",
//           padding: "10px 20px",
//           fontSize: "16px",
//           cursor: "pointer",
//           backgroundColor: "#4285f4", // Google blue
//           color: "white",
//           border: "none",
//           borderRadius: "5px",
//           display: "flex",
//           alignItems: "center",
//           gap: "10px"
//         }}
//       >
//         <svg width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
//           <path fill="#FFC107" d="M43.611 20.083H42V20H24v8h11.303c-1.649 4.657-6.08 8-11.303 8-6.627 0-12-5.373-12-12s5.373-12 12-12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 12.955 4 4 12.955 4 24s8.955 20 20 20 20-8.955 20-20c0-1.341-.138-2.65-.389-3.917z"/>
//           <path fill="#FF3D00" d="m6.306 14.691 6.571 4.819C14.655 15.108 18.961 12 24 12c3.059 0 5.842 1.154 7.961 3.039l5.657-5.657C34.046 6.053 29.268 4 24 4 16.318 4 9.656 8.337 6.306 14.691z"/>
//           <path fill="#4CAF50" d="M24 44c5.166 0 9.86-1.977 13.409-5.192l-6.19-5.238A11.91 11.91 0 0 1 24 36c-5.202 0-9.619-3.317-11.283-7.946l-6.522 5.025C9.505 39.556 16.227 44 24 44z"/>
//           <path fill="#1976D2" d="M43.611 20.083H42V20H24v8h11.303a12.04 12.04 0 0 1-4.087 5.571l.003-.002 6.19 5.238C36.971 39.205 44 34 44 24c0-1.341-.138-2.65-.389-3.917z"/>
//         </svg>
//         Sign in with Google
//       </button>
//     </div>
//   );
// };

// export default Login;

import React, { useEffect } from 'react';

const Login = ({ onLoginSuccess }) => {
  useEffect(() => {
    // Check for token in URL when component mounts
    const params = new URLSearchParams(window.location.search);
    const token = params.get('token');
    
    if (token) {
      localStorage.setItem('token', token);
      onLoginSuccess();
      // Clear the token from URL
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, [onLoginSuccess]);

  const handleGoogleLogin = () => {
    window.location.href = "http://localhost:5000/login";
  };

  return (
    <div className="login-container">
      <h2>Login to Simul</h2>
      <button
        onClick={handleGoogleLogin}
        style={{
          marginTop: "20px",
          padding: "10px 20px",
          fontSize: "16px",
          cursor: "pointer",
          backgroundColor: "#4285f4",
          color: "white",
          border: "none",
          borderRadius: "5px",
          display: "flex",
          alignItems: "center",
          gap: "10px"
        }}
      >
        <svg width="18" height="18" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 48 48">
          {/* Your existing SVG paths */}
        </svg>
        Sign in with Google
      </button>
    </div>
  );
};

export default Login;