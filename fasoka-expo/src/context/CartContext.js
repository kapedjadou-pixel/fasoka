import React, { createContext, useContext, useState, useCallback, useMemo, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import ModaleConfirmation from '../components/ModaleConfirmation';

const CartContext = createContext(null);

// On ne garde dans le panier que ce qui sert à l'afficher et à commander
function produitCompact(p) {
  return {
    id: p.id,
    nom: p.nom,
    prix: Number(p.prix),
    shop_id: p.shop_id,
    stock_quantite: p.stock_quantite,
    images: (p.images || []).filter((i) => typeof i === 'string').slice(0, 1),
    nom_boutique: p.nom_boutique || null,
    ville: p.ville || null,
  };
}

// Stock maximum commandable (sans limite connue : pas de plafond)
function plafondDe(produit) {
  const stock = Number(produit.stock_quantite);
  return Number.isFinite(stock) && stock > 0 ? stock : Infinity;
}

// Le panier est gardé sur l'appareil (par compte) : il survit à la fermeture de l'application.
// Un panier ne concerne qu'une seule boutique à la fois.
export function CartProvider({ children }) {
  const { user } = useAuth();
  const cle = user ? `fasoka_panier_${user.id}` : null;
  const [items, setItems] = useState([]); // { product, qte }
  const [shopId, setShopId] = useState(null);
  const [cleChargee, setCleChargee] = useState(null); // clé de stockage dont le contenu a été lu

  // Lecture du panier enregistré au démarrage ou quand le compte change
  useEffect(() => {
    let annule = false;
    setCleChargee(null);
    setItems([]);
    setShopId(null);
    if (!cle) return undefined;
    AsyncStorage.getItem(cle)
      .then((brut) => {
        if (annule || !brut) return;
        try {
          const donnees = JSON.parse(brut);
          if (Array.isArray(donnees.items)) {
            setItems(donnees.items.filter((i) => i && i.product && i.product.id && i.qte > 0));
            setShopId(donnees.shopId || null);
          }
        } catch (e) {
          // panier enregistré illisible : on repart d'un panier vide
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!annule) setCleChargee(cle);
      });
    return () => { annule = true; };
  }, [cle]);

  // Enregistrement à chaque changement (jamais avant d'avoir lu : on n'écrase pas le panier gardé)
  useEffect(() => {
    if (!cle || cleChargee !== cle) return;
    AsyncStorage.setItem(cle, JSON.stringify({ items, shopId })).catch(() => {});
  }, [cle, cleChargee, items, shopId]);

  // `quantite` : nombre d'exemplaires à ajouter (1 par défaut). Le total d'un produit ne dépasse pas son stock.
  const ajouter = useCallback((produit, quantite = 1) => {
    const plafond = plafondDe(produit);
    const compact = produitCompact(produit);
    setItems((prev) => {
      let base = prev;
      // Un panier = une seule boutique à la fois
      if (shopId && shopId !== produit.shop_id) base = [];
      const existant = base.find((i) => i.product.id === produit.id);
      if (existant) {
        return base.map((i) =>
          i.product.id === produit.id ? { ...i, product: compact, qte: Math.min(i.qte + quantite, plafond) } : i
        );
      }
      return [...base, { product: compact, qte: Math.min(quantite, plafond) }];
    });
    setShopId(produit.shop_id);
  }, [shopId]);

  const changerQuantite = useCallback((productId, qte) => {
    setItems((prev) => {
      if (qte <= 0) return prev.filter((i) => i.product.id !== productId);
      return prev.map((i) => (i.product.id === productId ? { ...i, qte: Math.min(qte, plafondDe(i.product)) } : i));
    });
  }, []);

  const supprimer = useCallback((productId) => {
    setItems((prev) => prev.filter((i) => i.product.id !== productId));
  }, []);

  const vider = useCallback(() => {
    setItems([]);
    setShopId(null);
  }, []);

  // Panier vide : plus de boutique associée
  useEffect(() => {
    if (items.length === 0 && shopId) setShopId(null);
  }, [items.length, shopId]);

  const total = useMemo(() => items.reduce((s, i) => s + Number(i.product.prix) * i.qte, 0), [items]);
  const nombreArticles = useMemo(() => items.reduce((s, i) => s + i.qte, 0), [items]);

  return (
    <CartContext.Provider value={{ items, shopId, ajouter, changerQuantite, supprimer, vider, total, nombreArticles }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}

// Ajout au panier avec contrôle : si le panier contient déjà des articles d'une autre boutique, on demande confirmation
// avant de le vider (il ne peut y avoir qu'une boutique par commande). `modale` est à afficher dans l'écran appelant.
// `surAjout` est appelé quand le produit a réellement été ajouté (tout de suite, ou après confirmation).
export function useAjoutPanier() {
  const { ajouter, items, shopId } = useCart();
  const [attente, setAttente] = useState(null);

  const demanderAjout = useCallback((produit, quantite = 1, surAjout) => {
    if (items.length > 0 && shopId && shopId !== produit.shop_id) {
      setAttente({ produit, quantite, surAjout });
      return false;
    }
    ajouter(produit, quantite);
    if (surAjout) surAjout();
    return true;
  }, [ajouter, items.length, shopId]);

  const nombre = items.reduce((s, i) => s + i.qte, 0);
  const nomBoutique = items[0] && items[0].product.nom_boutique ? items[0].product.nom_boutique : 'une autre boutique';

  const modale = (
    <ModaleConfirmation
      visible={Boolean(attente)}
      titre="Remplacer votre panier ?"
      message={`Votre panier contient ${nombre} article${nombre > 1 ? 's' : ''} de ${nomBoutique}. Une commande ne concerne qu'une seule boutique : ajouter ce produit videra le panier actuel.`}
      libelleConfirmer="Remplacer le panier"
      onConfirmer={() => {
        if (attente) {
          ajouter(attente.produit, attente.quantite);
          if (attente.surAjout) attente.surAjout();
        }
        setAttente(null);
      }}
      onAnnuler={() => setAttente(null)}
    />
  );

  return { demanderAjout, modale };
}
