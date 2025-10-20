import { signInWithEmailAndPassword, signOut } from "firebase/auth";
import { auth } from "../config/firebase"; // Importamos solo "auth"

export const login = (email, password) => {
  // Esta función devuelve la "promesa" de Firebase
  return signInWithEmailAndPassword(auth, email, password);
};

export const logout = () => {
  return signOut(auth);
};