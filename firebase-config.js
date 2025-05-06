// Your Firebase configuration
const firebaseConfig = {
    apiKey: "AIzaSyAD5lawrYk8K6s_Y6JlO-i3spnBJw4cLbc",
    authDomain: "taskmaster-8301d.firebaseapp.com",
    projectId: "taskmaster-8301d",
    storageBucket: "taskmaster-8301d.firebasestorage.app",
    messagingSenderId: "693852976364",
    appId: "1:693852976364:web:9997ea4fd48c539db2e1c9"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);

// Initialize Firestore and Auth
const db = firebase.firestore();
const auth = firebase.auth();