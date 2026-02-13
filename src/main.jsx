// src/main.jsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App.jsx"; // Asegúrate de tener App.jsx
import "./index.css"; // Opcional, si tienes estilos

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// 🔥 Registrar Service Worker (modo app offline)
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js')
      .then(() => console.log("✅ App offline lista"))
      .catch(() => console.log("❌ Service Worker no cargó"));
  });
}