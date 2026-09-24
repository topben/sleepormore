// Español (neutro internacional): textos de la interfaz. Misma estructura que zh-TW.
// Marcadores {name}: se sustituyen con fmt().

import type { UiMessages } from '../types';

const ui: UiMessages = {
  meta: {
    title: 'Misma cama, sueños distintos · Sleep or More',
    description: 'Misma cama, sueños distintos — minijuego 3D sobre una pareja que comparte cama',
  },

  common: {
    you: 'Tú',
    partner: 'Tu pareja',
    male: 'él',
    female: 'ella',
    close: 'Cerrar',
    cancel: 'Cancelar',
    back: 'Volver',
    on: 'Sí',
    off: 'No',
    loadError: 'No se pudo cargar el idioma. Revisa tu conexión e inténtalo de nuevo.',
  },

  start: {
    title: 'Misma cama, sueños distintos',
    subtitle: 'SLEEP OR MORE',
    tagline: '¿Esta noche solo quieres dormir… o algo más?',
    chooseRole: 'Elige tu personaje',
    playMale: 'Soy él',
    playFemale: 'Soy ella',
    sideLeft: 'Lado izquierdo',
    sideRight: 'Lado derecho',
    howToPlay: 'Cómo jugar',
    footnote: '12 turnos · unos 5 minutos · para adultos, sin contenido explícito',
    language: 'Idioma',
    plugTag: '[Publicidad descarada]',
    plug: 'Agendemos una hora para dormir',
  },

  goal: {
    heading: 'Tu objetivo de esta noche',
    youAre: 'Juegas como {role} y duermes {side}.',
    left: 'a la izquierda',
    right: 'a la derecha',
    winLabel: 'Cómo ganar',
    tipsLabel: 'Trucos',
    sleep: {
      win: 'Aguanta hasta las 06:00 y consigue {n} puntos de sueño (+1 por turno durmiendo, +0.5 dormitando).',
      tips: [
        'Primero cierra los ojos con el botón de arriba y luego usa «💤 Dormir» para acumular sueño.',
        'Si te quitan la manta, pasarás frío, y con frío se duerme mal.',
        'No des tantas vueltas: si haces mucho ruido, despertarás y enfadarás a tu pareja.',
      ],
    },
    intimacy: {
      win: 'Lleva la intimidad a 100 antes del amanecer, mientras tu pareja siga sin dormir.',
      tips: [
        'Mantén los ojos abiertos, ponte «Cara a cara» y, si estás lejos, usa «Acercarse».',
        'Para besar o abrazar, mantén el botón para cargar fuerza y suéltalo en la zona verde; con demasiada fuerza, tu pareja se enfadará.',
        'Si tu pareja quiere dormir, sube primero su ánimo hasta {n} con «Susurrar» y «Arropar».',
      ],
    },
    secret: 'Tu pareja también tiene su propio objetivo (secreto). ¡Adivínalo por lo que dice y hace!',
    hintsToggle: 'Mostrar consejos (ideal para empezar)',
    start: 'Empezar',
  },

  hud: {
    turn: 'Turno {n}/{max}',
    progress: {
      sleep: 'Puntos de sueño {v}/{t}',
      intimacy: 'Intimidad {v}/{t}',
    },
    status: {
      done: '¡Logrado!',
      onTrack: 'A tiempo',
      tight: 'Va justo',
      impossible: 'Ya no da tiempo',
    },
    eyes: {
      open: 'Ojos abiertos',
      closed: 'Ojos cerrados',
      toClose: 'Cerrar los ojos',
      toOpen: 'Abrir los ojos',
      openInfo: 'Ves a tu pareja · No puedes dormir',
      closedInfo: 'Puedes dormir · No ves a tu pareja',
    },
    me: 'Yo',
    partner: 'Tu pareja',
    stat: {
      sleep: 'Sueño',
      warmth: 'Calor',
      mood: 'Ánimo',
      restless: 'Inquietud',
      numb: 'Hormigueo',
      annoyance: 'Enfado',
      eyes: 'Ojos',
      breath: 'Respiración',
      snore: 'Ronquidos',
      goal: 'Objetivo',
    },
    sleepState: {
      awake: 'En vela',
      drowsy: 'Dormitando',
      asleep: 'Durmiendo',
      deep: 'Sueño profundo',
    },
    breath: {
      fast: 'Agitada',
      steady: 'Tranquila',
      slow: 'Lenta',
      deep: 'Profunda',
      suspicious: 'Sospechosamente regular',
    },
    eyesState: { open: 'Abiertos', closed: 'Cerrados' },
    snoreLevel: ['No', 'Suave', 'Medio', 'Muy fuerte'],
    cold: '¡Qué frío!',
    restlessWarn: 'Cuidado',
    restlessDanger: '¡Casi te descubren!',
    annoyPush: '¡Va a empujar!',
    annoyHigh: 'Se está enfadando',
    unknown: '?',
    closedNote: 'Con los ojos cerrados no ves nada; solo oyes:',
    hidden: 'Secreto',
    clue: {
      label: 'Corazonada',
      none: 'Aún no está claro',
      sleep: 'Parece que tu pareja quiere dormir',
      intimacy: 'Parece que tu pareja busca intimidad',
      count: '😴×{s} 💞×{i}',
    },
    intimacy: 'Intimidad',
    intimacyNudge: '¡Ahora, antes de que se duerma!',
    noise: {
      label: 'Ruido',
      last: 'Última acción: {n}',
      threshold: 'Umbral de despertar: {t}',
      thresholdUnknown: 'Umbral: ?',
      none: 'Tu pareja aún no duerme: sin riesgo de despertar',
    },
    bed: {
      label: 'Posición',
      edge: 'Borde',
      blanket: 'Manta',
      blanketHidden: 'Con los ojos cerrados no ves la manta',
    },
    hint: 'Consejo',
    hideHints: 'Ocultar consejos',
    log: 'Historial',
    logEmpty: 'Nada que contar todavía.',
    help: 'Ayuda',
    settings: 'Opciones',
    sound: 'Sonido',
  },

  action: {
    category: {
      rest: 'Descanso',
      posture: 'Postura',
      affection: 'Cariño',
      blanket: 'Manta',
      move: 'Moverse',
      arm: 'Brazo',
      partner: 'Tu pareja',
    },
    noise: 'Ruido {n}',
    hold: 'Mantén',
    suggested: 'Sugerido',
    risk: {
      safe: 'Silencioso',
      risky: 'Puede despertar',
      loud: 'Despertará',
    },
    unavailable: 'Ahora no. {reason}',
    busy: 'Un momento, tu pareja se está moviendo…',
  },

  force: {
    title: '{action}',
    instruction: 'Mantén el botón para cargar fuerza y suéltalo en la zona verde',
    holdButton: 'Mantén para cargar',
    keyboard: 'También puedes mantener la barra espaciadora',
    tooShort: '¡Mantenlo un poco más!',
    suggested: 'Sugerido',
    result: '¡{band}!',
    cancel: 'Cancelar (Esc)',
    zones: 'Muy suave · Con cariño · Firme · Brusco',
  },

  log: {
    actor: { you: 'Tú', partner: 'Tu pareja' },
    action: '{who}: {emoji} {label}',
    band: '({band})',
    failed: '{who}: intento fallido de «{label}». {reason}',
    wake: { you: '¡El ruido te despierta!', partner: '¡El ruido despierta a tu pareja!' },
    intimacy: '♥ Intimidad {d}',
    annoyed: { you: 'Tu enfado {d}', partner: 'Enfado de tu pareja {d}' },
    mood: { you: 'Tu ánimo {d}', partner: 'Ánimo de tu pareja {d}' },
    embraceOn: 'Se funden en un abrazo',
    embraceOff: 'El abrazo se deshace',
    armOffered: 'El brazo queda listo como almohada',
    armInUse: 'La cabeza descansa sobre el brazo',
    armFree: 'El brazo vuelve a su lugar',
    armLeft: 'La cabeza se aparta del brazo',
    cold: { you: 'Tienes frío', partner: 'Tu pareja tiene frío' },
    numb: { you: 'Tienes hormigueo en el brazo', partner: 'Tu pareja tiene hormigueo en el brazo' },
    noticed: { you: 'Tu pareja nota que no duermes', partner: 'Notas que tu pareja no duerme' },
    snore: { you: 'Roncas ({level})', partner: 'Tu pareja ronca ({level})' },
    push: '¡Tu pareja te aparta de un empujón!',
    kick: '¡Una patada te saca de la cama!',
    fell: '¡Te caes de la cama!',
    clue: 'Tienes una corazonada…',
    eyes: {
      youClosed: 'Cierras los ojos',
      youOpened: 'Abres los ojos',
      partnerClosed: 'Tu pareja cierra los ojos',
      partnerOpened: 'Tu pareja abre los ojos',
    },
    speech: '{who}: «{text}»',
    turn: '— {time} —',
    posture: { you: 'Te pones {posture}', partner: 'Tu pareja se pone {posture}' },
    blanket: 'La manta se mueve',
  },

  ending: {
    partnerWanted: 'En realidad, esta noche tu pareja quería:',
    goalSleep: '😴 Dormir bien',
    goalIntimacy: '💞 Intimidad',
    morning: 'A la mañana siguiente',
    stats: 'Estadísticas',
    statTurns: 'Turnos {n}/{max}',
    statIntimacy: 'Intimidad {n}',
    statSleep: 'Puntos de sueño {n}',
    statClues: 'Pistas: {n}',
    tip: 'Para la próxima',
    again: 'Jugar otra vez',
    changeRole: 'Cambiar personaje',
    outcome: { win: 'Victoria', lose: 'Derrota', draw: 'Empate' },
  },

  help: {
    title: 'Cómo jugar',
    sections: [
      {
        title: 'Objetivo',
        body: [
          'Al empezar te toca un objetivo para la noche: 😴 Dormir bien o 💞 Intimidad. Tu pareja también tiene el suyo, pero es secreto.',
          '😴 Dormir: aguanta hasta las 06:00 con 7 puntos de sueño (+1 por turno durmiendo, +0.5 dormitando).',
          '💞 Intimidad: lleva la intimidad a 100 antes del amanecer, mientras tu pareja siga sin dormir.',
        ],
      },
      {
        title: 'Cada turno',
        body: [
          'La noche tiene 12 turnos (de 40 minutos cada uno). Eliges una acción → actúa tu pareja → pasa el tiempo.',
          '💡 La barra de consejos te sugiere qué hacer, y el botón sugerido se ilumina.',
        ],
      },
      {
        title: 'Ojos cerrados vs. abiertos',
        body: [
          'Ojos cerrados: puedes usar «💤 Dormir» para acumular sueño y tu pareja puede creer que duermes; pero no ves cómo está, y no puedes besar ni abrazar.',
          'Ojos abiertos: ves el ánimo, el enfado y el sueño de tu pareja, pero no puedes dormir. Si abres los ojos mientras duermes, te despiertas.',
        ],
      },
      {
        title: 'Fuerza',
        body: [
          'Las acciones marcadas con «Mantener» se cargan: mantén el botón (o la barra espaciadora) y suéltalo en la zona verde.',
          '«Muy suave» reduce el efecto a la mitad; «Firme» es más eficaz pero más ruidoso; «Brusco» siempre enfada a tu pareja.',
        ],
      },
      {
        title: 'Ruido y despertares',
        body: [
          'Cada acción hace ruido. Si tu pareja duerme y el ruido supera su «umbral de despertar», se despierta… y se enfada.',
          'Colores de los botones: verde = silencioso, amarillo = puede despertar, rojo = despertará.',
        ],
      },
      {
        title: 'El enfado de tu pareja',
        body: [
          'Con 70 de enfado o más, tu pareja te empuja; si te empuja fuera del borde o su enfado llega a 100, te echa de la cama de una patada.',
          '«🤲 Palmaditas» calma el enfado y ayuda a tu pareja a dormirse.',
        ],
      },
      {
        title: 'Más detalles',
        body: [
          'Manta: si te la quitan, pasas frío, y con frío se duerme mal. «Arropar» mejora el ánimo de tu pareja.',
          'Si das muchas vueltas, tu pareja notará que no duermes; boca arriba y en sueño profundo se ronca; ofrecer el brazo de almohada es muy tierno, pero da hormigueo.',
          'Deduce el objetivo de tu pareja por lo que dice y hace; en su columna verás tu «corazonada».',
        ],
      },
      {
        title: 'Controles',
        body: [
          'Haz clic o toca los botones. Espacio = cargar fuerza, E = cerrar/abrir los ojos, H = ayuda, Esc = cancelar.',
          'En Opciones puedes cambiar el idioma, activar o desactivar el sonido y los consejos, y activar «Fuerza automática» para saltarte la barra de fuerza.',
        ],
      },
    ],
  },

  settings: {
    title: 'Opciones',
    language: 'Idioma',
    sound: 'Sonido',
    hints: 'Mostrar consejos',
    autoForce: 'Fuerza automática (sin barra de fuerza, siempre «Con cariño»)',
    restart: 'Reiniciar',
    restartConfirm: '¿Seguro que quieres abandonar esta partida?',
  },
};

export default ui;
