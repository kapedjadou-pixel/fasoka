import 'package:flutter/material.dart';
import '../../core/theme/app_theme.dart';
import '../../core/api/api_client.dart';
import '../../models/order.dart';

class HistoryScreen extends StatefulWidget {
  const HistoryScreen({super.key});

  @override
  State<HistoryScreen> createState() => _HistoryScreenState();
}

class _HistoryScreenState extends State<HistoryScreen> {
  List<ShopOrder> _commandes = [];
  bool _chargement = true;

  @override
  void initState() {
    super.initState();
    _charger();
  }

  Future<void> _charger() async {
    try {
      final data = await ApiClient.get('/orders/mine');
      setState(() => _commandes = (data as List).map((o) => ShopOrder.fromJson(o)).toList());
    } catch (_) {
      // silencieux : liste vide affichée si erreur
    } finally {
      setState(() => _chargement = false);
    }
  }

  Color _couleurStatut(String statut) {
    switch (statut) {
      case 'livree': return Colors.green;
      case 'annulee': return AppColors.rouge;
      case 'en_attente': return Colors.orange;
      default: return AppColors.or;
    }
  }

  String _libelleStatut(String statut) {
    const libelles = {
      'en_attente': 'En attente', 'confirmee': 'Confirmée', 'en_preparation': 'En préparation',
      'prete': 'Prête', 'livree': 'Livrée', 'annulee': 'Annulée',
    };
    return libelles[statut] ?? statut;
  }

  @override
  Widget build(BuildContext context) {
    if (_chargement) return const Center(child: CircularProgressIndicator());
    if (_commandes.isEmpty) return const Center(child: Text('Aucune commande pour le moment.'));

    return RefreshIndicator(
      onRefresh: _charger,
      child: ListView.builder(
        padding: const EdgeInsets.all(12),
        itemCount: _commandes.length,
        itemBuilder: (context, index) {
          final commande = _commandes[index];
          return Card(
            child: ListTile(
              title: Text(commande.nomBoutique ?? 'Boutique'),
              subtitle: Text('${commande.montantTotal.toStringAsFixed(0)} F CFA'),
              trailing: Chip(
                label: Text(_libelleStatut(commande.statut), style: const TextStyle(color: Colors.white, fontSize: 12)),
                backgroundColor: _couleurStatut(commande.statut),
              ),
            ),
          );
        },
      ),
    );
  }
}
