const SCENARIOS = {
    current: [
        { type: 'ARRIVE', loc: 'reception', delay: 0 },
        { type: 'QUEUE', loc: 'triage', delay: 0.5 },
        { type: 'START', loc: 'triage', delay: 2.5, duration: 3.0 },
        { type: 'END', loc: 'triage', delay: 5.5 },
        { type: 'QUEUE', loc: 'waiting', delay: 6.0 },
        { type: 'START', loc: 'doctor', delay: 26.0, duration: 15.0 },
        { type: 'END', loc: 'doctor', delay: 41.0 },
        { type: 'LEAVE', loc: 'exit', delay: 41.5 }
    ],
    fast_path: [ // For fast track patients
        { type: 'ARRIVE', loc: 'reception', delay: 0 },
        { type: 'QUEUE', loc: 'fast_track', delay: 0.5 },
        { type: 'START', loc: 'fast_track', delay: 2.0, duration: 5.0 },
        { type: 'END', loc: 'fast_track', delay: 7.0 },
        { type: 'LEAVE', loc: 'exit', delay: 7.5 }
    ],
    hospital_b_flow: [ // Full duplicate flow
        { type: 'ARRIVE', loc: 'reception_b', delay: 0 },
        // Skip Triage for B to make it 'efficient' alternative? Or full copy? User said "two equals".
        // Let's do full copy but simplified keys for visual mapping
        { type: 'QUEUE', loc: 'waiting_b', delay: 2.0 }, // Register -> Waiting
        { type: 'START', loc: 'doctor_b', delay: 20.0, duration: 15.0 },
        { type: 'END', loc: 'doctor_b', delay: 35.0 },
        { type: 'LEAVE', loc: 'exit_b', delay: 35.5 }
    ]
};

function generateData(scenarioName, count, startId) {
    const events = [];
    const baseFlow = SCENARIOS['current']; // Default flow
    
    // Uniform interval for smoothing, Random for others
    const interval = 60 / count; 

    for (let i = 0; i < count; i++) {
        const pid = startId + i;
        let arrivalTime = Math.random() * 60; 
        
        // Scenario specific tweaks
        let flowToUse = baseFlow;
        let speedFactor = 1.0;

        if (scenarioName === 'optimized') {
            // Sol 1: Faster service 
            speedFactor = 0.7; 
        } else if (scenarioName === 'fast_track') {
            // Sol 2: 30% Fast Track
            if (Math.random() < 0.3) flowToUse = SCENARIOS['fast_path'];
        } else if (scenarioName === 'smoothing') {
             // Sol 3: Twin Hospitals -> 50% split
             if (Math.random() < 0.5) {
                 flowToUse = SCENARIOS['hospital_b_flow'];
             }
        }

        flowToUse.forEach(step => {
            // Apply speed factor to durations (difference between steps)
            // Ideally we'd calculate accumulative time, but simple scaling helps
            const scaledDelay = step.delay * speedFactor;
            
            const time = arrivalTime + scaledDelay + (Math.random() * 0.5); 
            events.push({
                time: parseFloat(time.toFixed(2)),
                pid: pid,
                type: step.type,
                loc: step.loc
            });
        });
    }
    
    // Sort by time
    return events.sort((a, b) => a.time - b.time);
}

const output = `const SIM_DATA = {
    "current": ${JSON.stringify(generateData('current', 500, 1000), null, 2)},
    "optimized": ${JSON.stringify(generateData('optimized', 500, 2000), null, 2)},
    "fast_track": ${JSON.stringify(generateData('fast_track', 500, 3000), null, 2)},
    "smoothing": ${JSON.stringify(generateData('smoothing', 500, 4000), null, 2)}
};

window.SIM_DATA = SIM_DATA;
`;

console.log(output);
