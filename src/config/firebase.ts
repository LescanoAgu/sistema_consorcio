import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

// TUS CLAVES VAN AQUÍ
const firebaseConfig = {
  apiKey: "AIzaSyDR9ZeCU4Cbt4uFwszb_wOH7Ruq2z-LHVE",
  authDomain: "sistema-consorcio-v2.firebaseapp.com",
  projectId: "sistema-consorcio-v2",
  storageBucket: "sistema-consorcio-v2.firebasestorage.app",
  messagingSenderId: "161822155934",
  appId: "1:161822155934:web:d6e7ef43fd0a079fd0478f",
  measurementId: "G-Z4V8YM8D3X"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
// Exportar los servicios
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);