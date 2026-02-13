import React, { useEffect, useMemo, useState } from "react";
import { collection, getDocs, doc, updateDoc, query, orderBy } from "firebase/firestore";
import { db } from "./firebase";
import * as XLSX from "xlsx";
import SubirPolizas from "./SubirPolizas";

export default function VerPolizas() {
  const [cargando, setCargando] = useState(true);
  const [polizas, setPolizas] = useState([]);

  const [busqueda, setBusqueda] = useState("");
  const [aseguradoraSel, setAseguradoraSel] = useState("TODAS");
  const [filtroRapido, setFiltroRapido] = useState("TODOS");

  const [edit, setEdit] = useState({});
  const [guardandoId, setGuardandoId] = useState(null);

  // =========================
  // Helpers texto / números
  // =========================
  const norm = (v) =>
    String(v ?? "")
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .trim();

  const pad2 = (n) => String(n).padStart(2, "0");

  const parseNumber = (v) => {
    if (v === null || v === undefined || v === "") return 0;
    if (typeof v === "number") return isFinite(v) ? v : 0;
    const s = String(v).replace(/\./g, "").replace(",", ".").trim();
    const n = parseFloat(s);
    return isFinite(n) ? n : 0;
  };

  const money = (v) => {
    const n = parseNumber(v);
    try {
      return n.toLocaleString("es-CO");
    } catch {
      return String(n);
    }
  };

  const toSI = (v) => {
    if (typeof v === "boolean") return v ? "SI" : "NO";
    const s = norm(v).toUpperCase();
    if (s === "SI" || s === "SÍ" || s === "TRUE" || s === "1") return "SI";
    if (s === "NO" || s === "FALSE" || s === "0") return "NO";
    return "NO";
  };

  const isAnulada = (p) => toSI(p.anulada) === "SI";

  // =========================
  // Helpers fechas
  // =========================
  const toDateSafe = (value) => {
    if (value === null || value === undefined || value === "") return null;

    // Firestore Timestamp
    if (value && value.toDate && typeof value.toDate === "function") {
      const d = value.toDate();
      return isNaN(d.getTime()) ? null : d;
    }

    // Date
    if (value instanceof Date) {
      return isNaN(value.getTime()) ? null : value;
    }

    // Excel serial
    if (typeof value === "number" && isFinite(value)) {
      const excelEpoch = new Date(Date.UTC(1899, 11, 30));
      const d = new Date(excelEpoch.getTime() + value * 86400000);
      return isNaN(d.getTime()) ? null : d;
    }

    // String
    if (typeof value === "string") {
      const s = value.trim();
      if (!s) return null;

      // YYYY-MM-DD
      if (/^\d{4}-\d{2}-\d{2}$/.test(s)) {
        const d = new Date(s + "T00:00:00");
        return isNaN(d.getTime()) ? null : d;
      }

      // YYYY/MM/DD
      if (/^\d{4}\/\d{2}\/\d{2}$/.test(s)) {
        const parts = s.split("/");
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const da = parseInt(parts[2], 10);
        const dt = new Date(y, m - 1, da);
        return isNaN(dt.getTime()) ? null : dt;
      }

      // DD/MM/YYYY
      if (/^\d{2}\/\d{2}\/\d{4}$/.test(s)) {
        const parts = s.split("/");
        const da = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        const y = parseInt(parts[2], 10);
        const dt = new Date(y, m - 1, da);
        return isNaN(dt.getTime()) ? null : dt;
      }

      const dt = new Date(s);
      return isNaN(dt.getTime()) ? null : dt;
    }

    return null;
  };

  const formatYMD = (value) => {
    const d = toDateSafe(value);
    if (!d) return "";
    const y = String(d.getFullYear());
    const m = pad2(d.getMonth() + 1);
    const da = pad2(d.getDate());
    return y + "-" + m + "-" + da;
  };

  const daysTo = (value) => {
    const d = toDateSafe(value);
    if (!d) return null;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const target = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    const diff = target.getTime() - today.getTime();
    return Math.round(diff / 86400000);
  };

  // =========================
  // Estado / Semáforo
  // =========================
  const estadoPorFecha = (p) => {
    if (isAnulada(p)) return "ANULADA";
    const d = daysTo(p.fecha_fin);
    if (d === null) return "SIN_FECHA";
    if (d < 0) return "VENCIDA";
    if (d <= 30) return "PROXIMA";
    return "VIGENTE";
  };

  const rowClass = (p) => {
    const e = estadoPorFecha(p);
    if (e === "ANULADA") return "bg-gray-100 text-gray-600";
    if (e === "VENCIDA") return "bg-red-100";
    if (e === "PROXIMA") return "bg-yellow-100";
    if (e === "VIGENTE") return "bg-green-100";
    return "bg-white";
  };

  // =========================
  // Firestore: cargar
  // =========================
  const cargar = async () => {
    setCargando(true);
    try {
      const q = query(collection(db, "polizas"), orderBy("aseguradora", "asc"));
      const snap = await getDocs(q);
      const arr = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
      setPolizas(arr);
    } catch (e) {
      console.error("Error cargando pólizas:", e);
      alert("Error cargando pólizas. Revisa consola (F12).");
    } finally {
      setCargando(false);
    }
  };

  useEffect(() => {
    cargar();
  }, []);

  // =========================
  // Catálogo aseguradoras
  // =========================
  const aseguradoras = useMemo(() => {
    const set = new Set();
    polizas.forEach((p) => {
      const a = String(p.aseguradora || "").trim();
      if (a) set.add(a);
    });
    return ["TODAS"].concat(Array.from(set).sort());
  }, [polizas]);

  // =========================
  // Buscador + filtros
  // =========================
  const polizasFiltradas = useMemo(() => {
    let lista = [...polizas];

    // Filtro select aseguradora
    if (aseguradoraSel && aseguradoraSel !== "TODAS") {
      lista = lista.filter((p) => norm(p.aseguradora) === norm(aseguradoraSel));
    }

    // Buscador (aseguradora, poliza, placa, tomador, id_tomador, asegurado, id_asegurado)
    if (busqueda) {
      const q = norm(busqueda);
      lista = lista.filter((p) => {
        const texto = [
          p.aseguradora,
          p.poliza,
          p.placa,
          p.tomador,
          p.id_tomador,
          p.asegurado,
          p.id_asegurado,
        ]
          .map(norm)
          .join(" ");
        return texto.includes(q);
      });
    }

    // Filtros rápidos
    lista = lista.filter((p) => {
      const est = estadoPorFecha(p);
      if (filtroRapido === "TODOS") return true;
      if (filtroRapido === "VIGENTES") return est === "VIGENTE";
      if (filtroRapido === "PROXIMOS") return est === "PROXIMA";
      if (filtroRapido === "VENCIDAS") return est === "VENCIDA";
      if (filtroRapido === "ANULADAS") return est === "ANULADA";
      if (filtroRapido === "RENOV_SI") return toSI(p.renovacion) === "SI";
      if (filtroRapido === "RENOV_NO") return toSI(p.renovacion) === "NO";
      return true;
    });

    return lista;
  }, [polizas, busqueda, aseguradoraSel, filtroRapido]);

  // =========================
  // Contadores (sobre TODO el dataset)
  // =========================
  const contadores = useMemo(() => {
    let vig = 0,
      pro = 0,
      ven = 0,
      anu = 0;

    polizas.forEach((p) => {
      const e = estadoPorFecha(p);
      if (e === "VIGENTE") vig++;
      else if (e === "PROXIMA") pro++;
      else if (e === "VENCIDA") ven++;
      else if (e === "ANULADA") anu++;
    });

    return { vig, pro, ven, anu, total: polizas.length };
  }, [polizas]);

  // =========================
  // Resumen por aseguradora (sobre lo FILTRADO)
  // =========================
  const resumenAseguradora = useMemo(() => {
    const map = {}; // { aseguradora: { ... } }

    polizasFiltradas.forEach((p) => {
      const a = String(p.aseguradora || "SIN_ASEGURADORA").trim() || "SIN_ASEGURADORA";
      if (!map[a]) {
        map[a] = {
          aseguradora: a,
          total_polizas: 0,
          vigentes: 0,
          proximas: 0,
          vencidas: 0,
          anuladas: 0,
          suma_prima: 0,
          suma_total: 0,
        };
      }

      const est = estadoPorFecha(p);

      map[a].total_polizas += 1;
      if (est === "VIGENTE") map[a].vigentes += 1;
      else if (est === "PROXIMA") map[a].proximas += 1;
      else if (est === "VENCIDA") map[a].vencidas += 1;
      else if (est === "ANULADA") map[a].anuladas += 1;

      map[a].suma_prima += parseNumber(p.prima);
      map[a].suma_total += parseNumber(p.total);
    });

    const arr = Object.values(map);
    arr.sort((x, y) => y.total_polizas - x.total_polizas);
    return arr;
  }, [polizasFiltradas]);

  // =========================
  // Edit / Guardar
  // =========================
  const getEditValue = (id, field, fallback) => {
    if (edit[id] && Object.prototype.hasOwnProperty.call(edit[id], field)) {
      return edit[id][field];
    }
    return fallback;
  };

  const setEditValue = (id, field, value) => {
    setEdit((prev) => {
      const copy = { ...prev };
      copy[id] = { ...(copy[id] || {}), [field]: value };
      return copy;
    });
  };

  const guardarFila = async (p) => {
    try {
      setGuardandoId(p.id);

      const payload = {
        renovacion: toSI(getEditValue(p.id, "renovacion", toSI(p.renovacion))),
        anulada: toSI(getEditValue(p.id, "anulada", toSI(p.anulada))),
        gestion: String(getEditValue(p.id, "gestion", p.gestion || "")),
        telefono: String(getEditValue(p.id, "telefono", p.telefono || "")),
        comision: parseNumber(getEditValue(p.id, "comision", p.comision || 0)),
      };

      await updateDoc(doc(db, "polizas", p.id), payload);

      setPolizas((prev) => prev.map((x) => (x.id === p.id ? { ...x, ...payload } : x)));

      setEdit((prev) => {
        const copy = { ...prev };
        delete copy[p.id];
        return copy;
      });
    } catch (e) {
      console.error("Error guardando:", e);
      alert("No se pudo guardar. Revisa consola (F12).");
    } finally {
      setGuardandoId(null);
    }
  };

  // =========================
  // Exportar a Excel (filtrado)
  // =========================
  const exportarPolizas = () => {
    try {
      const rows = polizasFiltradas.map((p) => {
        return {
          Aseguradora: p.aseguradora || "",
          Poliza: p.poliza || "",
          Ramo: p.ramo || "",
          Placa: p.placa || "",
          Asegurado: p.asegurado || "",
          IdAsegurado: p.id_asegurado || "",
          Beneficiario: p.beneficiario || "",
          IdBeneficiario: p.id_beneficiario || "",
          Tomador: p.tomador || "",
          IdTomador: p.id_tomador || "",
          FechaExpedicion: formatYMD(p.fecha_expedicion),
          FechaInicio: formatYMD(p.fecha_inicio),
          FechaFin: formatYMD(p.fecha_fin),
          Prima: parseNumber(p.prima),
          GastosExpedicion: parseNumber(p.gastos_expedicion),
          Iva: parseNumber(p.iva),
          Total: parseNumber(p.total),
          Asesor: p.asesor || "",
          Renovacion: toSI(p.renovacion),
          Comision: parseNumber(p.comision),
          Telefono: p.telefono || "",
          Anulada: toSI(p.anulada),
          Gestion: p.gestion || "",
          Estado: estadoPorFecha(p),
        };
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Polizas");

      const nombre = "polizas_filtradas.xlsx";
      XLSX.writeFile(wb, nombre);
    } catch (e) {
      console.error(e);
      alert("No se pudo exportar. Revisa consola (F12).");
    }
  };

  const exportarResumen = () => {
    try {
      const rows = resumenAseguradora.map((r) => {
        return {
          Aseguradora: r.aseguradora,
          TotalPolizas: r.total_polizas,
          Vigentes: r.vigentes,
          Proximas: r.proximas,
          Vencidas: r.vencidas,
          Anuladas: r.anuladas,
          SumaPrima: r.suma_prima,
          SumaTotal: r.suma_total,
        };
      });

      const ws = XLSX.utils.json_to_sheet(rows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Resumen");

      const nombre = "resumen_por_aseguradora.xlsx";
      XLSX.writeFile(wb, nombre);
    } catch (e) {
      console.error(e);
      alert("No se pudo exportar resumen. Revisa consola (F12).");
    }
  };

  // =========================
  // UI
  // =========================
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="bg-white border rounded shadow-sm p-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-gray-800">Gestión de Pólizas</h2>
              <p className="text-xs text-gray-500">
                Semáforo por Fecha fin (verde/amarillo/rojo) y anuladas en gris.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 text-xs">
              <div className="px-3 py-1 rounded bg-green-100">Vigentes: {contadores.vig}</div>
              <div className="px-3 py-1 rounded bg-yellow-100">Próximas: {contadores.pro}</div>
              <div className="px-3 py-1 rounded bg-red-100">Vencidas: {contadores.ven}</div>
              <div className="px-3 py-1 rounded bg-gray-100">Anuladas: {contadores.anu}</div>
              <div className="px-3 py-1 rounded bg-blue-50">Total: {contadores.total}</div>
            </div>
          </div>

          {/* Subida Excel + Export */}
          <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
            <div className="w-full lg:w-[520px]">
              <SubirPolizas onDone={cargar} />
            </div>

            <div className="flex flex-wrap gap-2">
              <button
                onClick={exportarPolizas}
                className="px-3 py-2 rounded text-sm border bg-white hover:bg-gray-50"
              >
                Exportar pólizas (filtrado)
              </button>
              <button
                onClick={exportarResumen}
                className="px-3 py-2 rounded text-sm border bg-white hover:bg-gray-50"
              >
                Exportar resumen aseguradoras
              </button>
              <button
                onClick={cargar}
                className="px-3 py-2 rounded text-sm border bg-white hover:bg-gray-50"
              >
                {cargando ? "Cargando..." : "Recargar"}
              </button>
            </div>
          </div>

          {/* Filtros */}
          <div className="mt-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-col sm:flex-row gap-2 sm:items-center">
              <select
                value={aseguradoraSel}
                onChange={(e) => setAseguradoraSel(e.target.value)}
                className="border rounded px-2 py-2 text-sm bg-white"
              >
                {aseguradoras.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>

              <input
                value={busqueda}
                onChange={(e) => setBusqueda(e.target.value)}
                placeholder="Buscar por aseguradora, póliza, placa, tomador, ID tomador, asegurado, ID asegurado..."
                className="border rounded px-3 py-2 text-sm w-full sm:w-[520px]"
              />
            </div>

            <div className="flex flex-wrap gap-2">
              <BtnFiltro activo={filtroRapido === "TODOS"} onClick={() => setFiltroRapido("TODOS")} label="Todos" />
              <BtnFiltro activo={filtroRapido === "VIGENTES"} onClick={() => setFiltroRapido("VIGENTES")} label="Vigentes" />
              <BtnFiltro activo={filtroRapido === "PROXIMOS"} onClick={() => setFiltroRapido("PROXIMOS")} label="Próximos" />
              <BtnFiltro activo={filtroRapido === "VENCIDAS"} onClick={() => setFiltroRapido("VENCIDAS")} label="Vencidas" />
              <BtnFiltro activo={filtroRapido === "ANULADAS"} onClick={() => setFiltroRapido("ANULADAS")} label="Anuladas" />
              <BtnFiltro activo={filtroRapido === "RENOV_SI"} onClick={() => setFiltroRapido("RENOV_SI")} label="Renovación SI" />
              <BtnFiltro activo={filtroRapido === "RENOV_NO"} onClick={() => setFiltroRapido("RENOV_NO")} label="Renovación NO" />
            </div>
          </div>

          {/* Resumen por aseguradora (en pantalla) */}
          <div className="mt-4 border rounded bg-white overflow-auto">
            <div className="p-3 text-sm font-semibold text-gray-800">Resumen por aseguradora (según lo filtrado)</div>
            <table className="min-w-[900px] w-full text-sm">
              <thead className="bg-gray-100 text-gray-700">
                <tr>
                  <Th>Aseguradora</Th>
                  <Th>Total</Th>
                  <Th>Vigentes</Th>
                  <Th>Próximas</Th>
                  <Th>Vencidas</Th>
                  <Th>Anuladas</Th>
                  <Th className="text-right">Suma Prima</Th>
                  <Th className="text-right">Suma Total</Th>
                </tr>
              </thead>
              <tbody>
                {resumenAseguradora.length === 0 ? (
                  <tr>
                    <td className="p-3 text-gray-500" colSpan={8}>No hay datos para resumen con estos filtros.</td>
                  </tr>
                ) : (
                  resumenAseguradora.map((r) => (
                    <tr key={r.aseguradora} className="border-t">
                      <Td>{r.aseguradora}</Td>
                      <Td>{r.total_polizas}</Td>
                      <Td>{r.vigentes}</Td>
                      <Td>{r.proximas}</Td>
                      <Td>{r.vencidas}</Td>
                      <Td>{r.anuladas}</Td>
                      <Td className="text-right">{money(r.suma_prima)}</Td>
                      <Td className="text-right font-semibold">{money(r.suma_total)}</Td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Tabla */}
          <div className="mt-4 border rounded overflow-auto">
            <table className="min-w-[2200px] w-full text-sm">
              <thead className="bg-gray-100 text-gray-700 sticky top-0">
                <tr>
                  <Th>Aseguradora</Th>
                  <Th>Póliza</Th>
                  <Th>Ramo</Th>
                  <Th>Placa</Th>

                  <Th>Asegurado</Th>
                  <Th>ID asegurado</Th>

                  <Th>Beneficiario</Th>
                  <Th>ID beneficiario</Th>

                  <Th>Tomador</Th>
                  <Th>ID tomador</Th>

                  <Th>Fecha expedición</Th>
                  <Th>Fecha inicio</Th>
                  <Th>Fecha fin</Th>

                  <Th className="text-right">Prima</Th>
                  <Th className="text-right">Gastos exp.</Th>
                  <Th className="text-right">IVA</Th>
                  <Th className="text-right">Total</Th>

                  <Th>Asesor</Th>

                  <Th>Renovación</Th>
                  <Th>Comisión</Th>
                  <Th>Teléfono</Th>
                  <Th>Anulada</Th>

                  <Th>Gestión</Th>
                  <Th>Acción</Th>
                </tr>
              </thead>

              <tbody>
                {polizasFiltradas.length === 0 ? (
                  <tr>
                    <td className="p-4 text-gray-500" colSpan={24}>
                      No hay resultados con esos filtros.
                    </td>
                  </tr>
                ) : (
                  polizasFiltradas.map((p) => {
                    const dias = daysTo(p.fecha_fin);
                    const textoDias =
                      dias === null
                        ? ""
                        : dias < 0
                        ? "Vencida hace " + String(Math.abs(dias)) + " días"
                        : "Faltan " + String(dias) + " días";

                    return (
                      <tr key={p.id} className={rowClass(p) + " border-t"}>
                        <Td>{p.aseguradora || ""}</Td>
                        <Td className="font-medium">{p.poliza || ""}</Td>
                        <Td>{p.ramo || ""}</Td>
                        <Td>{p.placa || ""}</Td>

                        <Td>{p.asegurado || ""}</Td>
                        <Td>{p.id_asegurado || ""}</Td>

                        <Td>{p.beneficiario || ""}</Td>
                        <Td>{p.id_beneficiario || ""}</Td>

                        <Td>{p.tomador || ""}</Td>
                        <Td>{p.id_tomador || ""}</Td>

                        <Td>{formatYMD(p.fecha_expedicion)}</Td>
                        <Td>{formatYMD(p.fecha_inicio)}</Td>
                        <Td>
                          <div className="font-medium">{formatYMD(p.fecha_fin)}</div>
                          <div className="text-[11px] text-gray-600">{textoDias}</div>
                        </Td>

                        <Td className="text-right">{money(p.prima)}</Td>
                        <Td className="text-right">{money(p.gastos_expedicion)}</Td>
                        <Td className="text-right">{money(p.iva)}</Td>
                        <Td className="text-right font-semibold">{money(p.total)}</Td>

                        <Td>{p.asesor || ""}</Td>

                        <Td>
                          <select
                            value={getEditValue(p.id, "renovacion", toSI(p.renovacion))}
                            onChange={(e) => setEditValue(p.id, "renovacion", e.target.value)}
                            className="border rounded px-2 py-1 bg-white"
                          >
                            <option value="SI">SI</option>
                            <option value="NO">NO</option>
                          </select>
                        </Td>

                        <Td>
                          <input
                            value={getEditValue(p.id, "comision", p.comision || "")}
                            onChange={(e) => setEditValue(p.id, "comision", e.target.value)}
                            className="border rounded px-2 py-1 w-28 bg-white"
                            placeholder="0"
                          />
                        </Td>

                        <Td>
                          <input
                            value={getEditValue(p.id, "telefono", p.telefono || "")}
                            onChange={(e) => setEditValue(p.id, "telefono", e.target.value)}
                            className="border rounded px-2 py-1 w-40 bg-white"
                            placeholder="Teléfono"
                          />
                        </Td>

                        <Td>
                          <select
                            value={getEditValue(p.id, "anulada", toSI(p.anulada))}
                            onChange={(e) => setEditValue(p.id, "anulada", e.target.value)}
                            className="border rounded px-2 py-1 bg-white"
                          >
                            <option value="NO">NO</option>
                            <option value="SI">SI</option>
                          </select>
                        </Td>

                        <Td>
                          <input
                            value={getEditValue(p.id, "gestion", p.gestion || "")}
                            onChange={(e) => setEditValue(p.id, "gestion", e.target.value)}
                            className="border rounded px-2 py-1 w-72 bg-white"
                            placeholder="Escribe gestión..."
                          />
                        </Td>

                        <Td>
                          <button
                            onClick={() => guardarFila(p)}
                            disabled={guardandoId === p.id}
                            className={
                              "px-3 py-1 rounded text-white " +
                              (guardandoId === p.id ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700")
                            }
                          >
                            {guardandoId === p.id ? "Guardando..." : "Guardar"}
                          </button>
                        </Td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-3 text-xs text-gray-500">
            Nota: exporta exactamente lo que tengas filtrado (buscador + aseguradora + filtros rápidos).
          </div>
        </div>
      </div>
    </div>
  );
}

// =========================
// UI helpers
// =========================
function Th({ children, className = "" }) {
  return <th className={"p-2 text-left whitespace-nowrap " + className}>{children}</th>;
}

function Td({ children, className = "" }) {
  return <td className={"p-2 whitespace-nowrap " + className}>{children}</td>;
}

function BtnFiltro({ activo, onClick, label }) {
  return (
    <button
      onClick={onClick}
      className={
        "px-3 py-2 rounded text-sm border " +
        (activo ? "bg-gray-900 text-white border-gray-900" : "bg-white hover:bg-gray-50")
      }
    >
      {label}
    </button>
  );
}