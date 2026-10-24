import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_theme.dart';
import '../../core/api/api_client.dart';
import '../../models/shop.dart';
import '../../providers/space_provider.dart';
import 'boutique_dashboard_screen.dart';

class ShopCreationScreen extends StatefulWidget {
  const ShopCreationScreen({super.key});

  @override
  State<ShopCreationScreen> createState() => _ShopCreationScreenState();
}

class _ShopCreationScreenState extends State<ShopCreationScreen> {
  final _nomController = TextEditingController();
  final _descriptionController = TextEditingController();
  bool _chargement = false;
  String? _erreur;

  Future<void> _creerBoutique() async {
    if (_nomController.text.trim().isEmpty) {
      setState(() => _erreur = 'Le nom de la boutique est obligatoire.');
      return;
    }
    setState(() { _chargement = true; _erreur = null; });
    try {
      final data = await ApiClient.post('/shops', {
        'nom_boutique': _nomController.text.trim(),
        'description': _descriptionController.text.trim(),
      });
      final shop = Shop.fromJson(data);
      if (mounted) {
        final spaceProvider = context.read<SpaceProvider>();
        spaceProvider.definirMaBoutique(shop);
        spaceProvider.basculerVersBoutique();
        Navigator.of(context).pushAndRemoveUntil(
          MaterialPageRoute(builder: (_) => const BoutiqueDashboardScreen()),
          (route) => false,
        );
      }
    } on ApiException catch (e) {
      setState(() => _erreur = e.message);
    } catch (e) {
      setState(() => _erreur = 'Impossible de créer la boutique.');
    } finally {
      if (mounted) setState(() => _chargement = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(title: const Text('Créer ma boutique')),
      body: Padding(
        padding: const EdgeInsets.all(24),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.stretch,
          children: [
            const Text('Donne un nom à ta boutique pour commencer à vendre sur Fasoka.',
                style: TextStyle(color: AppColors.grisTexte)),
            const SizedBox(height: 24),
            TextField(controller: _nomController,
                decoration: const InputDecoration(hintText: 'Nom de la boutique *')),
            const SizedBox(height: 12),
            TextField(controller: _descriptionController, maxLines: 3,
                decoration: const InputDecoration(hintText: 'Description (optionnel)')),
            if (_erreur != null) ...[
              const SizedBox(height: 12),
              Text(_erreur!, style: const TextStyle(color: AppColors.rouge)),
            ],
            const SizedBox(height: 24),
            ElevatedButton(
              onPressed: _chargement ? null : _creerBoutique,
              child: _chargement
                  ? const SizedBox(height: 20, width: 20,
                      child: CircularProgressIndicator(strokeWidth: 2, color: AppColors.noir))
                  : const Text('Créer ma boutique'),
            ),
          ],
        ),
      ),
    );
  }
}
