import React, { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';
import AlumnoInscripcion from './AlumnoInscripcion';

const ADMIN_KEY_STORAGE = 'sanmateo-admin-key';
const API_BASE = import.meta.env.VITE_API_URL || '';
const fechaLocalISO = () => {
  const fecha = new Date();
  return `${fecha.getFullYear()}-${String(fecha.getMonth() + 1).padStart(2, '0')}-${String(fecha.getDate()).padStart(2, '0')}`;
};

function adminFetch(url, options = {}) {
  return fetch(url, {
    ...options,
    headers: {
      ...(options.headers || {}),
      'x-admin-key': sessionStorage.getItem(ADMIN_KEY_STORAGE) || ''
    }
  });
}

const PLAN_MATERIAS = [
  { anio_carrera: 'PRIMER AÑO', materia: 'Estado Sociedad y Cultura' },
  { anio_carrera: 'PRIMER AÑO', materia: 'Física y Matemática' },
  { anio_carrera: 'PRIMER AÑO', materia: 'Anatomía, Histología y Fisiología' },
  { anio_carrera: 'PRIMER AÑO', materia: 'Química Gral., Orgánica e Inorg.' },
  { anio_carrera: 'PRIMER AÑO', materia: 'Fundamentos Básicos de Labor.' },
  { anio_carrera: 'PRIMER AÑO', materia: 'Actitud y Ética Profesional' },
  { anio_carrera: 'PRIMER AÑO', materia: 'Bioquímica Clínica' },
  { anio_carrera: 'PRIMER AÑO', materia: 'Práctica de Bioquímica Clínica I' },
  { anio_carrera: 'PRIMER AÑO', materia: 'Hematología y Hemoterapia' },
  { anio_carrera: 'PRIMER AÑO', materia: 'Higiene y Seguridad en el Trabaj.' },
  { anio_carrera: 'SEGUNDO AÑO', materia: 'Comunicación y TIC' },
  { anio_carrera: 'SEGUNDO AÑO', materia: 'Primeros Auxilios' },
  { anio_carrera: 'SEGUNDO AÑO', materia: 'Bacteriología y Prep. De Mater.' },
  { anio_carrera: 'SEGUNDO AÑO', materia: 'Organización y Gestión de las I.S.' },
  { anio_carrera: 'SEGUNDO AÑO', materia: 'Inmunología' },
  { anio_carrera: 'SEGUNDO AÑO', materia: 'Biología y Genética' },
  { anio_carrera: 'SEGUNDO AÑO', materia: 'Procedimientos Específicos' },
  { anio_carrera: 'SEGUNDO AÑO', materia: 'Inglés Técnico' }
];

const crearNotasVacias = materias => materias.map(m => ({
  ...m, nota_num: '', nota_letras: '', libro_acta: '', folio_acta: '', fecha_examen: '', condicion: ''
}));

const gruposDeAnio = [
  { id: 1, titulo: 'Materias de 1er año' },
  { id: 2, titulo: 'Materias de 2do año' },
  { id: 3, titulo: 'Materias de 3er año' }
];

const clasificarAnio = anio => {
  const texto = String(anio || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().trim();
  if (texto.includes('PRIMER') || /^1(?:ER|RO|O|°|º)?(?:\s|$)/.test(texto)) return 1;
  if (texto.includes('SEGUNDO') || /^2(?:DO|DA|°|º)?(?:\s|$)/.test(texto)) return 2;
  if (texto.includes('TERCER') || texto.includes('TERCERO') || /^3(?:ER|RO|°|º)?(?:\s|$)/.test(texto)) return 3;
  return null;
};

const OFERTA_INSCRIPCION = [
  'Comunicación y TIC',
  'Primeros Auxilios',
  'Bacteriología y Prep. De Mater.',
  'Organización y Gestión de las I.S.',
  'Inmunología',
  'Biología y Genética',
  'Procedimientos Específicos',
  'Inglés Técnico'
];

function GestionAcademica({ onCerrarSesion }) {
  const [panelActivo, setPanelActivo] = useState('inscripcion'); // 'inscripcion' | 'inscriptos' | 'matriz'


  // ================= ESTADOS: INSCRIPCIÓN ALUMNOS =================
  const [dniInscripcion, setDniInscripcion] = useState('');
  const [datosAlumno, setDatosAlumno] = useState(null);
  const [errorInscripcion, setErrorInscripcion] = useState('');
  const [exitoInscripcion, setExitoInscripcion] = useState('');
  const [materiasElegidas, setMateriasElegidas] = useState([]);
  const [cargandoInscripcion, setCargandoInscripcion] = useState(false);

  // ================= ESTADOS: SECRETARÍA - PADRÓN =================
  const [listaInscriptos, setListaInscriptos] = useState([]);
  const [filtroMateria, setFiltroMateria] = useState('TODAS');
  const [ofertasAcademicas, setOfertasAcademicas] = useState([]);
  const [errorOferta, setErrorOferta] = useState('');
  const [guardandoOferta, setGuardandoOferta] = useState(false);
  const [formOferta, setFormOferta] = useState({
    tipo: 'CURSO', materia: '', anio_carrera: '', fecha_inicio: '', fecha_fin: '', fecha_examen: '', horario: ''
  });
  const [materiasCatalogo, setMateriasCatalogo] = useState([]);
  const [formMateria, setFormMateria] = useState({ materia: '', anio_carrera: 'PRIMER AÑO' });
  const [materiaEditando, setMateriaEditando] = useState(null);
  const [errorCatalogo, setErrorCatalogo] = useState('');
  const [guardandoMateria, setGuardandoMateria] = useState(false);
  const [periodoPagos, setPeriodoPagos] = useState(() => fechaLocalISO().slice(0, 7));
  const [pagosCuotas, setPagosCuotas] = useState([]);
  const [errorPago, setErrorPago] = useState('');
  const [mensajePago, setMensajePago] = useState('');
  const [guardandoPago, setGuardandoPago] = useState(false);
  const [inicioControlCuotas, setInicioControlCuotas] = useState('');
  const [periodoTarifa, setPeriodoTarifa] = useState(() => fechaLocalISO().slice(0, 7));
  const [importeTarifa, setImporteTarifa] = useState('');
  const [periodosCuota, setPeriodosCuota] = useState([]);
  const [guardandoConfiguracionCuotas, setGuardandoConfiguracionCuotas] = useState(false);
  const [formPago, setFormPago] = useState(() => ({
    dni: '', periodo: fechaLocalISO().slice(0, 7), importe: '', medio: 'EFECTIVO',
    fecha_pago: fechaLocalISO(), referencia: '', observaciones: ''
  }));

  // ================= ESTADOS: SECRETARÍA - LIBRO MATRIZ =================
  const [subTabMatriz, setSubTabMatriz] = useState('buscar'); // 'buscar' | 'cargar' | 'listado'
  const [alumnosMatriz, setAlumnosMatriz] = useState([]);
  const [paginaAlumnosMatriz, setPaginaAlumnosMatriz] = useState(1);
  const [totalAlumnosMatriz, setTotalAlumnosMatriz] = useState(0);
  const [cargandoAlumnosMatriz, setCargandoAlumnosMatriz] = useState(false);
  const alumnosMatrizPorPagina = 50;
  const [dniBusquedaMatriz, setDniBusquedaMatriz] = useState('');
  const [alumnoMatriz, setAlumnoMatriz] = useState(null);
  const [errorMatriz, setErrorMatriz] = useState('');
  const [cargandoCuota, setCargandoCuota] = useState(false);
  const [accionAlumnoDni, setAccionAlumnoDni] = useState(null);

  // Estado con TODOS los datos combinados
  const [formMatriz, setFormMatriz] = useState({
    dni: '',
    alumno: '',
    domicilio: '',
    genero: 'Mujer',
    fecha_nacimiento: '',
    edad: '',
    carrera: 'Tecnicatura Superior en Laboratorio de Análisis Clínicos',
    turno: 'Mañana',
    anio_cursado: '1er Año',
    nacido_en: '',
    el_dia: '',
    ingreso_con_certificado: '',
    expedido_por: '',
    plan_estudios: '',
    cuota_al_dia: 1
  });

  const [materiasMatriz, setMateriasMatriz] = useState(() => crearNotasVacias(PLAN_MATERIAS));
  const [modoEdicion, setModoEdicion] = useState(false);

  useEffect(() => {
    if (panelActivo === 'inscriptos') {
      cargarInscriptos();
    }
    if (panelActivo === 'ofertas') cargarOfertasAcademicas();
    if (panelActivo === 'materias' || panelActivo === 'matriz') cargarMateriasCatalogo();
    if (panelActivo === 'cuotas') {
      cargarPagosCuotas();
      cargarConfiguracionCuotas();
    }
  }, [panelActivo, periodoPagos]);

  const cargarInscriptos = async () => {
    try {
      const res = await adminFetch(`${API_BASE}/api/secretaria/inscriptos`);
      const data = await res.json();
      setListaInscriptos(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error('Error al cargar lista:', err);
      setListaInscriptos([]);
    }
  };

  const cargarAlumnosMatriz = async (pagina = paginaAlumnosMatriz) => {
    setCargandoAlumnosMatriz(true);
    try {
      const res = await adminFetch(`${API_BASE}/api/secretaria/alumnos?pagina=${pagina}&porPagina=${alumnosMatrizPorPagina}`);
      if (!res.ok) throw new Error('No se pudo cargar el padrón del Libro Matriz');
      const data = await res.json();
      setAlumnosMatriz(data.alumnos || []);
      setPaginaAlumnosMatriz(data.pagina || pagina);
      setTotalAlumnosMatriz(data.total || 0);
    } catch (err) {
      console.error('Error al cargar alumnos del Libro Matriz:', err);
      setAlumnosMatriz([]);
    } finally {
      setCargandoAlumnosMatriz(false);
    }
  };

  const cargarOfertasAcademicas = async () => {
    try {
      const res = await adminFetch(`${API_BASE}/api/secretaria/ofertas`);
      if (!res.ok) throw new Error('No se pudo cargar cursos y mesas');
      setOfertasAcademicas(await res.json());
      setErrorOferta('');
    } catch (err) {
      setErrorOferta(err.message);
    }
  };

  const cargarMateriasCatalogo = async () => {
    try {
      const res = await adminFetch(`${API_BASE}/api/secretaria/materias`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo cargar el catálogo');
      setMateriasCatalogo(data);
      setErrorCatalogo('');
      return data;
    } catch (err) {
      setMateriasCatalogo([]);
      setErrorCatalogo(err.message);
      return null;
    }
  };

  const cargarPagosCuotas = async () => {
    try {
      const res = await adminFetch(`${API_BASE}/api/secretaria/pagos-cuotas?periodo=${encodeURIComponent(periodoPagos)}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo cargar el registro de pagos');
      setPagosCuotas(data);
      setErrorPago('');
    } catch (err) {
      setErrorPago(err.message);
      setPagosCuotas([]);
    }
  };

  const cargarConfiguracionCuotas = async () => {
    try {
      const res = await adminFetch(`${API_BASE}/api/secretaria/cuotas/configuracion`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo cargar la configuración');
      setInicioControlCuotas(data.periodoInicio || '');
      setPeriodosCuota(data.periodos || []);
    } catch (err) {
      setErrorPago(err.message);
    }
  };

  const guardarInicioControlCuotas = async (event) => {
    event.preventDefault();
    setErrorPago('');
    setMensajePago('');
    setGuardandoConfiguracionCuotas(true);
    try {
      const res = await adminFetch(`${API_BASE}/api/secretaria/cuotas/configuracion/inicio`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ periodoInicio: inicioControlCuotas })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar el mes inicial');
      await cargarConfiguracionCuotas();
      setMensajePago('Configuración guardada. Se recalculó el estado de cuotas del padrón.');
    } catch (err) {
      setErrorPago(err.message);
    } finally {
      setGuardandoConfiguracionCuotas(false);
    }
  };

  const guardarImporteCuota = async (event) => {
    event.preventDefault();
    setErrorPago('');
    setMensajePago('');
    setGuardandoConfiguracionCuotas(true);
    try {
      const res = await adminFetch(`${API_BASE}/api/secretaria/cuotas/periodos/${encodeURIComponent(periodoTarifa)}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ importe: importeTarifa })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar el importe');
      setImporteTarifa('');
      await cargarConfiguracionCuotas();
      setMensajePago('Importe mensual guardado. Se recalculó el estado de cuotas del padrón.');
    } catch (err) {
      setErrorPago(err.message);
    } finally {
      setGuardandoConfiguracionCuotas(false);
    }
  };

  const registrarPagoCuota = async (event) => {
    event.preventDefault();
    setErrorPago('');
    setMensajePago('');
    setGuardandoPago(true);
    try {
      const res = await adminFetch(`${API_BASE}/api/secretaria/pagos-cuotas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formPago)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo registrar el pago');
      setFormPago({ ...formPago, dni: '', importe: '', referencia: '', observaciones: '' });
      setMensajePago(data.cuota_al_dia === 1
        ? 'Pago registrado. El alumno quedó al día.'
        : data.cuota_al_dia === 0
          ? 'Pago registrado. El alumno todavía tiene meses pendientes o falta configurar un importe mensual.'
          : 'Pago registrado. Configura el mes inicial y los importes para activar el cálculo automático.');
      await cargarPagosCuotas();
    } catch (err) {
      setErrorPago(err.message);
    } finally {
      setGuardandoPago(false);
    }
  };

  const descargarPagosCuotas = () => {
    const filas = pagosCuotas.map(pago => ({
      Período: pago.periodo,
      DNI: pago.dni,
      Alumno: pago.alumno,
      Importe: Number(pago.importe),
      Medio: pago.medio,
      Fecha: pago.fecha_pago ? String(pago.fecha_pago).slice(0, 10) : '',
      Referencia: pago.referencia || '',
      Observaciones: pago.observaciones || ''
    }));
    const hoja = XLSX.utils.json_to_sheet(filas);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, 'Pagos de cuotas');
    XLSX.writeFile(libro, `pagos-cuotas-${periodoPagos}.xlsx`);
  };

  const agregarMateriaCatalogo = async (event) => {
    event.preventDefault();
    setErrorCatalogo('');
    setGuardandoMateria(true);
    try {
      const res = await adminFetch(`${API_BASE}/api/secretaria/materias`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formMateria)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo agregar la materia');
      setFormMateria({ materia: '', anio_carrera: formMateria.anio_carrera });
      await cargarMateriasCatalogo();
    } catch (err) {
      setErrorCatalogo(err.message);
    } finally {
      setGuardandoMateria(false);
    }
  };

  const guardarMateriaEditada = async (event) => {
    event.preventDefault();
    if (!materiaEditando) return;
    setErrorCatalogo('');
    setGuardandoMateria(true);
    try {
      const res = await adminFetch(`${API_BASE}/api/secretaria/materias/${materiaEditando.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ materia: materiaEditando.materia, anio_carrera: materiaEditando.anio_carrera })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo actualizar la materia');
      setMateriaEditando(null);
      await cargarMateriasCatalogo();
    } catch (err) {
      setErrorCatalogo(err.message);
    } finally {
      setGuardandoMateria(false);
    }
  };

  const eliminarMateriaCatalogo = async (materia) => {
    if (!window.confirm(`¿Quitar “${materia.materia}” del catálogo? Las calificaciones ya registradas se conservarán.`)) return;
    setErrorCatalogo('');
    try {
      const res = await adminFetch(`${API_BASE}/api/secretaria/materias/${materia.id}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo eliminar la materia');
      setMateriaEditando(null);
      await cargarMateriasCatalogo();
    } catch (err) {
      setErrorCatalogo(err.message);
    }
  };

  const guardarOfertaAcademica = async (event) => {
    event.preventDefault();
    setErrorOferta('');
    setGuardandoOferta(true);
    try {
      const res = await adminFetch(`${API_BASE}/api/secretaria/ofertas`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formOferta)
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo guardar la oferta');
      setFormOferta({ tipo: formOferta.tipo, materia: '', anio_carrera: '', fecha_inicio: '', fecha_fin: '', fecha_examen: '', horario: '' });
      await cargarOfertasAcademicas();
    } catch (err) {
      setErrorOferta(err.message);
    } finally {
      setGuardandoOferta(false);
    }
  };

  const cambiarEstadoOferta = async (oferta) => {
    try {
      const res = await adminFetch(`${API_BASE}/api/secretaria/ofertas/${oferta.id}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ activa: !oferta.activa })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo cambiar el estado');
      await cargarOfertasAcademicas();
    } catch (err) {
      setErrorOferta(err.message);
    }
  };

  // ----- ACCIONES: FORMULARIO INSCRIPCIÓN -----
  const handleConsultarAlumno = async (e) => {
    e.preventDefault();
    setErrorInscripcion('');
    setExitoInscripcion('');
    setDatosAlumno(null);
    setMateriasElegidas([]);
    setCargandoInscripcion(true);

    try {
      const res = await fetch(`${API_BASE}/api/inscripcion/validar/${dniInscripcion.trim()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo consultar el padrón');
      setDatosAlumno(data);
    } catch (err) {
      setErrorInscripcion(err.message);
    } finally {
      setCargandoInscripcion(false);
    }
  };

  const verificarHabilitacion = (materia) => {
    if (!datosAlumno) return { habilitada: false, motivo: '' };
    if (datosAlumno.materiasInscriptas.includes(materia)) {
      return { habilitada: false, motivo: 'Ya inscripto' };
    }
    if (datosAlumno.materiasAprobadas.includes(materia.toLowerCase())) {
      return { habilitada: false, motivo: 'Aprobada' };
    }
    const correlativasRequeridas = (datosAlumno.reglasCorrelativas || [])
      .filter(r => r.materia_objetivo.toLowerCase() === materia.toLowerCase())
      .map(r => r.materia_requerida);

    for (const req of correlativasRequeridas) {
      if (!datosAlumno.materiasAprobadas.includes(req.toLowerCase())) {
        return { habilitada: false, motivo: `Falta correlativa: ${req}` };
      }
    }
    return { habilitada: true, motivo: 'Habilitada' };
  };

  const handleToggleMateria = (materia) => {
    setMateriasElegidas(prev =>
      prev.includes(materia) ? prev.filter(m => m !== materia) : [...prev, materia]
    );
  };

  const handleConfirmarInscripcion = async () => {
    try {
      const res = await fetch(`${API_BASE}/api/inscripcion/confirmar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dni: datosAlumno.alumno.dni,
          materiasSeleccionadas: materiasElegidas
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setExitoInscripcion('¡Inscripción confirmada con éxito!');
      setDatosAlumno({
        ...datosAlumno,
        materiasInscriptas: [...datosAlumno.materiasInscriptas, ...materiasElegidas]
      });
      setMateriasElegidas([]);
    } catch (err) {
      alert(err.message);
    }
  };

  // ----- CÁLCULO DE EDAD AUTOMÁTICO -----
  const handleFechaNacChange = (fecha) => {
    let nuevaEdad = '';
    if (fecha) {
      const hoy = new Date();
      const cumple = new Date(fecha);
      let edadCalc = hoy.getFullYear() - cumple.getFullYear();
      const m = hoy.getMonth() - cumple.getMonth();
      if (m < 0 || (m === 0 && hoy.getDate() < cumple.getDate())) {
        edadCalc--;
      }
      nuevaEdad = edadCalc >= 0 ? edadCalc : '';
    }
    setFormMatriz(prev => ({
      ...prev,
      fecha_nacimiento: fecha,
      el_dia: fecha, // Mantenemos sincronizado con el_dia del acta original
      edad: nuevaEdad
    }));
  };

  // ----- ACCIONES: LIBRO MATRIZ & CUOTAS -----
  const handleBuscarMatriz = async (e) => {
    if (e) e.preventDefault();
    setErrorMatriz('');
    setAlumnoMatriz(null);
    try {
      const res = await adminFetch(`${API_BASE}/api/alumnos/${dniBusquedaMatriz.trim()}`);
      if (!res.ok) throw new Error('Alumno no encontrado');
      const data = await res.json();
      setAlumnoMatriz(data);
    } catch (err) {
      setErrorMatriz(err.message);
    }
  };

  const handleToggleCuota = async () => {
    if (!alumnoMatriz) return;
    const nuevoEstado = !alumnoMatriz.cuota_al_dia;
    setCargandoCuota(true);
    try {
      const res = await adminFetch(`${API_BASE}/api/alumnos/${alumnoMatriz.dni}/cuota`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cuota_al_dia: nuevoEstado })
      });
      if (!res.ok) throw new Error('Error al actualizar cuota');
      setAlumnoMatriz({ ...alumnoMatriz, cuota_al_dia: nuevoEstado ? 1 : 0 });
    } catch (err) {
      alert(err.message);
    } finally {
      setCargandoCuota(false);
    }
  };

  const prepararEdicionMatriz = (ficha) => {
    const fNac = ficha.fecha_nacimiento ? ficha.fecha_nacimiento.substring(0, 10) : (ficha.el_dia ? ficha.el_dia.substring(0, 10) : '');
    const planActual = materiasCatalogo.length ? materiasCatalogo : PLAN_MATERIAS;
    
    setFormMatriz({
      dni: ficha.dni || '',
      alumno: ficha.alumno || '',
      domicilio: ficha.domicilio || '',
      genero: ficha.genero || 'Mujer',
      fecha_nacimiento: fNac,
      edad: ficha.edad || '',
      carrera: ficha.carrera || 'Tecnicatura Superior en Laboratorio de Análisis Clínicos',
      turno: ficha.turno || 'Mañana',
      anio_cursado: ficha.anio_cursado || '1er Año',
      nacido_en: ficha.nacido_en || '',
      el_dia: fNac,
      ingreso_con_certificado: ficha.ingreso_con_certificado || '',
      expedido_por: ficha.expedido_por || '',
      plan_estudios: ficha.plan_estudios || '',
      cuota_al_dia: ficha.cuota_al_dia ?? 1
    });

    const materiasExistentes = ficha.materias || [];
    const cargadas = planActual.map(p => {
      const encontrada = (ficha.materias || []).find(
        m => m.materia.toLowerCase().trim() === p.materia.toLowerCase().trim()
      );
      return encontrada ? {
        ...p,
        nota_num: encontrada.nota_num ?? '',
        nota_letras: encontrada.nota_letras || '',
        libro_acta: encontrada.libro_acta || '',
        folio_acta: encontrada.folio_acta || '',
        fecha_examen: encontrada.fecha_examen ? encontrada.fecha_examen.substring(0, 10) : '',
        condicion: encontrada.condicion || ''
      } : { ...p, nota_num: '', nota_letras: '', libro_acta: '', folio_acta: '', fecha_examen: '', condicion: '' };
    });
    const materiasFueraDelPlan = materiasExistentes
      .filter(m => !planActual.some(p => p.materia.trim().toLowerCase() === String(m.materia || '').trim().toLowerCase()))
      .map(m => ({
        anio_carrera: m.anio_carrera || '',
        materia: m.materia || '',
        nota_num: m.nota_num ?? '',
        nota_letras: m.nota_letras || '',
        libro_acta: m.libro_acta || '',
        folio_acta: m.folio_acta || '',
        fecha_examen: m.fecha_examen ? m.fecha_examen.substring(0, 10) : '',
        condicion: m.condicion || ''
      }));

    setMateriasMatriz([...cargadas, ...materiasFueraDelPlan]);
    setModoEdicion(true);
    setSubTabMatriz('cargar');
  };

  const handleIniciarEdicion = () => {
    if (alumnoMatriz) prepararEdicionMatriz(alumnoMatriz);
  };

  const handleEditarDesdeListado = async (dni) => {
    setErrorMatriz('');
    setAccionAlumnoDni(dni);
    try {
      const res = await adminFetch(`${API_BASE}/api/alumnos/${dni}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || data.message || 'No se pudo abrir la ficha');
      setAlumnoMatriz(data);
      setDniBusquedaMatriz(dni);
      prepararEdicionMatriz(data);
    } catch (err) {
      setErrorMatriz(err.message);
    } finally {
      setAccionAlumnoDni(null);
    }
  };

  const handleCambiarEstadoAlumno = async (alumno) => {
    const dadoDeBaja = !alumno.dado_de_baja;
    setErrorMatriz('');
    setAccionAlumnoDni(alumno.dni);
    try {
      const res = await adminFetch(`${API_BASE}/api/secretaria/alumnos/${alumno.dni}/estado`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dadoDeBaja })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo actualizar el estado');
      await cargarAlumnosMatriz();
      if (alumnoMatriz?.dni === alumno.dni) {
        setAlumnoMatriz({ ...alumnoMatriz, dado_de_baja: dadoDeBaja ? 1 : 0 });
      }
    } catch (err) {
      setErrorMatriz(err.message);
    } finally {
      setAccionAlumnoDni(null);
    }
  };

  const handleEliminarAlumno = async (alumno) => {
    const confirmado = window.confirm(
      `¿Eliminar definitivamente a ${alumno.alumno} (DNI ${alumno.dni}) y sus calificaciones e inscripciones? Esta acción no se puede deshacer.`
    );
    if (!confirmado) return;

    setErrorMatriz('');
    setAccionAlumnoDni(alumno.dni);
    try {
      const res = await adminFetch(`${API_BASE}/api/secretaria/alumnos/${alumno.dni}`, { method: 'DELETE' });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo eliminar el alumno');
      await cargarAlumnosMatriz();
      if (alumnoMatriz?.dni === alumno.dni) setAlumnoMatriz(null);
    } catch (err) {
      setErrorMatriz(err.message);
    } finally {
      setAccionAlumnoDni(null);
    }
  };

  const handleGuardarMatriz = async (e) => {
    e.preventDefault();
    try {
      const res = await adminFetch(`${API_BASE}/api/alumnos`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formMatriz, materias: materiasMatriz })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Error al guardar ficha');
      alert(data.message || (modoEdicion ? '¡Ficha actualizada con éxito!' : '¡Ficha guardada con éxito!'));
      setSubTabMatriz('buscar');
      setModoEdicion(false);
      setDniBusquedaMatriz(formMatriz.dni);
      handleBuscarMatriz();
    } catch (err) {
      alert(err.message);
    }
  };

  const materiasUnicasInscriptos = ['TODAS', ...new Set((listaInscriptos || []).map(i => i.materia))];
  const inscriptosFiltrados = filtroMateria === 'TODAS'
    ? (listaInscriptos || [])
    : (listaInscriptos || []).filter(i => i.materia === filtroMateria);
  const materiasEnOtrosAnios = materiasCatalogo.filter(materia => !clasificarAnio(materia.anio_carrera));

  const renderFilaMateria = materia => (
    <tr key={materia.id}>
      {materiaEditando?.id === materia.id ? <>
        <td><input required maxLength="255" value={materiaEditando.materia} onChange={e => setMateriaEditando({ ...materiaEditando, materia: e.target.value })} style={{ width: '95%', padding: 7 }} /></td>
        <td><input required maxLength="100" value={materiaEditando.anio_carrera} onChange={e => setMateriaEditando({ ...materiaEditando, anio_carrera: e.target.value })} style={{ width: '95%', padding: 7 }} /></td>
        <td style={{ whiteSpace: 'nowrap' }}>
          <button type="button" onClick={guardarMateriaEditada} disabled={guardandoMateria} style={{ marginRight: 6, padding: '6px 9px', cursor: 'pointer' }}>Guardar</button>
          <button type="button" onClick={() => setMateriaEditando(null)} style={{ padding: '6px 9px', cursor: 'pointer' }}>Cancelar</button>
        </td>
      </> : <>
        <td>{materia.materia}</td>
        <td>{materia.anio_carrera}</td>
        <td style={{ whiteSpace: 'nowrap' }}>
          <button type="button" onClick={() => setMateriaEditando({ ...materia })} style={{ marginRight: 6, padding: '6px 9px', cursor: 'pointer' }}>Editar</button>
          <button type="button" onClick={() => eliminarMateriaCatalogo(materia)} style={{ padding: '6px 9px', color: '#fff', background: '#b91c1c', border: 0, borderRadius: 4, cursor: 'pointer' }}>Borrar</button>
        </td>
      </>}
    </tr>
  );

  const descargarExcelInscriptos = () => {
    const filas = inscriptosFiltrados.map(item => ({
      Tipo: item.tipo === 'MESA_EXAMEN' ? 'Mesa de examen' : 'Curso',
      Materia: item.materia,
      DNI: item.dni,
      Alumno: item.alumno,
      Fecha: item.fecha_inscripcion
        ? new Date(item.fecha_inscripcion).toLocaleDateString()
        : ''
    }));
    const hoja = XLSX.utils.json_to_sheet(filas, {
      header: ['Tipo', 'Materia', 'DNI', 'Alumno', 'Fecha']
    });
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, 'Inscriptos');
    XLSX.writeFile(libro, 'alumnos-inscriptos.xlsx');
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #163654 0%, #204c73 50%, #46769b 100%)',
      fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      color: '#1e293b',
      paddingBottom: '40px'
    }}>
      {/* BARRA SUPERIOR INSTITUCIONAL */}
      <header style={{
        background: '#0f263c',
        borderBottom: '3px solid #a8c5da',
        padding: '12px 25px',
        display: 'flex',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        alignItems: 'center',
        boxShadow: '0 4px 15px rgba(0,0,0,0.25)'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, width: '100%', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
            <div style={{
            width: '46px',
            height: '46px',
            borderRadius: '50%',
            background: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
            overflow: 'hidden',
            border: '2px solid #a8c5da',
            flexShrink: 0
            }}>
            <img
              src="/logo.png"
              alt="Logo IFTS San Mateo"
              onError={(e) => {
                e.target.style.display = 'none';
                if (e.target.nextSibling) e.target.nextSibling.style.display = 'block';
              }}
              style={{ width: '100%', height: '100%', objectFit: 'contain' }}
            />
            <span style={{ display: 'none', color: '#163654', fontWeight: 'bold' }}>SM</span>
            </div>
            <div>
              <div style={{ color: '#cbdfe9', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '1px' }}>
                IFTS San Mateo • Catamarca
              </div>
              <div style={{ color: '#ffffff', fontSize: '18px', fontWeight: 'bold' }}>
                Gestión Académica
              </div>
            </div>
          </div>
          <button type="button" onClick={onCerrarSesion} style={{ padding: '8px 12px', borderRadius: 6, border: 0, cursor: 'pointer', whiteSpace: 'nowrap' }}>Cerrar sesión</button>
        </div>

        {/* SELECTOR DE PANELES */}
        <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '10px', marginTop: '12px', width: '100%' }}>
          <button
            onClick={() => setPanelActivo('inscripcion')}
            style={{
              padding: '9px 18px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '14px',
              background: panelActivo === 'inscripcion' ? '#ffffff' : 'rgba(255,255,255,0.15)',
              color: panelActivo === 'inscripcion' ? '#163654' : '#e2edf3',
              boxShadow: panelActivo === 'inscripcion' ? '0 2px 8px rgba(0,0,0,0.2)' : 'none',
              transition: 'all 0.2s'
            }}>
            🎓 Formulario Alumno
          </button>

          <button
            onClick={() => setPanelActivo('inscriptos')}
            style={{
              padding: '9px 18px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '14px',
              background: panelActivo === 'inscriptos' ? '#ffffff' : 'rgba(255,255,255,0.15)',
              color: panelActivo === 'inscriptos' ? '#163654' : '#e2edf3',
              boxShadow: panelActivo === 'inscriptos' ? '0 2px 8px rgba(0,0,0,0.2)' : 'none',
              transition: 'all 0.2s'
            }}>
            📋 Alumnos Inscriptos
          </button>

          <button
            onClick={() => setPanelActivo('matriz')}
            style={{
              padding: '9px 18px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '14px',
              background: panelActivo === 'matriz' ? '#ffffff' : 'rgba(255,255,255,0.15)',
              color: panelActivo === 'matriz' ? '#163654' : '#e2edf3',
              boxShadow: panelActivo === 'matriz' ? '0 2px 8px rgba(0,0,0,0.2)' : 'none',
              transition: 'all 0.2s'
            }}>
            📖 Libro Matriz y Cuotas
          </button>

          <button
            onClick={() => setPanelActivo('ofertas')}
            style={{
              padding: '9px 18px', borderRadius: '8px', border: 'none', cursor: 'pointer',
              fontWeight: '600', fontSize: '14px',
              background: panelActivo === 'ofertas' ? '#ffffff' : 'rgba(255,255,255,0.15)',
              color: panelActivo === 'ofertas' ? '#163654' : '#e2edf3'
            }}>
            📚 Cursos y mesas
          </button>

          <button
            onClick={() => setPanelActivo('materias')}
            style={{
              padding: '9px 18px', borderRadius: '8px', border: 'none', cursor: 'pointer',
              fontWeight: '600', fontSize: '14px',
              background: panelActivo === 'materias' ? '#ffffff' : 'rgba(255,255,255,0.15)',
              color: panelActivo === 'materias' ? '#163654' : '#e2edf3'
            }}>
            📘 Materias
          </button>

          <button
            onClick={() => setPanelActivo('cuotas')}
            style={{
              padding: '9px 18px', borderRadius: '8px', border: 'none', cursor: 'pointer',
              fontWeight: '600', fontSize: '14px',
              background: panelActivo === 'cuotas' ? '#ffffff' : 'rgba(255,255,255,0.15)',
              color: panelActivo === 'cuotas' ? '#163654' : '#e2edf3'
            }}>
            💵 Pagos de cuotas
          </button>
        </div>
      </header>

      {/* CONTENEDOR PRINCIPAL */}
      <main style={{ maxWidth: '980px', margin: '35px auto 0 auto', padding: '0 15px' }}>

        {/* ========================================================= */}
        {/* PANEL 1: INSCRIPCIÓN (FORMULARIO ALUMNO)                 */}
        {/* ========================================================= */}
        {panelActivo === 'inscripcion' && (
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            boxShadow: '0 20px 40px rgba(15, 34, 53, 0.3)',
            overflow: 'hidden',
            border: '1px solid rgba(255, 255, 255, 0.6)'
          }}>
            <div style={{
              background: 'linear-gradient(180deg, #163654 0%, #204c73 100%)',
              color: '#ffffff',
              padding: '24px 20px',
              textAlign: 'center',
              borderBottom: '3px solid #a8c5da'
            }}>
              <h2 style={{ margin: '0 0 5px 0', fontSize: '22px' }}>
                Inscripción a Cursada de Asignaturas
              </h2>
              <p style={{ margin: 0, fontSize: '13px', color: '#cbdfe9' }}>
                Ingrese su D.N.I. para validar estado administrativo y correlatividades
              </p>
            </div>

            <div style={{ padding: '30px 25px' }}>
              <form onSubmit={handleConsultarAlumno} style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '20px' }}>
                <input
                  type="text"
                  placeholder="D.N.I. (sin puntos)..."
                  value={dniInscripcion}
                  onChange={e => setDniInscripcion(e.target.value)}
                  required
                  style={{
                    padding: '12px 16px',
                    width: '260px',
                    fontSize: '15px',
                    border: '2px solid #cbd5e1',
                    borderRadius: '8px',
                    backgroundColor: '#ffffff',
                    color: '#1e293b',
                    outline: 'none'
                  }}
                />
                <button
                  type="submit"
                  disabled={cargandoInscripcion}
                  style={{
                    padding: '12px 24px',
                    background: 'linear-gradient(180deg, #204c73 0%, #163654 100%)',
                    color: '#ffffff',
                    border: 'none',
                    borderRadius: '8px',
                    fontWeight: '600',
                    cursor: cargandoInscripcion ? 'not-allowed' : 'pointer'
                  }}>
                  {cargandoInscripcion ? 'Consultando...' : 'Consultar'}
                </button>
              </form>

              {errorInscripcion && (
                <div style={{ background: '#fef2f2', color: '#991b1b', padding: '12px', borderRadius: '8px', border: '1px solid #fecaca', textAlign: 'center', marginBottom: '20px' }}>
                  ⚠️ {errorInscripcion}
                </div>
              )}

              {exitoInscripcion && (
                <div style={{ background: '#f0fdf4', color: '#166534', padding: '12px', borderRadius: '8px', border: '1px solid #bbf7d0', textAlign: 'center', marginBottom: '20px' }}>
                  ✅ {exitoInscripcion}
                </div>
              )}

              {datosAlumno && (
                <div>
                  <div style={{
                    background: '#f8fafc',
                    border: '1px solid #e2e8f0',
                    borderRadius: '10px',
                    padding: '15px 20px',
                    marginBottom: '20px',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center'
                  }}>
                    <div>
                      <div style={{ fontSize: '11px', color: '#64748b', textTransform: 'uppercase' }}>Estudiante</div>
                      <div style={{ fontSize: '17px', fontWeight: 'bold', color: '#163654' }}>
                        {datosAlumno.alumno.alumno}
                      </div>
                      <div style={{ fontSize: '13px', color: '#475569' }}>
                        DNI: {datosAlumno.alumno.dni}
                      </div>
                    </div>
                    <span style={{ background: '#dcfce7', color: '#15803d', padding: '6px 14px', borderRadius: '20px', fontSize: '13px', fontWeight: '600' }}>
                      Cuota al Día ✓
                    </span>
                  </div>

                  <h3 style={{ fontSize: '15px', color: '#163654', margin: '0 0 10px 0' }}>
                    Seleccione las Asignaturas a Cursar:
                  </h3>

                  <div style={{ border: '1px solid #e2e8f0', borderRadius: '8px', overflow: 'hidden', marginBottom: '20px' }}>
                    {OFERTA_INSCRIPCION.map((mat, i) => {
                      const { habilitada, motivo } = verificarHabilitacion(mat);
                      const isChecked = materiasElegidas.includes(mat);
                      return (
                        <div
                          key={i}
                          style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            padding: '12px 16px',
                            borderBottom: i < OFERTA_INSCRIPCION.length - 1 ? '1px solid #e2e8f0' : 'none',
                            background: isChecked ? '#f0f7ff' : habilitada ? '#ffffff' : '#f8fafc'
                          }}>
                          <label style={{ display: 'flex', alignItems: 'center', gap: '10px', cursor: habilitada ? 'pointer' : 'not-allowed', flex: 1 }}>
                            <input
                              type="checkbox"
                              disabled={!habilitada}
                              checked={isChecked}
                              onChange={() => handleToggleMateria(mat)}
                              style={{ width: '17px', height: '17px', accentColor: '#163654' }}
                            />
                            <span style={{ fontWeight: isChecked ? '600' : '500', color: habilitada ? '#1e293b' : '#94a3b8' }}>
                              {mat}
                            </span>
                          </label>

                          <span style={{ fontSize: '12px', fontWeight: '500', color: habilitada ? '#15803d' : '#b91c1c' }}>
                            {habilitada ? 'Habilitada' : motivo}
                          </span>
                        </div>
                      );
                    })}
                  </div>

                  <button
                    onClick={handleConfirmarInscripcion}
                    disabled={materiasElegidas.length === 0}
                    style={{
                      width: '100%',
                      padding: '14px',
                      background: materiasElegidas.length > 0 ? 'linear-gradient(180deg, #204c73 0%, #163654 100%)' : '#cbd5e1',
                      color: '#ffffff',
                      border: 'none',
                      borderRadius: '8px',
                      fontSize: '16px',
                      fontWeight: '600',
                      cursor: materiasElegidas.length > 0 ? 'pointer' : 'not-allowed'
                    }}>
                    Confirmar Inscripción ({materiasElegidas.length} asignatura/s)
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* PANEL 2: ALUMNOS INSCRIPTOS (SECRETARÍA)                 */}
        {/* ========================================================= */}
        {panelActivo === 'inscriptos' && (
          <div style={{ background: '#ffffff', borderRadius: '16px', padding: '25px', boxShadow: '0 20px 40px rgba(15, 34, 53, 0.3)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px', borderBottom: '2px solid #e2e8f0', paddingBottom: '12px' }}>
              <h2 style={{ margin: 0, color: '#163654' }}>Padrón de Alumnos Inscriptos</h2>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button
                  onClick={cargarInscriptos}
                  style={{ padding: '8px 14px', background: '#204c73', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                  🔄 Actualizar
                </button>
                <button
                  onClick={descargarExcelInscriptos}
                  style={{ padding: '8px 14px', background: '#15803d', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                  Descargar Excel
                </button>
              </div>
            </div>

            <div style={{ marginBottom: '20px' }}>
              <label style={{ fontWeight: '600', color: '#334155' }}>Filtrar por Materia: </label>
              <select
                value={filtroMateria}
                onChange={e => setFiltroMateria(e.target.value)}
                style={{ padding: '8px 12px', borderRadius: '6px', border: '1px solid #cbd5e1', marginLeft: '10px' }}>
                {materiasUnicasInscriptos.map((m, idx) => (
                  <option key={idx} value={m}>{m}</option>
                ))}
              </select>
            </div>

            <table border="1" cellPadding="10" style={{ width: '100%', borderCollapse: 'collapse', borderColor: '#e2e8f0', textAlign: 'left' }}>
              <thead style={{ background: '#f1f5f9', color: '#163654' }}>
                <tr>
                  <th>Tipo</th>
                  <th>Materia</th>
                  <th>D.N.I.</th>
                  <th>Estudiante</th>
                  <th>Fecha</th>
                </tr>
              </thead>
              <tbody>
                {inscriptosFiltrados.length > 0 ? (
                  inscriptosFiltrados.map(item => (
                    <tr key={item.id}>
                      <td>{item.tipo === 'MESA_EXAMEN' ? 'Mesa de examen' : 'Curso'}</td>
                      <td><strong style={{ color: '#204c73' }}>{item.materia}</strong></td>
                      <td>{item.dni}</td>
                      <td>{item.alumno}</td>
                      <td>{item.fecha_inscripcion ? new Date(item.fecha_inscripcion).toLocaleDateString() : '-'}</td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" align="center" style={{ padding: '20px', color: '#64748b' }}>
                      No hay inscripciones registradas para esta materia.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}

        {panelActivo === 'ofertas' && (
          <div style={{ background: '#ffffff', borderRadius: '16px', padding: '25px', boxShadow: '0 20px 40px rgba(15, 34, 53, 0.3)' }}>
            <h2 style={{ marginTop: 0, color: '#163654' }}>Administrar cursos y mesas de examen</h2>
            <p style={{ color: '#475569' }}>Las ofertas activas aparecerán en el panel del alumno. Las ofertas inactivas se conservan junto a sus inscripciones anteriores.</p>

            <form onSubmit={guardarOfertaAcademica} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, padding: 16, background: '#f8fafc', borderRadius: 10, marginBottom: 22 }}>
              <label style={{ display: 'grid', gap: 5 }}>Tipo
                <select value={formOferta.tipo} onChange={e => setFormOferta({ ...formOferta, tipo: e.target.value })} style={{ padding: 9 }}>
                  <option value="CURSO">Curso</option>
                  <option value="MESA_EXAMEN">Mesa de examen</option>
                </select>
              </label>
              <label style={{ display: 'grid', gap: 5 }}>Materia o curso
                <input required maxLength="255" value={formOferta.materia} onChange={e => setFormOferta({ ...formOferta, materia: e.target.value })} style={{ padding: 9 }} />
              </label>
              <label style={{ display: 'grid', gap: 5 }}>Año
                <input value={formOferta.anio_carrera} onChange={e => setFormOferta({ ...formOferta, anio_carrera: e.target.value })} placeholder="Ej.: 1er Año" style={{ padding: 9 }} />
              </label>
              {formOferta.tipo === 'CURSO' ? <>
                <label style={{ display: 'grid', gap: 5 }}>Fecha de inicio
                  <input type="date" value={formOferta.fecha_inicio} onChange={e => setFormOferta({ ...formOferta, fecha_inicio: e.target.value })} style={{ padding: 9 }} />
                </label>
                <label style={{ display: 'grid', gap: 5 }}>Fecha de finalización
                  <input type="date" value={formOferta.fecha_fin} onChange={e => setFormOferta({ ...formOferta, fecha_fin: e.target.value })} style={{ padding: 9 }} />
                </label>
              </> : <label style={{ display: 'grid', gap: 5 }}>Fecha de examen
                <input type="date" required value={formOferta.fecha_examen} onChange={e => setFormOferta({ ...formOferta, fecha_examen: e.target.value })} style={{ padding: 9 }} />
              </label>}
              <label style={{ display: 'grid', gap: 5 }}>Horario (opcional)
                <input value={formOferta.horario} onChange={e => setFormOferta({ ...formOferta, horario: e.target.value })} placeholder="Ej.: 18:00" style={{ padding: 9 }} />
              </label>
              <button type="submit" disabled={guardandoOferta} style={{ alignSelf: 'end', padding: '10px 16px', color: '#fff', background: '#163654', border: 0, borderRadius: 6, cursor: 'pointer' }}>{guardandoOferta ? 'Guardando…' : 'Agregar oferta'}</button>
            </form>

            {errorOferta && <p role="alert" style={{ color: '#b91c1c' }}>{errorOferta}</p>}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h3 style={{ color: '#163654' }}>Ofertas ({ofertasAcademicas.length})</h3>
              <button onClick={cargarOfertasAcademicas} style={{ padding: '8px 12px', cursor: 'pointer' }}>Actualizar</button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table border="1" cellPadding="8" style={{ width: '100%', borderCollapse: 'collapse', borderColor: '#e2e8f0', textAlign: 'left' }}>
                <thead style={{ background: '#f1f5f9' }}><tr><th>Tipo</th><th>Materia/curso</th><th>Año</th><th>Fechas</th><th>Horario</th><th>Estado</th><th>Acción</th></tr></thead>
                <tbody>{ofertasAcademicas.map(oferta => (
                  <tr key={oferta.id}>
                    <td>{oferta.tipo === 'MESA_EXAMEN' ? 'Mesa de examen' : 'Curso'}</td>
                    <td>{oferta.materia}</td>
                    <td>{oferta.anio_carrera || '—'}</td>
                    <td>{oferta.fecha_examen || [oferta.fecha_inicio, oferta.fecha_fin].filter(Boolean).join(' a ') || '—'}</td>
                    <td>{oferta.horario || '—'}</td>
                    <td>{oferta.activa ? 'Activa' : 'Inactiva'}</td>
                    <td><button onClick={() => cambiarEstadoOferta(oferta)} style={{ padding: '6px 9px', cursor: 'pointer' }}>{oferta.activa ? 'Desactivar' : 'Activar'}</button></td>
                  </tr>
                ))}{ofertasAcademicas.length === 0 && <tr><td colSpan="7" align="center">Todavía no hay ofertas registradas.</td></tr>}</tbody>
              </table>
            </div>
          </div>
        )}

        {panelActivo === 'materias' && (
          <div style={{ background: '#ffffff', borderRadius: '16px', padding: '25px', boxShadow: '0 20px 40px rgba(15, 34, 53, 0.3)' }}>
            <h2 style={{ marginTop: 0, color: '#163654' }}>Catálogo de materias</h2>
            <p style={{ color: '#475569' }}>Las materias del catálogo aparecen al cargar o editar fichas del Libro Matriz. Quitar una materia no borra notas históricas.</p>

            <form onSubmit={agregarMateriaCatalogo} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12, padding: 16, background: '#f8fafc', borderRadius: 10, marginBottom: 22 }}>
              <label style={{ display: 'grid', gap: 5 }}>Nombre de materia
                <input required maxLength="255" value={formMateria.materia} onChange={e => setFormMateria({ ...formMateria, materia: e.target.value })} style={{ padding: 9 }} />
              </label>
              <label style={{ display: 'grid', gap: 5 }}>Año
                <select required value={formMateria.anio_carrera} onChange={e => setFormMateria({ ...formMateria, anio_carrera: e.target.value })} style={{ padding: 9 }}>
                  <option value="PRIMER AÑO">1er año</option>
                  <option value="SEGUNDO AÑO">2do año</option>
                  <option value="TERCER AÑO">3er año</option>
                </select>
              </label>
              <button type="submit" disabled={guardandoMateria} style={{ alignSelf: 'end', padding: '10px 16px', color: '#fff', background: '#163654', border: 0, borderRadius: 6, cursor: 'pointer' }}>{guardandoMateria ? 'Guardando…' : 'Añadir materia'}</button>
            </form>

            {errorCatalogo && <p role="alert" style={{ color: '#b91c1c' }}>{errorCatalogo}</p>}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
              <h3 style={{ color: '#163654' }}>Materias ({materiasCatalogo.length})</h3>
              <button onClick={cargarMateriasCatalogo} style={{ padding: '8px 12px', cursor: 'pointer' }}>Actualizar</button>
            </div>
            <div style={{ display: 'grid', gap: 18 }}>
              {gruposDeAnio.map(grupo => {
                const materiasDelGrupo = materiasCatalogo.filter(materia => clasificarAnio(materia.anio_carrera) === grupo.id);
                return (
                  <section key={grupo.id} style={{ border: '1px solid #dbe4ee', borderRadius: 10, padding: 14 }}>
                    <h3 style={{ color: '#163654', margin: '0 0 10px' }}>{grupo.titulo} ({materiasDelGrupo.length})</h3>
                    <div style={{ overflowX: 'auto' }}>
                      <table border="1" cellPadding="8" style={{ width: '100%', borderCollapse: 'collapse', borderColor: '#e2e8f0', textAlign: 'left' }}>
                        <thead style={{ background: '#f1f5f9' }}><tr><th>Materia</th><th>Año</th><th>Acciones</th></tr></thead>
                        <tbody>
                          {materiasDelGrupo.map(renderFilaMateria)}
                          {materiasDelGrupo.length === 0 && <tr><td colSpan="3" align="center" style={{ color: '#64748b' }}>Todavía no hay materias en este año.</td></tr>}
                        </tbody>
                      </table>
                    </div>
                  </section>
                );
              })}
              {materiasEnOtrosAnios.length > 0 && (
                <section style={{ border: '1px solid #dbe4ee', borderRadius: 10, padding: 14 }}>
                  <h3 style={{ color: '#163654', margin: '0 0 10px' }}>Otros años ({materiasEnOtrosAnios.length})</h3>
                  <div style={{ overflowX: 'auto' }}>
                    <table border="1" cellPadding="8" style={{ width: '100%', borderCollapse: 'collapse', borderColor: '#e2e8f0', textAlign: 'left' }}>
                      <thead style={{ background: '#f1f5f9' }}><tr><th>Materia</th><th>Año</th><th>Acciones</th></tr></thead>
                      <tbody>{materiasEnOtrosAnios.map(renderFilaMateria)}</tbody>
                    </table>
                  </div>
                </section>
              )}
            </div>
          </div>
        )}

        {panelActivo === 'cuotas' && (
          <div style={{ background: '#ffffff', borderRadius: '16px', padding: '25px', boxShadow: '0 20px 40px rgba(15, 34, 53, 0.3)' }}>
            <h2 style={{ marginTop: 0, color: '#163654' }}>Registro de pagos de cuotas</h2>
            <p style={{ color: '#475569' }}>Configura desde qué mes revisar la deuda y cuánto debe abonarse en cada mes. Los pagos parciales se acumulan y el estado del alumno se actualiza al instante cuando cubre todos los meses configurados.</p>

            <section style={{ padding: 16, background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 10, marginBottom: 20 }}>
              <h3 style={{ margin: '0 0 12px', color: '#163654' }}>Configuración de cuotas</h3>
              <form onSubmit={guardarInicioControlCuotas} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'end', gap: 12, marginBottom: 16 }}>
                <label style={{ display: 'grid', gap: 5 }}>Controlar deuda desde
                  <input required type="month" value={inicioControlCuotas} onChange={e => setInicioControlCuotas(e.target.value)} style={{ padding: 9 }} />
                </label>
                <button type="submit" disabled={guardandoConfiguracionCuotas} style={{ padding: '10px 14px', color: '#fff', background: '#163654', border: 0, borderRadius: 6, cursor: 'pointer' }}>{guardandoConfiguracionCuotas ? 'Guardando…' : 'Guardar mes inicial'}</button>
              </form>
              <form onSubmit={guardarImporteCuota} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'end', gap: 12 }}>
                <label style={{ display: 'grid', gap: 5 }}>Mes
                  <input required type="month" value={periodoTarifa} onChange={e => setPeriodoTarifa(e.target.value)} style={{ padding: 9 }} />
                </label>
                <label style={{ display: 'grid', gap: 5 }}>Importe requerido para ese mes
                  <input required type="number" min="0.01" step="0.01" value={importeTarifa} onChange={e => setImporteTarifa(e.target.value)} placeholder="0,00" style={{ padding: 9 }} />
                </label>
                <button type="submit" disabled={guardandoConfiguracionCuotas} style={{ padding: '10px 14px', color: '#fff', background: '#166534', border: 0, borderRadius: 6, cursor: 'pointer' }}>{guardandoConfiguracionCuotas ? 'Guardando…' : 'Guardar importe del mes'}</button>
              </form>
              <p style={{ margin: '12px 0 0', color: '#475569', fontSize: 14 }}>Cada mes desde el inicio debe tener un importe configurado. Si falta un importe, el sistema considera que el alumno aún no está al día. Los excedentes de un mes no se trasladan al siguiente.</p>
              {periodosCuota.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 12 }}>{periodosCuota.map(item => <button key={item.periodo} type="button" onClick={() => { setPeriodoTarifa(item.periodo); setImporteTarifa(String(item.importe)); }} style={{ padding: '6px 10px', border: '1px solid #cbd5e1', borderRadius: 6, background: '#fff', cursor: 'pointer' }}>{item.periodo}: {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(item.importe))} · editar</button>)}</div>}
            </section>

            <form onSubmit={registrarPagoCuota} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(190px, 1fr))', gap: 12, padding: 16, background: '#f8fafc', borderRadius: 10, marginBottom: 22 }}>
              <label style={{ display: 'grid', gap: 5 }}>DNI del alumno
                <input required inputMode="numeric" value={formPago.dni} onChange={e => setFormPago({ ...formPago, dni: e.target.value })} style={{ padding: 9 }} />
              </label>
              <label style={{ display: 'grid', gap: 5 }}>Mes que paga
                <input required type="month" value={formPago.periodo} onChange={e => {
                  setPeriodoPagos(e.target.value);
                  setFormPago({ ...formPago, periodo: e.target.value });
                }} style={{ padding: 9 }} />
              </label>
              <label style={{ display: 'grid', gap: 5 }}>Importe recibido
                <input required type="number" min="0.01" step="0.01" value={formPago.importe} onChange={e => setFormPago({ ...formPago, importe: e.target.value })} placeholder="0,00" style={{ padding: 9 }} />
              </label>
              <label style={{ display: 'grid', gap: 5 }}>Medio de pago
                <select value={formPago.medio} onChange={e => setFormPago({ ...formPago, medio: e.target.value })} style={{ padding: 9 }}>
                  <option value="EFECTIVO">Efectivo</option>
                  <option value="TRANSFERENCIA">Transferencia</option>
                </select>
              </label>
              <label style={{ display: 'grid', gap: 5 }}>Fecha de recepción
                <input required type="date" value={formPago.fecha_pago} onChange={e => setFormPago({ ...formPago, fecha_pago: e.target.value })} style={{ padding: 9 }} />
              </label>
              <label style={{ display: 'grid', gap: 5 }}>N.º de comprobante (opcional)
                <input maxLength="120" value={formPago.referencia} onChange={e => setFormPago({ ...formPago, referencia: e.target.value })} style={{ padding: 9 }} />
              </label>
              <label style={{ display: 'grid', gap: 5, gridColumn: '1 / -1' }}>Observaciones (opcional)
                <input maxLength="500" value={formPago.observaciones} onChange={e => setFormPago({ ...formPago, observaciones: e.target.value })} style={{ padding: 9 }} />
              </label>
              <button type="submit" disabled={guardandoPago} style={{ justifySelf: 'start', padding: '10px 16px', color: '#fff', background: '#163654', border: 0, borderRadius: 6, cursor: 'pointer' }}>{guardandoPago ? 'Registrando…' : 'Registrar pago recibido'}</button>
            </form>

            {errorPago && <p role="alert" style={{ color: '#b91c1c' }}>{errorPago}</p>}
            {mensajePago && <p role="status" style={{ color: '#166534' }}>{mensajePago}</p>}
            <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginBottom: 10 }}>
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#163654', fontWeight: 600 }}>Ver pagos de
                <input type="month" value={periodoPagos} onChange={e => {
                  setPeriodoPagos(e.target.value);
                  setFormPago(current => ({ ...current, periodo: e.target.value }));
                }} style={{ padding: 8 }} />
              </label>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <strong style={{ color: '#163654' }}>Total registrado: {new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(pagosCuotas.reduce((total, pago) => total + Number(pago.importe || 0), 0))}</strong>
                <button onClick={descargarPagosCuotas} disabled={pagosCuotas.length === 0} style={{ padding: '8px 12px', cursor: pagosCuotas.length ? 'pointer' : 'not-allowed' }}>Descargar Excel</button>
              </div>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table border="1" cellPadding="8" style={{ width: '100%', minWidth: 850, borderCollapse: 'collapse', borderColor: '#e2e8f0', textAlign: 'left' }}>
                <thead style={{ background: '#f1f5f9' }}><tr><th>Fecha</th><th>DNI</th><th>Alumno</th><th>Mes</th><th>Importe</th><th>Medio</th><th>Comprobante</th><th>Observaciones</th></tr></thead>
                <tbody>
                  {pagosCuotas.map(pago => (
                    <tr key={pago.id}>
                      <td>{String(pago.fecha_pago || '').slice(0, 10)}</td>
                      <td>{pago.dni}</td>
                      <td>{pago.alumno}</td>
                      <td>{pago.periodo}</td>
                      <td>{new Intl.NumberFormat('es-AR', { style: 'currency', currency: 'ARS' }).format(Number(pago.importe))}</td>
                      <td>{pago.medio === 'TRANSFERENCIA' ? 'Transferencia' : 'Efectivo'}</td>
                      <td>{pago.referencia || '—'}</td>
                      <td>{pago.observaciones || '—'}</td>
                    </tr>
                  ))}
                  {pagosCuotas.length === 0 && <tr><td colSpan="8" align="center" style={{ padding: 18, color: '#64748b' }}>No hay pagos registrados para este mes.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* PANEL 3: LIBRO MATRIZ Y GESTIÓN DE CUOTAS               */}
        {/* ========================================================= */}
        {panelActivo === 'matriz' && (
          <div style={{ background: '#ffffff', borderRadius: '16px', padding: '25px', boxShadow: '0 20px 40px rgba(15, 34, 53, 0.3)' }}>
            <div style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
              <button
                onClick={() => setSubTabMatriz('buscar')}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  background: subTabMatriz === 'buscar' ? '#163654' : '#e2e8f0',
                  color: subTabMatriz === 'buscar' ? '#ffffff' : '#334155'
                }}>
                🔍 Consultar Ficha por DNI
              </button>
              <button
                onClick={() => {
                  setPaginaAlumnosMatriz(1);
                  setSubTabMatriz('listado');
                  cargarAlumnosMatriz(1);
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  background: subTabMatriz === 'listado' ? '#163654' : '#e2e8f0',
                  color: subTabMatriz === 'listado' ? '#ffffff' : '#334155'
                }}>
                👥 Listado de Alumnos
              </button>
              <button
                onClick={async () => {
                  setModoEdicion(false);
                  setFormMatriz({
                    dni: '',
                    alumno: '',
                    domicilio: '',
                    genero: 'Mujer',
                    fecha_nacimiento: '',
                    edad: '',
                    carrera: 'Tecnicatura Superior en Laboratorio de Análisis Clínicos',
                    turno: 'Mañana',
                    anio_cursado: '1er Año',
                    nacido_en: '',
                    el_dia: '',
                    ingreso_con_certificado: '',
                    expedido_por: '',
                    plan_estudios: '',
                    cuota_al_dia: 1
                  });
                  const catalogo = await cargarMateriasCatalogo();
                  setMateriasMatriz(crearNotasVacias(catalogo?.length ? catalogo : PLAN_MATERIAS));
                  setSubTabMatriz('cargar');
                }}
                style={{
                  padding: '8px 16px',
                  borderRadius: '6px',
                  border: 'none',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  background: subTabMatriz === 'cargar' ? '#163654' : '#e2e8f0',
                  color: subTabMatriz === 'cargar' ? '#ffffff' : '#334155'
                }}>
                📝 Cargar Ficha Nueva
              </button>
            </div>

            {subTabMatriz === 'listado' ? (
              <section>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                  <h3 style={{ margin: 0, color: '#163654' }}>Alumnos cargados en el Libro Matriz ({totalAlumnosMatriz})</h3>
                  <button
                    onClick={() => cargarAlumnosMatriz()}
                    disabled={cargandoAlumnosMatriz}
                    style={{ padding: '8px 14px', background: '#204c73', color: '#fff', border: 'none', borderRadius: '6px', cursor: 'pointer', fontWeight: 'bold' }}>
                    {cargandoAlumnosMatriz ? 'Cargando…' : '🔄 Actualizar Padrón'}
                  </button>
                </div>
                {errorMatriz && <p role="alert" style={{ color: '#b91c1c' }}>{errorMatriz}</p>}
                <div style={{ overflowX: 'auto' }}>
                <table border="1" cellPadding="8" style={{ width: '100%', minWidth: '900px', borderCollapse: 'collapse', borderColor: '#e2e8f0', textAlign: 'left' }}>
                  <thead style={{ background: '#f1f5f9', color: '#163654' }}>
                    <tr>
                      <th>D.N.I.</th>
                      <th>Alumno</th>
                      <th>Carrera</th>
                      <th>Turno</th>
                      <th>Año cursado</th>
                      <th>Cuota</th>
                      <th>Estado</th>
                      <th>Acciones</th>
                    </tr>
                  </thead>
                  <tbody>
                    {alumnosMatriz.length > 0 ? alumnosMatriz.map(alumno => (
                      <tr key={alumno.dni}>
                        <td>{alumno.dni}</td>
                        <td>{alumno.alumno}</td>
                        <td>{alumno.carrera || '-'}</td>
                        <td>{alumno.turno || '-'}</td>
                        <td>{alumno.anio_cursado || '-'}</td>
                        <td>{alumno.cuota_al_dia ? 'Al día' : 'Con deuda'}</td>
                        <td>{alumno.dado_de_baja ? 'De baja' : 'Activo'}</td>
                        <td style={{ whiteSpace: 'nowrap' }}>
                          <button
                            type="button"
                            onClick={() => handleEditarDesdeListado(alumno.dni)}
                            disabled={accionAlumnoDni === alumno.dni}
                            style={{ marginRight: 6, padding: '6px 8px', cursor: 'pointer' }}>
                            ✏️ Editar
                          </button>
                          <button
                            type="button"
                            onClick={() => handleCambiarEstadoAlumno(alumno)}
                            disabled={accionAlumnoDni === alumno.dni}
                            style={{ marginRight: 6, padding: '6px 8px', cursor: 'pointer' }}>
                            {alumno.dado_de_baja ? 'Reactivar' : 'Dar de baja'}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEliminarAlumno(alumno)}
                            disabled={accionAlumnoDni === alumno.dni}
                            style={{ padding: '6px 8px', color: '#fff', background: '#b91c1c', border: 0, borderRadius: 4, cursor: 'pointer' }}>
                            Eliminar
                          </button>
                        </td>
                      </tr>
                    )) : (
                      <tr>
                        <td colSpan="8" align="center" style={{ padding: '20px', color: '#64748b' }}>
                          No hay alumnos cargados en la base de datos.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, marginTop: 14 }}>
                  <span style={{ color: '#475569' }}>Página {paginaAlumnosMatriz} de {Math.max(1, Math.ceil(totalAlumnosMatriz / alumnosMatrizPorPagina))} · mostrando {alumnosMatriz.length} de {totalAlumnosMatriz}</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" onClick={() => cargarAlumnosMatriz(paginaAlumnosMatriz - 1)} disabled={cargandoAlumnosMatriz || paginaAlumnosMatriz <= 1} style={{ padding: '8px 12px' }}>Anterior</button>
                    <button type="button" onClick={() => cargarAlumnosMatriz(paginaAlumnosMatriz + 1)} disabled={cargandoAlumnosMatriz || paginaAlumnosMatriz >= Math.ceil(totalAlumnosMatriz / alumnosMatrizPorPagina)} style={{ padding: '8px 12px' }}>Siguiente</button>
                  </div>
                </div>
              </section>
            ) : subTabMatriz === 'buscar' ? (
              <div>
                <form onSubmit={handleBuscarMatriz} style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
                  <input
                    type="text"
                    placeholder="D.N.I. del alumno..."
                    value={dniBusquedaMatriz}
                    onChange={e => setDniBusquedaMatriz(e.target.value)}
                    required
                    style={{ padding: '10px 14px', width: '240px', border: '1px solid #cbd5e1', borderRadius: '6px', backgroundColor: '#fff', color: '#1e293b' }}
                  />
                  <button type="submit" style={{ padding: '10px 20px', background: '#204c73', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                    Buscar Ficha
                  </button>
                </form>

                {errorMatriz && <p style={{ color: '#b91c1c' }}>{errorMatriz}</p>}

                {alumnoMatriz && (
                  <div style={{ border: '1px solid #cbd5e1', borderRadius: '10px', padding: '20px', background: '#f8fafc' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #cbd5e1', paddingBottom: '12px' }}>
                      <h3 style={{ margin: 0, color: '#163654', textTransform: 'uppercase' }}>
                        {alumnoMatriz.alumno} (DNI: {alumnoMatriz.dni})
                      </h3>
                      <button
                        onClick={handleIniciarEdicion}
                        style={{ padding: '7px 14px', background: '#eab308', color: '#000', border: 'none', borderRadius: '6px', fontWeight: 'bold', cursor: 'pointer' }}>
                        ✏️ Editar Ficha Completa
                      </button>
                    </div>

                    {/* CONTROL DE CUOTA DIRECTO */}
                    <div style={{ margin: '15px 0', padding: '12px', background: '#ffffff', border: '1px solid #e2e8f0', borderRadius: '8px', display: 'flex', alignItems: 'center', gap: '15px' }}>
                      <span>
                        <strong>Estado del alumno: </strong>
                        <span style={{ color: alumnoMatriz.dado_de_baja ? '#b91c1c' : '#15803d', fontWeight: 'bold' }}>
                          {alumnoMatriz.dado_de_baja ? 'De baja' : 'Activo'}
                        </span>
                      </span>
                      <span>
                        <strong>Estado de Cuota: </strong>
                        {alumnoMatriz.cuota_al_dia ? (
                          <span style={{ color: '#15803d', fontWeight: 'bold' }}>Al día ✅</span>
                        ) : (
                          <span style={{ color: '#b91c1c', fontWeight: 'bold' }}>Con deuda ❌</span>
                        )}
                      </span>
                      <button
                        onClick={handleToggleCuota}
                        disabled={cargandoCuota}
                        style={{
                          padding: '6px 14px',
                          borderRadius: '6px',
                          border: 'none',
                          cursor: 'pointer',
                          fontWeight: 'bold',
                          background: alumnoMatriz.cuota_al_dia ? '#dc2626' : '#16a34a',
                          color: '#ffffff'
                        }}>
                        {alumnoMatriz.cuota_al_dia ? 'Marcar como Deudor' : 'Habilitar (Marcar Al Día)'}
                      </button>
                    </div>

                    {/* TODOS LOS DATOS PERSONALES Y ACADÉMICOS EN LA CONSULTA */}
                    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px', fontSize: '14px', marginBottom: '20px', background: '#fff', padding: '15px', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                      <p style={{ margin: '4px 0' }}><strong>D.N.I. Nº:</strong> {alumnoMatriz.dni}</p>
                      <p style={{ margin: '4px 0' }}><strong>Domicilio:</strong> {alumnoMatriz.domicilio || '-'}</p>
                      <p style={{ margin: '4px 0' }}><strong>Sexo/Género:</strong> {alumnoMatriz.genero || '-'}</p>
                      <p style={{ margin: '4px 0' }}><strong>Fecha Nac.:</strong> {alumnoMatriz.fecha_nacimiento ? alumnoMatriz.fecha_nacimiento.substring(0, 10) : (alumnoMatriz.el_dia ? alumnoMatriz.el_dia.substring(0, 10) : '-')}</p>
                      <p style={{ margin: '4px 0' }}><strong>Edad:</strong> {alumnoMatriz.edad ? `${alumnoMatriz.edad} años` : '-'}</p>
                      <p style={{ margin: '4px 0' }}><strong>Nacido en:</strong> {alumnoMatriz.nacido_en || '-'}</p>
                      <p style={{ margin: '4px 0' }}><strong>Carrera:</strong> {alumnoMatriz.carrera || '-'}</p>
                      <p style={{ margin: '4px 0' }}><strong>Turno:</strong> {alumnoMatriz.turno || '-'}</p>
                      <p style={{ margin: '4px 0' }}><strong>Año Cursado:</strong> {alumnoMatriz.anio_cursado || '-'}</p>
                      <p style={{ margin: '4px 0' }}><strong>Certificado de Ingreso:</strong> {alumnoMatriz.ingreso_con_certificado || '-'}</p>
                      <p style={{ margin: '4px 0' }}><strong>Expedido por:</strong> {alumnoMatriz.expedido_por || '-'}</p>
                      <p style={{ margin: '4px 0' }}><strong>Plan de Estudios:</strong> {alumnoMatriz.plan_estudios || '-'}</p>
                    </div>

                    <h4 style={{ color: '#163654', marginBottom: '8px' }}>Calificaciones en Libro Matriz</h4>
                    <table border="1" cellPadding="6" style={{ width: '100%', borderCollapse: 'collapse', borderColor: '#cbd5e1', background: '#fff', textAlign: 'center' }}>
                      <thead style={{ background: '#e2e8f0' }}>
                        <tr>
                          <th>Año</th>
                          <th>Materia</th>
                          <th>Nota</th>
                          <th>Libro</th>
                          <th>Folio</th>
                          <th>Cond.</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(alumnoMatriz.materias || []).map(m => (
                          <tr key={m.id}>
                            <td>{m.anio_carrera}</td>
                            <td align="left">{m.materia}</td>
                            <td><strong>{m.nota_num || '-'}</strong></td>
                            <td>{m.libro_acta || '-'}</td>
                            <td>{m.folio_acta || '-'}</td>
                            <td>{m.condicion || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            ) : (
              <form onSubmit={handleGuardarMatriz}>
                <h3 style={{ color: '#163654', marginTop: 0 }}>
                  {modoEdicion ? 'Editando Ficha Completa del Alumno' : 'Ficha de Inscripción y Matrícula del Alumno'}
                </h3>

                {/* FORMULARIO COMPLETO: DATOS INICIALES + NUEVOS CAMPOS */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '15px', marginBottom: '25px' }}>
                  
                  {/* Nombre y Apellido */}
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', fontWeight: '600', fontSize: '13px', marginBottom: '5px', color: '#163654' }}>
                      Nombre Completo y Apellidos *
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Carrizo, Rocío María Luz"
                      value={formMatriz.alumno}
                      onChange={e => setFormMatriz({ ...formMatriz, alumno: e.target.value })}
                      required
                      style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', backgroundColor: '#fff', color: '#1e293b' }}
                    />
                  </div>

                  {/* DNI */}
                  <div>
                    <label style={{ display: 'block', fontWeight: '600', fontSize: '13px', marginBottom: '5px', color: '#163654' }}>
                      D.N.I. Nº *
                    </label>
                    <input
                      type="text"
                      placeholder="Sin puntos"
                      value={formMatriz.dni}
                      onChange={e => setFormMatriz({ ...formMatriz, dni: e.target.value })}
                      required
                      style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', backgroundColor: '#fff', color: '#1e293b' }}
                    />
                  </div>

                  {/* Domicilio */}
                  <div>
                    <label style={{ display: 'block', fontWeight: '600', fontSize: '13px', marginBottom: '5px', color: '#163654' }}>
                      Domicilio
                    </label>
                    <input
                      type="text"
                      placeholder="Calle, número, barrio / localidad"
                      value={formMatriz.domicilio}
                      onChange={e => setFormMatriz({ ...formMatriz, domicilio: e.target.value })}
                      style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', backgroundColor: '#fff', color: '#1e293b' }}
                    />
                  </div>

                  {/* Sexo / Género */}
                  <div>
                    <label style={{ display: 'block', fontWeight: '600', fontSize: '13px', marginBottom: '5px', color: '#163654' }}>
                      Sexo / Género
                    </label>
                    <select
                      value={formMatriz.genero}
                      onChange={e => setFormMatriz({ ...formMatriz, genero: e.target.value })}
                      style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', background: '#fff', color: '#1e293b' }}>
                      <option value="Mujer">Mujer (Muj)</option>
                      <option value="Varón">Varón (Var)</option>
                      <option value="Otro">Otro</option>
                    </select>
                  </div>

                  {/* Fecha de Nacimiento (el_dia) */}
                  <div>
                    <label style={{ display: 'block', fontWeight: '600', fontSize: '13px', marginBottom: '5px', color: '#163654' }}>
                      Fecha de Nacimiento (El Día)
                    </label>
                    <input
                      type="date"
                      value={formMatriz.fecha_nacimiento}
                      onChange={e => handleFechaNacChange(e.target.value)}
                      style={{ width: '100%', padding: '9px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', backgroundColor: '#fff', color: '#1e293b' }}
                    />
                  </div>

                  {/* Edad */}
                  <div>
                    <label style={{ display: 'block', fontWeight: '600', fontSize: '13px', marginBottom: '5px', color: '#163654' }}>
                      Edad (en años)
                    </label>
                    <input
                      type="number"
                      placeholder="Edad"
                      value={formMatriz.edad}
                      onChange={e => setFormMatriz({ ...formMatriz, edad: e.target.value })}
                      style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', backgroundColor: '#fff', color: '#1e293b' }}
                    />
                  </div>

                  {/* Nacido en (Dato inicial del libro matriz) */}
                  <div>
                    <label style={{ display: 'block', fontWeight: '600', fontSize: '13px', marginBottom: '5px', color: '#163654' }}>
                      Nacido en (Lugar)
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: San Fernando del Valle de Catamarca"
                      value={formMatriz.nacido_en}
                      onChange={e => setFormMatriz({ ...formMatriz, nacido_en: e.target.value })}
                      style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', backgroundColor: '#fff', color: '#1e293b' }}
                    />
                  </div>

                  {/* Carrera */}
                  <div>
                    <label style={{ display: 'block', fontWeight: '600', fontSize: '13px', marginBottom: '5px', color: '#163654' }}>
                      Carrera
                    </label>
                    <input
                      type="text"
                      placeholder="Carrera"
                      value={formMatriz.carrera}
                      onChange={e => setFormMatriz({ ...formMatriz, carrera: e.target.value })}
                      style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', backgroundColor: '#fff', color: '#1e293b' }}
                    />
                  </div>

                  {/* Turno */}
                  <div>
                    <label style={{ display: 'block', fontWeight: '600', fontSize: '13px', marginBottom: '5px', color: '#163654' }}>
                      Turno
                    </label>
                    <select
                      value={formMatriz.turno}
                      onChange={e => setFormMatriz({ ...formMatriz, turno: e.target.value })}
                      style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', background: '#fff', color: '#1e293b' }}>
                      <option value="Mañana">Mañana</option>
                      <option value="Tarde">Tarde</option>
                      <option value="Noche">Noche</option>
                    </select>
                  </div>

                  {/* Año Cursado */}
                  <div>
                    <label style={{ display: 'block', fontWeight: '600', fontSize: '13px', marginBottom: '5px', color: '#163654' }}>
                      Año Cursado
                    </label>
                    <select
                      value={formMatriz.anio_cursado}
                      onChange={e => setFormMatriz({ ...formMatriz, anio_cursado: e.target.value })}
                      style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', background: '#fff', color: '#1e293b' }}>
                      <option value="1er Año">1er Año</option>
                      <option value="2do Año">2do Año</option>
                      <option value="3er Año">3er Año</option>
                    </select>
                  </div>

                  {/* Ingreso con Certificado de (Dato inicial) */}
                  <div>
                    <label style={{ display: 'block', fontWeight: '600', fontSize: '13px', marginBottom: '5px', color: '#163654' }}>
                      Ingreso con Certificado de
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Bachiller en Ciencias Naturales"
                      value={formMatriz.ingreso_con_certificado}
                      onChange={e => setFormMatriz({ ...formMatriz, ingreso_con_certificado: e.target.value })}
                      style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', backgroundColor: '#fff', color: '#1e293b' }}
                    />
                  </div>

                  {/* Expedido por (Dato inicial) */}
                  <div>
                    <label style={{ display: 'block', fontWeight: '600', fontSize: '13px', marginBottom: '5px', color: '#163654' }}>
                      Expedido por
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Colegio Provincial Nº 1"
                      value={formMatriz.expedido_por}
                      onChange={e => setFormMatriz({ ...formMatriz, expedido_por: e.target.value })}
                      style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', backgroundColor: '#fff', color: '#1e293b' }}
                    />
                  </div>

                  {/* Plan de Estudios (Dato inicial) */}
                  <div style={{ gridColumn: 'span 2' }}>
                    <label style={{ display: 'block', fontWeight: '600', fontSize: '13px', marginBottom: '5px', color: '#163654' }}>
                      Plan de Estudios
                    </label>
                    <input
                      type="text"
                      placeholder="Ej: Resolución Ministerial Nº 124/18"
                      value={formMatriz.plan_estudios}
                      onChange={e => setFormMatriz({ ...formMatriz, plan_estudios: e.target.value })}
                      style={{ width: '100%', padding: '10px', border: '1px solid #cbd5e1', borderRadius: '6px', boxSizing: 'border-box', backgroundColor: '#fff', color: '#1e293b' }}
                    />
                  </div>

                </div>

                <h4 style={{ color: '#163654', borderBottom: '2px solid #e2e8f0', paddingBottom: '6px', marginBottom: '15px' }}>
                  Calificaciones y Actas Registradas
                </h4>
                <p style={{ color: '#475569', marginTop: -8 }}>Al guardar la ficha, el sistema avanza automáticamente al año siguiente cuando todas las materias de los años previos del catálogo están aprobadas (nota 4 o más, o condición P/R).</p>

                <table border="1" cellPadding="4" style={{ width: '100%', borderCollapse: 'collapse', borderColor: '#cbd5e1' }}>
                  <thead style={{ background: '#f1f5f9' }}>
                    <tr>
                      <th>Materia</th>
                      <th>Nota</th>
                      <th>Libro</th>
                      <th>Folio</th>
                      <th>Fecha</th>
                      <th>Cond.</th>
                    </tr>
                  </thead>
                  <tbody>
                    {materiasMatriz.map((m, idx) => (
                      <tr key={idx}>
                        <td>{m.materia}</td>
                        <td>
                          <input
                            type="number"
                            step="0.01"
                            style={{ width: '50px', padding: '4px', backgroundColor: '#fff', color: '#1e293b' }}
                            value={m.nota_num}
                            onChange={e => {
                              const arr = [...materiasMatriz];
                              arr[idx].nota_num = e.target.value;
                              setMateriasMatriz(arr);
                            }}
                          />
                        </td>
                        <td>
                          <input
                            style={{ width: '50px', padding: '4px', backgroundColor: '#fff', color: '#1e293b' }}
                            value={m.libro_acta}
                            onChange={e => {
                              const arr = [...materiasMatriz];
                              arr[idx].libro_acta = e.target.value;
                              setMateriasMatriz(arr);
                            }}
                          />
                        </td>
                        <td>
                          <input
                            style={{ width: '50px', padding: '4px', backgroundColor: '#fff', color: '#1e293b' }}
                            value={m.folio_acta}
                            onChange={e => {
                              const arr = [...materiasMatriz];
                              arr[idx].folio_acta = e.target.value;
                              setMateriasMatriz(arr);
                            }}
                          />
                        </td>
                        <td>
                          <input
                            type="date"
                            style={{ padding: '4px', backgroundColor: '#fff', color: '#1e293b' }}
                            value={m.fecha_examen}
                            onChange={e => {
                              const arr = [...materiasMatriz];
                              arr[idx].fecha_examen = e.target.value;
                              setMateriasMatriz(arr);
                            }}
                          />
                        </td>
                        <td>
                          <input
                            style={{ width: '40px', padding: '4px', backgroundColor: '#fff', color: '#1e293b' }}
                            value={m.condicion}
                            onChange={e => {
                              const arr = [...materiasMatriz];
                              arr[idx].condicion = e.target.value;
                              setMateriasMatriz(arr);
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                <div style={{ marginTop: '25px', textAlign: 'right' }}>
                  <button type="submit" style={{ padding: '12px 28px', background: 'linear-gradient(180deg, #204c73 0%, #163654 100%)', color: '#fff', border: 'none', borderRadius: '6px', fontWeight: 'bold', fontSize: '15px', cursor: 'pointer' }}>
                    Guardar Ficha
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </main>
    </div>
  );
}

function AccesoSecretaria({ onAuthenticated }) {
  const [clave, setClave] = useState('');
  const [error, setError] = useState('');
  const [cargando, setCargando] = useState(false);

  const ingresar = async (event) => {
    event.preventDefault();
    setError('');
    setCargando(true);
    try {
      const response = await fetch(`${API_BASE}/api/secretaria/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ adminKey: clave })
      });
      if (!response.ok) throw new Error('Clave incorrecta o acceso no configurado.');
      sessionStorage.setItem(ADMIN_KEY_STORAGE, clave);
      onAuthenticated();
    } catch (err) {
      setError(err.message || 'No se pudo validar el acceso.');
    } finally {
      setCargando(false);
    }
  };

  return (
    <main style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', background: '#eaf0f5', fontFamily: 'Segoe UI, sans-serif', padding: 20 }}>
      <form onSubmit={ingresar} style={{ width: 'min(100%, 380px)', background: '#fff', padding: 28, borderRadius: 12, boxShadow: '0 8px 28px #16365422' }}>
        <h1 style={{ color: '#163654', fontSize: 22 }}>Acceso de secretaría</h1>
        <label htmlFor="admin-key">Clave de acceso</label>
        <input id="admin-key" type="password" autoComplete="current-password" value={clave} onChange={event => setClave(event.target.value)} required style={{ display: 'block', width: '100%', boxSizing: 'border-box', padding: 11, margin: '8px 0 14px', border: '1px solid #94a3b8', borderRadius: 6 }} />
        {error && <p role="alert" style={{ color: '#b91c1c' }}>{error}</p>}
        <button type="submit" disabled={cargando} style={{ padding: '10px 16px', color: '#fff', background: '#163654', border: 0, borderRadius: 6, cursor: 'pointer' }}>{cargando ? 'Verificando...' : 'Ingresar'}</button>
      </form>
    </main>
  );
}

export default function App() {
  const [adminKey, setAdminKey] = useState(() => sessionStorage.getItem(ADMIN_KEY_STORAGE));
  const rutaSecretaria = window.location.pathname === '/secretaria';

  if (!rutaSecretaria) return <AlumnoInscripcion />;
  if (!adminKey) return <AccesoSecretaria onAuthenticated={() => setAdminKey(sessionStorage.getItem(ADMIN_KEY_STORAGE))} />;

  return <GestionAcademica onCerrarSesion={() => { sessionStorage.removeItem(ADMIN_KEY_STORAGE); setAdminKey(null); }} />;
}
