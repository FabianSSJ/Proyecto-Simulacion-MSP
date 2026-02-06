# Informe de Simulación Hospitalaria: Análisis de Capacidad y Flujo de Pacientes

**Fecha:** 6 de Febrero, 2026  
**Proyecto:** Simulación de Gestión de Colas Hospitalarias

---

## 1. Resumen Ejecutivo

Este informe detalla el análisis realizado sobre el flujo de pacientes en el servicio de urgencias del hospital. A través de un modelo de simulación discreta, se ha identificado un déficit estructural en la capacidad de atención y se han validado tres estrategias de solución, además de implementar un módulo experimental para pruebas de estrés.

## 2. Diagnóstico: Situación Actual ("Escenario Base")

El sistema opera actualmente bajo un modelo estándar con las siguientes características:

- **Recursos:** 4 Médicos Generales.
- **Demanda:** ~50 Pacientes por día (llegada exponencial).
- **Problemática Identificada:** Se detectó un **cuello de botella crítico en la fase de consulta**. La tasa de llegada supera frecuentemente la tasa de servicio combinada de los 4 médicos, generando:
  - Colas exponenciales a partir de la hora 12 del día.
  - Tiempo de estancia promedio inaceptable (> 6 horas).
  - Saturación del personal al 100%.

**Conclusión del Diagnóstico:** El sistema es inestable bajo picos de demanda.

---

## 3. Soluciones Propuestas y Validada

### Solución 1: Optimización de Recursos (Inversión)

_Escenario: "Optimized"_

- **Estrategia:** Contratación de personal adicional e inversión en tecnología/equipos.
- **Implementación:** Se añaden **2 médicos adicionales** (Total: 6) y se reduce el tiempo promedio de consulta un 30% (simulando mejores equipos).
- **Resultado:** Eliminación total de colas.
- **Costo:** **Alto** (Nómina + Tecnología).

### Solución 2: Fast Track / Triaje Diferenciado (Procesos)

_Escenario: "Fast Track"_

- **Estrategia:** Reingeniería de procesos. Separación de flujos según gravedad.
- **Implementación:** El 30% de los pacientes (casos leves) son derivados a una vía rápida ("Cyan") operada por personal específico o enfermería avanzada.
- **Resultado:** Descompresión significativa de la sala de espera principal.
- **Costo:** **Bajo** (Reorganización interna).

### Solución 3: Apoyo de Pasantes / Modelo On-Demand (Eficiencia)

_Escenario: "Intern Support"_

- **Estrategia:** Aprovechamiento de capital humano en formación (Convenios Universitarios).
- **Implementación:** Se integran **2 Pasantes (Internos)** al equipo.
  - Operan bajo un esquema de "Demanda Activa": permanecen en áreas de estudio y solo se activan cuando la cola supera los 5 pacientes.
- **Resultado:** Absorción efectiva de los picos de demanda sin mantener personal ocioso en horas valle.
- **Costo:** **Cero / Mínimo** (Horas de práctica curricular).
- **Estado:**  **Estrategia Recomendada por Costo-Beneficio.**

---

## 4. Módulo Experimental (Nuevo)

Para validar escenarios futuros y pruebas de estrés ("What-If analysis"), se ha desarrollado un **Laboratorio de Simulación Dinámica** dentro de la herramienta.

**Capacidades:**

- **Inyección de Carga:** Simulación de hasta 150 pacientes/día.
- **Escalado de Personal:** Visualización y activación de hasta **10 consultorios simultáneos**.
- **Duración Extendida:** El sistema adapta automáticamente el horizonte de simulación (hasta 30-48 horas) para estudiar el comportamiento de recuperación del sistema tras colapsos masivos.

Este módulo permite a la administración hospitalaria probar políticas de contratación antes de ejecutarlas en la realidad.

---

**Fin del Informe**
