import 'package:flutter/material.dart';
import 'package:provider/provider.dart';
import '../../core/theme/app_theme.dart';
import '../../core/api/api_client.dart';
import '../../providers/space_provider.dart';
import '../../widgets/space_switcher.dart';
import 'catalog_screen.dart';
import 'orders_screen.dart';

class BoutiqueDashboardScreen extends StatefulWidget {
  const BoutiqueDashboardScreen({super.key});

  @override
  State<BoutiqueDashboardScreen> createState() => _BoutiqueDashboardScreenState();
}

class _BoutiqueDashboardScreenState extends State<BoutiqueDashboardScreen> {
  int _ongletActif = 0;
  Map<String, dynamic>? _stats;
  bool _chargement = true;

  @override
  void initState() {
    super.initState();
    _chargerStats();
  }

  Future<void> _chargerStats() async {
    final shopId = context.read<SpaceProvider>().maBoutique?.id;
    if (shopId == null) return;
    try {
      final data = await ApiClient.get('/shops/$shopId/stats');
      setState(() => _stats = data);
    } catch (_) {
      // stats non bloquantes
    } finally {
      setState(() => _chargement = false);
    }
  }

  Widget _tuileStat(String titre, String valeur, IconData icone) {
    return Expanded(
      child: Card(
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Icon(icone, color: AppColors.or),
              const SizedBox(height: 8),
              Text(valeur, style: const TextStyle(fontSize: 20, fontWeight: FontWeight.bold)),
              Text(titre, style: const TextStyle(fontSize: 12, color: AppColors.grisTexte)),
            ],
          ),
        ),
      ),
    );
  }

  Widget _corpsTableauDeBord() {
    final shop = context.watch<SpaceProvider>().maBoutique;
    if (_chargement) return const Center(child: CircularProgressIndicator());

    return RefreshIndicator(
      onRefresh: _chargerStats,
      child: ListView(
        padding: const EdgeInsets.all(16),
        children: [
          Text(shop?.nomBoutique ?? '', style: const TextStyle(fontSize: 22, fontWeight: FontWeight.bold)),
          Text(shop?.plan == 'pro' ? 'Plan Pro' : 'Plan Gratuit',
              style: const TextStyle(color: AppColors.grisTexte)),
          const SizedBox(height: 16),
          Row(children: [
            _tuileStat('Ventes totales', '${_stats?['total_ventes'] ?? 0} F', Icons.payments_outlined),
            const SizedBox(width: 10),
            _tuileStat('Commandes en cours', '${_stats?['commandes_en_cours'] ?? 0}', Icons.pending_actions),
          ]),
          const SizedBox(height: 10),
          Row(children: [
            _tuileStat('Produits actifs', '${_stats?['total_produits'] ?? 0}', Icons.inventory_2_outlined),
            const SizedBox(width: 10),
            _tuileStat('Note moyenne', '${_stats?['note_moyenne'] ?? '0.0'} ★', Icons.star_border),
          ]),
          const SizedBox(height: 24),
          if (shop?.plan != 'pro')
            Card(
              color: AppColors.noir,
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Row(
                  children: [
                    const Expanded(
                      child: Text('Passe à Fasoka Pro pour des produits illimités et plus de visibilité.',
                          style: TextStyle(color: Colors.white)),
                    ),
                    TextButton(
                      onPressed: () {},
                      child: const Text('Voir', style: TextStyle(color: AppColors.or, fontWeight: FontWeight.bold)),
                    ),
                  ],
                ),
              ),
            ),
        ],
      ),
    );
  }

  @override
  Widget build(BuildContext context) {
    final ecrans = [_corpsTableauDeBord(), const CatalogScreen(), const OrdersScreen()];

    return Scaffold(
      appBar: AppBar(
        title: const Text('Ma Boutique'),
        actions: const [SpaceSwitcher(), SizedBox(width: 8)],
      ),
      body: ecrans[_ongletActif],
      bottomNavigationBar: BottomNavigationBar(
        currentIndex: _ongletActif,
        onTap: (i) => setState(() => _ongletActif = i),
        items: const [
          BottomNavigationBarItem(icon: Icon(Icons.dashboard_outlined), label: 'Tableau de bord'),
          BottomNavigationBarItem(icon: Icon(Icons.inventory_2_outlined), label: 'Catalogue'),
          BottomNavigationBarItem(icon: Icon(Icons.receipt_long_outlined), label: 'Commandes'),
        ],
      ),
    );
  }
}
