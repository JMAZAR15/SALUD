/**
 * personal.js - Script principal para la página de datos personales del trabajador
 * Este archivo maneja la obtención y visualización de datos personales y de Fitbit
 * para un trabajador específico.
 */

// Añade esta función al inicio de tu archivo personal.js
function mostrarNotificacion(mensaje, tipo) {
  // Crear el elemento de notificación
  const notificacion = document.createElement('div');
  notificacion.className = `alert alert-${tipo} alert-dismissible fade show`;
  notificacion.style.position = 'fixed';
  notificacion.style.top = '20px';
  notificacion.style.right = '20px';
  notificacion.style.zIndex = '9999';
  notificacion.style.boxShadow = '0 4px 8px rgba(0, 0, 0, 0.2)';
  notificacion.style.minWidth = '300px';
  
  // Añadir contenido HTML
  notificacion.innerHTML = `
    <div class="d-flex align-items-center">
      <i class="material-icons me-2">${tipo === 'success' ? 'check_circle' : 
                                     tipo === 'danger' ? 'error' : 
                                     tipo === 'warning' ? 'warning' : 'info'}</i>
      <div>
        ${mensaje}
      </div>
    </div>
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
  `;
  
  // Añadir al cuerpo del documento
  document.body.appendChild(notificacion);
  
  // Configurar temporizador para remover la notificación
  setTimeout(() => {
    notificacion.classList.remove('show');
    setTimeout(() => {
      document.body.removeChild(notificacion);
    }, 300); // Dar tiempo para que termine la animación
  }, 4000); // Mostrar por 4 segundos
}

// Y luego, al inicio de tu código principal (dentro del event listener DOMContentLoaded)
document.addEventListener("DOMContentLoaded", async () => {
  // Comprobar si hay parámetros de éxito de autenticación
  const urlParams = new URLSearchParams(window.location.search);
  const authSuccess = urlParams.get('auth_success');
  const trabajadorId = urlParams.get('id') || urlParams.get('worker_id');
  
  if (authSuccess === 'true' && trabajadorId) {
    mostrarNotificacion(`¡Autenticación exitosa! Token del trabajador ${trabajadorId} obtenido correctamente`, 'success');
  }
  
  // El resto de tu código existente...
});



// Función global para extraer parámetros de la URL
function getQueryParam(param) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(param);
}

// Evento principal cuando el DOM está cargado
document.addEventListener("DOMContentLoaded", async () => {
  console.log("🔄 Inicializando página de datos personales...");
  
  // Obtener ID del trabajador desde la URL
  const trabajadorId = getQueryParam("id");
  
  if (!trabajadorId) {
    console.error("❌ No se proporcionó un ID en la URL.");
    return;
  }
  
  // Configuración de elementos para la selección de datos
  const dataTypeSelect = document.getElementById("dataType");
  const containers = {
    time: document.getElementById("time-range-container"),
    date: document.getElementById("date-range-container"),
    temp: document.getElementById("temp-range-container"),
    sleep: document.getElementById("sleep-range-container"),
    ecg: document.getElementById("ecg-range-container"),
    hrv1: document.getElementById("hrv-range-container")
  };
  
  // Función para actualizar la visibilidad de los contenedores según el tipo de dato seleccionado
  function updateInputVisibility() {
    if (!dataTypeSelect) return;
    
    const selectedType = dataTypeSelect.value;
    console.log("🔍 Tipo de dato seleccionado:", selectedType);
    
    // Ocultar todos los contenedores primero
    Object.values(containers).forEach(container => {
      if (container) {
        container.style.display = "none";
      }
    });
    
    // Mostrar solo el contenedor apropiado
    if (["heart", "activities", "activeZones"].includes(selectedType)) {
      if (containers.time) containers.time.style.display = "block";
    } else if (selectedType === "temp") {
      if (containers.temp) containers.temp.style.display = "block";
    } else if (selectedType === "sleep") {
      if (containers.sleep) containers.sleep.style.display = "block";
    } else if (selectedType === "ecg") {
      if (containers.ecg) containers.ecg.style.display = "block";
    } else if (selectedType === "hrv1") {
      if (containers.hrv1) containers.hrv1.style.display = "block";
    } else {
      if (containers.date) containers.date.style.display = "block";
    }
  }
  // Actualizar visibilidad al cargar y al cambiar el selector
  if (dataTypeSelect) {
    updateInputVisibility();
    dataTypeSelect.addEventListener("change", updateInputVisibility);
  }
  
  try {
    console.log("🔄 Obteniendo datos básicos del trabajador...");
    
    // Obtener datos básicos del trabajador
    const response = await fetch(`http://localhost:3000/mostrar-trabajador?id=${trabajadorId}`);
    
    if (!response.ok) {
      throw new Error(`Error al obtener datos del trabajador: ${response.status}`);
    }
    
    const trabajador = await response.json();
    if (!trabajador) {
      console.error("❌ Trabajador no encontrado.");
      return;
    }
    
    console.log("✅ Datos del trabajador obtenidos:", trabajador);
    
    // Calcular edad actual desde fecha_nacimiento
    const birthDate = new Date(trabajador.fecha_nacimiento);
    const today = new Date();

    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();

    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }




    // Actualizar los paneles de datos personales
    document.getElementById("nombre").textContent = trabajador.nombre + " " + trabajador.apellido || "--";
    document.getElementById("cargo").textContent = trabajador.cargo || "--";
    document.getElementById("edad").textContent = age || "--";
    
    document.getElementById("foto").src = trabajador.dni ? `imagenes/trabajadores/${trabajador.dni}.jpg` : "imagenes/trabajadores/default.jpg";
    
    // Obtener datos del perfil de Fitbit
    try {
      console.log("🔄 Obteniendo perfil de Fitbit local...");
      
      // Mostramos el indicador de carga si existe
      if (document.getElementById("fitbit-loading")) {
        document.getElementById("fitbit-loading").style.display = "block";
      }
      
      const fitbitResponse = await fetch(`http://localhost:3000/api/fitbit-profile-local?worker_id=${trabajadorId}`);
      
      // Ocultamos el indicador de carga
      if (document.getElementById("fitbit-loading")) {
        document.getElementById("fitbit-loading").style.display = "none";
      }
      if (!fitbitResponse.ok) {
        console.warn("⚠️ No se encontró perfil local de Fitbit:", await fitbitResponse.text());
        throw new Error("No se encontró perfil local");
      }
      
      const fitbitData = await fitbitResponse.json();
      console.log("✅ Datos de perfil Fitbit obtenidos:", fitbitData);
      
      // Actualizar paneles con datos de Fitbit
      actualizarDatosFitbit(fitbitData);
      
      // Ocultar mensaje de error y mostrar botón para ver perfil completo
      if (document.getElementById("fitbit-error")) {
        document.getElementById("fitbit-error").style.display = "none";
      }
      if (document.getElementById("ver-perfil-completo")) {
        document.getElementById("ver-perfil-completo").style.display = "block";
      }
      
    } catch (fitbitError) {
      console.error("❌ Error obteniendo datos de Fitbit:", fitbitError);
      
      // Mostrar mensaje de error si el elemento existe
      if (document.getElementById("fitbit-error")) {
        document.getElementById("fitbit-error").style.display = "block";
      }
    }
    
    // Configurar botones
    configurarBotones(trabajadorId);
    
    // Manejador del formulario para obtener datos de Fitbit
    configurarFormularioFitbit(trabajadorId);
    
  } catch (error) {
    console.error("❌ Error general obteniendo datos:", error);
  }
});

/**
 * Actualiza la interfaz con los datos del perfil de Fitbit
 * @param {Object} fitbitData - Datos del perfil de Fitbit
 */
function actualizarDatosFitbit(fitbitData) {
  // Verificar que los elementos existan antes de actualizarlos
  if (document.getElementById("peso")) {
    document.getElementById("peso").textContent = fitbitData.peso ? `${fitbitData.peso} kg` : "--";
  }
  if (document.getElementById("altura")) {
    document.getElementById("altura").textContent = fitbitData.altura ? `${fitbitData.altura} cm` : "--";
  }
  
  if (document.getElementById("promedio-pasos")) {
    document.getElementById("promedio-pasos").textContent = fitbitData.promedio_pasos_diarios || "--";
  }
  
  if (document.getElementById("ultima-actualizacion")) {
    document.getElementById("ultima-actualizacion").textContent = fitbitData.ultimo_sincronizado ? 
      new Date(fitbitData.ultimo_sincronizado).toLocaleString() : "--";
  }
  
  console.log("✅ Interfaz actualizada con datos de Fitbit");
}

/**
 * Configura los botones para las acciones relacionadas con Fitbit
 * @param {string} trabajadorId - ID del trabajador
 */
function configurarBotones(trabajadorId) {
  // Botón para refrescar datos de Fitbit
  const refreshBtn = document.getElementById("refresh-fitbit-btn");
  if (refreshBtn) {
    refreshBtn.addEventListener("click", async function() {
      try {
        console.log("🔄 Actualizando datos desde Fitbit...");
        
        // Mostrar indicador de carga
        if (document.getElementById("fitbit-loading")) {
          document.getElementById("fitbit-loading").style.display = "block";
        }
        
        // Llamar a la API para obtener y guardar el perfil actualizado
        const response = await fetch(`http://localhost:3000/api/fitbit-profile?worker_id=${trabajadorId}`);
        
        // Ocultar indicador de carga
        if (document.getElementById("fitbit-loading")) {
          document.getElementById("fitbit-loading").style.display = "none";
        }
        
        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Error desconocido");
        }
        const profileData = await response.json();
        console.log("✅ Perfil de Fitbit actualizado:", profileData);
        
        // Actualizar la interfaz con los nuevos datos
        const updatedResponse = await fetch(`http://localhost:3000/api/fitbit-profile-local?worker_id=${trabajadorId}`);
        
        if (!updatedResponse.ok) {
          throw new Error("No se pudo obtener el perfil actualizado");
        }
        
        const updatedData = await updatedResponse.json();
        actualizarDatosFitbit(updatedData);
        
        // Mostrar mensaje de éxito
        if (document.getElementById("fitbit-success")) {
          document.getElementById("fitbit-success").style.display = "block";
          setTimeout(() => {
            document.getElementById("fitbit-success").style.display = "none";
          }, 3000);
        }
        
        // Ocultar mensaje de error si estaba visible
        if (document.getElementById("fitbit-error")) {
          document.getElementById("fitbit-error").style.display = "none";
        }
        
        // Mostrar botón para ver perfil completo
        if (document.getElementById("ver-perfil-completo")) {
          document.getElementById("ver-perfil-completo").style.display = "block";
        }
        
      } catch (error) {
        console.error("❌ Error al actualizar datos de Fitbit:", error);
        
        // Ocultar indicador de carga y mostrar error
        if (document.getElementById("fitbit-loading")) {
          document.getElementById("fitbit-loading").style.display = "none";
        }
        if (document.getElementById("fitbit-error")) {
          document.getElementById("fitbit-error").style.display = "block";
        }
      }
    });
  }
  
  // Botón para autorizar Fitbit
  const authBtn = document.getElementById("auth-fitbit-btn");
  if (authBtn) {
    authBtn.addEventListener("click", function() {
      console.log("🔄 Redirigiendo a autorización de Fitbit...");
      window.location.href = `/auth/fitbit?worker_id=${trabajadorId}`;
    });
  }
// Botón para ver perfil completo
const verPerfilBtn = document.getElementById("ver-perfil-btn");
if (verPerfilBtn) {
  verPerfilBtn.addEventListener("click", function() {
    console.log("🔄 Redirigiendo a perfil completo...");
    window.location.href = `perfil-completo.html?id=${trabajadorId}`;
  });
}

console.log("✅ Botones configurados");
}


/**
* Función para obtener datos de estrés desde la API
* @param {string} trabajadorId - ID del trabajador
* @param {string} [date] - Fecha opcional para la consulta
*/
async function fetchStressData(trabajadorId, date) {
try {
  console.log("🔄 Obteniendo datos de estrés...");
  
  let url = `/api/fitbit-stress?worker_id=${trabajadorId}`;
  if (date) {
    url += `&date=${encodeURIComponent(date)}`;
  }
  
  const response = await fetch(url);
  
  if (!response.ok) {
    throw new Error(`Error: ${response.status}`);
  }
  
  const stressData = await response.json();
  console.log("✅ Datos de estrés obtenidos:", stressData);
  
  // Mostrar índice de estrés global
  const stressIndexElement = document.getElementById('stress-index');
  if (stressIndexElement) {
    stressIndexElement.textContent = `Índice de Estrés: ${stressData.stressIndex}/100`;
  }
  
  // Mostrar desglose de componentes usando las claves actuales
  const stressBreakdownElement = document.getElementById('stress-breakdown');
  if (stressBreakdownElement && stressData.components) {
    stressBreakdownElement.innerHTML = `
      <p>Respuesta Autonómica: ${stressData.components.autonomicResponseScore}/100</p>
      <p>Balance de Actividad: ${stressData.components.physicalActivityBalanceScore}/100</p>
      <p>Patrón de Sueño: ${stressData.components.sleepPatternScore}/100</p>
      <p>EDA Estimado: ${stressData.components.estimatedEDAScore}/100</p>
      <p>SPO₂: ${stressData.components.spo2Score}/100</p>
      <p>Frecuencia Respiratoria: ${stressData.components.respiratoryScore}/100</p>
      <p>Recuperación: ${stressData.components.recovery.recoveryScore}/100</p>
    `;
  }
// Actualizar el valor en el panel principal
const stressValueElement = document.getElementById("stress-value");
if (stressValueElement) {
  stressValueElement.textContent = `${stressData.stressIndex} %`;
}

return stressData;
} catch (error) {
console.error('❌ Error al obtener datos de estrés:', error);
return null;
}
}

/**
* Configura el formulario para obtener datos de Fitbit
* @param {string} trabajadorId - ID del trabajador
*/
function configurarFormularioFitbit(trabajadorId) {
const fitbitForm = document.getElementById("fitbit-form");
if (!fitbitForm) return;

fitbitForm.addEventListener("submit", async (e) => {
e.preventDefault();
console.log("🔄 Procesando solicitud de datos de Fitbit...");

const dataTypeSelect = document.getElementById("dataType");
if (!dataTypeSelect) return;

const dataType = dataTypeSelect.value;
let queryUrl = `/api/fitbit-data/${dataType}?worker_id=${trabajadorId}`;

// Validación y construcción de parámetros para datos
if (["heart", "activities", "activeZones"].includes(dataType)) {
  // Si es un dato intradía, usamos selectores de hora
  const startHour = document.getElementById("startHour").value;
  const startMinute = document.getElementById("startMinute").value;
  const endHour = document.getElementById("endHour").value;
  const endMinute = document.getElementById("endMinute").value;
  
  const startTime = `${startHour}:${startMinute}`;
  const endTime = `${endHour}:${endMinute}`;
  queryUrl += `&start=${encodeURIComponent(startTime)}&end=${encodeURIComponent(endTime)}`;
} else if (["temp", "sleep", "ecg", "hrv1"].includes(dataType)) {
  let startDate, endDate;
  
  if (dataType === "temp") {
    startDate = document.getElementById("startDate").value;
    endDate = document.getElementById("endDate").value;
  } else if (dataType === "sleep") {
    startDate = document.getElementById("sleepStartDate").value;
    endDate = document.getElementById("sleepEndDate").value;
  } else if (dataType === "ecg") {
    startDate = document.getElementById("ecgStartDate").value;
    endDate = document.getElementById("ecgEndDate").value;
  } else if (dataType === "hrv1") {
    startDate = document.getElementById("hrvStartDate").value;
    endDate = document.getElementById("hrvEndDate").value;
  }
  if (!startDate || !endDate) {
    alert("Por favor, selecciona las fechas de inicio y fin.");
    return;
  }
  
  queryUrl += `&start=${encodeURIComponent(startDate)}&end=${encodeURIComponent(endDate)}`;
} else if (dataType === "stress") {
  // Utilizamos la nueva ruta /api/fitbit-stress
  const dateSelected = document.getElementById("dateSelected").value;
  
  // Si se selecciona una fecha específica para el estrés
  if (dateSelected) {
    await fetchStressData(trabajadorId, dateSelected);
  } else {
    await fetchStressData(trabajadorId);
  }
  
  return; // Salimos porque ya se manejan los datos con fetchStressData
} else {
  // Para datos diarios, usamos el selector de fecha única
  const dateSelected = document.getElementById("dateSelected").value;
  if (!dateSelected) {
    alert("Por favor, selecciona una fecha.");
    return;
  }
  queryUrl += `&date=${encodeURIComponent(dateSelected)}`;
}

console.log("🔍 URL de consulta:", queryUrl);

// Realización de la solicitud fetch a la API
try {
  const response = await fetch(queryUrl);
  
  if (!response.ok) {
    throw new Error(`Error: ${response.status}`);
  }
  
  const data = await response.json();
  console.log("✅ Datos obtenidos de Fitbit:", data);
  
  // Procesar y visualizar los datos según el tipo
  procesarDatosFitbit(dataType, data);
  
} catch (error) {
  console.error("❌ Error al obtener datos de Fitbit:", error);
  
  const fitbitDataDiv = document.getElementById("fitbitData");
  if (fitbitDataDiv) {
    fitbitDataDiv.innerHTML = `
      <div class="alert alert-danger">
        Error al obtener datos de Fitbit: ${error.message}
      </div>
    `;
  }
}
});
}

/**
* Procesa y visualiza los datos de Fitbit según el tipo
* @param {string} dataType - Tipo de datos
* @param {Object} data - Datos obtenidos de la API
*/

function procesarDatosFitbit(dataType, data) {
  const fitbitDataDiv = document.getElementById("fitbitData");
  if (!fitbitDataDiv) return;
  
  let html = "";
  
  switch (dataType) {
    case "heart":
      html = procesarDatosCorazon(data);
      break;
    case "activities":
      html = procesarDatosActividades(data);
      break;
    case "respiratory":
      html = procesarDatosRespiratorios(data);
      break;
    case "hrv1":
      html = procesarDatosHRV(data);
      break;
    case "spo21":
      html = procesarDatosSPO2(data);
      break;
    case "activeZones":
      html = procesarDatosZonasActivas(data);
      break;
    case "temp":
      html = procesarDatosTemperatura(data);
      break;
    case "sleep":
      html = procesarDatosSueno(data);
      break;
    case "ecg":
      html = procesarDatosECG(data);
      break;
    default:
      html = `<div class="alert alert-warning">Tipo de datos no reconocido: ${dataType}</div>`;
  }
  
  // Inyectar el HTML generado
  fitbitDataDiv.innerHTML = html;
}

/**
 * Procesa datos de frecuencia cardíaca
 * @param {Object} data - Datos de frecuencia cardíaca
 * @returns {string} HTML para mostrar los datos
 */
function procesarDatosCorazon(data) {
  let html = '<div class="row">';
  let resumenHTML = "";
  
  // Verificamos si tenemos datos intradía
  if (data["activities-heart-intraday"] && 
      data["activities-heart-intraday"].dataset && 
      data["activities-heart-intraday"].dataset.length > 0) {
    
    const heartRateData = data["activities-heart-intraday"].dataset;
    // Calcular valores estadísticos
    const valores = heartRateData.map(item => parseInt(item.value));
    const promedio = valores.reduce((a, b) => a + b, 0) / valores.length;
    const minimo = Math.min(...valores);
    const maximo = Math.max(...valores);
    
    // Cálculo de la variabilidad (desviación estándar simple)
    const variabilidad = Math.sqrt(
      valores.map(x => Math.pow(x - promedio, 2)).reduce((a, b) => a + b, 0) / valores.length
    );
// Fecha/hora del resumen
let fechaResumen;
if (data["activities-heart"] && data["activities-heart"].length > 0) {
  fechaResumen = data["activities-heart"][0].dateTime;
} else {
  const primerRegistro = heartRateData[0].time;
  const ultimoRegistro = heartRateData[heartRateData.length - 1].time;
  fechaResumen = `Período ${primerRegistro} - ${ultimoRegistro}`;
}

// Generar resumen HTML
resumenHTML = `
  <div class="card text-dark bg-info mb-3">
    <div class="card-body">
      <h5 class="card-title">Resumen de Frecuencia Cardíaca para ${fechaResumen}</h5>
      <p class="card-text"><strong>Promedio:</strong> ${promedio.toFixed(1)} bpm</p>
      <p class="card-text"><strong>Mínimo:</strong> ${minimo} bpm</p>
      <p class="card-text"><strong>Máximo:</strong> ${maximo} bpm</p>
      <p class="card-text"><strong>Variabilidad:</strong> ${variabilidad.toFixed(2)} bpm</p>
      <p class="card-text"><strong>Total de lecturas:</strong> ${heartRateData.length}</p>
    </div>
  </div>
`;

// Añadir el resumen al HTML principal
html += `
  <div class="col-md-12 mb-3">
    ${resumenHTML}
  </div>
  <div class="col-md-12 mb-3"><h5>Lecturas por minuto</h5></div>
`;

// Añadir lecturas individuales
heartRateData.forEach(item => {
  html += `
    <div class="col-md-3 mb-3">
      <div class="card text-dark bg-light">
        <div class="card-body">
          <h5 class="card-title">${item.time}</h5>
          <p class="card-text"><strong>Latidos:</strong> ${item.value} bpm</p>
        </div>
      </div>
    </div>
  `;
});

// Actualizar la tarjeta de frecuencia cardíaca en la interfaz principal
const matchPromedio = resumenHTML.match(/<strong>Promedio:<\/strong>\s*([\d.]+)\s*bpm/);
if (matchPromedio && matchPromedio[1]) {
  const hrValueElement = document.getElementById("hr-value");
  if (hrValueElement) {
    hrValueElement.textContent = `${matchPromedio[1]} bpm`;
  }
}
} 
// Si solo tenemos datos diarios
else if (data["activities-heart"] && data["activities-heart"].length > 0) {
const dailyData = data["activities-heart"][0];
const heartRate = dailyData.value.restingHeartRate || dailyData.value;

resumenHTML = `
  <div class="card text-dark bg-info mb-3">
    <div class="card-body">
      <h5 class="card-title">Resumen de Frecuencia Cardíaca para ${dailyData.dateTime}</h5>
      <p class="card-text"><strong>Promedio:</strong> ${heartRate} bpm</p>
    </div>
  </div>
`;

html += `
  <div class="col-md-12 mb-3">
    ${resumenHTML}
  </div>
  <div class="col-md-3 mb-3">
    <div class="card text-dark bg-light">
      <div class="card-body ">
      <div class="card-body">
            <h5 class="card-title">${dailyData.dateTime}</h5>
            <p class="card-text"><strong>Latidos por minuto:</strong> ${heartRate} bpm</p>
          </div>
        </div>
      </div>
    `;
    
    // Actualizar valor en panel principal
    const hrValueElement = document.getElementById("hr-value");
    if (hrValueElement) {
      hrValueElement.textContent = `${heartRate} bpm`;
    }
  } else {
    html = "<p>No se encontraron datos de frecuencia cardíaca para el rango especificado.</p>";
  }
  
  html += '</div>';
  html += `<div id="resumenFrecuenciaCardiaca" style="display:none">${resumenHTML}</div>`;
  
  return html;
}

/**
 * Procesa datos de actividades
 * @param {Object} data - Datos de actividades
 * @returns {string} HTML para mostrar los datos
 */
function procesarDatosActividades(data) {
  let html = '<div class="row">';
  let resumenHTML = "";
  
  // INICIO - RESUMEN DE ACTIVIDADES (PASOS)
  if (data["activities-steps-intraday"] &&
      data["activities-steps-intraday"].dataset &&
      data["activities-steps-intraday"].dataset.length > 0) {
      
    const stepsData = data["activities-steps-intraday"].dataset;
    // Calcular valores estadísticos
    const valores = stepsData.map(item => parseInt(item.value));
    const totalPasos = valores.reduce((a, b) => a + b, 0);
    const promedioPorMinuto = totalPasos / stepsData.length;
    const maximo = Math.max(...valores);
    
    // Calcular períodos de actividad (minutos con >0 pasos)
    const minutosActivos = valores.filter(v => v > 0).length;
    const porcentajeActivo = (minutosActivos / stepsData.length * 100).toFixed(1);
    
    // Fecha/hora del resumen
    const primerRegistro = stepsData[0].time;
    const ultimoRegistro = stepsData[stepsData.length - 1].time;
    const fechaResumen = `Período ${primerRegistro} - ${ultimoRegistro}`;

// Generar resumen HTML
resumenHTML = `
<div class="card text-dark bg-info mb-3">
  <div class="card-body">
    <h5 class="card-title">Resumen de Actividad para ${fechaResumen}</h5>
    <p class="card-text"><strong>Total de pasos:</strong> ${totalPasos.toLocaleString()}</p>
    <p class="card-text"><strong>Promedio por minuto:</strong> ${promedioPorMinuto.toFixed(1)} pasos/min</p>
    <p class="card-text"><strong>Máximo en un minuto:</strong> ${maximo} pasos</p>
    <p class="card-text"><strong>Minutos activos:</strong> ${minutosActivos} (${porcentajeActivo}% del tiempo)</p>
    <p class="card-text"><strong>Total de lecturas:</strong> ${stepsData.length}</p>
  </div>
</div>
`;

// Añadir el resumen al HTML principal
html += `
<div class="col-md-12 mb-3">
  ${resumenHTML}
</div>
<div class="col-md-12 mb-3"><h5>Pasos por minuto</h5></div>
`;

// Añadir lecturas individuales
stepsData.forEach(item => {
html += `
  <div class="col-md-3 mb-3">
    <div class="card text-dark bg-light">
      <div class="card-body">
        <h5 class="card-title">${item.time}</h5>
        <p class="card-text"><strong>PASOS:</strong> ${item.value}</p>
      </div>
    </div>
  </div>
`;
});

// Actualizar tarjeta de efectividad del sueño (usando porcentaje activo como aproximación)
if (resumenHTML) {
const match = resumenHTML.match(/\((\d+\.\d+)% del tiempo\)/);
if (match && match[1]) {
  const sleepValueElement = document.getElementById("sleep-value");
  if (sleepValueElement) {
    sleepValueElement.textContent = `${match[1]} %`;
  }
}
}
} else {
html = "<p>No se encontraron datos para el rango especificado.</p>";
}

html += '</div>';
html += `<div id="resumenActividades" style="display:none">${resumenHTML}</div>`;

return html;
}

/**
* Procesa datos respiratorios
* @param {Object} data - Datos respiratorios
* @returns {string} HTML para mostrar los datos
*/

function procesarDatosRespiratorios(data) {
  let html = '<div class="row">';
  let resumenHTML = "";
  
  // INICIO - RESUMEN DE FRECUENCIA RESPIRATORIA
  // Verificar primero si tenemos datos por minuto
  if (data.breathingRate && data.breathingRate.minutes && data.breathingRate.minutes.length > 0) {
    const respData = data.breathingRate.minutes;
    const fecha = data.breathingRate.dateTime || 'el día seleccionado';
    
    // Calcular valores estadísticos
    const valores = respData.map(item => item.value);
    const promedio = valores.reduce((a, b) => a + b, 0) / valores.length;
    const minimo = Math.min(...valores);
    const maximo = Math.max(...valores);
    
    // Cálculo de la variabilidad (desviación estándar simple)
    const variabilidad = Math.sqrt(
      valores.map(x => Math.pow(x - promedio, 2)).reduce((a, b) => a + b, 0) / valores.length
    );
    
    // Generar resumen HTML
    resumenHTML = `
      <div class="card text-dark bg-info mb-3">
        <div class="card-body">
          <h5 class="card-title">Resumen Respiratorio para ${fecha}</h5>
          <p class="card-text"><strong>Promedio:</strong> ${promedio.toFixed(1)} resp/min</p>
          <p class="card-text"><strong>Mínimo:</strong> ${minimo.toFixed(1)} resp/min</p>
          <p class="card-text"><strong>Máximo:</strong> ${maximo.toFixed(1)} resp/min</p>
          <p class="card-text"><strong>Variabilidad:</strong> ${variabilidad.toFixed(2)} resp/min</p>
          <p class="card-text"><strong>Total de lecturas:</strong> ${respData.length}</p>
        </div>
      </div>
    `;
    
    // Añadir el resumen al HTML principal
    html += `
      <div class="col-md-12 mb-3">
        ${resumenHTML}
      </div>
      <div class="col-md-12 mb-3"><h5>Frecuencia Respiratoria por minuto</h5></div>
    `;
    
    // Mostrar datos por minuto
    respData.forEach(item => {
      html += `
        <div class="col-md-3 mb-3">
          <div class="card text-dark bg-light">
            <div class="card-body">
              <h5 class="card-title">${item.minute.substring(11, 19)}</h5>
              <p class="card-text"><strong>Resp:</strong> ${item.value.toFixed(1)} resp/min</p>
            </div>
          </div>
        </div>
      `;
    });
  } 
  // Si no hay datos por minuto, intentamos con los datos de sueño tradicionales
  else if (data["br"] && data["br"].length > 0) {
    const brData = data["br"];
    
    // Crear un resumen de los diferentes estados de sueño
    const deepValues = brData.map(r => r.value.deepSleepSummary.breathingRate);
    const remValues = brData.map(r => r.value.remSleepSummary.breathingRate);
    const lightValues = brData.map(r => r.value.lightSleepSummary.breathingRate);
    const fullValues = brData.map(r => r.value.fullSleepSummary.breathingRate);
     
    // Promedios para cada tipo
    const deepAvg = deepValues.reduce((a, b) => a + b, 0) / deepValues.length;
    const remAvg = remValues.reduce((a, b) => a + b, 0) / remValues.length;
    const lightAvg = lightValues.reduce((a, b) => a + b, 0) / lightValues.length;
    const fullAvg = fullValues.reduce((a, b) => a + b, 0) / fullValues.length;
    
    // Fecha del resumen
    const fecha = brData[0].dateTime || 'el día seleccionado';
    
    // Generar resumen HTML
    resumenHTML = `
      <div class="card text-dark bg-info mb-3">
        <div class="card-body">
          <h5 class="card-title">Resumen Respiratorio durante el Sueño para ${fecha}</h5>
          <p class="card-text"><strong>Promedio en Sueño Profundo:</strong> ${deepAvg.toFixed(1)} resp/min</p>
          <p class="card-text"><strong>Promedio en Sueño REM:</strong> ${remAvg.toFixed(1)} resp/min</p>
          <p class="card-text"><strong>Promedio en Sueño Ligero:</strong> ${lightAvg.toFixed(1)} resp/min</p>
          <p class="card-text"><strong>Promedio General:</strong> ${fullAvg.toFixed(1)} resp/min</p>
          <p class="card-text"><strong>Total de períodos:</strong> ${brData.length}</p>
        </div>
      </div>
    `;
    
    // Añadir el resumen al HTML principal
    html += `
      <div class="col-md-12 mb-3">
        ${resumenHTML}
      </div>
      <div class="col-md-12 mb-3"><h5>Frecuencia Respiratoria por fase de sueño</h5></div>
    `;
    
    brData.forEach(record => {
      html += `
        <div class="col-md-6 mb-3">
          <div class="card text-dark bg-light">
            <div class="card-body">
              <h5 class="card-title">${record.dateTime}</h5>
              <p class="card-text"><strong>Sueño Profundo:</strong> ${record.value.deepSleepSummary.breathingRate} resp/min</p>
              <p class="card-text"><strong>Sueño REM:</strong> ${record.value.remSleepSummary.breathingRate} resp/min</p>
              <p class="card-text"><strong>Sueño Ligero:</strong> ${record.value.lightSleepSummary.breathingRate} resp/min</p>
              <p class="card-text"><strong>Sueño Completo:</strong> ${record.value.fullSleepSummary.breathingRate} resp/min</p>
            </div>
          </div>
        </div>
      `;
    });
  } else {
    html = "<p>No se encontraron datos de frecuencia respiratoria para el día seleccionado.</p>";
  }
  
  html += '</div>';
  html += `<div id="resumenRespiratoria" style="display:none">${resumenHTML}</div>`;
  
  return html;
}
/**
 * Procesa datos de SPO2
 * @param {Object} data - Datos de saturación de oxígeno
 * @returns {string} HTML para mostrar los datos
 */
function procesarDatosSPO2(data) {
  let html = '<div class="row">';
  let resumenHTML = "";
  
  // Verificar si tenemos la estructura correcta
  if (data.dateTime && data.minutes && data.minutes.length > 0) {
    const date = data.dateTime;
    const minutes = data.minutes;
    
    // Calcular estadísticas
    const valores = minutes.map(m => m.value);
    const promedio = valores.reduce((a, b) => a + b, 0) / valores.length;
    const minimo = Math.min(...valores);
    const maximo = Math.max(...valores);
    
    // Calcular la variabilidad (desviación estándar)
    const variabilidad = Math.sqrt(
      valores.map(x => Math.pow(x - promedio, 2)).reduce((a, b) => a + b, 0) / valores.length
    );
    
    // Calcular porcentaje de tiempo por debajo del 95% (umbral saludable)
    const lecturasBajas = valores.filter(v => v < 95).length;
    const porcentajeBajo = (lecturasBajas / valores.length * 100).toFixed(1);
    
    // Generar resumen HTML
    resumenHTML = `
      <div class="card text-dark bg-info mb-3">
        <div class="card-body">
          <h5 class="card-title">Resumen SPO₂ para ${date}</h5>
          <p class="card-text"><strong>Promedio:</strong> ${promedio.toFixed(1)}%</p>
          <p class="card-text"><strong>Máximo:</strong> ${maximo.toFixed(1)}%</p>
          <p class="card-text"><strong>Variabilidad:</strong> ${variabilidad.toFixed(2)}%</p>
          <p class="card-text"><strong>Tiempo bajo 95%:</strong> ${porcentajeBajo}% (${lecturasBajas} lecturas)</p>
          <p class="card-text"><strong>Total de lecturas:</strong> ${minutes.length}</p>
        </div>
      </div>
    `;
    
    // Añadir el resumen al HTML principal
    html += `
      <div class="col-md-12 mb-3">
        ${resumenHTML}
      </div>
      <div class="col-md-12 mb-3"><h5>Lecturas por minuto</h5></div>
    `;
    
    // Mostrar lecturas individuales
    minutes.forEach(item => {
      // Añadir clase para destacar valores por debajo del 95%
      const valorClass = item.value < 95 ? "text-danger" : "";
      
      html += `
        <div class="col-md-3 mb-3">
          <div class="card text-dark bg-light">
            <div class="card-body">
              <h5 class="card-title">${item.minute.substring(11, 19)}</h5>
              <p class="card-text ${valorClass}"><strong>SPO₂:</strong> ${item.value.toFixed(1)}%</p>
            </div>
          </div>
        </div>
      `;
    });
    
    // Actualizar la tarjeta de SPO2 en la interfaz principal
    const spo2ValueElement = document.getElementById("spo2-value");
    if (spo2ValueElement) {
      spo2ValueElement.textContent = `${promedio.toFixed(1)} %`;
    }
  } else {
    html = "<p>No se encontraron datos de SPO₂ para el día seleccionado o la estructura de datos es inesperada.</p>";
  }
  
  html += '</div>';
  html += `<div id="resumenSPO2" style="display:none">${resumenHTML}</div>`;
  
  return html;
}
/**
 * Procesa datos de zonas activas
 * @param {Object} data - Datos de zonas activas
 * @returns {string} HTML para mostrar los datos
 */
function procesarDatosZonasActivas(data) {
  let html = '<div class="row">';
  let resumenHTML = "";
  
  // Verificar si la propiedad intradía es un array y obtener el primer elemento si es así
  let intradayData = data["activities-active-zone-minutes-intraday"];
  if (Array.isArray(intradayData)) {
    intradayData = intradayData[0];
  }
  
  if (intradayData && intradayData.minutes && intradayData.minutes.length > 0) {
    const zonesData = intradayData.minutes;
    let totalZoneMinutes = 0;
    
    // Sumar los minutos activos
    zonesData.forEach(item => {
      totalZoneMinutes += item.value.activeZoneMinutes;
    });
    
    // Generar el resumen (se guarda para la tarjeta principal)
    resumenHTML = `
      <div class="card text-dark bg-info mb-3">
        <div class="card-body">
          <h5 class="card-title">Resumen de Zonas Activas (Intraday)</h5>
          <p class="card-text"><strong>Total:</strong> ${totalZoneMinutes} min</p>
        </div>
      </div>
    `;
    
    html += `
      <div class="col-md-12 mb-3">
        ${resumenHTML}
      </div>
      <div class="col-md-12 mb-3"><h5>Minutos por Zona</h5></div>
    `;
    
    // Generar tarjetas individuales por cada minuto
    zonesData.forEach(item => {
      // Extraer la hora en formato "HH:MM" de la cadena ISO
      const time = item.minute.substring(11, 16);
      html += `
        <div class="col-md-3 mb-3">
          <div class="card text-dark bg-light">
            <div class="card-body">
              <h5 class="card-title">${time}</h5>
              <p class="card-text"><strong>Minutos Activos:</strong> ${item.value.activeZoneMinutes} min</p>
            </div>
          </div>
        </div>
      `;
    });
    
    // Actualizar el panel principal con el total
    const activeZoneValueElement = document.getElementById("active-zone-value");
    if (activeZoneValueElement) {
      activeZoneValueElement.textContent = `${totalZoneMinutes} min`;
    }
  
  } else if (data["activities-active-zone-minutes"] && data["activities-active-zone-minutes"].length > 0) {
    // Caso de datos diarios
    const dailyData = data["activities-active-zone-minutes"][0];
    let fatBurnMinutes = dailyData.value.fatBurnActiveMinutes || 0;
    let cardioMinutes = dailyData.value.cardioActiveMinutes || 0;
    let peakMinutes = dailyData.value.peakActiveMinutes || 0;
    let totalMinutes =
      dailyData.value.activeZoneMinutes ||
      (fatBurnMinutes + cardioMinutes + peakMinutes);
      resumenHTML = `
      <div class="card text-dark bg-info mb-3">
        <div class="card-body">
          <h5 class="card-title">Resumen de Zonas Activas para ${dailyData.dateTime || 'el día seleccionado'}</h5>
          <p class="card-text"><strong>Total:</strong> ${totalMinutes} min</p>
          <p class="card-text"><strong>Quema de grasa:</strong> ${fatBurnMinutes} min</p>
          <p class="card-text"><strong>Cardio:</strong> ${cardioMinutes} min</p>
          <p class="card-text"><strong>Pico:</strong> ${peakMinutes} min</p>
        </div>
      </div>
    `;
    
    html += `<div class="col-md-12 mb-3">${resumenHTML}</div>`;
    
    // Actualizar el panel principal con el total
    const activeZoneValueElement = document.getElementById("active-zone-value");
    if (activeZoneValueElement) {
      activeZoneValueElement.textContent = `${totalMinutes} min`;
    }
  
  } else {
    html += `
      <div class="col-md-12 mb-3">
        <div class="alert alert-warning">
          No se encontraron datos de zonas activas para el período seleccionado.
          Si esto es inesperado, verifica que el dispositivo esté sincronizado y que tengas actividad registrada en este período.
        </div>
      </div>
    `;
  }
  
  html += '</div>';
  html += `<div id="resumenZonasActivas" style="display:none">${resumenHTML || ''}</div>`;
  
  return html;
}

/**
 * Procesa datos de temperatura
 * @param {Object} data - Datos de temperatura
 * @returns {string} HTML para mostrar los datos
 */
function procesarDatosTemperatura(data) {
  let html = '<div class="row">';
  let resumenHTML = "";
  
  console.log("✅ Procesando datos de temperatura...");
  
  // Verificamos si la propiedad "tempCore" existe y tiene datos
  if (data["tempCore"] && Array.isArray(data["tempCore"]) && data["tempCore"].length > 0) {
    console.log("🔹 Datos de tempCore encontrados:", data["tempCore"]);
    
    const tempData = data["tempCore"];
    const temperatures = tempData.map(record => parseFloat(record.value));
    const avgTemp = temperatures.reduce((a, b) => a + b, 0) / temperatures.length;
    const minTemp = Math.min(...temperatures);
    const maxTemp = Math.max(...temperatures);
    
    resumenHTML = `
      <div class="card text-dark bg-info mb-3">
        <div class="card-body">
          <h5 class="card-title">Resumen de Temperatura</h5>
          <p class="card-text"><strong>Promedio:</strong> ${avgTemp.toFixed(1)} °C</p>
          <p class="card-text"><strong>Mínimo:</strong> ${minTemp.toFixed(1)} °C</p>
          <p class="card-text"><strong>Máximo:</strong> ${maxTemp.toFixed(1)} °C</p>
          <p class="card-text"><strong>Total de registros:</strong> ${tempData.length}</p>
        </div>
      </div>
    `;
    html += `<div class="col-md-12 mb-3">${resumenHTML}</div>`;
    
    // Iterar por cada registro y mostrarlo en una tarjeta
    tempData.forEach(record => {
      const formattedDate = new Date(record.dateTime).toLocaleString();
      html += `
        <div class="col-md-3 mb-3">
          <div class="card text-dark bg-light">
            <div class="card-body">
              <h5 class="card-title">${formattedDate}</h5>
              <p class="card-text"><strong>Temperatura:</strong> ${record.value.toFixed(1)} °C</p>
            </div>
          </div>
        </div>
      `;
    });
    
    // Actualizar la tarjeta de temperatura en la interfaz principal
    const tempValueElement = document.getElementById("temp-value");
    if (tempValueElement) {
      tempValueElement.textContent = `${avgTemp.toFixed(1)} °C`;
    }
  } else {
    console.log("⚠️ No se encontraron datos en 'tempCore'.");
    html = "<p>No se encontraron datos de temperatura para el rango seleccionado.</p>";
  }
  
  html += '</div>';
  html += `<div id="resumenTemp" style="display:none">${resumenHTML || ''}</div>`;
  
  return html;
}

/**
 * Procesa datos de sueño
 * @param {Object} data - Datos de sueño
 * @returns {string} HTML para mostrar los datos
 */
function procesarDatosSueno(data) {
  let html = '<div class="row">';
  let resumenHTML = "";
  
  if (data.sleep && data.sleep.length > 0) {
    const sleepData = data.sleep;
    
    // Ajustar la fecha de los registros de sueño sumando 24 horas
    const adjustedSleepData = sleepData.map(record => {
      const adjustedDate = new Date(record.dateOfSleep);
      adjustedDate.setDate(adjustedDate.getDate() + 1); // Sumar 1 día
      return {
        ...record,
        adjustedDateOfSleep: adjustedDate
      };
    });

    const totalSleepMinutes = adjustedSleepData.reduce((sum, record) => sum + record.minutesAsleep, 0);
    const avgSleepMinutes = totalSleepMinutes / adjustedSleepData.length;
    const totalTimeInBed = adjustedSleepData.reduce((sum, record) => sum + record.timeInBed, 0);
    const avgTimeInBed = totalTimeInBed / adjustedSleepData.length;
    const totalAwakeMinutes = adjustedSleepData.reduce((sum, record) => sum + record.minutesAwake, 0);
    const avgAwakeMinutes = totalAwakeMinutes / adjustedSleepData.length;
    
    //const avgEfficiency = adjustedSleepData.reduce((sum, record) => sum + record.efficiency, 0) /
    const avgEfficiency = adjustedSleepData.reduce((sum, record) => sum + record.efficiency, 0) / adjustedSleepData.length;

    
    resumenHTML = `
      <div class="card text-dark bg-info mb-3">
        <div class="card-body">
          <h5 class="card-title">Resumen de Sueño</h5>
          <p class="card-text"><strong>Total de minutos dormidos:</strong> ${totalSleepMinutes} min</p>
          <p class="card-text"><strong>Promedio de minutos dormidos:</strong> ${avgSleepMinutes.toFixed(1)} min</p>
          <p class="card-text"><strong>Total de minutos en cama:</strong> ${totalTimeInBed} min</p>
          <p class="card-text"><strong>Promedio de minutos en cama:</strong> ${avgTimeInBed.toFixed(1)} min</p>
          <p class="card-text"><strong>Total de minutos despierto:</strong> ${totalAwakeMinutes} min</p>
          <p class="card-text"><strong>Promedio de minutos despierto:</strong> ${avgAwakeMinutes.toFixed(1)} min</p>
          <p class="card-text"><strong>Promedio de eficiencia:</strong> ${avgEfficiency.toFixed(1)}%</p>
          <p class="card-text"><strong>Total de registros:</strong> ${adjustedSleepData.length}</p>
        </div>
      </div>
    `;
    
    html += `<div class="col-md-12 mb-3">${resumenHTML}</div>`;
    
    adjustedSleepData.forEach(record => {
      const formattedDate = record.adjustedDateOfSleep.toLocaleDateString();
      const startTime = new Date(record.startTime).toLocaleTimeString();
      const endTime = new Date(record.endTime).toLocaleTimeString();
      html += `
        <div class="col-md-3 mb-3">
          <div class="card text-dark bg-light">
            <div class="card-body">
              <h5 class="card-title">${formattedDate}</h5>
              <p class="card-text"><strong>Hora de dormir:</strong> ${startTime}</p>
              <p class="card-text"><strong>Hora de despertar:</strong> ${endTime}</p>
              <p class="card-text"><strong>Minutos dormidos:</strong> ${record.minutesAsleep} min</p>
              <p class="card-text"><strong>Minutos despierto:</strong> ${record.minutesAwake} min</p>
              <p class="card-text"><strong>Tiempo en cama:</strong> ${record.timeInBed} min</p>
              <p class="card-text"><strong>Eficiencia:</strong> ${record.efficiency}%</p>
            </div>
          </div>
        </div>
      `;
    });
    
    // Actualizar tarjeta principal
    const sleepValueElement = document.getElementById("sleep-value");
    if (sleepValueElement) {
      sleepValueElement.textContent = `${avgSleepMinutes.toFixed(1)} min`;
    }
  } else {
    html = "<p>No se encontraron datos de sueño para el rango seleccionado.</p>";
  }
  
  html += '</div>';
  html += `<div id="resumenSueño" style="display:none">${resumenHTML}</div>`;
  
  return html;
}
/**
 * Procesa datos de ECG
 * @param {Object} data - Datos de ECG
 * @returns {string} HTML para mostrar los datos
 */
function procesarDatosECG(data) {
  let html = '<div class="row">';
  let resumenHTML = "";
  
  // Modificar para acceder correctamente a los datos según la respuesta de la API
  if (data && data.ecgReadings && data.ecgReadings.length > 0) {
    const ecgReadings = data.ecgReadings;
    // Para el resumen, usamos el primer registro
    const firstRecord = ecgReadings[0];
    const avgHeartRate = firstRecord.averageHeartRate || 'N/A';
    const classification = firstRecord.resultClassification || 'N/A';
    const startTime = new Date(firstRecord.startTime).toLocaleString();
    
    resumenHTML = `
      <div class="card text-dark bg-info mb-3">
        <div class="card-body">
          <h5 class="card-title">Resumen de ECG</h5>
          <p class="card-text"><strong>Frecuencia Cardíaca Promedio:</strong> ${avgHeartRate} bpm</p>
          <p class="card-text"><strong>Clasificación:</strong> ${classification}</p>
          <p class="card-text"><strong>Hora de Lectura:</strong> ${startTime}</p>
        </div>
      </div>
    `;
    
    html += `<div class="col-md-12 mb-3">${resumenHTML}</div>`;
    
    // Crear una tarjeta para cada lectura de ECG
    ecgReadings.forEach(reading => {
      const readingStartTime = new Date(reading.startTime).toLocaleString();
      const readingAvgHeartRate = reading.averageHeartRate || 'N/A';
      const readingClassification = reading.resultClassification || 'N/A';
      
      html += `
        <div class="col-md-3 mb-3">
          <div class="card text-dark bg-light">
            <div class="card-body">
              <h5 class="card-title">ECG - ${readingStartTime}</h5>
              <p class="card-text"><strong>Frecuencia Cardíaca:</strong> ${readingAvgHeartRate} bpm</p>
              <p class="card-text"><strong>Clasificación:</strong> ${readingClassification}</p>
            </div>
          </div>
        </div>
      `;
    });
    
    // Actualizar tarjeta principal
    const ecgValueElement = document.getElementById("ecg-value");
    if (ecgValueElement) {
      ecgValueElement.textContent = `${avgHeartRate} bpm`;
    }
  } else {
    html = "<p>No se encontraron datos de ECG para el rango seleccionado.</p>";
    
    // Actualizar tarjeta principal
    const ecgValueElement = document.getElementById("ecg-value");
    if (ecgValueElement) {
      ecgValueElement.textContent = "N/A";
    }
  }
  
  html += '</div>';
  html += `<div id="resumenECG" style="display:none">${resumenHTML}</div>`;
  
  return html;
}

/**
 * Procesa datos de HRV
 * @param {Object} data - Datos de variabilidad de frecuencia cardíaca
 * @returns {string} HTML para mostrar los datos
 */
function procesarDatosHRV(data) {
  // Añadir función de toggle al head del documento si aún no existe
  if (!document.getElementById('hrv-toggle-script')) {
    const scriptElement = document.createElement('script');
    scriptElement.id = 'hrv-toggle-script';
    scriptElement.textContent = `
      function toggleHrvDetails(id, buttonEl) {
        const detailsDiv = document.getElementById(id);
        if (detailsDiv.style.display === 'none' || detailsDiv.style.display === '') {
          detailsDiv.style.display = 'block';
          buttonEl.textContent = 'Ocultar detalle por minuto';
          buttonEl.classList.remove('btn-info');
          buttonEl.classList.add('btn-secondary');
        } else {
          detailsDiv.style.display = 'none';
          buttonEl.textContent = 'Ver detalle por minuto';
          buttonEl.classList.remove('btn-secondary');
          buttonEl.classList.add('btn-info');
        }
      }
    `;
    document.head.appendChild(scriptElement);
  }

  let html = '<div class="row">';
  let resumenHTML = "";
  const startDate = document.getElementById("hrvStartDate")?.value || "fecha no especificada";
  const endDate = document.getElementById("hrvEndDate")?.value || "fecha no especificada";

  if (data.hrv && Array.isArray(data.hrv) && data.hrv.length > 0) {
    let allRmssdValues = [];
    let totalMinutes = 0;
    let overallMinRmssd = Infinity;
    let overallMaxRmssd = 0;
    let overallAvgCoverage = 0;
    let overallAvgLF = 0;
    let overallAvgHF = 0;
    let daysWithData = 0;

    data.hrv.forEach((hrvData, index) => {
      if (hrvData.minutes && hrvData.minutes.length > 0) {
        daysWithData++;
        const date = hrvData.dateTime || hrvData.minutes[0].minute.substring(0, 10);
        const uniqueId = `hrv-details-${date.replace(/-/g, '')}-${index}`;

        const rmssdValues = hrvData.minutes.map(item => item.value.rmssd);
        allRmssdValues = allRmssdValues.concat(rmssdValues);

        const avgRmssd = rmssdValues.reduce((a, b) => a + b, 0) / rmssdValues.length;
        const minRmssd = Math.min(...rmssdValues);
        const maxRmssd = Math.max(...rmssdValues);

        overallMinRmssd = Math.min(overallMinRmssd, minRmssd);
        overallMaxRmssd = Math.max(overallMaxRmssd, maxRmssd);

        const avgCoverage = (hrvData.minutes.reduce((sum, item) => sum + item.value.coverage, 0) / hrvData.minutes.length) * 100;
        overallAvgCoverage += avgCoverage;

        const avgLF = hrvData.minutes.reduce((sum, item) => sum + item.value.lf, 0) / hrvData.minutes.length;
        const avgHF = hrvData.minutes.reduce((sum, item) => sum + item.value.hf, 0) / hrvData.minutes.length;
        overallAvgLF += avgLF;
        overallAvgHF += avgHF;

        totalMinutes += hrvData.minutes.length;
      }
    });
  }
  
  return html;
}
// Completando la función procesarDatosHRV
function procesarDatosHRV(data) {
  // Añadir función de toggle al head del documento si aún no existe
  if (!document.getElementById('hrv-toggle-script')) {
    const scriptElement = document.createElement('script');
    scriptElement.id = 'hrv-toggle-script';
    scriptElement.textContent = `
      function toggleHrvDetails(id, buttonEl) {
        const detailsDiv = document.getElementById(id);
        if (detailsDiv.style.display === 'none' || detailsDiv.style.display === '') {
          detailsDiv.style.display = 'block';
          buttonEl.textContent = 'Ocultar detalle por minuto';
          buttonEl.classList.remove('btn-info');
          buttonEl.classList.add('btn-secondary');
        } else {
          detailsDiv.style.display = 'none';
          buttonEl.textContent = 'Ver detalle por minuto';
          buttonEl.classList.remove('btn-secondary');
          buttonEl.classList.add('btn-info');
        }
      }
    `;
    document.head.appendChild(scriptElement);
  }

  let html = '<div class="row">';
  let resumenHTML = "";
  const startDate = document.getElementById("hrvStartDate")?.value || "fecha no especificada";
  const endDate = document.getElementById("hrvEndDate")?.value || "fecha no especificada";

  if (data.hrv && Array.isArray(data.hrv) && data.hrv.length > 0) {
    let allRmssdValues = [];
    let totalMinutes = 0;
    let overallMinRmssd = Infinity;
    let overallMaxRmssd = 0;
    let overallAvgCoverage = 0;
    let overallAvgLF = 0;
    let overallAvgHF = 0;
    let daysWithData = 0;

    data.hrv.forEach((hrvData, index) => {
      if (hrvData.minutes && hrvData.minutes.length > 0) {
        daysWithData++;
        const date = hrvData.dateTime || hrvData.minutes[0].minute.substring(0, 10);
        const uniqueId = `hrv-details-${date.replace(/-/g, '')}-${index}`;

        const rmssdValues = hrvData.minutes.map(item => item.value.rmssd);
        allRmssdValues = allRmssdValues.concat(rmssdValues);

        const avgRmssd = rmssdValues.reduce((a, b) => a + b, 0) / rmssdValues.length;
        const minRmssd = Math.min(...rmssdValues);
        const maxRmssd = Math.max(...rmssdValues);

        overallMinRmssd = Math.min(overallMinRmssd, minRmssd);
        overallMaxRmssd = Math.max(overallMaxRmssd, maxRmssd);

        const avgCoverage = (hrvData.minutes.reduce((sum, item) => sum + item.value.coverage, 0) / hrvData.minutes.length) * 100;
        overallAvgCoverage += avgCoverage;

        const avgLF = hrvData.minutes.reduce((sum, item) => sum + item.value.lf, 0) / hrvData.minutes.length;
        const avgHF = hrvData.minutes.reduce((sum, item) => sum + item.value.hf, 0) / hrvData.minutes.length;
        overallAvgLF += avgLF;
        overallAvgHF += avgHF;

        totalMinutes += hrvData.minutes.length;

       // Tarjeta principal con botón de toggle
        html += `
          <div class="col-12 col-md-6 col-lg-4 mb-3">
            <div class="card text-dark bg-light">
              <div class="card-header d-flex justify-content-between align-items-center">
                <h5 class="mb-0">Resumen HRV - ${date}</h5>
                <button 
                  class="btn btn-sm btn-info toggle-hrv-details" 
                  data-target="${uniqueId}"
                  onclick="toggleHrvDetails('${uniqueId}', this)"
                >
                  Ver detalle por minuto
                </button>
              </div>
              <div class="card-body">
                <div class="row">
                  <div class="col-md-4">
                    <p class="mb-2"><strong>RMSSD Promedio:</strong> ${avgRmssd.toFixed(2)} ms</p>
                    <p class="mb-2"><strong>Mínimo:</strong> ${minRmssd.toFixed(2)} ms</p>
                    <p class="mb-0"><strong>Máximo:</strong> ${maxRmssd.toFixed(2)} ms</p>
                  </div>
                  <div class="col-md-4">
                    <p class="mb-2"><strong>Cobertura:</strong> ${avgCoverage.toFixed(1)}%</p>
                    <p class="mb-2"><strong>LF:</strong> ${avgLF.toFixed(2)}</p>
                    <p class="mb-0"><strong>HF:</strong> ${avgHF.toFixed(2)}</p>
                  </div>
                  <div class="col-md-4">
                    <p class="mb-2"><strong>LF/HF:</strong> ${(avgLF / avgHF).toFixed(2)}</p>
                    <p class="mb-0"><strong>Lecturas:</strong> ${hrvData.minutes.length}</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        `;

        // Sección de detalles
        html += `
          <div id="${uniqueId}" class="row" style="display: none;">
            <div class="col-12 mb-4">
              <div class="card border-info w-100">
                <div class="card-header bg-info text-white py-2">
                  <h6 class="mb-0">Detalles por minuto - ${date}</h6>
                </div>
                <div class="card-body p-3">
                  <div class="row row-cols-1 row-cols-sm-2 row-cols-md-2 row-cols-lg-3 g-3">
        `;

        // Detalles por minuto ordenados
        hrvData.minutes.sort((a, b) => a.minute.localeCompare(b.minute)).forEach(item => {
        const timeString = item.minute.substring(11, 19);
        html += `
            <div class="col">
              <div class="card h-100 border-secondary">
                <div class="card-header bg-light py-1">
                  <small class="text-muted">${timeString}</small>
                </div>
                <div class="card-body py-2">
                  <p class="mb-1"><strong>RMSSD:</strong> ${item.value.rmssd.toFixed(2)} ms</p>
                  <p class="mb-1"><strong>Cobertura:</strong> ${(item.value.coverage * 100).toFixed(1)}%</p>
                  <p class="mb-0"><strong>LF/HF:</strong> ${(item.value.lf / item.value.hf).toFixed(2)}</p>
                </div>
              </div>
            </div>
        `;
        });

        html += `
                  </div>
                </div>
              </div>
            </div>
          </div>
        `;
      }
    });

    if (daysWithData > 0) {
      const overallAvgRmssd = allRmssdValues.reduce((a, b) => a + b, 0) / allRmssdValues.length;
      const variabilidadRmssd = Math.sqrt(
        allRmssdValues.map(x => Math.pow(x - overallAvgRmssd, 2)).reduce((a, b) => a + b, 0) / allRmssdValues.length
      );

      resumenHTML = `
        <div class="col-md-12 mb-4">
          <div class="card text-white bg-primary">
            <div class="card-header">
              <h5 class="mb-0">Resumen General (${startDate} - ${endDate})</h5>
            </div>
            <div class="card-body">
              <div class="row">
                <div class="col-md-4">
                  <p class="mb-2"><strong>Promedio RMSSD:</strong> ${overallAvgRmssd.toFixed(2)} ms</p>
                  <p class="mb-2"><strong>Mínimo Global:</strong> ${overallMinRmssd.toFixed(2)} ms</p>
                  <p class="mb-0"><strong>Máximo Global:</strong> ${overallMaxRmssd.toFixed(2)} ms</p>
                </div>
                <div class="col-md-4">
                  <p class="mb-2"><strong>Desviación:</strong> ${variabilidadRmssd.toFixed(2)} ms</p>
                  <p class="mb-2"><strong>Cobertura Promedio:</strong> ${(overallAvgCoverage / daysWithData).toFixed(1)}%</p>
                  <p class="mb-0"><strong>Días con datos:</strong> ${daysWithData}</p>
                </div>
                <div class="col-md-4">
                  <p class="mb-2"><strong>LF Promedio:</strong> ${(overallAvgLF / daysWithData).toFixed(2)}</p>
                  <p class="mb-2"><strong>HF Promedio:</strong> ${(overallAvgHF / daysWithData).toFixed(2)}</p>
                  <p class="mb-0"><strong>LF/HF Global:</strong> ${((overallAvgLF / daysWithData) / (overallAvgHF / daysWithData)).toFixed(2)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      `;
      
      // Insertar el resumen general al principio
      html = resumenHTML + html;
      
      // Actualizar elemento en la interfaz principal
      const hrvValueElement = document.getElementById("hrv-value");
      if (hrvValueElement) {
        hrvValueElement.textContent = `${overallAvgRmssd.toFixed(2)} ms`;
      }
    }
  } else {
    html += '<div class="col-md-12"><div class="alert alert-warning">No se encontraron datos HRV</div></div>';
  }

  html += '</div>'; // Cierre del row principal
  html += `<div id="resumenHRV" style="display:none">${resumenHTML}</div>`;
  
  return html;
}
