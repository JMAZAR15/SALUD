const axios = require('axios');
const dayjs = require('dayjs');
const utc = require('dayjs/plugin/utc');
const timezone = require('dayjs/plugin/timezone');
dayjs.extend(utc);
dayjs.extend(timezone);

class StressDetector {
  constructor(fitbitAccessToken, workerId) {
    this.accessToken = fitbitAccessToken;
    this.workerId = workerId; // Se asigna el workerId recibido (aunque para llamadas directas a la API de Fitbit no se usa)
    this.baseHeaders = {
      'Authorization': `Bearer ${this.accessToken}`,
      'Accept-Language': 'es_PE'
    };
  }

  // Método principal: calcula el índice de estrés
  async calculateStressIndex(date = null) {
    if (!date) {
      date = dayjs().tz("America/Lima").format("YYYY-MM-DD");
    }
    
    try {
      console.log(`Iniciando cálculo de índice de estrés para la fecha: ${date}`);

       // Primero obtener los datos del día anterior
    const previousDate = dayjs(date).subtract(1, 'day').format("YYYY-MM-DD");
    console.log(`Obteniendo datos del día anterior: ${previousDate}`);

    // Obtener los datos necesarios del día anterior
    let previousHeartRateData, previousActivityData;
    try {
      previousHeartRateData = await this.fetchHeartRateData(previousDate);
    } catch (error) {
      console.warn(`Error al obtener datos de ritmo cardíaco del día anterior: ${error.message}`);
    }
    
    try {
      previousActivityData = await this.fetchActivityData(previousDate);
    } catch (error) {
      console.warn(`Error al obtener datos de actividad del día anterior: ${error.message}`);
    }
    
     // Empaquetar los datos anteriores en un objeto
     const previousDayData = {
      heartRateData: previousHeartRateData,
      summary: previousActivityData.summary || { steps: 0, fairlyActiveMinutes: 0 }
    };

      // Se obtienen los datos diarios/intradía desde las API de Fitbit
      // Luego obtener los datos del día actual como ya lo estás haciendo
    const heartRateData = await this.fetchHeartRateData(date);
    const hrvSummary = await this.fetchHRVData(date);
    const sleepData = await this.fetchSleepData(date);
    const activityData = await this.fetchActivityData(date);
    const spo2Summary = await this.fetchSPO2Data(date);
    const respSummary = await this.fetchRespiratoryData(date);
    
    // Calcular puntuaciones
    const spo2Score = this.calculateSPO2Score(spo2Summary);
    const respiratoryScore = this.calculateRespiratoryScore(respSummary);
    


    console.log('Datos recuperados:', {
      // Datos del día actual
      heartRateData: JSON.stringify(heartRateData),
      hrvSummary: JSON.stringify(hrvSummary),
      spo2Summary: JSON.stringify(spo2Summary),
      respSummary: JSON.stringify(respSummary),
      sleepData: JSON.stringify(sleepData),
      activityData: JSON.stringify(activityData),
      // Datos del día anterior
      previousHeartRateData: JSON.stringify(previousHeartRateData),
      previousActivityData: JSON.stringify(previousActivityData)
    });

      // Procesamiento de los componentes existentes
      const sleepInterruptionAnalysis = this.analyzeSleepInterruptions(sleepData);
      const recoveryAnalysis = this.calculateRecoveryScore(activityData, heartRateData, previousDayData);
      const autonomicResponseScore = this.calculateAutonomicResponseScore(heartRateData, hrvSummary);
      const physicalActivityBalanceScore = this.calculatePhysicalActivityBalanceScore(activityData, heartRateData);
      const sleepPatternScore = this.calculateSleepPatternScore(sleepData);
      const estimatedEDAScore = this.estimateEDAScore(autonomicResponseScore, physicalActivityBalanceScore, sleepPatternScore);

      // Cómputo final del índice de estrés
      // Pesos asignados (puedes ajustarlos según tus necesidades):
      // - Respuesta autonómica: 25%
      // - Actividad física: 25%
      // - Patrón de sueño: 20%
      // - EDA estimado: 15%
      // - SPO₂: 10%
      // - Frecuencia respiratoria: 5%
      // - Recuperación (inversa): 10%
      const stressIndex = this.computeStressIndex(
        autonomicResponseScore, 
        physicalActivityBalanceScore, 
        sleepPatternScore,
        estimatedEDAScore,
        spo2Score,          
        respiratoryScore,   
        recoveryAnalysis.recoveryScore  
      );

      console.log(`Índice de estrés final: ${stressIndex}`);

      return {
        date,
        stressIndex,
        components: {
          autonomicResponseScore, 
          physicalActivityBalanceScore, 
          sleepPatternScore,
          estimatedEDAScore,
          spo2Score,
          respiratoryScore,
          recovery: recoveryAnalysis,
          sleepInterruptions: sleepInterruptionAnalysis
        }
      };
    } catch (error) {
      console.error("Error completo en calculateStressIndex:", error);
      return {
        date,
        stressIndex: null,
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name
        }
      };
    }
  }

  // --- Métodos de fetch existentes ---
  // Recupera datos intradía de frecuencia respiratoria y calcula un resumen
  async fetchRespiratoryData(date) {
    try {
      const url = `https://api.fitbit.com/1/user/-/br/date/${date}/all.json`;
      console.log(`Recuperando datos de frecuencia respiratoria para ${date}: ${url}`);
      const response = await axios.get(url, { headers: this.baseHeaders });
      console.log('Datos de frecuencia respiratoria recuperados:', response.data);
  
      let minutesData = null;
      if (response.data && response.data.br && Array.isArray(response.data.br)) {
        minutesData = response.data.br;
        
        console.log("Cantidad de registros en BR:", minutesData.length); // VERIFICACIÓN
  
        const computedValues = minutesData.flatMap(record => {
          const deep = record.value.deepSleepSummary?.breathingRate;
          const full = record.value.fullSleepSummary?.breathingRate;
          const light = record.value.lightSleepSummary?.breathingRate;
          const rem = record.value.remSleepSummary?.breathingRate;
  
          // Solo tomamos valores válidos de breathingRate
          const arr = [deep, full, light, rem].filter(v => typeof v === 'number');
          
          return arr.length > 0 ? arr : [];
        });
  
        console.log("Valores de frecuencia respiratoria extraídos:", computedValues); // DEPURACIÓN
  
        const totalReadings = computedValues.length;
        if (totalReadings === 0) {
          return { avgResp: 15, minResp: 15, maxResp: 15, stdResp: 0, totalReadings: 0 };
        }
  
        const avgResp = computedValues.reduce((a, b) => a + b, 0) / totalReadings;
        const minResp = Math.min(...computedValues);
        const maxResp = Math.max(...computedValues);
        const stdResp = Math.sqrt(computedValues.map(x => Math.pow(x - avgResp, 2)).reduce((a, b) => a + b, 0) / totalReadings);
  
        return { avgResp, minResp, maxResp, stdResp, totalReadings };
      } else {
        console.warn("Formato inesperado de frecuencia respiratoria:", JSON.stringify(response.data));
        return { avgResp: 15, minResp: 15, maxResp: 15, stdResp: 0, totalReadings: 0 };
      }
    } catch (error) {
      console.warn("Error al obtener datos de frecuencia respiratoria:", error.message);
      return { avgResp: 15, minResp: 15, maxResp: 15, stdResp: 0, totalReadings: 0 };
    }
  }
  
  
  // Frecuencia Cardíaca (datos diarios)
  async fetchHeartRateData(date) {
    try {
      const url = `https://api.fitbit.com/1/user/-/activities/heart/date/${date}/1d.json`;
      console.log(`Recuperando datos de frecuencia cardíaca para ${date}: ${url}`);
      const response = await axios.get(url, { headers: this.baseHeaders });
      console.log('Datos de frecuencia cardíaca recuperados:', response.data);
      return response.data['activities-heart'][0] || { value: { restingHeartRate: 70 } };
    } catch (error) {
      console.warn("Error al obtener datos de frecuencia cardíaca:", error.message);
      return { value: { restingHeartRate: 70 } };
    }
  }

  // HRV: Datos intradía y resumen (promedio, mínimo, máximo, desviación, LF, HF, ratio, total)
  async fetchHRVData(date) {
    try {
      const url = `https://api.fitbit.com/1/user/-/hrv/date/${date}/all.json`;
      console.log(`Recuperando datos intradía de HRV para ${date}: ${url}`);
      const response = await axios.get(url, { headers: this.baseHeaders });
      console.log('Datos intradía de HRV recuperados:', response.data);
      
      if (response.data && response.data.hrv && Array.isArray(response.data.hrv)) {
        const allMinutes = response.data.hrv.reduce((acc, cur) => {
          if (Array.isArray(cur.minutes)) {
            return acc.concat(cur.minutes);
          }
          return acc;
        }, []);
        if (allMinutes.length === 0) {
          console.warn("No se encontraron datos de minutes en HRV");
          return { avgRmssd: 50, minRmssd: 50, maxRmssd: 50, stdRmssd: 0, avgCoverage: 0, avgLF: 0, avgHF: 0, ratioLFHF: 0, totalReadings: 0 };
        }
        const rmssdValues = allMinutes.map(item => item.value.rmssd);
        const avgRmssd = rmssdValues.reduce((a, b) => a + b, 0) / rmssdValues.length;
        const minRmssd = Math.min(...rmssdValues);
        const maxRmssd = Math.max(...rmssdValues);
        const stdRmssd = Math.sqrt(rmssdValues.map(x => Math.pow(x - avgRmssd, 2)).reduce((a, b) => a + b, 0) / rmssdValues.length);
        const avgCoverage = allMinutes.reduce((sum, item) => sum + item.value.coverage, 0) / allMinutes.length;
        const avgLF = allMinutes.reduce((sum, item) => sum + item.value.lf, 0) / allMinutes.length;
        const avgHF = allMinutes.reduce((sum, item) => sum + item.value.hf, 0) / allMinutes.length;
        const ratioLFHF = avgHF > 0 ? avgLF / avgHF : 0;
        return { 
          avgRmssd, 
          minRmssd, 
          maxRmssd, 
          stdRmssd, 
          avgCoverage, 
          avgLF, 
          avgHF, 
          ratioLFHF, 
          totalReadings: allMinutes.length 
        };
      } else {
        console.warn("Formato de datos HRV inesperado:", JSON.stringify(response.data));
        return { avgRmssd: 50, minRmssd: 50, maxRmssd: 50, stdRmssd: 0, avgCoverage: 0, avgLF: 0, avgHF: 0, ratioLFHF: 0, totalReadings: 0 };
      }
    } catch (error) {
      console.warn("Error al obtener datos intradía de HRV:", error.message);
      return { avgRmssd: 50, minRmssd: 50, maxRmssd: 50, stdRmssd: 0, avgCoverage: 0, avgLF: 0, avgHF: 0, ratioLFHF: 0, totalReadings: 0 };
    }
  }

  // Sueño: Datos diarios
  async fetchSleepData(date) {
    try {
      const url = `https://api.fitbit.com/1.2/user/-/sleep/date/${date}.json`;
      console.log(`Recuperando datos de sueño para ${date}: ${url}`);
      const response = await axios.get(url, { headers: this.baseHeaders });
      return (response.data.sleep && response.data.sleep.length > 0) ? response.data.sleep[0] : null;
    } catch (error) {
      console.warn("Error al obtener datos de sueño:", error.message);
      return null;
    }
  }

  // Actividad: Datos diarios
  async fetchActivityData(date) {
    try {
      const url = `https://api.fitbit.com/1/user/-/activities/date/${date}.json`;
      console.log(`Recuperando datos de actividad para ${date}: ${url}`);
      const response = await axios.get(url, { headers: this.baseHeaders });
      return response.data;
    } catch (error) {
      console.warn("Error al obtener datos de actividad:", error.message);
      return { summary: { steps: 0, fairlyActiveMinutes: 0 } };
    }
  }

  // --- NUEVOS MÉTODOS PARA SPO₂ ---

  // Recupera datos intradía de SPO₂ y calcula un resumen
  async fetchSPO2Data(date) {
    try {
      const url = `https://api.fitbit.com/1/user/-/spo2/date/${date}/all.json`;
      console.log(`Recuperando datos de SPO₂ para ${date}: ${url}`);
      const response = await axios.get(url, { headers: this.baseHeaders });
      console.log('Datos de SPO₂ recuperados:', response.data);
      if (response.data && response.data.minutes && Array.isArray(response.data.minutes)) {
        const spo2Values = response.data.minutes.map(item => parseFloat(item.value));
        const avgSpO2 = spo2Values.reduce((a, b) => a + b, 0) / spo2Values.length;
        const minSpO2 = Math.min(...spo2Values);
        const maxSpO2 = Math.max(...spo2Values);
        const stdSpO2 = Math.sqrt(spo2Values.map(x => Math.pow(x - avgSpO2, 2)).reduce((a, b) => a + b, 0) / spo2Values.length);
        return { avgSpO2, minSpO2, maxSpO2, stdSpO2, totalReadings: spo2Values.length };
      } else {
        console.warn("Formato inesperado de SPO₂:", JSON.stringify(response.data));
        return { avgSpO2: 95, minSpO2: 95, maxSpO2: 95, stdSpO2: 0, totalReadings: 0 };
      }
    } catch (error) {
      console.warn("Error al obtener datos de SPO₂:", error.message);
      return { avgSpO2: 95, minSpO2: 95, maxSpO2: 95, stdSpO2: 0, totalReadings: 0 };
    }
  }

  // Calcula un score de SPO₂ basándose en el promedio (se asume que valores cercanos a 100 son óptimos)
  calculateSPO2Score(spo2Summary) {
    try {
      const avg = spo2Summary.avgSpO2 || 95;
      // Se asigna 100 si el promedio es 100, de lo contrario se escala proporcionalmente
      // Por ejemplo: si el promedio es 95, el score será ~95
      return Math.round(Math.min(avg, 100));
    } catch (error) {
      console.warn("Error en cálculo de SPO₂:", error.message);
      return 50;
    }
  }

  // --- NUEVOS MÉTODOS PARA FRECUENCIA RESPIRATORIA ---

  // Recupera datos intradía de frecuencia respiratoria y calcula un resumen
 // Calcula un score de frecuencia respiratoria basado en el promedio obtenido
 calculateRespiratoryScore(respSummary) {
  try {
    console.log("Respiratory Summary recibido:", respSummary); // 🔍 Verifica qué valores llegan a la función
    const avg = respSummary.avgResp || 15;
    console.log("Promedio respiratorio usado:", avg); // 🔍 Verifica si avgResp es correcto

    // Lógica de cálculo del score
    if (avg >= 12 && avg <= 20) return 100;
    else if (avg < 12) return Math.round((avg / 12) * 100);
    else return Math.round((20 / avg) * 100);
  } catch (error) {
    console.warn("Error en cálculo de score respiratorio:", error.message);
    return 50;
  }
 }
  // --- Métodos de cálculo existentes ---

  calculateAutonomicResponseScore(heartRateData, hrvSummary) {
    try {
      const { avgRmssd, minRmssd, maxRmssd, stdRmssd } = hrvSummary;
      // Combina los 4 valores en un índice global (ajusta la fórmula según sea necesario)
      const globalRmssd = (avgRmssd + minRmssd + maxRmssd + stdRmssd) / 4;
      const restingHeartRate = heartRateData.value?.restingHeartRate || 70;
      const hrvScore = Math.min(Math.max((globalRmssd - 20) / 80 * 100, 0), 100);
      const heartRateScore = restingHeartRate > 100 ? 0 :
                             restingHeartRate < 60 ? 100 :
                             Math.round(((restingHeartRate - 60) / 40) * 100);
      return Math.round((hrvScore * 0.6 + heartRateScore * 0.4));
    } catch (error) {
      console.warn("Error en cálculo de respuesta autonómica:", error);
      return 50;
    }
  }

  calculatePhysicalActivityBalanceScore(activityData, heartRateData) {
    try {
      const steps = activityData?.summary?.steps || 0;
      const activeMinutes = activityData?.summary?.fairlyActiveMinutes || 0;
      const restingHeartRate = heartRateData.value?.restingHeartRate || 70;
      const stepsScore = Math.min(steps / 10000 * 100, 100);
      const activeMinutesScore = Math.min(activeMinutes / 60 * 100, 100);
      const heartRateBalance = restingHeartRate > 90 ? 0 : 
                                restingHeartRate < 60 ? 100 : 
                                Math.round(((90 - restingHeartRate) / 30) * 100);
      return Math.round((stepsScore * 0.4 + activeMinutesScore * 0.3 + heartRateBalance * 0.3));
    } catch (error) {
      console.warn("Error en cálculo de equilibrio de actividad física:", error);
      return 50;
    }
  }

  calculateSleepPatternScore(sleepData) {
    try {
      if (!sleepData) return 50;
      const efficiency = sleepData.efficiency || 0;
      const deepSleepMinutes = sleepData.levels?.deep?.minutes || 0;
      const totalSleepMinutes = sleepData.duration ? sleepData.duration / (1000 * 60) : 0;
      const efficiencyScore = Math.min(efficiency, 100);
      const deepSleepScore = totalSleepMinutes > 0 ? Math.min((deepSleepMinutes / totalSleepMinutes) * 100, 100) : 50;
      const sleepDurationScore = totalSleepMinutes >= 7 * 60 ? 100 : totalSleepMinutes <= 4 * 60 ? 0 : Math.round((totalSleepMinutes - 4 * 60) / (3 * 60) * 100);
      return Math.round((efficiencyScore * 0.4 + deepSleepScore * 0.3 + sleepDurationScore * 0.3));
    } catch (error) {
      console.warn("Error en cálculo de patrón de sueño:", error);
      return 50;
    }
  }

  estimateEDAScore(autonomicResponseScore, physicalActivityBalanceScore, sleepPatternScore) {
    try {
      const combinedScore = (
        (100 - autonomicResponseScore) * 0.4 +
        (100 - physicalActivityBalanceScore) * 0.3 +
        (100 - sleepPatternScore) * 0.3
      );
      return Math.round(combinedScore);
    } catch (error) {
      console.warn("Error en estimación de EDA:", error);
      return 50;
    }
  }

  analyzeSleepInterruptions(sleepData) {
    try {
      if (!sleepData || !sleepData.levels || !sleepData.levels.data) return { 
        interruptionScore: 50, 
        totalInterruptions: 0, 
        totalInterruptionMinutes: 0 
      };
      const sleepLevels = sleepData.levels.data;
      const interruptions = sleepLevels.filter(level => level.level === 'wake' && level.seconds > 0);
      const totalInterruptionTime = interruptions.reduce((total, interruption) => total + interruption.seconds, 0);
      const interruptionFrequency = interruptions.length;
      const totalSleepTime = sleepData.duration / 1000;
      const interruptionScore = totalSleepTime > 0 ? Math.max(100 - (totalInterruptionTime / totalSleepTime * 100), 0) : 50;
      return {
        interruptionScore,
        totalInterruptions: interruptionFrequency,
        totalInterruptionMinutes: totalInterruptionTime / 60
      };
    } catch (error) {
      console.warn("Error en análisis de interrupciones de sueño:", error);
      return { 
        interruptionScore: 50, 
        totalInterruptions: 0, 
        totalInterruptionMinutes: 0 
      };
    }
  }

  calculateRecoveryScore(activityData, heartRateData, previousDayData) {
    try {
      const currentSteps = activityData?.summary?.steps || 0;
      const currentActiveMinutes = activityData?.summary?.fairlyActiveMinutes || 0;
      const currentRestingHeartRate = heartRateData.value?.restingHeartRate || 70;
      if (!previousDayData) return { 
        recoveryScore: 50, 
        stepVariation: 0, 
        activeMinutesVariation: 0, 
        heartRateVariation: 0 
      };
      const previousSteps = previousDayData?.summary?.steps || 0;
      const previousActiveMinutes = previousDayData?.summary?.fairlyActiveMinutes || 0;
      const previousRestingHeartRate = previousDayData.heartRateData?.value?.restingHeartRate || 70;
      const stepVariation = Math.abs(currentSteps - previousSteps);
      const activeMinutesVariation = Math.abs(currentActiveMinutes - previousActiveMinutes);
      const heartRateVariation = Math.abs(currentRestingHeartRate - previousRestingHeartRate);
      const recoveryScore = Math.max(
        100 - (
          (stepVariation / 5000 * 30) +
          (activeMinutesVariation / 30 * 30) +
          (heartRateVariation / 10 * 40)
        ),
        0
      );
      return {
        recoveryScore: Math.round(recoveryScore),
        stepVariation,
        activeMinutesVariation,
        heartRateVariation
      };
    } catch (error) {
      console.warn("Error en cálculo de recuperación post-ejercicio:", error);
      return { 
        recoveryScore: 50, 
        stepVariation: 0, 
        activeMinutesVariation: 0, 
        heartRateVariation: 0 
      };
    }
  }

  // Cómputo final del índice de estrés
  // Pesos asignados:
  // - Respuesta autonómica: 25%
  // - Actividad física: 25%
  // - Patrón de sueño: 20%
  // - EDA estimado: 15%
  // - SPO₂: 10%
  // - Frecuencia respiratoria: 5%
  // - Recuperación (inversa): 10%
  computeStressIndex(autonomicResponseScore, physicalActivityBalanceScore, sleepPatternScore, estimatedEDAScore, spo2Score, respiratoryScore, recoveryScore) {
    // Si recoveryScore no se proporciona, asignarlo a 50.
    if (typeof recoveryScore === 'undefined') {
      recoveryScore = 50;
    }
    try {
      const stressIndex = 
        autonomicResponseScore * 0.25 +
        physicalActivityBalanceScore * 0.25 +
        sleepPatternScore * 0.20 +
        estimatedEDAScore * 0.15 +
        spo2Score * 0.10 +
        respiratoryScore * 0.05 +
        (100 - recoveryScore) * 0.10;
      return Math.round(stressIndex);
    } catch (error) {
      console.warn("Error en cálculo de índice de estrés:", error);
      return 50;
    }
  }
  
}

module.exports = StressDetector;