// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";

const firebaseConfig = {
  apiKey: "AIzaSyBQfjkHAmxP0pwxKFdqoKnDld5UqC1kymU",
  authDomain: "cartera-aseguradoras.firebaseapp.com",
  projectId: "cartera-aseguradoras",
  storageBucket: "cartera-aseguradoras.appspot.com",
  messagingSenderId: "659340338485",
  appId: "1:659340338485:web:2f4d8969abf50d959dd87c"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

enableIndexedDbPersistence(db)
  .then(() => {
    console.log("🔥 Offline activado");
  })
  .catch((err) => {
    console.log("Offline no disponible:", err.code);
  });

export { auth, db };