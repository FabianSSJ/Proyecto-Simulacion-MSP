# Simulación Visual de Hospital MSP

Este proyecto implementa una **Simulación Visual en HTML5** para analizar y comparar escenarios de flujo de pacientes en el servicio de emergencias.

## Estructura del Proyecto

- `web/`: Contiene la aplicación web (HTML, CSS, JS) y los datos de la simulación.
  - `index.html`: **Punto de entrada**. Abrir en navegador para ver la simulación.
  - `data.js`: Datos de eventos simulados (generados por Python).
- `src/`: Scripts de soporte.
  - `generate_scenarios.py`: Generador de escenarios de simulación (Python + SimPy).

## Instrucciones de Uso

### 1. Ver la Simulación

Simplemente navega a la carpeta `web` y abre el archivo `index.html` en tu navegador web de preferencia (Chrome, Edge, Firefox).

### 2. Regenerar Datos (Opcional)

Si deseas modificar los parámetros de la simulación (ej. número de médicos, duración), edita el archivo `src/generate_scenarios.py` y ejecútalo:

```bash
python src/generate_scenarios.py
```

Esto actualizará automáticamente el archivo `web/data.js` con los nuevos resultados.

## Requisitos (Solo para generar datos)

- Python 3.x
- SimPy (`pip install simpy`)
