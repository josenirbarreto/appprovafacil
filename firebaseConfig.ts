
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Configuração do Web App do Firebase (app-provafacil)
const firebaseConfig = {
  apiKey: "AIzaSyDn0tHQld81q-WxlIiGEyng-07HuK4J4cQ",
  authDomain: "app-provafacil.firebaseapp.com",
  projectId: "app-provafacil",
  storageBucket: "app-provafacil.firebasestorage.app",
  messagingSenderId: "645711470814",
  appId: "1:645711470814:web:501e7a5e92c221e1bca24f"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Exporta os serviços de Autenticação e Banco de Dados para uso no app
export const auth = getAuth(app);
export const db = getFirestore(app);
