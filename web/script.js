// Zones configuration for layout mapping
const ZONES = {
    reception: { id: 'zone-reception' },
    triage: { id: 'zone-triage', capacityId: 'cap-triage' },
    waiting: { id: 'zone-waiting' },
    doctor: { id: 'zone-doctor', capacityId: 'cap-doctor' },
    exit: { id: null } // Off screen
};

// Simulation State
let activeScenario = 'current'; // 'current' or 'optimized'
let trace = [];
let simTime = 0;
let eventIndex = 0;
let speed = 10;
let patients = {}; // {pid: {el: DOMElement, x, y, targetZone}}
let isRunning = false;
let lastFrame = 0;

// Stats
let stats = {
    qTriage: 0,
    qDoctor: 0,
    finished: 0,
    total: 0
};

// Elements
const layoutEl = document.querySelector('.hospital-layout');
const timeEl = document.getElementById('time-display');

// Initialize
window.onload = () => {
    // Buttons
    document.getElementById('btn-current').onclick = () => loadScenario('current');
    document.getElementById('btn-optimized').onclick = () => loadScenario('optimized');
    document.getElementById('speed-slider').oninput = (e) => speed = parseInt(e.target.value);
    
    // Start default
    loadScenario('current');
    
    requestAnimationFrame(loop);
};

function loadScenario(type) {
    // Reset state
    activeScenario = type;
    trace = SIM_DATA[type];
    simTime = 0;
    eventIndex = 0;
    patients = {};
    stats = { qTriage: 0, qDoctor: 0, finished: 0, total: 0 };
    
    // Clear visual elements
    document.querySelectorAll('.pawn.patient').forEach(el => el.remove());
    
    // UI Feedback
    document.querySelectorAll('.btn').forEach(b => b.classList.remove('active'));
    document.getElementById(`btn-${type}`).classList.add('active');
    
    // Configure Capacities & Render Static Staff
    const triageZone = document.getElementById('zone-triage');
    const doctorZone = document.getElementById('zone-doctor');
    
    // Clear old staff
    triageZone.querySelectorAll('.staff-area').forEach(e => e.remove());
    doctorZone.querySelectorAll('.staff-area').forEach(e => e.remove());

    if (type === 'current') {
        document.getElementById('cap-triage').innerText = '(2 Enf)';
        document.getElementById('cap-doctor').innerText = '(5 Docs)';
        renderStaff(triageZone, 2, 'nurse');
        renderStaff(doctorZone, 5, 'doctor');
    } else {
        document.getElementById('cap-triage').innerText = '(12 Enf)';
        document.getElementById('cap-doctor').innerText = '(25 Docs)';
        renderStaff(triageZone, 12, 'nurse');
        renderStaff(doctorZone, 25, 'doctor');
    }
    
    isRunning = true;
}

function renderStaff(zoneEl, count, type) {
    const area = document.createElement('div');
    area.className = 'staff-area';
    for(let i=0; i<count; i++) {
        const pawn = document.createElement('div');
        pawn.className = `pawn ${type}`;
        pawn.innerHTML = '<div class="head"></div><div class="body"></div>';
        area.appendChild(pawn);
    }
    zoneEl.appendChild(area);
}

function getRandomPosInZone(zoneId) {
    const zone = document.getElementById(zoneId);
    if (!zone) return { x: -50, y: 50 }; // Exit
    
    // Get zone coordinates relative to container
    const rect = zone.getBoundingClientRect();
    const containerRect = layoutEl.getBoundingClientRect();
    
    // Respect active area padding to avoid walls
    const x = (rect.left - containerRect.left) + 15 + Math.random() * (rect.width - 40);
    // Keep them somewhat in the 'open' space of the room, avoiding static staff if possible at bottom
    // We'll just distribute randomly for now
    const y = (rect.top - containerRect.top) + 25 + Math.random() * (rect.height - 50);
    return { x, y };
}

function createPatient(pid) {
    const el = document.createElement('div');
    el.className = 'pawn patient';
    el.innerHTML = '<div class="head"></div><div class="body"></div>';
    el.style.transform = `translate(0px, 0px)`; // Initial
    layoutEl.appendChild(el);
    
    // Initial Spawn Position
    return {
        el,
        x: 50, 
        y: 150,
        targetX: 50,
        targetY: 150,
        state: 'arrive'
    };
}

function processEvents(dt) {
    simTime += dt * speed;
    
    // Process backlog
    while (eventIndex < trace.length && trace[eventIndex].time <= simTime) {
        const ev = trace[eventIndex];
        const pid = ev.pid;
        
        if (!patients[pid]) {
            patients[pid] = createPatient(pid);
            stats.total++;
        }
        
        const p = patients[pid];
        
        let targetZoneId = null;
        
        switch(ev.type) {
            case 'ARRIVE': 
                targetZoneId = ZONES.reception.id; 
                break;
            case 'QUEUE': 
                if (ev.loc === 'triage') { targetZoneId = ZONES.triage.id; stats.qTriage++; p.el.setAttribute('data-state', 'triage_q'); }
                if (ev.loc === 'waiting') { targetZoneId = ZONES.waiting.id; stats.qDoctor++; p.el.setAttribute('data-state', 'waiting'); }
                break;
            case 'START':
                // Moving from queue to service
                if (ev.loc === 'triage') { targetZoneId = ZONES.triage.id; stats.qTriage--; p.el.setAttribute('data-state', 'triage'); }
                if (ev.loc === 'doctor') { targetZoneId = ZONES.doctor.id; stats.qDoctor--; p.el.setAttribute('data-state', 'doctor'); }
                break;
            case 'LEAVE':
                stats.finished++;
                stats.total--;
                p.finished = true;
                p.el.remove();
                delete patients[pid];
                break;
        }
        
        if (targetZoneId && patients[pid]) {
            const pos = getRandomPosInZone(targetZoneId);
            p.targetX = pos.x;
            p.targetY = pos.y;
        }
        
        eventIndex++;
    }
}

function updateVisuals(dt) {
    for (const pid in patients) {
        const p = patients[pid];
        const dx = p.targetX - p.x;
        const dy = p.targetY - p.y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        if (dist > 1) {
            p.x += dx * 0.1; // Smooth lerp
            p.y += dy * 0.1;
            p.el.style.transform = `translate(${p.x}px, ${p.y}px)`;
            // Z-index sort by Y position for depth effect
            p.el.style.zIndex = Math.floor(p.y); 
        }
    }
    
    // Update Stats UI
    const totalMins = Math.floor(simTime);
    const h = Math.floor(totalMins / 60);
    const m = totalMins % 60;
    timeEl.innerText = `${h.toString().padStart(2,'0')}:${m.toString().padStart(2,'0')}`;
    
    document.getElementById('total-patients').innerText = stats.total;
    
    document.getElementById('queue-triage').innerText = stats.qTriage;
    updateBar('bar-triage', 'card-triage', stats.qTriage, 50); 
    
    document.getElementById('queue-doctor').innerText = stats.qDoctor;
    updateBar('bar-doctor', 'card-doctor', stats.qDoctor, 100); 
    
    document.getElementById('finished-count').innerText = stats.finished;
}

function updateBar(barId, cardId, val, max) {
    const pct = Math.min(100, (val / max) * 100);
    document.getElementById(barId).style.width = `${pct}%`;
    
    if (pct > 75) document.getElementById(cardId).classList.add('danger');
    else document.getElementById(cardId).classList.remove('danger');
}

function loop(timestamp) {
    const dt = (timestamp - lastFrame) / 1000;
    lastFrame = timestamp;
    
    if (isRunning && dt < 0.2) {
        processEvents(dt);
        updateVisuals(dt);
    }
    
    requestAnimationFrame(loop);
}
