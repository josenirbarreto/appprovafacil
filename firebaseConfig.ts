
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from "firebase/firestore";

// Configuração do Web App do Firebase (app-provafacil)
export const firebaseConfig = {
  apiKey: "AIzaSyDn0tHQld81q-WxlIiGEyng-07HuK4J4cQ",
  authDomain: "app-provafacil.firebaseapp.com",
  projectId: "app-provafacil",
  storageBucket: "app-provafacil.firebasestorage.app",
  messagingSenderId: "645711470814",
  appId: "1:645711470814:web:501e7a5e92c221e1bca24f"
};

// Inicializa o Firebase
const app = initializeApp(firebaseConfig);

// Inicializa o Firestore com detecção automática de Long Polling para evitar erros de conexão
// e habilita cache persistente para funcionamento offline.
export const db = initializeFirestore(app, {
  experimentalAutoDetectLongPolling: true,
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

export const auth = getAuth(app);
