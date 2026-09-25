// Catálogo de ejercicios y planes de cada modo.
// apiId / apiName: ejercicio equivalente en ExerciseDB (https://oss.exercisedb.dev) para traer la imagen.
// kind: 'weight' (kg × reps) · 'reps' (reps, peso opcional) · 'time' (segundos) · 'cardio' (minutos)

export const EXERCISES = {
  prensa: {
    name: 'Prensa de piernas', apiId: '10Z2DXU', apiName: 'sled 45° leg press', kind: 'weight',
    tips: ['Espalda y cadera pegadas al respaldo', 'Pies al ancho de hombros, rodillas en línea con los pies', 'No bloquees las rodillas arriba'],
  },
  banca: {
    name: 'Press de banca', apiId: 'EIeI8Vf', apiName: 'barbell bench press', kind: 'weight',
    tips: ['Escápulas juntas y pies firmes en el piso', 'Baja la barra controlada a la mitad del pecho', 'Codos a unos 45° del cuerpo'],
  },
  jalon: {
    name: 'Jalón al pecho', apiId: 'RVwzP10', apiName: 'cable pulldown', kind: 'weight',
    tips: ['Pecho arriba, leve inclinación atrás', 'Lleva la barra a la parte alta del pecho', 'Sube lento sin soltar la tensión'],
  },
  hombro: {
    name: 'Press de hombro', apiId: 'znQUdHY', apiName: 'dumbbell seated shoulder press', kind: 'weight',
    tips: ['Espalda apoyada, abdomen firme', 'Empuja hacia arriba sin arquear la espalda', 'Baja hasta la altura de las orejas'],
  },
  plancha: {
    name: 'Plancha', apiId: 'VBAWRPG', apiName: 'weighted front plank', kind: 'time',
    tips: ['Codos debajo de los hombros', 'Cuerpo en línea recta, glúteos apretados', 'No dejes caer la cadera'],
  },
  bulgara: {
    name: 'Sentadilla búlgara', apiId: '9E25EOx', apiName: 'split squats', kind: 'weight',
    tips: ['Pie de atrás apoyado en un banco', 'Baja vertical hasta que la rodilla casi toque el piso', 'Peso en el talón de la pierna de adelante'],
  },
  zancadas: {
    name: 'Zancadas', apiId: 'RRWFUcw', apiName: 'dumbbell lunge', kind: 'weight',
    tips: ['Paso largo, torso recto', 'Ambas rodillas a 90° abajo', 'Empuja con el talón para volver'],
  },
  laterales: {
    name: 'Elevaciones laterales', apiId: 'DsgkuIt', apiName: 'dumbbell lateral raise', kind: 'weight',
    tips: ['Codos levemente flexionados', 'Sube hasta la altura de los hombros, no más', 'Baja lento, sin balancearte'],
  },
  abdominales: {
    name: 'Abdominales (crunch)', apiId: 'TFqbd8t', apiName: 'crunch floor', kind: 'reps',
    tips: ['Zona lumbar pegada al piso', 'Sube con el abdomen, no jales el cuello', 'Exhala al subir'],
  },
  russian: {
    name: 'Russian twist', apiId: 'XVDdcoj', apiName: 'russian twist', kind: 'reps',
    tips: ['Espalda recta, inclinada hacia atrás', 'Gira el torso, no solo los brazos', 'Cuenta cada lado como 1 rep'],
  },
  planchaLat: {
    name: 'Plancha lateral', apiId: 'RKjH6Lt', apiName: 'side bridge v. 2', kind: 'time',
    tips: ['Codo debajo del hombro', 'Cadera arriba, cuerpo en línea', 'Haz el tiempo en cada lado'],
  },
  remoPolea: {
    name: 'Remo en polea', apiId: 'fUBheHs', apiName: 'cable seated row', kind: 'weight',
    tips: ['Espalda recta, pecho arriba', 'Lleva el agarre al abdomen juntando escápulas', 'No te balancees hacia atrás'],
  },
  facePull: {
    name: 'Face pull', apiId: 'tc5dYrf', apiName: 'band standing rear delt row', kind: 'weight',
    tips: ['Polea a la altura de la cara, con cuerda', 'Jala hacia la frente abriendo los codos', 'Aprieta la parte de atrás de los hombros'],
  },
  elevPiernas: {
    name: 'Elevación de piernas', apiId: 'I3tsCnC', apiName: 'hanging leg raise', kind: 'reps',
    tips: ['Sin balanceo', 'Sube las piernas con el abdomen', 'Baja lento'],
  },
  sentadilla: {
    name: 'Sentadilla', apiId: 'qXTaZnJ', apiName: 'barbell full squat', kind: 'weight',
    tips: ['Pies al ancho de hombros', 'Baja como si te sentaras, pecho arriba', 'Rodillas en la dirección de los pies'],
  },
  remo: {
    name: 'Remo con mancuerna', apiId: 'BJ0Hz5L', apiName: 'dumbbell bent over row', kind: 'weight',
    tips: ['Torso inclinado, espalda recta', 'Lleva las mancuernas a la cadera', 'Aprieta la espalda arriba'],
  },
  hiit: {
    name: 'Cardio HIIT', apiId: 'dK9394r', apiName: 'burpee', kind: 'cardio',
    tips: ['Ej.: 30 s a tope + 30 s suave, repetir', 'Bici, elíptica, cinta o burpees', 'Calienta 3 min antes'],
  },
  steady: {
    name: 'Cardio continuo', apiId: 'rjiM4L3', apiName: 'walking on incline treadmill', kind: 'cardio',
    tips: ['Ritmo constante donde puedas hablar', 'Cinta inclinada, bici o elíptica', 'Mantén el mismo ritmo todo el tiempo'],
  },
};

// Cada ítem: ex, sets (mín), setsMax, repMin/repMax (en 'time' son segundos), min/max minutos para cardio.
// key: agrupa el historial para la progresión (no se mezclan 3×10 de fuerza con 3×15 de definición).
const F = { sets: 3, setsMax: 3, repMin: 8, repMax: 10, key: 'fuerza' };
const D = { sets: 3, setsMax: 4, repMin: 12, repMax: 15, key: 'def' };
const C = { sets: 3, setsMax: 3, repMin: 15, repMax: 15, key: 'circuito', group: 'circuito' };

export const MODES = {
  fuerza: {
    label: 'Fuerza',
    perWeek: 3,
    rest: 90,
    summary: '3 días por semana · 3 × 8–10',
    days: [
      {
        id: 'F', name: 'Sesión de fuerza', short: 'Fuerza',
        items: [
          { ex: 'prensa', ...F },
          { ex: 'banca', ...F },
          { ex: 'jalon', ...F },
          { ex: 'hombro', ...F },
          { ex: 'plancha', ...F, repMin: 30, repMax: 60 },
        ],
      },
    ],
  },
  definicion: {
    label: 'Definición',
    perWeek: 5,
    rest: 60,
    summary: '5 días por semana · 3–4 × 12–15 · descanso 45–60 s',
    days: [
      {
        id: 'D1', name: 'Día 1 · Piernas', short: 'Piernas',
        items: [
          { ex: 'bulgara', ...D },
          { ex: 'prensa', ...D },
          { ex: 'zancadas', ...D },
          { ex: 'hiit', min: 20, max: 20 },
        ],
      },
      {
        id: 'D2', name: 'Día 2 · Push', short: 'Push',
        items: [
          { ex: 'banca', ...D },
          { ex: 'hombro', ...D },
          { ex: 'laterales', ...D },
          { ex: 'plancha', ...D, key: 'core', repMin: 30, repMax: 45 },
        ],
      },
      {
        id: 'D3', name: 'Día 3 · Cardio + Core', short: 'Cardio',
        items: [
          { ex: 'steady', min: 25, max: 30 },
          { ex: 'abdominales', ...D, key: 'core', repMin: 15, repMax: 20 },
          { ex: 'russian', ...D, key: 'core', repMin: 20, repMax: 30 },
          { ex: 'planchaLat', ...D, key: 'core', repMin: 20, repMax: 40 },
        ],
      },
      {
        id: 'D4', name: 'Día 4 · Pull', short: 'Pull',
        items: [
          { ex: 'jalon', ...D },
          { ex: 'remoPolea', ...D },
          { ex: 'facePull', ...D },
          { ex: 'elevPiernas', ...D, key: 'core', repMin: 10, repMax: 15 },
        ],
      },
      {
        id: 'D5', name: 'Día 5 · Full body + HIIT', short: 'Full body',
        items: [
          { ex: 'sentadilla', ...C },
          { ex: 'banca', ...C },
          { ex: 'remo', ...C },
          { ex: 'hombro', ...C },
          { ex: 'hiit', min: 15, max: 20 },
        ],
      },
    ],
  },
};

export function findDay(mode, dayId) {
  const m = MODES[mode];
  return m && m.days.find((d) => d.id === dayId);
}
