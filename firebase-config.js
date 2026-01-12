// Import the functions you need from the SDKs you need
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-analytics.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBQXd0GO12MBgTxPMbryi-DeEe0QH9AxbM",
  authDomain: "taskledger-76e5e.firebaseapp.com",
  projectId: "taskledger-76e5e",
  storageBucket: "taskledger-76e5e.firebasestorage.app",
  messagingSenderId: "114761547238",
  appId: "1:114761547238:web:c6e06e3040c863e558ea27"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
const db = getFirestore(app);

export { app, analytics, db };
