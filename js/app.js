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

function societesCochees() {
  const cochees = new Set();
  document.querySelectorAll('.societe-case:checked')
    .forEach((case_) => cochees.add(case_.dataset.societe));
  return cochees;
}

// ---- Rendu : panneau Sociétés -------------------------------------------

function afficherSocietes() {
  const liste = $('#liste-societes');
  // conserve l'état des cases avant de redessiner (nouvelle société : cochée)
  const cases = document.querySelectorAll('.societe-case');
  const decochees = new Set();
  cases.forEach((c) => { if (!c.checked) decochees.add(c.dataset.societe); });

  liste.innerHTML = '';
  for (const societe of SOCIETES) {
    const li = document.createElement('li');
    li.className = 'societe';
    li.innerHTML = `
      <label class="societe-label">
        <input class="societe-case" type="checkbox" data-societe="${societe.id}">
        <span class="pastille" style="--couleur:${societe.couleur}"></span>
      </label>`;
    li.querySelector('.societe-case').checked = !decochees.has(societe.id);
    li.querySelector('.societe-label').append(societe.nom);
    liste.appendChild(li);
  }
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

  const ordonnees = aFaire.sort((a, b) => a.deadline.localeCompare(b.deadline));
  for (const tache of ordonnees) {
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
  // sinon à gauche — et toujours ramenée entière dans le cadre du graphique
  const zone = $('#graphique-zone');
  const largeurZone = zone.clientWidth;
  const hauteurZone = zone.clientHeight;
  const pinX = (parseFloat(pin.style.left) / 100) * largeurZone;
  const pinY = (parseFloat(pin.style.bottom) / 100) * hauteurZone;
  const marge = 6;
  const largeurFiche = fiche.offsetWidth;
  const hauteurFiche = fiche.offsetHeight;

  let gauche = pinX + 18;
  if (gauche + largeurFiche > largeurZone - marge) gauche = pinX - largeurFiche - 18;
  gauche = Math.max(marge, Math.min(gauche, largeurZone - largeurFiche - marge));

  let bas = pinY + 14;
  if (bas + hauteurFiche > hauteurZone - marge) bas = pinY - hauteurFiche - 14;
  bas = Math.max(marge, Math.min(bas, hauteurZone - hauteurFiche - marge));

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

  // souris : survol d'un pin
  zone.addEventListener('mouseover', (e) => {
    const pin = e.target.closest('.pin');
    if (pin) montrerFiche(pin);
  });
  zone.addEventListener('mouseout', (e) => {
    if (e.target.closest('.pin') && !ficheEpinglee) cacherFiche();
  });

  // clavier et téléphone : focus / appui sur un pin
  zone.addEventListener('focusin', (e) => {
    const pin = e.target.closest('.pin');
    if (pin) montrerFiche(pin);
  });
  zone.addEventListener('focusout', (e) => {
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

  // cocher une tâche : elle part dans « Tâches réalisées »
  $('#liste-taches').addEventListener('change', (e) => {
    const li = e.target.closest('.tache');
    if (!li || !e.target.classList.contains('tache-case')) return;
    const tache = TACHES.find((t) => t.id === li.dataset.id);
    if (tache) terminerTache(tache);
  });

  // filtre par société
  $('#liste-societes').addEventListener('change', afficherPins);
  $('#btn-tout-cocher').addEventListener('click', () => cocherTout(true));
  $('#btn-tout-decocher').addEventListener('click', () => cocherTout(false));

  // ajout d'une société
  $('#btn-nouvelle-societe').addEventListener('click', ouvrirDialogueSociete);
  $('#societe-annuler').addEventListener('click', () => $('#dialogue-societe').close());
  $('#formulaire-societe').addEventListener('submit', validerNouvelleSociete);

  // ajout d'une tâche : on vise d'abord le graphe (ordinateur comme téléphone),
  // le clic/appui sur le graphe fixe l'importance
  $('#btn-nouvelle-tache').addEventListener('click', () => {
    if (modePlacement) { quitterPlacement(); return; }
    entrerPlacement();
  });
  $('#tache-annuler').addEventListener('click', () => $('#dialogue-tache').close());
  $('#formulaire-tache').addEventListener('submit', validerTache);
  $('#tache-supprimer').addEventListener('click', supprimerTacheEnEdition);
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

  // la liste déroulante des sociétés reflète le panneau
  const select = $('#tache-societe');
  select.innerHTML = '';
  for (const societe of SOCIETES) {
    const option = document.createElement('option');
    option.value = societe.id;
    option.textContent = societe.nom;
    select.appendChild(option);
  }

  $('#tache-dialogue-titre').textContent = tache ? 'Modifier la tâche' : 'Nouvelle tâche';
  $('#tache-valider').textContent = tache ? 'Enregistrer' : 'Ajouter';
  $('#tache-supprimer').hidden = !tache;

  const importance = tache ? tache.importance : (importanceInitiale ?? 50);
  $('#tache-nom').value = tache ? tache.nom : '';
  $('#tache-desc').value = tache ? tache.descriptif : '';
  $('#tache-deadline').value = tache ? tache.deadline : '';
  // en création, pas de deadline passée ; en modification, on ne bloque pas l'existante
  $('#tache-deadline').min = tache ? '' : AUJOURDHUI.toISOString().slice(0, 10);
  if (tache) select.value = tache.societe;
  $('#tache-importance').value = importance;
  $('#tache-importance-valeur').textContent = importance;
  $('#dialogue-tache').showModal();

  if (!SOCIETES.length) {
    erreur.textContent = 'Crée d\'abord une société (bouton « + Nouvelle société » du dashboard).';
    erreur.hidden = false;
  }
}

function validerTache(e) {
  e.preventDefault();
  const erreur = $('#tache-erreur');
  const nom = $('#tache-nom').value.trim();
  const deadline = $('#tache-deadline').value;
  const societe = $('#tache-societe').value;

  const probleme =
    !SOCIETES.length ? 'Crée d\'abord une société (bouton « + Nouvelle société » du dashboard).' :
    !nom             ? 'Donne un nom à la tâche.' :
    !deadline        ? 'Choisis une deadline.' :
    !societe         ? 'Choisis la société concernée.' : null;

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
  if (!confirm('Supprimer définitivement cette tâche ?')) return;
  Stockage.supprimerTache(tacheEnEdition);
  tacheEnEdition = null;
  $('#dialogue-tache').close();
}

// ---- Ajout d'une société -------------------------------------------------

function ouvrirDialogueSociete() {
  $('#societe-nom').value = '';
  $('#societe-couleur').value = couleurProposee();
  $('#societe-erreur').hidden = true;
  $('#dialogue-societe').showModal();
}

function validerNouvelleSociete(e) {
  e.preventDefault();
  const nom = $('#societe-nom').value.trim();
  const erreur = $('#societe-erreur');

  if (!nom) {
    erreur.textContent = 'Donne un nom à la société.';
    erreur.hidden = false;
    return;
  }
  if (SOCIETES.some((s) => s.nom.toLowerCase() === nom.toLowerCase())) {
    erreur.textContent = 'Cette société existe déjà dans la liste.';
    erreur.hidden = false;
    return;
  }

  Stockage.creerSociete({
    id: crypto.randomUUID(),
    nom,
    couleur: $('#societe-couleur').value,
  });
  $('#dialogue-societe').close();
}

function cocherTout(etat) {
  document.querySelectorAll('.societe-case')
    .forEach((case_) => { case_.checked = etat; });
  afficherPins();
}

// ---- Démarrage -----------------------------------------------------------

function rafraichirTout() {
  SOCIETES = Stockage.societes;
  TACHES = Stockage.taches;
  afficherSocietes();
  afficherTaches();
  afficherPins();
}

brancherEvenements();
Stockage.init(rafraichirTout);
