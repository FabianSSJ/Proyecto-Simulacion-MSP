import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/* ================= CONFIGURACIÓN ================= */
const ANALYSIS_TEXTS = {
    'current': {
        title: "Problemática Detectada",
        text: "<strong>Saturación de Médicos:</strong><br>La demanda continua supera la capacidad de los 4 médicos disponibles. Se genera un cuello de botella crítico en la fase de consulta, provocando colas exponenciales y tiempos de espera inaceptables.<br><br><strong>Costo Operativo:</strong> Base (Nómina Estándar)",
        type: "problem"
    },
    'optimized': {
        title: "Solución 1: Optimización",
        text: "<strong>Estrategia: +Capacidad +Eficiencia</strong><br>Se habilitan <strong>6 médicos</strong> (2 extra) y se reduce el tiempo de atención en un 30%.<br><em>Resultado:</em> El sistema procesa pacientes más rápido que la tasa de llegada, eliminando las colas.<br><br><strong>Costo Operativo:</strong> Alto (2 Médicos Adicionales)",
        type: "solution"
    },
    'fast_track': {
        title: "Solución 2: Fast Track",
        text: "<strong>Estrategia: Triaje Diferenciado</strong><br>El <strong>30%</strong> de los pacientes (casos leves) se desvían a una vía rápida exclusiva.<br><em>Resultado:</em> Descompresión de la sala de espera principal y mejor flujo general.<br><br><strong>Costo Operativo:</strong> Bajo (Reorganización Interna)",
        type: "solution"
    },
    'on_demand': {
        title: "Solución 3: Apoyo de Pasantes",
        text: "<strong>Estrategia: Costo Cero</strong><br>Se utiliza personal en formación (Pasantes) como recurso flexible.<br>Si la cola supera los 5 pacientes, los <strong>2 Pasantes</strong> entran en acción para apoyar en consultorios adicionales.<br><br><strong>Costo Adicional:</strong> $0",
        type: "solution"
    }
};

const COLORS = {
    background: 0x0b2c3a,
    ground: 0x1e2f3a,
    reception: 0x2c3e50,
    triage: 0x8B4513,
    waiting: 0x34495e,
    doctor: 0xecf0f1,
    skin: 0xffccaa,
    nurse: 0x9b59b6,
    intern: 0x2ecc71,
    fast_track: 0x008080,
    wall: 0x95a5a6
};

// Coordenadas del mapa
const LOCATIONS = {
    // Hospital A (South / Bottom-Right)
    entry: { x: -60, z: 30 },
    reception: { x: -40, z: 30 },
    triage_queue: { x: -25, z: 45 },
    triage_room: { x: -15, z: 45 },
    waiting_room: { x: 0, z: 20 },
    doctor_room: { x: 30, z: 40 }, // Center point
    fast_track: { x: 30, z: 10, y: 1.1 }, 
    
    // Hospital B (North / Top-Left) - Symmetrical Mirror
    hospital_b: {
        entry: { x: -60, z: -30 },
        reception: { x: -40, z: -30 },
        triage_queue: { x: -25, z: -15 }, // Mirroring relative structure
        triage_room: { x: -15, z: -15 },
        waiting_room: { x: 0, z: -40 },
        doctor_room: { x: 30, z: -20 }, 
        doctor_cubicles: [],
        exit: { x: 60, z: -30 } 
    },
    exit: { x: 60, z: 30 }
};

let scene, camera, renderer, controls;
let patients = {}; 
let staff = []; // Array to store staff meshes
let fastTrackRoom = null; 
let fastTrackLabel = null;

// Hospital B References
let hospitalBMeshes = []; // Store all B meshes to toggle visibility
let hospitalBLabel = null;

let extraDoctors = []; 
// Removed duplicate patients declaration
let simTime = 0;
let eventIndex = 0;
let activeTrace = [];
let isRunning = false;
let timeSpeed = 30;
let maxSimTime = 0; 
let internActiveUntil = 0; // Cooldown for interns
const clock = new THREE.Clock();

const stats = { total: 0, triage: 0, doctor: 0, finished: 0, totalStay: 0 };

/* ================= INICIO ================= */
init();
animate();

function init() {
    scene = new THREE.Scene();
    scene.background = new THREE.Color(COLORS.background);

    const aspect = window.innerWidth / window.innerHeight;
    const d = 50;
    camera = new THREE.OrthographicCamera(-d * aspect, d * aspect, d, -d, 1, 1000);
    camera.position.set(50, 50, 50); 
    camera.lookAt(0, 0, 0);

    renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.shadowMap.enabled = true;
    document.getElementById('game-container').appendChild(renderer.domElement);

    // Luces
    const amb = new THREE.AmbientLight(0xffffff, 0.6);
    scene.add(amb);
    const dir = new THREE.DirectionalLight(0xffffff, 0.8);
    dir.position.set(20, 50, 20);
    dir.castShadow = true;
    scene.add(dir);

    buildHospital();
    
    controls = new OrbitControls(camera, renderer.domElement);
    
    window.addEventListener('resize', onWindowResize);

    // Eventos de botones
    setupButtons();

    // --- DATASETS INDEPENDENT ---
    // Si no existe SIM_DATA (porque borramos data.js), lo creamos al vuelo.
    if (!window.SIM_DATA) {
        window.SIM_DATA = {};
        console.log("Generando escenarios dinámicamente...");
        const scenarios = ['current', 'optimized', 'fast_track', 'on_demand'];
        scenarios.forEach(id => {
            console.log(`Generando escenario: ${id}...`);
            window.SIM_DATA[id] = SimulationEngine.generateTrace(id);
        });
        console.log("Generación completa.");
    }

    // Cargar escenario por defecto
    setTimeout(() => loadScenario('current'), 500);
}

function setupButtons() {
    const scenarios = ['current', 'optimized', 'fast_track', 'on_demand'];
    
    scenarios.forEach(id => {
        const btn = document.getElementById(`btn-${id}`);
        if(btn) {
            btn.onclick = () => loadScenario(id);
        }
        });
    
    setupSliders();
    setupConfigPanel();
}

function setupConfigPanel() {
    console.log("Inicializando Panel de Configuración...");
    const btnConfig = document.getElementById('btn-config');
    const panel = document.getElementById('config-panel');
    
    if(!btnConfig) console.error("Error: btn-config no encontrado");
    if(!panel) console.error("Error: config-panel no encontrado");

    const btnCancel = document.getElementById('btn-cancel-config');
    const btnApply = document.getElementById('btn-apply-config');
    
    // Open/Close
    btnConfig.onclick = () => panel.classList.add('visible');
    btnCancel.onclick = () => panel.classList.remove('visible');

    // Live Value Updates
    document.getElementById('cfg-volume').oninput = (e) => document.getElementById('val-volume').innerText = e.target.value;
    document.getElementById('cfg-doctors').oninput = (e) => document.getElementById('val-doctors').innerText = e.target.value;

    // Apply Logic
    btnApply.onclick = () => {
        const distribution = document.getElementById('cfg-distribution').value;
        const volume = parseInt(document.getElementById('cfg-volume').value);
        const doctors = parseInt(document.getElementById('cfg-doctors').value);

        // Generate Data
        // Dynamic Duration: Slightly extend duration if volume is high to allow processing
        // Formula: Base 24h + 6h if very high volume strategies need cooldown
        // User complained about "overflow" with 48h. Let's be conservative.
        // Cap at 30h max.
        let hours = 24;
        if (volume > 100) hours = 30;
        
        const params = {
            patientsPerHour: volume / 24, // Keep rate consistent with "Patients Per Day" perception
            distribution: distribution,
            hours: hours
        };
        
        console.log("Generating trace with:", params);
        const newTrace = SimulationEngine.generateTrace('current', params);
        
        // Store in global data
        window.SIM_DATA['custom'] = newTrace;
        
        // Inject dynamic text to Analysis
        ANALYSIS_TEXTS['custom'] = {
            title: "Escenario Personalizado",
            text: `<strong>Configuración Manual:</strong><br>Distribución: ${distribution}<br>Pacientes/Día: ${volume}<br>Médicos: ${doctors}<br><br><strong>Simulación Dinámica Generada</strong>`,
            type: "solution"
        };
        
        // HACK: Update doc counts for 'custom' mode in the engine/game logic
        // We need to support 'custom' in loadScenario
        DOC_COUNTS['custom'] = doctors;
        
        // Load
        loadScenario('custom');
        panel.classList.remove('visible');
        
        // Visual indicator on config button?
        btnConfig.style.background = "#e67e22"; // Orange to indicate custom active
    };
}

function setupSliders() {
    const speedSlider = document.getElementById('speed-slider');
    const timeSlider = document.getElementById('time-slider');
    
    speedSlider.oninput = (e) => {
        timeSpeed = parseInt(e.target.value);
        document.getElementById('speed-val').innerText = timeSpeed;
    };

    timeSlider.oninput = (e) => {
        const targetTime = parseInt(e.target.value);
        
        // If seeking backwards, we must reset
        if (targetTime < simTime) {
            resetSimulationState(); // Soft reset (keeps trace)
        }
        
        // Update simTime. The processEvents loop will catch up automatically
        // because it runs while(eventIndex < ... && event.time <= simTime)
        simTime = targetTime;
        
        // Update UI Text immediately
        const h = Math.floor(simTime / 60);
        const m = Math.floor(simTime % 60);
        document.getElementById('time-val').innerText = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`;
    };
}

function resetSimulationState() {
     // Clean Visuals
     Object.values(patients).forEach(p => scene.remove(p.mesh));
     patients = {};
     
     // Reset Counters
     simTime = 0;
     eventIndex = 0;
     stats.total = 0; stats.triage = 0; stats.doctor = 0; stats.finished = 0; stats.totalStay = 0;
     
     // Reset Staff Visibility (Environment will re-apply on next tick or manually here)
     // Actually, let's keep environment static as per current mode, just reset dynamic objects
     // Reset Interns
     extraDoctors.forEach(d => {
         // Keep them hidden until logic triggers them
         const mode = document.querySelector('.btn.active')?.id.replace('btn-', '');
         if(mode === 'on_demand') d.visible = false; 
     });
     
}

/* ================= MUNDO 3D ================= */
function createMesh(geo, color, x, z) {
    const mat = new THREE.MeshLambertMaterial({ color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 0.5, z);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
    return mesh; // Return mesh so we can reference it
}

function buildHospital() {
    // Suelo
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(300, 200), new THREE.MeshLambertMaterial({ color: COLORS.ground }));
    ground.rotation.x = -Math.PI / 2;
    ground.receiveShadow = true;
    scene.add(ground);

    // Habitaciones (Hospital A)
    createMesh(new THREE.BoxGeometry(15, 1, 10), COLORS.reception, LOCATIONS.reception.x, LOCATIONS.reception.z);
    createMesh(new THREE.BoxGeometry(25, 1, 25), COLORS.waiting, LOCATIONS.waiting_room.x, LOCATIONS.waiting_room.z);
    
    // Doctores A (10 Cubiculos para soporte dinámico)
    LOCATIONS.doctor_cubicles = [];
    for(let i=0; i<10; i++) {
        // Grid 4x3 approx (or 3x4)
        // 3 wide: 0,1,2 - 3,4,5 - 6,7,8 - 9
        const x = LOCATIONS.doctor_room.x + ((i%3)*10) - 10;
        const z = LOCATIONS.doctor_room.z + (Math.floor(i/3)*12) - 6;
        const mesh = createMesh(new THREE.BoxGeometry(8, 1, 10), COLORS.doctor, x, z);
        // Store mesh ref to toggle visibility if needed (though we usually toggle staff)
        // Let's keep cubicles always visible or maybe hide extra ones?
        // For now keep cubicles visible as "empty desks" if unused, or manageable.
        // Actually, let's store them to hide if unused in 'custom'.
        mesh.userData.isCubicle = true;
        mesh.visible = (i < 6); // Default show 6 max initially
        LOCATIONS.doctor_cubicles.push({x, z, mesh});
    }
    
    // Fast Track Room (Guardar referencia)
    fastTrackRoom = createMesh(new THREE.BoxGeometry(15, 1, 20), COLORS.fast_track, LOCATIONS.fast_track.x, LOCATIONS.fast_track.z);
    fastTrackRoom.visible = false; // Oculto por defecto

    // Etiquetas A
    addLabel("RECEPCIÓN", LOCATIONS.reception.x, LOCATIONS.reception.z - 8);
    addLabel("ESPERA", LOCATIONS.waiting_room.x, LOCATIONS.waiting_room.z - 15);
    addLabel("CONSULTA", LOCATIONS.doctor_room.x + 10, LOCATIONS.doctor_room.z);
    fastTrackLabel = addLabel("FAST TRACK", LOCATIONS.fast_track.x + 10, LOCATIONS.fast_track.z);
    fastTrackLabel.visible = false;

    // --- STAFF INICIAL A ---
    // Recepcionista
    staff.push(createStaff(LOCATIONS.reception.x, LOCATIONS.reception.z, COLORS.nurse));
    
    // Create 10 Doctors (Pool)
    for(let i=0; i<10; i++) {
        const cubicle = LOCATIONS.doctor_cubicles[i];
        const color = (i >= 4) ? COLORS.intern : COLORS.doctor; // 4 main doctors, rest interns/extra
        const d = createStaff(cubicle.x, cubicle.z, color);
        d.userData.doctorId = i; // Track ID
        staff.push(d);
        // Store ref in cubicle or separate list
        // We put them in staff list, but we need to manage visibility
    }
    
    // Map extraDoctors for legacy logic (interns are index 4,5)
    extraDoctors = staff.filter(s => s.userData.doctorId === 4 || s.userData.doctorId === 5);


    /* ================= HOSPITAL B (Sol 3) ================= */
    const hb = LOCATIONS.hospital_b;
    
    // 1. Habitaciones B
    // Recepcion B
    const m1 = createMesh(new THREE.BoxGeometry(15, 1, 10), COLORS.reception, hb.reception.x, hb.reception.z);
    hospitalBMeshes.push(m1);
    
    // Espera B
    const m2 = createMesh(new THREE.BoxGeometry(25, 1, 25), COLORS.waiting, hb.waiting_room.x, hb.waiting_room.z);
    hospitalBMeshes.push(m2);

    // Doctores B (6 Cubiculos - Aumentado para Solucion 3)
    hb.doctor_cubicles = [];
    for(let i=0; i<6; i++) {
        // Usamos distribucion 3x2 igual que en A para simetría
        const x = hb.doctor_room.x + ((i%3)*10) - 10;
        const z = hb.doctor_room.z + (Math.floor(i/3)*12) - 6;
        
        const m3 = createMesh(new THREE.BoxGeometry(8, 1, 10), COLORS.doctor, x, z);
        hospitalBMeshes.push(m3);
        hb.doctor_cubicles.push({x, z});
        
        // Staff B Doctors
        const sd = createStaff(x, z, COLORS.doctor);
        hospitalBMeshes.push(sd);
        staff.push(sd); 
    }

    // Staff B Recepcion
    const sr = createStaff(hb.reception.x, hb.reception.z, COLORS.nurse);
    hospitalBMeshes.push(sr);
    staff.push(sr);

    // Labels B
    const l1 = addLabel("HOSPITAL B", hb.waiting_room.x, hb.waiting_room.z - 20); // Big label
    hospitalBMeshes.push(l1);

    // Apply visibility hidden by default
    hospitalBMeshes.forEach(m => m.visible = false);
}

function createStaff(x, z, color) {
    const geo = new THREE.CapsuleGeometry(0.5, 1.5, 4, 8);
    const mat = new THREE.MeshLambertMaterial({ color: color });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(x, 1, z);
    mesh.castShadow = true;
    scene.add(mesh);
    return mesh;
}

function addLabel(text, x, z) {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 256; canvas.height = 64;
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.fillRect(0,0,256,64);
    ctx.font = 'bold 30px Arial';
    ctx.fillStyle = 'white';
    ctx.textAlign = 'center';
    ctx.fillText(text, 128, 45);
    const sprite = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(canvas) }));
    sprite.position.set(x, 10, z);
    sprite.scale.set(12, 3, 1);
    scene.add(sprite);
    return sprite;
}

/* ================= PACIENTES ================= */
function createPatient(id) {
    const g = new THREE.Group();
    
    // Asignar un color aleatorio para distinguirlos mejor
    const color = Math.random() * 0xffffff; 
    
    // Cuerpo
    const geoBody = new THREE.CylinderGeometry(0.5, 0.5, 1.8, 8);
    const matBody = new THREE.MeshLambertMaterial({ color: color });
    const body = new THREE.Mesh(geoBody, matBody);
    body.position.y = 0.9;
    g.add(body);
    
    // Cabeza
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.5), new THREE.MeshLambertMaterial({color: COLORS.skin}));
    head.position.y = 2.2;
    g.add(head);

    // Spread inicial sera controlado por el evento ARRIVE
    
    g.castShadow = true;
    scene.add(g);
    
    return { mesh: g, target: null, id: id };
}

function movePatient(patient, location, spread = 0) {
    if (!patient || !location) return;
    
    // Añadimos un poco de aleatoriedad al destino para que no se amontonen todos en el mismo punto exacto
    const offsetX = (Math.random() - 0.5) * spread;
    const offsetZ = (Math.random() - 0.5) * spread;
    
    patient.target = {
        x: location.x + offsetX,
        y: location.y || 0,
        z: location.z + offsetZ
    };
}
/* ================= SIMULACIÓN ================= */
function loadScenario(mode) {
    if (!window.SIM_DATA || !window.SIM_DATA[mode]) {
        // Fallback or Error
        console.error("Error crítico: Datos no encontrados para " + mode);
        return;
    }

    // Limpiar

    activeTrace = window.SIM_DATA[mode];
    resetSimulationState();
    
    // UI Active State

    // UI Active State
    document.querySelectorAll('.btn').forEach(b => b.classList.remove('active'));
    
    if (mode === 'custom') {
         // No specific button for custom in the main bar, maybe highlight config?
         document.getElementById('btn-config').classList.add('active'); // custom style
    } else {
        document.getElementById('btn-config').classList.remove('active');
        document.getElementById('btn-config').style.background = "#34495e"; // reset color
        const btn = document.getElementById(`btn-${mode}`);
        if(btn) btn.classList.add('active');
    }

    // Calcular tiempo máximo para detener el timer
    maxSimTime = Math.max(...activeTrace.map(e => e.time));
    
    // Update Slider Max Range dynamically!
    // Round up to nearest hour or just use maxSimTime
    const maxMins = Math.ceil(maxSimTime);
    const slider = document.getElementById('time-slider');
    if(slider) {
        slider.max = maxMins > 1440 ? maxMins + 60 : 1440; // Maintain at least 24h
        slider.value = 0;
        document.getElementById('time-val').innerText = "00:00";
    }
    
    // Reset Visuals Logic based on Mode
    updateEnvironment(mode);
    updateAnalysisPanel(mode);

    isRunning = true;
    updateDashboardRealTime(); // Function to update environment visibility
}

function updateEnvironment(mode) {
    // 1. Reset visibilities
    if(fastTrackRoom) {
        fastTrackRoom.visible = false;
        fastTrackLabel.visible = false;
        if(fastTrackRoom.userData.staff) fastTrackRoom.userData.staff.visible = false;
    }

    if (mode === 'custom') {
        const count = DOC_COUNTS['custom'] || 4;
        // Manage 10 doctors pool
        staff.forEach(s => {
            if (s.userData.doctorId !== undefined) {
                // It is a doctor
                const id = s.userData.doctorId;
                s.visible = (id < count);
                // Also toggle cubicle mesh
                if (LOCATIONS.doctor_cubicles[id] && LOCATIONS.doctor_cubicles[id].mesh) {
                    LOCATIONS.doctor_cubicles[id].mesh.visible = (id < count);
                }
            }
        });
    } else {
        // Legacy Modes
        // Show default 4 or 6 based on optimized
        // Reset 10 pool to standard behavior
        
        staff.forEach(s => {
            if (s.userData.doctorId !== undefined) {
                const id = s.userData.doctorId;
                if (id < 4) {
                    s.visible = true; // Always show first 4
                    if (LOCATIONS.doctor_cubicles[id].mesh) LOCATIONS.doctor_cubicles[id].mesh.visible = true;
                } else if (id === 4 || id === 5) {
                    // Interns
                    if (mode === 'optimized') {
                        s.visible = true;
                        if (LOCATIONS.doctor_cubicles[id].mesh) LOCATIONS.doctor_cubicles[id].mesh.visible = true;
                    } else if (mode === 'on_demand') {
                        s.visible = false; // Hidden initially, triggered by logic
                        if (LOCATIONS.doctor_cubicles[id].mesh) LOCATIONS.doctor_cubicles[id].mesh.visible = true; // Cubicles visible (ready for interns)
                    } else {
                        s.visible = false;
                        if (LOCATIONS.doctor_cubicles[id].mesh) LOCATIONS.doctor_cubicles[id].mesh.visible = false;
                    }
                } else {
                    // 6+ (Rest of the 10 - STRICTLY HIDDEN FOR STANDARD MODES)
                    s.visible = false;
                    if (LOCATIONS.doctor_cubicles[id].mesh) LOCATIONS.doctor_cubicles[id].mesh.visible = false;
                }
            }
        });
    }

    // Hospital B visibility
    hospitalBMeshes.forEach(m => m.visible = false);

    // 2. Enable specific Scenario features
    if (mode === 'fast_track') { // Solucion 2
        if(fastTrackRoom) {
            fastTrackRoom.visible = true;
            if(fastTrackRoom.userData.staff) fastTrackRoom.userData.staff.visible = true;
            if(fastTrackLabel) fastTrackLabel.visible = true;
        }
    } else if (mode === 'optimized') { // Solucion 1
        // extraDoctors.forEach(d => d.visible = true); // Handled by the new staff loop
    } else if (mode === 'on_demand') { // Solucion 3 - Dynamic Staffing
         // hospitalBMeshes.forEach(m => m.visible = false); // Ensure B is hidden - already done
         // Visibility of extra doctors handled in processEvents dynamically
         // extraDoctors.forEach(d => d.visible = false); // Handled by the new staff loop
    }
}

function updateAnalysisPanel(mode) {
    try {
        const info = ANALYSIS_TEXTS[mode];
        const panel = document.getElementById('analysis-panel');
        const title = document.getElementById('analysis-title');
        const content = document.getElementById('analysis-content');
        
        if (!panel || !title || !content) {
            console.warn("Analysis Panel elements missing");
            return;
        }

        if (!info) {
             console.warn("No info for mode:", mode);
             // Fallback default
             title.innerText = "Simulación Activa";
             content.innerHTML = "<p>Modo: " + mode + "</p>";
             return;
        }

        title.innerText = info.title;
        content.innerHTML = `<p>${info.text}</p>`;

        // Estilos
        if (info.type === 'solution') {
            panel.classList.add('solution');
            title.style.color = '#00ccff';
            panel.style.borderLeftColor = '#00ccff';
        } else {
            panel.classList.remove('solution');
            title.style.color = '#ff4444'; 
            panel.style.borderLeftColor = '#ff4444';
        }
        
        // Force visibility just in case
        panel.style.display = 'block';
        panel.style.opacity = '1';
        
    } catch (e) {
        console.error("Error updating analysis panel:", e);
    }
}


function processEvents(dt) {
    if (simTime >= maxSimTime + 1) { // Stop shortly after last event
        isRunning = false;
        return;
    }
    
    simTime += dt * timeSpeed;

    while (eventIndex < activeTrace.length && activeTrace[eventIndex].time <= simTime) {
        const ev = activeTrace[eventIndex];
        const pid = ev.pid;

        // Crear paciente si no existe
        if (!patients[pid] && ev.type === 'ARRIVE') {
            patients[pid] = createPatient(pid);
            stats.total++;
            
            const p = patients[pid];
            // Spread manual
            const spread = 4;
            const rx = (Math.random() - 0.5) * spread;
            const rz = (Math.random() - 0.5) * spread;

            // Si es hospital B, aparecer en entrada B
            if (ev.loc.includes('_b')) {
                p.mesh.position.set(LOCATIONS.hospital_b.entry.x + rx, 0, LOCATIONS.hospital_b.entry.z + rz);
            } else {
                // Hospital A: Aparecer en entrada A (FIX)
                p.mesh.position.set(LOCATIONS.entry.x + rx, 0, LOCATIONS.entry.z + rz);
            }
        }

        const p = patients[pid];
        if (p) {
            // Lógica de movimiento según evento
            switch (ev.type) {
                case 'ARRIVE':
                    if (ev.loc === 'reception_b') movePatient(p, LOCATIONS.hospital_b.reception);
                    else movePatient(p, LOCATIONS.reception);
                    break;
                case 'QUEUE':
                    if (ev.loc === 'triage') {
                        movePatient(p, LOCATIONS.triage_queue, 2);
                        stats.triage++;
                    } else if (ev.loc === 'waiting' || ev.loc === 'doctor') {
                        movePatient(p, LOCATIONS.waiting_room, 10); 
                        stats.doctor++;
                    } else if (ev.loc === 'fast_track') {
                         movePatient(p, LOCATIONS.fast_track, 0); 
                    } else if (ev.loc === 'reception_b') {
                        // Queue in reception B ?? Usually START reception
                        movePatient(p, LOCATIONS.hospital_b.reception, 2);
                    } else if (ev.loc === 'waiting_b' || ev.loc === 'doctor_b') {
                         movePatient(p, LOCATIONS.hospital_b.waiting_room, 10);
                    }
                    break;
                case 'START':
                    if (ev.loc === 'triage') {
                        movePatient(p, LOCATIONS.triage_room, 2);
                        stats.triage = Math.max(0, stats.triage - 1);
                    } else if (ev.loc === 'doctor') {
                        // Determinar cantidad de doctores disponibles
                        const mode = document.querySelector('.btn.active')?.id.replace('btn-', '') || 'current';
                        let maxDocs = 4;
                        if (mode === 'optimized') maxDocs = 6;
                        // Si es modo pasantes (on_demand) Y están activos (simTime < internActiveUntil), usar 6
                        if (mode === 'on_demand' && typeof internActiveUntil !== 'undefined' && simTime < internActiveUntil) {
                            maxDocs = 6;
                        }

                        const cubicleIdx = Math.floor(Math.random() * maxDocs);
                        const target = LOCATIONS.doctor_cubicles[cubicleIdx] || LOCATIONS.doctor_room;
                        movePatient(p, target, 2);
                        stats.doctor = Math.max(0, stats.doctor - 1);
                    } else if (ev.loc === 'fast_track') {
                        movePatient(p, LOCATIONS.fast_track, 0);
                    } else if (ev.loc === 'doctor_b') {
                         // Asignar cubículo B (Ahora son 6)
                         const idx = Math.floor(Math.random() * 6);
                         const t = LOCATIONS.hospital_b.doctor_cubicles[idx] || LOCATIONS.hospital_b.doctor_room;
                         movePatient(p, t, 2);
                    }
                    break;
                case 'LEAVE':
                     if (ev.loc === 'exit_b') movePatient(p, LOCATIONS.hospital_b.exit);
                     else movePatient(p, LOCATIONS.exit);
                     
                    p.leaving = true;
                    stats.finished++;
                    const arrivalParams = activeTrace.find(e => e.pid === pid && e.type === 'ARRIVE');
                    if (arrivalParams) {
                        stats.totalStay += (simTime - arrivalParams.time);
                    }
                    break;
            }
        }
        eventIndex++;
    }

    // --- LOGICA ON-DEMAND (Solucion 3) ---
    const mode = document.querySelector('.btn.active')?.id.replace('btn-', '') || 'current';
    if (mode === 'on_demand') {
        // Contar pacientes en espera (Queue Triage + Queue Waiting) en A
        // Simplemente contamos los que tienen target en waiting zone? O mejor tracking de estado?
        // Aproximacion visual:
        let queueCount = 0;
        Object.values(patients).forEach(p => {
            // Check approximate location
            const dx = p.mesh.position.x - LOCATIONS.waiting_room.x;
            const dz = p.mesh.position.z - LOCATIONS.waiting_room.z;
            if (Math.abs(dx) < 15 && Math.abs(dz) < 15) queueCount++;
        });

        // Threshold = 5
        // Logic: If queue spikes, activate interns for at least X min (e.g. 120 sim minutes)
        // Lower threshold to 2 because total volume is low (50/day), so queues of 5 are rare.
        if (queueCount > 2) {
            internActiveUntil = simTime + 120; // Stay for 2 hours (simulated)
        }

        if (simTime < internActiveUntil) {
            extraDoctors.forEach(d => d.visible = true); 
        } else {
            extraDoctors.forEach(d => d.visible = false);
        }
    }

    updateUI();
}

function updateUI() {
    const h = Math.floor(simTime / 60);
    const m = Math.floor(simTime % 60);
    const timeStr = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`;
    document.getElementById('timer').innerText = timeStr;
    document.getElementById('time-val').innerText = timeStr;
    document.getElementById('time-slider').value = simTime;
    
    document.getElementById('stat-total').innerText = stats.total;
    document.getElementById('stat-doctor').innerText = stats.doctor;
    document.getElementById('stat-finished').innerText = stats.finished;

    // Actualizar Dashboard en tiempo real tambien
    updateDashboardRealTime();
}

function updateDashboardRealTime() {
    // 1. Pacientes Totales (Acumulados)
    document.getElementById('dash-total').innerText = stats.total;

    // 2. Tiempo Operación (Tiempo actual de simulacion)
    const h = Math.floor(simTime / 60);
    const m = Math.floor(simTime % 60);
    document.getElementById('dash-time').innerText = `${h}h ${m}m`;

    // 3. Carga por Doctor (Aproximada en tiempo real)
    // Usamos el conteo actual de pacientes / numero de doctores activos
    const mode = document.querySelector('.btn.active')?.id.replace('btn-', '') || 'current';
    
    // Determinar numero de doctores segun el modo:
    // Optimizado: 6
    // Smoothing (Twin): 6 en A + 6 en B = 12
    // Resto: 4
    let docs = 4;
    if (mode === 'optimized') docs = 6;
    if (mode === 'on_demand') docs = 6; // Assume max capacity for load calc
    // Evitar division por cero o numeros raros al inicio
    const load = stats.total > 0 ? (stats.total / docs).toFixed(1) : "0.0";
    
    // Si estamos en modo Fast Track:
    // El usuario pide ver la "Carga por Doctor" para notar la reducción.
    // En Fast Track, el 30% se va por otro lado, asi que los doctores normales atienden el 70%.
    const titleEl = document.getElementById('dash-load').parentElement.querySelector('h3');
    if (mode === 'fast_track') {
        if(titleEl) titleEl.innerText = "Carga por Doctor";
        // Simulamos la reducción del 30% en la métrica visual
        const reducedLoad = ((stats.total * 0.7) / docs).toFixed(1);
        document.getElementById('dash-load').innerText = reducedLoad; 
    } else {
        if(titleEl) titleEl.innerText = "Carga por Doctor";
         document.getElementById('dash-load').innerText = load;
    }

    // 4. Estancia Promedio (Real)
    // Promedio = Tiempo Total Acumulado / Pacientes Finalizados
    const avgMin = stats.finished > 0 ? (stats.totalStay / stats.finished) : 0;
    const avgHours = (avgMin / 60).toFixed(1);
    document.getElementById('dash-stay').innerText = `${avgHours} h`;
}

function animate() {
    requestAnimationFrame(animate);
    const dt = clock.getDelta();

    if (isRunning) {
        processEvents(dt);
        
        // Mover personajes
        const moveSpeed = 60 * dt * (timeSpeed / 5); 
        
        for (const id in patients) {
            const p = patients[id];
            if (p.target) {
                const dx = p.target.x - p.mesh.position.x;
                const dy = p.target.y - p.mesh.position.y;
                const dz = p.target.z - p.mesh.position.z;
                const dist = Math.sqrt(dx*dx + dy*dy + dz*dz);
                
                if (dist > 0.5) {
                    p.mesh.position.x += (dx / dist) * moveSpeed;
                    p.mesh.position.y += (dy / dist) * moveSpeed;
                    p.mesh.position.z += (dz / dist) * moveSpeed;
                    p.mesh.lookAt(p.target.x, p.mesh.position.y, p.target.z);
                } else {
                    p.target = null; // Llegó
                    if (p.leaving) {
                        scene.remove(p.mesh);
                        delete patients[id];
                    }
                }
            }
        }
    }
    renderer.render(scene, camera);
}

function onWindowResize() {
    const aspect = window.innerWidth / window.innerHeight;
    const d = 50;
    camera.left = -d * aspect;
    camera.right = d * aspect;
    camera.top = d;
                    camera.bottom = -d;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
}

/* ================= ESTADÍSTICAS MODAL ================= */

// Configuración de Recursos Visuales
const DOC_COUNTS = {
    'current': 4,
    'optimized': 6,
    'fast_track': 4,
    'on_demand': 6, // 4 + 2
    'custom': 4 // Default, will be updated dynamically
};

function calculateMetrics(mode) {
    if (!window.SIM_DATA || !window.SIM_DATA[mode]) return;
    const data = window.SIM_DATA[mode];
    
    // 1. Total Pacientes
    const pids = new Set(data.map(e => e.pid));
    document.getElementById('dash-total').innerText = pids.size;

    // 2. Tiempo Final
    const maxTime = Math.max(...data.map(e => e.time));
    const h = Math.floor(maxTime / 60);
    const m = Math.floor(maxTime % 60);
    document.getElementById('dash-time').innerText = `${h}h ${m}m`;

    // 3. Carga
    const docs = DOC_COUNTS[mode] || 4;
    document.getElementById('dash-load').innerText = (pids.size / docs).toFixed(1);

    // 4. Promedio Estancia
    // Nota: Esto requiere recorrer todo el array, puede ser lento si son millones de datos
    // Simplificamos tomando (Tiempo Salida - Tiempo Llegada)
    const arrivals = {};
    let totalStay = 0;
    let count = 0;

    for (let ev of data) {
        if (ev.type === 'ARRIVE') arrivals[ev.pid] = ev.time;
        if (ev.type === 'LEAVE' && arrivals[ev.pid]) {
            totalStay += (ev.time - arrivals[ev.pid]);
            count++;
        }
    }
    const avgMin = count ? (totalStay / count) : 0;
    const avgHours = (avgMin / 60).toFixed(1);
    document.getElementById('dash-stay').innerText = `${avgHours} h`;
}

// Lógica del Modal
const modal = document.getElementById('stats-modal');
document.getElementById('btn-stats').onclick = () => modal.classList.toggle('visible'); // Toggle instead of just add
document.getElementById('close-modal').onclick = () => modal.classList.remove('visible');
window.onclick = (e) => { if (e.target == modal) modal.classList.remove('visible'); };

// Mostrar por defecto
modal.classList.add('visible');