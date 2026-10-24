import 'package:flutter/material.dart';
import '../models/product.dart';
import '../models/order.dart';

class CartProvider extends ChangeNotifier {
  final List<CartItem> _items = [];
  String? _shopId; // le panier ne contient des produits que d'une seule boutique à la fois

  List<CartItem> get items => _items;
  String? get shopId => _shopId;

  double get total => _items.fold(0, (sum, item) => sum + item.sousTotal);
  int get nombreArticles => _items.fold(0, (sum, item) => sum + item.quantite);

  void ajouter(Product product) {
    if (_shopId != null && _shopId != product.shopId) {
      // Un panier = une seule boutique. On vide avant d'ajouter d'un autre vendeur.
      _items.clear();
    }
    _shopId = product.shopId;

    final existant = _items.indexWhere((i) => i.product.id == product.id);
    if (existant >= 0) {
      _items[existant].quantite++;
    } else {
      _items.add(CartItem(product: product));
    }
    notifyListeners();
  }

  void retirer(String productId) {
    _items.removeWhere((i) => i.product.id == productId);
    if (_items.isEmpty) _shopId = null;
    notifyListeners();
  }

  void changerQuantite(String productId, int quantite) {
    final item = _items.firstWhere((i) => i.product.id == productId);
    if (quantite <= 0) {
      retirer(productId);
    } else {
      item.quantite = quantite;
      notifyListeners();
    }
  }

  void vider() {
    _items.clear();
    _shopId = null;
    notifyListeners();
  }
}
