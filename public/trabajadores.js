document.addEventListener("DOMContentLoaded", async () => {
  // Función para obtener la lista de trabajadores desde el servidor
  async function fetchTrabajadores() {
    try {
      const response = await fetch("http://localhost:3000/mostrar-trabajadores");
      const data = await response.json();

      // Selecciona el contenedor donde se mostrarán las tarjetas de trabajadores
      const container = document.querySelector(".row.mb-4");
      if (container) {
        container.innerHTML = ""; // Limpia el contenido actual
        
        // Verificar si hay datos
        if (data.length === 0) {
          container.innerHTML = `
            <div class="col-12 text-center">
              <div class="alert alert-info">
                <i class="material-icons">info</i>
                No hay trabajadores registrados actualmente.
              </div>
            </div>
          `;
          return;
        }

        // Por cada trabajador, genera una tarjeta con estilo Material Dashboard Pro
        data.forEach((trabajador, index) => {
          // Determinar el estado basado en alguna lógica (ejemplo: asignar aleatoriamente para demostración)
          // En un entorno real, deberías obtener esto de los datos de salud del trabajador
          const estados = ['success', 'warning', 'danger'];
          const estadosTexto = ['Normal', 'Atención', 'Alerta'];
          const estadoIndex = Math.floor(Math.random() * 3); // En producción, usar lógica real
          
          // Asignar departamento (si no existe, usar un valor por defecto)
          const departamentos = ['Producción', 'Administrativo', 'Mantenimiento'];
          const departamento = departamentos[index % 3]; // En producción, usar el valor real de la BD
          
          // Valores simulados para las métricas (en producción, usar valores reales)
          const hrValue = 60 + Math.floor(Math.random() * 40);
          const spo2Value = 95 + Math.floor(Math.random() * 5);
          const tempValue = (36 + Math.random()).toFixed(1);
          
          // Crear la tarjeta del trabajador
          const tarjetaHTML = `
            <div class="col-xl-3 col-md-6 mb-4">
              <div class="card">
                <div class="card-header p-3 pt-2 bg-gradient-primary">
                  <div class="icon icon-lg icon-shape bg-gradient-light shadow-primary text-center border-radius-xl mt-n4 position-absolute">
                    <img src="imagenes/personas/user${trabajador.id || index + 1}.png" alt="Usuario ${trabajador.id}" class="img-fluid rounded-circle">
                  </div>
                  <div class="text-end pt-1">
                    <p class="text-white mb-0 text-capitalize">${trabajador.cargo || 'Trabajador'}</p>
                    <h4 class="text-white mb-0">${trabajador.nombre} ${trabajador.apellido || ''}</h4>
                    <p class="text-sm text-white mb-0">Última actualización: <span id="last-update-${trabajador.id}">${new Date().toLocaleTimeString()}</span></p>
                  </div>
                </div>
                <div class="card-body p-3">
                  <div class="row">
                    <div class="col-8">
                      <div class="numbers">
                        <p class="text-sm mb-0 text-capitalize font-weight-bold">Departamento</p>
                        <h5 class="font-weight-bolder mb-2">
                          ${departamento}
                        </h5>
                        <p class="text-sm mb-0 text-capitalize font-weight-bold">Estado</p>
                        <div class="d-flex align-items-center">
                          <span class="badge bg-gradient-${estados[estadoIndex]} me-2">${estadosTexto[estadoIndex]}</span>
                        </div>
                      </div>
                    </div>
                    <div class="col-4 text-end">
                      <div class="heart-icon">
                        <img src="imagenes/logos/heart.png" alt="Icono de Corazón">
                      </div>
                      <div class="metric-info mt-2">
                        <p class="mb-0"><span id="hr-worker${trabajador.id}">${hrValue}</span> bpm</p>
                      </div>
                    </div>
                  </div>
                  <div class="row mt-3">
                    <div class="col-6">
                      <div class="d-flex align-items-center">
                        <div class="icon icon-shape icon-sm bg-gradient-info shadow text-center">
                          <img src="imagenes/logos/spo2.png" alt="Icono de Saturación" class="w-50">
                        </div>
                        <div class="ms-2">
                          <p class="text-xs mb-0">SpO₂</p>
                          <h6 class="mb-0" id="spo2-worker${trabajador.id}">${spo2Value}%</h6>
                        </div>
                      </div>
                    </div>
                    <div class="col-6">
                      <div class="d-flex align-items-center">
                        <div class="icon icon-shape icon-sm bg-gradient-warning shadow text-center">
                          <img src="imagenes/logos/temperature.png" alt="Icono de Temperatura" class="w-50">
                        </div>
                        <div class="ms-2">
                          <p class="text-xs mb-0">Temp</p>
                          <h6 class="mb-0" id="temp-worker${trabajador.id}">${tempValue}°C</h6>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div class="text-center mt-3">
                    <a href="personal.html?id=${trabajador.id}" class="btn bg-gradient-primary mb-0">Ver Detalles</a>
                  </div>
                </div>
              </div>
            </div>
          `;
          
          container.innerHTML += tarjetaHTML;
        });
        
        // Actualizar los contadores en la parte superior
        actualizarContadores(data.length);
      }
    } catch (error) {
      console.error("Error al obtener trabajadores:", error);
      const container = document.querySelector(".row.mb-4");
      if (container) {
        container.innerHTML = `
          <div class="col-12">
            <div class="alert alert-danger">
              <i class="material-icons">error</i>
              Error al cargar los datos: ${error.message}
            </div>
          </div>
        `;
      }
    }
  }

  // Función para actualizar los contadores en la parte superior
  function actualizarContadores(total) {
    // Total de trabajadores
    const totalTrabajadores = document.getElementById('totalTrabajadores');
    if (totalTrabajadores) totalTrabajadores.textContent = total;
    
    // Simulación de contadores de estado (en producción, calcular basado en datos reales)
    const trabajadoresNormales = document.getElementById('trabajadoresNormales');
    const trabajadoresAlerta = document.getElementById('trabajadoresAlerta');
    
    if (trabajadoresNormales) {
      const normales = Math.round(total * 0.8); // Simular que el 80% están en estado normal
      trabajadoresNormales.textContent = normales;
    }
    
    if (trabajadoresAlerta) {
      const alertas = Math.round(total * 0.2); // Simular que el 20% están en alerta
      trabajadoresAlerta.textContent = alertas;
    }
  }

  // Función para eliminar un trabajador (mantener compatibilidad)
  window.eliminarTrabajador = async (id) => {
    if (confirm('¿Está seguro que desea eliminar este trabajador?')) {
      try {
        await fetch(`http://localhost:3000/eliminar-registro/${id}`, { method: "DELETE" });
        fetchTrabajadores(); // Recargar la lista
        mostrarNotificacion('Trabajador eliminado con éxito', 'success');
      } catch (error) {
        console.error("Error al eliminar trabajador:", error);
        mostrarNotificacion('Error al eliminar el trabajador', 'danger');
      }
    }
  };

  // Función para mostrar notificaciones
  function mostrarNotificacion(mensaje, tipo) {
    const notificacion = document.createElement('div');
    notificacion.className = `alert alert-${tipo} alert-dismissible fade show`;
    notificacion.style.position = 'fixed';
    notificacion.style.top = '20px';
    notificacion.style.right = '20px';
    notificacion.style.zIndex = '9999';
    notificacion.innerHTML = `
      ${mensaje}
      <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close"></button>
    `;
    document.body.appendChild(notificacion);
    
    // Remover después de 3 segundos
    setTimeout(() => {
      notificacion.remove();
    }, 3000);
  }

  // Configurar filtrado de trabajadores
  function configurarFiltros() {
    const btnAplicarFiltros = document.getElementById('btnAplicarFiltros');
    const filtroEstado = document.getElementById('filtroEstado');
    const filtroDepartamento = document.getElementById('filtroDepartamento');
    const buscarInput = document.getElementById('buscarTrabajador');
    
    if (btnAplicarFiltros) {
      btnAplicarFiltros.addEventListener('click', filtrarTrabajadores);
    }
    
    if (buscarInput) {
      buscarInput.addEventListener('input', filtrarTrabajadores);
    }
  }

  // Función para filtrar trabajadores
  function filtrarTrabajadores() {
    const filtroEstado = document.getElementById('filtroEstado').value;
    const filtroDepartamento = document.getElementById('filtroDepartamento').value;
    const busqueda = document.getElementById('buscarTrabajador').value.toLowerCase();
    
    // Obtener todas las tarjetas de trabajadores
    const tarjetas = document.querySelectorAll('.col-xl-3.col-md-6.mb-4');
    let contadorVisibles = 0;
    
    tarjetas.forEach(tarjeta => {
      let mostrar = true;
      
      // Filtrar por estado
      if (filtroEstado !== 'todos') {
        const estadoBadge = tarjeta.querySelector('.badge');
        if (estadoBadge) {
          const estadoTexto = estadoBadge.textContent.toLowerCase();
          if (!estadoTexto.includes(filtroEstado.toLowerCase())) {
            mostrar = false;
          }
        }
      }
      
      // Filtrar por departamento
      if (filtroDepartamento !== 'todos' && mostrar) {
        const departamentoElement = tarjeta.querySelector('.font-weight-bolder');
        if (departamentoElement) {
          const departamentoTexto = departamentoElement.textContent.toLowerCase().trim();
          if (!departamentoTexto.includes(filtroDepartamento.toLowerCase())) {
            mostrar = false;
          }
        }
      }
      
      // Filtrar por búsqueda
      if (busqueda && mostrar) {
        const nombre = tarjeta.querySelector('h4').textContent.toLowerCase();
        if (!nombre.includes(busqueda)) {
          mostrar = false;
        }
      }
      
      // Mostrar u ocultar la tarjeta
      tarjeta.style.display = mostrar ? '' : 'none';
      if (mostrar) contadorVisibles++;
    });
    
    // Actualizar contador de visibles
    const totalTrabajadores = document.getElementById('totalTrabajadores');
    if (totalTrabajadores) totalTrabajadores.textContent = contadorVisibles;
  }

  // Botón para cargar más trabajadores
  const btnCargarMas = document.getElementById('cargarMas');
  if (btnCargarMas) {
    btnCargarMas.addEventListener('click', async function() {
      // En una implementación real, habría una API para cargar más trabajadores
      // Por ahora, mostramos un mensaje
      mostrarNotificacion('Funcionalidad en desarrollo', 'info');
    });
  }

  // Función para simular actualización de datos en tiempo real
  function simularActualizacionDatos() {
    // Actualizar frecuencia cardíaca con pequeñas variaciones
    document.querySelectorAll('[id^="hr-worker"]').forEach(element => {
      if (element.textContent) {
        let value = parseInt(element.textContent);
        value = value + Math.floor(Math.random() * 5) - 2; // Variar entre -2 y +2
        element.textContent = value;
      }
    });
    
    // Actualizar la hora de última actualización
    document.querySelectorAll('[id^="last-update"]').forEach(element => {
      const now = new Date();
      const hours = now.getHours().toString().padStart(2, '0');
      const minutes = now.getMinutes().toString().padStart(2, '0');
      element.textContent = `${hours}:${minutes}`;
    });
    
    // Programar la próxima actualización
    setTimeout(simularActualizacionDatos, 5000); // Cada 5 segundos
  }

  // Inicializar gráficos si existen
  function inicializarGraficos() {
    if (typeof Chart === 'undefined') return;
    
    // Gráfico de Estado de Salud (si existe)
    const ctxSalud = document.getElementById('estadoSaludChart');
    if (ctxSalud) {
      const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
      const textColor = isDarkMode ? '#ffffff' : '#344767';
      
      window.estadoSaludChart = new Chart(ctxSalud.getContext('2d'), {
        type: 'doughnut',
        data: {
          labels: ['Normal', 'Atención', 'Alerta'],
          datasets: [{
            label: 'Estado de Salud',
            data: [22, 2, 1],
            backgroundColor: [
              'rgba(76, 175, 80, 0.8)',
              'rgba(255, 152, 0, 0.8)',
              'rgba(244, 67, 54, 0.8)'
            ],
            borderWidth: 0
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                color: textColor,
                font: {
                  size: 12,
                  family: 'Roboto',
                  weight: 'bold'
                },
                padding: 20
              }
            }
          },
          cutout: '70%'
        }
      });
    }
    
    // Gráfico de Alertas Semanales (si existe)
    const ctxAlertas = document.getElementById('alertasSemanalChart');
    if (ctxAlertas) {
      const isDarkMode = document.documentElement.getAttribute('data-theme') === 'dark';
      const textColor = isDarkMode ? '#ffffff' : '#344767';
      
      window.alertasSemanalChart = new Chart(ctxAlertas.getContext('2d'), {
        type: 'line',
        data: {
          labels: ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'],
          datasets: [{
            label: 'Alertas',
            data: [2, 1, 3, 5, 2, 0, 1],
            borderColor: 'rgba(244, 67, 54, 0.8)',
            backgroundColor: 'rgba(244, 67, 54, 0.1)',
            tension: 0.4,
            fill: true
          }, {
            label: 'Atención',
            data: [5, 3, 6, 7, 4, 2, 3],
            borderColor: 'rgba(255, 152, 0, 0.8)',
            backgroundColor: 'rgba(255, 152, 0, 0.1)',
            tension: 0.4,
            fill: true
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom',
              labels: {
                color: textColor
              }
            }
          },
          scales: {
            x: {
              grid: {
                display: false
              },
              ticks: {
                color: textColor
              }
            },
            y: {
              grid: {
                color: isDarkMode ? 'rgba(255, 255, 255, 0.1)' : 'rgba(0, 0, 0, 0.1)'
              },
              ticks: {
                color: textColor,
                beginAtZero: true
              }
            }
          }
        }
      });
    }
  }

  // Inicialización
  fetchTrabajadores(); // Cargar trabajadores al inicio
  configurarFiltros(); // Configurar sistema de filtrado
  inicializarGraficos(); // Inicializar gráficos si existen
  simularActualizacionDatos(); // Iniciar simulación de datos en tiempo real
  
  // Actualizar datos cada 30 segundos para mantener información reciente
  setInterval(fetchTrabajadores, 30000);
});