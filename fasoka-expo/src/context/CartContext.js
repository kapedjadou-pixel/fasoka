import React, { createContext, useContext, useState, useCallback, useMemo } from 'react';

const CartContext = createContext(null);

export function CartProvider({ children }) {
  const [items, setItems] = useState([]); // { product, qte }
  const [shopId, setShopId] = useState(null);

  const ajouter = useCallback((produit) => {
    setItems((prev) => {
      let base = prev;
      // Un panier = une seule boutique à la fois
      if (shopId && shopId !== produit.shop_id) {
        base = [];
      }
      const existant = base.find((i) => i.product.id === produit.id);
      if (existant) {
        return base.map((i) => (i.product.id === produit.id ? { ...i, qte: i.qte + 1 } : i));
      }
      return [...base, { product: produit, qte: 1 }];
    });
    setShopId(produit.shop_id);
  }, [shopId]);

  const changerQuantite = useCallback((productId, qte) => {
    setItems((prev) => {
      if (qte <= 0) return prev.filter((i) => i.product.id !== productId);
      return prev.map((i) => (i.product.id === productId ? { ...i, qte } : i));
    });
  }, []);

  const vider = useCallback(() => {
    setItems([]);
    setShopId(null);
  }, []);

  const total = useMemo(() => items.reduce((s, i) => s + i.product.prix * i.qte, 0), [items]);
  const nombreArticles = useMemo(() => items.reduce((s, i) => s + i.qte, 0), [items]);

  return (
    <CartContext.Provider value={{ items, shopId, ajouter, changerQuantite, vider, total, nombreArticles }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  return useContext(CartContext);
}
