import React, { useEffect, useState, Fragment } from "react";
import { db } from "./firebase";
import * as XLSX from "xlsx";
import { saveAs } from "file-saver";
import {
  collection,
  getDocs,
  updateDoc,
  doc,
  deleteDoc,
  writeBatch,
} from "firebase/firestore";
import SubirCartera from "./SubirCartera";

const aseguradorasFijas = [
  "Allianz","Sura","Estado","Previsora","Mundial","Solidaria","Axa","Mafre","Sbs","Hdi",
];

const VerCartera = () => {
  // --- UI / estado general ---
  const [data, setData] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("todos");
  const [filterAseguradora, setFilterAseguradora] = useState("todas");
  const [alerta, setAlerta] = useState({ tipo: "", mensaje: "" });

  // --- Gestión inline por fila ---
  const [openRowId, setOpenRowId] = useState(null);
  const [selectedPoliza, setSelectedPoliza] = useState(null);
  const [selectedDocId, setSelectedDocId] = useState(null);
  const [gestionText, setGestionText] = useState("");
  const [rowRecaudada, setRowRecaudada] = useState("");

  // --- Contadores ---
  const [vigentes, setVigentes] = useState(0);
  const [proximas, setProximas] = useState(0);
  const [vencidas, setVencidas] = useState(0);
  const [anuladas, setAnuladas] = useState(0);
  const [gestionSi, setGestionSi] = useState(0);
  const [gestionTexto, setGestionTexto] = useState(0);
  const [filtroGestion, setFiltroGestion] = useState("todos");

  // --- Negativos ---
  const [negativos, setNegativos] = useState(0);
  const [negativosTotal, setNegativosTotal] = useState(0);

  // --- Estado de borrado masivo ---
  const [borrando, setBorrando] = useState(false);

  useEffect(() => { setFiltroGestion("todos"); }, [filterStatus, filterAseguradora]);

  // ================== HELPERS ==================

  const calcularDiasDesdeEmision = (fechaEmision) => {
    if (!fechaEmision) return 0;
    let partes = fechaEmision.includes("-")
      ? fechaEmision.split("-")
      : fechaEmision.split("/").reverse();
    const hoy = new Date();
    const fecha = new Date(+partes[0], +partes[1]-1, +partes[2]);
    return Math.floor((hoy - fecha) / (1000*60*60*24));
  };

  const getRowColor = (fechaEmision, recaudada, anulada) => {
    if ((anulada || "").toLowerCase().trim() === "sí") return "#e5e7eb";
    const dias = calcularDiasDesdeEmision(fechaEmision);
    if ((recaudada || "").toLowerCase() === "sí") return "#bfdbfe";
    if (dias >= 31) return "#fecaca";
    if (dias >= 25) return "#fef08a";
    return "#bbf7d0";
  };

  // --- MONTO (lee de 'valor' y, si no, de 'pendiente') ---
  const getMontoRaw = (row) => {
    const keys = ["valor","Valor","pendiente","Pendiente","PENDIENTE"];
    for (const k of keys) if (row && Object.prototype.hasOwnProperty.call(row, k)) return row[k];
    return row?.valor ?? row?.pendiente ?? "";
  };

  // Parser ULTRA robusto (maneja -, −, (xxxx), 1.234,56 / 1,234.56 / $ 1.234, etc.)
  const parseMoney = (v) => {
    let s = String(v ?? "").trim();
    if (!s) return 0;

    // normaliza guiones raros y NBSP
    s = s.replace(/[\u2010-\u2015\u2212]/g, "-").replace(/\u00A0/g, "");

    // negativo por paréntesis
    const parenNeg = /^\(.*\)$/.test(s);

    // deja solo dígitos, separadores y signo
    s = s.replace(/[^\d.,-]/g, "");

    // si hay . y , asumimos formato EU (1.234,56)
    if (s.includes(".") && s.includes(",")) {
      s = s.replace(/\./g, "").replace(/,/g, ".");
    } else {
      if (s.includes(",") && !s.includes(".")) {
        const last = s.lastIndexOf(",");
        s = s.slice(0, last).replace(/,/g, "") + "." + s.slice(last + 1);
      } else if (s.includes(".")) {
        const last = s.lastIndexOf(".");
        s = s.slice(0, last).replace(/\./g, "") + "." + s.slice(last + 1);
      }
    }

    const hadMinus = /-/.test(s);
    s = s.replace(/-/g, "");

    let num = parseFloat(s);
    if (isNaN(num)) num = 0;

    if (hadMinus || parenNeg) num = -Math.abs(num);
    return num;
  };

  const getMontoNumber = (row) => parseMoney(getMontoRaw(row));
  const esNegativo = (row) => getMontoNumber(row) < 0;

  // Categorizadores
  const esVigente = (row) => {
    const g = (row.gestion || "").toLowerCase().trim();
    const a = (row.anulada || "").toLowerCase().trim();
    const f = row.fecha_emision;
    if (!f || g === "sí" || a === "sí") return false;
    const d = calcularDiasDesdeEmision(f);
    return d < 25;
  };
  const esProximo = (row) => {
    const g = (row.gestion || "").toLowerCase().trim();
    const a = (row.anulada || "").toLowerCase().trim();
    const f = row.fecha_emision;
    if (!f || g === "sí" || a === "sí") return false;
    const d = calcularDiasDesdeEmision(f);
    return d >= 25 && d <= 30;
  };
  const esVencida = (row) => {
    const g = (row.gestion || "").toLowerCase().trim();
    const a = (row.anulada || "").toLowerCase().trim();
    const f = row.fecha_emision;
    if (!f || g === "sí" || a === "sí") return false;
    const d = calcularDiasDesdeEmision(f);
    return d >= 31;
  };
  const esAnulada = (row) => (row.anulada || "").toLowerCase().trim() === "sí";
  const esGestionSi = (row) => {
    const g = (row.gestion || "").toLowerCase().trim();
    return g === "sí" || g === "si";
  };
  const esGestionTexto = (row) => {
    const g = (row.gestion || "").toLowerCase().trim();
    return g !== "" && g !== "si" && g !== "sí";
  };

  // ================== CARGA DE DATOS ==================
  const cargarDatos = async () => {
    const snap = await getDocs(collection(db, "cartera"));
    const documentos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const anuladasValidas = documentos.filter((d) => {
      const anulada = (d.anulada || "").toLowerCase().trim();
      const tieneMinimos = d.poliza && d.aseguradora && d.nombre;
      return !(anulada === "sí" && !tieneMinimos);
    });
    setData(anuladasValidas);
  };

  useEffect(() => { cargarDatos(); }, []);

  // ================== CONTADORES ==================
  useEffect(() => {
    const dataFiltrada =
      filterAseguradora === "todas"
        ? data
        : data.filter(
            (row) =>
              (row.aseguradora || "").toLowerCase().trim() ===
              filterAseguradora.toLowerCase()
          );

    setVigentes(dataFiltrada.filter(esVigente).length);
    setProximas(dataFiltrada.filter(esProximo).length);
    setVencidas(dataFiltrada.filter(esVencida).length);
    setAnuladas(dataFiltrada.filter(esAnulada).length);
    setGestionSi(dataFiltrada.filter(esGestionSi).length);
    setGestionTexto(dataFiltrada.filter(esGestionTexto).length);

    const negRows = dataFiltrada.filter(esNegativo);
    setNegativos(negRows.length);
    setNegativosTotal(negRows.reduce((acc, r) => acc + getMontoNumber(r), 0));
  }, [data, filterAseguradora]);

  // ================== EXPORTAR ==================
  const exportarExcel = () => {
    const wb = XLSX.utils.book_new();
    const wsData = data.map((row) => ({
      Aseguradora: row.aseguradora,
      Nombre: row.nombre,
      Asesor: row.asesor,
      Placa: row.placa,
      Ramo: row.ramo,
      Poliza: row.poliza,
      "Fecha Emision": row.fecha_emision,
      "Fecha Vencimiento": row.fecha_vencimiento,
      Valor: row.valor,
      Recaudada: row.recaudada,
      Observacion: row.observacion,
    }));
    const ws = XLSX.utils.json_to_sheet(wsData);
    XLSX.utils.book_append_sheet(wb, ws, "Cartera");
    const excelBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
    const blob = new Blob([excelBuffer], { type: "application/octet-stream" });
    saveAs(blob, "cartera_exportada.xlsx");
  };

  // ================== WHATSAPP ==================
  const enviarAlertaWhatsapp = async () => {
    const numeroDestino = "whatsapp:+573242139020";
    const proximasVencidas = data.filter((row) => {
      const dias = calcularDiasDesdeEmision(row["fecha_emision"]);
      return dias >= 25 && dias <= 30;
    });
    if (!proximasVencidas.length) return window.alert("No hay pólizas próximas a vencer.");
    const mensaje = proximasVencidas.map((p) => `• Póliza: ${p.poliza}, Emisión: ${p.fecha_emision}`).join("\n");
    const cuerpo = `⚠️ *ALERTA DE CARTERA PRÓXIMA A VENCER* ⚠️\n\n${mensaje}`;
    try {
      const r = await fetch("http://localhost:3000/send-alert", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ to: numeroDestino, message: cuerpo }),
      });
      if (!r.ok) return window.alert("Error: " + (await r.text()));
      window.alert("¡Alerta enviada exitosamente!");
    } catch (e) { window.alert("Error de red: " + e.message); }
  };

  // ================== BORRADOS POR CONTADOR ==================
  const borrarPorFiltro = async (nombreGrupo, predicado) => {
    const ok1 = window.confirm(`⚠️ Vas a BORRAR definitivamente las pólizas del grupo "${nombreGrupo}". ¿Continuar?`);
    if (!ok1) return;
    const ok2 = (window.prompt(`Escribe BORRAR para confirmar el borrado de "${nombreGrupo}".`) || "").toUpperCase();
    if (ok2 !== "BORRAR") return;

    try {
      setBorrando(true);
      const snap = await getDocs(collection(db, "cartera"));
      const objetivos = snap.docs.filter((d) => predicado({ id: d.id, ...d.data() }));
      if (!objetivos.length) {
        setBorrando(false);
        return window.alert(`No hay documentos en "${nombreGrupo}" para borrar.`);
      }
      let total = 0;
      for (let i = 0; i < objetivos.length; i += 450) {
        const chunk = objetivos.slice(i, i + 450);
        const batch = writeBatch(db);
        chunk.forEach((d) => batch.delete(doc(db, "cartera", d.id)));
        await batch.commit();
        total += chunk.length;
        await new Promise((r) => setTimeout(r, 25));
      }
      await cargarDatos();
      setAlerta({ tipo: "ok", mensaje: `Borradas ${total} pólizas del grupo "${nombreGrupo}".` });
      setTimeout(() => setAlerta({ tipo: "", mensaje: "" }), 3000);
    } catch (e) {
      console.error(e);
      setAlerta({ tipo: "error", mensaje: `No se pudo borrar "${nombreGrupo}".` });
      setTimeout(() => setAlerta({ tipo: "", mensaje: "" }), 3500);
    } finally {
      setBorrando(false);
    }
  };

  const confirmarEliminacion = async (id) => {
    if (!window.confirm("¿Deseas eliminar esta póliza anulada permanentemente?")) return;
    await deleteDoc(doc(db, "cartera", id));
    window.alert("Póliza eliminada definitivamente.");
    cargarDatos();
  };

  const formatCOP = (n) =>
    new Intl.NumberFormat("es-CO", { style: "currency", currency: "COP", maximumFractionDigits: 0 }).format(n || 0);

  // ================== RENDER ==================
  return (
    <div className="w-full max-w-(1500px) px-1">
      
      
      <h1 className="text-5xl font-extrabold text-center text-green-700 mb-10">Bienvenido a tu Cartera</h1>

      {alerta.mensaje && (
        <div className={`p-4 mb-6 rounded text-white text-center ${alerta.tipo === "error" ? "bg-red-500" : "bg-green-500"}`}>
          {alerta.mensaje}
        </div>
      )}

      <div className="flex justify-center mb-6">
        <SubirCartera recargar={cargarDatos} />
      </div>

      {/* Resumen */}
      <div className="flex flex-wrap justify-center gap-6 mb-4">
        <div className="bg-green-200 text-green-800 px-6 py-2 rounded-lg shadow text-center w-56 flex justify-center items-center gap-2">
          ✅ <span className="font-bold">Vigentes:</span> {vigentes}
        </div>
        <div className="bg-yellow-200 text-yellow-800 px-6 py-2 rounded-lg shadow text-center w-56 flex justify-center items-center gap-2">
          ⏳ <span className="font-bold">Próximos:</span> {proximas}
        </div>
        <div className="bg-red-200 text-red-800 px-6 py-2 rounded-lg shadow text-center w-56 flex justify-center items-center gap-2">
          ⛔ <span className="font-bold">Vencidas:</span> {vencidas}
        </div>
        <div className="bg-gray-300 text-gray-800 px-6 py-2 rounded-lg shadow text-center w-56 flex justify-center items-center gap-2">
          ❌ <span className="font-bold">Anuladas:</span> {anuladas}
        </div>
        <div className="bg-yellow-200 p-2 rounded shadow">
          <div className="text-yellow-800 font-bold text-xl">{gestionSi}</div>
          <div className="text-gray-700">Gestión = "sí"</div>
        </div>
        <div className="bg-blue-100 p-2 rounded shadow">
          <div className="text-blue-800 font-bold text-xl">{gestionTexto}</div>
          <div className="text-gray-700">Gestión con texto</div>
        </div>

        {/* Negativos */}
        <div className="bg-rose-200 text-rose-800 px-6 py-2 rounded-lg shadow text-center w-64 flex flex-col items-center gap-1">
          <div className="flex items-center gap-2">➖ <span className="font-bold">Negativos:</span> {negativos}</div>
          <div className="text-sm">Total: <span className="font-semibold">{formatCOP(negativosTotal)}</span></div>
        </div>
      </div>

      {/* Borradores */}
      <div className="flex gap-2 flex-wrap justify-center mb-8">
        <button disabled={borrando} onClick={() => borrarPorFiltro("Vigentes", esVigente)} className={`px-3 py-2 rounded ${borrando?"opacity-60":""} bg-green-700 text-white hover:bg-green-800`}>Borrar Vigentes</button>
        <button disabled={borrando} onClick={() => borrarPorFiltro("Próximos", esProximo)} className={`px-3 py-2 rounded ${borrando?"opacity-60":""} bg-yellow-600 text-white hover:bg-yellow-700`}>Borrar Próximos</button>
        <button disabled={borrando} onClick={() => borrarPorFiltro("Vencidas", esVencida)} className={`px-3 py-2 rounded ${borrando?"opacity-60":""} bg-red-700 text-white hover:bg-red-800`}>Borrar Vencidas</button>
        <button disabled={borrando} onClick={() => borrarPorFiltro("Anuladas", esAnulada)} className={`px-3 py-2 rounded ${borrando?"opacity-60":""} bg-gray-700 text-white hover:bg-gray-800`}>Borrar Anuladas</button>
        <button disabled={borrando} onClick={() => borrarPorFiltro('Gestión = "sí"', esGestionSi)} className={`px-3 py-2 rounded ${borrando?"opacity-60":""} bg-amber-700 text-white hover:bg-amber-800`}>Borrar Gestión = "sí"</button>
        <button disabled={borrando} onClick={() => borrarPorFiltro("Gestión con texto", esGestionTexto)} className={`px-3 py-2 rounded ${borrando?"opacity-60":""} bg-blue-700 text-white hover:bg-blue-800`}>Borrar Gestión (texto)</button>
        {/* Negativos respetando filtro de aseguradora */}
        <button
          disabled={borrando}
          onClick={() =>
            borrarPorFiltro(
              `Negativos (valor/pendiente < 0${filterAseguradora!=="todas" ? `, ${filterAseguradora}` : ""})`,
              (row) =>
                esNegativo(row) &&
                (filterAseguradora === "todas" ||
                  String(row.aseguradora || "").toLowerCase().trim() ===
                    filterAseguradora.toLowerCase().trim())
            )
          }
          className={`px-3 py-2 rounded ${borrando?"opacity-60":""} bg-rose-700 text-white hover:bg-rose-800`}
        >
          Borrar Negativos (filtro actual)
        </button>
      </div>

      {/* WhatsApp */}
      <div className="flex justify-center mb-10">
        <button className="bg-green-600 hover:bg-green-700 text-white py-2 px-6 rounded-lg shadow-lg" onClick={enviarAlertaWhatsapp}>
          Enviar Alerta a WhatsApp
        </button>
      </div>

      {/* Filtros superiores */}
      <div className="flex justify-center mb-8 gap-4">
        <select className="border p-3 rounded-md shadow-md" value={filterAseguradora} onChange={(e) => setFilterAseguradora(e.target.value)}>
          <option value="todas">Todas las Aseguradoras</option>
          {aseguradorasFijas.map((aseg, idx) => <option key={idx} value={aseg}>{aseg}</option>)}
        </select>

        <input type="text" placeholder="Buscar por nombre, póliza o placa..." className="border p-3 rounded-md flex-grow shadow-md w-96" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />

        <button className={`${filterStatus==="todos"?"bg-blue-600":"bg-blue-500"} text-white py-2 px-4 rounded shadow`} onClick={() => setFilterStatus("todos")}>Todos</button>
        <button className="bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded shadow" onClick={() => setFilterStatus("vigente")}>Vigentes</button>
        <button className="bg-yellow-400 hover:bg-yellow-500 text-black py-2 px-4 rounded shadow" onClick={() => setFilterStatus("proximo")}>Próximos</button>
        <button className="bg-red-500 hover:bg-red-600 text-white py-2 px-4 rounded shadow" onClick={() => setFilterStatus("vencido")}>Vencidos</button>
        <button className={`${filterStatus==="negativos"?"bg-rose-500 text-white":"bg-rose-200 text-black"} hover:bg-rose-400 py-2 px-4 rounded shadow`} onClick={() => setFilterStatus("negativos")}>Negativos</button>

        <button className="bg-purple-500 hover:bg-purple-600 text-white py-2 px-4 rounded shadow" onClick={exportarExcel}>Exportar a Excel</button>

        <button className={`${filtroGestion==="si"?"bg-yellow-500 text-white":"bg-yellow-200 text-black"} hover:bg-yellow-400 py-2 px-4 rounded shadow`} onClick={() => setFiltroGestion(filtroGestion==="si"?"todos":"si")}>Gestión = "sí"</button>
        <button className={`${filtroGestion==="texto"?"bg-blue-500 text-white":"bg-blue-100 text-black"} hover:bg-blue-400 py-2 px-4 rounded shadow`} onClick={() => setFiltroGestion(filtroGestion==="texto"?"todos":"texto")}>Gestión con texto</button>
        <button className="bg-gray-500 hover:bg-gray-600 text-white py-2 px-4 rounded shadow" onClick={() => setFilterStatus("anulada")}>Anuladas</button>
      </div>

      {/* Tabla */}
      <div className="-translate-x-44">
        <table className=" w-full border-collapse rounded-lg text-base shadow-lg">
          <thead className="bg-gray-300">
            <tr>
              <th className="px-2 py-2 border text-center">Aseguradora</th>
              <th className="px-2 py-2 border text-center">Nombre</th>
              <th className="px-2 py-2 border text-center">Documento</th>
              <th className="px-2 py-2 border text-center">Asesor</th>
              <th className="px-2 py-2 border text-center">Placa</th>
              <th className="px-2 py-2 border text-center">Ramo</th>
              <th className="px-2 py-2 border text-center">Póliza</th>
              <th className="px-2 py-2 border text-center">Valor</th>
              <th className="px-2 py-2 border text-center">Fecha Emisión</th>
              <th className="px-2 py-2 border text-center">Fecha Vencimiento</th>
              <th className="px-2 py-2 border text-center">Recaudada</th>
              <th className="px-2 py-2 border text-center">Acciones</th>
              <th className="px-2 py-2 border text-center">Gestión</th>
            </tr>
          </thead>

          <tbody>
            {data
              .filter((row) => {
                const term = searchTerm.toLowerCase();
                const cumpleAseguradora =
                  filterAseguradora === "todas" ||
                  String(row.aseguradora || "").toLowerCase().trim() === filterAseguradora.toLowerCase().trim();
                const coincideBusqueda =
                  term === "" ||
                  String(row.nombre || "").toLowerCase().includes(term) ||
                  String(row.cliente || "").toLowerCase().includes(term) ||
                  String(row.producto || "").toLowerCase().includes(term) ||
                  String(row.poliza || "").toLowerCase().includes(term) ||
                  String(row.documento || "").toLowerCase().includes(term) ||
                  String(row.placa || "").toLowerCase().includes(term);
                if (!cumpleAseguradora || !coincideBusqueda) return false;

                const dias = calcularDiasDesdeEmision(row["fecha_emision"]);
                const gestion = (row.gestion || "").toLowerCase().trim();
                const anulada = (row.anulada || "").toLowerCase().trim();

                if (filtroGestion === "si" && gestion !== "sí") return false;
                if (filtroGestion === "texto" && (gestion === "" || gestion === "si")) return false;

                if (filterStatus === "vigente") return dias < 25 && anulada !== "sí";
                if (filterStatus === "proximo") return dias >= 25 && dias <= 30 && anulada !== "sí";
                if (filterStatus === "vencido") return dias > 31 && gestion !== "si" && anulada !== "sí";
                if (filterStatus === "anulada") return anulada === "sí";
                if (filterStatus === "negativos") return esNegativo(row);

                return true;
              })
              .map((row) => (
                <Fragment key={row.id}>
                  {/* Fila principal */}
                  <tr style={{ backgroundColor: getRowColor(row["fecha_emision"], row["recaudada"], row["anulada"]) }}>
                    <td className="px-2 py-2 border text-center">{row.aseguradora}</td>
                    <td className="px-2 py-2 border text-center">{row.nombre}</td>
                    <td className="px-2 py-2 border text-center">{row.documento}</td>
                    <td className="px-2 py-2 border text-center">{row.asesor}</td>
                    <td className="px-2 py-2 border text-center">{row.placa}</td>
                    <td className="px-2 py-2 border text-center">{row.ramo}</td>
                    <td className="px-2 py-2 border text-center">{row.poliza}</td>
                    <td className="px-2 py-2 border text-center">
                      ${Number(parseMoney(row.valor)).toLocaleString("es-CO")}
                    </td>
                    <td className="px-2 py-1 border text-center">{row.fecha_emision}</td>
                    <td className="px-2 py-1 border text-center">{row.fecha_vencimiento}</td>
                    <td className="px-2 py-1 border text-center">{row.recaudada}</td>

                    {/* Acciones */}
                    <td className="px-2 py-1 border text-center">
                      <div className="flex gap-2 justify-center flex-wrap">
                        {row.anulada?.toLowerCase().trim() === "sí" && (
                          <button onClick={() => confirmarEliminacion(row.id)} className="bg-red-600 hover:bg-red-700 text-white px-2 py-1 rounded">
                            Confirmar Anulación
                          </button>
                        )}
                        <button
                          onClick={() => {
                            const next = openRowId === row.id ? null : row.id;
                            setOpenRowId(next);
                            setSelectedPoliza(row.poliza);
                            setSelectedDocId(row.id);
                            setRowRecaudada(row.recaudada || "");
                            setGestionText(row.gestion || "");
                          }}
                          className="bg-blue-500 hover:bg-blue-700 text-white px-3 py-1 rounded"
                        >
                          {openRowId === row.id ? "Cerrar" : "Gestionar"}
                        </button>
                      </div>
                    </td>

                    {/* Columna Gestión */}
                    <td className="px-2 py-1 border text-center">
                      {row.gestion || <span className="text-gray-400">Sin gestión</span>}
                    </td>
                  </tr>

                  {/* Panel inline de gestión */}
                  {openRowId === row.id && (
                    <tr className="bg-gray-50">
                      <td colSpan={12} className="px-4 py-4 border">
                        <div className="flex flex-col gap-3 sticky top-6">
                          <div className="text-sm text-gray-700">
                            Gestionando póliza <span className="font-semibold">{row.poliza}</span> · {row.aseguradora}
                          </div>

                          <div className="grid grid-cols-(1fr_320px)  gap-6">
                            <div className="md:col-span-1">
                              <label className="block text-xs text-gray-600 mb-4">Recaudada</label>
                              <select className="w-full border p-2 rounded" value={rowRecaudada} onChange={(e) => setRowRecaudada(e.target.value)}>
                                <option value="">Selecciona...</option>
                                <option value="Sí">Sí</option>
                              </select>
                            </div>

                            <div className="md:col-span-2">
                              <label className="block text-xs text-gray-600 mb-4">Gestión / Nota</label>
                              <textarea
                                className="w-full border p-2 rounded min-h-[90px]"
                                rows="4"
                                placeholder="Escribe tu gestión aquí..."
                                value={gestionText}
                                onChange={(e) => setGestionText(e.target.value)}
                              />
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <button
                              className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700"
                              onClick={async () => {
                                if (!selectedDocId) return window.alert("No se encontró el ID del documento.");
                                try {
                                  const valorGestion = rowRecaudada === "Sí" ? "sí" : gestionText;
                                  await updateDoc(doc(db, "cartera", selectedDocId), {
                                    recaudada: rowRecaudada,
                                    gestion: valorGestion,
                                  });
                                  await cargarDatos();
                                  setOpenRowId(null);
                                  setAlerta({ tipo: "ok", mensaje: "Gestión guardada correctamente" });
                                  setTimeout(() => setAlerta({ tipo: "", mensaje: "" }), 2500);
                                } catch (e) {
                                  console.error("Error al guardar gestión:", e);
                                  setAlerta({ tipo: "error", mensaje: "Hubo un error al guardar la gestión." });
                                  setTimeout(() => setAlerta({ tipo: "", mensaje: "" }), 3000);
                                }
                              }}
                            >
                              Guardar Gestión
                            </button>

                            <button className="bg-white border px-2 py-1 rounded hover:bg-gray-100" onClick={() => setOpenRowId(null)}>
                              Cancelar
                            </button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default VerCartera;
