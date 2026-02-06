import simpy
import random
import json
import os

def run_simulation(n_doctors, n_nurses, duration_hours=4):
    """
    Corre simulacion y retorna la traza de eventos.
    """
    arrival_rate_per_min = 13000 / (24 * 60) # Aprox 9 por minuto
    interarrival_mean = 1.0 / arrival_rate_per_min
    
    trace = []
    env = simpy.Environment()
    
    # Recursos
    triage = simpy.Resource(env, capacity=n_nurses)
    doctors = simpy.Resource(env, capacity=n_doctors)
    
    def log(pid, type_evt, loc):
        trace.append({
            "time": round(env.now, 2),
            "pid": pid,
            "type": type_evt,
            "loc": loc
        })

    def patient(env, pid):
        # Arrive
        log(pid, "ARRIVE", "reception")
        
        # Triage
        log(pid, "QUEUE", "triage")
        with triage.request() as req:
            yield req
            log(pid, "START", "triage")
            yield env.timeout(random.uniform(3, 8)) # 3-8 mins
            log(pid, "END", "triage")
            
        # Doctor
        log(pid, "QUEUE", "waiting")
        with doctors.request() as req:
            yield req
            log(pid, "START", "doctor")
            yield env.timeout(random.uniform(10, 30)) # 10-30 mins
            log(pid, "END", "doctor")
            
        # Exit
        log(pid, "LEAVE", "exit")

    def generator(env):
        pid = 0
        while True:
            yield env.timeout(random.expovariate(1.0 / interarrival_mean))
            pid += 1
            env.process(patient(env, pid))

    env.process(generator(env))
    env.run(until=duration_hours * 60)
    return trace

def main():
    print("Generando Escenario Actual (Saturado)...")
    # Pocos recursos: 2 enfermeras, 5 medicos -> Saturacion garantizada con 9 llegadas/min
    trace_current = run_simulation(n_doctors=5, n_nurses=2)
    
    print("Generando Escenario Optimizado (Solucion)...")
    # Muchos recursos: 10 enfermeras, 20 medicos -> Flujo rapido
    trace_optimized = run_simulation(n_doctors=25, n_nurses=12)
    
    # Guardar como JS para evitar CORS
    output_path = os.path.join("web", "data.js")
    js_content = f"""
const SIM_DATA = {{
    "current": {json.dumps(trace_current)},
    "optimized": {json.dumps(trace_optimized)}
}};
"""
    with open(output_path, "w", encoding="utf-8") as f:
        f.write(js_content)
    
    print(f"Datos generados en {output_path}")

if __name__ == "__main__":
    main()
