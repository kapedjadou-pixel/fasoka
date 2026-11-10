import React from 'react';
import { View, Text, Image, TouchableOpacity, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../theme/colors';
import { MODES_LIVRAISON } from '../../config/statuts';
import { fcfa, pluriel } from '../dashboard/format';
import BadgeStatut from './BadgeStatut';
import { dateHeure, numeroCommande } from './format';

// Carte d'une commande dans une liste (historique du client, commandes de la boutique).
// `titre` : la boutique (côté client) ou le client (côté boutique). `pied` : boutons d'action éventuels.
export default function CarteCommande({ commande, titre, sousTitre, nouveau, etiquetteNouveau, pied, onPress }) {
  const apercu = Array.isArray(commande.apercu) ? commande.apercu : [];
  const nombre = Number(commande.nombre_articles) || 0;
  const reste = Math.max(0, nombre - apercu.reduce((s, a) => s + Number(a.quantite || 0), 0));

  return (
    <View style={[styles.carte, nouveau && styles.carteNouvelle]}>
      <TouchableOpacity onPress={onPress} accessibilityRole="button" accessibilityLabel={`Commande de ${titre}, ${fcfa(commande.montant_total)}`}>
        <View style={styles.entete}>
          <View style={{ flex: 1 }}>
            <Text numberOfLines={1} style={styles.titre}>{titre}</Text>
            {sousTitre ? <Text numberOfLines={1} style={styles.sousTitre}>{sousTitre}</Text> : null}
          </View>
          <View style={{ alignItems: 'flex-end' }}>
            <BadgeStatut statut={commande.statut} />
            {nouveau ? <Text style={styles.nouveau}>{etiquetteNouveau || 'Mis à jour'}</Text> : null}
          </View>
        </View>

        <View style={styles.apercu}>
          {apercu.map((a, i) => (
            <View key={i} style={styles.miniature}>
              {a.image ? <Image source={{ uri: a.image }} style={{ width: '100%', height: '100%' }} /> : <Ionicons name="cube-outline" size={18} color={COLORS.gris} />}
            </View>
          ))}
          <View style={{ flex: 1, marginLeft: 4 }}>
            <Text numberOfLines={2} style={styles.articles}>
              {apercu.map((a) => `${a.quantite} × ${a.nom}`).join(', ')}
              {reste > 0 ? ` et ${pluriel(reste, 'autre article')}` : ''}
            </Text>
          </View>
        </View>

        <View style={styles.pied}>
          <View style={{ flex: 1 }}>
            <Text style={styles.meta}>
              n° {numeroCommande(commande.id)} · {dateHeure(commande.created_at)}
            </Text>
            <Text style={styles.meta}>{MODES_LIVRAISON[commande.mode_livraison] || commande.mode_livraison}</Text>
          </View>
          <Text style={styles.total}>{fcfa(commande.montant_total)}</Text>
        </View>
      </TouchableOpacity>
      {pied ? <View style={styles.actions}>{pied}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  carte: { backgroundColor: COLORS.blanc, borderRadius: 14, padding: 14, marginBottom: 12, borderWidth: 1, borderColor: '#EFECE4' },
  carteNouvelle: { borderColor: COLORS.or, borderWidth: 2 },
  entete: { flexDirection: 'row', alignItems: 'flex-start' },
  titre: { fontSize: 15.5, fontWeight: '800', color: COLORS.noir },
  sousTitre: { fontSize: 12.5, color: COLORS.gris, marginTop: 2 },
  nouveau: { fontSize: 10.5, fontWeight: '800', color: COLORS.orFonce, marginTop: 4 },
  apercu: { flexDirection: 'row', alignItems: 'center', marginTop: 12 },
  miniature: { width: 44, height: 44, borderRadius: 8, backgroundColor: COLORS.creme, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginRight: 6 },
  articles: { fontSize: 12.5, color: COLORS.noir, lineHeight: 17 },
  pied: { flexDirection: 'row', alignItems: 'flex-end', marginTop: 12, paddingTop: 10, borderTopWidth: 1, borderTopColor: '#F3F0E9' },
  meta: { fontSize: 11.5, color: COLORS.gris, marginTop: 1 },
  total: { fontSize: 16, fontWeight: '900', color: COLORS.noir },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 12 },
});
