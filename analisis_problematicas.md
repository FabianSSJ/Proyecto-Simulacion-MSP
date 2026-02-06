# Análisis de Problemática y Soluciones - Simulación Hospitalaria

## 1. Problemática Identificada: Saturación de Médicos

El sistema actual ("Current") presenta un cuello de botella crítico en la disponibilidad de médicos para atender a la demanda de pacientes.

**Diagnóstico (Basado en `generate_data.js` y `game.js`):**

- **Demanda Continua:** Los pacientes llegan constantemente y requieren atención.
- **Cuello de Botella en Consulta:** Existe un retraso significativo (simulado) entre la llegada a la sala de espera y el inicio de la atención médica.
  - En el escenario estándar, los pacientes sufren largos tiempos de espera antes de ser atendidos por uno de los **4 médicos disponibles**.
  - Esto genera una acumulación masiva de pacientes en la sala de espera principal.

**Impacto Visual:**

- Aglomeración visible en la zona de espera central.
- Doctores ocupados el 100% del tiempo.
- Indicador de "Carga por Doctor" elevado.

---

## 2. Soluciones Propuestas e Implementadas

### Solución 1: Optimización de Recursos (Escenario "Optimized")

**Estrategia:** Aumento de Capacidad Médica y Eficiencia.

- **Implementación Técnica:**
  - **Más Médicos:** Se activan **2 médicos extra** (Total: 6 médicos visibles en `game.js`).
  - **Mayor Velocidad:** Se reduce el tiempo de atención en un **30%** (`speedFactor = 0.7` en `generate_data.js`).
- **Resultado:** La cola de espera se procesa mucho más rápido, reduciendo drásticamente la estancia promedio.

### Solución 2: Fast Track (Escenario "Fast Track")

**Estrategia:** Triaje Diferenciado / Vía Rápida.

- **Implementación Técnica:**
  - Se habilita una zona exclusiva "Fast Track" (color cyan).
  - El **30%** de los pacientes son desviados automáticamente a esta zona (`Math.random() < 0.3`).
  - Estos pacientes son atendidos rápidamente y salen del sistema sin ocupar a los médicos generales.
- **Resultado:** Descompresión de la sala de espera principal al reducir la demanda sobre los 4 médicos estándar.

### Solución 3: Hospital Gemelo / Suavizamiento (Escenario "Smoothing")

**Estrategia:** Balanceo de Carga (Load Balancing).

- **Implementación Técnica:**
  - Se habilita un "Hospital B" completo (espejo del Hospital A).
  - La demanda de pacientes se distribuye **50/50** entre el Hospital A y el Hospital B.
- **Resultado:** La carga de trabajo se divide exactamente a la mitad. Con la misma cantidad de médicos por hospital (4), pero con la mitad de pacientes llegando a cada uno, el sistema opera con holgura y sin saturación.

---

_Este análisis refleja la lógica actual implementada en JavaScript, donde la restricción principal es la capacidad de atención médica._
