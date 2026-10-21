import React, { useState } from 'react';

// Catálogo de materias disponibles para inscripción que ofreces
const MATERIAS_OFERTADAS = [
  'Comunicación y TIC',
  'Primeros Auxilios',
  'Bacteriología y Prep. De Mater.',
  'Organización y Gestión de las I.S.',
  'Inmunología',
  'Biología y Genética',
  'Procedimientos Específicos',
  'Inglés Técnico'
];

export default function FormularioInscripcion() {
  const [dni, setDni] = useState('');
  const [datosAlumno, setDatosAlumno] = useState(null);
  const [error, setError] = useState('');
  const [materiasAprobadas, setMateriasAprobadas] = useState([]);
  const [reglasCorrelativas, setReglasCorrelativas] = useState([]);
  const [inscritasPrevias, setInscritasPrevias] = useState([]);
  const [seleccionadas, setSeleccionadas] = useState([]);
  const [mensajeExito, setMensajeExito] = useState('');

  // Validar alumno, cuota y correlativas al ingresar DNI
  const handleVerificar = async (e) => {
    e.preventDefault();
    setError('');
    setMensajeExito('');
    setDatosAlumno(null);
    setSeleccionadas([]);

    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/inscripcion/validar/${dni.trim()}`);
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'No se pudo validar el alumno');
      }

      setDatosAlumno(data.alumno);
      setMateriasAprobadas(data.materiasAprobadas);
      setReglasCorrelativas(data.reglasCorrelativas);
      setInscritasPrevias(data.materiasInscriptas);
    } catch (err) {
      setError(err.message);
    }
  };

  // Función que evalúa si el alumno cumple con las correlativas para una materia
  const verificarCorrelativa = (materia) => {
    // Si ya la aprobó o ya está inscripto
    if (materiasAprobadas.includes(materia.toLowerCase())) {
      return { habilitada: false, motivo: 'Materia ya aprobada' };
    }
    if (inscritasPrevias.includes(materia)) {
      return { habilitada: false, motivo: 'Ya estás inscripto en esta materia' };
    }

    // Buscar requisitos de esta materia
    const requisitos = reglasCorrelativas
      .filter(r => r.materia_objetivo.toLowerCase() === materia.toLowerCase())
      .map(r => r.materia_requerida);

    for (let req of requisitos) {
      if (!materiasAprobadas.includes(req.toLowerCase())) {
        return { habilitada: false, motivo: `Falta correlativa: ${req}` };
      }
    }

    return { habilitada: true, motivo: 'Habilitada' };
  };

  const handleCheckboxChange = (materia) => {
    if (seleccionadas.includes(materia)) {
      setSeleccionadas(seleccionadas.filter(m => m !== materia));
    } else {
      setSeleccionadas([...seleccionadas, materia]);
    }
  };

  const handleConfirmarInscripcion = async () => {
    try {
      const res = await fetch(`${import.meta.env.VITE_API_URL || ''}/api/inscripcion/confirmar`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          dni: datosAlumno.dni,
          materiasSeleccionadas: seleccionadas
        })
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error);

      setMensajeExito('¡Inscripción registrada correctamente!');
      setInscritasPrevias([...inscritasPrevias, ...seleccionadas]);
      setSeleccionadas([]);
    } catch (err) {
      alert(err.message);
    }
  };

  return (
    <div style={{ maxWidth: '750px', margin: '20px auto', background: '#fff', padding: '25px', borderRadius: '8px', border: '1px solid #ddd' }}>
      <h3 style={{ marginTop: 0 }}>Formulario de Inscripción a Materias</h3>

      <form onSubmit={handleVerificar} style={{ display: 'flex', gap: '10px', marginBottom: '20px' }}>
        <input
          type="text"
          placeholder="Ingrese D.N.I. del Alumno..."
          value={dni}
          onChange={e => setDni(e.target.value)}
          required
          style={{ padding: '8px', width: '250px', fontSize: '15px' }}
        />
        <button type="submit" style={{ padding: '8px 16px', background: '#0066cc', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
          Verificar Estado
        </button>
      </form>

      {error && (
        <div style={{ background: '#f8d7da', color: '#721c24', padding: '12px', borderRadius: '4px', marginBottom: '15px' }}>
          <strong>Atención:</strong> {error}
        </div>
      )}

      {mensajeExito && (
        <div style={{ background: '#d4edda', color: '#155724', padding: '12px', borderRadius: '4px', marginBottom: '15px' }}>
          {mensajeExito}
        </div>
      )}

      {datosAlumno && (
        <div>
          <div style={{ background: '#e9ecef', padding: '12px', borderRadius: '6px', marginBottom: '20px' }}>
            <p style={{ margin: '4px 0' }}><strong>Alumno:</strong> {datosAlumno.alumno}</p>
            <p style={{ margin: '4px 0' }}><strong>D.N.I.:</strong> {datosAlumno.dni}</p>
            <p style={{ margin: '4px 0', color: 'green' }}><strong>Estado de Cuota:</strong> Al día ✅</p>
          </div>

          <h4>Selecciona las materias a cursar:</h4>
          <table border="1" cellPadding="8" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '20px' }}>
            <thead>
              <tr style={{ background: '#f0f0f0' }}>
                <th style={{ width: '40px' }}>Inscribir</th>
                <th>Materia</th>
                <th>Estado de Correlatividad</th>
              </tr>
            </thead>
            <tbody>
              {MATERIAS_OFERTADAS.map((mat, idx) => {
                const { habilitada, motivo } = verificarCorrelativa(mat);
                return (
                  <tr key={idx} style={{ background: habilitada ? '#fff' : '#f9f9f9' }}>
                    <td align="center">
                      <input
                        type="checkbox"
                        disabled={!habilitada}
                        checked={seleccionadas.includes(mat)}
                        onChange={() => handleCheckboxChange(mat)}
                      />
                    </td>
                    <td><strong>{mat}</strong></td>
                    <td style={{ color: habilitada ? '#28a745' : '#dc3545', fontSize: '14px' }}>
                      {habilitada ? '✅ Habilitado para cursar' : `⛔ ${motivo}`}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>

          <button
            onClick={handleConfirmarInscripcion}
            disabled={seleccionadas.length === 0}
            style={{
              padding: '10px 20px',
              background: seleccionadas.length > 0 ? '#28a745' : '#ccc',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: seleccionadas.length > 0 ? 'pointer' : 'not-allowed',
              fontSize: '15px',
              fontWeight: 'bold'
            }}>
            Confirmar Inscripción ({seleccionadas.length})
          </button>
        </div>
      )}
    </div>
  );
}
