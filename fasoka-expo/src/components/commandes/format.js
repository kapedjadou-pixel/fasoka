import { heureCourte } from '../messagerie/formatage';

const deuxChiffres = (n) => String(n).padStart(2, '0');

// « 08/11/2026 à 14:05 » (heure locale de l'appareil)
export function dateHeure(valeur) {
  const d = new Date(valeur);
  if (Number.isNaN(d.getTime())) return '';
  return `${deuxChiffres(d.getDate())}/${deuxChiffres(d.getMonth() + 1)}/${d.getFullYear()} à ${heureCourte(d)}`;
}

// « 08/11/2026 »
export function dateCourte(valeur) {
  const d = new Date(valeur);
  if (Number.isNaN(d.getTime())) return '';
  return `${deuxChiffres(d.getDate())}/${deuxChiffres(d.getMonth() + 1)}/${d.getFullYear()}`;
}

export const numeroCommande = (id) => String(id || '').slice(0, 8).toUpperCase();
