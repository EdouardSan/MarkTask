// MarkTask — logique de l'application
// Bloc 4 : graphique interactif. Les données sont encore factices ;
// elles seront créées par l'utilisateur au bloc 6 puis synchronisées au bloc 8.

// ---- Données factices ---------------------------------------------------

const SOCIETES = [
  { id: 'alpha',    nom: 'Alpha Conseil', couleur: '#4FA3E8' },
  { id: 'batir',    nom: 'Bâtir & Co',    couleur: '#E8A14F' },
  { id: 'novatech', nom: 'Novatech',      couleur: '#C07CE8' },
];

const AUJOURDHUI = new Date();
AUJOURDHUI.setHours(0, 0, 0, 0);

function dansJours(n) {
  const d = new Date(AUJOURDHUI);
  d.setDate(d.getDate() + n);
  return d;
}

const TACHES = [
  { id: 't1', nom: 'Relancer le client sur le devis',
    descriptif: 'Rappeler M. Perrin au sujet du devis n°2026-118 envoyé fin juillet, et négocier le délai de livraison.',
    deadline: dansJours(3), societe: 'alpha', importance: 85 },
  { id: 't2', nom: 'Envoyer les factures de juillet',
    descriptif: 'Éditer et envoyer les quatre factures de juillet, bons de livraison en pièce jointe.',
    deadline: dansJours(6), societe: 'batir', importance: 55 },
  { id: 't3', nom: 'Préparer la réunion trimestrielle',
    descriptif: 'Préparer le support et les chiffres du trimestre pour la réunion du comité.',
    deadline: dansJours(11), societe: 'novatech', importance: 70 },
  { id: 't4', nom: 'Mettre à jour le contrat de maintenance',
    descriptif: 'Intégrer la nouvelle grille tarifaire au contrat et l\'envoyer pour signature.',
    deadline: dansJours(18), societe: 'alpha', importance: 35 },
  { id: 't5', nom: 'Valider la maquette du site',
    descriptif: 'Relire la maquette envoyée par l\'agence et lister les corrections avant validation.',
    deadline: dansJours(26), societe: 'novatech', importance: 90 },
  { id: 't6', nom: 'Commander les fournitures de chantier',
    descriptif: 'Passer la commande trimestrielle avant la fermeture estivale du fournisseur.',
    deadline: dansJours(45), societe: 'batir', importance: 25 },
];

// ---- Urgence : calculée depuis la deadline (voir plan.md) ---------------
// 4 zones sur l'axe : faible (> 1 mois), moyenne (2 sem – 1 mois),
// grave (1 – 2 sem), totale (< 1 sem, deadlines dépassées comprises).

function joursRestants(tache) {
  return Math.round((tache.deadline - AUJOURDHUI) / 86400000);
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
  liste.innerHTML = '';
  for (const societe of SOCIETES) {
    const li = document.createElement('li');
    li.className = 'societe';
    li.innerHTML = `
      <label class="societe-label">
        <input class="societe-case" type="checkbox" checked data-societe="${societe.id}">
        <span class="pastille" style="--couleur:${societe.couleur}"></span>${societe.nom}
      </label>`;
    liste.appendChild(li);
  }
}

// ---- Rendu : liste « Tâches à réaliser » --------------------------------

function afficherTaches() {
  const liste = $('#liste-taches');
  liste.innerHTML = '';
  for (const tache of TACHES) {
    const societe = societeDe(tache);
    const li = document.createElement('li');
    li.className = 'tache';
    li.dataset.id = tache.id;
    li.style.setProperty('--couleur', societe.couleur);
    li.innerHTML = `
      <span class="tache-nom"></span>
      <span class="tache-meta"></span>`;
    li.querySelector('.tache-nom').textContent = tache.nom;
    li.querySelector('.tache-meta').textContent =
      `${societe.nom} · échéance ${FORMAT_DATE.format(tache.deadline)}`;
    liste.appendChild(li);
  }
}

// ---- Rendu : pins du graphique ------------------------------------------

function afficherPins() {
  const zone = $('#graphique-zone');
  const cochees = societesCochees();
  zone.querySelectorAll('.pin').forEach((pin) => pin.remove());
  for (const tache of TACHES) {
    if (!cochees.has(tache.societe)) continue;
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
}

// ---- Fiche de survol -----------------------------------------------------

let ficheEpinglee = null;   // pin « épinglé » par un appui/clic (mobile)

function remplirFiche(tache) {
  const societe = societeDe(tache);
  const jours = joursRestants(tache);
  $('#fiche-nom').textContent = tache.nom;
  $('#fiche-desc').textContent = tache.descriptif;
  $('#fiche-pastille').style.setProperty('--couleur', societe.couleur);
  $('#fiche-societe').textContent = societe.nom;
  $('#fiche-deadline').textContent =
    `Échéance ${FORMAT_DATE.format(tache.deadline)}` +
    (jours < 0 ? ` (dépassée de ${-jours} j)` : jours === 0 ? ' (aujourd\'hui)' : ` (dans ${jours} j)`);
  $('#fiche-urgence').textContent =
    `Urgence ${niveauUrgence(jours).toLowerCase()} · importance ${tache.importance}/100`;
}

function montrerFiche(pin) {
  const tache = TACHES.find((t) => t.id === pin.dataset.id);
  if (!tache) return;
  remplirFiche(tache);

  const fiche = $('#fiche');
  fiche.hidden = false;

  // à droite du pin, ou à gauche si on est trop près du bord droit
  const zone = $('#graphique-zone');
  const x = parseFloat(pin.style.left);
  const y = parseFloat(pin.style.bottom);
  if (x > 55) {
    fiche.style.left = 'auto';
    fiche.style.right = (100 - x) + '%';
  } else {
    fiche.style.right = 'auto';
    fiche.style.left = `calc(${x}% + 18px)`;
  }
  if (y > 55) {
    fiche.style.bottom = 'auto';
    fiche.style.top = (100 - y) + '%';
  } else {
    fiche.style.top = 'auto';
    fiche.style.bottom = `calc(${y}% + 14px)`;
  }

  surligner(tache.id, true);
}

function cacherFiche() {
  $('#fiche').hidden = true;
  surligner(null, false);
}

function surligner(id, actif) {
  document.querySelectorAll('#liste-taches .tache').forEach((li) => {
    const surbrillance = actif && li.dataset.id === id;
    li.classList.toggle('tache-surbrillance', surbrillance);
    if (surbrillance) li.scrollIntoView({ block: 'nearest' });
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
  zone.addEventListener('click', (e) => {
    const pin = e.target.closest('.pin');
    if (!pin) return;
    if (ficheEpinglee === pin) {
      ficheEpinglee = null;
      cacherFiche();
    } else {
      ficheEpinglee = pin;
      montrerFiche(pin);
    }
  });

  // un appui ailleurs referme la fiche épinglée
  document.addEventListener('click', (e) => {
    if (ficheEpinglee && !e.target.closest('.pin')) {
      ficheEpinglee = null;
      cacherFiche();
    }
  });

  // filtre par société
  $('#liste-societes').addEventListener('change', afficherPins);
  $('#btn-tout-cocher').addEventListener('click', () => cocherTout(true));
  $('#btn-tout-decocher').addEventListener('click', () => cocherTout(false));
}

function cocherTout(etat) {
  document.querySelectorAll('.societe-case')
    .forEach((case_) => { case_.checked = etat; });
  afficherPins();
}

// ---- Démarrage -----------------------------------------------------------

afficherSocietes();
afficherTaches();
afficherPins();
brancherEvenements();
