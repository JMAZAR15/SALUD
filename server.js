// ========================================================
// Carga las variables de entorno desde el archivo .env
// ========================================================
require('dotenv').config();

// ========================================================
// Importa dependencias: Express, MySQL, Path, etc.
// ========================================================
const express = require('express');
const mysql = require('mysql2');
const path = require('path');
const session = require('express-session');
const querystring = require('querystring');
const fetch = global.fetch; // Node 18+ tiene fetch incorporado
const mysqlPromise = require('mysql2/promise');

const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
dayjs.extend(utc);
dayjs.extend(timezone);

const app = express();

// ========================================================
// Configura middleware: JSON, URL-encoded, archivos estáticos y sesión
// ========================================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

app.use(session({
    secret: process.env.SESSION_SECRET || 'secret_key',
    resave: false,
    saveUninitialized: true
}));

// ========================================================
// Conexión a MySQL usando variables de entorno (Callback)
// ========================================================
const connection = mysql.createConnection({
    host: process.env.DB_HOST,         // Ej: localhost
    user: process.env.DB_USER,         // Ej: root
    password: process.env.DB_PASSWORD, // Asegúrate de tener la contraseña en el .env
    database: process.env.DB_NAME      // Ej: SALOMEDB
});

connection.connect(err => {
    if (err) {
        console.error("❌ Error conectando a MySQL:", err);
        return;
    }
    console.log("✅ Conectado a MySQL");
});

// ========================================================
// Conexión a MySQL usando mysql2/promise (para operaciones asíncronas)
// ========================================================
const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
};

// ========================================================
// FUNCIONES MEJORADAS PARA GESTIÓN DE TOKENS DE FITBIT
// ========================================================

// Función para obtener el token desde la base de datos para un trabajador
async function getTokenFromDB(workerId) {
    const connectionPromise = await mysqlPromise.createConnection(dbConfig);
    try {
        const [rows] = await connectionPromise.execute(
            "SELECT access_token, refresh_token, expires_in, obtenido_en FROM tokens_fitbit WHERE trabajador_id = ?",
            [workerId]
        );
        return rows.length > 0 ? rows[0] : null;
    } catch (error) {
        console.error("Error al obtener token desde DB:", error);
        return null;
    } finally {
        await connectionPromise.end();
    }
}

// Función para refrescar el token usando el refresh_token
async function refreshAccessToken(refreshToken, workerId) {
    try {
        const clientId = process.env.FITBIT_CLIENT_ID;
        const clientSecret = process.env.FITBIT_CLIENT_SECRET;
        const tokenUrl = 'https://api.fitbit.com/oauth2/token';

        const params = new URLSearchParams();
        params.append('grant_type', 'refresh_token');
        params.append('refresh_token', refreshToken);

        const tokenResponse = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64')
            },
            body: params
        });
        
        if (!tokenResponse.ok) {
            try {
                const errorData = await tokenResponse.json();
                console.error("Error en respuesta de Fitbit:", errorData);
                throw new Error(`Error de Fitbit: ${tokenResponse.status} - ${JSON.stringify(errorData)}`);
            } catch (e) {
                // Si la respuesta no es JSON válido
                console.error("Error no procesable de Fitbit:", tokenResponse.status);
                throw new Error(`Error de Fitbit: ${tokenResponse.status} - ${await tokenResponse.text()}`);
            }
        }
        
        const tokenData = await tokenResponse.json();
        if (tokenData.access_token) {
            // Registra la fecha y hora de obtención del token
            const obtenido_en = new Date();
            // Actualiza el token en la base de datos
            const connectionPromise = await mysqlPromise.createConnection(dbConfig);
            try {
                const updateQuery = `
                    UPDATE tokens_fitbit 
                    SET access_token = ?, refresh_token = ?, expires_in = ?, obtenido_en = ? 
                    WHERE trabajador_id = ?
                `;
                await connectionPromise.execute(updateQuery, [
                    tokenData.access_token,
                    tokenData.refresh_token,
                    tokenData.expires_in,
                    obtenido_en,
                    workerId
                ]);
                
                console.log(`✅ Token actualizado para trabajador ${workerId}`);
                
                return {
                    access_token: tokenData.access_token,
                    refresh_token: tokenData.refresh_token,
                    expires_in: tokenData.expires_in,
                    obtenido_en
                };
            } finally {
                await connectionPromise.end();
            }
        } else {
            throw new Error("No se recibió access_token en la respuesta de refresco.");
        }
    } catch (error) {
        console.error("Error al refrescar token:", error);
        throw error;
    }
}

// Función para verificar si un token está próximo a expirar (margen de seguridad de 10 minutos)
function isTokenExpiringSoon(tokenData) {
    if (!tokenData || !tokenData.obtenido_en || !tokenData.expires_in) {
        return true; // Si falta algún dato, consideramos que debe refrescarse
    }
    
    const ahora = new Date();
    const obtenidoEn = new Date(tokenData.obtenido_en);
    const expiresInMs = tokenData.expires_in * 1000;
    const expirationTime = new Date(obtenidoEn.getTime() + expiresInMs);
    
    // Margen de seguridad: 10 minutos antes de que expire
    const safetyMarginMs = 10 * 60 * 1000;
    const shouldRefreshTime = new Date(expirationTime.getTime() - safetyMarginMs);
    
    const tokenExpired = ahora >= expirationTime;
    const tokenExpiringSoon = ahora >= shouldRefreshTime;
    
    if (tokenExpired) {
        console.log(`❌ Token expirado para trabajador. Expiró hace ${(ahora - expirationTime) / 1000} segundos`);
    } else if (tokenExpiringSoon) {
        console.log(`⚠️ Token próximo a expirar. Expira en ${(expirationTime - ahora) / 1000} segundos`);
    } else {
        console.log(`✅ Token válido. Expira en ${(expirationTime - ahora) / 1000} segundos`);
    }
    
    return tokenExpired || tokenExpiringSoon;
}

// ========================================================
// Middleware mejorado para obtener/refrescar token automáticamente
// ========================================================
async function obtenerTokenFitbit(req, res, next) {
    // 1. Determinar el worker_id
    const workerId = req.session?.trabajador_id || req.query.worker_id;
    
    if (!workerId) {
        return res.status(400).json({ error: "worker_id no proporcionado." });
    }

    try {
        // 2. Obtener token desde la BD
        let tokenData = await getTokenFromDB(workerId);
        if (!tokenData) {
            return res.status(404).json({ error: "Token no encontrado para el trabajador." });
        }

        // 3. Verificar si el token está expirado o próximo a expirar
        if (isTokenExpiringSoon(tokenData)) {
            console.log(`🔄 Refrescando token para trabajador ${workerId}...`);
            tokenData = await refreshAccessToken(tokenData.refresh_token, workerId);
        }

        // 4. Adjuntar el token a la solicitud
        req.access_token = tokenData.access_token;
        next();

    } catch (error) {
        console.error("❌ Error en middleware de token:", error);
        
        // 5. Manejo de errores específicos de tokens inválidos o revocados
        if (error.message && (
            error.message.includes("invalid_grant") || 
            error.message.includes("invalid_token") ||
            error.message.includes("token revoked")
        )) {
            // Si el refresh token es inválido, redirigir a la autorización
            return res.status(401).json({ 
                error: "Se requiere nueva autorización de Fitbit",
                redirect: `/auth/fitbit?worker_id=${workerId}`
            });
        }
        
        return res.status(500).json({ 
            error: "Error al gestionar el token de Fitbit.",
            detalle: error.message 
        });
    }
}

// ========================================================
// FUNCIÓN PARA GUARDAR PERFIL DE FITBIT EN BD
// ========================================================
async function saveFitbitProfile(workerId, profileData) {
    const connectionPromise = await mysqlPromise.createConnection(dbConfig);
    try {
      // Extraer los datos relevantes del perfil
      const { user } = profileData;
      
      // Verificar datos antes de procesarlos
      console.log("Datos recibidos del usuario:", user);
      
      // Preparar los datos para guardar, convirtiendo undefined a null
      const fitbitProfile = {
        fitbit_user_id: user.encodedId || null,
        nombre_completo: user.fullName || null,
        nombre_mostrado: user.displayName || null,
        fecha_nacimiento: user.dateOfBirth || null,
        genero: user.gender || null,
        altura: user.height || null,
        peso: user.weight || null,
        pais: user.country || null,
        zona_horaria: user.timezone || null,
        fecha_registro: user.memberSince || null,
        promedio_pasos_diarios: user.averageDailySteps || null,
        avatar_url: user.avatar640 || null,
        // El campo datos_adicionales almacena todo el objeto JSON para futuras referencias
        datos_adicionales: JSON.stringify(user)
      };
  
      console.log("Datos a guardar en perfil:", fitbitProfile);
      
      // Verificar si ya existe un perfil para este trabajador
      const [existingProfile] = await connectionPromise.execute(
        'SELECT id FROM perfil_fitbit WHERE trabajador_id = ?', 
        [workerId]
      );
      
      let query;
      let params;
      
      if (existingProfile.length > 0) {
        // Actualizar perfil existente
        query = `
          UPDATE perfil_fitbit 
          SET 
            fitbit_user_id = ?,
            nombre_completo = ?,
            nombre_mostrado = ?,
            fecha_nacimiento = ?,
            genero = ?,
            altura = ?,
            peso = ?,
            pais = ?,
            zona_horaria = ?,
            fecha_registro = ?,
            promedio_pasos_diarios = ?,
            avatar_url = ?,
            datos_adicionales = ?,
            ultimo_sincronizado = CURRENT_TIMESTAMP
          WHERE trabajador_id = ?
        `;
        params = [
          fitbitProfile.fitbit_user_id,
          fitbitProfile.nombre_completo,
          fitbitProfile.nombre_mostrado,
          fitbitProfile.fecha_nacimiento,
          fitbitProfile.genero,
          fitbitProfile.altura,
          fitbitProfile.peso,
          fitbitProfile.pais,
          fitbitProfile.zona_horaria,
          fitbitProfile.fecha_registro,
          fitbitProfile.promedio_pasos_diarios,
          fitbitProfile.avatar_url,
          fitbitProfile.datos_adicionales,
          workerId
        ];
      } else {
        // Insertar nuevo perfil
        query = `
          INSERT INTO perfil_fitbit (
            trabajador_id,
            fitbit_user_id,
            nombre_completo,
            nombre_mostrado,
            fecha_nacimiento,
            genero,
            altura,
            peso,
            pais,
            zona_horaria,
            fecha_registro,
            promedio_pasos_diarios,
            avatar_url,
            datos_adicionales
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        params = [
          workerId,
          fitbitProfile.fitbit_user_id,
          fitbitProfile.nombre_completo,
          fitbitProfile.nombre_mostrado,
          fitbitProfile.fecha_nacimiento,
          fitbitProfile.genero,
          fitbitProfile.altura,
          fitbitProfile.peso,
          fitbitProfile.pais,
          fitbitProfile.zona_horaria,
          fitbitProfile.fecha_registro,
          fitbitProfile.promedio_pasos_diarios,
          fitbitProfile.avatar_url,
          fitbitProfile.datos_adicionales
        ];
      }
      
      const [result] = await connectionPromise.execute(query, params);
      console.log(`✅ Perfil de Fitbit ${existingProfile.length > 0 ? 'actualizado' : 'guardado'} para el trabajador: ${workerId}`);
      return result;
    } catch (error) {
      console.error('❌ Error al guardar perfil de Fitbit:', error);
      throw error;
    } finally {
      await connectionPromise.end();
    }
  }

// ========================================================
// Función para crear un trabajador y almacenar datos de Fitbit
// ========================================================
async function crearTrabajador(trabajadorData, fitbitProfile) {
    const connectionPromise = await mysqlPromise.createConnection(dbConfig);
    try {
        const { nombre, apellido, email, telefono, fecha_nacimiento } = trabajadorData;
        const fitbitData = JSON.stringify(fitbitProfile);
        const insertQuery = `
          INSERT INTO trabajadores (nombre, apellido, email, telefono, fecha_nacimiento, fitbit_data)
          VALUES (?, ?, ?, ?, ?, ?)
        `;
        const [result] = await connectionPromise.execute(insertQuery, [
            nombre,
            apellido,
            email,
            telefono,
            fecha_nacimiento,
            fitbitData
        ]);
        console.log('Trabajador creado con ID:', result.insertId);
        // Gracias al trigger en MySQL, se crea automáticamente un registro en la tabla "registros"
        return result.insertId;
    } catch (error) {
        console.error('Error al crear trabajador:', error);
        throw error;
    } finally {
        await connectionPromise.end();
    }
}

// En server.js modifica la importación y el endpoint para datos históricos:

// Importación del módulo de datos históricos
const datosHistoricos = require('./guardarData');

// Endpoint para importar datos históricos
app.post('/api/importar-datos-historicos', obtenerTokenFitbit, async (req, res) => {
  const { fechaInicio, fechaFin, intervaloMinutos } = req.body;
  const workerId = req.session?.trabajador_id || req.query.worker_id;
  
  if (!workerId || !fechaInicio || !fechaFin) {
    return res.status(400).json({ 
      error: "Faltan datos requeridos", 
      mensaje: "Se requiere worker_id, fechaInicio y fechaFin" 
    });
  }
  
  try {
    const resultado = await datosHistoricos.obtenerYGuardarDatosHistoricos(
      workerId, 
      fechaInicio, 
      fechaFin, 
      intervaloMinutos || 30,
      req.access_token
    );
    
    return res.json(resultado);
  } catch (error) {
    console.error("❌ Error al importar datos históricos:", error);
    return res.status(500).json({
      error: "Error al importar datos históricos",
      detalle: error.message
    });
  }
});

// (OPCIONAL) Endpoint para verificar disponibilidad de datos históricos
app.get('/api/verificar-disponibilidad-historica', obtenerTokenFitbit, async (req, res) => {
  const { fecha } = req.query;
  const workerId = req.session?.trabajador_id || req.query.worker_id;
  
  if (!workerId || !fecha) {
    return res.status(400).json({ 
      error: "Faltan datos requeridos", 
      mensaje: "Se requiere worker_id y fecha" 
    });
  }
  
  // Esta función NO EXISTE en el código pero podrías implementarla para verificar 
  // la disponibilidad de datos antes de hacer una importación completa
  try {
    // Verificamos sólo con datos cardíacos como prueba
    const datosCardiaca = await fetch(
      `https://api.fitbit.com/1/user/-/activities/heart/date/${fecha}/1d/1min.json`,
      { headers: { 'Authorization': 'Bearer ' + req.access_token } }
    );
    
    if (!datosCardiaca.ok) {
      return res.json({
        disponible: false,
        mensaje: `No hay datos cardíacos disponibles para la fecha ${fecha}`
      });
    }
    
    const datos = await datosCardiaca.json();
    const tieneDataset = datos && 
                        datos['activities-heart-intraday'] && 
                        datos['activities-heart-intraday'].dataset &&
                        datos['activities-heart-intraday'].dataset.length > 0;
    
    return res.json({
      disponible: tieneDataset,
      cantidad: tieneDataset ? datos['activities-heart-intraday'].dataset.length : 0,
      mensaje: tieneDataset 
        ? `Hay ${datos['activities-heart-intraday'].dataset.length} registros cardíacos disponibles` 
        : "No hay suficientes datos para importar"
    });
  } catch (error) {
    console.error("❌ Error al verificar disponibilidad:", error);
    return res.status(500).json({
      error: "Error al verificar disponibilidad de datos",
      detalle: error.message
    });
  }
});
 
// ========================================================
// RUTAS MEJORADAS DE AUTENTICACIÓN CON FITBIT (OAuth2.0)
// ========================================================

// Ruta para iniciar el flujo OAuth con Fitbit
app.get('/auth/fitbit', async (req, res) => {
    const clientId = process.env.FITBIT_CLIENT_ID;
    const redirectUri = process.env.FITBIT_REDIRECT_URI;
    const scope = 'activity heartrate sleep nutrition weight profile settings social location respiratory_rate oxygen_saturation temperature electrocardiogram';
    const responseType = 'code';
    
    // Se espera que se envíe el worker_id como query parameter, por ejemplo: /auth/fitbit?worker_id=3
    const workerId = req.query.worker_id;
    if (workerId) {
        req.session.trabajador_id = workerId; // Almacena el worker_id en la sesión
    }
    const state = workerId ? workerId : '';
    
    // Verificar si existe un token para este trabajador en la DB
    if (workerId) {
        try {
            const tokenData = await getTokenFromDB(workerId);
            if (tokenData) {
                // Usar la función isTokenExpiringSoon para verificar estado del token
                if (!isTokenExpiringSoon(tokenData)) {
                    console.log("✅ Token válido para el trabajador:", workerId);
                    // Redirige directamente al dashboard
                    return res.redirect(`/dashboard?worker_id=${workerId}`);
                } else {
                    console.log("🔄 Token expirado o próximo a expirar, intentando refrescar");
                    try {
                        await refreshAccessToken(tokenData.refresh_token, workerId);
                        console.log("✅ Token refrescado, redirigiendo a dashboard.");
                        return res.redirect(`/dashboard?worker_id=${workerId}`);
                    } catch (error) {
                        console.error("❌ Error al refrescar token:", error);
                        // Continúa con la autenticación normal
                    }
                }
            } else {
                console.log("⚠️ No se encontró token para el trabajador:", workerId);
            }
        } catch (error) {
            console.error("❌ Error al verificar token en /auth/fitbit:", error);
        }
    }
    
    // Si no hay token válido, redirige a la autenticación de Fitbit
    // El parámetro prompt=login fuerza siempre el inicio de sesión en Fitbit
    const authUrl = `https://www.fitbit.com/oauth2/authorize?response_type=${responseType}&client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&scope=${encodeURIComponent(scope)}&state=${state}&prompt=login`;
    res.redirect(authUrl);
});

// Ruta de callback mejorada para intercambiar el código por un token de Fitbit
app.get('/callback', async (req, res) => {
    // Logs de depuración
    console.log('req.query.state:', req.query.state);
    console.log('req.session.trabajador_id:', req.session.trabajador_id);
    
    const code = req.query.code;
    const error = req.query.error;
    
    // Recupera el worker_id enviado en "state" o desde la sesión
    const workerId = req.query.state || req.session.trabajador_id;
    
    if (error) {
        console.error(`❌ Error en autorización de Fitbit: ${error}`);
        return res.status(400).send(`Error en autorización de Fitbit: ${error}`);
    }
    
    if (!code) {
        return res.status(400).send("Error: No se recibió código de autorización.");
    }
    
    const clientId = process.env.FITBIT_CLIENT_ID;
    const clientSecret = process.env.FITBIT_CLIENT_SECRET;
    const redirectUri = process.env.FITBIT_REDIRECT_URI;
    const tokenUrl = 'https://api.fitbit.com/oauth2/token';
    
    // Configura los parámetros de la solicitud para obtener el token
    const params = new URLSearchParams();
    params.append('client_id', clientId);
    params.append('grant_type', 'authorization_code');
    params.append('redirect_uri', redirectUri);
    params.append('code', code);
    
    try {
        // Realiza la solicitud POST a Fitbit para obtener el token
        const tokenResponse = await fetch(tokenUrl, {
            method: 'POST',
            headers: {
                'Authorization': 'Basic ' + Buffer.from(clientId + ':' + clientSecret).toString('base64'),
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            body: params
        });
        
        if (!tokenResponse.ok) {
            const errorData = await tokenResponse.json();
            console.error("❌ Error en respuesta de Fitbit:", errorData);
            return res.status(tokenResponse.status).send(`Error de Fitbit: ${JSON.stringify(errorData)}`);
        }
        
        const tokenData = await tokenResponse.json();
        console.log("✅ Token recibido de Fitbit");
        
        // Registra la fecha y hora de obtención
        const obtenido_en = new Date();
        
        const connectionPromise = await mysqlPromise.createConnection(dbConfig);
        try {
            // Guarda el token en la tabla tokens_fitbit asociado al trabajador
            const insertTokenQuery = `
                INSERT INTO tokens_fitbit (trabajador_id, access_token, refresh_token, expires_in, obtenido_en) 
                VALUES (?, ?, ?, ?, ?) 
                ON DUPLICATE KEY UPDATE 
                access_token = VALUES(access_token), 
                refresh_token = VALUES(refresh_token), 
                expires_in = VALUES(expires_in), 
                obtenido_en = VALUES(obtenido_en)
            `;
            
            await connectionPromise.execute(insertTokenQuery, [
                workerId,
                tokenData.access_token,
                tokenData.refresh_token,
                tokenData.expires_in,
                obtenido_en
            ]);
            
            console.log("✅ Token guardado para el trabajador:", workerId);
            
            // NUEVO: Obtener y guardar el perfil automáticamente
    try {
        // Usar el token recién obtenido para solicitar el perfil
        const fitbitProfileUrl = 'https://api.fitbit.com/1/user/-/profile.json';
        const profileResponse = await fetch(fitbitProfileUrl, {
            method: 'GET',
            headers: { 'Authorization': 'Bearer ' + tokenData.access_token }
        });
        
        if (profileResponse.ok) {
            const profileData = await profileResponse.json();
            // Guardar el perfil en la base de datos
            await saveFitbitProfile(workerId, profileData);
            console.log("✅ Perfil de Fitbit guardado automáticamente para el trabajador:", workerId);
        } else {
            console.error("❌ Error al obtener perfil automáticamente:", await profileResponse.text());
        }
    } catch (profileError) {
        console.error("❌ Error al guardar perfil automáticamente:", profileError);
        // No interrumpimos el flujo aunque falle obtener el perfil
    }
    
    

            // Redirigir al dashboard con el worker_id
            res.redirect(`/dashboard?worker_id=${workerId}`);
        } finally {
            await connectionPromise.end();
        }
        
    } catch (error) {
        console.error("❌ Error en callback:", error);
        return res.status(500).send(`Error en la autenticación: ${error.message}`);
    }
});

// ========================================================
// NUEVOS ENDPOINTS: Trabajadores (para el panel administrador)
// ========================================================

// Devuelve la lista de trabajadores (tabla trabajadores)
app.get('/mostrar-trabajadores', (req, res) => {
    connection.query('SELECT * FROM trabajadores', (err, results) => {
        if (err) {
            console.error("Error al obtener trabajadores:", err);
            return res.status(500).json({ error: "Error en la base de datos" });
        }
        res.json(results);
    });
});

// Devuelve los datos de un trabajador específico (para el panel personal)
app.get('/mostrar-trabajador', (req, res) => {
    const id = req.query.id;
    if (!id) {
        return res.status(400).json({ error: "ID no proporcionado" });
    }
    connection.query('SELECT * FROM trabajadores WHERE id = ?', [id], (err, results) => {
        if (err) {
            console.error("Error al obtener trabajador:", err);
            return res.status(500).json({ error: "Error en la base de datos" });
        }
        if (results.length === 0) {
            return res.status(404).json({ error: "Trabajador no encontrado" });
        }
        res.json(results[0]);
    });
});

// ruta stress
const StressDetector = require('./StressDetector');

app.get('/api/fitbit-stress', obtenerTokenFitbit, async (req, res) => {
    try {
      const date = req.query.date || null;
      const stressDetector = new StressDetector(req.access_token);
      const stressData = await stressDetector.calculateStressIndex(date);
      return res.json(stressData);
    } catch (error) {
      console.error("Error calculando el índice de estrés:", error);
      return res.status(500).json({ 
        error: "No se pudo calcular el índice de estrés", 
        details: error.message 
      });
    }
  });
  
  

// ========================================================
// NUEVA RUTA: Obtener datos intradía de Fitbit según el tipo de dato
// ========================================================
app.get('/api/fitbit-data/:type', (req, res) => {
    const type = req.params.type; // 'heart', 'activities', 'respiratory', 'hrv' o 'spo2'
    
    // Se obtiene el worker_id desde la sesión o como query (para pruebas)
    const workerId = req.session.trabajador_id || req.query.worker_id;
    if (!workerId) {
        return res.status(400).json({ error: "worker_id no proporcionado." });
    }
    
    // Variables para la fecha y para start/end según el tipo
    let today;
    let start, end;
    
    
    if (["heart", "activities", "activeZones"].includes(type)) {
        // Para datos intradía se requieren start y end
        start = req.query.start; // formato: "HH:mm", ej: "10:00"
        end = req.query.end;     // formato: "HH:mm", ej: "11:00"
        if (!start || !end) {
            return res.status(400).json({ error: "Faltan parámetros: start y end." });
        }
        // Usamos la fecha actual en la zona de Perú
        today = dayjs().tz("America/Lima").format("YYYY-MM-DD");
    } else if (type === "temp" || type === "sleep" || type === "ecg" || type === "hrv1") {

        // Para temperatura, sueño y ECG, se requieren start y end como rango de fechas (YYYY-MM-DD)
        start = req.query.start;
        end = req.query.end;
        
        if (!start || !end) {
            return res.status(400).json({ error: `Faltan parámetros: start y end para el rango de ${type}.` });
        }
    
        console.log("📅 Rango de fechas recibido:", start, "->", end); // 🛠️ Verificar que lleguen las fechas correctamente
    
    } else {
        // Para datos diarios se requiere el parámetro "date"
        const dateParam = req.query.date;
        if (!dateParam) {
            return res.status(400).json({ error: "Falta parámetro: date." });
        }
        today = dateParam;
    }
    
    // Consulta para obtener el token del trabajador
    const tokenQuery = 'SELECT access_token FROM tokens_fitbit WHERE trabajador_id = ?';
    connection.query(tokenQuery, [workerId], async (err, results) => {
        if (err) {
            console.error("Error al obtener token:", err);
            return res.status(500).json({ error: "Error en la base de datos." });
        }
        if (!results || results.length === 0) {
            return res.status(404).json({ error: "Token no encontrado para el trabajador." });
        }
        const access_token = results[0].access_token;
    
        // Construir la URL de la API de Fitbit según el tipo de dato
        let fitbitUrl;
        switch (type) {
            case 'heart':
                fitbitUrl = `https://api.fitbit.com/1/user/-/activities/heart/date/${today}/1d/1min/time/${start}/${end}.json`;
                break;
            case 'activities':
                fitbitUrl = `https://api.fitbit.com/1/user/-/activities/steps/date/${today}/1d/1min/time/${start}/${end}.json`;
                break;
            case 'respiratory':
                fitbitUrl = `https://api.fitbit.com/1/user/-/br/date/${today}/all.json`;
                break;
            case 'hrv1':
                fitbitUrl = `https://api.fitbit.com/1/user/-/hrv/date/${start}/${end}/all.json`;
                break;
                  
            case 'spo21':
                fitbitUrl = `https://api.fitbit.com/1/user/-/spo2/date/${today}/all.json`;
                break;
            case 'activeZones':
                fitbitUrl = `https://api.fitbit.com/1/user/-/activities/active-zone-minutes/date/${today}/1d/1min/time/${start}/${end}.json`;
                break;
            case 'temp':
                    fitbitUrl = `https://api.fitbit.com/1/user/-/temp/core/date/${start}/${end}.json`;
                    break;
            case 'sleep':
                fitbitUrl = `https://api.fitbit.com/1.2/user/-/sleep/date/${start}/${end}.json`;
                break;
                case 'ecg':
                    // Modificado según la documentación de Fitbit
                    fitbitUrl = `https://api.fitbit.com/1/user/-/ecg/list.json?afterDate=${start}&sort=asc&limit=10&offset=0`;
                    break;


            default:
                return res.status(400).json({ error: "Tipo de dato no soportado." });
        }
        
        try {
            const fitbitResponse = await fetch(fitbitUrl, {
                method: 'GET',
                headers: { 'Authorization': 'Bearer ' + access_token }
            });
            const fitbitData = await fitbitResponse.json();
            return res.json(fitbitData);
        } catch (error) {
            console.error("Error llamando a Fitbit API:", error);
            return res.status(500).json({ error: "Error al obtener datos de Fitbit." });
        }
    });
});
// ========================================================
// RUTA: Obtener y guardar el perfil del usuario de Fitbit
// ========================================================
app.get('/api/fitbit-profile', obtenerTokenFitbit, async (req, res) => {
    const fitbitProfileUrl = 'https://api.fitbit.com/1/user/-/profile.json';
    const workerId = req.session.trabajador_id || req.query.worker_id;
    
    if (!workerId) {
      return res.status(400).json({ error: "worker_id no proporcionado." });
    }
    
    try {
      // 1. Obtener perfil desde Fitbit API
      const response = await fetch(fitbitProfileUrl, {
        method: 'GET',
        headers: { 'Authorization': 'Bearer ' + req.access_token }
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        console.error("❌ Error al obtener perfil de Fitbit:", errorData);
        return res.status(response.status).json(errorData);
      }
      
      const profileData = await response.json();
      
      // 2. Guardar el perfil en la base de datos
      try {
        await saveFitbitProfile(workerId, profileData);
      } catch (dbError) {
        console.error("⚠️ Error al guardar perfil en la base de datos:", dbError);
        // Continuamos incluso si falla el guardado para devolver los datos al cliente
      }
      
      // 3. Devolver los datos al cliente
      return res.json(profileData);
    } catch (error) {
      console.error("❌ Error llamando a Fitbit API:", error);
      return res.status(500).json({ 
        error: "Error al obtener el perfil de Fitbit.",
        detalle: error.message
      });
    }
  });
  
  // ========================================================
  // RUTA: Obtener perfil almacenado en la base de datos
  // ========================================================
  app.get('/api/fitbit-profile-local', async (req, res) => {
    const workerId = req.session.trabajador_id || req.query.worker_id;
    
    if (!workerId) {
      return res.status(400).json({ error: "worker_id no proporcionado." });
    }
    
    const connectionPromise = await mysqlPromise.createConnection(dbConfig);
    try {
      const [rows] = await connectionPromise.execute(
        'SELECT * FROM perfil_fitbit WHERE trabajador_id = ?',
        [workerId]
      );
      
      if (rows.length === 0) {
        return res.status(404).json({ 
          error: "Perfil no encontrado", 
          mensaje: "El perfil de Fitbit para este trabajador no está disponible."
        });
      }
      
      return res.json(rows[0]);
    } catch (error) {
      console.error("❌ Error al obtener perfil desde BD:", error);
      return res.status(500).json({ 
        error: "Error al obtener el perfil desde la base de datos.",
        detalle: error.message
      });
    } finally {
      await connectionPromise.end();
    }
  });

// ========================================================
// RUTAS PARA OPERACIONES CRUD EN LA BASE DE DATOS (registros)
// ========================================================
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.post('/guardar-registro', (req, res) => {
    const { trabajador_id, frecuencia_cardiaca, nivel_estres, calidad_sueno, actividad_fisica } = req.body;
    if (!trabajador_id || !frecuencia_cardiaca || !nivel_estres || !calidad_sueno || !actividad_fisica) {
        return res.status(400).json({ error: "Faltan datos obligatorios" });
    }
    const query = 'INSERT INTO registros (trabajador_id, frecuencia_cardiaca, nivel_estres, calidad_sueno, actividad_fisica) VALUES (?, ?, ?, ?, ?)';
    const values = [trabajador_id, frecuencia_cardiaca, nivel_estres, calidad_sueno, actividad_fisica];
    connection.query(query, values, (err, results) => {
        if (err) {
            console.error("❌ Error al insertar:", err);
            return res.status(500).json({ error: "Error en la base de datos" });
        }
        res.json({ mensaje: "Registro guardado", id_insertado: results.insertId });
    });
});

app.get('/mostrar-registros', (req, res) => {
    connection.query('SELECT * FROM registros', (err, results) => {
        if (err) {
            console.error("❌ Error al obtener registros:", err);
            return res.status(500).json({ error: "Error en la base de datos" });
        }
        res.json(results);
    });
});

app.delete('/eliminar-registro/:id', (req, res) => {
    const id = req.params.id;
    connection.query('DELETE FROM registros WHERE id = ?', [id], (err, results) => {
        if (err) {
            console.error("❌ Error al eliminar registro:", err);
            return res.status(500).json({ error: "Error en la base de datos" });
        }
        res.json({ mensaje: "Registro eliminado" });
    });
});

app.put('/modificar-registro/:id', (req, res) => {
    const id = req.params.id;
    const { frecuencia_cardiaca, nivel_estres, calidad_sueno, actividad_fisica } = req.body;
    if (!frecuencia_cardiaca || !nivel_estres || !calidad_sueno || !actividad_fisica) {
        return res.status(400).json({ error: "Faltan datos obligatorios" });
    }
    connection.query(
        'UPDATE registros SET frecuencia_cardiaca = ?, nivel_estres = ?, calidad_sueno = ?, actividad_fisica = ? WHERE id = ?',
        [frecuencia_cardiaca, nivel_estres, calidad_sueno, actividad_fisica, id],
        (err, results) => {
            if (err) {
                console.error("❌ Error al actualizar registro:", err);
                return res.status(500).json({ error: "Error en la base de datos" });
            }
            res.json({ mensaje: "Registro actualizado" });
        }
    );
});

// ========================================================
// NUEVA RUTA: Crear un trabajador y almacenar datos de Fitbit
// ========================================================
app.post('/api/trabajadores', async (req, res) => {
    const { nombre, apellido, email, telefono, fecha_nacimiento, fitbit_profile } = req.body;
    if (!nombre || !apellido || !email || !telefono || !fecha_nacimiento || !fitbit_profile) {
        return res.status(400).json({ error: 'Faltan datos obligatorios.' });
    }
    try {
        const trabajadorId = await crearTrabajador(
            { nombre, apellido, email, telefono, fecha_nacimiento },
            fitbit_profile
        );
        res.status(201).json({ trabajadorId, message: 'Trabajador creado correctamente' });
    } catch (error) {
        res.status(500).json({ error: 'Error al crear el trabajador' });
    }
});

// ========================================================
// (Opcional) Ruta para el dashboard del trabajador
// ========================================================
app.get('/dashboard', (req, res) => {
    res.send("Bienvenido al Dashboard. Trabajador: " + (req.query.worker_id || req.session.trabajador_id));
});

// ========================================================
// INICIAR EL SERVIDOR
// ========================================================
const port = process.env.PORT || 3000;
app.listen(port, () => {
    console.log(`🚀 Servidor corriendo en http://localhost:${port}`);
});
