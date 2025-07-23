// Firebase Configuration
// Your web app's Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAwWekMPAfH2RTz8U6-6WNpRLti2K3rD6Y",
    authDomain: "appointment-hub-516ec.firebaseapp.com",
    projectId: "appointment-hub-516ec",
    storageBucket: "appointment-hub-516ec.firebasestorage.app",
    messagingSenderId: "310370228073",
    appId: "1:310370228073:web:8bd0fb2c368b4aa1168ff8",
    measurementId: "G-GGXW94K01P"
};

// Initialize Firebase (using the CDN version for compatibility)
firebase.initializeApp(firebaseConfig);

// Initialize Firebase services
const auth = firebase.auth();
const db = firebase.firestore();

// Enable offline persistence
db.enablePersistence()
    .catch((err) => {
        if (err.code == 'failed-precondition') {
            // Multiple tabs open, persistence can only be enabled in one tab at a time
            console.log('Persistence failed - multiple tabs open');
        } else if (err.code == 'unimplemented') {
            // The current browser doesn't support persistence
            console.log('Persistence not supported');
        }
    });

// Export Firebase services for use in other files
window.firebaseServices = {
    auth: auth,
    db: db
}; 