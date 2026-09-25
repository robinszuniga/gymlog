# GymLog

App web (PWA) para registrar el gym con dos modos: **Fuerza** (3 días/semana, 3×8–10) y **Definición** (5 días, split).

- Registro por serie (kg × reps), fecha editable, botón "Terminar · Hoy entrené".
- Progresión automática: si completas 3×10 (o el tope del rango) dos sesiones seguidas con el mismo peso, sugiere subir 5–10 %; si no, mantener.
- Historial por ejercicio con gráfico de progreso y lista de sesiones.
- Temporizador de descanso (90 s fuerza / 60 s definición, configurable).
- Imágenes de ExerciseDB (`oss.exercisedb.dev`); se guardan en el teléfono para usarlas sin internet.
- Todo se guarda en el teléfono (localStorage). Exportar/Importar copia de seguridad en Ajustes.

## Probar en el PC

```bash
python -m http.server 5520
```

Abrir http://localhost:5520

## Instalar en el celular

Para instalarla y usarla sin internet, la app debe estar publicada con HTTPS (por ejemplo GitHub Pages o Netlify).
Luego en Chrome del celular: menú ⋮ → "Instalar app" / "Agregar a pantalla principal".

## Pruebas

```bash
node tests/progression.test.mjs
```

## Archivos

- `js/data.js` — ejercicios y rutinas de cada modo
- `js/progression.js` — reglas de progresión
- `js/app.js` — pantallas
- `sw.js` — funcionamiento sin conexión
