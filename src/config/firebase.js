import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
import { getFirestore } from "firebase/firestore";
import { getAuth } from "firebase/auth";
import { getStorage } from "firebase/storage";

// TUS CLAVES VAN AQUÍ
const firebaseConfig = {
  apiKey: "AIzaSyDDcA6EB-5HsGZJFBFvZ-7KpBSNa-LC_UU",
  authDomain: "sistema-consorcio-43b49.firebaseapp.com",
  projectId: "sistema-consorcio-43b49",
  storageBucket: "sistema-consorcio-43b49.firebasestorage.app",
  messagingSenderId: "19981449431",
  appId: "1:19981449431:web:ef9ef49efad84441a31892",
  measurementId: "G-YJFHTVQCVR"
};

// Inicializar Firebase
const app = initializeApp(firebaseConfig);
const analytics = getAnalytics(app);
// Exportar los servicios
export const db = getFirestore(app);
export const auth = getAuth(app);
export const storage = getStorage(app);