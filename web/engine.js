// Motor de Simulación en Cliente
// Portado de generate_data.js para permitir configuración dinámica

const SimulationEngine = {
    // Configuración por defecto
    config: {
        hours: 24,
        patientsPerHour: 2.1, // ~50/day
        distribution: 'exponential', // 'exponential' or 'uniform'
        scenarios: {
            current: { doctor: 4, speed: 1.0, prob_fast: 0, prob_b: 0 },
            optimized: { doctor: 6, speed: 0.7, prob_fast: 0, prob_b: 0 },
            fast_track: { doctor: 4, speed: 1.0, prob_fast: 0.3, prob_b: 0 },
            on_demand: { doctor: 6, speed: 0.8, prob_fast: 0, prob_b: 0 }
        }
    },

    // Generadores de números aleatorios
    randomExponential: function(lambda) {
        return -Math.log(1.0 - Math.random()) / lambda;
    },

    randomUniform: function(min, max) {
        return Math.random() * (max - min) + min;
    },

    // Generar eventos para un escenario específico con parámetros personalizados
    generateTrace: function(scenarioId, customParams = null) {
        // Combinar config base con custom
        const baseConfig = this.config.scenarios[scenarioId] || this.config.scenarios['current'];
        
        // Parámetros de simulación
        const hours = customParams?.hours || this.config.hours;
        const pph = customParams?.patientsPerHour || this.config.patientsPerHour;
        const lambda = pph / 60;
        const distribution = customParams?.distribution || this.config.distribution;
        
        // Parámetros del escenario (resources, etc) pueden venir en customParams si queremos overrides
        // Por ahora usamos la config del escenario
        const speed = baseConfig.speed;
        
        // Tiempos de servicio
        const SERVICE_TIMES = {
            triage: { min: 2, max: 8 },
            doctor: { min: 10, max: 25 },
            fast_track: { min: 5, max: 15 }
        };

        const events = [];
        let currentTime = 0;
        let pid = 1000;
        
        // Límites de tiempo
        const stopArrivalsTime = (hours - 2) * 60; 
        const hardLimit = hours * 60;

        while (currentTime < stopArrivalsTime) {
            // Llegadas
            let interArrival;
            if (distribution === 'exponential') {
                interArrival = this.randomExponential(lambda);
            } else {
                // Uniforme aprox para media similar (0 a 2*media)
                const meanInter = 1 / lambda;
                interArrival = this.randomUniform(0, meanInter * 2);
            }
            
            currentTime += interArrival;
            if (currentTime > hardLimit) break;

            const currentPid = pid++;
            
            // Determinar ruta
            let isFastTrack = Math.random() < baseConfig.prob_fast;
            let isHospitalB = Math.random() < baseConfig.prob_b;
            
            // --- EVENTOS ---
            const arrivalTime = currentTime;
            let suffix = isHospitalB ? '_b' : '';
            
            events.push({ time: parseFloat(arrivalTime.toFixed(2)), pid: currentPid, type: 'ARRIVE', loc: 'reception' + suffix });
            
            let clock = arrivalTime;
            
            // Reception Wait
            clock += this.randomUniform(0.5, 2.0) * speed;

            if (isFastTrack) {
                // Flow Fast Track
                events.push({ time: parseFloat(clock.toFixed(2)), pid: currentPid, type: 'QUEUE', loc: 'fast_track' });
                clock += this.randomUniform(1, 15) * speed;
                events.push({ time: parseFloat(clock.toFixed(2)), pid: currentPid, type: 'START', loc: 'fast_track' });
                clock += this.randomUniform(SERVICE_TIMES.fast_track.min, SERVICE_TIMES.fast_track.max) * speed;
                events.push({ time: parseFloat(clock.toFixed(2)), pid: currentPid, type: 'END', loc: 'fast_track' });
                clock += 1.0;
                events.push({ time: parseFloat(clock.toFixed(2)), pid: currentPid, type: 'LEAVE', loc: 'exit' });
            } else {
                // Standard Flow
                let locTriage = 'triage' + suffix;
                events.push({ time: parseFloat(clock.toFixed(2)), pid: currentPid, type: 'QUEUE', loc: locTriage });
                
                clock += this.randomUniform(2, 20) * speed;
                events.push({ time: parseFloat(clock.toFixed(2)), pid: currentPid, type: 'START', loc: locTriage });
                
                clock += this.randomUniform(SERVICE_TIMES.triage.min, SERVICE_TIMES.triage.max) * speed;
                events.push({ time: parseFloat(clock.toFixed(2)), pid: currentPid, type: 'END', loc: locTriage });

                // Waiting
                clock += 1.0;
                const locWaiting = isHospitalB ? 'waiting_b' : 'waiting';
                events.push({ time: parseFloat(clock.toFixed(2)), pid: currentPid, type: 'QUEUE', loc: locWaiting });
                
                // Doctor Wait Logic
                let waitFactor = 1.0;
                if (scenarioId === 'optimized') waitFactor = 0.5;
                if (scenarioId === 'on_demand') waitFactor = 0.7;
                
                clock += this.randomExponential(0.05) + (this.randomUniform(2, 10) * waitFactor);
                
                const locDoctor = isHospitalB ? 'doctor_b' : 'doctor';
                events.push({ time: parseFloat(clock.toFixed(2)), pid: currentPid, type: 'START', loc: locDoctor });
                
                clock += this.randomUniform(SERVICE_TIMES.doctor.min, SERVICE_TIMES.doctor.max) * speed;
                events.push({ time: parseFloat(clock.toFixed(2)), pid: currentPid, type: 'END', loc: locDoctor });
                
                clock += 1.0;
                const locExit = isHospitalB ? 'exit_b' : 'exit';
                events.push({ time: parseFloat(clock.toFixed(2)), pid: currentPid, type: 'LEAVE', loc: locExit });
            }
        }
        
        return events.sort((a,b) => a.time - b.time);
    }
};

window.SimulationEngine = SimulationEngine;
