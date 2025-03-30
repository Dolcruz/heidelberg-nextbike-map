import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

// Verwende Umgebungsvariablen für sensible Informationen
// Der API-Key sollte in einer .env-Datei gespeichert werden
// REACT_APP_ Präfix wird für Create React App benötigt
const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY || "placeholder-api-key",
  authDomain: "geodatenerfassungprojekt1.firebaseapp.com",
  projectId: "geodatenerfassungprojekt1",
  storageBucket: "geodatenerfassungprojekt1.firebasestorage.app",
  messagingSenderId: "621379725087",
  appId: "1:621379725087:web:ab910dc8cc7533e07ab22a",
  measurementId: "G-28DCWE7RQV"
};

// Überprüfe, ob API-Key ordnungsgemäß konfiguriert ist (nur in Dev-Umgebung)
if (process.env.NODE_ENV === 'development' && process.env.REACT_APP_FIREBASE_API_KEY === undefined) {
  console.warn('⚠️ REACT_APP_FIREBASE_API_KEY ist nicht definiert. Stelle sicher, dass du eine .env-Datei mit diesem Wert hast.');
}

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Authentication and get a reference to the service
export const auth = getAuth(app);
export const googleProvider = new GoogleAuthProvider();

// Initialize Cloud Firestore and get a reference to the service
export const db = getFirestore(app); 