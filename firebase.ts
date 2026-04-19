
// @ts-ignore
import { initializeApp } from 'firebase/app';
// @ts-ignore
import { getFirestore } from 'firebase/firestore';
// @ts-ignore
import { getAnalytics } from 'firebase/analytics';
// @ts-ignore
import { getAuth } from 'firebase/auth';

// ------------------------------------------------------------------
// TODO: PASTE YOUR FIREBASE CONFIG HERE
// Go to https://console.firebase.google.com/
// Create a project -> Project Settings -> General -> Web App
// ------------------------------------------------------------------
  const firebaseConfig = {
    apiKey: "AIzaSyDQRGipdAaTuR8VFgPT_ql8k6RI1NgCDKg",
    authDomain: "firecode-4ba19.firebaseapp.com",
    projectId: "firecode-4ba19",
    storageBucket: "firecode-4ba19.firebasestorage.app",
    messagingSenderId: "793688834360",
    appId: "1:793688834360:web:6b43d63add4212d12a81cd",
    measurementId: "G-9GDLLKFYCL"
  };

// Initialize Firebase
const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
export const auth = getAuth(app);
export const analytics = typeof window !== 'undefined' ? getAnalytics(app) : null;
