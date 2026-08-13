// MarkTask — configuration Firebase
//
// Tant que FIREBASE_CONFIG vaut null, l'app fonctionne en stockage local
// (chaque navigateur garde ses propres données).
//
// Pour activer la synchronisation téléphone ↔ ordinateur : remplacer null
// par l'objet « firebaseConfig » copié depuis la console Firebase
// (Paramètres du projet → Vos applications → Configuration).

const FIREBASE_CONFIG = {
  apiKey: 'AIzaSyCNUk7mdbTVN5LTnSd9CG-btrAHwHM735E',
  authDomain: 'marktask-8680a.firebaseapp.com',
  projectId: 'marktask-8680a',
  storageBucket: 'marktask-8680a.firebasestorage.app',
  messagingSenderId: '808946359433',
  appId: '1:808946359433:web:d801006067a958392afa58',
};

// Identifiant secret de la liste dans la base (généré aléatoirement).
// Il fait partie de l'adresse des données et des règles de sécurité : ne pas le changer.
const MARKTASK_LISTE_ID = 'c6c232aebc2a58e0d847e19aecd2970fd0ea0ec9';
