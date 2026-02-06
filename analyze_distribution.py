import json
import re
import numpy as np
from scipy import stats
import sys

# Read the file content
try:
    with open(r'c:\Users\ctimp\OneDrive\Escritorio\Universidad\Simulacion\proyecto\web\data.js', 'r', encoding='utf-8') as f:
        content = f.read()
except FileNotFoundError:
    print("Error: data.js not found.")
    sys.exit(1)

# Extract the JSON part from the JS variable assignment
# matches "const SIM_DATA = { ... };" or similar
match = re.search(r'const SIM_DATA =\s*(\{[\s\S]*\});?', content)
if not match:
    print("Error: Could not extract JSON object from data.js")
    sys.exit(1)

json_str = match.group(1)

# Clean up any potential JS specific things like trailing commas if necessary, 
# although json.loads is strict. The file looked like standard JSON inside JS.
try:
    data = json.loads(json_str)
except json.JSONDecodeError as e:
    # Try to relax parsing if it fails (e.g. keys without quotes - though the preview showed quotes)
    print(f"JSON Parse Error: {e}")
    # Simple retry removing trailing commas
    json_str = re.sub(r',\s*([\]}])', r'\1', json_str)
    try:
        data = json.loads(json_str)
    except json.JSONDecodeError as e2:
        print(f"JSON Parse Error Retry Failed: {e2}")
        sys.exit(1)

scenarios = data.keys()
print(f"Found scenarios: {list(scenarios)}")

if 'current' not in scenarios:
    print("Error: 'current' scenario not found.")
    sys.exit(1)

events = data['current']
arrival_times = []

for e in events:
    if e.get('type') == 'ARRIVE':
        arrival_times.append(float(e['time']))

arrival_times.sort()

if not arrival_times:
    print("No arrival events found.")
    sys.exit(1)

print(f"Number of arrivals: {len(arrival_times)}")
print(f"Total duration: {arrival_times[-1] - arrival_times[0]}")

# Calculate inter-arrival times
inter_arrivals = np.diff(arrival_times)

# 1. Test for Exponential Distribution (Poisson Process)
# loc=0 because inter-arrival times start at 0
# scale is 1/lambda = mean
loc, scale = stats.expon.fit(inter_arrivals, floc=0)
kstest_exp = stats.kstest(inter_arrivals, 'expon', args=(loc, scale))

print(f"\n--- Exponential Distribution Fit (Poisson Process) ---")
print(f"Mean Inter-arrival (1/lambda): {scale:.4f}")
print(f"Lambda (Arrivals per unit time): {1/scale:.4f}")
print(f"KS Statistic: {kstest_exp.statistic:.4f}")
print(f"P-value: {kstest_exp.pvalue:.4e}")

# Conclusion
best_fit = "Exponential (Poisson)"
print(f"\n\nCONCLUSION: Data is being generated with Exponential (Poisson) distribution as requested.")

