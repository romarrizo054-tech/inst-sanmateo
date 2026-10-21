import React, { useState } from 'react';

const OFERTA_MATERIAS = [
  'Comunicación y TIC',
  'Primeros Auxilios',
  'Bacteriología y Prep. De Mater.',
  'Organización y Gestión de las I.S.',
  'Inmunología',
  'Biología y Genética',
  'Procedimientos Específicos',
  'Inglés Técnico'
];

export default function AlumnoInscripcion() {
  const [dni, setDni] = useState('');
  const [datosAlumno, setDatosAlumno] = useState(null);
  const [error, setError] = useState('');
  const [exito, setExito] = useState('');
  const [materiasElegidas, setMateriasElegidas] = useState([]);
  const [cargando, setCargando] = useState(false);

  // Reemplaza con la URL de tu backend (o tu túnel de Pinggy para el puerto 3001)
  const API_BASE = import.meta.env.VITE_API_URL || '';

  const handleConsultar = async (e) => {
    e.preventDefault();
    setError('');
    setExito('');
    setDatosAlumno(null);
    setMateriasElegidas([]);
    setCargando(true);

    try {
      const res = await fetch(`${API_BASE}/api/inscripcion/validar/${dni.trim()}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'No se pudo consultar el padrón');
      setDatosAlumno(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setCargando(false);
    }
  };

  const verificarHabilitacion = (materia) => {
    if (!datosAlumno) return { habilitada: false, motivo: '' };
    if (datosAlumno.materiasInscriptas.includes(materia)) {
      return { habilitada: false, motivo: 'Ya estás inscripto' };
    }
    if (datosAlumno.materiasAprobadas.includes(materia.toLowerCase())) {
      return { habilitada: false, motivo: 'Materia ya aprobada' };
    }
    const correlativasRequeridas = (datosAlumno.reglasCorrelativas || [])
      .filter(r => r.materia_objetivo.toLowerCase() === materia.toLowerCase())
      .map(r => r.materia_requerida);

    for (const req of correlativasRequeridas) {
      if (!datosAlumno.materiasAprobadas.includes(req.toLowerCase())) {
        return { habilitada: false, motivo: `Falta correlativa: ${req}` };
      }
    }
    return { habilitada: true, motivo: 'Habilitada para cursar' };
  };

  const handleToggle = (materia) => {
    setMateriasElegidas(prev =>
      prev.includes(materia) ? prev.filter(m => m !== materia) : [...prev, materia]
    );
  };

  const handleConfirmar = async () => {
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

      setExito('¡Inscripción registrada con éxito!');
      setDatosAlumno({
        ...datosAlumno,
        materiasInscriptas: [...datosAlumno.materiasInscriptas, ...materiasElegidas]
      });
      setMateriasElegidas([]);
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #1b3a57 0%, #2e6188 50%, #5289ad 100%)',
      padding: '30px 15px',
      fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
      color: '#1a202c',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center'
    }}>
      <div style={{
        maxWidth: '680px',
        width: '100%',
        background: '#ffffff',
        borderRadius: '16px',
        boxShadow: '0 20px 40px rgba(15, 34, 53, 0.35)',
        overflow: 'hidden',
        border: '1px solid rgba(255, 255, 255, 0.6)'
      }}>
        {/* ENCABEZADO INSTITUCIONAL */}
        <div style={{
          background: 'linear-gradient(180deg, #163654 0%, #204c73 100%)',
          color: '#ffffff',
          padding: '30px 20px',
          textAlign: 'center',
          borderBottom: '4px solid #a8c5da'
        }}>
          {/* Logo si existe en public/logo.png o icono de respaldo */}
          <div style={{
            width: '80px',
            height: '80px',
            margin: '0 auto 12px auto',
            borderRadius: '50%',
            background: '#ffffff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 4px 10px rgba(0,0,0,0.25)',
            border: '2px solid #a8c5da'
          }}>
            <img
              src="/logo.png"
              alt="Logo IFTS San Mateo"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'block';
              }}
              style={{ width: '70px', height: '70px', objectFit: 'contain' }}
            />
            <span style={{ display: 'none', color: '#163654', fontWeight: 'bold', fontSize: '24px' }}>
              SM
            </span>
          </div>

          <h4 style={{ margin: '0 0 4px 0', fontWeight: 600, letterSpacing: '1px', textTransform: 'uppercase', fontSize: '12px', color: '#cbdfe9' }}>
            Instituto de Formación Técnica Superior
          </h4>
          <h1 style={{ margin: '0 0 6px 0', fontSize: '26px', letterSpacing: '0.5px' }}>
            SAN MATEO
          </h1>
          <p style={{ margin: 0, fontSize: '13px', color: '#e2edf3', fontStyle: 'italic' }}>
            Virtus et Educatio • Catamarca
          </p>
        </div>

        {/* CUERPO DEL FORMULARIO */}
        <div style={{ padding: '30px 25px' }}>
          <div style={{ textAlign: 'center', marginBottom: '25px' }}>
            <h2 style={{ margin: '0 0 6px 0', color: '#163654', fontSize: '20px' }}>
              Inscripción a Cursada de Asignaturas
            </h2>
            <p style={{ margin: 0, color: '#64748b', fontSize: '14px' }}>
              Ingrese su DNI para comprobar estado administrativo y correlatividades
            </p>
          </div>

          {/* CONSULTA POR DNI */}
          <form onSubmit={handleConsultar} style={{ display: 'flex', gap: '10px', justifyContent: 'center', marginBottom: '20px' }}>
            <input
              type="text"
              placeholder="Número de D.N.I. (sin puntos)..."
              value={dni}
              onChange={e => setDni(e.target.value)}
              required
              style={{
                padding: '12px 16px',
                width: '260px',
                fontSize: '15px',
                border: '2px solid #cbd5e1',
                borderRadius: '8px',
                outline: 'none',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.target.style.borderColor = '#204c73'}
              onBlur={(e) => e.target.style.borderColor = '#cbd5e1'}
            />
            <button
              type="submit"
              disabled={cargando}
              style={{
                padding: '12px 24px',
                background: 'linear-gradient(180deg, #204c73 0%, #163654 100%)',
                color: '#ffffff',
                border: 'none',
                borderRadius: '8px',
                fontWeight: '600',
                cursor: 'pointer',
                boxShadow: '0 4px 10px rgba(22, 54, 84, 0.25)',
                transition: 'all 0.2s'
              }}>
              {cargando ? 'Verificando...' : 'Consultar'}
            </button>
          </form>

          {/* AVISOS */}
          {error && (
            <div style={{
              background: '#fef2f2',
              color: '#991b1b',
              padding: '14px',
              borderRadius: '8px',
              border: '1px solid #fecaca',
              textAlign: 'center',
              fontSize: '14px',
              fontWeight: 500,
              marginBottom: '20px'
            }}>
              ⚠️ {error}
            </div>
          )}

          {exito && (
            <div style={{
              background: '#f0fdf4',
              color: '#166534',
              padding: '14px',
              borderRadius: '8px',
              border: '1px solid #bbf7d0',
              textAlign: 'center',
              fontSize: '14px',
              fontWeight: 500,
              marginBottom: '20px'
            }}>
              ✅ {exito}
            </div>
          )}

          {/* DATOS Y ASIGNATURAS */}
          {datosAlumno && (
            <div>
              {/* TARJETA DEL ESTUDIANTE */}
              <div style={{
                background: '#f8fafc',
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                padding: '16px 20px',
                marginBottom: '24px',
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                boxShadow: '0 2px 4px rgba(0,0,0,0.03)'
              }}>
                <div>
                  <div style={{ fontSize: '12px', color: '#64748b', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                    Estudiante
                  </div>
                  <div style={{ fontSize: '17px', fontWeight: 'bold', color: '#163654' }}>
                    {datosAlumno.alumno.alumno}
                  </div>
                  <div style={{ fontSize: '13px', color: '#475569', marginTop: '2px' }}>
                    DNI: <strong>{datosAlumno.alumno.dni}</strong>
                  </div>
                </div>

                <div style={{
                  background: '#dcfce7',
                  color: '#15803d',
                  padding: '6px 14px',
                  borderRadius: '20px',
                  fontSize: '13px',
                  fontWeight: '600',
                  border: '1px solid #bbf7d0'
                }}>
                  Cuota al Día ✓
                </div>
              </div>

              {/* LISTA DE MATERIAS */}
              <h3 style={{ fontSize: '16px', color: '#163654', margin: '0 0 12px 0', borderBottom: '2px solid #e2e8f0', paddingBottom: '6px' }}>
                Asignaturas Disponibles
              </h3>

              <div style={{
                border: '1px solid #e2e8f0',
                borderRadius: '10px',
                overflow: 'hidden',
                marginBottom: '24px'
              }}>
                {OFERTA_MATERIAS.map((mat, i) => {
                  const { habilitada, motivo } = verificarHabilitacion(mat);
                  const isChecked = materiasElegidas.includes(mat);

                  return (
                    <div
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'space-between',
                        padding: '14px 18px',
                        borderBottom: i < OFERTA_MATERIAS.length - 1 ? '1px solid #e2e8f0' : 'none',
                        background: isChecked ? '#f0f7ff' : habilitada ? '#ffffff' : '#f8fafc',
                        transition: 'background 0.2s'
                      }}>
                      <label style={{ display: 'flex', alignItems: 'center', gap: '12px', cursor: habilitada ? 'pointer' : 'not-allowed', flex: 1 }}>
                        <input
                          type="checkbox"
                          disabled={!habilitada}
                          checked={isChecked}
                          onChange={() => handleToggle(mat)}
                          style={{
                            width: '18px',
                            height: '18px',
                            cursor: habilitada ? 'pointer' : 'not-allowed',
                            accentColor: '#163654'
                          }}
                        />
                        <span style={{
                          fontWeight: isChecked ? '600' : '500',
                          color: habilitada ? '#1e293b' : '#94a3b8',
                          fontSize: '15px'
                        }}>
                          {mat}
                        </span>
                      </label>

                      <span style={{
                        fontSize: '13px',
                        fontWeight: '500',
                        color: habilitada ? '#15803d' : '#b91c1c'
                      }}>
                        {habilitada ? 'Habilitada' : motivo}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* BOTÓN CONFIRMAR */}
              <button
                onClick={handleConfirmar}
                disabled={materiasElegidas.length === 0}
                style={{
                  width: '100%',
                  padding: '14px',
                  background: materiasElegidas.length > 0
                    ? 'linear-gradient(180deg, #204c73 0%, #163654 100%)'
                    : '#cbd5e1',
                  color: '#ffffff',
                  border: 'none',
                  borderRadius: '10px',
                  fontSize: '16px',
                  fontWeight: '600',
                  letterSpacing: '0.5px',
                  cursor: materiasElegidas.length > 0 ? 'pointer' : 'not-allowed',
                  boxShadow: materiasElegidas.length > 0 ? '0 4px 12px rgba(22, 54, 84, 0.3)' : 'none',
                  transition: 'all 0.2s'
                }}>
                Confirmar Inscripción ({materiasElegidas.length} asignatura/s)
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
