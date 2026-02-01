// Scripts for firebase and firebase messaging
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/9.0.0/firebase-messaging-compat.js');

const firebaseConfig = {
  apiKey: "AIzaSyC0WtvgMVY12RvdcmfwYcesoROkS9oFwNs",
  authDomain: "reset-studio-91770.firebaseapp.com",
  projectId: "reset-studio-91770",
  storageBucket: "reset-studio-91770.firebasestorage.app",
  messagingSenderId: "514427949978",
  appId: "1:514427949978:web:ad874064fd9c9fa13d6023"
};

firebase.initializeApp(firebaseConfig);

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  console.log('[firebase-messaging-sw.js] Received background message ', payload);
  // Customize notification here
  const notificationTitle = payload.notification.title;
  const notificationOptions = {
    body: payload.notification.body,
    icon: '/vite.svg' // or your app icon
  };

  self.registration.showNotification(notificationTitle, notificationOptions);
});