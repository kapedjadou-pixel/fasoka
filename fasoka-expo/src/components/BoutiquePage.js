import React, { useEffect, useMemo, useState } from 'react';
import {
  Modal, View, Text, TextInput, ScrollView, TouchableOpacity, ActivityIndicator, Platform, StyleSheet, useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { COLORS } from '../theme/colors';
import { ApiClient, ApiException } from '../api/apiClient';
import { useAjoutPanier } from '../context/CartContext';
import { mesureGrille } from '../config/accueil';
import Avatar from './messagerie/Avatar';
import CarteProduit from './accueil/CarteProduit';
import { pluriel } from './dashboard/format';

const TRIS_BOUTIQUE = [
  ['recents', 'Plus récents'],
  ['prix_asc', 'Prix croissant'],
  ['prix_desc', 'Prix décroissant'],
];

// Page d'une boutique : présentation (logo, badge, ville, description, chiffres), boutons Suivre et Écrire,
// puis tous ses produits avec recherche et tri. `apercu` : ce qu'on sait déjà de la boutique (affiché tout de suite).
export default function BoutiquePage({ boutiqueId, apercu, maBoutiqueId, onFermer, onOuvrirProduit, onContacter }) {
  const { width } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const grille = mesureGrille(width);
  const { demanderAjout, modale: modaleAjout } = useAjoutPanier();

  const [boutique, setBoutique] = useState(apercu || null);
  const [produits, setProduits] = useState(null);
  const [erreur, setErreur] = useState(null);
  const [suivi, setSuivi] = useState(null);
  const [abonnes, setAbonnes] = useState(null);
  const [suiviEnCours, setSuiviEnCours] = useState(false);
  const [descriptionDeployee, setDescriptionDeployee] = useState(false);
  const [recherche, setRecherche] = useState('');
  const [tri, setTri] = useState('recents');
  const [dernierAjout, setDernierAjout] = useState(null);

  const estMaBoutique = Boolean(maBoutiqueId) && maBoutiqueId === boutiqueId;

  useEffect(() => {
    let annule = false;
    ApiClient.get(`/shops/${boutiqueId}/public`)
      .then((b) => { if (!annule) { setBoutique(b); setAbonnes(Number(b.nombre_abonnes) || 0); } })
      .catch((e) => { if (!annule) setErreur(e instanceof ApiException ? e.message : 'Impossible de charger la boutique.'); });
    ApiClient.get(`/products/shop/${boutiqueId}`)
      .then((liste) => { if (!annule) setProduits(liste); })
      .catch(() => { if (!annule) setProduits([]); });
    ApiClient.get(`/shops/${boutiqueId}/suivi`)
      .then((r) => { if (!annule) setSuivi(Boolean(r.suivi)); })
      .catch(() => {});
    return () => { annule = true; };
  }, [boutiqueId]);

  async function basculerSuivi() {
    if (suiviEnCours || suivi === null) return;
    setSuiviEnCours(true);
    try {
      const r = suivi ? await ApiClient.delete(`/shops/${boutiqueId}/follow`) : await ApiClient.post(`/shops/${boutiqueId}/follow`, {});
      setSuivi(Boolean(r.suivi));
      if (typeof r.nombre_abonnes === 'number') setAbonnes(r.nombre_abonnes);
    } catch (e) {
      setErreur(e instanceof ApiException ? e.message : "Impossible de modifier l'abonnement.");
    } finally {
      setSuiviEnCours(false);
    }
  }

  // Les produits de la boutique reçoivent ses informations pour s'afficher comme sur l'accueil
  const visibles = useMemo(() => {
    if (!produits) return [];
    const terme = recherche.trim().toLowerCase();
    const enrichis = produits.map((p) => ({
      ...p,
      nom_boutique: boutique ? boutique.nom_boutique : p.nom_boutique,
      ville: boutique ? boutique.ville : p.ville,
      badge_verifie: boutique ? boutique.badge_verifie : p.badge_verifie,
    }));
    const filtres = terme ? enrichis.filter((p) => String(p.nom).toLowerCase().includes(terme)) : enrichis;
    const copie = [...filtres];
    if (tri === 'prix_asc') copie.sort((a, b) => Number(a.prix) - Number(b.prix));
    else if (tri === 'prix_desc') copie.sort((a, b) => Number(b.prix) - Number(a.prix));
    else copie.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return copie;
  }, [produits, recherche, tri, boutique]);

  function ajouter(produit) {
    demanderAjout(produit, 1, () => {
      setDernierAjout(produit.id);
      setTimeout(() => setDernierAjout(null), 1200);
    });
  }

  const description = boutique && boutique.description ? boutique.description : '';
  const longue = description.length > 160;

  return (
    <Modal visible animationType="slide" onRequestClose={onFermer}>
      <View style={[styles.page, { paddingTop: insets.top }]}>
        <View style={styles.barre}>
          <TouchableOpacity onPress={onFermer} style={styles.retour} accessibilityRole="button" accessibilityLabel="Retour">
            <Ionicons name="chevron-back" size={22} color={COLORS.noir} />
            <Text style={styles.retourTexte}>Retour</Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
          <View style={[styles.contenu, { paddingHorizontal: grille.marge }]}>
            {/* Présentation */}
            <View style={styles.entete}>
              <View style={styles.enteteHaut}>
                <Avatar uri={boutique && boutique.logo_url} nom={boutique && boutique.nom_boutique} taille={72} />
                <View style={{ flex: 1, marginLeft: 14 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <Text style={styles.nom} numberOfLines={2}>{boutique ? boutique.nom_boutique : 'Boutique'}</Text>
                    {boutique && boutique.badge_verifie ? <Ionicons name="checkmark-circle" size={20} color="#60A5FA" style={{ marginLeft: 6 }} /> : null}
                  </View>
                  <Text style={styles.sousNom} numberOfLines={1}>
                    {[boutique && boutique.ville, boutique && boutique.categorie].filter(Boolean).join(' · ') || ' '}
                  </Text>
                  <Text style={styles.chiffres}>
                    {[
                      boutique && typeof boutique.nombre_produits === 'number' ? pluriel(boutique.nombre_produits, 'produit') : null,
                      abonnes > 0 ? pluriel(abonnes, 'abonné') : null,
                      boutique && Number(boutique.nombre_ventes) > 0 ? pluriel(Number(boutique.nombre_ventes), 'vente') : null,
                    ].filter(Boolean).join(' · ')}
                  </Text>
                </View>
              </View>

              {description ? (
                <View style={{ marginTop: 14 }}>
                  <Text style={styles.description} numberOfLines={descriptionDeployee || !longue ? undefined : 3}>{description}</Text>
                  {longue ? (
                    <TouchableOpacity onPress={() => setDescriptionDeployee((v) => !v)} accessibilityRole="button">
                      <Text style={styles.lire}>{descriptionDeployee ? 'Réduire' : 'Lire la suite'}</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              ) : null}

              {!estMaBoutique && boutique ? (
                <View style={styles.boutons}>
                  <TouchableOpacity
                    style={[styles.boutonSuivre, suivi && styles.boutonSuivi, (suivi === null || suiviEnCours) && { opacity: 0.6 }]}
                    onPress={basculerSuivi}
                    disabled={suivi === null || suiviEnCours}
                    accessibilityRole="button"
                    accessibilityState={{ selected: Boolean(suivi) }}
                  >
                    <Ionicons name={suivi ? 'checkmark' : 'add'} size={18} color={suivi ? COLORS.or : COLORS.noir} />
                    <Text style={[styles.boutonSuivreTexte, suivi && { color: COLORS.or }]}>{suivi ? 'Suivi' : 'Suivre'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={styles.boutonEcrire} onPress={() => onContacter({ id: boutiqueId, nom_boutique: boutique.nom_boutique })} accessibilityRole="button">
                    <Ionicons name="chatbubble-ellipses-outline" size={18} color={COLORS.blanc} />
                    <Text style={styles.boutonEcrireTexte}>Écrire</Text>
                  </TouchableOpacity>
                </View>
              ) : null}
            </View>

            {erreur ? (
              <TouchableOpacity style={styles.erreur} onPress={() => setErreur(null)} accessibilityRole="button">
                <Text style={styles.erreurTexte}>{erreur}</Text>
              </TouchableOpacity>
            ) : null}

            {/* Produits */}
            <Text style={styles.titreSection}>Produits de la boutique</Text>
            <View style={styles.rechercheLigne}>
              <Ionicons name="search" size={18} color={COLORS.gris} />
              <TextInput
                style={styles.recherche}
                value={recherche}
                onChangeText={setRecherche}
                placeholder="Rechercher dans cette boutique"
                placeholderTextColor={COLORS.gris}
                accessibilityLabel="Rechercher dans cette boutique"
              />
            </View>
            <View style={styles.tris}>
              {TRIS_BOUTIQUE.map(([cle, libelle]) => (
                <TouchableOpacity key={cle} style={[styles.puce, tri === cle && styles.puceActive]} onPress={() => setTri(cle)} accessibilityRole="button" accessibilityState={{ selected: tri === cle }}>
                  <Text style={[styles.puceTexte, tri === cle && styles.puceTexteActive]}>{libelle}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {produits === null ? (
              <ActivityIndicator style={{ marginTop: 30 }} color={COLORS.or} />
            ) : visibles.length === 0 ? (
              <View style={styles.vide}>
                <Ionicons name="cube-outline" size={42} color={COLORS.gris} />
                <Text style={styles.videTexte}>
                  {produits.length === 0 ? "Cette boutique n'a pas encore de produit en vente." : `Aucun produit ne correspond à « ${recherche} ».`}
                </Text>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: grille.ecart }}>
                {visibles.map((p) => (
                  <CarteProduit
                    key={p.id}
                    produit={p}
                    largeur={grille.largeurCarte}
                    ajoute={dernierAjout === p.id}
                    onPress={onOuvrirProduit}
                    onAjouter={ajouter}
                    peutContacter={false}
                  />
                ))}
              </View>
            )}
          </View>
        </ScrollView>
        {modaleAjout}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.creme },
  barre: { backgroundColor: COLORS.blanc, borderBottomWidth: 1, borderBottomColor: '#ECE9E2', paddingHorizontal: 8 },
  retour: { flexDirection: 'row', alignItems: 'center', paddingVertical: 12, paddingHorizontal: 6, alignSelf: 'flex-start' },
  retourTexte: { fontSize: 15, fontWeight: '700', color: COLORS.noir },
  contenu: { width: '100%', maxWidth: 1400, alignSelf: 'center', paddingTop: 14 },
  entete: { backgroundColor: COLORS.noir, borderRadius: 18, padding: 18 },
  enteteHaut: { flexDirection: 'row', alignItems: 'center' },
  nom: { fontSize: 22, fontWeight: '900', color: COLORS.blanc, flexShrink: 1 },
  sousNom: { fontSize: 13, color: COLORS.or, marginTop: 3 },
  chiffres: { fontSize: 12.5, color: 'rgba(255,255,255,0.72)', marginTop: 5 },
  description: { fontSize: 13.5, lineHeight: 20, color: 'rgba(255,255,255,0.85)' },
  lire: { fontSize: 13, fontWeight: '700', color: COLORS.or, marginTop: 4 },
  boutons: { flexDirection: 'row', gap: 10, marginTop: 16 },
  boutonSuivre: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.or, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 20 },
  boutonSuivi: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: COLORS.or },
  boutonSuivreTexte: { fontSize: 14, fontWeight: '800', color: COLORS.noir },
  boutonEcrire: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 20, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.5)' },
  boutonEcrireTexte: { fontSize: 14, fontWeight: '800', color: COLORS.blanc },
  erreur: { backgroundColor: '#FDECEA', borderRadius: 10, padding: 10, marginTop: 12 },
  erreurTexte: { color: COLORS.rouge, fontSize: 13 },
  titreSection: { fontSize: 18, fontWeight: '900', color: COLORS.noir, marginTop: 22, marginBottom: 10 },
  rechercheLigne: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.blanc, borderRadius: 12, paddingHorizontal: 12, gap: 8, borderWidth: 1, borderColor: '#E6E2D8' },
  recherche: { flex: 1, paddingVertical: 11, fontSize: 14, color: COLORS.noir, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) },
  tris: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginVertical: 12 },
  puce: { backgroundColor: COLORS.blanc, borderRadius: 18, paddingHorizontal: 14, paddingVertical: 7, borderWidth: 1, borderColor: '#E6E2D8' },
  puceActive: { backgroundColor: COLORS.noir, borderColor: COLORS.noir },
  puceTexte: { fontSize: 13, fontWeight: '600', color: COLORS.noir },
  puceTexteActive: { color: COLORS.or, fontWeight: '800' },
  vide: { alignItems: 'center', paddingVertical: 40 },
  videTexte: { fontSize: 14, color: COLORS.gris, marginTop: 10, textAlign: 'center', maxWidth: 300, lineHeight: 20 },
});
