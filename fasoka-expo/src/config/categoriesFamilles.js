// Regroupement des catégories par familles, pour mieux les présenter dans le panneau « Toutes les catégories ».
// C'est une simple présentation : les données n'ont pas de sous-catégories. Une catégorie qui n'est dans aucune famille
// (par exemple une catégorie écrite librement par une boutique) est rangée dans « Autres ».
export const FAMILLES = [
  { nom: 'Mode et beauté', icone: 'shirt-outline', categories: ['Mode', 'Chaussures', 'Beauté'] },
  { nom: 'High-tech', icone: 'phone-portrait-outline', categories: ['Électronique', 'Téléphones'] },
  { nom: 'Maison et bricolage', icone: 'home-outline', categories: ['Maison', 'Bricolage'] },
  { nom: 'Alimentation', icone: 'restaurant-outline', categories: ['Alimentation', 'Boissons', 'Agriculture'] },
  { nom: 'Famille et santé', icone: 'heart-outline', categories: ['Enfants', 'Santé'] },
  { nom: 'Loisirs et véhicules', icone: 'bicycle-outline', categories: ['Sport', 'Auto et moto'] },
  { nom: 'Services', icone: 'construct-outline', categories: ['Services'] },
];

const normaliser = (texte) => String(texte || '').trim().toLowerCase();

// categories : [{ nom, nombre }] renvoyé par le serveur -> [{ nom, icone, categories: [{ nom, nombre }], total }]
// (familles vides non affichées ; « Autres » regroupe le reste)
export function regrouperCategories(categories) {
  const reste = [...categories];
  const resultat = FAMILLES.map((famille) => {
    const noms = famille.categories.map(normaliser);
    const dedans = reste.filter((c) => noms.includes(normaliser(c.nom)));
    dedans.forEach((c) => reste.splice(reste.indexOf(c), 1));
    return { nom: famille.nom, icone: famille.icone, categories: dedans };
  }).filter((f) => f.categories.length > 0);
  if (reste.length > 0) resultat.push({ nom: 'Autres', icone: 'apps-outline', categories: reste });
  return resultat.map((f) => ({ ...f, total: f.categories.reduce((s, c) => s + c.nombre, 0) }));
}
