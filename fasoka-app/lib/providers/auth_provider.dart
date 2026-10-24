import 'package:flutter/material.dart';
import 'package:shared_preferences/shared_preferences.dart';
import '../core/api/api_client.dart';
import '../models/user.dart';

class AuthProvider extends ChangeNotifier {
  AppUser? _user;
  String? _token;

  AppUser? get user => _user;
  bool get isLoggedIn => _user != null;

  Future<void> chargerSessionSauvegardee() async {
    final prefs = await SharedPreferences.getInstance();
    _token = prefs.getString('auth_token');
    final userJson = prefs.getString('user_data');
    if (_token != null && userJson != null) {
      // La session existe déjà côté client ; on pourrait valider le token ici via un appel API.
      notifyListeners();
    }
  }

  Future<void> inscription({
    required String nom,
    required String prenom,
    String? email,
    String? telephone,
    required String motDePasse,
  }) async {
    final data = await ApiClient.post('/auth/signup', {
      'nom': nom,
      'prenom': prenom,
      if (email != null) 'email': email,
      if (telephone != null) 'telephone': telephone,
      'mot_de_passe': motDePasse,
    });
    await _sauvegarderSession(data);
  }

  Future<void> connexion({required String identifiant, required String motDePasse}) async {
    final data = await ApiClient.post('/auth/login', {
      'identifiant': identifiant,
      'mot_de_passe': motDePasse,
    });
    await _sauvegarderSession(data);
  }

  Future<void> _sauvegarderSession(Map<String, dynamic> data) async {
    _token = data['token'];
    _user = AppUser.fromJson(data['user']);
    final prefs = await SharedPreferences.getInstance();
    await prefs.setString('auth_token', _token!);
    await prefs.setString('user_data', _user!.id);
    notifyListeners();
  }

  Future<void> deconnexion() async {
    _user = null;
    _token = null;
    final prefs = await SharedPreferences.getInstance();
    await prefs.remove('auth_token');
    await prefs.remove('user_data');
    notifyListeners();
  }
}
