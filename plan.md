# MarkTask — Plan de réalisation

Application de gestion de tâches pour un utilisateur unique, non technique.
L'utilisateur ouvre un lien, c'est tout : pas de compte, pas d'installation, pas de maintenance.

## Architecture retenue

- **PWA statique** (HTML + CSS + JavaScript, sans framework ni build) hébergée sur **GitHub Pages**.
- **Firebase Firestore** (offre gratuite, compte du développeur) pour stocker les tâches et synchroniser en temps réel le téléphone et l'ordinateur.
- Mode hors-ligne : l'app fonctionne sans connexion et se resynchronise toute seule.

## Direction design

- Sources : `assets/logo-512.png` et les 4 références dans `design/`.
- Fond très sombre, cartes arrondies bien délimitées, texte blanc, **vert du logo comme unique couleur d'accent** (boutons, éléments actifs). Les pins du graphique portent les couleurs des sociétés.
- Desktop : tout tient sur un seul écran (dashboard). Mobile : les mêmes cartes empilées verticalement, on fait défiler.

## Fonctionnement du graphique (décidé le 13/08/2026)

Le graphique croise **urgence (abscisse) × importance (ordonnée)**.

L'**urgence est calculée automatiquement** à partir de la deadline, en 4 niveaux :

| Niveau | Temps restant avant la deadline |
|--------|--------------------------------|
| Totale | moins d'1 semaine (et deadlines dépassées) |
| Grave | entre 1 et 2 semaines |
| Moyenne | entre 2 semaines et 1 mois |
| Faible | plus d'1 mois |

Le pin change donc de zone tout seul, jour après jour, à mesure que l'échéance
approche. L'axe des abscisses est découpé en 4 zones correspondant à ces niveaux
(le quadrillage du graphique reprend ce découpage).

L'**importance**, elle, est choisie à la création de la tâche (curseur simple).

## Agencement desktop (schéma `design/schema-dashboard-main.jpeg`, révisé le 13/08/2026)

Révisions demandées après la maquette : le bouton « Nouvelle tâche » est intégré
**dans le coin haut-droit du graphique**, et les deux listes de tâches sont
**repliées par défaut** (un clic sur la flèche les déplie). Le graphique occupe
ainsi presque tout l'écran — il doit rester lisible avec des dizaines,
voire une centaine de pins.

```
┌──────────────────────────────────────────────────────────┐
│                        MARKTASK                          │
├───────────────────────────────────────────┬──────────────┤
│  GRAPHIQUE          [+ Nouvelle tâche]    │  SOCIÉTÉS    │
│  importance ↑ / urgence →                 │  ● Société 1 │
│  (pins colorés par société,               │  ● Société 2 │
│   survol = fiche de la tâche,             │              │
│   très grand : des dizaines de pins)      │  [+ Nouvelle │
│                                           │    société]  │
├─────────────────────────┬─────────────────┴──────────────┤
│  ▸ TÂCHES À RÉALISER    │  ▸ TÂCHES RÉALISÉES            │
│  (repliées par défaut,  │  (repliées par défaut)         │
│   clic pour déplier)    │                                │
└─────────────────────────┴────────────────────────────────┘
```

Mobile (défilement vertical) : logo → graphique (avec son bouton Nouvelle tâche) → sociétés → tâches à réaliser → tâches réalisées.

---

# Les blocs

Chaque bloc = une petite étape livrable. Trois rubriques à chaque fois :
**Avant** (état du projet), **Ce que le bloc réalise**, **Test en 2 minutes**.

---

## Bloc 1 — Squelette du projet ✅

**Avant.** Le repo ne contient que le logo, les références design et ce plan.

**Ce que le bloc réalise.** La structure de fichiers de l'app : `index.html` (page vide aux couleurs MarkTask), `css/style.css` (fond sombre, variables de couleurs tirées du logo), `js/app.js` (vide), en-tête avec le logo et le nom de l'app.

**Test en 2 minutes.** Double-cliquer sur `index.html` : une page sombre s'ouvre dans le navigateur avec le logo MarkTask et le titre, sans erreur dans la console (F12).

---

## Bloc 2 — Maquette du dashboard avec fausses données ✅

**Avant.** Une page sombre quasi vide avec l'en-tête.

**Ce que le bloc réalise.** Tout l'agencement desktop en cartes, rempli de données factices écrites en dur : le cadre du graphique avec ses deux axes, la carte Sociétés avec 3 sociétés d'exemple colorées, la liste Tâches à réaliser avec ~6 fausses tâches, la section Tâches réalisées, le bouton « + Nouvelle tâche » (encore inactif). C'est le moment de valider le look général.

**Test en 2 minutes.** Ouvrir `index.html` en plein écran sur l'ordinateur : tout le dashboard tient sur un seul écran sans défilement, l'agencement correspond au schéma, l'ambiance rappelle les références de `design/`.

---

## Bloc 3 — Version mobile

**Avant.** Le dashboard est correct sur grand écran mais illisible sur petit écran.

**Ce que le bloc réalise.** Le responsive : sous une certaine largeur, les cartes s'empilent verticalement dans l'ordre défini plus haut, les tailles de texte et les zones tactiles s'adaptent au doigt.

**Test en 2 minutes.** Ouvrir `index.html`, appuyer sur F12 puis activer le mode téléphone (icône téléphone/tablette), choisir « iPhone » ou « Galaxy » : tout est lisible en défilant, rien ne déborde sur les côtés.

---

## Bloc 4 — Graphique interactif

**Avant.** Le cadre du graphique est vide, les fausses tâches ne vivent que dans la liste.

**Ce que le bloc réalise.** Les fausses tâches apparaissent en pins colorés positionnés selon urgence (calculée depuis la deadline) et importance. Au survol d'un pin : une fiche s'affiche avec tout le contenu de la tâche (nom, descriptif, deadline, société), et la ligne correspondante s'illumine dans la liste Tâches à réaliser. Sur téléphone, un appui sur le pin fait la même chose.

**Test en 2 minutes.** Ouvrir la page, passer la souris sur un pin : la fiche apparaît à côté du pin et la bonne ligne se met en surbrillance dans la liste. Vérifier qu'une tâche à deadline proche est plus à droite qu'une tâche à deadline lointaine.

---

## Bloc 5 — Gestion des sociétés

**Avant.** Les 3 sociétés sont écrites en dur dans le code.

**Ce que le bloc réalise.** Le bouton « + Ajouter » de la carte Sociétés : on saisit un nom, une couleur est proposée automatiquement (modifiable), la société apparaît dans la liste. Les données sont enregistrées dans le navigateur (stockage local provisoire, remplacé par Firebase au bloc 8).

**Test en 2 minutes.** Ajouter une société « Test » ; elle apparaît avec sa pastille de couleur. Fermer complètement le navigateur, rouvrir la page : « Test » est toujours là.

---

## Bloc 6 — Création de tâches

**Avant.** Le bouton « + Nouvelle tâche » ne fait rien ; les tâches affichées sont factices.

**Ce que le bloc réalise.** Le formulaire de création : nom, descriptif, deadline, société (choisie parmi la liste), importance (curseur). À la validation, la tâche apparaît immédiatement dans la liste et en pin coloré sur le graphique. Les fausses données disparaissent définitivement.

**Test en 2 minutes.** Créer une tâche « Appeler le comptable », deadline dans 3 jours, société « Test » : elle apparaît dans la liste et sur le graphique avec la couleur de « Test ». Recharger la page : elle est toujours là.

---

## Bloc 7 — Terminer une tâche

**Avant.** Les tâches créées restent « à réaliser » pour toujours.

**Ce que le bloc réalise.** Une case à cocher sur chaque tâche : cochée, la tâche quitte la liste et le graphique et rejoint « Tâches réalisées » (avec sa date de réalisation). Possibilité de la restaurer ou de la supprimer définitivement. Modification et suppression d'une tâche à réaliser également.

**Test en 2 minutes.** Cocher une tâche : elle disparaît du graphique et apparaît dans Tâches réalisées. La décocher : elle revient. Supprimer : elle disparaît pour de bon, même après rechargement.

---

## Bloc 8 — Synchronisation Firebase

**Avant.** L'app est complète mais chaque navigateur a ses propres données (stockage local).

**Ce que le bloc réalise.** Le branchement à Firestore : les tâches et sociétés sont lues/écrites dans la base en temps réel, le stockage local est remplacé. **Étape préalable (toi, ~10 min, guidé pas à pas) : créer le projet Firebase gratuit dans leur console et me transmettre la configuration.** Les règles de sécurité limitent l'accès au seul chemin de données de l'app.

**Test en 2 minutes.** Ouvrir l'app dans deux fenêtres de navigateur côte à côte. Créer une tâche dans la première : elle apparaît dans la seconde en moins de 5 secondes, sans recharger.

---

## Bloc 9 — Mode hors-ligne et PWA

**Avant.** L'app exige une connexion à chaque ouverture.

**Ce que le bloc réalise.** Le manifest (nom, icônes générées depuis le logo, couleurs) et le service worker : l'app s'ouvre et fonctionne sans connexion, les modifications faites hors-ligne se synchronisent automatiquement au retour du réseau. C'est aussi ce qui rendra l'app installable sur l'écran d'accueil du téléphone.

**Test en 2 minutes.** Charger l'app, couper le Wi-Fi, recharger la page : elle s'ouvre quand même et affiche les tâches. Créer une tâche hors-ligne, rallumer le Wi-Fi : elle apparaît dans l'autre fenêtre.

---

## Bloc 10 — Mise en ligne et installation

**Avant.** L'app est finie mais n'existe que sur l'ordinateur de développement.

**Ce que le bloc réalise.** L'activation de GitHub Pages (⚠️ le repo devra passer en public à ce moment-là — Pages n'est pas disponible sur les repos privés du plan gratuit) et la vérification de l'app en conditions réelles. Rédaction du mini-guide de remise à l'utilisateur : « ouvre ce lien, puis Ajouter à l'écran d'accueil ».

**Test en 2 minutes.** Sur ton propre téléphone, ouvrir `https://edouardsan.github.io/MarkTask/`, faire « Ajouter à l'écran d'accueil », ouvrir l'app depuis l'icône : elle se lance en plein écran comme une vraie app, et une tâche créée sur l'ordinateur y apparaît.

---

## Récapitulatif

| # | Bloc | Livrable visible | Fait |
|---|------|------------------|------|
| 1 | Squelette | Page sombre avec logo | ✅ |
| 2 | Maquette dashboard | Tout l'écran desktop, données factices | ✅ |
| 3 | Version mobile | Défilement vertical propre |
| 4 | Graphique interactif | Pins, survol, fiche, surbrillance |
| 5 | Sociétés | Ajout + couleurs, données conservées |
| 6 | Création de tâches | Formulaire complet fonctionnel |
| 7 | Terminer une tâche | Cycle de vie complet |
| 8 | Firebase | Téléphone et ordinateur synchronisés |
| 9 | Hors-ligne + PWA | App installable, marche sans réseau |
| 10 | Mise en ligne | Lien à donner à l'utilisateur |
