import 'package:flutter/material.dart';
import '../models/shop.dart';

enum AppSpace { client, boutique }

/// Gère la bascule entre l'espace client et l'espace boutique,
/// comme un profil / une page sur Facebook.
class SpaceProvider extends ChangeNotifier {
  AppSpace _espaceActif = AppSpace.client;
  Shop? _maBoutique; // null si l'utilisateur n'a pas encore créé de boutique

  AppSpace get espaceActif => _espaceActif;
  Shop? get maBoutique => _maBoutique;
  bool get aUneBoutique => _maBoutique != null;

  void definirMaBoutique(Shop? shop) {
    _maBoutique = shop;
    notifyListeners();
  }

  void basculerVersClient() {
    _espaceActif = AppSpace.client;
    notifyListeners();
  }

  void basculerVersBoutique() {
    if (_maBoutique != null) {
      _espaceActif = AppSpace.boutique;
      notifyListeners();
    }
  }
}
