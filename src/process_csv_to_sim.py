import pandas as pd
import numpy as np
import json
import os
import random
from datetime import timedelta

def process_data(input_file, output_file):
    print(f"Reading {input_file}...")
    try:
        df = pd.read_csv(input_file)
    except FileNotFoundError:
        print(f"Error: File {input_file} not found.")
        return

    # Ensure date column acts as base (if exists, otherwise mock)
    if 'FECHA_DE_ATENCION' in df.columns:
        df['base_time'] = pd.to_datetime(df['FECHA_DE_ATENCION'], errors='coerce')
    else:
        # Fallback if no date column
        start_date = pd.Timestamp('2024-01-01 08:00:00')
        df['base_time'] = [start_date + timedelta(minutes=i*2) for i in range(len(df))]

    # Filter invalid dates
    df = df.dropna(subset=['base_time'])
    
    # Sort by time
    df = df.sort_values('base_time')
    
    # Take a sample if too large for browser sim (e.g., max 500 patients for visual clarity)
    if len(df) > 500:
        df = df.head(500)

    # Convert timestamp to relative simulation minutes (start at 0)
    min_time = df['base_time'].min()
    df['sim_start_min'] = (df['base_time'] - min_time).dt.total_seconds() / 60.0

    events_current = []
    events_optimized = []
    events_fast_track = []
    events_smoothing = []

    print("Generating events for 4 scenarios...")
    
    # Mild Codes for Fast Track (Rinofaringitis, Certificados, Dolor leve)
    MILD_CODES = ['J00X', 'Z027', 'R51X', 'J029', 'K30X', 'A09X']

    # Smoothing PRE-CALCULATION:
    # Redistribute all patients evenly across the time span (e.g., 8 hours = 480 mins)
    total_duration_mins = df['sim_start_min'].max() if len(df) > 1 else 480
    if total_duration_mins == 0: total_duration_mins = 480
    
    smoothed_interval = total_duration_mins / len(df)
    
    for i, (idx, row) in enumerate(df.iterrows()):
        pid = int(idx) + 1
        original_arrival = row['sim_start_min']
        
        # --- SCENARIO 1: CURRENT (Saturated) ---
        triage_wait = random.uniform(10, 40)
        triage_dur = random.uniform(3, 8)
        doc_wait = random.uniform(20, 120)
        doc_dur = random.uniform(10, 20)
        
        # Generator Function
        def generate_trace(scen_list, start_t, tw, td, dw, dd, loc_doc="doctor", loc_triage="triage"):
            t = start_t
            scen_list.append({"time": round(t, 2), "pid": pid, "type": "ARRIVE", "loc": "reception"})
            t += 0.5
            scen_list.append({"time": round(t, 2), "pid": pid, "type": "QUEUE", "loc": loc_triage})
            t += tw
            scen_list.append({"time": round(t, 2), "pid": pid, "type": "START", "loc": loc_triage})
            t += td
            scen_list.append({"time": round(t, 2), "pid": pid, "type": "END", "loc": loc_triage})
            t += 0.5
            scen_list.append({"time": round(t, 2), "pid": pid, "type": "QUEUE", "loc": "waiting"})
            t += dw
            scen_list.append({"time": round(t, 2), "pid": pid, "type": "START", "loc": loc_doc})
            t += dd
            scen_list.append({"time": round(t, 2), "pid": pid, "type": "END", "loc": loc_doc})
            t += 0.5
            scen_list.append({"time": round(t, 2), "pid": pid, "type": "LEAVE", "loc": "exit"})

        generate_trace(events_current, original_arrival, triage_wait, triage_dur, doc_wait, doc_dur)

        # --- SCENARIO 2: OPTIMIZED (More doctors, less wait) ---
        generate_trace(events_optimized, original_arrival, triage_wait*0.2, triage_dur, doc_wait*0.2, doc_dur)

        # --- SCENARIO 3: FAST TRACK ---
        # If CIE is mild, use FAST TRACK path (very fast wait, specific location)
        cie = str(row['CIE']) if 'CIE' in row else ''
        is_mild = cie in MILD_CODES or random.random() < 0.3 # Fallback random if CIE missing
        
        if is_mild:
            # Fast Track: Minimal queues. "fast_track" location for doctor phase
            ft_wait = random.uniform(1, 5)
            ft_dur = random.uniform(5, 10)
            generate_trace(events_fast_track, original_arrival, 2, 3, ft_wait, ft_dur, "fast_track", "triage")
        else:
            # Normal flow for critical
            generate_trace(events_fast_track, original_arrival, triage_wait, triage_dur, doc_wait, doc_dur)

        # --- SCENARIO 4: DEMAND SMOOTHING ---
        # Use smoothed arrival time, but KEEP original 'current' resource constraints (waits)
        # to show impact of just changing arrival pattern.
        # Ideally, better arrival = less queuing, so waits should logically drop. 
        # We simulate this by capping the max wait time significantly lower.
        smoothed_arrival = i * smoothed_interval
        smooth_wait_t = min(triage_wait, 10) # Queues don't build up
        smooth_wait_d = min(doc_wait, 15)
        generate_trace(events_smoothing, smoothed_arrival, smooth_wait_t, triage_dur, smooth_wait_d, doc_dur)

    # Sort events
    for ev_list in [events_current, events_optimized, events_fast_track, events_smoothing]:
        ev_list.sort(key=lambda x: x['time'])

    # Export to JS
    js_content = f"""
const SIM_DATA = {{
    "current": {json.dumps(events_current)},
    "optimized": {json.dumps(events_optimized)},
    "fast_track": {json.dumps(events_fast_track)},
    "smoothing": {json.dumps(events_smoothing)}
}};
window.SIM_DATA = SIM_DATA;
"""
    
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write(js_content)
    
    print(f"Success! Generated {len(events_current)} events for 'current' and {len(events_optimized)} for 'optimized'.")
    print(f"Saved to {output_file}")


if __name__ == "__main__":
    # Adjust paths as per user project structure
    # Assuming script runs from root
    INPUT = os.path.join("data", "processed", "dataset_limpio.csv")
    OUTPUT = os.path.join("web", "data.js")
    
    # Check if we are in src or root
    if not os.path.exists("data"):
        # Try moving up
        if os.path.exists("../data"):
             INPUT = os.path.join("..", "data", "processed", "dataset_limpio.csv")
             OUTPUT = os.path.join("..", "web", "data.js")
    
    process_data(INPUT, OUTPUT)
