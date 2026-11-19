import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Image, ActivityIndicator, Platform, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../theme/colors';
import { ApiClient } from '../../api/apiClient';
import Avatar from '../messagerie/Avatar';
import { fcfa } from '../dashboard/format';
import { miniature } from '../messagerie/formatage';

// Grande barre de recherche avec suggestions (produits, catégories, boutiques) pendant la saisie,
// recherches récentes quand elle est vide, et bouton « Filtres » avec le nombre de filtres actifs.
// Le panneau de suggestions s'affiche sous la barre (il pousse le contenu : il fonctionne partout, sans zone cachée).
export default function BarreRecherche({
  valeur, onChangeText, onSubmit, recentes, onEffacerRecentes, onChoisirRecente,
  onChoisirProduit, onChoisirCategorie, onChoisirBoutique, nombreFiltres, onOuvrirFiltres,
}) {
  const [focus, setFocus] = useState(false);
  const [suggestions, setSuggestions] = useState(null);
  const [chargement, setChargement] = useState(false);
  const numero = useRef(0);
  const minuteurBlur = useRef(null);
  const texte = valeur.trim();

  // Suggestions : demandées 250 ms après la dernière frappe, à partir de 2 lettres
  useEffect(() => {
    if (!focus || texte.length < 2) {
      setSuggestions(null);
      setChargement(false);
      return undefined;
    }
    const n = ++numero.current;
    setChargement(true);
    const minuteur = setTimeout(async () => {
      try {
        const donnees = await ApiClient.get('/products/suggestions', { q: texte });
        if (n === numero.current) setSuggestions(donnees);
      } catch (e) {
        if (n === numero.current) setSuggestions(null);
      } finally {
        if (n === numero.current) setChargement(false);
      }
    }, 250);
    return () => clearTimeout(minuteur);
  }, [texte, focus]);

  useEffect(() => () => clearTimeout(minuteurBlur.current), []);

  const aSuggestions = suggestions && (suggestions.produits.length + suggestions.categories.length + suggestions.boutiques.length) > 0;
  const panneauVisible = focus && (texte.length >= 2 || (recentes && recentes.length > 0));

  const choisir = (action) => (...args) => {
    setFocus(false);
    action(...args);
  };

  return (
    <View style={styles.conteneur}>
      <View style={styles.barre}>
        <Ionicons name="search" size={20} color={COLORS.gris} />
        <TextInput
          style={styles.champ}
          value={valeur}
          onChangeText={onChangeText}
          placeholder="Rechercher un produit, une boutique…"
          placeholderTextColor={COLORS.gris}
          returnKeyType="search"
          autoCorrect={false}
          onFocus={() => { clearTimeout(minuteurBlur.current); setFocus(true); }}
          onBlur={() => { minuteurBlur.current = setTimeout(() => setFocus(false), 200); }}
          onSubmitEditing={() => { setFocus(false); onSubmit(valeur); }}
          accessibilityLabel="Rechercher un produit ou une boutique"
        />
        {valeur ? (
          <TouchableOpacity onPress={() => onChangeText('')} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }} accessibilityRole="button" accessibilityLabel="Effacer la recherche">
            <Ionicons name="close-circle" size={19} color={COLORS.gris} />
          </TouchableOpacity>
        ) : null}
        <TouchableOpacity style={styles.boutonFiltres} onPress={onOuvrirFiltres} accessibilityRole="button" accessibilityLabel={`Filtres${nombreFiltres > 0 ? `, ${nombreFiltres} actif${nombreFiltres > 1 ? 's' : ''}` : ''}`}>
          <Ionicons name="options-outline" size={18} color={COLORS.noir} />
          <Text style={styles.filtresTexte}>Filtres</Text>
          {nombreFiltres > 0 ? <View style={styles.pastille}><Text style={styles.pastilleTexte}>{nombreFiltres}</Text></View> : null}
        </TouchableOpacity>
      </View>

      {panneauVisible ? (
        <View style={styles.panneau}>
          {texte.length >= 2 ? (
            <>
              <TouchableOpacity style={styles.ligne} onPress={choisir(() => onSubmit(valeur))} accessibilityRole="button">
                <Ionicons name="search" size={17} color={COLORS.orFonce} />
                <Text numberOfLines={1} style={styles.ligneTexte}>Rechercher « {texte} »</Text>
              </TouchableOpacity>

              {chargement && !suggestions ? <ActivityIndicator style={{ marginVertical: 10 }} size="small" color={COLORS.or} /> : null}

              {suggestions && suggestions.produits.length > 0 ? <Text style={styles.groupe}>Produits</Text> : null}
              {suggestions ? suggestions.produits.map((p) => (
                <TouchableOpacity key={p.id} style={styles.ligne} onPress={choisir(() => onChoisirProduit(p))} accessibilityRole="button">
                  <View style={styles.vignette}>
                    {p.image ? <Image source={{ uri: miniature(p.image, 120) }} style={{ width: '100%', height: '100%' }} /> : <Ionicons name="cube-outline" size={16} color={COLORS.gris} />}
                  </View>
                  <Text numberOfLines={1} style={[styles.ligneTexte, { flex: 1 }]}>{p.nom}</Text>
                  <Text style={styles.prix}>{fcfa(p.prix)}</Text>
                </TouchableOpacity>
              )) : null}

              {suggestions && suggestions.categories.length > 0 ? <Text style={styles.groupe}>Catégories</Text> : null}
              {suggestions ? suggestions.categories.map((c) => (
                <TouchableOpacity key={c.nom} style={styles.ligne} onPress={choisir(() => onChoisirCategorie(c.nom))} accessibilityRole="button">
                  <Ionicons name="pricetag-outline" size={17} color={COLORS.gris} />
                  <Text numberOfLines={1} style={[styles.ligneTexte, { flex: 1 }]}>{c.nom}</Text>
                  <Text style={styles.compte}>{c.nombre} produit{c.nombre > 1 ? 's' : ''}</Text>
                </TouchableOpacity>
              )) : null}

              {suggestions && suggestions.boutiques.length > 0 ? <Text style={styles.groupe}>Boutiques</Text> : null}
              {suggestions ? suggestions.boutiques.map((b) => (
                <TouchableOpacity key={b.id} style={styles.ligne} onPress={choisir(() => onChoisirBoutique(b))} accessibilityRole="button">
                  <Avatar uri={b.logo_url} nom={b.nom_boutique} taille={30} />
                  <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center' }}>
                    <Text numberOfLines={1} style={[styles.ligneTexte, { marginLeft: 0, flexShrink: 1 }]}>{b.nom_boutique}</Text>
                    {b.badge_verifie ? <Ionicons name="checkmark-circle" size={14} color="#2563EB" style={{ marginLeft: 4 }} /> : null}
                  </View>
                  {b.ville ? <Text style={styles.compte}>{b.ville}</Text> : null}
                </TouchableOpacity>
              )) : null}

              {!chargement && suggestions && !aSuggestions ? <Text style={styles.aucune}>Aucune suggestion : lancez la recherche pour voir tous les résultats.</Text> : null}
            </>
          ) : (
            <>
              <View style={styles.groupeLigne}>
                <Text style={styles.groupe}>Recherches récentes</Text>
                <TouchableOpacity onPress={onEffacerRecentes} accessibilityRole="button"><Text style={styles.effacer}>Effacer</Text></TouchableOpacity>
              </View>
              {recentes.map((t) => (
                <TouchableOpacity key={t} style={styles.ligne} onPress={choisir(() => onChoisirRecente(t))} accessibilityRole="button">
                  <Ionicons name="time-outline" size={17} color={COLORS.gris} />
                  <Text numberOfLines={1} style={styles.ligneTexte}>{t}</Text>
                </TouchableOpacity>
              ))}
            </>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  conteneur: { backgroundColor: COLORS.blanc, borderRadius: 16, borderWidth: 1.5, borderColor: '#E6E2D8', overflow: 'hidden' },
  barre: { flexDirection: 'row', alignItems: 'center', paddingLeft: 14, paddingRight: 8, minHeight: 52, gap: 10 },
  champ: { flex: 1, fontSize: 15, color: COLORS.noir, paddingVertical: 12, ...(Platform.OS === 'web' ? { outlineStyle: 'none' } : {}) },
  boutonFiltres: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: COLORS.or, borderRadius: 12, paddingHorizontal: 12, paddingVertical: 9 },
  filtresTexte: { fontSize: 13.5, fontWeight: '800', color: COLORS.noir },
  pastille: { minWidth: 18, height: 18, borderRadius: 9, paddingHorizontal: 5, backgroundColor: COLORS.noir, alignItems: 'center', justifyContent: 'center' },
  pastilleTexte: { color: COLORS.or, fontSize: 11, fontWeight: '800' },
  panneau: { borderTopWidth: 1, borderTopColor: '#F0EDE6', paddingVertical: 6 },
  groupeLigne: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingRight: 14 },
  groupe: { fontSize: 11.5, fontWeight: '800', color: COLORS.gris, textTransform: 'uppercase', letterSpacing: 0.4, paddingHorizontal: 14, paddingTop: 10, paddingBottom: 4 },
  effacer: { fontSize: 12.5, fontWeight: '700', color: COLORS.orFonce, paddingTop: 6 },
  ligne: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 10 },
  ligneTexte: { fontSize: 14, color: COLORS.noir, marginLeft: 2, flexShrink: 1 },
  vignette: { width: 36, height: 36, borderRadius: 8, backgroundColor: COLORS.creme, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  prix: { fontSize: 12.5, fontWeight: '800', color: COLORS.noir },
  compte: { fontSize: 12, color: COLORS.gris },
  aucune: { fontSize: 13, color: COLORS.gris, paddingHorizontal: 14, paddingVertical: 10, lineHeight: 18 },
});
