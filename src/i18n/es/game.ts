// Español (neutro internacional): textos generados por las reglas del juego.
// Misma estructura que zh-TW; cada pool de `speech` tiene el mismo número de frases y el mismo orden.
// Marcadores {name}: se sustituyen con fmt().

import type { GameMessages } from '../types';

// Las 2 primeras frases de ambos pools de buenas noches son ambiguas (no revelan el objetivo).
const SHARED_GOODNIGHT = ['Mmm… buenas noches.', '¿Apagamos la luz?'];

const game: GameMessages = {
  action: {
    lieSupine: { label: 'Boca arriba', hint: 'Ponte boca arriba. Si te duermes profundamente así, roncarás.' },
    lieSideFacing: { label: 'Cara a cara', hint: 'De lado, mirando a tu pareja: hace falta para besar, abrazar o acariciar.' },
    lieSideAway: { label: 'Dar la espalda', hint: 'De lado, de espaldas a tu pareja: frena sus avances, pero si busca intimidad, se desanimará.' },
    lieProne: { label: 'Boca abajo', hint: 'Dormir boca abajo (solo tu pareja duerme así).' },
    hug: { label: 'Abrazar', hint: 'Abraza a tu pareja (tiene que estar de lado). Abrazados se duerme mejor.' },
    kiss: { label: 'Besar', hint: 'Un beso sube mucho la intimidad. Tu pareja debe estar de cara a ti o boca arriba.' },
    caress: { label: 'Acariciar', hint: 'Acaricia a tu pareja: sube la intimidad, esté en la postura que esté.' },
    whisper: { label: 'Susurrar', hint: 'Susúrrale algo: mejora su ánimo y sube un poco la intimidad. Muy silencioso.' },
    pat: { label: 'Palmaditas', hint: 'Palmaditas a tu pareja: calman su enfado y le traen el sueño; si ronca, se da la vuelta.' },
    offerArm: { label: 'Ofrecer brazo', hint: 'Ofrécele tu brazo de almohada. Muy tierno, pero a la larga da hormigueo.' },
    restOnArm: { label: 'Apoyarse', hint: 'Apoya la cabeza en su brazo: intimidad +5, y así se duerme mejor.' },
    leaveArm: { label: 'Dejar su brazo', hint: 'Aparta la cabeza. Si a él le hormiguea el brazo, te lo agradecerá.' },
    withdrawArm: { label: 'Retirar brazo', hint: 'Retira el brazo. Con muy poca fuerza no sale; con demasiada, la despiertas.' },
    pullBlanket: { label: 'Taparse', hint: 'Lleva la manta hacia ti: entras en calor, pero tu pareja pasa frío.' },
    tuckBlanket: { label: 'Arropar', hint: 'Tapa bien a tu pareja con la manta: mejora su ánimo y sube un poco la intimidad.' },
    scootIn: { label: 'Acercarse', hint: 'Muévete hacia el centro de la cama: solo alcanzas a tu pareja si estás cerca.' },
    scootOut: { label: 'Apartarse', hint: 'Muévete un poco hacia el borde. ¡Si te pasas, te caes de la cama!' },
    sleep: { label: 'Dormir', hint: 'A dormir: sueño +18. Antes tienes que cerrar los ojos.' },
    push: { label: 'Empujar', hint: '(Solo tu pareja) Con 70 de enfado o más, te aparta de un empujón.' },
  },

  /** Motivos por los que una acción no está disponible, notas de acción y narración */
  msg: {
    alreadyPosture: 'Ya estás en esa postura',
    armPinned: 'Ella está apoyada en tu brazo; primero retíralo',
    eyesClosedHug: 'Con los ojos cerrados no atinas a abrazar; ábrelos',
    eyesClosedKiss: 'Con los ojos cerrados no atinas a besar; ábrelos',
    alreadyEmbrace: 'Ya se están abrazando',
    needFacing: 'Primero ponte de lado, cara a cara',
    partnerNotSide: 'Para abrazar, tu pareja tiene que estar de lado',
    tooFar: 'Demasiado lejos; acércate un poco',
    partnerFacingAway: 'Tu pareja te da la espalda',
    partnerProne: 'Tu pareja duerme boca abajo',
    armAlreadyOffered: 'Ya tienes el brazo extendido',
    offerNeedPosture: 'Tienes que estar boca arriba o de lado, mirándola',
    herBackTurned: 'Ella te da la espalda',
    armNotOffered: 'Él aún no te ofrece el brazo',
    alreadyOnArm: 'Ya estás sobre su brazo',
    restNeedPosture: 'Tienes que estar boca arriba o de lado, mirándolo',
    notOnArm: 'No estás sobre su brazo',
    armNotOut: 'No tienes el brazo extendido',
    blanketAllMine: 'Ya tienes toda la manta',
    blanketAllTheirs: 'Tu pareja ya tiene toda la manta',
    alreadyClose: 'Más cerca, imposible',
    atCenter: 'Ya estás en el centro de la cama',
    closeEyesFirst: 'Primero cierra los ojos',
    onlyPartnerPushes: 'Solo tu pareja empuja',
    notAngryEnough: 'Todavía no hay tanto enfado',
    notAllowed: 'No puedes hacer eso',
    tooRough: '¡Demasiado brusco!',
    sneakHug: 'Un abrazo a escondidas',
    sneakKiss: 'Un besito a escondidas',
    sneakCaress: 'Una caricia suavecita',
    ticklish: '¡Cosquillas!',
    patRollOver: 'Una palmadita, se da la vuelta y deja de roncar',
    armStuck: 'El brazo está atrapado y no sale',
    oneHandPull: 'Con una sola mano no hay mucha fuerza',
    fellOffEdge: '¡Te caes por el borde de la cama!',
    partnerFellEdge: 'Tu pareja se cae por el borde',
    edgePlayer: '¡Ya estás al borde de la cama!',
    edgePartner: 'Tu pareja ya está al borde de la cama',
    sleepCold: 'Con este frío cuesta dormir',
    sleepBadMood: 'Con el ánimo bajo no llega el sueño',
    sleepArmPinned: 'Con el brazo atrapado se duerme mal',
    tooLateAsleep: 'Tu pareja ya duerme…',
    tooLateEndTurn: 'La intimidad está al máximo, pero tu pareja ya duerme…',
    rubEyes: 'Te frotas los ojos para no dormirte',
    wokeYourself: 'Te despiertas sin querer',
    partnerStoleBlanket: 'En sueños, tu pareja te roba la manta',
    partnerBurrito: 'Tu pareja se envuelve como un burrito',
  },

  posture: {
    supine: 'boca arriba',
    sideFacing: 'de lado, cara a cara',
    sideAway: 'de lado, dando la espalda',
    prone: 'boca abajo',
  },

  band: { timid: 'Muy suave', gentle: 'Con cariño', firm: 'Firme', rough: 'Brusco' },

  goal: { sleep: 'Dormir bien', intimacy: 'Intimidad' },

  ending: {
    kickedOff: {
      title: '¡Fuera de la cama!',
      caption: 'KICKED OUT',
      description: 'Una patada te manda directo al suelo. Buenas noches.',
      tip: 'Si el enfado de tu pareja llega a 100, te echa de una patada. Mantén la fuerza en la zona verde y, si el enfado sube, usa antes «Palmaditas».',
    },
    fellOff: {
      title: 'Te caíste de la cama',
      caption: 'FELL OFF',
      description: 'Nadie te tocó: rodaste al suelo por tu cuenta.',
      tip: 'Si usas «Apartarse» demasiadas veces, te caes. Vigila el borde rojo de la barra de posición.',
    },
    intimacyWin: {
      title: 'Se apaga la luz',
      caption: 'LIGHTS OUT',
      description: 'Se miran y sonríen. Esta noche sobran las palabras.',
      tip: '¡Perfecto! Supiste leer las señales de tu pareja.',
    },
    accidentalIntimacy: {
      title: 'Una noche inesperada',
      caption: 'PLOT TWIST',
      description: 'Solo querías dormir… Bueno, tampoco estuvo mal.',
      tip: 'Si solo quieres dormir, no le des tanto cariño a tu pareja.',
    },
    sleepWin: {
      title: 'Sueño reparador',
      caption: 'SWEET DREAMS',
      description: '06:00. Te despiertas con las pilas cargadas.',
      tip: '¡Perfecto! Ojos cerrados, buen calor y nada de dar vueltas: las tres claves para dormir bien.',
    },
    sleepLoseTired: {
      title: 'Ojeras',
      caption: 'SLEEPLESS',
      description: 'Ya es de día y no pegaste ojo.',
      tip: 'Necesitas 7 puntos de sueño: cierra los ojos, usa mucho «Dormir», abrígate y que no te despierten.',
    },
    intimacyLoseFellAsleep: {
      title: 'Te ganó el sueño',
      caption: 'OUT COLD',
      description: '¿Y lo de esta noche? Te dormiste tú primero.',
      tip: 'Si buscas intimidad, mantén los ojos abiertos y no abuses de «Dormir».',
    },
    intimacyLoseMorning: {
      title: 'Ya amaneció',
      caption: 'TOO LATE',
      description: 'No pasó nada. Suena el despertador.',
      tip: 'Primero «Cara a cara» y «Acercarse»; luego, besa. Si tu pareja quiere dormir, sube antes su ánimo hasta {n}.',
    },
  },

  /** Consejo de cada turno (barra 💡) */
  hint: {
    edgeDanger: '¡Estás a punto de caerte de la cama! Acércate al centro.',
    calmPartner: 'El enfado de tu pareja está por las nubes: calma las cosas con «Palmaditas» (con suavidad).',
    warmUp: '¡Qué frío! Recupera la manta con «Taparse» (si duermes, te despertarás un poco).',
    closeEyes: 'Cierra los ojos para poder dormir.',
    lullPartner: 'Tu pareja sigue con energía: dale palmaditas para que se duerma primero y luego duerme en paz.',
    stayStill: 'Si das muchas vueltas, tu pareja notará que no duermes. Nada de moverse: a dormir.',
    keepSleeping: 'Muy bien. Sigue durmiendo.',
    sleepDone: '¡Ya tienes los puntos de sueño! Sigue durmiendo hasta que amanezca.',
    openEyes: 'Abre los ojos para besar y abrazar, y para ver cómo está tu pareja.',
    faceThem: 'Primero ponte «Cara a cara» con tu pareja.',
    scootCloser: 'Estás demasiado lejos: usa «Acercarse».',
    partnerAsleep: 'Tu pareja duerme. Un beso firme (zona amarilla) podría interrumpirle el sueño, pero también subirle el enfado.',
    cheerUp: 'Tu pareja tiene el ánimo bajo: prueba con «Susurrar» o «Arropar».',
    moodUp: 'Parece que tu pareja quiere dormir: sube primero su ánimo hasta {n} («Susurrar», «Arropar»).',
    kiss: 'Prueba con un beso, con la fuerza en la zona verde.',
    hug: 'Prueba con un abrazo, con la fuerza en la zona verde.',
    caress: 'Acaricia a tu pareja, con la fuerza en la zona verde.',
    whisper: 'Susúrrale algo para acortar distancias.',
    almostThere: '¡Ya casi! Otro beso antes de que tu pareja se duerma.',
  },

  speech: {
    // Apertura: en ambos pools, 1/3 son frases ambiguas compartidas que no revelan el objetivo
    goodnight_sleep: [...SHARED_GOODNIGHT, 'Qué día tan agotador…', 'Mañana hay que madrugar; durmamos ya.', 'Se me cierran los ojos…', 'Buenas noches. No me molestes, ¿eh?'],
    goodnight_intimacy: [...SHARED_GOODNIGHT, 'Hoy… no tengo mucho sueño, la verdad.', '¿Ya a dormir? ¿Tan temprano?', 'Qué bien hueles hoy.', 'Todavía no quiero dormir…'],
    goodnight: ['Yo ya me duermo.', 'Buenas noches, que descanses.', 'Ahora sí me duermo. No me molestes.'],

    sleepTalk_sleep: ['Mmm… el informe…', 'No… cinco minutitos más…', '(murmura)… mañana lo vemos…', '…el despertador… apágalo…'],
    sleepTalk_intimacy: ['Mmm… más cerquita…', '(murmura)… abrázame…', '…qué bien hueles…', 'Jeje… no te vayas…'],

    wake: ['¿Mmm? ¿Qué pasa…?', '…¿Qué haces?', 'Me acababa de dormir…', '¿Eh? ¿Qué hora es…?'],
    wakeAngry: ['¡Haces mucho ruido!', '¡Con lo que me costó dormirme!', '¡¿Vas a dormir o no?!', '¡Agh! ¡Otra vez me despiertas!'],
    coldAwake: ['Qué frío… ¿y la manta?', '¡Oye! ¡Me quitaste la manta!', 'Me muero de frío…'],

    refuseMood: ['Ahora no estoy de humor.', 'Ay, no…', 'Hoy no tengo ganas.'],
    refuseAnnoyed: ['No me toques.', 'Déjame en paz.', '¿No ves que estoy que echo chispas?'],
    sleepyDecline: ['Tengo mucho sueño… ¿mañana, sí?', 'Mmm… déjame dormir…', 'Ya es muy tarde…', '(se da la vuelta)… a dormir.'],
    okFine: ['Bueno… solo un ratito.', 'Ay, contigo no hay manera…', '…Está bien, pero solo un poquito, ¿eh?'],

    receptiveKiss: ['Jeje…', 'Otro más…', '¿Y hoy por qué tan dulce?', '(se sonroja)'],
    receptiveHug: ['Qué calentito…', 'Mmm, abrázame más fuerte.', 'Así se está muy bien.'],
    receptiveCaress: ['¡Me haces cosquillas…!', 'Mmm… qué gusto.', 'Tienes las manos calentitas.'],
    whisperReply: ['Jiji, ¡qué lata das!', 'Yo también…', '¿En serio?', 'Ajá, ¿y luego?'],
    patReply: ['¿Y esas palmaditas…? Jeje.', '¡Que ya no tengo cinco años…!', 'Una palmadita más.'],

    armOffered: ['Ven, usa mi brazo de almohada.', '¿Quieres apoyarte aquí?', 'Te presto mi brazo.'],
    armAccepted: ['Mmm… qué cómodo.', 'Pues no me hago de rogar.', 'Tu brazo está calentito.'],
    numbArm: ['El b-brazo… se me está durmiendo…', 'Este brazo ya no parece mío…', 'Sss… qué hormigueo…'],
    armRelieved: ['Uf… por fin vuelvo a sentir el brazo.', '¡Qué alivio…!', 'Gracias… (sacude el brazo)'],

    blanketPulled: ['¡Oye, la manta!', 'Te llevaste toda la manta.', 'Brrr, qué frío…'],
    blanketTucked: ['Gracias…', 'Mmm, calentito.', '¡Eres un amor!'],
    snore: ['¡Qué escándalo…!', 'Roncas muy fuerte…', '(se tapa los oídos)…'],
    roughComplaint: ['¡Oye, con cuidado!', '¿Me estás pegando?', '¡Más suave!', '¡Eso duele!'],

    noticedIntimacy: ['¿Tú tampoco duermes?', 'Eh, ¿sigues en vela?', '¿No puedes dormir?… Yo tampoco.'],
    noticedSleep: ['Deja de dar vueltas.', '¿Al final duermes o no?', 'La cama no para de moverse…'],
    breathTell: ['Respiras demasiado regular… no duermes, ¿verdad?', 'No finjas, sé que no duermes.', '…¿Estás fingiendo que duermes?'],
    stare: ['¿Por qué me miras tanto?', 'Cierra los ojos y duérmete.', '¿Qué me miras…?'],

    push: ['¡Muévete para allá!', '¡Me estás dejando sin espacio!', '¡Apártate!'],
    kick: ['¡Bájate de la cama!', '¡A dormir al sofá!', '¡Lárgate!'],
    fellOff: ['¡Ay!…', '¡Pum!… ¿Qué hago en el suelo?', '…El suelo está helado.'],
    tooLate: ['…¿Ya se durmió?', '¿Justo ahora te duermes…?', '(suspira)'],
    intimacyHigh: ['Se me acelera el corazón…', '¿Qué te pasa hoy, que no me sueltas?', 'Hay algo… distinto en el ambiente.'],
    partnerInitiate: ['No te escondas.', 'Ven, acércate un poquito.', 'Estás tan lejos…'],
    wakeUp: ['¡Despierta~!', 'Oye, ¿ya te dormiste? Hazme compañía.', '¡Prohibido dormir!'],

    // Pantalla final: morning_{objetivo del jugador}_{objetivo de la pareja}; together = intimidad lograda, floor = fuera de la cama
    morning_sleep_sleep: ['«Buenos días. ¿Anoche tenías ganas de algo?» «¿Eh? No. ¿Por?»', '«Qué bien dormí.» «Sí, por fin una noche de un tirón.»', '«Buenas… anoche roncaste.» «Tú también.»'],
    morning_intimacy_sleep: ['«¿Qué te pasaba anoche, que no parabas de moverte?» «…Nada.»', '«¿Dormiste bien?» «Eh… más o menos.»', '«¡Qué ojeras tienes!» «…Sí.»'],
    morning_sleep_intimacy: ['«…Anoche te lancé indirectas, ¿sabes?» «¿¿En serio??»', '«Anoche te dormiste rapidísimo.» «Sí, tenía muchísimo sueño.» «…Ah.»', '«¿Hoy vuelves temprano a casa?» «Eh… ¿sí?»'],
    morning_intimacy_intimacy: ['«La verdad es que anoche yo también… Bah, olvídalo. Buenos días.»', '«¿Anoche los dos esperábamos a que el otro diera el primer paso?»', '«…¿Lo intentamos otra vez esta noche?» «Hecho.»'],
    morning_together: ['«Buenos días.» «…Buenos días.» (se sonríen)', '«Lo de anoche…» «Shh, no digas nada.»', '«¿Hoy podemos levantarnos más tarde?» «Claro.»'],
    morning_floor: ['«¿Por qué dormiste en el suelo?» «…¿Tú qué crees?»', '«¿Qué tal la espalda?» «…Mal.»', '«Perdóname, anda…» «Hmpf.»'],
  },
};

export default game;
