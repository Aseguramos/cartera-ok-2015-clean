import { useState } from "react";

import { collection, getDocs } from "firebase/firestore";
import { db } from "./firebase";
import { useEffect } from "react";
function getSemaforo(poliza) {

  // ⚪ Obligatorio elegir endoso primero
  if (poliza.endoso === "") return "rojo";

  const baseCompleta =
    poliza.montada &&
    poliza.recaudada &&
    poliza.firmada &&
    poliza.desembolsada;

  const baseParcial =
    poliza.montada ||
    poliza.recaudada ||
    poliza.firmada ||
    poliza.desembolsada;

  // 🟡 Delegada pero puede quedar verde si completa todo
  if (poliza.delegada) {
    if (poliza.endoso === "SI") {
      if (baseCompleta && poliza.certificacion) return "verde";
    } else {
      if (baseCompleta) return "verde";
    }
    return "amarillo";
  }

  // 🟣 ENDOSO = SI
  if (poliza.endoso === "SI") {
    if (baseCompleta && poliza.certificacion) return "verde";
    if (baseParcial || poliza.certificacion) return "amarillo";
    return "rojo";
  }

  // 🟢 ENDOSO = NO
  if (baseCompleta) return "verde";
  if (baseParcial) return "amarillo";

  return "rojo";

}
function formatearNumero(valor) {
  if (!valor) return "";
  return new Intl.NumberFormat("es-CO").format(valor);
}
export default function PolizasFinanciadas() {

  const entidadesLista = [
  "Finesa",
  "Previcredito",
  "Crediestado",
  "Credivalores",
  "ALLIANZ",
  "ESTADO",
  "SURA",
  "MUNDIAL",
  "PREVISORA",
  "AXA COLPATRIA",
  "MAPFRE",
  "SBS",
  "SOLIDARIA",
  "HDI"
];

const aseguradorasLista = [
  "ALLIANZ",
  "ESTADO",
  "SURA",
  "MUNDIAL",
  "PREVISORA",
  "AXA COLPATRIA",
  "MAPFRE",
  "SBS",
  "SOLIDARIA",
  "HDI"
];
const [carteraReal, setCarteraReal] = useState([]);
useEffect(() => {
  const cargarCartera = async () => {
    const querySnapshot = await getDocs(collection(db, "cartera"));
    const datos = querySnapshot.docs.map(doc => doc.data());
    setCarteraReal(datos);
  };

  cargarCartera();
}, []);

  const [polizas, setPolizas] = useState([


    {
      id: 1,
      numeroPoliza: "",
      fecha: "2026-02-10",
      placa: "ABC123",
      nombre: "Juan Perez",
      entidad: "Finesa",
      aseguradora: "SURA",
      gestor: "",
      cuotas:1,
      valor: 2500000,
      montada: false,
      recaudada: false,
      firmada: false,
endoso: "",   // obligatorio seleccionar SI o NO
      certificacion: false,
      desembolsada: false,
      delegada: false

      
      
    }
    
  ]);
  const agregarPoliza = () => {
  setPolizas([
    ...polizas,
    {
      id: Date.now(),
      numeroPoliza: "",
      fecha: "",
      placa: "",
      nombre: "",
      entidad: "Finesa",
      gestor: "",
      cuotas: 1,
      valor: "",
      montada: false,
      recaudada: false,
      firmada: false,
      endoso: "",
      desembolsada: false,
      delegada: false,
      delegadaA: ""
      
    }
  ]);
};

const eliminarPoliza = (id) => {
  setPolizas(polizas.filter(p => p.id !== id));
};
  
  return (
    <div className="pl-0 pr-4 pt-4 pb-4 w-full text-left">
      <h2 className="text-xl font-bold mb-4 text-left">
        Pólizas Financiadas
      </h2>

      <button
  onClick={agregarPoliza}
  className="mb-4 bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700"
>
  + Póliza Nueva
</button>


      <table className="w-full border table-auto -ml-64">
        <thead className="bg-gray-100 text-left">
         <tr>
  <th>Estado</th>
  <th>Fecha</th>
  <th>Póliza</th>
  <th>Aseguradora</th>
  <th>Placa</th>
  <th>Nombre</th>
  <th>Entidad</th>
  <th>cuotas</th>
  <th>Valor</th>

  <th className="px-3 whitespace-nowrap">Montada</th>
  <th className="px-3 whitespace-nowrap">Recaudada</th>
  <th className="px-3 whitespace-nowrap">Firmada</th>
  <th className="px-3 whitespace-nowrap">Desemb.</th>
  <th className="px-3 whitespace-nowrap">Endoso</th>
  <th className="px-3 whitespace-nowrap">Certif.</th>
  <th className="px-3 whitespace-nowrap">Deleg.</th>

  <th>Delegada a</th>
  <th>Gestor</th>
  <th>Accion</th>
</tr>
        </thead>

       <tbody>
{polizas.map(p => {
const estado = getSemaforo(p);

return (
<tr key={p.id} className="border-b">

{/* ESTADO */}
<td>
  <div className="flex flex-col gap-1 text-xs">

   <span
  className={`inline-block w-4 h-4 rounded-full ${
    estado === "verde"
      ? "bg-green-500"
      : estado === "amarillo"
      ? "bg-yellow-400"
      : "bg-red-500"
  } ${
    p.endoso === "SI" && p.desembolsada && !p.certificacion
      ? "animate-pulse"
      : ""
  }`}
/>

    {p.montada && <span className="text-blue-600">🔵 Montada</span>}
    {p.recaudada && <span className="text-purple-600">🟣 Recaudada</span>}
    {p.firmada && <span className="text-green-600">🟢 Firmada</span>}
    {p.desembolsada && <span className="text-green-700">💰 Desembolsada</span>}

    {p.endoso === "SI" && !p.certificacion && p.desembolsada && (
      <span className="text-orange-500">📄 Certificación pendiente</span>
    )}

    {estado === "verde" && (
      <span className="text-green-700 font-semibold">
        ✔ PROCESO FINALIZADO
      </span>
    )}

  </div>
</td>

{/* FECHA */}
<td>
<input
type="date"
value={p.fecha}
onChange={(e)=>{
setPolizas(polizas.map(pol =>
pol.id === p.id ? {...pol, fecha:e.target.value}:pol
))
}}
className="border rounded px-2 py-1"
/>
</td>

{/* POLIZA */}
<td>
<input
value={p.numeroPoliza}
onChange={(e)=>{
setPolizas(polizas.map(pol =>
pol.id===p.id?{...pol,numeroPoliza:e.target.value}:pol
))
}}
className="border rounded px-2 py-1 w-28"
/>
</td>

{/* ASEGURADORA */}
<td>
<select
value={p.aseguradora}
onChange={(e)=>{
setPolizas(polizas.map(pol =>
pol.id===p.id?{...pol,aseguradora:e.target.value}:pol
))
}}
className="border rounded px-2 py-1"
>
{aseguradorasLista.map(a=>(
<option key={a}>{a}</option>
))}
</select>
</td>

{/* PLACA */}
<td>
<input
value={p.placa}
onChange={(e)=>{
setPolizas(polizas.map(pol =>
pol.id===p.id?{...pol,placa:e.target.value.toUpperCase()}:pol
))
}}
className="border rounded px-2 py-1 w-24"
/>
</td>

{/* NOMBRE */}
<td>
<input
value={p.nombre}
onChange={(e)=>{
setPolizas(polizas.map(pol =>
pol.id===p.id?{...pol,nombre:e.target.value}:pol
))
}}
className="border rounded px-2 py-1 w-32"
/>
</td>

{/* ENTIDAD */}
<td>
<select
value={p.entidad}
onChange={(e)=>{
setPolizas(polizas.map(pol =>
pol.id===p.id?{...pol,entidad:e.target.value}:pol
))
}}
className="border rounded px-2 py-1"
>
{entidadesLista.map(ent=>(
<option key={ent}>{ent}</option>
))}
</select>
</td>

{/* CUOTAS */}
<td>
<select
value={p.cuotas}
onChange={(e)=>{
setPolizas(polizas.map(pol =>
pol.id===p.id?{...pol,cuotas:Number(e.target.value)}:pol
))
}}
className="border rounded px-2 py-1"
>
{[...Array(12)].map((_,i)=>(
<option key={i+1}>{i+1}</option>
))}
</select>
</td>

{/* VALOR */}
<td>
<input
value={p.valor}
onChange={(e)=>{
setPolizas(polizas.map(pol =>
pol.id===p.id?{...pol,valor:e.target.value}:pol
))
}}
className="border rounded px-2 py-1 w-28"
/>
</td>

{/* 🔵 MONTADA */}
<td className="text-center">
<input
type="checkbox"
className="w-5 h-5 accent-blue-600"
checked={p.montada}
onChange={(e)=>{
setPolizas(polizas.map(pol =>
pol.id===p.id?{...pol,montada:e.target.checked}:pol
))
}}
/>
</td>

{/* 🟣 RECAUDADA */}
<td className="text-center">
<input
type="checkbox"
className={`w-5 h-5 accent-purple-600 ${
!p.montada ? "opacity-40 cursor-not-allowed" : ""
}`}
checked={p.recaudada}
disabled={!p.montada}
onChange={(e)=>{
setPolizas(polizas.map(pol =>
pol.id===p.id?{...pol,recaudada:e.target.checked}:pol
))
}}
/>
</td>

{/* FIRMADA */}
<td className="text-center">
<input
type="checkbox"
className={`w-5 h-5 accent-green-600 ${
!p.recaudada ? "opacity-40 cursor-not-allowed" : ""
}`}
checked={p.firmada}
disabled={!p.recaudada}
onChange={(e)=>{
setPolizas(polizas.map(pol =>
pol.id===p.id?{...pol,firmada:e.target.checked}:pol
))
}}
/>
</td>

{/* DESEMBOLSADA */}
<td className="text-center align-middle">
  <input
    type="checkbox"
    className="w-5 h-5 cursor-pointer accent-green-600"
    checked={p.desembolsada}
    disabled={!p.montada || !p.recaudada || !p.firmada}   // 👈 BLOQUEO
    onChange={(e) => {
      const nuevas = polizas.map(pol =>
        pol.id === p.id ? { ...pol, desembolsada: e.target.checked } : pol
      );
      setPolizas(nuevas);
    }}
  />
</td>

{/* ENDOSO */}
<td className="text-center">
<select
value={p.endoso}
onChange={(e)=>{
setPolizas(polizas.map(pol =>
pol.id===p.id?{...pol,endoso:e.target.value}:pol
))
}}
className="border rounded px-1"
>
<option value="">-</option>
<option value="SI">SI</option>
<option value="NO">NO</option>
</select>
</td>

{/* CERTIFICACION */}
<td className="text-center">
{p.endoso==="SI" && (
<input
type="checkbox"
className={`w-5 h-5 accent-green-600 ${
!(p.desembolsada) ? "opacity-40 cursor-not-allowed" : ""
}`}
checked={p.certificacion}
disabled={!p.desembolsada}
onChange={(e)=>{
setPolizas(polizas.map(pol =>
pol.id===p.id?{...pol,certificacion:e.target.checked}:pol
))
}}
/>
)}
</td>

{/* DELEGADA */}
<td className="text-center">
<input
type="checkbox"
className="w-5 h-5 accent-green-600"
checked={p.delegada}
onChange={(e)=>{
setPolizas(polizas.map(pol =>
pol.id===p.id?{...pol,delegada:e.target.checked}:pol
))
}}
/>
</td>

{/* DELEGADA A */}
<td>
<input
value={p.delegadaA||""}
onChange={(e)=>{
setPolizas(polizas.map(pol =>
pol.id===p.id?{...pol,delegadaA:e.target.value}:pol
))
}}
className="border rounded px-2 py-1 w-32"
/>
</td>

{/* GESTOR */}
<td>
<input
value={p.gestor}
onChange={(e)=>{
setPolizas(polizas.map(pol =>
pol.id===p.id?{...pol,gestor:e.target.value}:pol
))
}}
className="border rounded px-2 py-1 w-32"
/>
</td>

{/* ACCION */}
<td>
<button
onClick={()=>{
if(window.confirm("¿Seguro que deseas ANULAR esta póliza?")){
eliminarPoliza(p.id);
}
}}
className="text-red-600 font-bold px-2"
>
X
</button>
</td>

</tr>
);
})}
</tbody>
      </table>
      
    </div>
  );
}