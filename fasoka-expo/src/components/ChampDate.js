import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, Platform, StyleSheet } from 'react-native';
import { COLORS } from '../theme/colors';

// '2026-11-08' -> '08/11/2026'
function enAffichage(iso) {
  if (!iso) return '';
  const [a, m, j] = iso.split('-');
  return `${j}/${m}/${a}`;
}

// '08/11/2026' -> '2026-11-08' (ou '' si la date n'existe pas)
function enIso(texte) {
  const m = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(texte);
  if (!m) return '';
  const [, j, mois, a] = m;
  const d = new Date(Date.UTC(Number(a), Number(mois) - 1, Number(j)));
  if (d.getUTCFullYear() !== Number(a) || d.getUTCMonth() !== Number(mois) - 1 || d.getUTCDate() !== Number(j)) return '';
  return `${a}-${mois}-${j}`;
}

// Ajoute les « / » pendant la saisie : 08112026 -> 08/11/2026
function masquer(saisie) {
  const chiffres = saisie.replace(/\D/g, '').slice(0, 8);
  let resultat = chiffres.slice(0, 2);
  if (chiffres.length > 2) resultat += '/' + chiffres.slice(2, 4);
  if (chiffres.length > 4) resultat += '/' + chiffres.slice(4);
  return resultat;
}

// Champ de date : calendrier du navigateur sur le site, saisie JJ/MM/AAAA sur téléphone.
// `valeur` et `onChange` utilisent le format AAAA-MM-JJ (chaîne vide si la date n'est pas valide).
export default function ChampDate({ libelle, valeur, onChange, min, max }) {
  const [texte, setTexte] = useState(enAffichage(valeur));

  useEffect(() => {
    if (valeur && enIso(texte) !== valeur) setTexte(enAffichage(valeur));
  }, [valeur]);

  return (
    <View style={styles.bloc}>
      <Text style={styles.libelle}>{libelle}</Text>
      {Platform.OS === 'web' ? (
        React.createElement('input', {
          type: 'date',
          value: valeur || '',
          min,
          max,
          onChange: (e) => onChange(e.target.value),
          'aria-label': libelle,
          style: {
            fontSize: 14,
            padding: '9px 10px',
            borderRadius: 10,
            border: '1.5px solid #E6E2D8',
            background: '#FFFFFF',
            color: '#0A0A0A',
            fontFamily: 'inherit',
            minWidth: 150,
            boxSizing: 'border-box',
          },
        })
      ) : (
        <TextInput
          style={styles.champ}
          value={texte}
          onChangeText={(t) => {
            const masque = masquer(t);
            setTexte(masque);
            onChange(enIso(masque));
          }}
          placeholder="JJ/MM/AAAA"
          placeholderTextColor={COLORS.gris}
          keyboardType="number-pad"
          maxLength={10}
          accessibilityLabel={libelle}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  bloc: { marginRight: 12, marginTop: 8 },
  libelle: { fontSize: 12, fontWeight: '700', color: COLORS.noir, marginBottom: 5 },
  champ: {
    minWidth: 130,
    backgroundColor: COLORS.blanc,
    borderWidth: 1.5,
    borderColor: '#E6E2D8',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 9,
    fontSize: 14,
    color: COLORS.noir,
  },
});
