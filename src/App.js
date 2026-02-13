// App.js
import React, { useState } from "react";

import VerCartera from "./VerCartera";
import VerPolizas from "./VerPolizas";
import PolizasFinanciadas from "./PolizasFinanciadas";
import Login from "./Login";

const PASSWORD_POLIZAS = "1234"; // <-- CAMBIA AQUÍ TU CONTRASEÑA

export default function App() {
  const [logueado, setLogueado] = useState(false);
  const [vista, setVista] = useState("cartera"); // "cartera" | "polizas"

  // Gate para entrar a Pólizas
  const [polizasAutorizadas, setPolizasAutorizadas] = useState(false);

  // Modal password
  const [mostrarModalPolizas, setMostrarModalPolizas] = useState(false);
  const [passPolizas, setPassPolizas] = useState("");
  const [verPass, setVerPass] = useState(false);
  const [errorPass, setErrorPass] = useState("");

  const cerrarSesion = () => {
    setLogueado(false);
    setVista("cartera");
    setPolizasAutorizadas(false);
    setMostrarModalPolizas(false);
    setPassPolizas("");
    setErrorPass("");
    setVerPass(false);
  };

  const irACartera = () => {
    setVista("cartera");
  };

  const pedirPasswordYIrAPolizas = () => {
    // Si ya está autorizada, entra directo
   

    // Si no, abre modal
    setErrorPass("");
    setPassPolizas("");
    setVerPass(false);
    setMostrarModalPolizas(true);
  };

  const confirmarPasswordPolizas = () => {
    if (!passPolizas.trim()) {
      setErrorPass("Ingresa la contraseña.");
      return;
    }

    if (passPolizas === PASSWORD_POLIZAS) {
      setPolizasAutorizadas(true);
      setVista("polizas");
      setMostrarModalPolizas(false);
      setPassPolizas("");
      setErrorPass("");
      setVerPass(false);
    } else {
      setErrorPass("Contraseña incorrecta.");
    }
  };

  const cerrarModalPolizas = () => {
    setMostrarModalPolizas(false);
    setPassPolizas("");
    setErrorPass("");
    setVerPass(false);
  };

  // Si no está logueada, muestra login
  if (!logueado) {
    return (
      <div className="min-h-screen bg-gray-50">
        <Login onLogin={() => setLogueado(true)} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Barra superior */}
      <div className="bg-white shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h1 className="text-lg font-semibold text-gray-800">
            Aseguramos JL - Gestión
          </h1>

          <div className="flex flex-wrap gap-2 items-center">
            {/* Botón Cartera */}
            <button
              onClick={irACartera}
              className={`px-4 py-2 rounded font-medium transition ${
                vista === "cartera"
                  ? "bg-green-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Cartera
            </button>

            {/* Botón Pólizas (con contraseña) */}
            <button
              onClick={pedirPasswordYIrAPolizas}
              className={`px-4 py-2 rounded font-medium transition ${
                vista === "polizas"
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Pólizas
            </button>

            <button
  onClick={() => setVista("polizasFinanciadas")}
  className={`px-4 py-2 rounded font-medium transition ${
    vista === "polizasFinanciadas"
      ? "bg-blue-600 text-white"
      : "bg-gray-100 text-gray-700 hover:bg-gray-200"
  }`}
>
  Pólizas Financiadas
</button>

            {/* (Opcional) Cerrar sesión */}
            <button
              onClick={cerrarSesion}
              className="px-4 py-2 rounded font-medium bg-red-50 text-red-700 hover:bg-red-100 transition"
              title="Cerrar sesión"

              
            >
              Salir
              
            </button>
          </div>
        </div>
      </div>

      {/* Contenido */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        {vista === "cartera" && <VerCartera />}
        {vista === "polizas" && <VerPolizas />}
        {vista === "polizasFinanciadas" && <PolizasFinanciadas />}
      </div>

      {/* Modal de contraseña para Pólizas */}
      {mostrarModalPolizas && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          {/* Fondo */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={cerrarModalPolizas}
          />

          {/* Caja */}
          <div className="relative bg-white w-full max-w-md mx-4 rounded-xl shadow-lg border">
            <div className="p-5 border-b">
              <h2 className="text-lg font-semibold text-gray-800">
                Acceso a Pólizas
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Ingresa la contraseña para continuar.
              </p>
            </div>

            <div className="p-5">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Contraseña
              </label>

              <div className="flex gap-2">
                <input
                  type={verPass ? "text" : "password"}
                  value={passPolizas}
                  onChange={(e) => setPassPolizas(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") confirmarPasswordPolizas();
                  }}
                  className="w-full border rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="••••••••"
                  autoFocus
                />

                <button
                  type="button"
                  onClick={() => setVerPass((v) => !v)}
                  className="px-3 py-2 rounded-lg border bg-gray-50 hover:bg-gray-100 text-gray-700"
                  title={verPass ? "Ocultar" : "Mostrar"}
                >
                  {verPass ? "🙈" : "👁"}
                </button>
              </div>

              {errorPass && (
                <p className="mt-2 text-sm text-red-600">{errorPass}</p>
              )}
            </div>

            <div className="p-5 border-t flex justify-end gap-2">
              <button
                onClick={cerrarModalPolizas}
                className="px-4 py-2 rounded-lg bg-gray-100 text-gray-700 hover:bg-gray-200 transition"
              >
                Cancelar
              </button>
              <button
                onClick={confirmarPasswordPolizas}
                className="px-4 py-2 rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition"
              >
                Entrar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}