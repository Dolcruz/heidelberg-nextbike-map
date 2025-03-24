import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyCF-tAMYlqKe8qdAQxa9XNF0HCFCAkfzBY",
  authDomain: "geodatenerfassungprojekt1.firebaseapp.com",
  projectId: "geodatenerfassungprojekt1",
  storageBucket: "geodatenerfassungprojekt1.firebasestorage.app",
  messagingSenderId: "621379725087",
  appId: "1:621379725087:web:ab910dc8cc7533e07ab22a",
  measurementId: "G-28DCWE7RQV"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app); 