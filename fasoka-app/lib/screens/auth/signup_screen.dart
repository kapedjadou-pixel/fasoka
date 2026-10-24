import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_theme.dart';
import '../../core/api/api_client.dart';
import '../../providers/auth_provider.dart';
import '../client/client_home_screen.dart';

class SignupScreen extends StatefulWidget {
  const SignupScreen({super.key});

  @override
  State<SignupScreen> createState() => _SignupScreenState();
}

class _SignupScreenState extends State<SignupScreen> {
  final _nomController = TextEditingController();
  final _prenomController = TextEditingController();
  final _emailController = TextEditingController();
  final _motDePasseController = TextEditingController();
  bool _chargement = false;
  String? _erreur;

  Future<void> _creerCompte() async {
    if (_nomController.text.isEmpty || _prenomController.text.isEmpty ||
        _emailController.text.isEmpty || _motDePasseController.text.isEmpty) {
      setState(() => _erreur = 'Tous les champs sont obligatoires.');
      return;
    }
    setState(() { _chargement = true; _erreur = null; });
    try {
      await context.read<AuthProvider>().inscription(
        nom: _nomController.text.trim(),
        prenom: _prenomController.text.trim(),
        email: _emailController.text.trim(),
        motDePasse: _motDePasseController.text,
      );
      if (mounted) {
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => const ClientHomeScreen()),
          (route) => false,
        );
      }
    } on ApiException catch (e) {
      setState(() => _erreur = e.message);
    } catch (e) {
      setState(() => _erreur = 'Impossible de créer le compte. Vérifie ta connexion.');
    } finally {
      if (mounted) setState(() => _chargement = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Créer un compte')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const SizedBox(height: 16),
            TextField(controller: _prenomController, decoration: const InputDecoration(hintText: 'Prénom')),
            const SizedBox(height: 12),
            TextField(controller: _nomController, decoration: const InputDecoration(hintText: 'Nom')),
            const SizedBox(height: 12),
            TextField(controller: _emailController, decoration: const InputDecoration(hintText: 'Email')),
            const SizedBox(height: 12),
            TextField(controller: _motDePasseController, obscureText: true,
                decoration: const InputDecoration(hintText: 'Mot de passe')),
            if (_erreur != null) ...[
              const SizedBox(height: 12),
              Text(_erreur!, style: const TextStyle(color: AppColors.rouge)),
            ],
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: _chargement ? null : _creerCompte,
              child: _chargement
                  ? const SizedBox(height: 20, width: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.noir))
                  : const Text('Créer mon compte'),
            ),
          ],
        ),
      ),
    );
  }
}
