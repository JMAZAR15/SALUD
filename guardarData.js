// ========================================================
// Importar dependencias necesarias
// ========================================================
const fetch = global.fetch;  // Si estás usando Node.js < 18
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
dayjs.extend(utc);
dayjs.extend(timezone);

// Importar el detector de estrés existente
const StressDetector = require('./StressDetector');

// Necesitarás acceso a tu configuración de base de datos
const mysqlPromise = require('mysql2/promise');
const dbConfig = {
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
};

// ========================================================
// Función para manejar solicitudes con reintento y backoff exponencial
// ========================================================
async function obtenerDatosConReintento(url, accessToken, maxReintentos = 3) {
  let intento = 0;
  
  while (intento < maxReintentos) {
    try {
      console.log(`📍 Solicitando datos de: ${url} (Intento ${intento + 1}/${maxReintentos})`);
      
      const response = await fetch(url, {
        headers: { 'Authorization': 'Bearer ' + accessToken }
      });
      
      if (response.ok) {
        const datos = await response.json();
        console.log(`✅ Datos obtenidos correctamente`);
        return datos;
      } else if (response.status === 429) {
        // Esperar tiempo exponencial entre reintentos
        const tiempoEspera = Math.pow(2, intento + 1) * 1000;
        console.log(`⏳ Límite de API alcanzado, esperando ${tiempoEspera/1000} segundos antes de reintentar...`);
        await new Promise(resolve => setTimeout(resolve, tiempoEspera));
        intento++;
      } else {
        console.error(`Error al obtener datos: ${response.status}`);
        return null;
      }
    } catch (error) {
      console.error("Error en solicitud:", error);
      return null;
    }
  }
  
  console.error(`⚠️ Máximo de reintentos (${maxReintentos}) alcanzado para ${url}`);
  return null;
}

// ========================================================
// Funciones para obtener datos de las APIs de Fitbit
// ========================================================

// Función para obtener datos cardíacos por rango de fechas
async function obtenerDatosCardiacos(fecha, accessToken) {
  // La API para obtener datos cardíacos de un día con resolución por minuto
  const url = `https://api.fitbit.com/1/user/-/activities/heart/date/${fecha}/1d/1min.json`;
  return await obtenerDatosConReintento(url, accessToken);
}

// Función para obtener datos de actividad (pasos)
async function obtenerDatosActividad(fecha, accessToken) {
  // La API para obtener datos de pasos de un día con resolución por minuto
  const url = `https://api.fitbit.com/1/user/-/activities/steps/date/${fecha}/1d/1min.json`;
  return await obtenerDatosConReintento(url, accessToken);
}

// Función para obtener datos de sueño
async function obtenerDatosSueno(fecha, accessToken) {
  // La API para obtener datos de sueño de un día
  const url = `https://api.fitbit.com/1.2/user/-/sleep/date/${fecha}.json`;
  return await obtenerDatosConReintento(url, accessToken);
}

// En obtenerDatosFrecuenciaRespiratoria - quita log detallado
async function obtenerDatosFrecuenciaRespiratoria(fecha, accessToken) {
  const url = `https://api.fitbit.com/1/user/-/br/date/${fecha}/all.json`;
  return await obtenerDatosConReintento(url, accessToken);
}

// Función para obtener datos de SpO2
async function obtenerDatosSPO2(fecha, accessToken) {
  // La API para obtener datos de SpO2 de un día
  const url = `https://api.fitbit.com/1/user/-/spo2/date/${fecha}/all.json`;
  return await obtenerDatosConReintento(url, accessToken);
}

// Función para obtener datos de temperatura
async function obtenerDatosTemperatura(fecha, accessToken) {
  // La API correcta para obtener datos de temperatura de un día
  const url = `https://api.fitbit.com/1/user/-/temp/core/date/${fecha}.json`;
  return await obtenerDatosConReintento(url, accessToken);
}

// Función para obtener datos de variabilidad cardíaca (HRV)
async function obtenerDatosHRV(fecha, accessToken) {
  // La API para obtener datos de HRV de un día
  const url = `https://api.fitbit.com/1/user/-/hrv/date/${fecha}/all.json`;
  return await obtenerDatosConReintento(url, accessToken);
}

// ========================================================
// Funciones auxiliares para extraer datos
// ========================================================

// Función para extraer el valor de frecuencia cardíaca cercano a una hora específica
function obtenerFrecuenciaCardiaca(datosCardiaca, hora) {
  if (!datosCardiaca || 
      !datosCardiaca['activities-heart-intraday'] || 
      !datosCardiaca['activities-heart-intraday'].dataset) {
    return null;
  }
  
  const dataset = datosCardiaca['activities-heart-intraday'].dataset;
  if (dataset.length === 0) return null;
  
  // Buscar el dato más cercano a la hora especificada
  const [horaObjetivo, minutosObjetivo] = hora.split(':').map(Number);
  const minutosTotal = horaObjetivo * 60 + minutosObjetivo;
  
  let mejorCoincidencia = null;
  let menorDiferencia = Infinity;
  
  for (const item of dataset) {
    const [horaActual, minutosActual] = item.time.split(':').map(Number);
    const minutosActualTotal = horaActual * 60 + minutosActual;
    
    const diferencia = Math.abs(minutosTotal - minutosActualTotal);
    
    if (diferencia < menorDiferencia) {
      menorDiferencia = diferencia;
      mejorCoincidencia = item;
    }
  }
  
  // Aumentamos el umbral a 30 minutos igual que los demás sensores
  if (menorDiferencia > 30) {
    console.log(`⚠️ Advertencia: La lectura de frecuencia cardíaca más cercana a ${hora} está a ${menorDiferencia} minutos`);
    return null; // No aceptamos lecturas más allá de 30 minutos
  }
  
  return mejorCoincidencia ? mejorCoincidencia.value : null;
}

// También actualizamos la función de pasos para usar el mismo umbral
function obtenerPasos(datosActividad, hora) {
  if (!datosActividad || 
      !datosActividad['activities-steps-intraday'] || 
      !datosActividad['activities-steps-intraday'].dataset) {
    return null;
  }
  
  const dataset = datosActividad['activities-steps-intraday'].dataset;
  if (dataset.length === 0) return null;
  
  // Buscar el dato más cercano a la hora especificada
  const [horaObjetivo, minutosObjetivo] = hora.split(':').map(Number);
  const minutosTotal = horaObjetivo * 60 + minutosObjetivo;
  
  // Determinar ventana de tiempo (15 minutos antes de la hora especificada)
  const ventanaInicioMinutos = minutosTotal - 15;
  
  // Sumar pasos en la ventana de 15 minutos
  let totalPasos = 0;
  let lecturasDentroDeVentana = 0;
  
  for (const item of dataset) {
    const [horaActual, minutosActual] = item.time.split(':').map(Number);
    const minutosActualTotal = horaActual * 60 + minutosActual;
    
    // Si la lectura está dentro de la ventana de 15 minutos
    if (minutosActualTotal >= ventanaInicioMinutos && minutosActualTotal <= minutosTotal) {
      totalPasos += item.value;
      lecturasDentroDeVentana++;
    }
  }
  
  // Si no hay lecturas en la ventana de tiempo, buscar la más cercana
  if (lecturasDentroDeVentana === 0) {
    let mejorCoincidencia = null;
    let menorDiferencia = Infinity;
    
    for (const item of dataset) {
      const [horaActual, minutosActual] = item.time.split(':').map(Number);
      const minutosActualTotal = horaActual * 60 + minutosActual;
      
      const diferencia = Math.abs(minutosTotal - minutosActualTotal);
      
      if (diferencia < menorDiferencia) {
        menorDiferencia = diferencia;
        mejorCoincidencia = item;
      }
    }
    
    // Aumentamos el umbral a 30 minutos en lugar de 10
    if (menorDiferencia > 30) {
      console.log(`⚠️ Advertencia: La lectura de pasos más cercana a ${hora} está a ${menorDiferencia} minutos`);
      return null; // No aceptamos lecturas más allá de 30 minutos
    }
    
    return mejorCoincidencia ? mejorCoincidencia.value : null;
  }
  
  return totalPasos;
}

// Función para extraer datos de sueño relevantes
function obtenerDatosSuenoRelevantes(datosSueno) {
  if (!datosSueno || !datosSueno.sleep || datosSueno.sleep.length === 0) {
    return null;
  }
  
  // Tomamos el registro de sueño principal (normalmente el más largo)
  const registroPrincipal = datosSueno.sleep.reduce((mayor, actual) => 
    actual.duration > mayor.duration ? actual : mayor, datosSueno.sleep[0]);
  
  return {
    duracion: registroPrincipal.duration / 60000 / 60, // Convertir a horas
    eficiencia: registroPrincipal.efficiency,
    minutosDespierto: registroPrincipal.minutesAwake,
    minutosParaDormir: registroPrincipal.minutesToFallAsleep,
    tiempoEnCama: registroPrincipal.timeInBed / 60 // Convertir a horas
  };
}

// Función modificada para filtrar valores de SpO2 por hora específica
function filtrarDatosSPO2PorHora(datosSPO2, hora, fechaActual) {
  if (!datosSPO2) {
    return null;
  }
  
  // Comprobamos si tenemos el nuevo formato con "minutes"
  if (datosSPO2.minutes && Array.isArray(datosSPO2.minutes)) {
    const [horaObjetivo, minutosObjetivo] = hora.split(':').map(Number);
    const fechaHoraObjetivo = dayjs(`${fechaActual}T${hora}:00`);
    
    let mejorCoincidencia = null;
    let menorDiferencia = Infinity;
    
    for (const lectura of datosSPO2.minutes) {
      if (!lectura.minute || !lectura.value) continue;
      
      try {
        // Parsear la fecha completa del formato "2025-04-16T21:43:03"
        const fechaHoraLectura = dayjs(lectura.minute);
        
        if (!fechaHoraLectura.isValid()) {
          continue; // Fecha inválida
        }
        
        // Verificar que sea exactamente la misma fecha (día)
        if (fechaHoraLectura.format('YYYY-MM-DD') !== fechaActual) {
          continue; // Ignorar datos de otros días
        }
        
        // Calcular diferencia en minutos
        const diferencia = Math.abs(fechaHoraLectura.diff(fechaHoraObjetivo, 'minute'));
        
        if (diferencia < menorDiferencia) {
          menorDiferencia = diferencia;
          mejorCoincidencia = lectura.value;
        }
      } catch (e) {
        console.warn(`⚠️ Error procesando lectura SpO2: ${e.message}`);
        continue;
      }
    }
    
    // Reducimos el umbral a 30 minutos en lugar de 3 horas
    if (mejorCoincidencia !== null && menorDiferencia <= 30) {
      console.log(`✅ Valor SpO2 encontrado: ${mejorCoincidencia} (diferencia: ${menorDiferencia} minutos)`);
      return mejorCoincidencia;
    }
  } else if (datosSPO2.value && Array.isArray(datosSPO2.value)) {
    // El código original para el formato antiguo
    // (mantenerlo como respaldo por si recibimos datos en el formato antiguo)
    // ... código original ...
  }
  
  console.log(`⚠️ No se encontraron datos de SpO2 válidos para la fecha ${fechaActual} a la hora ${hora}`);
  return null;
}

// Función modificada para filtrar datos de respiración por hora específica
function filtrarDatosRespiracionPorHora(datosRespiracion, hora, fechaActual) {
  if (!datosRespiracion || !datosRespiracion.br || !Array.isArray(datosRespiracion.br) || datosRespiracion.br.length === 0) {
    return null;
  }
  
  const fechaHoraObjetivo = dayjs(`${fechaActual}T${hora}:00`);
  
  let mejorCoincidencia = null;
  let menorDiferencia = Infinity;
  
  for (const lectura of datosRespiracion.br) {
    if (lectura.dateTime) {
      let fechaHoraLectura;
      try {
        // Intentar parsear la fecha
        fechaHoraLectura = dayjs(lectura.dateTime);
        
        // Si no tiene fecha completa, añadir la fecha actual
        if (!lectura.dateTime.includes('T') && lectura.dateTime.includes(':')) {
          fechaHoraLectura = dayjs(`${fechaActual}T${lectura.dateTime}`);
        }
        
        if (!fechaHoraLectura.isValid()) {
          throw new Error("Fecha inválida");
        }
        
        // Verificar que sea exactamente la misma fecha (día)
        if (fechaHoraLectura.format('YYYY-MM-DD') !== fechaActual) {
          continue; // Ignorar datos de otros días
        }
        
        // Calcular diferencia en minutos
        const diferencia = Math.abs(fechaHoraLectura.diff(fechaHoraObjetivo, 'minute'));
        
        if (diferencia < menorDiferencia) {
          menorDiferencia = diferencia;
          mejorCoincidencia = lectura;
        }
      } catch (e) {
        console.warn(`⚠️ No se pudo procesar fecha/hora: ${lectura.dateTime}`);
        continue;
      }
    }
  }
  
  // Reducimos el umbral a 30 minutos en lugar de 2 horas
  if (mejorCoincidencia && menorDiferencia <= 30) {
    if (mejorCoincidencia.value && typeof mejorCoincidencia.value.breathingRate === 'number') {
      return mejorCoincidencia.value.breathingRate;
    } else if (mejorCoincidencia.value) {
      // Extraer valor de diferentes formatos posibles
      const { deepSleepSummary, remSleepSummary, fullSleepSummary, lightSleepSummary } = mejorCoincidencia.value;
      
      // Priorizar breathingRate directo, luego full, deep, light y REM
      if (deepSleepSummary?.breathingRate) return deepSleepSummary.breathingRate;
      if (fullSleepSummary?.breathingRate) return fullSleepSummary.breathingRate;
      if (lightSleepSummary?.breathingRate) return lightSleepSummary.breathingRate;
      if (remSleepSummary?.breathingRate) return remSleepSummary.breathingRate;
    }
  }
  
  console.log(`⚠️ No se encontraron datos de respiración válidos para la fecha ${fechaActual} a la hora ${hora}`);
  return null;
}
// Función modificada para filtrar datos de temperatura por hora específica
function filtrarDatosTemperaturaPorHora(datosTemperatura, hora, fechaActual) {
  if (!datosTemperatura) {
    return null;
  }
  
  // Intentar detectar la estructura de los datos automáticamente
  let datosParaProcesar = null;
  
  // Comprobar posibles propiedades donde podrían estar los datos
  const posiblesPropiedades = ['tempCore', 'core', 'temperature', 'temp', 'minutes'];
  
  for (const prop of posiblesPropiedades) {
    if (datosTemperatura[prop] && Array.isArray(datosTemperatura[prop]) && datosTemperatura[prop].length > 0) {
      datosParaProcesar = datosTemperatura[prop];
      console.log(`✅ Encontrados datos de temperatura en propiedad: ${prop}`);
      break;
    }
  }
  
  // Si no encontramos en propiedades comunes, buscar en cualquier propiedad que sea un array
  if (!datosParaProcesar) {
    for (const prop in datosTemperatura) {
      if (Array.isArray(datosTemperatura[prop]) && datosTemperatura[prop].length > 0) {
        datosParaProcesar = datosTemperatura[prop];
        console.log(`✅ Encontrados datos de temperatura en propiedad: ${prop}`);
        break;
      }
    }
  }
  
  // Si no encontramos ningún array, pero tenemos la propiedad "minutes" como en SpO2
  if (!datosParaProcesar && datosTemperatura.minutes && Array.isArray(datosTemperatura.minutes)) {
    datosParaProcesar = datosTemperatura.minutes;
  }
  
  if (!datosParaProcesar) {
    console.log("⚠️ No se pudo identificar un formato válido para los datos de temperatura");
    return null;
  }
  
  const fechaHoraObjetivo = dayjs(`${fechaActual}T${hora}:00`);
  
  let mejorCoincidencia = null;
  let menorDiferencia = Infinity;
  
  // Procesar los datos según el formato detectado
  for (const lectura of datosParaProcesar) {
    // Determinar dónde está la fecha/hora
    const fechaHoraStr = lectura.dateTime || lectura.minute || lectura.timestamp || lectura.datetime || lectura.date;
    
    if (!fechaHoraStr) {
      continue;
    }
    
    let fechaHoraLectura;
    try {
      fechaHoraLectura = dayjs(fechaHoraStr);
      
      // Si solo tenemos la hora, añadir la fecha actual
      if (!fechaHoraStr.includes('T') && fechaHoraStr.includes(':') && !fechaHoraStr.includes('-')) {
        fechaHoraLectura = dayjs(`${fechaActual}T${fechaHoraStr}`);
      }
      
      if (!fechaHoraLectura.isValid()) {
        throw new Error("Fecha inválida");
      }
      
      // Verificar que sea exactamente la misma fecha (día)
      if (fechaHoraLectura.format('YYYY-MM-DD') !== fechaActual) {
        continue; // Ignorar datos de otros días
      }
      
      // Calcular diferencia en minutos
      const diferencia = Math.abs(fechaHoraLectura.diff(fechaHoraObjetivo, 'minute'));
      
      if (diferencia < menorDiferencia) {
        menorDiferencia = diferencia;
        
        // Determinar dónde está el valor
        let valor = null;
        if (typeof lectura.value === 'number') {
          valor = lectura.value;
        } else if (lectura.value && typeof lectura.value.temp === 'number') {
          valor = lectura.value.temp;
        } else if (lectura.temp && typeof lectura.temp === 'number') {
          valor = lectura.temp;
        } else if (typeof lectura.temperature === 'number') {
          valor = lectura.temperature;
        } else if (typeof lectura === 'number') {
          valor = lectura;
        }
        
        mejorCoincidencia = valor;
      }
    } catch (e) {
      continue; // Continuar con la siguiente lectura si hay error
    }
  }
  
  // Reducimos el umbral a 30 minutos en lugar de 3 horas
  if (mejorCoincidencia !== null && menorDiferencia <= 30) {
    console.log(`✅ Valor temperatura encontrado: ${mejorCoincidencia} (diferencia: ${Math.round(menorDiferencia)} minutos)`);
    return mejorCoincidencia;
  }
  
  console.log(`⚠️ No se encontró un valor de temperatura válido para la fecha ${fechaActual} a la hora ${hora}`);
  return null;
}

// Función modificada para filtrar datos de HRV por hora específica
function filtrarDatosHRVPorHora(datosHRV, hora, fechaActual) {
  if (!datosHRV || !datosHRV.hrv || !Array.isArray(datosHRV.hrv) || datosHRV.hrv.length === 0) {
    return null;
  }
  
  const fechaHoraObjetivo = dayjs(`${fechaActual}T${hora}:00`);
  
  let mejorCoincidencia = null;
  let menorDiferencia = Infinity;
  
  // Manejar diferentes formatos de datos HRV
  for (const diaHRV of datosHRV.hrv) {
    // Caso 1: Formato con minutos detallados
    if (diaHRV.minutes && Array.isArray(diaHRV.minutes)) {
      for (const minuto of diaHRV.minutes) {
        if (minuto.minute) {
          try {
            const fechaHoraLectura = dayjs(minuto.minute);
            
            if (!fechaHoraLectura.isValid()) {
              continue; // Fecha inválida
            }
            
            // Verificar que sea exactamente la misma fecha (día)
            if (fechaHoraLectura.format('YYYY-MM-DD') !== fechaActual) {
              continue; // Ignorar datos de otros días
            }
            
            // Calcular diferencia en minutos
            const diferencia = Math.abs(fechaHoraLectura.diff(fechaHoraObjetivo, 'minute'));
            
            if (diferencia < menorDiferencia && minuto.value && typeof minuto.value.rmssd === 'number') {
              menorDiferencia = diferencia;
              mejorCoincidencia = minuto.value.rmssd;
            }
          } catch (e) {
            console.warn(`⚠️ Error procesando fecha/hora HRV: ${minuto.minute}`);
          }
        }
      }
    }
    // Caso 2: Valor directo
    else if (diaHRV.value && typeof diaHRV.value.rmssd === 'number') {
      // Intentar obtener la hora de la lectura
      if (diaHRV.dateTime) {
        try {
          const fechaHoraLectura = dayjs(diaHRV.dateTime);
          
          // Si solo tenemos la hora, añadir la fecha actual
          if (!diaHRV.dateTime.includes('T') && diaHRV.dateTime.includes(':')) {
            fechaHoraLectura = dayjs(`${fechaActual}T${diaHRV.dateTime}`);
          }
          
          if (!fechaHoraLectura.isValid()) {
            continue; // Fecha inválida
          }
          
          // Verificar que sea exactamente la misma fecha (día)
          if (fechaHoraLectura.format('YYYY-MM-DD') !== fechaActual) {
            continue; // Ignorar datos de otros días
          }
          
          // Calcular diferencia en minutos
          const diferencia = Math.abs(fechaHoraLectura.diff(fechaHoraObjetivo, 'minute'));
          
          if (diferencia < menorDiferencia) {
            menorDiferencia = diferencia;
            mejorCoincidencia = diaHRV.value.rmssd;
          }
        } catch (e) {
          console.warn(`⚠️ Error procesando fecha/hora HRV: ${diaHRV.dateTime}`);
        }
      }
    }
  }
  
  // Reducimos el umbral a 30 minutos en lugar de 2 horas
  if (mejorCoincidencia !== null && menorDiferencia <= 30) {
    console.log(`✅ Valor HRV encontrado: ${mejorCoincidencia} (diferencia: ${menorDiferencia} minutos)`);
    return mejorCoincidencia;
  }
  
  console.log(`⚠️ No se encontró un valor de HRV válido para la fecha ${fechaActual} a la hora ${hora}`);
  return null;
}

// ========================================================
// Función principal para obtener datos y guardarlos en la BD
// ========================================================
async function obtenerYGuardarDatosHistoricos(workerId, fechaInicio, fechaFin, intervaloMinutos = 30, accessToken) {
  const connectionPromise = await mysqlPromise.createConnection(dbConfig);
  
  try {
    console.log(`📊 Obteniendo datos históricos para trabajador ${workerId} del ${fechaInicio} al ${fechaFin}`);
    
    // Arreglo para almacenar todos los reportes
    const reportes = [];
    
    // Configurar zona horaria para dayjs
    dayjs.tz.setDefault("America/Lima");
    
    // Procesar cada día en el rango de fechas usando dayjs
    const inicio = dayjs(fechaInicio).startOf('day');
    const fin = dayjs(fechaFin).endOf('day');
    let fechaActual = dayjs(inicio);
    
    // Instanciar el detector de estrés
    const stressDetector = new StressDetector(accessToken);
    
    while (fechaActual.isBefore(fin) || fechaActual.isSame(fin, 'day')) {
      const fechaFormateada = fechaActual.format('YYYY-MM-DD');
      console.log(`📅 Procesando fecha: ${fechaFormateada}`);
      
      try {
        // 1. Obtener TODOS los datos del día de una sola vez (evitando múltiples solicitudes)
        const datosCardiaca = await obtenerDatosCardiacos(fechaFormateada, accessToken);
        const datosActividad = await obtenerDatosActividad(fechaFormateada, accessToken);
        const datosSueno = await obtenerDatosSueno(fechaFormateada, accessToken);
        const datosSPO2 = await obtenerDatosSPO2(fechaFormateada, accessToken);
        const datosFrecuenciaRespiratoria = await obtenerDatosFrecuenciaRespiratoria(fechaFormateada, accessToken);
        const datosTemperatura = await obtenerDatosTemperatura(fechaFormateada, accessToken);
        const datosHRV = await obtenerDatosHRV(fechaFormateada, accessToken);
        
        // 2. Extraer datos de sueño para el día
        const suenoRelevante = obtenerDatosSuenoRelevantes(datosSueno);
        
        // 3. Generar muestras a intervalos regulares durante el día
        for (let hora = 0; hora < 24; hora++) {
          for (let minuto = 0; minuto < 60; minuto += intervaloMinutos) {
            const horaStr = `${hora.toString().padStart(2, '0')}:${minuto.toString().padStart(2, '0')}`;
            const fechaHoraStr = `${fechaFormateada} ${horaStr}:00`;
            
            console.log(`⏱️ Procesando intervalo ${horaStr} para fecha ${fechaFormateada}`);
            
           // 4. Filtrar datos para esta hora específica
const frecuenciaCardiaca = obtenerFrecuenciaCardiaca(datosCardiaca, horaStr);
const pasos = obtenerPasos(datosActividad, horaStr);
const promedioSPO2 = filtrarDatosSPO2PorHora(datosSPO2, horaStr, fechaFormateada);
const respiracionPromedio = filtrarDatosRespiracionPorHora(datosFrecuenciaRespiratoria, horaStr, fechaFormateada);
const temperaturaPromedio = filtrarDatosTemperaturaPorHora(datosTemperatura, horaStr, fechaFormateada);
const hrvPromedio = filtrarDatosHRVPorHora(datosHRV, horaStr, fechaFormateada);

// 6. Crear registro si hay al menos un dato válido (no solo frecuencia cardíaca)
if (frecuenciaCardiaca !== null || pasos !== null || promedioSPO2 !== null || 
    respiracionPromedio !== null || temperaturaPromedio !== null || hrvPromedio !== null) {
  
  // Crear objeto de reporte
  const reporte = {
    trabajador_id: workerId,
    frecuencia_cardiaca: frecuenciaCardiaca,
    saturacion_oxigeno: promedioSPO2,
    temperatura_corporal: temperaturaPromedio,
    frecuencia_respiratoria: respiracionPromedio ? Math.round(respiracionPromedio) : null,
    nivel_estres: null, // Se calculará después
    horas_sueno: suenoRelevante ? suenoRelevante.duracion : null,
    calidad_sueno: suenoRelevante ? suenoRelevante.eficiencia : null,
    efectividad_sueno: suenoRelevante 
      ? 100 - (suenoRelevante.minutosDespierto / (suenoRelevante.tiempoEnCama * 60) * 100) 
      : null,
    variabilidad_cardiaca: hrvPromedio,
    pasos: pasos,
    fecha_hora: fechaHoraStr
  };
  
  // 7. Calcular nivel de estrés solo si hay suficientes datos (necesitamos al menos FC o HRV)
  if (frecuenciaCardiaca !== null || hrvPromedio !== null) {
    try {
      // Algoritmo de cálculo de estrés (sin cambios en el algoritmo)
      let nivelEstres = 50;
      let factoresDisponibles = 0;
      
      // 1. Factor FC (25%)
      if (reporte.frecuencia_cardiaca) {
        const fcFactor = reporte.frecuencia_cardiaca <= 60 ? 0 :
                         reporte.frecuencia_cardiaca >= 100 ? 100 :
                         (reporte.frecuencia_cardiaca - 60) / 40 * 100;
        nivelEstres = fcFactor;
        factoresDisponibles++;
      }
      
      // 2. Factor HRV (25%)
      if (reporte.variabilidad_cardiaca) {
        const hrvFactor = reporte.variabilidad_cardiaca >= 100 ? 0 :
                          reporte.variabilidad_cardiaca <= 20 ? 100 :
                          (100 - (reporte.variabilidad_cardiaca - 20) / 80 * 100);
        
        if (factoresDisponibles > 0) {
          nivelEstres = (nivelEstres + hrvFactor) / 2;
        } else {
          nivelEstres = hrvFactor;
        }
        factoresDisponibles++;
      }
      
      // 3. Factor SpO2 (15%)
      if (reporte.saturacion_oxigeno) {
        const spo2Factor = reporte.saturacion_oxigeno >= 95 ? 0 :
                           reporte.saturacion_oxigeno <= 90 ? 100 :
                           (95 - reporte.saturacion_oxigeno) / 5 * 100;
        
        if (factoresDisponibles > 0) {
          nivelEstres = (nivelEstres * factoresDisponibles + spo2Factor * 0.5) / (factoresDisponibles + 0.5);
        } else {
          nivelEstres = spo2Factor;
        }
        factoresDisponibles += 0.5;
      }
      
      // 4. Factor de sueño (15%)
      if (reporte.calidad_sueno) {
        const suenoFactor = reporte.calidad_sueno >= 90 ? 0 :
                           reporte.calidad_sueno <= 50 ? 100 :
                           (90 - reporte.calidad_sueno) / 40 * 100;
        
        if (factoresDisponibles > 0) {
          nivelEstres = (nivelEstres * factoresDisponibles + suenoFactor * 0.5) / (factoresDisponibles + 0.5);
        } else {
          nivelEstres = suenoFactor;
        }
        factoresDisponibles += 0.5;
      }
      
      // Redondear el resultado final
      reporte.nivel_estres = Math.round(nivelEstres);
      console.log(`✅ Nivel de estrés calculado con algoritmo simplificado: ${reporte.nivel_estres}`);
    } catch (error) {
      // En caso de error, asignar valor neutral
      reporte.nivel_estres = 50;
      console.warn(`⚠️ Error en cálculo de estrés: ${error.message}`);
    }
  } else {
    // Si no hay datos para calcular el estrés, asignar un valor neutral
    reporte.nivel_estres = 50;
    console.log(`ℹ️ Nivel de estrés establecido en neutral (50) por falta de datos suficientes`);
  }
  
  // Construir mensaje con los datos disponibles
  let logMessage = `✅ Registro creado para ${fechaHoraStr} con `;
  const datos = [];
  if (frecuenciaCardiaca !== null) datos.push(`FC=${frecuenciaCardiaca}`);
  if (promedioSPO2 !== null) datos.push(`SpO2=${promedioSPO2}`);
  if (temperaturaPromedio !== null) datos.push(`Temp=${temperaturaPromedio}`);
  if (pasos !== null) datos.push(`Pasos=${pasos}`);
  if (hrvPromedio !== null) datos.push(`HRV=${hrvPromedio}`);
  if (respiracionPromedio !== null) datos.push(`Resp=${respiracionPromedio}`);
  
  logMessage += datos.join(', ');
  console.log(logMessage);
  
              // Agregar registro al array
              console.log(`✅ Registro creado para ${fechaHoraStr} con FC=${frecuenciaCardiaca}, SpO2=${promedioSPO2}, Temp=${temperaturaPromedio}`);
              reportes.push(reporte);
            } else {
              console.log(`⚠️ Sin datos de frecuencia cardíaca válidos para ${fechaHoraStr}, omitiendo intervalo`);
            }
          }
        }
      } catch (errorDia) {
        console.error(`Error procesando fecha ${fechaFormateada}:`, errorDia);
        // Continuamos con el siguiente día aunque haya error en uno
      }
      
      // Avanzar al siguiente día usando dayjs
      fechaActual = fechaActual.add(1, 'day');
    }
    
    // Guardar todos los reportes en la base de datos
    if (reportes.length > 0) {
      // Preparar consulta para inserción masiva
      const insertQuery = `
        INSERT INTO reportes (
          trabajador_id,
          frecuencia_cardiaca,
          saturacion_oxigeno,
          temperatura_corporal,
          frecuencia_respiratoria,
          nivel_estres,
          horas_sueno,
          calidad_sueno,
          efectividad_sueno,
          variabilidad_cardiaca,
          pasos,
          fecha_hora
        ) VALUES ?
      `;
      
      // Preparar valores para inserción
      const values = reportes.map(r => [
        r.trabajador_id,
        r.frecuencia_cardiaca,
        r.saturacion_oxigeno,
        r.temperatura_corporal,
        r.frecuencia_respiratoria,
        r.nivel_estres,
        r.horas_sueno,
        r.calidad_sueno,
        r.efectividad_sueno,
        r.variabilidad_cardiaca,
        r.pasos,
        r.fecha_hora
      ]);
      
      // Ejecutar inserción
      await connectionPromise.query(insertQuery, [values]);
      console.log(`✅ Guardados ${reportes.length} reportes históricos para el trabajador ${workerId}`);
      
      return {
        success: true,
        message: `Se importaron ${reportes.length} registros históricos`,
        fechaInicio,
        fechaFin
      };
    } else {
      return {
        success: false,
        message: "No se encontraron datos válidos para importar en el rango de fechas especificado"
      };
    }
  } catch (error) {
    console.error("❌ Error general al obtener/guardar datos históricos:", error);
    return {
      success: false,
      message: "Error al procesar los datos históricos",
      error: error.message
    };
  } finally {
    await connectionPromise.end();
  }
}

// ========================================================
// Exportar funciones
// ========================================================
module.exports = {
  obtenerYGuardarDatosHistoricos
};