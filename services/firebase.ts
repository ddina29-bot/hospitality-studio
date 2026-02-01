import { initializeApp } from "firebase/app";
import { getMessaging, getToken, onMessage, Messaging, isSupported } from "firebase/messaging";

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

// Initialize messaging conditionally
const initMessaging = async () => {
  try {
    const supported = await isSupported();
    if (supported) {
      messaging = getMessaging(app);
    } else {
      console.debug("Firebase Messaging not supported in this environment.");
    }
  } catch (e) {
    console.debug("Firebase Messaging support check failed:", e);
  }
};

// Fire initialization
initMessaging();

export const requestForToken = async () => {
  try {
    // Ensure messaging is initialized or supported
    const supported = await isSupported();
    if (!supported || !messaging) return null;
  
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
    isSupported().then(supported => {
      if (supported && messaging) {
        onMessage(messaging, (payload) => {
          console.log("Foreground Message received: ", payload);
          resolve(payload);
        });
      }
    });
  });

export { messaging };