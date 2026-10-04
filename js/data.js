// Catálogo de ejercicios y planes de cada modo.
// apiId / apiName: ejercicio equivalente en ExerciseDB (https://oss.exercisedb.dev) para traer la imagen.
// kind: 'weight' (kg × reps) · 'reps' (reps, peso opcional) · 'time' (segundos) · 'cardio' (minutos)
// muscles: músculos principales · pattern: patrón de movimiento · equip: equipo requerido
// lvl: 1 apto para principiantes, 2 pide algo de experiencia · main: permite subir carga gradualmente
// flags: características que la persona puede querer evitar (overhead, axial, impact, hang, floor)

export const EXERCISES = {
  prensa: {
    name: 'Prensa de piernas', apiId: '10Z2DXU', apiName: 'sled 45° leg press', kind: 'weight',
    muscles: ['cuadriceps', 'gluteos'], pattern: 'sentadilla', equip: 'maquina', lvl: 1, main: true,
    tips: ['Espalda y cadera pegadas al respaldo', 'Pies al ancho de hombros, rodillas en línea con los pies', 'No bloquees las rodillas arriba'],
  },
  banca: {
    name: 'Press de banca', apiId: 'EIeI8Vf', apiName: 'barbell bench press', kind: 'weight',
    muscles: ['pecho', 'triceps'], pattern: 'empuje_h', equip: 'barra', lvl: 1, main: true,
    tips: ['Escápulas juntas y pies firmes en el piso', 'Baja la barra controlada a la mitad del pecho', 'Codos a unos 45° del cuerpo'],
  },
  jalon: {
    name: 'Jalón al pecho', apiId: 'RVwzP10', apiName: 'cable pulldown', kind: 'weight',
    muscles: ['espalda', 'biceps'], pattern: 'traccion_v', equip: 'polea', lvl: 1, main: true,
    tips: ['Pecho arriba, leve inclinación atrás', 'Lleva la barra a la parte alta del pecho', 'Sube lento sin soltar la tensión'],
  },
  hombro: {
    name: 'Press de hombro', apiId: 'znQUdHY', apiName: 'dumbbell seated shoulder press', kind: 'weight',
    muscles: ['hombros', 'triceps'], pattern: 'empuje_v', equip: 'mancuernas', lvl: 1, main: true, flags: ['overhead'],
    tips: ['Espalda apoyada, abdomen firme', 'Empuja hacia arriba sin arquear la espalda', 'Baja hasta la altura de las orejas'],
  },
  plancha: {
    name: 'Plancha', apiId: 'VBAWRPG', apiName: 'weighted front plank', kind: 'time',
    muscles: ['core'], pattern: 'core', equip: 'corporal', lvl: 1, flags: ['floor'],
    tips: ['Codos debajo de los hombros', 'Cuerpo en línea recta, glúteos apretados', 'No dejes caer la cadera'],
  },
  bulgara: {
    name: 'Sentadilla búlgara', apiId: '9E25EOx', apiName: 'split squats', kind: 'weight',
    muscles: ['cuadriceps', 'gluteos'], pattern: 'unilateral', equip: 'mancuernas', lvl: 2,
    tips: ['Pie de atrás apoyado en un banco', 'Baja vertical hasta que la rodilla casi toque el piso', 'Peso en el talón de la pierna de adelante'],
  },
  zancadas: {
    name: 'Zancadas', apiId: 'RRWFUcw', apiName: 'dumbbell lunge', kind: 'weight',
    muscles: ['cuadriceps', 'gluteos'], pattern: 'unilateral', equip: 'mancuernas', lvl: 1,
    tips: ['Paso largo, torso recto', 'Ambas rodillas a 90° abajo', 'Empuja con el talón para volver'],
  },
  laterales: {
    name: 'Elevaciones laterales', apiId: 'DsgkuIt', apiName: 'dumbbell lateral raise', kind: 'weight',
    muscles: ['hombros'], pattern: 'aislado', equip: 'mancuernas', lvl: 1,
    tips: ['Codos levemente flexionados', 'Sube hasta la altura de los hombros, no más', 'Baja lento, sin balancearte'],
  },
  abdominales: {
    name: 'Abdominales (crunch)', apiId: 'TFqbd8t', apiName: 'crunch floor', kind: 'reps',
    muscles: ['core'], pattern: 'core', equip: 'corporal', lvl: 1, flags: ['floor'],
    tips: ['Zona lumbar pegada al piso', 'Sube con el abdomen, no jales el cuello', 'Exhala al subir'],
  },
  russian: {
    name: 'Russian twist', apiId: 'XVDdcoj', apiName: 'russian twist', kind: 'reps',
    muscles: ['core'], pattern: 'core', equip: 'corporal', lvl: 1, flags: ['floor'],
    tips: ['Espalda recta, inclinada hacia atrás', 'Gira el torso, no solo los brazos', 'Cuenta cada lado como 1 rep'],
  },
  planchaLat: {
    name: 'Plancha lateral', apiId: 'RKjH6Lt', apiName: 'side bridge v. 2', kind: 'time',
    muscles: ['core'], pattern: 'core', equip: 'corporal', lvl: 1, flags: ['floor'],
    tips: ['Codo debajo del hombro', 'Cadera arriba, cuerpo en línea', 'Haz el tiempo en cada lado'],
  },
  remoPolea: {
    name: 'Remo en polea', apiId: 'fUBheHs', apiName: 'cable seated row', kind: 'weight',
    muscles: ['espalda', 'biceps'], pattern: 'traccion_h', equip: 'polea', lvl: 1, main: true,
    tips: ['Espalda recta, pecho arriba', 'Lleva el agarre al abdomen juntando escápulas', 'No te balancees hacia atrás'],
  },
  facePull: {
    name: 'Face pull', apiId: 'tc5dYrf', apiName: 'band standing rear delt row', kind: 'weight',
    muscles: ['espalda', 'hombros'], pattern: 'aislado', equip: 'polea', lvl: 1,
    tips: ['Polea a la altura de la cara, con cuerda', 'Jala hacia la frente abriendo los codos', 'Aprieta la parte de atrás de los hombros'],
  },
  elevPiernas: {
    name: 'Elevación de piernas', apiId: 'I3tsCnC', apiName: 'hanging leg raise', kind: 'reps',
    muscles: ['core'], pattern: 'core', equip: 'barra_fija', lvl: 2, flags: ['hang'],
    tips: ['Sin balanceo', 'Sube las piernas con el abdomen', 'Baja lento'],
  },
  sentadilla: {
    name: 'Sentadilla', apiId: 'qXTaZnJ', apiName: 'barbell full squat', kind: 'weight',
    muscles: ['cuadriceps', 'gluteos'], pattern: 'sentadilla', equip: 'barra', lvl: 2, main: true, flags: ['axial'],
    tips: ['Pies al ancho de hombros', 'Baja como si te sentaras, pecho arriba', 'Rodillas en la dirección de los pies'],
  },
  remo: {
    name: 'Remo con mancuerna', apiId: 'BJ0Hz5L', apiName: 'dumbbell bent over row', kind: 'weight',
    muscles: ['espalda', 'biceps'], pattern: 'traccion_h', equip: 'mancuernas', lvl: 1, main: true,
    tips: ['Torso inclinado, espalda recta', 'Lleva las mancuernas a la cadera', 'Aprieta la espalda arriba'],
  },
  hiit: {
    name: 'Cardio HIIT', apiId: 'dK9394r', apiName: 'burpee', kind: 'cardio',
    muscles: [], pattern: 'cardio', equip: 'corporal', lvl: 2, flags: ['impact'],
    tips: ['Ej.: 30 s a tope + 30 s suave, repetir', 'Bici, elíptica, cinta o burpees', 'Calienta 3 min antes'],
  },
  steady: {
    name: 'Cardio continuo', apiId: 'rjiM4L3', apiName: 'walking on incline treadmill', kind: 'cardio',
    muscles: [], pattern: 'cardio', equip: 'corporal', lvl: 1,
    tips: ['Ritmo constante donde puedas hablar', 'Cinta inclinada, bici o elíptica', 'Mantén el mismo ritmo todo el tiempo'],
  },

  // ---- Catálogo ampliado (planes por objetivo) ----
  rdl: {
    name: 'Peso muerto rumano', apiId: 'wQ2c4XD', apiName: 'barbell romanian deadlift', kind: 'weight',
    muscles: ['isquios', 'gluteos'], pattern: 'bisagra', equip: 'barra', lvl: 2, main: true,
    tips: ['Rodillas apenas flexionadas, espalda recta', 'Lleva la cadera hacia atrás y baja la barra pegada a las piernas', 'Sube apretando glúteos, sin arquear la espalda'],
  },
  rdlManc: {
    name: 'Peso muerto rumano con mancuernas', apiId: 'rR0LJzx', apiName: 'dumbbell romanian deadlift', kind: 'weight',
    muscles: ['isquios', 'gluteos'], pattern: 'bisagra', equip: 'mancuernas', lvl: 1, main: true,
    tips: ['Mancuernas pegadas a las piernas', 'Cadera hacia atrás, espalda recta', 'Baja hasta sentir el estiramiento atrás del muslo'],
  },
  pesoMuerto: {
    name: 'Peso muerto', apiId: 'ila4NZS', apiName: 'barbell deadlift', kind: 'weight',
    muscles: ['isquios', 'gluteos', 'espalda'], pattern: 'bisagra', equip: 'barra', lvl: 2, main: true, flags: ['axial'],
    tips: ['Barra sobre la mitad del pie', 'Espalda recta y pecho arriba antes de levantar', 'Empuja el piso con las piernas y termina con la cadera'],
  },
  hipThrust: {
    name: 'Empuje de cadera con barra', apiId: 'qKBpF7I', apiName: 'barbell glute bridge', kind: 'weight',
    muscles: ['gluteos', 'isquios'], pattern: 'bisagra', equip: 'barra', lvl: 1, main: true,
    tips: ['Barra sobre la cadera, con almohadilla', 'Sube la cadera hasta alinear rodillas, cadera y hombros', 'Aprieta glúteos arriba un segundo'],
  },
  curlFemoral: {
    name: 'Curl femoral', apiId: '17lJ1kr', apiName: 'Machine Lying Leg Curl', kind: 'weight',
    muscles: ['isquios'], pattern: 'curl_femoral', equip: 'maquina', lvl: 1,
    tips: ['Cadera pegada al banco', 'Lleva los talones hacia los glúteos', 'Baja lento, sin soltar el peso'],
  },
  puenteGluteo: {
    name: 'Puente de glúteo', apiId: 'u0cNiij', apiName: 'low glute bridge on floor', kind: 'reps',
    muscles: ['gluteos', 'isquios'], pattern: 'bisagra', equip: 'corporal', lvl: 1, flags: ['floor'],
    tips: ['Boca arriba, pies cerca de los glúteos', 'Sube la cadera apretando glúteos', 'Puedes poner peso sobre la cadera'],
  },
  pesoMuertoBanda: {
    name: 'Peso muerto con banda', apiId: 'kuMiR2T', apiName: 'band stiff leg deadlift', kind: 'reps',
    muscles: ['isquios', 'gluteos'], pattern: 'bisagra', equip: 'banda', lvl: 1,
    tips: ['Pisa la banda con ambos pies', 'Cadera hacia atrás, espalda recta', 'Sube apretando glúteos'],
  },
  hiperext: {
    name: 'Hiperextensión', apiId: 'zhMwOwE', apiName: 'hyperextension', kind: 'reps',
    muscles: ['isquios', 'gluteos'], pattern: 'bisagra', equip: 'maquina', lvl: 1,
    tips: ['Cadera apoyada en el borde del cojín', 'Baja con la espalda recta', 'Sube hasta alinear el cuerpo, sin arquear de más'],
  },
  goblet: {
    name: 'Sentadilla goblet', apiId: 'yn8yg1r', apiName: 'dumbbell goblet squat', kind: 'weight',
    muscles: ['cuadriceps', 'gluteos'], pattern: 'sentadilla', equip: 'mancuernas', lvl: 1, main: true,
    tips: ['Mancuerna pegada al pecho', 'Baja entre las rodillas con el torso recto', 'Talones siempre apoyados'],
  },
  sentadillaCorp: {
    name: 'Sentadilla sin peso', apiId: '6YUfHPL', apiName: 'quads (bodyweight squat)', kind: 'reps',
    muscles: ['cuadriceps', 'gluteos'], pattern: 'sentadilla', equip: 'corporal', lvl: 1,
    tips: ['Pies al ancho de hombros', 'Baja como si te sentaras', 'Rodillas en la dirección de los pies'],
  },
  sentadillaBanda: {
    name: 'Sentadilla con banda', apiId: 'TUZLh71', apiName: 'band squat', kind: 'reps',
    muscles: ['cuadriceps', 'gluteos'], pattern: 'sentadilla', equip: 'banda', lvl: 1,
    tips: ['Pisa la banda y sujétala a la altura de los hombros', 'Baja controlado', 'Sube contra la tensión de la banda'],
  },
  zancadasCorp: {
    name: 'Zancadas sin peso', apiId: 'IZVHb27', apiName: 'walking lunge', kind: 'reps',
    muscles: ['cuadriceps', 'gluteos'], pattern: 'unilateral', equip: 'corporal', lvl: 1,
    tips: ['Paso largo, torso recto', 'Ambas rodillas a 90° abajo', 'Cuenta las repeticiones por pierna'],
  },
  extCuadriceps: {
    name: 'Extensión de cuádriceps', apiId: 'my33uHU', apiName: 'Machine Leg Extension', kind: 'weight',
    muscles: ['cuadriceps'], pattern: 'aislado', equip: 'maquina', lvl: 1,
    tips: ['Espalda apoyada', 'Extiende sin golpear arriba', 'Baja lento'],
  },
  bancaManc: {
    name: 'Press de banca con mancuernas', apiId: 'SpYC0Kp', apiName: 'dumbbell bench press', kind: 'weight',
    muscles: ['pecho', 'triceps'], pattern: 'empuje_h', equip: 'mancuernas', lvl: 1, main: true,
    tips: ['Escápulas juntas, pies firmes', 'Baja las mancuernas a los lados del pecho', 'Sube sin chocar las mancuernas'],
  },
  pressPechoMaq: {
    name: 'Press de pecho en máquina', apiId: 'DOoWcnA', apiName: 'Machine Chest Press', kind: 'weight',
    muscles: ['pecho', 'triceps'], pattern: 'empuje_h', equip: 'maquina', lvl: 1, main: true,
    tips: ['Ajusta el asiento: agarres a la altura del pecho', 'Empuja sin despegar la espalda', 'Regresa controlado'],
  },
  flexiones: {
    name: 'Flexiones', apiId: 'I4hDWkc', apiName: 'push-up', kind: 'reps',
    muscles: ['pecho', 'triceps'], pattern: 'empuje_h', equip: 'corporal', lvl: 2,
    tips: ['Cuerpo en línea recta', 'Baja el pecho cerca del piso', 'Codos a unos 45° del cuerpo'],
  },
  flexRodillas: {
    name: 'Flexiones con rodillas apoyadas', apiId: 'ZOuKWir', apiName: 'Kneeling Push-Up', kind: 'reps',
    muscles: ['pecho', 'triceps'], pattern: 'empuje_h', equip: 'corporal', lvl: 1,
    tips: ['Rodillas en el piso, cadera alineada', 'Baja el pecho controlado', 'Cuando hagas 15 seguidas, pasa a flexiones completas'],
  },
  pressPechoBanda: {
    name: 'Press de pecho con banda', apiId: '4x5Okof', apiName: 'Band Seated Chest Press', kind: 'reps',
    muscles: ['pecho', 'triceps'], pattern: 'empuje_h', equip: 'banda', lvl: 1,
    tips: ['Banda anclada detrás, a la altura del pecho', 'Empuja al frente sin encoger los hombros', 'Regresa lento'],
  },
  hombroMaq: {
    name: 'Press de hombro en máquina', apiId: '67n3r98', apiName: 'lever shoulder press', kind: 'weight',
    muscles: ['hombros', 'triceps'], pattern: 'empuje_v', equip: 'maquina', lvl: 1, main: true, flags: ['overhead'],
    tips: ['Espalda apoyada', 'Empuja hacia arriba sin arquear la espalda', 'Baja hasta la altura de las orejas'],
  },
  hombroBanda: {
    name: 'Press de hombro con banda', apiId: 'peAeMR3', apiName: 'band shoulder press', kind: 'reps',
    muscles: ['hombros', 'triceps'], pattern: 'empuje_v', equip: 'banda', lvl: 1, flags: ['overhead'],
    tips: ['Pisa la banda, manos a la altura de los hombros', 'Empuja hacia arriba', 'Abdomen firme'],
  },
  dominadas: {
    name: 'Dominadas', apiId: 'lBDjFxJ', apiName: 'pull-up', kind: 'reps',
    muscles: ['espalda', 'biceps'], pattern: 'traccion_v', equip: 'barra_fija', lvl: 2, flags: ['hang'],
    tips: ['Agarre un poco más ancho que los hombros', 'Sube llevando el pecho a la barra', 'Baja controlado hasta estirar los brazos'],
  },
  remoMaq: {
    name: 'Remo en máquina', apiId: '7I6LNUG', apiName: 'Machine Seated Row', kind: 'weight',
    muscles: ['espalda', 'biceps'], pattern: 'traccion_h', equip: 'maquina', lvl: 1, main: true,
    tips: ['Pecho apoyado en el cojín', 'Jala juntando las escápulas', 'Regresa lento'],
  },
  remoBarra: {
    name: 'Remo con barra', apiId: 'eZyBC3j', apiName: 'barbell bent over row', kind: 'weight',
    muscles: ['espalda', 'biceps'], pattern: 'traccion_h', equip: 'barra', lvl: 2, main: true,
    tips: ['Torso inclinado, espalda recta', 'Lleva la barra al abdomen', 'No te impulses con la cadera'],
  },
  remoInvertido: {
    name: 'Remo invertido', apiId: 'bZGHsAZ', apiName: 'inverted row', kind: 'reps',
    muscles: ['espalda', 'biceps'], pattern: 'traccion_h', equip: 'barra_fija', lvl: 1,
    tips: ['Barra baja, cuerpo recto debajo', 'Lleva el pecho a la barra', 'Más fácil con las rodillas flexionadas'],
  },
  remoBanda: {
    name: 'Remo con banda', apiId: 'tc5dYrf', apiName: 'band standing rear delt row', kind: 'reps',
    muscles: ['espalda', 'biceps'], pattern: 'traccion_h', equip: 'banda', lvl: 1,
    tips: ['Banda anclada al frente', 'Jala los codos hacia atrás juntando escápulas', 'Regresa lento'],
  },
  curlBiceps: {
    name: 'Curl de bíceps', apiId: '3s4NnTh', apiName: 'dumbbell standing biceps curl', kind: 'weight',
    muscles: ['biceps'], pattern: 'aislado', equip: 'mancuernas', lvl: 1,
    tips: ['Codos pegados al cuerpo', 'Sube sin balancearte', 'Baja lento'],
  },
  tricepsPolea: {
    name: 'Extensión de tríceps en polea', apiId: '3ZflifB', apiName: 'cable pushdown', kind: 'weight',
    muscles: ['triceps'], pattern: 'aislado', equip: 'polea', lvl: 1,
    tips: ['Codos pegados al cuerpo', 'Extiende hasta abajo', 'Sube controlado hasta 90°'],
  },
  deadBug: {
    name: 'Bicho muerto (dead bug)', apiId: 'iny3m5y', apiName: 'dead bug', kind: 'reps',
    muscles: ['core'], pattern: 'core', equip: 'corporal', lvl: 1, flags: ['floor'],
    tips: ['Boca arriba, zona lumbar pegada al piso', 'Extiende brazo y pierna contrarios', 'Lento, sin arquear la espalda'],
  },
  caminar: {
    name: 'Caminata rápida', apiId: 'rjiM4L3', apiName: 'walking on incline treadmill', kind: 'cardio',
    muscles: [], pattern: 'cardio', equip: 'corporal', lvl: 1,
    tips: ['Ritmo en el que puedas hablar pero no cantar', 'En cinta o al aire libre', 'Sube minutos poco a poco'],
  },
  bici: {
    name: 'Bicicleta', apiId: 'a8VDgLw', apiName: 'stationary bike walk', kind: 'cardio',
    muscles: [], pattern: 'cardio', equip: 'corporal', lvl: 1,
    tips: ['Ajusta el sillín a la altura de la cadera', 'Ritmo constante', 'Sube minutos poco a poco'],
  },
  eliptica: {
    name: 'Elíptica', apiId: 'rjtuP6X', apiName: 'walk elliptical cross trainer', kind: 'cardio',
    muscles: [], pattern: 'cardio', equip: 'corporal', lvl: 1,
    tips: ['Espalda recta, sin colgarte de los agarres', 'Ritmo constante', 'Sube minutos poco a poco'],
  },
  correr: {
    name: 'Correr', apiId: 'oLrKqDH', apiName: 'run', kind: 'cardio',
    muscles: [], pattern: 'cardio', equip: 'corporal', lvl: 2, flags: ['impact'],
    tips: ['Empieza alternando trote y caminata', 'Ritmo cómodo', 'Sube minutos poco a poco'],
  },
  cardioLibre: {
    name: 'Otra actividad (nadar, bailar, deporte)', kind: 'cardio',
    muscles: [], pattern: 'cardio', equip: 'corporal', lvl: 1,
    tips: ['Elige algo que disfrutes y puedas repetir', 'Anota los minutos que hiciste', 'Lo importante es la constancia'],
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
