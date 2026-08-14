// MarkTask — page « Tâches réalisées »
// Même couche Stockage que le dashboard : restaurer une tâche la renvoie sur
// le dashboard, la supprimer l'efface définitivement (partout, une fois synchronisé).

const FORMAT_DATE = new Intl.DateTimeFormat('fr-FR', { day: 'numeric', month: 'long' });

function dateDepuisTexte(texte) {
  const [annee, mois, jour] = texte.split('-').map(Number);
  return new Date(annee, mois - 1, jour);
}

function afficherRealisees() {
  const liste = document.getElementById('liste-realisees');
  liste.innerHTML = '';

  const realisees = Stockage.taches.filter((t) => t.faite);
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
    const societe = Stockage.societes.find((s) => s.id === tache.societe);
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
      (societe && societe.cloturee ? ' (société clôturée)' : '') +
      (tache.realiseLe ? ` · réalisée le ${FORMAT_DATE.format(dateDepuisTexte(tache.realiseLe))}` : '');
    liste.appendChild(li);
  }
}

document.getElementById('liste-realisees').addEventListener('click', (e) => {
  const li = e.target.closest('.tache');
  if (!li) return;
  const tache = Stockage.taches.find((t) => t.id === li.dataset.id);
  if (!tache) return;

  if (e.target.closest('.btn-restaurer')) {
    // une tâche d'une société clôturée n'aurait nulle part où réapparaître :
    // il faut d'abord restaurer la société elle-même
    const societe = Stockage.societes.find((s) => s.id === tache.societe);
    if (societe && societe.cloturee) {
      demanderConfirmation({
        titre: 'Société clôturée',
        question: `La société « ${societe.nom} » est clôturée. Restaure-la d'abord depuis la page « Sociétés clôturées » du menu.`,
        bouton: 'OK',
      });
      return;
    }
    // la tâche redevient « à réaliser » : elle réapparaît sur le dashboard
    Stockage.majTache({ ...tache, faite: false, realiseLe: null, clotureeAvecSociete: null });
  } else if (e.target.closest('.btn-supprimer')) {
    demanderConfirmation({
      titre: 'Supprimer la tâche',
      question: 'Supprimer définitivement cette tâche ?',
      bouton: 'Supprimer',
    }, () => Stockage.supprimerTache(tache.id));
  }
});

Stockage.init(afficherRealisees);
