# Análisis de Problemática y Soluciones - Simulación Hospitalaria

## 1. Problemática Identificada: Saturación de Médicos ("Current")

El sistema actual presenta un cuello de botella crítico. Con una demanda constante de ~50 pacientes/día y tiempos de atención variables, 4 médicos no son suficientes para mantener el flujo durante picos, generando esperas.

---

## 2. Validación de Soluciones Existentes

### ✅ Solución 1: Optimización de Recursos (Escenario "Optimized")

**Estrategia:** Aumento de Personal + Eficiencia Operativa.

- **Factibilidad:** Media-Alta. Requiere presupuesto para nómina fija.

### ✅ Solución 2: Fast Track / Vía Rápida (Escenario "Fast Track")

**Estrategia:** Triaje Diferenciado.

- **Factibilidad:** Muy Alta. Costo Cero, solo reorganización.

---

## 3. Estrategia Seleccionada (Costo Cero)

### ✅ Solución 3: Apoyo de Pasantes / Internos (Escenario "Interns")

**Estrategia:** Uso de Personal en Formación (Recurso Disponible).

- **Concepto:** Aprovechar la presencia de estudiantes de medicina (Pasantes) que ya están en el hospital por convenio universitario.
- **Implementación Técnica ("Interns On-Demand"):**
  - **Recurso Base:** 4 Médicos Titulares (Costantes).
  - **Recurso Flexible:** 2 Pasantes.
  - **Comportamiento:** Los pasantes permanecen en áreas de estudio/descanso. Cuando la sala de espera supera un umbral crítico (5 pacientes), son llamados a cubrir consultorios vacíos o habilitar consultorios de apoyo temporalmente.
- **Justificación Económica:** **Costo Adicional Cero.** Los pasantes requieren horas de práctica como parte de su formación. El hospital gana mano de obra para picos de saturación sin aumentar la nómina.
- **Viabilidad Operativa:** Alta. Es un modelo común en hospitales universitarios o públicos.

---

_Esta estrategia maximiza la capacidad de atención sin impactar el presupuesto operativo._
