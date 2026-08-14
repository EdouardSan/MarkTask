// MarkTask — page « Sociétés clôturées »
// Une société « supprimée » depuis le dashboard atterrit ici, et ses tâches
// encore à faire sont parties dans « Tâches réalisées » (marquées
// clotureeAvecSociete). Restaurer la société la renvoie sur le dashboard et
// fait revenir ces tâches-là avec elle ; la supprimer ici est définitif et
// efface aussi toutes ses tâches.

const FORMAT_DATE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' });

function dateDepuisTexte(texte) {
  const [annee, mois, jour] = texte.split('-').map(Number);
  return new Date(annee, mois - 1, jour);
}

function afficherCloturees() {
  const liste = document.getElementById('liste-cloturees');
  liste.innerHTML = '';

  const cloturees = Stockage.societes.filter((s) => s.cloturee);
  if (!cloturees.length) {
    const li = document.createElement('li');
    li.className = 'liste-vide';
    li.textContent = 'Aucune société clôturée pour l\'instant.';
    liste.appendChild(li);
    return;
  }

  // les plus récemment clôturées en premier
  cloturees.sort((a, b) => (b.clotureeLe || '').localeCompare(a.clotureeLe || ''));

  for (const societe of cloturees) {
    const liees = Stockage.taches.filter((t) => t.societe === societe.id);
    const li = document.createElement('li');
    li.className = 'tache';
    li.dataset.id = societe.id;
    li.style.setProperty('--couleur', societe.couleur);
    li.innerHTML = `
      <span class="tache-nom"></span>
      <span class="tache-meta"></span>
      <span class="tache-actions">
        <button class="btn-filtre btn-restaurer" type="button">Restaurer</button>
        <button class="btn-danger btn-supprimer" type="button">Supprimer</button>
      </span>`;
    li.querySelector('.tache-nom').textContent = societe.nom;
    li.querySelector('.tache-meta').textContent =
      (societe.clotureeLe ? `clôturée le ${FORMAT_DATE.format(dateDepuisTexte(societe.clotureeLe))} · ` : '') +
      (!liees.length ? 'aucune tâche' : liees.length === 1 ? '1 tâche' : `${liees.length} tâches`);
    liste.appendChild(li);
  }
}

document.getElementById('liste-cloturees').addEventListener('click', (e) => {
  const li = e.target.closest('.tache');
  if (!li) return;
  const societe = Stockage.societes.find((s) => s.id === li.dataset.id);
  if (!societe) return;

  if (e.target.closest('.btn-restaurer')) {
    // la société revient sur le dashboard, avec les tâches parties lors de la
    // clôture (celles réalisées avant restent dans « Tâches réalisées »)
    for (const tache of Stockage.taches) {
      if (tache.societe === societe.id && tache.clotureeAvecSociete) {
        Stockage.majTache({ ...tache, faite: false, realiseLe: null, clotureeAvecSociete: null });
      }
    }
    Stockage.majSociete({ ...societe, cloturee: false, clotureeLe: null });
  } else if (e.target.closest('.btn-supprimer')) {
    const liees = Stockage.taches.filter((t) => t.societe === societe.id);
    const question =
      !liees.length      ? `Supprimer définitivement la société « ${societe.nom} » ?` :
      liees.length === 1 ? `Supprimer définitivement la société « ${societe.nom} » et sa tâche ?` :
      `Supprimer définitivement la société « ${societe.nom} » et ses ${liees.length} tâches ?`;
    demanderConfirmation({
      titre: 'Supprimer la société',
      question,
      bouton: 'Supprimer',
    }, () => {
      for (const tache of liees) Stockage.supprimerTache(tache.id);
      Stockage.supprimerSociete(societe.id);
    });
  }
});

Stockage.init(afficherCloturees);
