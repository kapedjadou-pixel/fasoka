import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_theme.dart';
import '../../core/api/api_client.dart';
import '../../providers/auth_provider.dart';
import 'signup_screen.dart';
import '../client/client_home_screen.dart';

class LoginScreen extends StatefulWidget {
  const LoginScreen({super.key});

  @override
  State<LoginScreen> createState() => _LoginScreenState();
}

class _LoginScreenState extends State<LoginScreen> {
  final _identifiantController = TextEditingController();
  final _motDePasseController = TextEditingController();
  bool _chargement = false;
  String? _erreur;

  Future<void> _seConnecter() async {
    setState(() { _chargement = true; _erreur = null; });
    try {
      await context.read<AuthProvider>().connexion(
        identifiant: _identifiantController.text.trim(),
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
      setState(() => _erreur = 'Impossible de se connecter. Vérifie ta connexion internet.');
    } finally {
      if (mounted) setState(() => _chargement = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: AppColors.noir,
      body: SafeArea(
        child: Padding(
          padding: const EdgeInsets.all(24),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.stretch,
            children: [
              const SizedBox(height: 60),
              const Text('FASOKA',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: AppColors.or, fontSize: 36, fontWeight: FontWeight.w900, letterSpacing: 2)),
              const SizedBox(height: 8),
              const Text('Vendez et achetez, simplement.',
                  textAlign: TextAlign.center,
                  style: TextStyle(color: Colors.white70, fontSize: 15)),
              const SizedBox(height: 48),
              TextField(
                controller: _identifiantController,
                style: const TextStyle(color: Colors.black),
                decoration: const InputDecoration(hintText: 'Email ou téléphone'),
              ),
              const SizedBox(height: 12),
              TextField(
                controller: _motDePasseController,
                obscureText: true,
                style: const TextStyle(color: Colors.black),
                decoration: const InputDecoration(hintText: 'Mot de passe'),
              ),
              if (_erreur != null) ...[
                const SizedBox(height: 12),
                Text(_erreur!, style: const TextStyle(color: AppColors.rouge)),
              ],
              const SizedBox(height: 24),
              ElevatedButton(
                onPressed: _chargement ? null : _seConnecter,
                child: _chargement
                    ? const SizedBox(height: 20, width: 20,
                        child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.noir))
                    : const Text('Se connecter'),
              ),
              const SizedBox(height: 16),
              TextButton(
                onPressed: () => Navigator.of(context).push(
                  MaterialPageRoute(builder: (_) => const SignupScreen()),
                ),
                child: const Text('Pas de compte ? Créer un compte',
                    style: TextStyle(color: AppColors.or)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
