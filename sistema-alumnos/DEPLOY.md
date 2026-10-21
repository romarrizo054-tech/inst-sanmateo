# Despliegue en Render + TiDB Cloud

El servicio de Render compila el frontend Vite y sirve tanto la página como la API Express desde el mismo dominio. Render detecta `render.yaml` al conectar el repositorio.

## Pasos

1. Sube la carpeta `sistema-alumnos` a un repositorio Git y conéctalo a Render como Blueprint. Render solicitará `DB_HOST`, `DB_USER`, `DB_PASSWORD` y `ADMIN_SECRET`. Define `ADMIN_SECRET` como una contraseña larga y única; no la pongas en el código ni en el repositorio.
2. En TiDB Cloud crea un clúster compatible con MySQL y una base `libro_matriz`. Copia el host, usuario, contraseña y puerto de la pantalla de conexión. TiDB Cloud suele usar TLS; el backend exige TLS 1.2 o superior.
3. Carga en TiDB el esquema y los datos del sistema actual antes de abrir la web. El proyecto no incluye un archivo SQL de esquema, así que hay que exportarlo desde la base MySQL existente (tablas `alumnos`, `calificaciones`, `correlativas` e `inscripciones`).
4. Espera el despliegue de Render y abre la URL que asigne.

La URL pública abre solo el panel de inscripción para alumnos. El personal entra en `/secretaria` e ingresa `ADMIN_SECRET`. La API también exige esa clave para consultar inscriptos, ver el padrón o las fichas, cambiar cuotas y guardar datos del libro matriz.

No subas contraseñas ni archivos `.env` al repositorio. La clave que antes estaba escrita en el código fue retirada; si era una clave real, rótala en MySQL.
