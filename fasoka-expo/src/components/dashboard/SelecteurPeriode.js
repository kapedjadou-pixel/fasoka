import React, { useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { COLORS } from '../../theme/colors';
import ChampDate from '../ChampDate';
import { aujourdhuiIso, ajouterJoursIso, nombreJoursIso } from './format';

const PUCES = [
  ['aujourdhui', "Aujourd'hui"],
  ['7j', '7 jours'],
  ['30j', '30 jours'],
  ['perso', 'Personnalisée'],
];
const JOURS_MAX = 92;

function verifierPeriode(du, au) {
  if (!du || !au) return 'Choisissez une date de début et une date de fin.';
  if (du > au) return 'La date de début doit précéder la date de fin.';
  if (au > aujourdhuiIso()) return 'La date de fin ne peut pas être dans le futur.';
  if (nombreJoursIso(du, au) > JOURS_MAX) return `La période ne peut pas dépasser ${JOURS_MAX} jours.`;
  return null;
}

// Choix de la période d'analyse : aujourd'hui, 7 jours, 30 jours ou personnalisée (deux dates).
// `periode` : { type, du?, au? } ; `onChange` n'est appelé que pour une période valide.
export default function SelecteurPeriode({ periode, onChange, chargement }) {
  const aujourdhui = aujourdhuiIso();
  const [du, setDu] = useState(periode.du || ajouterJoursIso(aujourdhui, -6));
  const [au, setAu] = useState(periode.au || aujourdhui);
  const probleme = periode.type === 'perso' ? verifierPeriode(du, au) : null;

  function choisir(type) {
    if (type === 'perso') {
      const valide = !verifierPeriode(du, au);
      onChange({ type: 'perso', du: valide ? du : ajouterJoursIso(aujourdhui, -6), au: valide ? au : aujourdhui });
      if (!valide) {
        setDu(ajouterJoursIso(aujourdhui, -6));
        setAu(aujourdhui);
      }
      return;
    }
    onChange({ type });
  }

  function modifier(nouveauDu, nouvelAu) {
    setDu(nouveauDu);
    setAu(nouvelAu);
    if (!verifierPeriode(nouveauDu, nouvelAu)) onChange({ type: 'perso', du: nouveauDu, au: nouvelAu });
  }

  return (
    <View>
      <View style={styles.ligne}>
        {PUCES.map(([type, libelle]) => {
          const actif = periode.type === type;
          return (
            <TouchableOpacity
              key={type}
              style={[styles.puce, actif && styles.puceActive]}
              onPress={() => choisir(type)}
              accessibilityRole="button"
              accessibilityState={{ selected: actif }}
              accessibilityLabel={`Période : ${libelle}`}
            >
              <Text style={[styles.puceTexte, actif && styles.puceTexteActive]}>{libelle}</Text>
            </TouchableOpacity>
          );
        })}
        {chargement ? <ActivityIndicator size="small" color={COLORS.orFonce} style={{ marginLeft: 6 }} /> : null}
      </View>

      {periode.type === 'perso' ? (
        <View>
          <View style={styles.dates}>
            <ChampDate libelle="Du" valeur={du} max={aujourdhui} onChange={(v) => modifier(v, au)} />
            <ChampDate libelle="Au" valeur={au} max={aujourdhui} onChange={(v) => modifier(du, v)} />
          </View>
          {probleme ? <Text style={styles.probleme}>{probleme}</Text> : <Text style={styles.aide}>Maximum {JOURS_MAX} jours.</Text>}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  ligne: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 8 },
  puce: { backgroundColor: COLORS.blanc, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 9, borderWidth: 1, borderColor: '#E6E2D8' },
  puceActive: { backgroundColor: COLORS.noir, borderColor: COLORS.noir },
  puceTexte: { fontSize: 13.5, fontWeight: '600', color: COLORS.noir },
  puceTexteActive: { color: COLORS.or, fontWeight: '800' },
  dates: { flexDirection: 'row', flexWrap: 'wrap' },
  aide: { fontSize: 12, color: COLORS.gris, marginTop: 6 },
  probleme: { fontSize: 12.5, color: COLORS.rouge, marginTop: 6 },
});
