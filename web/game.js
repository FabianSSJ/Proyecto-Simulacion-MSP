import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

/* ================= CONFIGURACIÓN ================= */
const ANALYSIS_TEXTS = {
    'current': {
        title: "⚠️ Problemática Detectada",
        text: "<strong>Saturación de Médicos:</strong><br>La demanda continua supera la capacidad de los 4 médicos disponibles. Se genera un cuello de botella crítico en la fase de consulta, provocando colas exponenciales y tiempos de espera inaceptables.",
        type: "problem"
    },
    'optimized': {
        title: "✅ Solución 1: Optimización",
        text: "<strong>Estrategia: +Capacidad +Eficiencia</strong><br>Se habilitan <strong>6 médicos</strong> (2 extra) y se reduce el tiempo de atención en un 30%.<br><em>Resultado:</em> El sistema procesa pacientes más rápido que la tasa de llegada, eliminando las colas.",
        type: "solution"
    },
    'fast_track': {
        title: "✅ Solución 2: Fast Track",
        text: "<strong>Estrategia: Triaje Diferenciado</strong><br>El <strong>30%</strong> de los pacientes (casos leves) se desvían a una vía rápida exclusiva (Cyan).<br><em>Resultado:</em> Descompresión de la sala de espera principal y mejor flujo general.",
        type: "solution"
    },
    'smoothing': {
        title: "✅ Solución 3: Hospital Gemelo",
        text: "<strong>Estrategia: Balanceo de Carga</strong><br>Se habilita un segundo hospital idéntico y la demanda se divide <strong>50/50</strong>.<br><em>Resultado:</em> Cada hospital maneja la mitad de carga, operando en zona segura de sub-saturación.",
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
    fast_track: 0x008080, // Color cyan oscuro
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
let timeSpeed = 5;
let maxSimTime = 0; 
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

    // Cargar escenario por defecto
    setTimeout(() => loadScenario('current'), 500);
}

function setupButtons() {
    const scenarios = ['current', 'optimized', 'fast_track', 'smoothing'];
    
    scenarios.forEach(id => {
        const btn = document.getElementById(`btn-${id}`);
        if(btn) {
            btn.onclick = () => loadScenario(id);
        }
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
    
    // Doctores A (6 Cubiculos individuales)
    LOCATIONS.doctor_cubicles = [];
    for(let i=0; i<6; i++) {
        const x = LOCATIONS.doctor_room.x + ((i%3)*10) - 10;
        const z = LOCATIONS.doctor_room.z + (Math.floor(i/3)*12) - 6;
        createMesh(new THREE.BoxGeometry(8, 1, 10), COLORS.doctor, x, z);
        LOCATIONS.doctor_cubicles.push({x, z});
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
    // Doctores (4 Iniciales - asignados a los primeros 4 cubiculos)
    for(let i=0; i<4; i++) {
        const cubicle = LOCATIONS.doctor_cubicles[i];
        staff.push(createStaff(cubicle.x, cubicle.z, COLORS.doctor));
    }
    // Doctores Extra (Ocultos inicialmente - asignados a los ultimos 2 cubiculos)
    for(let i=0; i<2; i++) {
        const cubicle = LOCATIONS.doctor_cubicles[4+i];
        const d = createStaff(cubicle.x, cubicle.z, COLORS.doctor);
        d.visible = false;
        extraDoctors.push(d);
    }
    // Fast Track Staff (Oculto)
    const ftStaff = createStaff(LOCATIONS.fast_track.x, LOCATIONS.fast_track.z, COLORS.doctor);
    ftStaff.visible = false;
    staff.push(ftStaff); 
    fastTrackRoom.userData.staff = ftStaff;


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
        alert("Error: Datos no encontrados para el escenario: " + mode + ". Revisa data.js");
        return;
    }

    // Limpiar
    Object.values(patients).forEach(p => scene.remove(p.mesh));
    patients = {};
    activeTrace = window.SIM_DATA[mode];
    simTime = 0;
    eventIndex = 0;
    
    // Reset stats
    stats.total = 0; stats.triage = 0; stats.doctor = 0; stats.finished = 0; stats.totalStay = 0;

    // UI Active State
    document.querySelectorAll('.btn').forEach(b => b.classList.remove('active'));
    const btn = document.getElementById(`btn-${mode}`);
    if(btn) btn.classList.add('active');

    // Calcular tiempo máximo para detener el timer
    maxSimTime = Math.max(...activeTrace.map(e => e.time));
    
    // Reset Visuals Logic based on Mode
    updateEnvironment(mode);
    updateAnalysisPanel(mode);

    isRunning = true;
    updateDashboardRealTime(); // Reset dashboard numbers
}

function updateEnvironment(mode) {
    // 1. Reset visibilities
    if(fastTrackRoom) {
        fastTrackRoom.visible = false;
        if(fastTrackRoom.userData.staff) fastTrackRoom.userData.staff.visible = false;
        if(fastTrackLabel) fastTrackLabel.visible = false;
    }
    hospitalBMeshes.forEach(m => m.visible = false);
    extraDoctors.forEach(d => d.visible = false);

    // 2. Enable specific Scenario features
    if (mode === 'fast_track') { // Solucion 2
        if(fastTrackRoom) {
            fastTrackRoom.visible = true;
            if(fastTrackRoom.userData.staff) fastTrackRoom.userData.staff.visible = true;
            if(fastTrackLabel) fastTrackLabel.visible = true;
        }
    } else if (mode === 'optimized') { // Solucion 1
        extraDoctors.forEach(d => d.visible = true);
    } else if (mode === 'smoothing') { // Solucion 3 - Twin Hospital
         hospitalBMeshes.forEach(m => m.visible = true);
         // Tambien activamos los doctores extra del hospital A para que ambos tengan 6
         extraDoctors.forEach(d => d.visible = true);
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
                        const cubicleIdx = Math.floor(Math.random() * (isRunning && document.getElementById('btn-optimized').classList.contains('active') ? 6 : 4));
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
    updateUI();
}

function updateUI() {
    const h = Math.floor(simTime / 60);
    const m = Math.floor(simTime % 60);
    document.getElementById('timer').innerText = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`;
    
    document.getElementById('stat-total').innerText = stats.total;
    document.getElementById('stat-triage').innerText = stats.triage;
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
    if (mode === 'smoothing') docs = 12;
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
    const avg = stats.finished > 0 ? (stats.totalStay / stats.finished).toFixed(0) : 0;
    document.getElementById('dash-stay').innerText = `${avg} min`;
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
const DOC_COUNTS = { 'current': 4, 'optimized': 6, 'fast_track': 4, 'smoothing': 4 };

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
    const avg = count ? (totalStay / count).toFixed(0) : 0;
    document.getElementById('dash-stay').innerText = `${avg} min`;
}

// Lógica del Modal
const modal = document.getElementById('stats-modal');
document.getElementById('btn-stats').onclick = () => modal.classList.toggle('visible'); // Toggle instead of just add
document.getElementById('close-modal').onclick = () => modal.classList.remove('visible');
window.onclick = (e) => { if (e.target == modal) modal.classList.remove('visible'); };

// Mostrar por defecto
modal.classList.add('visible');