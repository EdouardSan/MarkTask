// MarkTask — configuration Firebase
//
// Tant que FIREBASE_CONFIG vaut null, l'app fonctionne en stockage local
// (chaque navigateur garde ses propres données).
//
// Pour activer la synchronisation téléphone ↔ ordinateur : remplacer null
// par l'objet « firebaseConfig » copié depuis la console Firebase
// (Paramètres du projet → Vos applications → Configuration).

const FIREBASE_CONFIG = null;

// Identifiant secret de la liste dans la base (généré aléatoirement).
// Il fait partie de l'adresse des données et des règles de sécurité : ne pas le changer.
const MARKTASK_LISTE_ID = 'c6c232aebc2a58e0d847e19aecd2970fd0ea0ec9';
