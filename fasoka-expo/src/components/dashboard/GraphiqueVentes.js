import React, { useState } from 'react';
import { View, Text, Pressable, StyleSheet } from 'react-native';
import { COLORS } from '../../theme/colors';
import { fcfa, fcfaCourt, pluriel } from './format';

const HAUTEUR_BARRES = 150;

// Graphique en barres des ventes (commandes livrées) : une barre par heure (une journée) ou par jour.
// Dessiné avec de simples vues : aucune bibliothèque de graphiques n'est nécessaire.
// `serie` : { granularite, points: [{ cle, libelle, montant, commandes }] } renvoyé par le serveur.
export default function GraphiqueVentes({ serie }) {
  const [selection, setSelection] = useState(null);
  const points = serie ? serie.points : [];
  const maximum = points.reduce((m, p) => Math.max(m, p.montant), 0);
  const total = points.reduce((s, p) => s + p.montant, 0);
  const pas = Math.max(1, Math.ceil(points.length / 8)); // une étiquette sur « pas » pour ne pas encombrer l'axe
  const choisi = selection !== null && points[selection] ? points[selection] : null;

  if (points.length === 0 || total === 0) {
    return (
      <View style={styles.vide}>
        <Text style={styles.videTitre}>Aucune vente sur cette période</Text>
        <Text style={styles.videTexte}>Les ventes apparaissent ici quand une commande est marquée « Livrée ».</Text>
      </View>
    );
  }

  return (
    <View>
      <Text style={styles.detail} accessibilityLiveRegion="polite">
        {choisi
          ? `${choisi.libelle} · ${fcfa(choisi.montant)} · ${pluriel(choisi.commandes, 'commande')}`
          : 'Touchez une barre pour voir le détail'}
      </Text>

      <View style={styles.zone}>
        <View style={styles.axe}>
          <Text style={styles.axeTexte}>{fcfaCourt(maximum)}</Text>
          <Text style={styles.axeTexte}>0</Text>
        </View>
        <View style={styles.barres}>
          {points.map((p, i) => {
            const hauteur = p.montant > 0 ? Math.max(4, (p.montant / maximum) * (HAUTEUR_BARRES - 4)) : 2;
            const active = selection === i;
            return (
              <Pressable
                key={p.cle}
                style={[styles.colonne, { paddingHorizontal: points.length > 40 ? 0.5 : points.length > 16 ? 1.5 : 3 }]}
                onPress={() => setSelection(active ? null : i)}
                onHoverIn={() => setSelection(i)}
                accessibilityRole="button"
                accessibilityLabel={`${p.libelle} : ${fcfa(p.montant)}, ${pluriel(p.commandes, 'commande')}`}
              >
                <View
                  style={{
                    height: hauteur,
                    borderRadius: 3,
                    backgroundColor: p.montant === 0 ? '#ECE9E2' : active ? COLORS.noir : COLORS.or,
                  }}
                />
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.etiquettes}>
        <View style={{ width: 34 }} />
        <View style={{ flex: 1, flexDirection: 'row' }}>
          {points.map((p, i) => (
            <View key={p.cle} style={{ flex: 1, alignItems: 'center' }}>
              {i % pas === 0 ? (
                <Text numberOfLines={1} style={styles.etiquette}>{p.libelle}</Text>
              ) : null}
            </View>
          ))}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  detail: { fontSize: 13, fontWeight: '700', color: COLORS.noir, marginBottom: 10, minHeight: 18 },
  zone: { flexDirection: 'row', height: HAUTEUR_BARRES },
  axe: { width: 34, justifyContent: 'space-between', alignItems: 'flex-start' },
  axeTexte: { fontSize: 10.5, color: COLORS.gris },
  barres: { flex: 1, flexDirection: 'row', alignItems: 'flex-end', borderBottomWidth: 1, borderBottomColor: '#E6E2D8' },
  colonne: { flex: 1, justifyContent: 'flex-end', height: '100%' },
  etiquettes: { flexDirection: 'row', marginTop: 6 },
  etiquette: { fontSize: 10, color: COLORS.gris },
  vide: { alignItems: 'center', paddingVertical: 36, paddingHorizontal: 16 },
  videTitre: { fontSize: 14.5, fontWeight: '700', color: COLORS.noir },
  videTexte: { fontSize: 12.5, color: COLORS.gris, marginTop: 5, textAlign: 'center', lineHeight: 18 },
});
