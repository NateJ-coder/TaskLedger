// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyB5g989HSaawFcOMgSVGRDoTGcaPXhm4cU",
  authDomain: "taskledger-ec62e.firebaseapp.com",
  projectId: "taskledger-ec62e",
  storageBucket: "taskledger-ec62e.firebasestorage.app",
  messagingSenderId: "302153317014",
  appId: "1:302153317014:web:41d3bf8fcb6924dfc5e0b7",
  measurementId: "G-VCN0LR8XJX"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);

export { app, analytics, db };
