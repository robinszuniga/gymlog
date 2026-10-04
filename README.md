# GymLog

App web (PWA) para registrar el gym. Arma una rutina según tu **objetivo**, tus días disponibles y tu equipo, y sugiere cómo progresar a partir de lo que registras. Sin cuentas ni servidor: todo queda en el teléfono.

## Qué hace

- **Plan según el objetivo**: fuerza, ganar músculo, perder grasa o condición física general. Pregunta días por semana (2–6), experiencia, equipo, movimientos que prefieres evitar y actividad de cardio.
- **Rutinas que cubren todo el cuerpo**: piernas, cadera/isquiotibiales, empuje, tracción y core. Si con tu equipo falta alguna zona, lo avisa.
- **Cambiar el plan o un ejercicio** cuando quieras (desde "Tu plan" o durante la sesión). El historial se conserva.
- **Pesos iniciales elegidos por ti**. La app no trae cargas predefinidas.
- **Progresión con tus registros**: propone subir, mantener o bajar un poco, y tú decides con un toque. Nunca pide llegar al fallo.
- **Resumen semanal**: días entrenados, series por grupo muscular, cambios de carga/repeticiones y minutos de cardio, con pocas recomendaciones basadas en esos datos.
- **Corregir una sesión terminada** desde Historial → Sesiones (✎).
- Registro por serie, temporizador de descanso, cronómetro para planchas, gráfico por ejercicio.
- Las rutinas fijas originales (**Fuerza clásica** y **Definición clásica**) siguen disponibles y funcionan igual que antes.

## Cómo se arma el plan (`js/plan.js`)

| Objetivo | Reparto | Trabajo de fuerza | Cardio |
|---|---|---|---|
| Fuerza | Cuerpo completo (2–3 días), torso/pierna (4–5), empuje/tracción/pierna ×2 (6). Cada zona principal al menos 2 veces por semana | Movimientos principales 3–4 × 4–6 (principiantes 5–8), aumentos de 2,5–5 % | Opcional |
| Ganar músculo | Igual que fuerza hasta 4 días; 5–6 días por grupos | 3–4 × 8–12 y aislados 10–15. Muestra las series semanales por músculo con ~10 como referencia orientativa | Opcional |
| Perder grasa | Fuerza de cuerpo completo + días de cardio según disponibilidad | El mismo trabajo de fuerza moderado (8–12). No se suben repeticiones "para quemar" | La actividad que elijas; el HIIT nunca es obligatorio |
| Condición general | Alterna días de fuerza y de cardio | 2–3 × 8–12 | Progresivo: +10 % cuando repites la duración dos veces |

Cada ejercicio del catálogo (`js/data.js`) está etiquetado con músculos principales, patrón de movimiento, equipo, nivel y características que alguien puede querer evitar. El generador elige por patrón y equipo, y varía los ejercicios entre días.

## Progresión (`js/progression.js`)

- **Planes por objetivo**: al completar todas las series en el tope del rango, propone subir (≈5 %, o 2,5–5 % en los movimientos principales de fuerza). Si dos sesiones seguidas quedan por debajo del rango, propone bajar ~10 %. En los demás casos, mantener y buscar una repetición más. La persona acepta o ajusta.
- **Rutinas clásicas**: regla original (tope del rango dos sesiones seguidas → subir 5–10 %).
- **Cardio progresivo**: sube los minutos de a poco hasta el tope del rango.

## Tus datos

- Plan, pesos iniciales y sesiones se guardan en `localStorage` del navegador de este teléfono. No hay backend ni cuentas.
- Se pierden si borras los datos del navegador, desinstalas la app o cambias de teléfono.
- **Ajustes → Exportar** descarga una copia (JSON). **Importar** la valida completa antes de reemplazar los datos actuales. La app recuerda cuándo fue la última copia.
- Internet solo se usa para las imágenes de ExerciseDB (`oss.exercisedb.dev`), que quedan guardadas para usar sin conexión.

## Guías y límites

Las cifras son guías generales para adultos sanos, no una prescripción médica:

- OMS: 150–300 min semanales de actividad aeróbica moderada (o equivalente vigoroso) y fortalecimiento muscular 2 o más días. <https://www.who.int/initiatives/behealthy/physical-activity/>
- ACSM 2026, fuerza e hipertrofia: <https://pubmed.ncbi.nlm.nih.gov/41843416/>

La app no evalúa lesiones ni dolores: permite marcar movimientos a evitar y sustituir ejercicios, sin preguntar el motivo. No promete que un ejercicio reduzca grasa en una zona.

## Probar en el PC

```bash
python -m http.server 5520
```

Abrir http://localhost:5520

## Instalar en el celular

Debe estar publicada con HTTPS (por ejemplo GitHub Pages). En Chrome: menú ⋮ → "Instalar app". En iPhone: Safari → compartir → "Agregar a pantalla de inicio".

## Pruebas

```bash
node tests/progression.test.mjs
```

```bash
node tests/adaptive.test.mjs
```

```bash
node tests/plan.test.mjs
```

```bash
node tests/summary.test.mjs
```

```bash
node tests/store.test.mjs
```

## Archivos

- `js/data.js` — catálogo de ejercicios (con etiquetas) y rutinas clásicas
- `js/plan.js` — generador de planes, cobertura, sustituciones
- `js/progression.js` — reglas de progresión de carga y cardio
- `js/summary.js` — resumen semanal y recomendaciones
- `js/store.js` — guardado local, migración y validación de copias
- `js/app.js` — pantallas de inicio, sesión, historial y ajustes
- `js/planUi.js` — asistente del plan, vista del plan y resumen semanal
- `sw.js` — funcionamiento sin conexión
