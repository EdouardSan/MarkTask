// MarkTask — couche de stockage commune au dashboard et à la page Tâches réalisées
//
// Deux modes, choisis automatiquement au démarrage :
//  - « nuage »  : FIREBASE_CONFIG est renseigné → Firestore, synchronisation en
//                 temps réel entre tous les appareils, mode hors-ligne inclus.
//  - « local »  : pas de configuration → localStorage du navigateur (comme avant).
//
// Les pages n'accèdent jamais à Firestore ou localStorage directement : elles
// passent par Stockage.* et redessinent quand onChange est appelé.

const CLE_SOCIETES = 'marktask.societes.v1';
const CLE_TACHES = 'marktask.taches.v1';

// ---- Erreurs visibles à l'écran ------------------------------------------
// Sur téléphone, pas de console : toute erreur inattendue s'affiche dans un
// bandeau rouge en haut de l'écran (un appui le referme).

function signalerProbleme(message) {
  let barre = document.getElementById('barre-probleme');
  if (!barre) {
    barre = document.createElement('div');
    barre.id = 'barre-probleme';
    barre.addEventListener('click', () => barre.remove());
    document.body.appendChild(barre);
  }
  barre.textContent = 'Problème technique : ' + message;
}

window.addEventListener('error', (e) => signalerProbleme(e.message || 'erreur inconnue'));
window.addEventListener('unhandledrejection', (e) => {
  signalerProbleme(e.reason && e.reason.message ? e.reason.message : String(e.reason));
});

// ---- Encart de confirmation maison ---------------------------------------
// Remplace confirm() et alert() du navigateur par une fenêtre au design de
// l'app (sombre et bleu), disponible sur toutes les pages.
//  - avec une action : Annuler / bouton rouge, l'action ne part qu'à la
//    confirmation ;
//  - sans action : simple message d'information avec un seul bouton OK.

function demanderConfirmation({ titre, question, bouton = 'Confirmer' }, action) {
  let dialogue = document.getElementById('dialogue-confirmation');
  if (!dialogue) {
    dialogue = document.createElement('dialog');
    dialogue.className = 'dialogue';
    dialogue.id = 'dialogue-confirmation';
    dialogue.innerHTML = `
      <h2 class="dialogue-titre"></h2>
      <p class="dialogue-question"></p>
      <div class="dialogue-actions">
        <button class="btn-filtre" type="button" data-role="annuler">Annuler</button>
        <button type="button" data-role="confirmer"></button>
      </div>`;
    document.body.appendChild(dialogue);
    dialogue.querySelector('[data-role="annuler"]').addEventListener('click', () => {
      dialogue._action = null;
      dialogue.close();
    });
    dialogue.querySelector('[data-role="confirmer"]').addEventListener('click', () => {
      const faire = dialogue._action;
      dialogue._action = null;
      dialogue.close();
      if (faire) faire();
    });
  }

  dialogue.querySelector('.dialogue-titre').textContent = titre;
  dialogue.querySelector('.dialogue-question').textContent = question;
  const btnConfirmer = dialogue.querySelector('[data-role="confirmer"]');
  btnConfirmer.textContent = bouton;
  btnConfirmer.className = action ? 'btn-danger' : 'btn-principal';
  dialogue.querySelector('[data-role="annuler"]').hidden = !action;
  dialogue._action = action || null;
  dialogue.showModal();
}

const Stockage = {
  societes: [],
  taches: [],
  mode: 'local',
  _onChange: null,
  _racine: null,          // document Firestore listes/<id>

  init(onChange) {
    this._onChange = onChange;

    const nuagePossible =
      typeof FIREBASE_CONFIG !== 'undefined' && FIREBASE_CONFIG &&
      typeof firebase !== 'undefined';

    if (!nuagePossible) {
      this.societes = this._chargerLocal(CLE_SOCIETES);
      this.taches = this._chargerLocal(CLE_TACHES);
      onChange();
      return;
    }

    this.mode = 'nuage';
    firebase.initializeApp(FIREBASE_CONFIG);
    const db = firebase.firestore();
    this._racine = db.collection('listes').doc(MARKTASK_LISTE_ID);

    const sAbonner = () => {
      this._racine.collection('societes').onSnapshot((instantane) => {
        this.societes = instantane.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        this._onChange();
      });
      this._racine.collection('taches').onSnapshot((instantane) => {
        this.taches = instantane.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
        this._onChange();
      });
    };

    // Cache hors-ligne : l'app s'ouvre et fonctionne sans réseau, puis se
    // resynchronise toute seule. Le mode multi-onglets échoue sur certains
    // navigateurs (Safari iOS notamment) : on se replie alors sur le mode
    // simple, et en dernier recours on continue sans cache.
    // L'abonnement aux données n'est lancé qu'une fois ce point réglé.
    db.enablePersistence({ synchronizeTabs: true })
      .catch(() => db.enablePersistence())
      .catch(() => { /* pas de cache possible : app utilisable en ligne */ })
      .then(sAbonner, sAbonner);
  },

  // ---- Sociétés ----

  creerSociete(societe) {
    if (this.mode === 'nuage') {
      const { id, ...champs } = societe;
      this._racine.collection('societes').doc(id).set(champs);
    } else {
      this.societes.push(societe);
      this._sauverLocal(CLE_SOCIETES, this.societes);
    }
  },

  majSociete(societe) {
    if (this.mode === 'nuage') {
      const { id, ...champs } = societe;
      this._racine.collection('societes').doc(id).set(champs);
    } else {
      const index = this.societes.findIndex((s) => s.id === societe.id);
      if (index !== -1) this.societes[index] = societe;
      this._sauverLocal(CLE_SOCIETES, this.societes);
    }
  },

  supprimerSociete(id) {
    if (this.mode === 'nuage') {
      this._racine.collection('societes').doc(id).delete();
    } else {
      this.societes = this.societes.filter((s) => s.id !== id);
      this._sauverLocal(CLE_SOCIETES, this.societes);
    }
  },

  // ---- Tâches ----

  creerTache(tache) {
    if (this.mode === 'nuage') {
      const { id, ...champs } = tache;
      this._racine.collection('taches').doc(id).set(champs);
    } else {
      this.taches.push(tache);
      this._sauverLocal(CLE_TACHES, this.taches);
    }
  },

  majTache(tache) {
    if (this.mode === 'nuage') {
      const { id, ...champs } = tache;
      this._racine.collection('taches').doc(id).set(champs);
    } else {
      const index = this.taches.findIndex((t) => t.id === tache.id);
      if (index !== -1) this.taches[index] = tache;
      this._sauverLocal(CLE_TACHES, this.taches);
    }
  },

  supprimerTache(id) {
    if (this.mode === 'nuage') {
      this._racine.collection('taches').doc(id).delete();
    } else {
      this.taches = this.taches.filter((t) => t.id !== id);
      this._sauverLocal(CLE_TACHES, this.taches);
    }
  },

  // ---- localStorage (mode local) ----

  _chargerLocal(cle) {
    try {
      const brut = localStorage.getItem(cle);
      if (brut) {
        const liste = JSON.parse(brut);
        if (Array.isArray(liste)) return liste;
      }
    } catch (_) { /* stockage illisible : on repart de zéro */ }
    return [];
  },

  _sauverLocal(cle, liste) {
    localStorage.setItem(cle, JSON.stringify(liste));
    this._onChange();
  },
};
