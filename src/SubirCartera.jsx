import React from "react";
import * as XLSX from "xlsx";
import { db } from "./firebase";

import {
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from "firebase/firestore";

const SubirCartera = ({ recargar }) => {

  const formatFecha = (fecha) => {
    if (!fecha) return "";
    if (typeof fecha === "string") return fecha;
    if (typeof fecha === "number") {
      const excelDate = new Date(Math.round((fecha - 25569) * 86400 * 1000));
      return excelDate.toISOString().split("T")[0];
    }
    if (fecha instanceof Date) return fecha.toISOString().split("T")[0];
    return "";
  };

  const normalizar = (valor) =>
    (valor || "")
      .toString()
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]/g, "");

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    try {
      const reader = new FileReader();

      reader.onload = async (e) => {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const sheetName = workbook.SheetNames[0];
        const sheet = workbook.Sheets[sheetName];
        const dataExcel = XLSX.utils.sheet_to_json(sheet);

        const carteraCollection = collection(db, "cartera");
        const snapshot = await getDocs(carteraCollection);

        // 🔹 Mapeo pólizas en Firebase
        const polizasFirebase = {};
        snapshot.forEach((docu) => {
          const d = docu.data();
          const clave = normalizar(d.poliza);
          if (clave) {
            polizasFirebase[clave] = {
              id: docu.id,
              data: d,
            };
          }
        });

        // 🔹 Claves desde Excel
        const clavesExcel = new Set();
        dataExcel.forEach((item) => {
          const clave = normalizar(item["Poliza"]);
          if (clave) clavesExcel.add(clave);
        });

        let nuevas = 0;
        let anuladas = 0;
        let eliminadas = 0;

        // 🔹 Eliminar / anular
        for (const clave in polizasFirebase) {
          const { id, data } = polizasFirebase[clave];
          const gestion = (data.gestion || "").toLowerCase().trim();
          const estaEnExcel = clavesExcel.has(clave);

          if (gestion === "sí") {
            await deleteDoc(doc(db, "cartera", id));
            eliminadas++;
          } else if (!estaEnExcel) {
            await updateDoc(doc(db, "cartera", id), { anulada: "sí" });
            anuladas++;
          }
        }

        // 🔹 Crear o actualizar desde Excel
        for (const item of dataExcel) {
          const clave = normalizar(item["Poliza"]);
          if (!clave) continue;

          const existente = polizasFirebase[clave];

          const documentoExcel =
            item["Documento"]?.toString().trim() || "";

          const nuevaData = {
            aseguradora: item["Aseguradora"] || existente?.data?.aseguradora || "",
            nombre: item["Nombre"] || existente?.data?.nombre || "",
            asesor: item["Asesor"] || existente?.data?.asesor || "",
            placa: item["Placa"] || existente?.data?.placa || "",
            ramo: item["Ramo"] || existente?.data?.ramo || "",
            poliza: item["Poliza"] || existente?.data?.poliza || "",
            fecha_emision:
              formatFecha(item["Fecha de emisión"]) ||
              formatFecha(item["Fecha de emision"]) ||
              existente?.data?.fecha_emision ||
              "",
            fecha_vencimiento:
              formatFecha(item["Fecha de vencimiento"]) ||
              existente?.data?.fecha_vencimiento ||
              "",
            valor: item["Valor"] || existente?.data?.valor || "",
            pendiente: item["Pendiente"] || existente?.data?.pendiente || "",
            recaudada: item["Recaudada"] || existente?.data?.recaudada || "",
            observacion: item["Observacion"] || existente?.data?.observacion || "",
            vigente: item["Vigente"] || existente?.data?.vigente || "",
            pago_jl: item["Pago JL"] || existente?.data?.pago_jl || "",
            gestion: existente?.data?.gestion || "",
            anulada: existente?.data?.anulada || "",
            documento:
              documentoExcel || existente?.data?.documento || "",
          };

          if (existente) {
            await updateDoc(
              doc(db, "cartera", existente.id),
              nuevaData
            );
          } else {
            await addDoc(carteraCollection, nuevaData);
            nuevas++;
          }
        }

        if (recargar) await recargar();

        setTimeout(() => {
          alert(`¡Cartera actualizada!
- Nuevas: ${nuevas}
- Anuladas: ${anuladas}
- Eliminadas (gestión "sí"): ${eliminadas}`);
        }, 300);
      };

      reader.readAsArrayBuffer(file);
    } catch (error) {
      console.error("Error al subir cartera:", error);
      alert("Hubo un error subiendo el archivo.");
    }
  };

  return (
    <div className="mt-8 p-6 text-center">
      <h2 className="text-2xl font-bold mb-4 text-green-700">
        Subir Nueva Cartera
      </h2>

      <input
        type="file"
        accept=".xlsx, .xls"
        onChange={handleFileUpload}
        className="block mx-auto mb-4"
      />

      <p className="text-gray-600">
        Se cargan documentos desde Excel, se conservan los existentes,
        se eliminan pólizas gestionadas y se anulan las que no vienen.
      </p>
    </div>
  );
};

export default SubirCartera;