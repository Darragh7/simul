// src/firebase/firebase.js
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBQZ-1MK0MrwKlVnn90yyYrOhc6VQYPn4s",
  authDomain: "simul-3ba34.firebaseapp.com",
  projectId: "simul-3ba34",
  storageBucket: "simul-3ba34.firebasestorage.app",
  messagingSenderId: "712658023484",
  appId: "1:712658023484:web:621d14db9cf4f58530bf39",
  measurementId: "G-2713CNQZ9F"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

export { app, analytics, auth, db };