import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage, Messaging } from "firebase/messaging";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyC0WtvgMVY12RvdcmfwYcesoROkS9oFwNs",
  authDomain: "reset-studio-91770.firebaseapp.com",
  projectId: "reset-studio-91770",
  storageBucket: "reset-studio-91770.firebasestorage.app",
  messagingSenderId: "514427949978",
  appId: "1:514427949978:web:ad874064fd9c9fa13d6023"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
let messaging: Messaging | null = null;

try {
  messaging = getMessaging(app);
} catch (error) {
  console.warn("Firebase Messaging not supported in this browser environment:", error);
}

export const requestForToken = async () => {
  if (!messaging) return null;
  
  try {
    const currentToken = await getToken(messaging, { 
      vapidKey: 'BE_wFFLMMNkiiKckoUzX6pRhdFdZEfC96JbxAoWpRiNIRsFerwPbOOg5NqL6W4drpC0xe_nsy2DuCP2kjQR43m4' 
    });
    
    if (currentToken) {
      console.log('Firebase Cloud Messaging Token:', currentToken);
      // In a real app, you would send this token to your backend to save it against the user.
      return currentToken;
    } else {
      console.log('No registration token available. Request permission to generate one.');
      return null;
    }
  } catch (err) {
    console.error('An error occurred while retrieving token. ', err);
    return null;
  }
};

export const onMessageListener = () =>
  new Promise((resolve) => {
    if (!messaging) return;
    onMessage(messaging, (payload) => {
      console.log("Foreground Message received: ", payload);
      resolve(payload);
    });
  });

export { messaging };