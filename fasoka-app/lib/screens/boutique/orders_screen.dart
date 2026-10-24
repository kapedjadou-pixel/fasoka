import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_theme.dart';
import '../../core/api/api_client.dart';
import '../../providers/space_provider.dart';

class OrdersScreen extends StatefulWidget {
  const OrdersScreen({super.key});

  @override
  State<OrdersScreen> createState() => _OrdersScreenState();
}

class _OrdersScreenState extends State<OrdersScreen> {
  List<dynamic> _commandes = [];
  bool _chargement = true;

  final _prochainStatut = {
    'en_attente': 'confirmee',
    'confirmee': 'en_preparation',
    'en_preparation': 'prete',
    'prete': 'livree',
  };

  final _libelles = {
    'en_attente': 'En attente', 'confirmee': 'Confirmée', 'en_preparation': 'En préparation',
    'prete': 'Prête', 'livree': 'Livrée', 'annulee': 'Annulée',
  };

  @override
  void initState() {
    super.initState();
    _charger();
  }

  Future<void> _charger() async {
    final shopId = context.read<SpaceProvider>().maBoutique?.id;
    if (shopId == null) return;
    try {
      final data = await ApiClient.get('/orders/shop/$shopId');
      setState(() => _commandes = data as List);
    } catch (_) {
    } finally {
      setState(() => _chargement = false);
    }
  }

  Future<void> _avancerStatut(String orderId, String statutActuel) async {
    final nouveauStatut = _prochainStatut[statutActuel];
    if (nouveauStatut == null) return;
    try {
      await ApiClient.patch('/orders/$orderId/statut', {'statut': nouveauStatut});
      _charger();
    } on ApiException catch (e) {
      if (mounted) ScaffoldMessenger.of(context).showSnackBar(SnackBar(content: Text(e.message)));
    }
  }

  @override
  Widget build(BuildContext context) {
    if (_chargement) return const Center(child: CircularProgressIndicator());
    if (_commandes.isEmpty) return const Center(child: Text('Aucune commande reçue.'));

    return RefreshIndicator(
      onRefresh: _charger,
      child: ListView.builder(
        padding: const EdgeInsets.all(12),
        itemCount: _commandes.length,
        itemBuilder: (context, index) {
          final c = _commandes[index];
          final statut = c['statut'];
          final peutAvancer = _prochainStatut.containsKey(statut);
          return Card(
            child: Padding(
              padding: const EdgeInsets.all(12),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('${c['prenom']} ${c['nom']}', style: const TextStyle(fontWeight: FontWeight.bold)),
                  Text('${c['telephone'] ?? ''}', style: const TextStyle(color: AppColors.grisTexte)),
                  const SizedBox(height: 6),
                  Row(
                    mainAxisAlignment: MainAxisAlignment.spaceBetween,
                    children: [
                      Text('${double.tryParse(c['montant_total'].toString())?.toStringAsFixed(0) ?? 0} F CFA',
                          style: const TextStyle(fontWeight: FontWeight.bold, color: AppColors.rouge)),
                      Chip(label: Text(_libelles[statut] ?? statut)),
                    ],
                  ),
                  if (peutAvancer) ...[
                    const SizedBox(height: 8),
                    SizedBox(
                      width: double.infinity,
                      child: OutlinedButton(
                        onPressed: () => _avancerStatut(c['id'], statut),
                        child: Text('Marquer comme "${_libelles[_prochainStatut[statut]]}"'),
                      ),
                    ),
                  ],
                ],
              ),
            ),
          );
        },
      ),
    );
  }
}
