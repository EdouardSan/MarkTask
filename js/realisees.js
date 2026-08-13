// MarkTask — page « Tâches réalisées »
// Lit le même stockage que le dashboard (js/app.js) : restaurer une tâche la
// renvoie sur le dashboard, la supprimer l'efface définitivement.

const CLE_SOCIETES = 'marktask.societes.v1';
const CLE_TACHES = 'marktask.taches.v1';

function chargerListe(cle) {
  try {
    const brut = localStorage.getItem(cle);
    if (brut) {
      const liste = JSON.parse(brut);
      if (Array.isArray(liste)) return liste;
    }
  } catch (_) { /* stockage illisible */ }
  return [];
}

const SOCIETES = chargerListe(CLE_SOCIETES);
const TACHES = chargerListe(CLE_TACHES);

function sauverTaches() {
  localStorage.setItem(CLE_TACHES, JSON.stringify(TACHES));
}

const FORMAT_DATE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' });

function dateDepuisTexte(texte) {
  const [annee, mois, jour] = texte.split('-').map(Number);
  return new Date(annee, mois - 1, jour);
}

function afficherRealisees() {
  const liste = document.getElementById('liste-realisees');
  liste.innerHTML = '';

  const realisees = TACHES.filter((t) => t.faite);
  if (!realisees.length) {
    const li = document.createElement('li');
    li.className = 'liste-vide';
    li.textContent = 'Aucune tâche réalisée pour l\'instant.';
    liste.appendChild(li);
    return;
  }

  // les plus récemment réalisées en premier
  realisees.sort((a, b) => (b.realiseLe || '').localeCompare(a.realiseLe || ''));

  for (const tache of realisees) {
    const societe = SOCIETES.find((s) => s.id === tache.societe);
    const li = document.createElement('li');
    li.className = 'tache tache-faite';
    li.dataset.id = tache.id;
    li.style.setProperty('--couleur', societe ? societe.couleur : '');
    li.innerHTML = `
      <span class="tache-nom"></span>
      <span class="tache-meta"></span>
      <span class="tache-actions">
        <button class="btn-filtre btn-restaurer" type="button">Restaurer</button>
        <button class="btn-danger btn-supprimer" type="button">Supprimer</button>
      </span>`;
    li.querySelector('.tache-nom').textContent = tache.nom;
    li.querySelector('.tache-meta').textContent =
      `${societe ? societe.nom : '?'}` +
      (tache.realiseLe ? ` · réalisée le ${FORMAT_DATE.format(dateDepuisTexte(tache.realiseLe))}` : '');
    liste.appendChild(li);
  }
}

document.getElementById('liste-realisees').addEventListener('click', (e) => {
  const li = e.target.closest('.tache');
  if (!li) return;
  const tache = TACHES.find((t) => t.id === li.dataset.id);
  if (!tache) return;

  if (e.target.closest('.btn-restaurer')) {
    // la tâche redevient « à réaliser » : elle réapparaît sur le dashboard
    delete tache.faite;
    delete tache.realiseLe;
    sauverTaches();
    afficherRealisees();
  } else if (e.target.closest('.btn-supprimer')) {
    if (!confirm('Supprimer définitivement cette tâche ?')) return;
    TACHES.splice(TACHES.indexOf(tache), 1);
    sauverTaches();
    afficherRealisees();
  }
});

afficherRealisees();
