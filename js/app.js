// MarkTask — logique de l'application (dashboard)
// Les données passent par la couche Stockage (js/stockage.js) : localStorage
// par défaut, Firestore synchronisé dès que FIREBASE_CONFIG est renseigné.

// Miroirs locaux des données, rafraîchis par Stockage à chaque changement
let SOCIETES = [];
let TACHES = [];

// Couleurs proposées pour les nouvelles sociétés, dans cet ordre
const PALETTE = ['#4FA3E8', '#E8A14F', '#C07CE8', '#5ED3A8', '#E86A6A',
                 '#EFD35F', '#7B8FF2', '#E88BC4', '#9AD65E', '#F09B59'];

function couleurProposee() {
  const utilisees = new Set(SOCIETES.map((s) => s.couleur.toUpperCase()));
  for (const couleur of PALETTE) {
    if (!utilisees.has(couleur.toUpperCase())) return couleur;
  }
  // palette épuisée : teinte aléatoire bien saturée
  const teinte = Math.floor(Math.random() * 360);
  return `#${hslVersHex(teinte, 62, 62)}`;
}

function hslVersHex(h, s, l) {
  s /= 100; l /= 100;
  const k = (n) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [f(0), f(8), f(4)]
    .map((v) => Math.round(v * 255).toString(16).padStart(2, '0'))
    .join('');
}

const AUJOURDHUI = new Date();
AUJOURDHUI.setHours(0, 0, 0, 0);

// La deadline est stockée en texte « AAAA-MM-JJ » (le format du champ date).
// Une valeur inattendue ne doit jamais faire disparaître la tâche du graphique :
// on la traite alors comme « échéance aujourd'hui » (pin tout à droite, bien visible).
function dateDeadline(tache) {
  const [annee, mois, jour] = String(tache.deadline || '').split('-').map(Number);
  const date = new Date(annee, (mois || 1) - 1, jour || 1);
  return Number.isFinite(date.getTime()) ? date : new Date(AUJOURDHUI);
}

// ---- Urgence : calculée depuis la deadline (voir plan.md) ---------------
// 4 zones sur l'axe : faible (> 1 mois), moyenne (2 sem – 1 mois),
// grave (1 – 2 sem), totale (< 1 sem, deadlines dépassées comprises).

function joursRestants(tache) {
  return Math.round((dateDeadline(tache) - AUJOURDHUI) / 86400000);
}

function niveauUrgence(jours) {
  if (jours <= 7)  return 'Totale';
  if (jours <= 14) return 'Grave';
  if (jours <= 30) return 'Moyenne';
  return 'Faible';
}

// Position horizontale du pin en % (0 = gauche, 100 = droite).
// Chaque zone occupe un quart de l'axe ; le pin avance à l'intérieur
// de sa zone à mesure que la deadline approche.
function positionX(jours) {
  if (jours <= 0)  return 98;                                  // dépassée
  if (jours <= 7)  return 75 + ((7 - jours) / 7) * 23;         // totale  75→98
  if (jours <= 14) return 50 + ((14 - jours) / 7) * 25;        // grave   50→75
  if (jours <= 30) return 25 + ((30 - jours) / 16) * 25;       // moyenne 25→50
  return Math.max(2, 25 - ((jours - 30) / 60) * 23);           // faible  25→2
}

// ---- Petits utilitaires -------------------------------------------------

const $ = (sel) => document.querySelector(sel);

const FORMAT_DATE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' });

function societeDe(tache) {
  return SOCIETES.find((s) => s.id === tache.societe);
}

// ---- Ordre des sociétés ---------------------------------------------------
// Chaque société porte un rang « ordre » (0, 1, 2…) fixé quand on les range à
// la main dans le panneau. Celles qui n'en ont pas encore restent en queue,
// dans leur ordre d'arrivée. Ce même ordre sert partout : panneau Sociétés et
// liste déroulante de la fenêtre de tâche.

function rangSociete(societe) {
  return Number.isFinite(societe.ordre) ? societe.ordre : Number.MAX_SAFE_INTEGER;
}

function trierSocietes(liste) {
  return liste.slice().sort((a, b) => rangSociete(a) - rangSociete(b));   // tri stable
}

// rang à donner à une nouvelle société : après toutes les autres — ou aucun
// rang tant que personne n'a encore rangé la liste (sinon elle passerait devant)
function ordrePourNouvelleSociete() {
  const rangs = Stockage.societes.map((s) => s.ordre).filter(Number.isFinite);
  return rangs.length ? Math.max(...rangs) + 1 : undefined;
}

function societesCochees() {
  const cochees = new Set();
  document.querySelectorAll('.societe-case:checked')
    .forEach((case_) => cochees.add(case_.dataset.societe));
  return cochees;
}

// ---- Rendu : panneau Sociétés -------------------------------------------

function afficherSocietes() {
  const liste = $('#liste-societes');
  // pendant un glisser-déposer, on ne touche pas à la liste : elle sera
  // redessinée au relâchement
  if (reordonnancementEnCours) return;
  // conserve l'état des cases avant de redessiner (nouvelle société : cochée)
  const cases = document.querySelectorAll('.societe-case');
  const decochees = new Set();
  cases.forEach((c) => { if (!c.checked) decochees.add(c.dataset.societe); });

  liste.innerHTML = '';
  for (const societe of SOCIETES) {
    const li = document.createElement('li');
    li.className = 'societe';
    li.dataset.id = societe.id;
    li.innerHTML = `
      <label class="societe-label">
        <input class="societe-case" type="checkbox" data-societe="${societe.id}">
        <span class="pastille" style="--couleur:${societe.couleur}"></span>
      </label>
      <button class="societe-modifier" type="button" aria-label="Modifier ou supprimer la société">
        <svg viewBox="0 0 24 24" width="14" height="14" aria-hidden="true">
          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"
                fill="none" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>`;
    li.querySelector('.societe-case').checked = !decochees.has(societe.id);
    li.querySelector('.societe-label').append(societe.nom);
    liste.appendChild(li);
  }
}

// ---- Tri de la liste « Tâches à réaliser » --------------------------------
// Par défaut par urgence (deadline la plus proche en tête) ; le choix
// Importance / Couleur (= ordre des sociétés du panneau) est mémorisé sur
// l'appareil.

const CLE_TRI = 'marktask.tri.v1';
const TRIS = ['urgence', 'importance', 'couleur'];
let triTaches = TRIS.includes(localStorage.getItem(CLE_TRI)) ? localStorage.getItem(CLE_TRI) : 'urgence';

function trierTaches(taches) {
  const parUrgence = (a, b) => String(a.deadline).localeCompare(String(b.deadline)) || b.importance - a.importance;
  const parImportance = (a, b) => b.importance - a.importance || parUrgence(a, b);
  const rangCouleur = (t) => { const i = SOCIETES.findIndex((s) => s.id === t.societe); return i === -1 ? 1e9 : i; };
  const parCouleur = (a, b) => (rangCouleur(a) - rangCouleur(b)) || parUrgence(a, b);
  const comparer = triTaches === 'importance' ? parImportance : triTaches === 'couleur' ? parCouleur : parUrgence;
  return taches.slice().sort(comparer);
}

function choisirTri(tri) {
  triTaches = tri;
  try { localStorage.setItem(CLE_TRI, tri); } catch (_) { /* pas grave */ }
  document.querySelectorAll('.btn-tri').forEach((b) => {
    b.setAttribute('aria-pressed', String(b.dataset.tri === tri));
  });
  afficherTaches();
}

// ---- Rendu : liste « Tâches à réaliser » --------------------------------

// tâches dépliées dans la liste (l'état survit aux redessins/synchronisations)
const tachesDepliees = new Set();

function afficherTaches() {
  const liste = $('#liste-taches');
  liste.innerHTML = '';

  const aFaire = TACHES.filter((t) => !t.faite);
  if (!aFaire.length) {
    const li = document.createElement('li');
    li.className = 'liste-vide';
    li.textContent = 'Aucune tâche pour l\'instant — clique sur « + Nouvelle tâche » pour commencer.';
    liste.appendChild(li);
    return;
  }

  for (const tache of trierTaches(aFaire)) {
    const societe = societeDe(tache);
    const jours = joursRestants(tache);
    const li = document.createElement('li');
    li.className = 'tache';
    li.dataset.id = tache.id;
    li.style.setProperty('--couleur', societe ? societe.couleur : '');
    // même mécanisme natif que le panneau « Tâches à réaliser » lui-même :
    // l'intitulé est la poignée, le navigateur gère l'ouverture/fermeture
    li.innerHTML = `
      <details class="tache-details">
        <summary class="tache-resume">
          <span class="chevron" aria-hidden="true"></span>
          <span class="tache-nom"></span>
        </summary>
        <div class="tache-detail">
          <span class="tache-detail-ligne tache-detail-societe"></span>
          <p class="tache-detail-desc"></p>
          <span class="tache-detail-ligne tache-detail-deadline"></span>
          <span class="tache-detail-ligne tache-detail-urgence"></span>
        </div>
      </details>
      <button class="tache-modifier" type="button" aria-label="Modifier ou supprimer la tâche">
        <svg viewBox="0 0 24 24" width="15" height="15" aria-hidden="true">
          <path d="M17 3a2.828 2.828 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5L17 3z"
                fill="none" stroke="currentColor" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </button>
      <input class="tache-case" type="checkbox" title="Marquer comme réalisée">`;
    li.querySelector('.tache-nom').textContent = tache.nom;
    li.querySelector('.tache-detail-societe').textContent = societe ? societe.nom : '?';

    const desc = li.querySelector('.tache-detail-desc');
    desc.textContent = tache.descriptif || '';
    desc.hidden = !tache.descriptif;
    li.querySelector('.tache-detail-deadline').textContent =
      `Échéance ${FORMAT_DATE.format(dateDeadline(tache))}` +
      (jours < 0 ? ` (dépassée de ${-jours} j)` : jours === 0 ? ' (aujourd\'hui)' : ` (dans ${jours} j)`);
    li.querySelector('.tache-detail-urgence').textContent =
      `Urgence ${niveauUrgence(jours).toLowerCase()} · importance ${tache.importance}/100`;

    // l'état ouvert/fermé survit aux redessins (synchronisations)
    const details = li.querySelector('.tache-details');
    details.open = tachesDepliees.has(tache.id);
    details.addEventListener('toggle', () => {
      if (details.open) tachesDepliees.add(tache.id);
      else tachesDepliees.delete(tache.id);
    });

    liste.appendChild(li);
  }
}

// ---- Rendu : pins du graphique ------------------------------------------

function afficherPins() {
  const zone = $('#graphique-zone');
  const cochees = societesCochees();

  // une fiche est-elle ouverte ? on la préservera à travers le redessin
  const ficheOuvertePour = $('#fiche').hidden ? null : ficheTacheId;
  const etaitEpinglee = Boolean(ficheEpinglee);

  zone.querySelectorAll('.pin').forEach((pin) => pin.remove());
  for (const tache of TACHES) {
    if (tache.faite || !cochees.has(tache.societe)) continue;
    const societe = societeDe(tache);
    const jours = joursRestants(tache);
    const pin = document.createElement('button');
    pin.type = 'button';
    pin.className = 'pin';
    pin.dataset.id = tache.id;
    pin.style.setProperty('--couleur', societe.couleur);
    pin.style.left = positionX(jours) + '%';
    pin.style.bottom = Math.min(97, Math.max(3, tache.importance)) + '%';
    pin.setAttribute('aria-label', tache.nom);
    zone.appendChild(pin);
  }

  // raccrocher la fiche au pin recréé — ou la fermer si la tâche a disparu
  if (ficheOuvertePour) {
    const pin = zone.querySelector(`.pin[data-id="${ficheOuvertePour}"]`);
    if (pin) {
      ficheEpinglee = etaitEpinglee ? pin : null;
      montrerFiche(pin);
    } else {
      ficheEpinglee = null;
      cacherFiche();
    }
  }
}

// ---- États d'interaction -------------------------------------------------

const MOBILE = window.matchMedia('(max-width: 820px)');

let ficheEpinglee = null;       // pin « épinglé » par un appui (mobile)
let modePlacement = false;      // desktop : en attente d'un clic sur le graphe
let tacheEnEdition = null;      // id de la tâche en cours de modification
let clicSimpleEnAttente = null; // délai du simple clic, annulé par le double-clic
let tacheATerminer = null;      // id de la tâche visée par la confirmation de fin
let reordonnancementEnCours = false; // une société est en train d'être déplacée

// ---- Terminer une tâche (et fêter ça) ------------------------------------

function terminerTache(tache) {
  Stockage.majTache({
    ...tache,
    faite: true,
    realiseLe: new Date().toISOString().slice(0, 10),
  });
  celebrer();
}

function celebrer() {
  const fete = $('#celebration');
  const coche = fete.querySelector('.coche');
  const trait = fete.querySelector('.coche-trait');
  clearTimeout(celebrer.minuteur);

  // 1) AFFICHER, d'abord et sans condition : quoi qu'il arrive ensuite,
  //    la coche est à l'écran
  fete.hidden = false;
  fete.style.opacity = '1';

  // 2) puis tenter d'animer (sauf si l'utilisateur préfère éviter le mouvement) ;
  //    si l'animation échoue, on reste simplement sur l'affichage statique
  let animee = false;
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    try {
      for (const el of [fete, coche, trait]) {
        el.getAnimations().forEach((a) => a.cancel());
      }
      const voile = fete.animate(
        [{ opacity: 0 }, { opacity: 1, offset: 0.12 }, { opacity: 1, offset: 0.78 }, { opacity: 0 }],
        { duration: 1400, easing: 'ease', fill: 'forwards' }
      );
      coche.animate(
        [{ transform: 'scale(0.45)' }, { transform: 'scale(1)' }],
        { duration: 400, easing: 'cubic-bezier(0.2, 1.6, 0.4, 1)', fill: 'both' }
      );
      trait.animate(
        [{ strokeDashoffset: 130 }, { strokeDashoffset: 0 }],
        { duration: 450, delay: 100, easing: 'ease-out', fill: 'backwards' }
      );
      // l'animation du voile pilote l'opacité : on lui laisse la main
      fete.style.opacity = '';
      animee = Boolean(voile);
    } catch (_) {
      fete.style.opacity = '1';   // retour à l'affichage statique
    }
  }

  celebrer.minuteur = setTimeout(() => {
    fete.hidden = true;
    fete.style.opacity = '';
  }, animee ? 1500 : 1200);
}

// ---- Fiche de survol -----------------------------------------------------

function remplirFiche(tache) {
  const societe = societeDe(tache);
  const jours = joursRestants(tache);
  $('#fiche-nom').textContent = tache.nom;
  $('#fiche-desc').textContent = tache.descriptif;
  $('#fiche-pastille').style.setProperty('--couleur', societe.couleur);
  $('#fiche-societe').textContent = societe.nom;
  $('#fiche-deadline').textContent =
    `Échéance ${FORMAT_DATE.format(dateDeadline(tache))}` +
    (jours < 0 ? ` (dépassée de ${-jours} j)` : jours === 0 ? ' (aujourd\'hui)' : ` (dans ${jours} j)`);
  $('#fiche-urgence').textContent =
    `Urgence ${niveauUrgence(jours).toLowerCase()} · importance ${tache.importance}/100`;
}

let ficheTacheId = null;    // tâche actuellement affichée dans la fiche

function montrerFiche(pin) {
  const tache = TACHES.find((t) => t.id === pin.dataset.id);
  if (!tache) return;
  ficheTacheId = tache.id;
  remplirFiche(tache);

  const fiche = $('#fiche');
  fiche.hidden = false;
  // sur mobile la fiche doit recevoir les appuis (bouton Terminer) ;
  // sur desktop elle reste transparente à la souris pour ne pas gêner le survol
  fiche.style.pointerEvents = MOBILE.matches ? 'auto' : 'none';

  // position en pixels, avec rabattement : à droite du pin si la place existe,
  // sinon à gauche — et toujours ramenée entière dans le cadre du graphique.
  // La fiche ne doit JAMAIS recouvrir le pin : sur téléphone elle est
  // interactive, et posée sous le doigt elle avalerait l'appui suivant
  // (et se refermait aussitôt via les événements souris synthétisés).
  const zone = $('#graphique-zone');
  const largeurZone = zone.clientWidth;
  const hauteurZone = zone.clientHeight;
  const pinX = (parseFloat(pin.style.left) / 100) * largeurZone;
  const pinY = (parseFloat(pin.style.bottom) / 100) * hauteurZone;
  const marge = 6;
  // espace entre le centre du pin et le bord de la fiche : le pin appuyé est
  // grossi (scale 1.35 → 13,5 px de demi-hauteur), la fiche reste au-delà
  const ecart = 18;
  const largeurFiche = fiche.offsetWidth;

  let gauche = pinX + 18;
  if (gauche + largeurFiche > largeurZone - marge) gauche = pinX - largeurFiche - 18;
  gauche = Math.max(marge, Math.min(gauche, largeurZone - largeurFiche - marge));

  // à la verticale : au-dessus du pin, sinon en dessous. Si aucun des deux
  // côtés ne suffit (pin au milieu, longue description), la description est
  // raccourcie — elle défile alors en interne — jusqu'à ce que la fiche
  // tienne du côté le plus spacieux ; et s'il en faut encore, la fiche
  // déborde un peu au-dessus du cadre (l'espace libre en haut de la carte)
  // plutôt que de recouvrir le pin.
  const desc = $('#fiche-desc');
  desc.style.maxHeight = '';
  const placeDessus = hauteurZone - marge - (pinY + ecart);
  const placeDessous = pinY - ecart - marge;
  // hauteurs mesurées en fractionnaire (getBoundingClientRect) : offsetHeight
  // arrondit, et un pixel de trop ferait basculer la fiche du mauvais côté
  let hauteurFiche = fiche.getBoundingClientRect().height;
  const place = Math.max(placeDessus, placeDessous);
  if (hauteurFiche > place && !desc.hidden) {
    // d'abord en gardant au moins deux lignes de description…
    desc.style.maxHeight =
      Math.max(42, desc.getBoundingClientRect().height - (hauteurFiche - place) - 2) + 'px';
    hauteurFiche = fiche.getBoundingClientRect().height;
    // …et s'il manque encore quelques pixels, une seule ligne
    if (hauteurFiche > place) {
      desc.style.maxHeight =
        Math.max(22, parseFloat(desc.style.maxHeight) - (hauteurFiche - place) - 2) + 'px';
      hauteurFiche = fiche.getBoundingClientRect().height;
    }
  }
  let bas;
  if (hauteurFiche <= placeDessus)       bas = pinY + ecart;                 // au-dessus
  else if (hauteurFiche <= placeDessous) bas = pinY - ecart - hauteurFiche;  // en dessous
  else bas = pinY + ecart;   // déborde du cadre en haut, mais jamais sur le pin

  fiche.style.right = 'auto';
  fiche.style.top = 'auto';
  fiche.style.left = gauche + 'px';
  fiche.style.bottom = bas + 'px';

  surligner(tache.id, true);
}

function cacherFiche() {
  $('#fiche').hidden = true;
  surligner(null, false);
}

function modifierDepuisFiche() {
  const tache = TACHES.find((t) => t.id === ficheTacheId);
  if (!tache) return;
  ficheEpinglee = null;
  cacherFiche();
  ouvrirDialogueTache(tache);
}

function proposerTerminerDepuisFiche() {
  const tache = TACHES.find((t) => t.id === ficheTacheId);
  if (!tache) return;
  ficheEpinglee = null;
  cacherFiche();
  tacheATerminer = tache.id;
  $('#terminer-question').textContent = `Terminer la tâche « ${tache.nom} » ?`;
  const dialogue = $('#dialogue-terminer');
  if (!dialogue.open) dialogue.showModal();
}

function surligner(id, actif) {
  document.querySelectorAll('#liste-taches .tache').forEach((li) => {
    const surbrillance = actif && li.dataset.id === id;
    li.classList.toggle('tache-surbrillance', surbrillance);
    // desktop : amener la ligne en vue DANS la liste (qui défile en interne).
    // mobile : surtout pas — la liste vit dans la page, ce défilement
    // emporterait tout l'écran vers le bas.
    if (surbrillance && !MOBILE.matches) li.scrollIntoView({ block: 'nearest' });
  });
}

// ---- Événements ----------------------------------------------------------

function brancherEvenements() {
  const zone = $('#graphique-zone');

  // souris et clavier : survol / focus d'un pin — ordinateur seulement.
  // Sur téléphone, le navigateur rejoue des événements souris et focus autour
  // de l'appui : la fiche apparaissait sous le doigt et le mouseout/focusout
  // qui suivait la refermait aussitôt, avant que le clic ne l'épingle.
  // Au doigt, seul l'appui (le clic, plus bas) pilote la fiche.
  zone.addEventListener('mouseover', (e) => {
    if (MOBILE.matches) return;
    const pin = e.target.closest('.pin');
    if (pin) montrerFiche(pin);
  });
  zone.addEventListener('mouseout', (e) => {
    if (MOBILE.matches) return;
    if (e.target.closest('.pin') && !ficheEpinglee) cacherFiche();
  });
  zone.addEventListener('focusin', (e) => {
    if (MOBILE.matches) return;
    const pin = e.target.closest('.pin');
    if (pin) montrerFiche(pin);
  });
  zone.addEventListener('focusout', (e) => {
    if (MOBILE.matches) return;
    if (e.target.closest('.pin') && !ficheEpinglee) cacherFiche();
  });

  // une fenêtre qui se ferme peut rendre le focus à un pin : pas de fiche fantôme
  for (const dialogue of ['#dialogue-tache', '#dialogue-terminer']) {
    $(dialogue).addEventListener('close', () => {
      if (document.activeElement && document.activeElement.classList.contains('pin')) {
        document.activeElement.blur();
      }
      ficheEpinglee = null;
      cacherFiche();
    });
  }

  zone.addEventListener('click', (e) => {
    // mode placement (desktop) : le clic fixe l'importance de la nouvelle tâche
    if (modePlacement) {
      const rect = zone.getBoundingClientRect();
      const importance = Math.round((1 - (e.clientY - rect.top) / rect.height) * 100);
      quitterPlacement();
      ouvrirDialogueTache(null, Math.max(0, Math.min(100, importance)));
      return;
    }

    const pin = e.target.closest('.pin');
    if (!pin) return;
    const tache = TACHES.find((t) => t.id === pin.dataset.id);

    if (!MOBILE.matches) {
      // desktop : un clic ouvre la modification — avec un léger délai pour
      // laisser sa chance au double-clic (= terminer la tâche)
      clearTimeout(clicSimpleEnAttente);
      clicSimpleEnAttente = setTimeout(() => {
        cacherFiche();
        ouvrirDialogueTache(tache);
      }, 280);
      return;
    }

    // mobile : premier appui = fiche, second appui sur le même pin = modification
    if (ficheEpinglee === pin) {
      ficheEpinglee = null;
      cacherFiche();
      ouvrirDialogueTache(tache);
    } else {
      ficheEpinglee = pin;
      montrerFiche(pin);
    }
  });

  // double-clic sur un pin (desktop) : proposer de terminer la tâche
  zone.addEventListener('dblclick', (e) => {
    if (MOBILE.matches || modePlacement) return;
    const pin = e.target.closest('.pin');
    if (!pin) return;
    clearTimeout(clicSimpleEnAttente);
    const tache = TACHES.find((t) => t.id === pin.dataset.id);
    if (!tache) return;
    cacherFiche();
    tacheATerminer = tache.id;
    $('#terminer-question').textContent = `Terminer la tâche « ${tache.nom} » ?`;
    $('#dialogue-terminer').showModal();
  });

  // la fenêtre de confirmation de fin de tâche
  $('#terminer-annuler').addEventListener('click', () => $('#dialogue-terminer').close());
  $('#terminer-confirmer').addEventListener('click', () => {
    const tache = TACHES.find((t) => t.id === tacheATerminer);
    tacheATerminer = null;
    $('#dialogue-terminer').close();
    if (tache) terminerTache(tache);
  });

  // Échap annule le mode placement
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modePlacement) quitterPlacement();
  });

  // un appui ailleurs referme la fiche épinglée (mais pas un appui sur la fiche)
  document.addEventListener('click', (e) => {
    if (ficheEpinglee && !e.target.closest('.pin') && !e.target.closest('.fiche')) {
      ficheEpinglee = null;
      cacherFiche();
    }
  });

  // bouton Terminer de la fiche (mobile) : demande confirmation.
  // Double branchement clic + toucher : certains navigateurs mobiles ne
  // transforment pas un appui sur un élément apparu dynamiquement en clic.
  $('#fiche-terminer').addEventListener('click', proposerTerminerDepuisFiche);
  $('#fiche-terminer').addEventListener('touchend', (e) => {
    e.preventDefault();
    proposerTerminerDepuisFiche();
  });

  // crayon de la fiche (mobile) : ouvre la modification de la tâche
  $('#fiche-modifier').addEventListener('click', modifierDepuisFiche);
  $('#fiche-modifier').addEventListener('touchend', (e) => {
    e.preventDefault();
    modifierDepuisFiche();
  });

  // cocher une tâche : confirmation d'abord, puis elle part dans
  // « Tâches réalisées » (la case est décochée en attendant la réponse)
  $('#liste-taches').addEventListener('change', (e) => {
    const li = e.target.closest('.tache');
    if (!li || !e.target.classList.contains('tache-case')) return;
    const tache = TACHES.find((t) => t.id === li.dataset.id);
    if (!tache) return;
    e.target.checked = false;
    tacheATerminer = tache.id;
    $('#terminer-question').textContent = `Terminer la tâche « ${tache.nom} » ?`;
    $('#dialogue-terminer').showModal();
  });

  // crayon en bout de ligne d'une tâche : volet Modifier / Supprimer
  $('#liste-taches').addEventListener('click', (e) => {
    const bouton = e.target.closest('.tache-modifier');
    if (!bouton) return;
    const tache = TACHES.find((t) => t.id === bouton.closest('.tache').dataset.id);
    if (tache) ouvrirChoixTache(tache);
  });

  // crayon en bout de ligne d'une société : volet Modifier / Supprimer
  $('#liste-societes').addEventListener('click', (e) => {
    const bouton = e.target.closest('.societe-modifier');
    if (!bouton) return;
    const societe = SOCIETES.find((s) => s.id === bouton.closest('.societe').dataset.id);
    if (societe) ouvrirChoixSociete(societe);
  });

  // sociétés : glisser-déposer pour les ranger (ordinateur : cliquer-glisser ;
  // téléphone : appui long puis glisser — l'appui long sans bouger ouvre
  // toujours le volet Modifier / Supprimer)
  brancherReordonnancement($('#liste-societes'));

  // appui long (mobile) sur une tâche : volet Modifier / Supprimer
  brancherAppuiLong($('#liste-taches'), '.tache', (li) => {
    const tache = TACHES.find((t) => t.id === li.dataset.id);
    if (tache) ouvrirChoixTache(tache);
  });

  // les boutons du volet Modifier / Supprimer
  $('#choix-fermer').addEventListener('click', () => $('#dialogue-choix').close());
  $('#choix-modifier').addEventListener('click', () => executerChoix('modifier'));
  $('#choix-supprimer').addEventListener('click', () => executerChoix('supprimer'));

  // tri de la liste des tâches
  document.querySelectorAll('.btn-tri').forEach((b) => {
    b.addEventListener('click', () => choisirTri(b.dataset.tri));
  });
  choisirTri(triTaches);

  // filtre par société
  $('#liste-societes').addEventListener('change', afficherPins);
  $('#btn-tout-cocher').addEventListener('click', () => cocherTout(true));
  $('#btn-tout-decocher').addEventListener('click', () => cocherTout(false));

  // ajout d'une société (l'appui long sur sa ligne ouvre la modification)
  $('#btn-nouvelle-societe').addEventListener('click', () => ouvrirDialogueSociete(null));
  $('#societe-annuler').addEventListener('click', () => $('#dialogue-societe').close());
  $('#formulaire-societe').addEventListener('submit', validerSociete);

  // ajout d'une tâche : on vise d'abord le graphe (ordinateur comme téléphone),
  // le clic/appui sur le graphe fixe l'importance
  $('#btn-nouvelle-tache').addEventListener('click', () => {
    if (modePlacement) { quitterPlacement(); return; }
    if (!SOCIETES.length) {
      demanderConfirmation({
        titre: 'Aucune société',
        question: 'Veuillez d\'abord créer une société avec le bouton « + Nouvelle société » : chaque tâche est rattachée à une société.',
        bouton: 'OK',
      });
      return;
    }
    entrerPlacement();
  });
  $('#tache-fermer').addEventListener('click', () => $('#dialogue-tache').close());
  $('#formulaire-tache').addEventListener('submit', validerTache);
  $('#tache-supprimer').addEventListener('click', supprimerTacheEnEdition);
  brancherSelecteurSociete();
  $('#tache-importance').addEventListener('input', (e) => {
    $('#tache-importance-valeur').textContent = e.target.value;
  });
}

// ---- Mode placement (desktop) --------------------------------------------

function entrerPlacement() {
  modePlacement = true;
  $('#graphique-zone').classList.add('placement');
  $('#placement-aide').hidden = false;
  cacherFiche();
}

function quitterPlacement() {
  modePlacement = false;
  $('#graphique-zone').classList.remove('placement');
  $('#placement-aide').hidden = true;
}

// ---- Création et modification d'une tâche --------------------------------

// tache = null → création (importanceInitiale : valeur issue du clic sur le graphe)
// tache fournie → modification
function ouvrirDialogueTache(tache, importanceInitiale) {
  tacheEnEdition = tache ? tache.id : null;
  const erreur = $('#tache-erreur');
  erreur.hidden = true;

  // la liste déroulante des sociétés reflète le panneau (mêmes pastilles, même ordre)
  remplirSelecteurSociete(tache ? tache.societe : null);

  $('#tache-dialogue-titre').textContent = tache ? 'Modifier la tâche' : 'Nouvelle tâche';
  $('#tache-valider').textContent = tache ? 'Enregistrer' : 'Ajouter';
  $('#tache-supprimer').hidden = !tache;

  const importance = tache ? tache.importance : (importanceInitiale ?? 50);
  $('#tache-nom').value = tache ? tache.nom : '';
  $('#tache-desc').value = tache ? tache.descriptif : '';
  $('#tache-deadline').value = tache ? tache.deadline : '';
  // en création, pas de deadline passée ; en modification, on ne bloque pas l'existante
  $('#tache-deadline').min = tache ? '' : AUJOURDHUI.toISOString().slice(0, 10);
  $('#tache-importance').value = importance;
  $('#tache-importance-valeur').textContent = importance;
  if (!$('#dialogue-tache').open) $('#dialogue-tache').showModal();

  if (!SOCIETES.length) {
    erreur.textContent = 'Veuillez d\'abord créer une société (bouton « + Nouvelle société » du dashboard).';
    erreur.hidden = false;
  }
}

// ---- Liste déroulante des sociétés (fenêtre de tâche) --------------------
// Une liste maison plutôt qu'un <select> natif : elle affiche la pastille de
// couleur de chaque société, dans l'ordre exact du panneau Sociétés.

function remplirSelecteurSociete(idChoisi) {
  const options = $('#tache-societe-options');
  options.innerHTML = '';
  for (const societe of SOCIETES) {
    const li = document.createElement('li');
    li.innerHTML = `
      <button class="selecteur-option" type="button" role="option">
        <span class="pastille"></span>
        <span class="selecteur-texte"></span>
      </button>`;
    const bouton = li.querySelector('.selecteur-option');
    bouton.dataset.id = societe.id;
    bouton.querySelector('.pastille').style.setProperty('--couleur', societe.couleur);
    bouton.querySelector('.selecteur-texte').textContent = societe.nom;
    options.appendChild(li);
  }
  const existe = SOCIETES.some((s) => s.id === idChoisi);
  choisirSociete(existe ? idChoisi : (SOCIETES[0] ? SOCIETES[0].id : ''));
  $('#tache-societe').open = false;
}

function choisirSociete(id) {
  const selecteur = $('#tache-societe');
  const societe = SOCIETES.find((s) => s.id === id);
  selecteur.dataset.value = societe ? societe.id : '';
  $('#tache-societe-pastille').style.setProperty('--couleur', societe ? societe.couleur : 'transparent');
  $('#tache-societe-texte').textContent = societe ? societe.nom : 'Aucune société';
  selecteur.querySelectorAll('.selecteur-option').forEach((bouton) => {
    bouton.classList.toggle('selecteur-option-active', bouton.dataset.id === selecteur.dataset.value);
    bouton.setAttribute('aria-selected', bouton.dataset.id === selecteur.dataset.value);
  });
}

function brancherSelecteurSociete() {
  const selecteur = $('#tache-societe');
  const dialogue = $('#dialogue-tache');

  $('#tache-societe-options').addEventListener('click', (e) => {
    const bouton = e.target.closest('.selecteur-option');
    if (!bouton) return;
    choisirSociete(bouton.dataset.id);
    selecteur.open = false;
    selecteur.querySelector('summary').focus();
  });

  // un clic ailleurs dans la fenêtre referme la liste
  dialogue.addEventListener('click', (e) => {
    if (selecteur.open && !e.target.closest('#tache-societe')) selecteur.open = false;
  });

  // Échap referme d'abord la liste, pas toute la fenêtre
  dialogue.addEventListener('cancel', (e) => {
    if (selecteur.open) { e.preventDefault(); selecteur.open = false; }
  });
}

function validerTache(e) {
  e.preventDefault();
  const erreur = $('#tache-erreur');
  const nom = $('#tache-nom').value.trim();
  const deadline = $('#tache-deadline').value;
  const societe = $('#tache-societe').dataset.value || '';

  const probleme =
    !SOCIETES.length ? 'Veuillez d\'abord créer une société (bouton « + Nouvelle société » du dashboard).' :
    !nom             ? 'Veuillez donner un nom à la tâche.' :
    !deadline        ? 'Veuillez choisir une deadline.' :
    !societe         ? 'Veuillez choisir la société concernée.' :
    // en création seulement : pas de deadline déjà passée (en modification,
    // on laisse l'existante même dépassée)
    (!tacheEnEdition && deadline < AUJOURDHUI.toISOString().slice(0, 10))
                     ? 'Veuillez choisir une deadline à partir d\'aujourd\'hui.' : null;

  if (probleme) {
    erreur.textContent = probleme;
    erreur.hidden = false;
    return;
  }

  const champs = {
    nom,
    descriptif: $('#tache-desc').value.trim(),
    deadline,
    societe,
    importance: Number($('#tache-importance').value),
  };

  if (tacheEnEdition) {
    const tache = TACHES.find((t) => t.id === tacheEnEdition);
    Stockage.majTache({ ...tache, ...champs });
  } else {
    Stockage.creerTache({ id: crypto.randomUUID(), ...champs });
  }

  tacheEnEdition = null;
  $('#dialogue-tache').close();
}

function supprimerTacheEnEdition() {
  if (!tacheEnEdition) return;
  const id = tacheEnEdition;
  demanderConfirmation({
    titre: 'Supprimer la tâche',
    question: 'Supprimer définitivement cette tâche ?',
    bouton: 'Supprimer',
  }, () => {
    Stockage.supprimerTache(id);
    tacheEnEdition = null;
    $('#dialogue-tache').close();
  });
}

// ---- Volet Modifier / Supprimer (mobile : appui long ou crayon) ----------

let choixActions = null;   // actions { modifier, supprimer } du volet ouvert

function ouvrirChoix(titre, actions) {
  choixActions = actions;
  $('#choix-titre').textContent = titre;
  $('#dialogue-choix').showModal();
}

function executerChoix(nom) {
  const action = choixActions && choixActions[nom];
  choixActions = null;
  $('#dialogue-choix').close();
  if (action) action();
}

function ouvrirChoixTache(tache) {
  ouvrirChoix(`Tâche « ${tache.nom} »`, {
    modifier: () => ouvrirDialogueTache(tache),
    supprimer: () => demanderConfirmation({
      titre: 'Supprimer la tâche',
      question: `Supprimer définitivement la tâche « ${tache.nom} » ?`,
      bouton: 'Supprimer',
    }, () => Stockage.supprimerTache(tache.id)),
  });
}

function ouvrirChoixSociete(societe) {
  ouvrirChoix(`Société « ${societe.nom} »`, {
    modifier: () => ouvrirDialogueSociete(societe),
    supprimer: () => supprimerSociete(societe),
  });
}

// Détection de l'appui long (une demi-seconde) sur une ligne d'une liste.
// Mobile uniquement ; un appui long consommé ne doit pas aussi agir comme un
// clic (cocher une case, déplier une tâche…).
function brancherAppuiLong(liste, selecteur, action) {
  let minuteur = null;
  let depart = null;
  let consomme = false;

  liste.addEventListener('pointerdown', (e) => {
    if (!MOBILE.matches) return;
    const element = e.target.closest(selecteur);
    if (!element) return;
    depart = { x: e.clientX, y: e.clientY };
    clearTimeout(minuteur);
    minuteur = setTimeout(() => {
      minuteur = null;
      consomme = true;
      action(element);
    }, 500);
  });

  const abandonner = () => {
    clearTimeout(minuteur);
    minuteur = null;
    // le clic à étouffer suit immédiatement le relâchement ; s'il ne vient
    // jamais, le fusible se désarme tout seul juste après
    if (consomme) setTimeout(() => { consomme = false; }, 400);
  };
  liste.addEventListener('pointerup', abandonner);
  liste.addEventListener('pointercancel', abandonner);   // ex. la liste défile
  liste.addEventListener('pointermove', (e) => {
    if (minuteur && depart &&
        Math.hypot(e.clientX - depart.x, e.clientY - depart.y) > 12) abandonner();
  });

  // pas de menu contextuel natif par-dessus notre volet
  liste.addEventListener('contextmenu', (e) => {
    if (MOBILE.matches) e.preventDefault();
  });

  liste.addEventListener('click', (e) => {
    if (!consomme) return;
    consomme = false;
    e.preventDefault();
    e.stopPropagation();
  }, true);
}

// ---- Ranger les sociétés par glisser-déposer -----------------------------
// Ordinateur : on clique sur une ligne et, sans relâcher, on la déplace.
// Téléphone : appui long (une demi-seconde) → la ligne « se soulève », puis on
// la fait glisser ; relâcher sans avoir bougé ouvre le volet Modifier /
// Supprimer, comme avant. L'ordre obtenu est enregistré (champ « ordre ») et
// vaut pour tous les appareils.
function brancherReordonnancement(liste) {
  let ligne = null;          // ligne suivie depuis le pointerdown
  let depart = null;         // position du pointeur au départ
  let minuteur = null;       // appui long (mobile)
  let ordreInitial = null;   // ids dans l'ordre avant le déplacement
  let aBouge = false;        // la ligne a-t-elle changé de place ?
  let etouffer = false;      // étouffer le clic qui suit un geste consommé

  const lignes = () => Array.from(liste.querySelectorAll('.societe'));

  const commencer = () => {
    reordonnancementEnCours = true;
    aBouge = false;
    ordreInitial = lignes().map((li) => li.dataset.id);
    ligne.classList.add('societe-deplacee');
    liste.classList.add('liste-reordonne');
    document.body.classList.add('reordonne');
    if (ligne.setPointerCapture && depart.pointerId !== undefined) {
      try { ligne.setPointerCapture(depart.pointerId); } catch (_) { /* pas grave */ }
    }
  };

  const deplacerVers = (y) => {
    // fait défiler la liste si le pointeur en frôle un bord
    const cadre = liste.getBoundingClientRect();
    if (y < cadre.top + 28) liste.scrollTop -= 8;
    else if (y > cadre.bottom - 28) liste.scrollTop += 8;

    // la ligne prend la place de la première ligne dont le milieu est sous le pointeur
    let cible = null;
    for (const autre of lignes()) {
      if (autre === ligne) continue;
      const rect = autre.getBoundingClientRect();
      if (y < rect.top + rect.height / 2) { cible = autre; break; }
    }
    if (cible ? ligne.nextElementSibling !== cible : ligne !== liste.lastElementChild) {
      if (cible) liste.insertBefore(ligne, cible);
      else liste.appendChild(ligne);
      aBouge = true;
    }
  };

  const enregistrer = () => {
    const ids = lignes().map((li) => li.dataset.id);
    if (ids.join() === ordreInitial.join()) return false;
    ids.forEach((id, index) => {
      const societe = SOCIETES.find((s) => s.id === id);
      if (societe && societe.ordre !== index) Stockage.majSociete({ ...societe, ordre: index });
    });
    return true;
  };

  const terminer = (annule) => {
    clearTimeout(minuteur);
    minuteur = null;
    if (!ligne) return;
    const li = ligne;
    const enCours = reordonnancementEnCours;
    ligne = null;
    depart = null;
    if (!enCours) return;

    reordonnancementEnCours = false;
    li.classList.remove('societe-deplacee');
    liste.classList.remove('liste-reordonne');
    document.body.classList.remove('reordonne');
    etouffer = true;
    setTimeout(() => { etouffer = false; }, 400);

    const modifie = !annule && enregistrer();
    // redessine depuis les données (un rafraîchissement a pu être ignoré
    // pendant le geste ; et si le geste est annulé, la liste reprend sa forme)
    if (!modifie) rafraichirTout();

    // téléphone : appui long sans bouger = volet Modifier / Supprimer
    if (!annule && !aBouge && MOBILE.matches) {
      const societe = SOCIETES.find((s) => s.id === li.dataset.id);
      if (societe) ouvrirChoixSociete(societe);
    }
  };

  liste.addEventListener('pointerdown', (e) => {
    if (e.button !== 0 && e.pointerType === 'mouse') return;
    if (e.target.closest('.societe-modifier')) return;   // le crayon reste un simple bouton
    const li = e.target.closest('.societe');
    if (!li) return;
    ligne = li;
    etouffer = false;    // le clic à étouffer, s'il devait venir, serait déjà passé
    depart = { x: e.clientX, y: e.clientY, pointerId: e.pointerId };
    clearTimeout(minuteur);
    if (MOBILE.matches) {
      // téléphone : la ligne se soulève après un appui long immobile
      minuteur = setTimeout(() => { minuteur = null; if (ligne) commencer(); }, 500);
    }
  });

  liste.addEventListener('pointermove', (e) => {
    if (!ligne || !depart) return;
    if (reordonnancementEnCours) { deplacerVers(e.clientY); return; }
    const distance = Math.hypot(e.clientX - depart.x, e.clientY - depart.y);
    if (MOBILE.matches) {
      // le doigt bouge avant l'appui long : c'est un défilement, pas un rangement
      if (distance > 12) terminer(true);
    } else if (distance > 5) {
      // ordinateur : le déplacement commence dès que la souris bouge, bouton enfoncé
      commencer();
      deplacerVers(e.clientY);
    }
  });

  liste.addEventListener('pointerup', () => terminer(false));
  liste.addEventListener('pointercancel', () => terminer(true));

  // pendant le geste, le doigt déplace la ligne : pas la page ni la liste
  liste.addEventListener('touchmove', (e) => {
    if (reordonnancementEnCours) e.preventDefault();
  }, { passive: false });

  // pas de menu contextuel natif pendant l'appui long
  liste.addEventListener('contextmenu', (e) => {
    if (MOBILE.matches || reordonnancementEnCours) e.preventDefault();
  });

  // un geste consommé ne doit pas aussi cocher/décocher la case de la ligne
  liste.addEventListener('click', (e) => {
    if (!etouffer) return;
    etouffer = false;
    e.preventDefault();
    e.stopPropagation();
  }, true);
}

// ---- Ajout, modification et suppression d'une société --------------------

let societeEnEdition = null;   // id de la société en cours de modification

// societe = null → création ; societe fournie → modification
function ouvrirDialogueSociete(societe) {
  societeEnEdition = societe ? societe.id : null;
  $('#societe-dialogue-titre').textContent = societe ? 'Modifier la société' : 'Nouvelle société';
  $('#societe-valider').textContent = societe ? 'Enregistrer' : 'Ajouter';
  $('#societe-nom').value = societe ? societe.nom : '';
  $('#societe-couleur').value = societe ? societe.couleur : couleurProposee();
  $('#societe-erreur').hidden = true;
  $('#dialogue-societe').showModal();
}

function validerSociete(e) {
  e.preventDefault();
  const nom = $('#societe-nom').value.trim();
  const erreur = $('#societe-erreur');

  if (!nom) {
    erreur.textContent = 'Veuillez donner un nom à la société.';
    erreur.hidden = false;
    return;
  }
  // le nom doit être libre, y compris parmi les sociétés clôturées : sinon,
  // restaurer l'ancienne créerait deux sociétés du même nom
  const homonyme = Stockage.societes.find(
    (s) => s.id !== societeEnEdition && s.nom.toLowerCase() === nom.toLowerCase()
  );
  if (homonyme) {
    erreur.textContent = homonyme.cloturee
      ? 'Une société clôturée porte déjà ce nom. Veuillez la restaurer depuis la page « Sociétés clôturées » du menu, ou choisir un autre nom.'
      : 'Cette société existe déjà dans la liste. Veuillez choisir un autre nom.';
    erreur.hidden = false;
    return;
  }

  const couleur = $('#societe-couleur').value;
  if (societeEnEdition) {
    const societe = SOCIETES.find((s) => s.id === societeEnEdition);
    Stockage.majSociete({ ...societe, nom, couleur });
  } else {
    const societe = { id: crypto.randomUUID(), nom, couleur };
    const ordre = ordrePourNouvelleSociete();
    if (ordre !== undefined) societe.ordre = ordre;
    Stockage.creerSociete(societe);
  }
  societeEnEdition = null;
  $('#dialogue-societe').close();
}

// « Supprimer » une société = la clôturer : elle part dans la page
// « Sociétés clôturées » et ses tâches encore à faire basculent dans
// « Tâches réalisées » (marquées clotureeAvecSociete pour pouvoir revenir
// toutes ensemble si la société est restaurée). La suppression définitive
// se fait depuis la page « Sociétés clôturées ».
function supprimerSociete(societe) {
  const ouvertes = TACHES.filter((t) => t.societe === societe.id && !t.faite);
  const question =
    `Supprimer la société « ${societe.nom} » ? Elle partira dans « Sociétés clôturées »` +
    (!ouvertes.length      ? '.' :
     ouvertes.length === 1 ? ' et sa tâche dans « Tâches réalisées ».' :
     ` et ses ${ouvertes.length} tâches dans « Tâches réalisées ».`);
  demanderConfirmation({
    titre: 'Supprimer la société',
    question,
    bouton: 'Supprimer',
  }, () => {
    const aujourdhui = new Date().toISOString().slice(0, 10);
    for (const tache of ouvertes) {
      Stockage.majTache({ ...tache, faite: true, realiseLe: aujourdhui, clotureeAvecSociete: true });
    }
    Stockage.majSociete({ ...societe, cloturee: true, clotureeLe: aujourdhui });
  });
}

function cocherTout(etat) {
  document.querySelectorAll('.societe-case')
    .forEach((case_) => { case_.checked = etat; });
  afficherPins();
}

// ---- Démarrage -----------------------------------------------------------

function rafraichirTout() {
  // les sociétés clôturées vivent sur leur propre page, pas sur le dashboard
  SOCIETES = trierSocietes(Stockage.societes.filter((s) => !s.cloturee));
  TACHES = Stockage.taches;
  afficherSocietes();
  afficherTaches();
  afficherPins();
}

brancherEvenements();
Stockage.init(rafraichirTout);
