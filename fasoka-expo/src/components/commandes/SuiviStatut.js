import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../theme/colors';
import { dateHeure } from './format';

const ETAPES = [
  ['en_attente', 'Commande passée'],
  ['confirmee', 'Confirmée par la boutique'],
  ['en_preparation', 'En préparation'],
  ['prete', 'Prête'],
  ['livree', 'Livrée'],
];
const VERT = '#15803D';

// Suivi d'une commande étape par étape. Les dates viennent de l'historique enregistré par le serveur ;
// pour les commandes plus anciennes (sans historique), seules les dates connues sont affichées.
export default function SuiviStatut({ statut, historique = [], creeLe, misAJourLe }) {
  const dates = {};
  historique.forEach((h) => {
    if (!dates[h.statut]) dates[h.statut] = h.date;
  });
  if (!dates.en_attente && creeLe) dates.en_attente = creeLe;

  const annulee = statut === 'annulee';
  let etapes;
  if (annulee) {
    // On montre ce qui a été atteint, puis l'annulation
    etapes = ETAPES.filter(([cle]) => Boolean(dates[cle])).map(([cle, libelle]) => ({ cle, libelle, etat: 'fait', date: dates[cle] }));
    etapes.push({ cle: 'annulee', libelle: 'Commande annulée', etat: 'annulee', date: dates.annulee || misAJourLe });
  } else {
    const indexCourant = ETAPES.findIndex(([cle]) => cle === statut);
    etapes = ETAPES.map(([cle, libelle], i) => ({
      cle,
      libelle,
      etat: i < indexCourant || (statut === 'livree' && i === indexCourant) ? 'fait' : i === indexCourant ? 'courant' : 'a_venir',
      date: dates[cle] || (i === indexCourant && i > 0 ? misAJourLe : null),
    }));
  }

  return (
    <View>
      {etapes.map((e, i) => {
        const derniere = i === etapes.length - 1;
        const couleur = e.etat === 'annulee' ? COLORS.rouge : e.etat === 'a_venir' ? '#D9D5CA' : e.etat === 'courant' ? COLORS.or : VERT;
        return (
          <View key={e.cle} style={styles.ligne}>
            <View style={styles.colonne}>
              <View style={[styles.rond, { backgroundColor: e.etat === 'a_venir' ? COLORS.blanc : couleur, borderColor: couleur }]}>
                {e.etat === 'fait' ? <Ionicons name="checkmark" size={14} color={COLORS.blanc} /> : null}
                {e.etat === 'annulee' ? <Ionicons name="close" size={14} color={COLORS.blanc} /> : null}
                {e.etat === 'courant' ? <View style={styles.pointCourant} /> : null}
              </View>
              {!derniere ? <View style={[styles.trait, { backgroundColor: e.etat === 'fait' ? VERT : '#E6E2D8' }]} /> : null}
            </View>
            <View style={styles.texte}>
              <Text style={[styles.libelle, e.etat === 'a_venir' && { color: COLORS.gris, fontWeight: '500' }, e.etat === 'annulee' && { color: COLORS.rouge }]}>
                {e.libelle}
              </Text>
              {e.date ? <Text style={styles.date}>{dateHeure(e.date)}</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  ligne: { flexDirection: 'row', minHeight: 50 },
  colonne: { width: 28, alignItems: 'center' },
  rond: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, alignItems: 'center', justifyContent: 'center' },
  pointCourant: { width: 8, height: 8, borderRadius: 4, backgroundColor: COLORS.noir },
  trait: { width: 2, flex: 1, marginVertical: 2 },
  texte: { flex: 1, marginLeft: 10, paddingBottom: 14 },
  libelle: { fontSize: 14, fontWeight: '700', color: COLORS.noir },
  date: { fontSize: 12, color: COLORS.gris, marginTop: 2 },
});
