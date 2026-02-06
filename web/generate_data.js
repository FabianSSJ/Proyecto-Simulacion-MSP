const fs = require('fs');
const path = require('path');

// Configuration
const SIMULATION_HOURS = 24;
const PATIENTS_PER_HOUR = 2.1; // ~50 patients/day (Real doctor load)
// Lambda = events per unit time (minute)
const LAMBDA = PATIENTS_PER_HOUR / 60; 

// Base Service Times (Minutes)
// Triage: ~3-8 mins
// Doctor: ~10-30 mins
const SERVICE_TIMES = {
    triage: { min: 2, max: 8 },
    doctor: { min: 10, max: 25 },
    fast_track: { min: 5, max: 15 } // Doctors in fast track are faster/simpler cases
};

const SCENARIOS = {
    current: {
        probability_fast: 0,
        probability_hospital_b: 0,
        resources_doctor: 4,
        speed_factor: 1.0
    },
    optimized: {
        probability_fast: 0,
        probability_hospital_b: 0,
        resources_doctor: 6,
        speed_factor: 0.7 // 30% faster service
    },
    fast_track: {
        probability_fast: 0.3, // 30% go to fast track
        probability_hospital_b: 0,
        resources_doctor: 4,
        speed_factor: 1.0
    },
    on_demand: {
        probability_fast: 0,
        probability_hospital_b: 0, // No twin hospital
        resources_doctor: 6, // Effectively acts like 6 when needed
        speed_factor: 0.8 // Good efficiency
    }
};

function randomExponential(lambda) {
    return -Math.log(1.0 - Math.random()) / lambda;
}

function randomUniform(min, max) {
    return Math.random() * (max - min) + min;
}

function generateEventsForScenario(scenarioName, startId) {
    const config = SCENARIOS[scenarioName];
    const events = [];
    
    let currentTime = 0;
    let pid = startId;
    const stopArrivalsTime = (SIMULATION_HOURS - 2) * 60; // Stop arrivals at 22h to clear queue
    const hardLimit = SIMULATION_HOURS * 60; // 1440 min

    while (currentTime < stopArrivalsTime) {
        // Next arrival time
        const interArrival = randomExponential(LAMBDA);
        currentTime += interArrival;
        
        if (currentTime > hardLimit) break;

        const currentPid = pid++;
        
        // Determine Path
        let isHospitalB = Math.random() < config.probability_hospital_b;
        let isFastTrack = !isHospitalB && Math.random() < config.probability_fast;

        // --- ARRIVAL ---
        const arrivalTime = currentTime;
        let suffix = isHospitalB ? '_b' : '';
        
        events.push({ time: parseFloat(arrivalTime.toFixed(2)), pid: currentPid, type: 'ARRIVE', loc: 'reception' + suffix });

        // --- FLOW GENERATION ---
        // Just adding simple delays to simulate flow step-by-step
        // In a real Discrete Event Sim, we'd use resource queues. 
        // Here we pre-calculate timestamps relative to arrival.
        
        // Service Speed Multiplier
        const speed = config.speed_factor;

        let clock = arrivalTime;

        // 1. Reception -> Triage/Queue
        clock += randomUniform(0.5, 2.0) * speed; // Walking/Registration
        
        if (isFastTrack) {
            // FAST TRACK FLOW
            events.push({ time: parseFloat(clock.toFixed(2)), pid: currentPid, type: 'QUEUE', loc: 'fast_track' });
            
            // Wait time (simulated random wait, real sim would be dynamic)
            clock += randomUniform(1, 15) * speed; 
            events.push({ time: parseFloat(clock.toFixed(2)), pid: currentPid, type: 'START', loc: 'fast_track' });
            
            // Service
            clock += randomUniform(SERVICE_TIMES.fast_track.min, SERVICE_TIMES.fast_track.max) * speed;
            events.push({ time: parseFloat(clock.toFixed(2)), pid: currentPid, type: 'END', loc: 'fast_track' });
            
            // Exit
            clock += 1.0;
            events.push({ time: parseFloat(clock.toFixed(2)), pid: currentPid, type: 'LEAVE', loc: 'exit' });

        } else {
            // STANDARD FLOW (A or B)
            let locTriage = 'triage' + (isHospitalB ? '_b' : ''); // Note: B might not have explicit triage in old usage but let's keep consistent if map supports it. 
            // Looking at game.js, B has 'triage_queue' mapped.
            
            // Triage
            events.push({ time: parseFloat(clock.toFixed(2)), pid: currentPid, type: 'QUEUE', loc: locTriage });
            
            clock += randomUniform(2, 20) * speed; // Triage Wait
            events.push({ time: parseFloat(clock.toFixed(2)), pid: currentPid, type: 'START', loc: locTriage });
            
            clock += randomUniform(SERVICE_TIMES.triage.min, SERVICE_TIMES.triage.max) * speed;
            events.push({ time: parseFloat(clock.toFixed(2)), pid: currentPid, type: 'END', loc: locTriage });

            // Waiting Room
            clock += 1.0; 
            const locWaiting = isHospitalB ? 'waiting_b' : 'waiting';
            events.push({ time: parseFloat(clock.toFixed(2)), pid: currentPid, type: 'QUEUE', loc: locWaiting });

            // Doctor
            // Wait time depends heavily on load
            // For 'current' scenario (overloaded), wait times explode.
            // We simulate this by adding larger random waits for 'current' vs others.
            // Wait time depends on load, but we keep it reasonable for the 24h visualization
            // avoiding massive artificial delays that extend the sim to 30h+
            let waitFactor = 1.0;
            if (scenarioName === 'optimized') waitFactor = 0.5; 
            if (scenarioName === 'on_demand') waitFactor = 0.7;

            clock += randomExponential(0.05) + (randomUniform(2, 10) * waitFactor);
            
            const locDoctor = isHospitalB ? 'doctor_b' : 'doctor';
            events.push({ time: parseFloat(clock.toFixed(2)), pid: currentPid, type: 'START', loc: locDoctor });

            clock += randomUniform(SERVICE_TIMES.doctor.min, SERVICE_TIMES.doctor.max) * speed;
            events.push({ time: parseFloat(clock.toFixed(2)), pid: currentPid, type: 'END', loc: locDoctor });

            // Exit
            clock += 1.0;
            const locExit = isHospitalB ? 'exit_b' : 'exit';
            events.push({ time: parseFloat(clock.toFixed(2)), pid: currentPid, type: 'LEAVE', loc: locExit });
        }
    }

    return events.sort((a,b) => a.time - b.time);
}

// Generate Data
const data = {
    current: generateEventsForScenario('current', 1000),
    optimized: generateEventsForScenario('optimized', 20000),
    fast_track: generateEventsForScenario('fast_track', 30000),
    on_demand: generateEventsForScenario('on_demand', 40000)
};

// Write File
const content = `const SIM_DATA = ${JSON.stringify(data, null, 2)};\nwindow.SIM_DATA = SIM_DATA;`;
const filePath = path.join(__dirname, 'data.js');

try {
    fs.writeFileSync(filePath, content);
    console.log(`Generated data.js with 24h simulation. ~${data.current.filter(e=>e.type==='ARRIVE').length} patients per scenario.`);
} catch(err) {
    console.error("Error writing file:", err);
}
