import React, { useEffect, useState } from 'react';
import {
  View, Text, TextInput, ScrollView, Image, TouchableOpacity, ActivityIndicator, StyleSheet, useWindowDimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { COLORS } from '../../theme/colors';
import { ApiClient, ApiException } from '../../api/apiClient';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import ModaleConfirmation from '../../components/ModaleConfirmation';
import { fcfa, pluriel } from '../../components/dashboard/format';
import { numeroCommande } from '../../components/commandes/format';

const MODES = [
  { cle: 'retrait', titre: 'Retrait en boutique', detail: 'Gratuit · vous récupérez la commande chez le vendeur', icone: 'storefront-outline' },
  { cle: 'livraison_vendeur', titre: 'Livraison par le vendeur', detail: 'Frais à convenir avec le vendeur', icone: 'bicycle-outline' },
];

// Panier : articles (photo, quantité, suppression), mode de réception, paiement, récapitulatif et envoi de la commande.
// Une commande concerne une seule boutique. Le seul paiement proposé est « à la réception » (espèces) : le paiement
// mobile n'est pas encore disponible.
export default function CartScreen({ navigation }) {
  const { items, shopId, changerQuantite, supprimer, vider, total, nombreArticles } = useCart();
  const { user } = useAuth();
  const { width } = useWindowDimensions();
  const large = width >= 900;

  const [mode, setMode] = useState('retrait');
  const [adresse, setAdresse] = useState('');
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState(null);
  const [confirmation, setConfirmation] = useState(null); // commande envoyée
  const [viderOuvert, setViderOuvert] = useState(false);

  const cleAdresse = user ? `fasoka_adresse_livraison_${user.id}` : null;

  // Dernière adresse de livraison utilisée, gardée sur l'appareil
  useEffect(() => {
    if (!cleAdresse) return;
    AsyncStorage.getItem(cleAdresse).then((a) => { if (a) setAdresse((actuelle) => actuelle || a); }).catch(() => {});
  }, [cleAdresse]);

  const nomBoutique = items[0] && items[0].product.nom_boutique ? items[0].product.nom_boutique : 'la boutique';

  async function commander() {
    setErreur(null);
    if (items.length === 0 || !shopId) return;
    if (mode === 'livraison_vendeur' && adresse.trim().length < 5) {
      setErreur("Indiquez l'adresse de livraison (quartier, rue, repère).");
      return;
    }
    setEnvoi(true);
    try {
      const corps = {
        shop_id: shopId,
        mode_livraison: mode,
        operateur: 'especes',
        items: items.map((i) => ({ product_id: i.product.id, quantite: i.qte })),
      };
      if (mode === 'livraison_vendeur') corps.adresse_livraison = adresse.trim();
      const donnees = await ApiClient.post('/orders', corps);
      if (mode === 'livraison_vendeur' && cleAdresse) AsyncStorage.setItem(cleAdresse, adresse.trim()).catch(() => {});
      setConfirmation({ id: donnees.order.id, montant: Number(donnees.order.montant_total) || total, boutique: nomBoutique, mode });
      vider();
    } catch (e) {
      setErreur(e instanceof ApiException ? e.message : 'Impossible d’envoyer la commande. Vérifiez votre connexion internet.');
    } finally {
      setEnvoi(false);
    }
  }

  // ----- Commande envoyée -----
  if (confirmation) {
    return (
      <ScrollView style={styles.page} contentContainerStyle={styles.centrage}>
        <View style={styles.succes}>
          <View style={styles.succesRond}><Ionicons name="checkmark" size={38} color={COLORS.blanc} /></View>
          <Text style={styles.succesTitre}>Commande envoyée !</Text>
          <Text style={styles.succesTexte}>
            Votre commande n° {numeroCommande(confirmation.id)} chez {confirmation.boutique} a bien été transmise.
            La boutique va la confirmer : vous pouvez suivre chaque étape dans l’onglet Historique.
          </Text>
          <View style={styles.succesLigne}>
            <Text style={styles.succesLibelle}>Total à payer à la réception</Text>
            <Text style={styles.succesValeur}>{fcfa(confirmation.montant)}</Text>
          </View>
          <Text style={styles.succesLibelle}>{confirmation.mode === 'retrait' ? 'Retrait en boutique' : 'Livraison par le vendeur'}</Text>

          <TouchableOpacity
            style={styles.boutonPrincipal}
            onPress={() => { const id = confirmation.id; setConfirmation(null); navigation.navigate('Historique', { ouvrir: id, cle: Date.now() }); }}
            accessibilityRole="button"
          >
            <Text style={styles.boutonPrincipalTexte}>Voir ma commande</Text>
          </TouchableOpacity>
          <TouchableOpacity style={styles.boutonSecondaire} onPress={() => { setConfirmation(null); navigation.navigate('Accueil'); }} accessibilityRole="button">
            <Text style={styles.boutonSecondaireTexte}>Continuer mes achats</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    );
  }

  // ----- Panier vide -----
  if (items.length === 0) {
    return (
      <View style={[styles.page, styles.centrage]}>
        <Ionicons name="cart-outline" size={56} color={COLORS.gris} />
        <Text style={styles.videTitre}>Votre panier est vide</Text>
        <Text style={styles.videTexte}>Parcourez les produits des boutiques et ajoutez ce qui vous plaît.</Text>
        <TouchableOpacity style={[styles.boutonPrincipal, { alignSelf: 'center', minWidth: 200 }]} onPress={() => navigation.navigate('Accueil')} accessibilityRole="button">
          <Text style={styles.boutonPrincipalTexte}>Voir les produits</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const articles = (
    <View style={styles.carte}>
      <View style={styles.carteEntete}>
        <View style={{ flex: 1 }}>
          <Text style={styles.carteTitre}>Mes articles</Text>
          <Text style={styles.carteSous}>{pluriel(nombreArticles, 'article')} · {nomBoutique}</Text>
        </View>
        <TouchableOpacity onPress={() => setViderOuvert(true)} accessibilityRole="button" accessibilityLabel="Vider le panier">
          <Text style={styles.lienRouge}>Vider</Text>
        </TouchableOpacity>
      </View>

      {items.map((i) => {
        const stock = Number(i.product.stock_quantite);
        const maximum = Number.isFinite(stock) && stock > 0 ? stock : 99;
        const auMax = i.qte >= maximum;
        return (
          <View key={i.product.id} style={styles.article}>
            <View style={styles.photo}>
              {i.product.images && i.product.images[0] ? (
                <Image source={{ uri: i.product.images[0] }} style={{ width: '100%', height: '100%' }} />
              ) : (
                <Ionicons name="cube-outline" size={24} color={COLORS.gris} />
              )}
            </View>
            <View style={{ flex: 1 }}>
              <Text numberOfLines={2} style={styles.articleNom}>{i.product.nom}</Text>
              <Text style={styles.articlePrix}>{fcfa(i.product.prix)}</Text>
              <View style={styles.quantiteLigne}>
                <View style={styles.quantite}>
                  <TouchableOpacity onPress={() => changerQuantite(i.product.id, i.qte - 1)} style={styles.quantiteBouton} accessibilityRole="button" accessibilityLabel={`Diminuer la quantité de ${i.product.nom}`}>
                    <Ionicons name="remove" size={16} color={COLORS.noir} />
                  </TouchableOpacity>
                  <Text style={styles.quantiteValeur}>{i.qte}</Text>
                  <TouchableOpacity
                    onPress={() => changerQuantite(i.product.id, i.qte + 1)}
                    disabled={auMax}
                    style={[styles.quantiteBouton, auMax && { opacity: 0.35 }]}
                    accessibilityRole="button"
                    accessibilityLabel={`Augmenter la quantité de ${i.product.nom}`}
                  >
                    <Ionicons name="add" size={16} color={COLORS.noir} />
                  </TouchableOpacity>
                </View>
                <TouchableOpacity onPress={() => supprimer(i.product.id)} style={styles.supprimer} accessibilityRole="button" accessibilityLabel={`Retirer ${i.product.nom} du panier`}>
                  <Ionicons name="trash-outline" size={18} color={COLORS.rouge} />
                </TouchableOpacity>
              </View>
              {auMax && Number.isFinite(stock) && stock > 0 ? <Text style={styles.stockMax}>Stock maximum atteint ({stock})</Text> : null}
            </View>
            <Text style={styles.articleTotal}>{fcfa(i.product.prix * i.qte)}</Text>
          </View>
        );
      })}
    </View>
  );

  const reception = (
    <View style={styles.carte}>
      <Text style={styles.carteTitre}>Réception de la commande</Text>
      {MODES.map((m) => {
        const actif = mode === m.cle;
        return (
          <TouchableOpacity
            key={m.cle}
            style={[styles.choix, actif && styles.choixActif]}
            onPress={() => { setMode(m.cle); setErreur(null); }}
            accessibilityRole="radio"
            accessibilityState={{ selected: actif }}
          >
            <Ionicons name={m.icone} size={22} color={COLORS.noir} />
            <View style={{ flex: 1, marginLeft: 12 }}>
              <Text style={styles.choixTitre}>{m.titre}</Text>
              <Text style={styles.choixDetail}>{m.detail}</Text>
            </View>
            <Ionicons name={actif ? 'radio-button-on' : 'radio-button-off'} size={22} color={actif ? COLORS.orFonce : COLORS.gris} />
          </TouchableOpacity>
        );
      })}
      {mode === 'livraison_vendeur' ? (
        <View style={{ marginTop: 10 }}>
          <Text style={styles.etiquette}>Adresse de livraison *</Text>
          <TextInput
            style={[styles.champ, { minHeight: 70 }]}
            value={adresse}
            onChangeText={setAdresse}
            placeholder="Quartier, rue, repère (près de…)"
            placeholderTextColor={COLORS.gris}
            multiline
            textAlignVertical="top"
            maxLength={300}
          />
        </View>
      ) : null}
    </View>
  );

  const paiement = (
    <View style={styles.carte}>
      <Text style={styles.carteTitre}>Paiement</Text>
      <View style={[styles.choix, styles.choixActif]}>
        <Ionicons name="cash-outline" size={22} color={COLORS.noir} />
        <View style={{ flex: 1, marginLeft: 12 }}>
          <Text style={styles.choixTitre}>Paiement à la réception</Text>
          <Text style={styles.choixDetail}>Espèces, remis au vendeur lors du retrait ou de la livraison</Text>
        </View>
        <Ionicons name="checkmark-circle" size={22} color={COLORS.orFonce} />
      </View>
      <Text style={styles.note}>Le paiement mobile (Mixx, Flooz) n’est pas encore disponible.</Text>
    </View>
  );

  const recapitulatif = (
    <View style={styles.carte}>
      <Text style={styles.carteTitre}>Récapitulatif</Text>
      <View style={styles.recapLigne}>
        <Text style={styles.recapLibelle}>Sous-total ({pluriel(nombreArticles, 'article')})</Text>
        <Text style={styles.recapValeur}>{fcfa(total)}</Text>
      </View>
      <View style={styles.recapLigne}>
        <Text style={styles.recapLibelle}>Livraison</Text>
        <Text style={styles.recapValeur}>{mode === 'retrait' ? 'Gratuit (retrait)' : 'À convenir'}</Text>
      </View>
      <View style={[styles.recapLigne, styles.recapTotal]}>
        <Text style={styles.totalLibelle}>Total</Text>
        <Text style={styles.totalValeur}>{fcfa(total)}</Text>
      </View>

      {erreur ? (
        <View style={styles.erreur} accessibilityLiveRegion="polite">
          <Ionicons name="alert-circle" size={18} color={COLORS.rouge} style={{ marginRight: 8 }} />
          <Text style={styles.erreurTexte}>{erreur}</Text>
        </View>
      ) : null}

      <TouchableOpacity style={[styles.boutonPrincipal, envoi && { opacity: 0.7 }]} onPress={commander} disabled={envoi} accessibilityRole="button">
        {envoi ? <ActivityIndicator color={COLORS.noir} /> : <Text style={styles.boutonPrincipalTexte}>Commander · {fcfa(total)}</Text>}
      </TouchableOpacity>
      <Text style={styles.note}>La boutique confirmera votre commande. Vous ne payez qu’à la réception.</Text>
    </View>
  );

  return (
    <ScrollView style={styles.page} contentContainerStyle={{ paddingBottom: 40 }} keyboardShouldPersistTaps="handled">
      <View style={styles.contenu}>
        <Text style={styles.titrePage}>Mon panier</Text>
        {large ? (
          <View style={{ flexDirection: 'row', gap: 16, alignItems: 'flex-start' }}>
            <View style={{ flex: 1.6 }}>{articles}{reception}{paiement}</View>
            <View style={{ flex: 1 }}>{recapitulatif}</View>
          </View>
        ) : (
          <>{articles}{reception}{paiement}{recapitulatif}</>
        )}
      </View>

      <ModaleConfirmation
        visible={viderOuvert}
        titre="Vider le panier ?"
        message="Tous les articles seront retirés de votre panier."
        libelleConfirmer="Vider le panier"
        destructif
        onConfirmer={() => { vider(); setViderOuvert(false); }}
        onAnnuler={() => setViderOuvert(false)}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, backgroundColor: COLORS.creme },
  centrage: { flexGrow: 1, alignItems: 'center', justifyContent: 'center', padding: 24 },
  contenu: { width: '100%', maxWidth: 1000, alignSelf: 'center', padding: 16 },
  titrePage: { fontSize: 22, fontWeight: '900', color: COLORS.noir, marginBottom: 12 },
  carte: { backgroundColor: COLORS.blanc, borderRadius: 14, padding: 16, marginBottom: 14, borderWidth: 1, borderColor: '#EFECE4' },
  carteEntete: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  carteTitre: { fontSize: 15.5, fontWeight: '900', color: COLORS.noir },
  carteSous: { fontSize: 12.5, color: COLORS.gris, marginTop: 2 },
  lienRouge: { fontSize: 13, fontWeight: '700', color: COLORS.rouge },

  article: { flexDirection: 'row', alignItems: 'flex-start', paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F3F0E9' },
  photo: { width: 70, height: 70, borderRadius: 12, backgroundColor: COLORS.creme, alignItems: 'center', justifyContent: 'center', overflow: 'hidden', marginRight: 12 },
  articleNom: { fontSize: 14, fontWeight: '700', color: COLORS.noir },
  articlePrix: { fontSize: 12.5, color: COLORS.gris, marginTop: 2 },
  articleTotal: { fontSize: 14, fontWeight: '800', color: COLORS.noir, marginLeft: 8 },
  quantiteLigne: { flexDirection: 'row', alignItems: 'center', marginTop: 8 },
  quantite: { flexDirection: 'row', alignItems: 'center', backgroundColor: COLORS.creme, borderRadius: 10 },
  quantiteBouton: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  quantiteValeur: { minWidth: 24, textAlign: 'center', fontSize: 14.5, fontWeight: '800', color: COLORS.noir },
  supprimer: { marginLeft: 12, width: 34, height: 34, alignItems: 'center', justifyContent: 'center' },
  stockMax: { fontSize: 11.5, color: COLORS.orFonce, marginTop: 4, fontWeight: '600' },

  choix: { flexDirection: 'row', alignItems: 'center', borderWidth: 1.5, borderColor: '#E6E2D8', borderRadius: 12, padding: 12, marginTop: 10 },
  choixActif: { borderColor: COLORS.or, backgroundColor: '#FFFBEF' },
  choixTitre: { fontSize: 14, fontWeight: '800', color: COLORS.noir },
  choixDetail: { fontSize: 12, color: COLORS.gris, marginTop: 2, lineHeight: 16 },
  etiquette: { fontSize: 12.5, fontWeight: '700', color: COLORS.noir, marginBottom: 6 },
  champ: { backgroundColor: COLORS.creme, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14.5, color: COLORS.noir },
  note: { fontSize: 12, color: COLORS.gris, marginTop: 10, lineHeight: 17 },

  recapLigne: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 10 },
  recapLibelle: { fontSize: 13.5, color: COLORS.gris },
  recapValeur: { fontSize: 13.5, fontWeight: '700', color: COLORS.noir },
  recapTotal: { borderTopWidth: 1, borderTopColor: '#F3F0E9', paddingTop: 12, marginTop: 14, alignItems: 'center' },
  totalLibelle: { fontSize: 15, fontWeight: '800', color: COLORS.noir },
  totalValeur: { fontSize: 20, fontWeight: '900', color: COLORS.noir },
  erreur: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#FDECEA', borderRadius: 10, padding: 12, marginTop: 14 },
  erreurTexte: { flex: 1, color: COLORS.rouge, fontSize: 13, lineHeight: 18 },
  boutonPrincipal: { backgroundColor: COLORS.or, borderRadius: 12, paddingVertical: 15, alignItems: 'center', marginTop: 16 },
  boutonPrincipalTexte: { fontSize: 15.5, fontWeight: '800', color: COLORS.noir },
  boutonSecondaire: { borderRadius: 12, paddingVertical: 13, alignItems: 'center', marginTop: 8 },
  boutonSecondaireTexte: { fontSize: 14.5, fontWeight: '700', color: COLORS.noir },

  videTitre: { fontSize: 18, fontWeight: '800', color: COLORS.noir, marginTop: 14 },
  videTexte: { fontSize: 13.5, color: COLORS.gris, textAlign: 'center', marginTop: 6, maxWidth: 300, lineHeight: 19 },

  succes: { width: '100%', maxWidth: 460, backgroundColor: COLORS.blanc, borderRadius: 18, padding: 24, borderWidth: 1, borderColor: '#EFECE4' },
  succesRond: { width: 68, height: 68, borderRadius: 34, backgroundColor: '#15803D', alignItems: 'center', justifyContent: 'center', alignSelf: 'center' },
  succesTitre: { fontSize: 22, fontWeight: '900', color: COLORS.noir, textAlign: 'center', marginTop: 14 },
  succesTexte: { fontSize: 14, color: COLORS.noir, textAlign: 'center', lineHeight: 21, marginTop: 8, marginBottom: 16 },
  succesLigne: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderTopWidth: 1, borderTopColor: '#F3F0E9' },
  succesLibelle: { fontSize: 13.5, color: COLORS.gris },
  succesValeur: { fontSize: 17, fontWeight: '900', color: COLORS.noir },
});
