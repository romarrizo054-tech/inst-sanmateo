const express = require('express');
const cors = require('cors');
const mysql = require('mysql2/promise');
const path = require('path');

const app = express();

// ==========================================
// CONFIGURACIÓN DE CORS Y PARSER
// ==========================================
const RENDER_URL = process.env.RENDER_EXTERNAL_URL || 'https://inst-sanmateo.onrender.com';

const origenesPermitidos = [
  'https://inst-sanmateo.onrender.com',
  'http://localhost:3000',
  'http://localhost:3001',
  'http://localhost:5173'
];

app.use(cors({
  origin: (origin, callback) => {
    // Permite peticiones sin origen (como apps móviles, Postman o el mismo servidor)
    if (!origin || origenesPermitidos.includes(origin)) {
      return callback(null, true);
    }
    return callback(null, true); // Permite acceso general si cambia de subdominio
  },
  credentials: true
}));

app.use(express.json());

function validarClaveSecretaria(clave) {
  const claveConfigurada = process.env.ADMIN_SECRET;
  return Boolean(claveConfigurada && clave && clave === claveConfigurada);
}

function requiereSecretaria(req, res, next) {
  if (!process.env.ADMIN_SECRET) {
    return res.status(503).json({ error: 'Acceso de secretaría no está configurado' });
  }
  if (!validarClaveSecretaria(req.get('x-admin-key'))) {
    return res.status(401).json({ error: 'Acceso no autorizado' });
  }
  next();
}

app.post('/api/secretaria/auth', (req, res) => {
  if (!process.env.ADMIN_SECRET) {
    return res.status(503).json({ error: 'Acceso de secretaría no está configurado' });
  }
  if (!validarClaveSecretaria(req.body.adminKey)) {
    return res.status(401).json({ error: 'Clave incorrecta' });
  }
  res.json({ message: 'Acceso autorizado' });
});

// ==========================================
// CONEXIÓN A LA BASE DE DATOS (TIDB CLOUD)
// ==========================================
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  port: Number(process.env.DB_PORT || 4000),
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME || 'libro_matriz',
  ssl: {
    minVersion: 'TLSv1.2',
    rejectUnauthorized: false
  },
  waitForConnections: true,
  connectionLimit: 10
});

pool.getConnection()
  .then(conn => {
    console.log('✅ Conectado exitosamente a la base de datos TiDB Cloud');
    conn.release();
  })
  .catch(err => {
    console.error('❌ Error de conexión a TiDB Cloud:', err.message);
  });

// ==========================================
// 1. ENDPOINTS DE ALUMNOS Y LIBRO MATRIZ
// ==========================================

// Guardar o Actualizar Ficha Completa del Alumno
app.post('/api/alumnos', requiereSecretaria, async (req, res) => {
  let connection;
  try {
    connection = await pool.getConnection();
    await connection.beginTransaction();

    const {
      dni,
      alumno,
      domicilio,
      genero,
      fecha_nacimiento,
      edad,
      carrera,
      turno,
      anio_cursado,
      nacido_en,
      el_dia,
      ingreso_con_certificado,
      expedido_por,
      plan_estudios,
      materias,
      cuota_al_dia
    } = req.body;

    if (!dni || !alumno) {
      return res.status(400).json({ error: 'El DNI y el Nombre/Apellido son obligatorios' });
    }

    const queryAlumno = `
      INSERT INTO alumnos (
        dni, alumno, domicilio, genero, fecha_nacimiento, edad, carrera, turno, anio_cursado,
        nacido_en, el_dia, ingreso_con_certificado, expedido_por, plan_estudios, cuota_al_dia
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON DUPLICATE KEY UPDATE
        alumno = VALUES(alumno),
        domicilio = VALUES(domicilio),
        genero = VALUES(genero),
        fecha_nacimiento = VALUES(fecha_nacimiento),
        edad = VALUES(edad),
        carrera = VALUES(carrera),
        turno = VALUES(turno),
        anio_cursado = VALUES(anio_cursado),
        nacido_en = VALUES(nacido_en),
        el_dia = VALUES(el_dia),
        ingreso_con_certificado = VALUES(ingreso_con_certificado),
        expedido_por = VALUES(expedido_por),
        plan_estudios = VALUES(plan_estudios),
        cuota_al_dia = VALUES(cuota_al_dia)
    `;

    const fechaNac = fecha_nacimiento && String(fecha_nacimiento).trim() !== '' 
      ? fecha_nacimiento 
      : (el_dia && String(el_dia).trim() !== '' ? el_dia : null);

    await connection.query(queryAlumno, [
      dni.trim(),
      alumno.trim(),
      domicilio || null,
      genero || null,
      fechaNac,
      edad ? parseInt(edad) : null,
      carrera || null,
      turno || null,
      anio_cursado || null,
      nacido_en || null,
      fechaNac,
      ingreso_con_certificado || null,
      expedido_por || null,
      plan_estudios || null,
      cuota_al_dia !== undefined ? (cuota_al_dia ? 1 : 0) : 1
    ]);

    // Limpiar notas previas y reinsertar
    await connection.query('DELETE FROM calificaciones WHERE alumno_dni = ?', [dni.trim()]);

    const materiasValidas = (materias || []).filter(
      m => m.nota_num !== '' && m.nota_num !== null && !isNaN(m.nota_num)
    );

    if (materiasValidas.length > 0) {
      const queryNotas = `
        INSERT INTO calificaciones (alumno_dni, anio_carrera, materia, nota_num, nota_letras, libro_acta, folio_acta, fecha_examen, condicion)
        VALUES ?
      `;
      const values = materiasValidas.map(m => [
        dni.trim(),
        m.anio_carrera,
        m.materia,
        parseFloat(m.nota_num),
        m.nota_letras || '',
        m.libro_acta || '',
        m.folio_acta || '',
        m.fecha_examen && String(m.fecha_examen).trim() !== '' ? m.fecha_examen : null,
        m.condicion || ''
      ]);
      await connection.query(queryNotas, [values]);
    }

    await connection.commit();
    res.status(201).json({ message: 'Ficha guardada exitosamente' });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Error al guardar alumno:', error);
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// Buscar Alumno y Ficha por DNI
app.get('/api/alumnos/:dni', requiereSecretaria, async (req, res) => {
  try {
    const dni = req.params.dni.trim();
    const [alumnos] = await pool.query('SELECT * FROM alumnos WHERE dni = ?', [dni]);
    if (alumnos.length === 0) {
      return res.status(404).json({ message: 'Alumno no encontrado' });
    }

    const [materias] = await pool.query(
      'SELECT * FROM calificaciones WHERE alumno_dni = ? ORDER BY id ASC',
      [dni]
    );

    res.json({ ...alumnos[0], materias });
  } catch (error) {
    console.error('Error al buscar alumno:', error);
    res.status(500).json({ error: error.message });
  }
});

// Actualizar Cuota (Secretaría)
app.patch('/api/alumnos/:dni/cuota', requiereSecretaria, async (req, res) => {
  try {
    const { dni } = req.params;
    const { cuota_al_dia } = req.body;

    await pool.query(
      'UPDATE alumnos SET cuota_al_dia = ? WHERE dni = ?',
      [cuota_al_dia ? 1 : 0, dni.trim()]
    );

    res.json({ message: 'Cuota actualizada correctamente', cuota_al_dia: cuota_al_dia ? 1 : 0 });
  } catch (error) {
    console.error('Error al actualizar cuota:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 2. ENDPOINTS DE INSCRIPCIÓN Y SECRETARÍA
// ==========================================

// Validar requisitos para el link de inscripción del alumno
app.get('/api/inscripcion/validar/:dni', async (req, res) => {
  try {
    const dni = req.params.dni.trim();
    const [alumnoRows] = await pool.query('SELECT dni, alumno, cuota_al_dia FROM alumnos WHERE dni = ?', [dni]);
    
    if (alumnoRows.length === 0) {
      return res.status(404).json({ error: 'El D.N.I. ingresado no existe en el padrón de alumnos' });
    }

    const alumno = alumnoRows[0];
    if (!alumno.cuota_al_dia) {
      return res.status(403).json({ error: 'Registra deuda de cuotas. Por favor, regularice su situación en administración para inscribirse.' });
    }

    // Consultar materias aprobadas (nota >= 4 o condición P/R)
    const [calificaciones] = await pool.query(
      "SELECT materia FROM calificaciones WHERE alumno_dni = ? AND (nota_num >= 4 OR condicion IN ('P', 'R'))",
      [dni]
    );
    const materiasAprobadas = calificaciones.map(c => c.materia.trim().toLowerCase());

    const [reglasCorrelativas] = await pool.query('SELECT materia_objetivo, materia_requerida FROM correlativas');
    const [yaInscripto] = await pool.query('SELECT materia FROM inscripciones WHERE alumno_dni = ?', [dni]);

    res.json({
      alumno,
      materiasAprobadas,
      reglasCorrelativas,
      materiasInscriptas: yaInscripto.map(i => i.materia)
    });
  } catch (error) {
    console.error('Error en validación de inscripción:', error);
    res.status(500).json({ error: error.message });
  }
});

// Confirmar materias elegidas por el alumno
app.post('/api/inscripcion/confirmar', async (req, res) => {
  const connection = await pool.getConnection();
  try {
    const { dni, materiasSeleccionadas } = req.body;
    if (!dni || !materiasSeleccionadas || materiasSeleccionadas.length === 0) {
      return res.status(400).json({ error: 'Debe seleccionar al menos una materia' });
    }

    await connection.beginTransaction();
    const values = materiasSeleccionadas.map(m => [dni.trim(), m]);
    await connection.query('INSERT INTO inscripciones (alumno_dni, materia) VALUES ?', [values]);

    await connection.commit();
    res.status(201).json({ message: 'Inscripción confirmada con éxito' });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Error al confirmar inscripción:', error);
    res.status(500).json({ error: error.message });
  } finally {
    if (connection) connection.release();
  }
});

// Ver padrón de inscriptos para el panel de secretaría
app.get('/api/secretaria/inscriptos', requiereSecretaria, async (req, res) => {
  try {
    const query = `
      SELECT 
        i.id,
        i.materia,
        i.fecha_inscripcion,
        a.dni,
        a.alumno
      FROM inscripciones i
      JOIN alumnos a ON i.alumno_dni = a.dni
      ORDER BY i.materia ASC, a.alumno ASC
    `;
    const [rows] = await pool.query(query);
    res.json(rows);
  } catch (error) {
    console.error('Error al consultar inscriptos:', error);
    res.status(500).json({ error: error.message });
  }
});

// Ver alumnos cargados en el libro matriz
app.get('/api/secretaria/alumnos', requiereSecretaria, async (req, res) => {
  try {
    const [rows] = await pool.query(`
      SELECT dni, alumno, carrera, turno, anio_cursado, cuota_al_dia
      FROM alumnos
      ORDER BY alumno ASC
    `);
    res.json(rows);
  } catch (error) {
    console.error('Error al consultar alumnos:', error);
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 3. ARCHIVOS ESTÁTICOS DEL FRONTEND
// ==========================================
const frontendDist = path.resolve(__dirname, '../frontend/dist');
app.use(express.static(frontendDist));
app.get(/.*/, (_req, res) => res.sendFile(path.join(frontendDist, 'index.html')));

// ==========================================
// INICIO DEL SERVIDOR
// ==========================================
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log('==========================================');
  console.log(`🚀 Servidor backend activo en puerto ${PORT}`);
  console.log(`🌐 URL Pública: ${RENDER_URL}`);
  console.log('==========================================');
});
