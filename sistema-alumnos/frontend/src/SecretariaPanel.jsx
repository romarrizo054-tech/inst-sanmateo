import { useState, useEffect } from 'react';
import * as XLSX from 'xlsx';

export default function SecretariaPanel() {
  const [subTab, setSubTab] = useState('inscriptos'); // 'inscriptos' | 'alumnos' | 'buscar'
  const [inscriptos, setInscriptos] = useState([]);
  const [alumnos, setAlumnos] = useState([]);
  const [materiaFiltro, setMateriaFiltro] = useState('TODAS');

  // Consulta por DNI
  const [dniBusqueda, setDniBusqueda] = useState('');
  const [alumnoFicha, setAlumnoFicha] = useState(null);
  const [errorBusqueda, setErrorBusqueda] = useState('');
  const [cargandoCuota, setCargandoCuota] = useState(false);

  const cargarInscriptos = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/secretaria/inscriptos`);
      const data = await res.json();
      setInscriptos(data);
    } catch (err) {
      console.error('Error cargando inscriptos:', err);
    }
  };

  const cargarAlumnos = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/secretaria/alumnos`);
      if (!res.ok) throw new Error('No se pudo cargar el padrón de alumnos');
      setAlumnos(await res.json());
    } catch (err) {
      console.error('Error cargando alumnos:', err);
    }
  };

  useEffect(() => {
    fetch(`${import.meta.env.VITE_API_URL || ''}/api/secretaria/inscriptos`)
      .then(res => res.json())
      .then(setInscriptos)
      .catch(err => console.error('Error cargando inscriptos:', err));
    fetch(`${import.meta.env.VITE_API_URL || ''}/api/secretaria/alumnos`)
      .then(res => {
        if (!res.ok) throw new Error('No se pudo cargar el padrón de alumnos');
        return res.json();
      })
      .then(setAlumnos)
      .catch(err => console.error('Error cargando alumnos:', err));
  }, []);

  const descargarExcel = () => {
    const filas = inscriptosFiltrados.map(item => ({
      Materia: item.materia,
      DNI: item.dni,
      Alumno: item.alumno,
      'Fecha de inscripción': item.fecha_inscripcion
        ? new Date(item.fecha_inscripcion).toLocaleDateString()
        : ''
    }));
    const hoja = XLSX.utils.json_to_sheet(filas);
    const libro = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(libro, hoja, 'Inscriptos');
    XLSX.writeFile(libro, 'alumnos-inscriptos.xlsx');
  };

  const handleBuscarFicha = async (e) => {
    if (e) e.preventDefault();
    setErrorBusqueda('');
    setAlumnoFicha(null);
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/alumnos/${dniBusqueda.trim()}`);
      if (!res.ok) throw new Error('Alumno no encontrado en la base de datos');
      const data = await res.json();
      setAlumnoFicha(data);
    } catch (err) {
      setErrorBusqueda(err.message);
    }
  };

  // Función para cambiar cuota con 1 clic
  const handleToggleCuota = async () => {
    if (!alumnoFicha) return;
    const nuevoEstado = !alumnoFicha.cuota_al_dia;
    setCargandoCuota(true);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/alumnos/${alumnoFicha.dni}/cuota`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cuota_al_dia: nuevoEstado })
      });

      if (!res.ok) throw new Error('Error al actualizar la cuota');

      // Modificar el estado local para verlo reflejado sin recargar la página
      setAlumnoFicha({
        ...alumnoFicha,
        cuota_al_dia: nuevoEstado ? 1 : 0
      });
    } catch (err) {
      alert(err.message);
    } finally {
      setCargandoCuota(false);
    }
  };

  const listaMaterias = ['TODAS', ...new Set(inscriptos.map(i => i.materia))];
  const inscriptosFiltrados = materiaFiltro === 'TODAS'
    ? inscriptos
    : inscriptos.filter(i => i.materia === materiaFiltro);

  return (
    <div style={{ maxWidth: '1050px', margin: '20px auto', fontFamily: 'Arial, sans-serif', padding: '0 15px' }}>
      <header style={{ borderBottom: '2px solid #333', paddingBottom: '12px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h2 style={{ margin: 0 }}>Panel de Secretaría</h2>
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setSubTab('inscriptos')}
            style={{ padding: '8px 16px', background: subTab === 'inscriptos' ? '#0056b3' : '#e0e0e0', color: subTab === 'inscriptos' ? '#fff' : '#000', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
            📋 Alumnos Inscriptos
          </button>
          <button
            onClick={() => setSubTab('alumnos')}
            style={{ padding: '8px 16px', background: subTab === 'alumnos' ? '#0056b3' : '#e0e0e0', color: subTab === 'alumnos' ? '#fff' : '#000', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
            👥 Padrón del Libro Matriz
          </button>
          <button
            onClick={() => setSubTab('buscar')}
            style={{ padding: '8px 16px', background: subTab === 'buscar' ? '#0056b3' : '#e0e0e0', color: subTab === 'buscar' ? '#fff' : '#000', border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold' }}>
            🔍 Consultar Alumno y Cuotas
          </button>
        </div>
      </header>

      {/* VISTA 1: ALUMNOS INSCRIPTOS AGRUPADOS POR MATERIA */}
      {subTab === 'inscriptos' && (
        <section style={{ marginTop: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <div>
              <label><strong>Filtrar por Materia: </strong></label>
              <select
                value={materiaFiltro}
                onChange={e => setMateriaFiltro(e.target.value)}
                style={{ padding: '6px 10px', fontSize: '14px' }}>
                {listaMaterias.map((m, idx) => (
                  <option key={idx} value={m}>{m}</option>
                ))}
              </select>
            </div>
            <button onClick={cargarInscriptos} style={{ padding: '6px 12px', cursor: 'pointer' }}>
              🔄 Actualizar Listado
            </button>
            <button onClick={descargarExcel} style={{ padding: '6px 12px', cursor: 'pointer' }}>
              Descargar Excel
            </button>
          </div>

          <table border="1" cellPadding="8" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ background: '#eee' }}>
              <tr>
                <th>Materia</th>
                <th>D.N.I.</th>
                <th>Alumno</th>
                <th>Fecha de Inscripción</th>
              </tr>
            </thead>
            <tbody>
              {inscriptosFiltrados.length > 0 ? (
                inscriptosFiltrados.map((item) => (
                  <tr key={item.id}>
                    <td><strong>{item.materia}</strong></td>
                    <td>{item.dni}</td>
                    <td>{item.alumno}</td>
                    <td>{item.fecha_inscripcion ? new Date(item.fecha_inscripcion).toLocaleDateString() : '-'}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="4" align="center" style={{ padding: '15px' }}>No hay alumnos inscriptos en esta materia todavía.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}

      {subTab === 'alumnos' && (
        <section style={{ marginTop: '20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
            <h3 style={{ margin: 0 }}>Alumnos cargados en el Libro Matriz ({alumnos.length})</h3>
            <button onClick={cargarAlumnos} style={{ padding: '6px 12px', cursor: 'pointer' }}>
              🔄 Actualizar Padrón
            </button>
          </div>
          <table border="1" cellPadding="8" style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left' }}>
            <thead style={{ background: '#eee' }}>
              <tr>
                <th>D.N.I.</th>
                <th>Alumno</th>
                <th>Carrera</th>
                <th>Turno</th>
                <th>Año cursado</th>
                <th>Cuota</th>
              </tr>
            </thead>
            <tbody>
              {alumnos.length > 0 ? alumnos.map(alumno => (
                <tr key={alumno.dni}>
                  <td>{alumno.dni}</td>
                  <td>{alumno.alumno}</td>
                  <td>{alumno.carrera || '-'}</td>
                  <td>{alumno.turno || '-'}</td>
                  <td>{alumno.anio_cursado || '-'}</td>
                  <td>{alumno.cuota_al_dia ? 'Al día' : 'Con deuda'}</td>
                </tr>
              )) : (
                <tr>
                  <td colSpan="6" align="center" style={{ padding: '15px' }}>No hay alumnos cargados en la base de datos.</td>
                </tr>
              )}
            </tbody>
          </table>
        </section>
      )}

      {/* VISTA 2: GESTIÓN DE CUOTA Y FICHA */}
      {subTab === 'buscar' && (
        <section style={{ marginTop: '20px' }}>
          <form onSubmit={handleBuscarFicha} style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
            <input
              type="text"
              placeholder="D.N.I. del alumno..."
              value={dniBusqueda}
              onChange={e => setDniBusqueda(e.target.value)}
              style={{ padding: '8px', width: '220px' }}
              required
            />
            <button type="submit" style={{ padding: '8px 16px', background: '#28a745', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
              Buscar
            </button>
          </form>

          {errorBusqueda && <p style={{ color: 'red' }}>{errorBusqueda}</p>}

          {alumnoFicha && (
            <div style={{ border: '1px solid #ccc', padding: '20px', borderRadius: '6px', background: '#fafafa' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #ddd', paddingBottom: '12px' }}>
                <h3 style={{ margin: 0 }}>{alumnoFicha.alumno} (D.N.I.: {alumnoFicha.dni})</h3>

                {/* BOTÓN INTERACTIVO DE CUOTA */}
                <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                  <span>
                    Estado:{' '}
                    {alumnoFicha.cuota_al_dia ? (
                      <strong style={{ color: 'green' }}>Al día ✅</strong>
                    ) : (
                      <strong style={{ color: 'red' }}>Con deuda ❌</strong>
                    )}
                  </span>
                  <button
                    onClick={handleToggleCuota}
                    disabled={cargandoCuota}
                    style={{
                      padding: '7px 14px',
                      cursor: cargandoCuota ? 'not-allowed' : 'pointer',
                      backgroundColor: alumnoFicha.cuota_al_dia ? '#dc3545' : '#28a745',
                      color: '#fff',
                      border: 'none',
                      borderRadius: '4px',
                      fontWeight: 'bold'
                    }}>
                    {alumnoFicha.cuota_al_dia ? 'Marcar como Deudor' : 'Habilitar (Marcar Al Día)'}
                  </button>
                </div>
              </div>

              <div style={{ margin: '15px 0', fontSize: '14px' }}>
                <p><strong>Certificado de Ingreso:</strong> {alumnoFicha.ingreso_con_certificado || '-'}</p>
                <p><strong>Plan de Estudios:</strong> {alumnoFicha.plan_estudios || '-'}</p>
              </div>

              <h4>Calificaciones y Actas Registradas</h4>
              <table border="1" cellPadding="6" style={{ width: '100%', borderCollapse: 'collapse', background: '#fff' }}>
                <thead style={{ background: '#eee' }}>
                  <tr>
                    <th>Año</th>
                    <th>Materia</th>
                    <th>Nota</th>
                    <th>Libro</th>
                    <th>Folio</th>
                    <th>Condición</th>
                  </tr>
                </thead>
                <tbody>
                  {alumnoFicha.materias && alumnoFicha.materias.length > 0 ? (
                    alumnoFicha.materias.map(m => (
                      <tr key={m.id}>
                        <td>{m.anio_carrera}</td>
                        <td>{m.materia}</td>
                        <td align="center">{m.nota_num || '-'}</td>
                        <td align="center">{m.libro_acta || '-'}</td>
                        <td align="center">{m.folio_acta || '-'}</td>
                        <td align="center">{m.condicion || '-'}</td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="6" align="center">Sin materias cargadas.</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}
