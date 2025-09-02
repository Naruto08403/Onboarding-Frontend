// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyBBzwJLJ8eNJ63_c_OE9MZctyRJ7VzdoPU",
  authDomain: "onboarding-93615.firebaseapp.com",
  projectId: "onboarding-93615",
  storageBucket: "onboarding-93615.firebasestorage.app",
  messagingSenderId: "1018234888092",
  appId: "1:1018234888092:web:5bb0a55a0e96533ad93259",
  measurementId: "G-9BEQQWGR33"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);