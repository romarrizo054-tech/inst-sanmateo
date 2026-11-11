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

const cursosIniciales = [
  'Comunicación y TIC',
  'Primeros Auxilios',
  'Bacteriología y Prep. De Mater.',
  'Organización y Gestión de las I.S.',
  'Inmunología',
  'Biología y Genética',
  'Procedimientos Específicos',
  'Inglés Técnico'
];

const materiasIniciales = [
  ['Estado Sociedad y Cultura', 'PRIMER AÑO'],
  ['Física y Matemática', 'PRIMER AÑO'],
  ['Anatomía, Histología y Fisiología', 'PRIMER AÑO'],
  ['Química Gral., Orgánica e Inorg.', 'PRIMER AÑO'],
  ['Fundamentos Básicos de Labor.', 'PRIMER AÑO'],
  ['Actitud y Ética Profesional', 'PRIMER AÑO'],
  ['Bioquímica Clínica', 'PRIMER AÑO'],
  ['Práctica de Bioquímica Clínica I', 'PRIMER AÑO'],
  ['Hematología y Hemoterapia', 'PRIMER AÑO'],
  ['Higiene y Seguridad en el Trabaj.', 'PRIMER AÑO'],
  ['Comunicación y TIC', 'SEGUNDO AÑO'],
  ['Primeros Auxilios', 'SEGUNDO AÑO'],
  ['Bacteriología y Prep. De Mater.', 'SEGUNDO AÑO'],
  ['Organización y Gestión de las I.S.', 'SEGUNDO AÑO'],
  ['Inmunología', 'SEGUNDO AÑO'],
  ['Biología y Genética', 'SEGUNDO AÑO'],
  ['Procedimientos Específicos', 'SEGUNDO AÑO'],
  ['Inglés Técnico', 'SEGUNDO AÑO']
];

const ofertasSchemaReady = (async () => {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS ofertas_academicas (
      id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      tipo VARCHAR(20) NOT NULL,
      materia VARCHAR(255) NOT NULL,
      anio_carrera VARCHAR(100) NULL,
      fecha_inicio DATE NULL,
      fecha_fin DATE NULL,
      fecha_examen DATE NULL,
      horario VARCHAR(80) NULL,
      activa TINYINT(1) NOT NULL DEFAULT 1,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS inscripciones_ofertas (
      id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      alumno_dni VARCHAR(30) NOT NULL,
      oferta_id BIGINT NOT NULL,
      fecha_inscripcion TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uq_alumno_oferta (alumno_dni, oferta_id),
      KEY idx_oferta_id (oferta_id)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS alumnos_bajas (
      dni VARCHAR(30) NOT NULL PRIMARY KEY,
      motivo VARCHAR(255) NULL,
      fecha_baja TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS materias_catalogo (
      id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      materia VARCHAR(255) NOT NULL,
      anio_carrera VARCHAR(100) NOT NULL,
      UNIQUE KEY uq_materia_anio (materia, anio_carrera)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS app_config (
      clave VARCHAR(100) NOT NULL PRIMARY KEY,
      valor VARCHAR(255) NULL
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS pagos_cuotas (
      id BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
      alumno_dni VARCHAR(30) NOT NULL,
      periodo CHAR(7) NOT NULL,
      importe DECIMAL(12, 2) NOT NULL,
      medio VARCHAR(20) NOT NULL,
      fecha_pago DATE NOT NULL,
      referencia VARCHAR(120) NULL,
      observaciones VARCHAR(500) NULL,
      created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
      KEY idx_pagos_periodo (periodo),
      KEY idx_pagos_alumno_periodo (alumno_dni, periodo)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS cuotas_periodos (
      periodo CHAR(7) NOT NULL PRIMARY KEY,
      importe DECIMAL(12, 2) NOT NULL,
      updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
    )
  `);

  const [rows] = await pool.query('SELECT COUNT(*) AS total FROM ofertas_academicas');
  if (Number(rows[0].total) === 0) {
    const values = cursosIniciales.map(materia => ['CURSO', materia, 'SEGUNDO AÑO']);
    await pool.query(
      'INSERT INTO ofertas_academicas (tipo, materia, anio_carrera) VALUES ?',
      [values]
    );
  }

  const [materiasSeed] = await pool.query(
    'SELECT clave FROM app_config WHERE clave = ?',
    ['materias_catalogo_inicializado']
  );
  if (materiasSeed.length === 0) {
    await pool.query(
      'INSERT IGNORE INTO materias_catalogo (materia, anio_carrera) VALUES ?',
      [materiasIniciales]
    );
    await pool.query(
      'INSERT INTO app_config (clave, valor) VALUES (?, ?)',
      ['materias_catalogo_inicializado', '1']
    );
  }
})();

function periodoActualCuota() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Argentina/Buenos_Aires', year: 'numeric', month: '2-digit'
  }).format(new Date()).slice(0, 7);
}

function periodosEntre(inicio, fin) {
  const periodos = [];
  let [anio, mes] = inicio.split('-').map(Number);
  const [anioFin, mesFin] = fin.split('-').map(Number);
  while (anio < anioFin || (anio === anioFin && mes <= mesFin)) {
    periodos.push(`${anio}-${String(mes).padStart(2, '0')}`);
    if (++mes === 13) { mes = 1; anio += 1; }
  }
  return periodos;
}

async function obtenerEstadoCuota(dni, executor = pool) {
  const [config] = await executor.query('SELECT valor FROM app_config WHERE clave = ?', ['cuotas_periodo_inicio']);
  if (!config.length || !config[0].valor) return null;
  const inicio = String(config[0].valor);
  const periodos = periodosEntre(inicio, periodoActualCuota());
  const [tarifas] = await executor.query(
    'SELECT periodo, importe FROM cuotas_periodos WHERE periodo BETWEEN ? AND ?', [inicio, periodoActualCuota()]
  );
  const importes = new Map(tarifas.map(row => [row.periodo, Number(row.importe)]));
  if (periodos.some(periodo => !importes.has(periodo))) return 0;
  const [pagos] = await executor.query(`
    SELECT periodo, COALESCE(SUM(importe), 0) AS total
    FROM pagos_cuotas WHERE alumno_dni = ? AND periodo BETWEEN ? AND ? GROUP BY periodo
  `, [dni, inicio, periodoActualCuota()]);
  const pagado = new Map(pagos.map(row => [row.periodo, Number(row.total)]));
  return periodos.every(periodo => (pagado.get(periodo) || 0) >= importes.get(periodo)) ? 1 : 0;
}

async function actualizarEstadoCuota(dni, executor = pool) {
  const estado = await obtenerEstadoCuota(dni, executor);
  if (estado !== null) await executor.query('UPDATE alumnos SET cuota_al_dia = ? WHERE dni = ?', [estado, dni]);
  return estado;
}

async function recalcularEstadosCuotaTodos() {
  const [alumnos] = await pool.query('SELECT dni FROM alumnos');
  for (const alumno of alumnos) await actualizarEstadoCuota(alumno.dni);
}

ofertasSchemaReady
  .then(() => pool.getConnection())
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
    await ofertasSchemaReady;
    const [alumnos] = await pool.query(`
      SELECT a.*, IF(b.dni IS NULL, 0, 1) AS dado_de_baja
      FROM alumnos a
      LEFT JOIN alumnos_bajas b ON b.dni = a.dni
      WHERE a.dni = ?
    `, [dni]);
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

app.patch('/api/secretaria/alumnos/:dni/estado', requiereSecretaria, async (req, res) => {
  try {
    await ofertasSchemaReady;
    const dni = req.params.dni.trim();
    if (typeof req.body.dadoDeBaja !== 'boolean') {
      return res.status(400).json({ error: 'Indica si el alumno queda dado de baja' });
    }
    const [alumnos] = await pool.query('SELECT dni FROM alumnos WHERE dni = ?', [dni]);
    if (!alumnos.length) return res.status(404).json({ error: 'Alumno no encontrado' });

    if (req.body.dadoDeBaja) {
      await pool.query(`
        INSERT INTO alumnos_bajas (dni) VALUES (?)
        ON DUPLICATE KEY UPDATE fecha_baja = CURRENT_TIMESTAMP
      `, [dni]);
    } else {
      await pool.query('DELETE FROM alumnos_bajas WHERE dni = ?', [dni]);
    }
    res.json({ message: req.body.dadoDeBaja ? 'Alumno dado de baja' : 'Alumno reactivado', dadoDeBaja: req.body.dadoDeBaja });
  } catch (error) {
    console.error('Error al cambiar el estado del alumno:', error);
    res.status(500).json({ error: 'No se pudo cambiar el estado del alumno' });
  }
});

app.delete('/api/secretaria/alumnos/:dni', requiereSecretaria, async (req, res) => {
  let connection;
  try {
    await ofertasSchemaReady;
    const dni = req.params.dni.trim();
    const [alumnos] = await pool.query('SELECT dni FROM alumnos WHERE dni = ?', [dni]);
    if (!alumnos.length) return res.status(404).json({ error: 'Alumno no encontrado' });

    connection = await pool.getConnection();
    await connection.beginTransaction();
    await connection.query('DELETE FROM calificaciones WHERE alumno_dni = ?', [dni]);
    await connection.query('DELETE FROM inscripciones WHERE alumno_dni = ?', [dni]);
    await connection.query('DELETE FROM inscripciones_ofertas WHERE alumno_dni = ?', [dni]);
    await connection.query('DELETE FROM alumnos_bajas WHERE dni = ?', [dni]);
    await connection.query('DELETE FROM alumnos WHERE dni = ?', [dni]);
    await connection.commit();
    res.json({ message: 'Alumno y sus registros académicos eliminados' });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Error al eliminar alumno:', error);
    res.status(500).json({ error: 'No se pudo eliminar el alumno' });
  } finally {
    if (connection) connection.release();
  }
});

// ==========================================
// 2. ENDPOINTS DE INSCRIPCIÓN Y SECRETARÍA
// ==========================================

// Oferta visible para alumnos: solo cursos y mesas vigentes.
app.get('/api/inscripcion/ofertas', async (_req, res) => {
  try {
    await ofertasSchemaReady;
    const [rows] = await pool.query(`
      SELECT id, tipo, materia, anio_carrera, fecha_inicio, fecha_fin, fecha_examen, horario
      FROM ofertas_academicas
      WHERE activa = 1
      ORDER BY tipo ASC, materia ASC, fecha_examen ASC
    `);
    res.json(rows);
  } catch (error) {
    console.error('Error al consultar cursos y mesas:', error);
    res.status(500).json({ error: 'No se pudo cargar la oferta académica' });
  }
});

// Gestión de cursos y mesas: todas las operaciones requieren clave de secretaría.
app.get('/api/secretaria/ofertas', requiereSecretaria, async (_req, res) => {
  try {
    await ofertasSchemaReady;
    const [rows] = await pool.query(`
      SELECT id, tipo, materia, anio_carrera, fecha_inicio, fecha_fin, fecha_examen, horario, activa
      FROM ofertas_academicas
      ORDER BY activa DESC, tipo ASC, materia ASC, fecha_examen ASC
    `);
    res.json(rows);
  } catch (error) {
    console.error('Error al consultar la oferta académica:', error);
    res.status(500).json({ error: 'No se pudo cargar la oferta académica' });
  }
});

app.post('/api/secretaria/ofertas', requiereSecretaria, async (req, res) => {
  try {
    await ofertasSchemaReady;
    const { tipo, materia, anio_carrera, fecha_inicio, fecha_fin, fecha_examen, horario } = req.body;
    if (!['CURSO', 'MESA_EXAMEN'].includes(tipo) || !String(materia || '').trim()) {
      return res.status(400).json({ error: 'Indica si es curso o mesa y el nombre de la materia/curso' });
    }
    if (tipo === 'MESA_EXAMEN' && !fecha_examen) {
      return res.status(400).json({ error: 'La mesa de examen debe tener fecha' });
    }
    const [result] = await pool.query(`
      INSERT INTO ofertas_academicas
        (tipo, materia, anio_carrera, fecha_inicio, fecha_fin, fecha_examen, horario)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [
      tipo,
      String(materia).trim(),
      anio_carrera || null,
      fecha_inicio || null,
      fecha_fin || null,
      fecha_examen || null,
      horario || null
    ]);
    res.status(201).json({ id: result.insertId, message: 'Oferta académica creada' });
  } catch (error) {
    console.error('Error al crear curso o mesa:', error);
    res.status(500).json({ error: 'No se pudo guardar la oferta académica' });
  }
});

app.patch('/api/secretaria/ofertas/:id/estado', requiereSecretaria, async (req, res) => {
  try {
    await ofertasSchemaReady;
    if (typeof req.body.activa !== 'boolean') {
      return res.status(400).json({ error: 'El estado debe ser activo o inactivo' });
    }
    const [result] = await pool.query(
      'UPDATE ofertas_academicas SET activa = ? WHERE id = ?',
      [req.body.activa ? 1 : 0, req.params.id]
    );
    if (!result.affectedRows) return res.status(404).json({ error: 'Oferta académica no encontrada' });
    res.json({ message: 'Estado actualizado' });
  } catch (error) {
    console.error('Error al cambiar estado de la oferta:', error);
    res.status(500).json({ error: 'No se pudo actualizar el estado' });
  }
});

app.get('/api/secretaria/materias', requiereSecretaria, async (_req, res) => {
  try {
    await ofertasSchemaReady;
    const [rows] = await pool.query(`
      SELECT id, materia, anio_carrera
      FROM materias_catalogo
      ORDER BY anio_carrera ASC, materia ASC
    `);
    res.json(rows);
  } catch (error) {
    console.error('Error al consultar materias:', error);
    res.status(500).json({ error: 'No se pudo cargar el catálogo de materias' });
  }
});

app.post('/api/secretaria/materias', requiereSecretaria, async (req, res) => {
  try {
    await ofertasSchemaReady;
    const materia = String(req.body.materia || '').trim();
    const anioCarrera = String(req.body.anio_carrera || '').trim();
    if (!materia || !anioCarrera) {
      return res.status(400).json({ error: 'Completa el nombre de la materia y el año' });
    }
    const [result] = await pool.query(
      'INSERT INTO materias_catalogo (materia, anio_carrera) VALUES (?, ?)',
      [materia, anioCarrera]
    );
    res.status(201).json({ id: result.insertId, message: 'Materia agregada' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Ya existe esa materia para ese año' });
    console.error('Error al agregar materia:', error);
    res.status(500).json({ error: 'No se pudo agregar la materia' });
  }
});

app.put('/api/secretaria/materias/:id', requiereSecretaria, async (req, res) => {
  try {
    await ofertasSchemaReady;
    const materia = String(req.body.materia || '').trim();
    const anioCarrera = String(req.body.anio_carrera || '').trim();
    if (!materia || !anioCarrera) {
      return res.status(400).json({ error: 'Completa el nombre de la materia y el año' });
    }
    const [result] = await pool.query(
      'UPDATE materias_catalogo SET materia = ?, anio_carrera = ? WHERE id = ?',
      [materia, anioCarrera, req.params.id]
    );
    if (!result.affectedRows) {
      const [existing] = await pool.query('SELECT id FROM materias_catalogo WHERE id = ?', [req.params.id]);
      if (!existing.length) return res.status(404).json({ error: 'Materia no encontrada' });
    }
    res.json({ message: 'Materia actualizada' });
  } catch (error) {
    if (error.code === 'ER_DUP_ENTRY') return res.status(409).json({ error: 'Ya existe esa materia para ese año' });
    console.error('Error al actualizar materia:', error);
    res.status(500).json({ error: 'No se pudo actualizar la materia' });
  }
});

app.delete('/api/secretaria/materias/:id', requiereSecretaria, async (req, res) => {
  try {
    await ofertasSchemaReady;
    const [result] = await pool.query('DELETE FROM materias_catalogo WHERE id = ?', [req.params.id]);
    if (!result.affectedRows) return res.status(404).json({ error: 'Materia no encontrada' });
    res.json({ message: 'Materia eliminada del catálogo; las notas históricas se conservaron' });
  } catch (error) {
    console.error('Error al eliminar materia:', error);
    res.status(500).json({ error: 'No se pudo eliminar la materia' });
  }
});

app.get('/api/secretaria/cuotas/configuracion', requiereSecretaria, async (req, res) => {
  try {
    await ofertasSchemaReady;
    const [[inicio], [periodos]] = await Promise.all([
      pool.query('SELECT valor FROM app_config WHERE clave = ?', ['cuotas_periodo_inicio']),
      pool.query('SELECT periodo, importe FROM cuotas_periodos ORDER BY periodo DESC')
    ]);
    res.json({ periodoInicio: inicio[0]?.valor || '', periodos });
  } catch (error) {
    console.error('Error al cargar configuración de cuotas:', error);
    res.status(500).json({ error: 'No se pudo cargar la configuración de cuotas' });
  }
});

app.put('/api/secretaria/cuotas/configuracion/inicio', requiereSecretaria, async (req, res) => {
  try {
    await ofertasSchemaReady;
    const periodo = String(req.body.periodoInicio || '').trim();
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodo) || periodo > periodoActualCuota()) {
      return res.status(400).json({ error: 'Selecciona un mes de inicio válido, que no sea futuro' });
    }
    await pool.query(`
      INSERT INTO app_config (clave, valor) VALUES ('cuotas_periodo_inicio', ?)
      ON DUPLICATE KEY UPDATE valor = VALUES(valor)
    `, [periodo]);
    await recalcularEstadosCuotaTodos();
    res.json({ message: 'Mes inicial actualizado y estados recalculados', periodoInicio: periodo });
  } catch (error) {
    console.error('Error al guardar inicio de cuotas:', error);
    res.status(500).json({ error: 'No se pudo guardar el mes inicial' });
  }
});

app.put('/api/secretaria/cuotas/periodos/:periodo', requiereSecretaria, async (req, res) => {
  try {
    await ofertasSchemaReady;
    const periodo = String(req.params.periodo || '').trim();
    const importe = Number(req.body.importe);
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodo)) return res.status(400).json({ error: 'Mes inválido' });
    if (!Number.isFinite(importe) || importe <= 0) return res.status(400).json({ error: 'El importe debe ser mayor que cero' });
    await pool.query(`
      INSERT INTO cuotas_periodos (periodo, importe) VALUES (?, ?)
      ON DUPLICATE KEY UPDATE importe = VALUES(importe)
    `, [periodo, importe]);
    await recalcularEstadosCuotaTodos();
    res.json({ message: 'Importe mensual guardado y estados recalculados' });
  } catch (error) {
    console.error('Error al guardar importe mensual:', error);
    res.status(500).json({ error: 'No se pudo guardar el importe mensual' });
  }
});

app.get('/api/secretaria/pagos-cuotas', requiereSecretaria, async (req, res) => {
  try {
    await ofertasSchemaReady;
    const periodo = String(req.query.periodo || '').trim();
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodo)) {
      return res.status(400).json({ error: 'Indica un período con formato AAAA-MM' });
    }
    const [rows] = await pool.query(`
      SELECT p.id, p.alumno_dni AS dni, a.alumno, p.periodo, p.importe, p.medio,
        p.fecha_pago, p.referencia, p.observaciones
      FROM pagos_cuotas p
      JOIN alumnos a ON a.dni = p.alumno_dni
      WHERE p.periodo = ?
      ORDER BY p.fecha_pago DESC, p.id DESC
    `, [periodo]);
    res.json(rows);
  } catch (error) {
    console.error('Error al consultar pagos de cuotas:', error);
    res.status(500).json({ error: 'No se pudo cargar el registro de pagos' });
  }
});

app.post('/api/secretaria/pagos-cuotas', requiereSecretaria, async (req, res) => {
  try {
    await ofertasSchemaReady;
    const dni = String(req.body.dni || '').trim();
    const periodo = String(req.body.periodo || '').trim();
    const importe = Number(req.body.importe);
    const medio = String(req.body.medio || '').trim().toUpperCase();
    const fechaPago = String(req.body.fecha_pago || '').trim();
    const referencia = String(req.body.referencia || '').trim();
    const observaciones = String(req.body.observaciones || '').trim();

    if (!dni) return res.status(400).json({ error: 'Ingresa el DNI del alumno' });
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(periodo)) {
      return res.status(400).json({ error: 'Selecciona un mes válido' });
    }
    if (!Number.isFinite(importe) || importe <= 0) {
      return res.status(400).json({ error: 'El importe debe ser mayor que cero' });
    }
    if (!['EFECTIVO', 'TRANSFERENCIA'].includes(medio)) {
      return res.status(400).json({ error: 'El medio debe ser efectivo o transferencia' });
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fechaPago)) {
      return res.status(400).json({ error: 'Ingresa una fecha de pago válida' });
    }

    const [alumnos] = await pool.query('SELECT dni FROM alumnos WHERE dni = ?', [dni]);
    if (!alumnos.length) return res.status(404).json({ error: 'No se encontró un alumno con ese DNI' });

    const [result] = await pool.query(`
      INSERT INTO pagos_cuotas
        (alumno_dni, periodo, importe, medio, fecha_pago, referencia, observaciones)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `, [dni, periodo, importe, medio, fechaPago, referencia || null, observaciones || null]);
    const cuotaAlDia = await actualizarEstadoCuota(dni);
    res.status(201).json({ id: result.insertId, message: 'Pago registrado', cuota_al_dia: cuotaAlDia });
  } catch (error) {
    console.error('Error al registrar pago de cuota:', error);
    res.status(500).json({ error: 'No se pudo registrar el pago' });
  }
});

// Validar requisitos para el link de inscripción del alumno
app.get('/api/inscripcion/validar/:dni', async (req, res) => {
  try {
    const dni = req.params.dni.trim();
    const [alumnoRows] = await pool.query('SELECT dni, alumno, cuota_al_dia FROM alumnos WHERE dni = ?', [dni]);
    
    if (alumnoRows.length === 0) {
      return res.status(404).json({ error: 'El D.N.I. ingresado no existe en el padrón de alumnos' });
    }

    const alumno = alumnoRows[0];
    const [bajas] = await pool.query('SELECT dni FROM alumnos_bajas WHERE dni = ?', [dni]);
    if (bajas.length) {
      return res.status(403).json({ error: 'El alumno está dado de baja. Comuníquese con secretaría.' });
    }
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
    await ofertasSchemaReady;
    const [ofertasInscriptas] = await pool.query(
      'SELECT oferta_id FROM inscripciones_ofertas WHERE alumno_dni = ?',
      [dni]
    );

    res.json({
      alumno,
      materiasAprobadas,
      reglasCorrelativas,
      materiasInscriptas: yaInscripto.map(i => i.materia),
      ofertasInscriptas: ofertasInscriptas.map(i => Number(i.oferta_id))
    });
  } catch (error) {
    console.error('Error en validación de inscripción:', error);
    res.status(500).json({ error: error.message });
  }
});

// Inscribir a un alumno en cursos o mesas activas y validar condiciones en servidor.
app.post('/api/inscripcion/confirmar-ofertas', async (req, res) => {
  let connection;
  try {
    await ofertasSchemaReady;
    const dni = String(req.body.dni || '').trim();
    const ofertaIds = [...new Set((req.body.ofertaIds || []).map(Number).filter(Number.isInteger))];
    if (!dni || ofertaIds.length === 0) {
      return res.status(400).json({ error: 'Selecciona al menos un curso o una mesa' });
    }

    const [alumnos] = await pool.query('SELECT dni, cuota_al_dia FROM alumnos WHERE dni = ?', [dni]);
    if (!alumnos.length) return res.status(404).json({ error: 'Alumno no encontrado en el padrón' });
    const [bajas] = await pool.query('SELECT dni FROM alumnos_bajas WHERE dni = ?', [dni]);
    if (bajas.length) return res.status(403).json({ error: 'El alumno está dado de baja' });
    if (!alumnos[0].cuota_al_dia) return res.status(403).json({ error: 'Debe regularizar las cuotas antes de inscribirse' });

    const [ofertas] = await pool.query(
      `SELECT id, tipo, materia FROM ofertas_academicas WHERE activa = 1 AND id IN (?)`,
      [ofertaIds]
    );
    if (ofertas.length !== ofertaIds.length) {
      return res.status(400).json({ error: 'Una o más opciones ya no están disponibles' });
    }

    const [calificaciones] = await pool.query(
      "SELECT materia FROM calificaciones WHERE alumno_dni = ? AND (nota_num >= 4 OR condicion IN ('P', 'R'))",
      [dni]
    );
    const aprobadas = new Set(calificaciones.map(row => row.materia.trim().toLowerCase()));
    const [correlativas] = await pool.query('SELECT materia_objetivo, materia_requerida FROM correlativas');

    for (const oferta of ofertas) {
      const materiaNormalizada = oferta.materia.trim().toLowerCase();
      if (aprobadas.has(materiaNormalizada)) {
        return res.status(409).json({ error: `Ya tienes aprobada ${oferta.materia}` });
      }
      if (oferta.tipo === 'CURSO') {
        const faltante = correlativas.find(regla =>
          regla.materia_objetivo.trim().toLowerCase() === materiaNormalizada &&
          !aprobadas.has(regla.materia_requerida.trim().toLowerCase())
        );
        if (faltante) {
          return res.status(403).json({ error: `Te falta la correlativa ${faltante.materia_requerida} para ${oferta.materia}` });
        }
      }
    }

    connection = await pool.getConnection();
    await connection.beginTransaction();
    const values = ofertas.map(oferta => [dni, oferta.id]);
    await connection.query(`
      INSERT INTO inscripciones_ofertas (alumno_dni, oferta_id)
      VALUES ?
      ON DUPLICATE KEY UPDATE oferta_id = VALUES(oferta_id)
    `, [values]);
    await connection.commit();
    res.status(201).json({ message: 'Inscripción registrada', ofertasInscriptas: ofertaIds });
  } catch (error) {
    if (connection) await connection.rollback();
    console.error('Error al confirmar inscripción en cursos/mesas:', error);
    res.status(500).json({ error: 'No se pudo confirmar la inscripción' });
  } finally {
    if (connection) connection.release();
  }
});

// Confirmar materias elegidas por el alumno
app.post('/api/inscripcion/confirmar', async (req, res) => {
  let connection;
  try {
    await ofertasSchemaReady;
    const dni = String(req.body.dni || '').trim();
    const materiasSeleccionadas = [...new Set((req.body.materiasSeleccionadas || []).map(m => String(m).trim()).filter(Boolean))];
    if (!dni || materiasSeleccionadas.length === 0) {
      return res.status(400).json({ error: 'Debe seleccionar al menos una materia' });
    }

    const [alumnos] = await pool.query('SELECT cuota_al_dia FROM alumnos WHERE dni = ?', [dni]);
    if (!alumnos.length) return res.status(404).json({ error: 'Alumno no encontrado en el padrón' });
    const [bajas] = await pool.query('SELECT dni FROM alumnos_bajas WHERE dni = ?', [dni]);
    if (bajas.length) return res.status(403).json({ error: 'El alumno está dado de baja' });
    if (!alumnos[0].cuota_al_dia) return res.status(403).json({ error: 'Debe regularizar las cuotas antes de inscribirse' });

    const [ofertas] = await pool.query(
      'SELECT materia FROM ofertas_academicas WHERE tipo = \'CURSO\' AND activa = 1 AND materia IN (?)',
      [materiasSeleccionadas]
    );
    if (ofertas.length !== materiasSeleccionadas.length) {
      return res.status(400).json({ error: 'Una o más materias ya no están disponibles para inscripción' });
    }
    const [calificaciones] = await pool.query(
      "SELECT materia FROM calificaciones WHERE alumno_dni = ? AND (nota_num >= 4 OR condicion IN ('P', 'R'))",
      [dni]
    );
    const aprobadas = new Set(calificaciones.map(row => row.materia.trim().toLowerCase()));
    const [correlativas] = await pool.query('SELECT materia_objetivo, materia_requerida FROM correlativas');
    for (const materia of materiasSeleccionadas) {
      if (aprobadas.has(materia.toLowerCase())) {
        return res.status(409).json({ error: `Ya tienes aprobada ${materia}` });
      }
      const faltante = correlativas.find(regla =>
        regla.materia_objetivo.trim().toLowerCase() === materia.toLowerCase() &&
        !aprobadas.has(regla.materia_requerida.trim().toLowerCase())
      );
      if (faltante) return res.status(403).json({ error: `Te falta la correlativa ${faltante.materia_requerida} para ${materia}` });
    }

    connection = await pool.getConnection();

    await connection.beginTransaction();
    const values = materiasSeleccionadas.map(m => [dni, m]);
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
    await ofertasSchemaReady;
    const query = `
      SELECT 
        CONCAT('legacy-', i.id) AS id,
        'CURSO' AS tipo,
        i.materia,
        i.fecha_inscripcion,
        a.dni,
        a.alumno
      FROM inscripciones i
      JOIN alumnos a ON i.alumno_dni = a.dni
      UNION ALL
      SELECT
        CONCAT('oferta-', io.id) AS id,
        o.tipo,
        CONCAT(o.materia, IF(o.fecha_examen IS NOT NULL, CONCAT(' - ', DATE_FORMAT(o.fecha_examen, '%d/%m/%Y')), '')) AS materia,
        io.fecha_inscripcion,
        a.dni,
        a.alumno
      FROM inscripciones_ofertas io
      JOIN ofertas_academicas o ON o.id = io.oferta_id
      JOIN alumnos a ON a.dni = io.alumno_dni
      ORDER BY materia ASC, alumno ASC
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
    await ofertasSchemaReady;
    const paginaSolicitada = Math.max(1, Number.parseInt(req.query.pagina, 10) || 1);
    const porPagina = Math.min(100, Math.max(1, Number.parseInt(req.query.porPagina, 10) || 50));
    const [[{ total }]] = await pool.query('SELECT COUNT(*) AS total FROM alumnos');
    const pagina = Math.min(paginaSolicitada, Math.max(1, Math.ceil(Number(total) / porPagina)));
    const offset = (pagina - 1) * porPagina;
    const [rows] = await pool.query(`
        SELECT a.dni, a.alumno, a.carrera, a.turno, a.anio_cursado, a.cuota_al_dia,
          IF(b.dni IS NULL, 0, 1) AS dado_de_baja
        FROM alumnos a
        LEFT JOIN alumnos_bajas b ON b.dni = a.dni
        ORDER BY a.alumno ASC
        LIMIT ? OFFSET ?
      `, [porPagina, offset]);
    res.json({ alumnos: rows, total: Number(total), pagina, porPagina });
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
