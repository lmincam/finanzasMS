'use strict';
/* =====================================================================
   ESTADO GLOBAL Y REGISTROS
   ---------------------------------------------------------------------
   Estado de la app (S), constantes de negocio y registros donde cada
   módulo da de alta su vista (Views), sus botones (Actions) y sus campos (Changes).
   Depende de: utilidades.js
   ===================================================================== */

const S = {
  cuentas: [], categorias: [], movimientos: [], inmuebles: [], vehiculos: [], deudas: [], snapshots: [],
  valoraciones: [], tablaValoraciones: true,
  // Tablas de la migración v4 (opcionales: si faltan, la app sigue funcionando y avisa)
  seguros: [], amortizaciones: [], amortizaciones_plan: [], aportaciones_periodicas: [], posiciones: [], precios_m2: [], reglas_categoria: [], patrimonio_mensual: [],
  missing: new Set(), v4: true,
  deudaSel: null, invSel: null, deudaVista: { modo: 'plazo', anual: false, conPlan: true },
  ajustes: { nomina_dias: 5, nomina_umbral: 300, extra_umbral: 300, fondo_meses: 6 },
  period: { mode: 'mes', ref: ymOf(todayISO()), from: addMonths(ymOf(todayISO()), -2), to: ymOf(todayISO()) },
  movFilter: { mes: ymOf(todayISO()), cuenta: '', tipo: '', q: '' },
  movLimit: 150,
  tab: 'dashboard', connected: false, loaded: false,
  importCuenta: null, importData: null
};
const TIPO_CUENTA = { corriente: 'Corriente', ahorro: 'Ahorro', efectivo: 'Efectivo', inversion: 'Inversión' };
const SUBTIPO = { liquidez: 'Reajuste de liquidez', ahorro: 'Aportación a ahorro', inversion: 'Aportación a inversión' };
const TIPO_MOV = { gasto: 'Gasto', ingreso: 'Ingreso', transferencia: 'Transferencia interna' };
const VEH_ICON = { coche: '🚗', moto: '🏍️', autocaravana: '🚐', otro: '🚙' };
const TIPO_DEUDA = { hipoteca: 'Hipoteca', prestamo_personal: 'Préstamo personal', prestamo_vehiculo: 'Préstamo vehículo', otro: 'Otro' };
const TIPO_SEGURO = { vehiculo: '🚗 Vehículo', hogar: '🏠 Hogar', salud: '🩺 Salud', vida: '❤️ Vida', mascota: '🐾 Mascota', decesos: '🕯️ Decesos',
  responsabilidad_civil: '⚖️ Responsabilidad civil', accidentes: '🩹 Accidentes', viaje: '✈️ Viaje', otro: '📄 Otro' };
const FREQ_PAGO = { anual: 1, semestral: 2, trimestral: 4, mensual: 12 };
const TIPO_ACTIVO = { fondo: 'Fondo de inversión', etf: 'ETF', accion: 'Acción', bono: 'Bono / Letra', plan_pensiones: 'Plan de pensiones', monetario: 'Fondo monetario', cripto: 'Cripto', liquidez: 'Liquidez', otro: 'Otro' };
const CLASE_ACTIVO = { renta_variable: 'Renta variable', renta_fija: 'Renta fija', monetario: 'Monetario', liquidez: 'Liquidez', inmobiliario: 'Inmobiliario', materias_primas: 'Materias primas / oro', cripto: 'Cripto', otro: 'Otro' };
const PALETTE = ['#1e3a8a', '#0891b2', '#16a34a', '#ca8a04', '#dc2626', '#7c3aed', '#db2777', '#ea580c', '#0d9488', '#64748b'];
const TABS = [
  ['dashboard', '📊 Dashboard'], ['cuentas', '💳 Cuentas y movimientos'], ['patrimonio', '🏠 Inmuebles y vehículos'],
  ['inversiones', '📈 Inversiones'], ['deudas', '🏦 Deudas'], ['seguros', '🛡️ Seguros'], ['auditoria', '📸 Auditoría trimestral'], ['categorias', '🏷️ Categorías y presupuestos'], ['ajustes', '⚙️ Ajustes']
];

/* ---------- Registros de módulos ----------
   Views:   pestaña → función que la pinta          (Views.deudas = renderDeudas)
   Actions: data-action del botón → manejador        (Object.assign(Actions, {...}))
   Changes: id del campo → manejador del evento change
   Inputs:  id del campo → manejador del evento input (con debounce)
   ChangeFilters: funciones que pueden capturar un change por atributo (devuelven true si lo gestionan) */
const Views = {};
const Actions = {};
const Changes = {};
const Inputs = {};
const ChangeFilters = [];
/** Tareas que se ejecutan tras cada carga completa de datos (p. ej. generar aportaciones periódicas). */
const AfterLoad = [];
