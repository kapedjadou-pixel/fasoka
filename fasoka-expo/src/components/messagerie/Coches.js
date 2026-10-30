import React from 'react';
import { Ionicons } from '@expo/vector-icons';
import { COLORS } from '../../theme/colors';

const GRIS = 'rgba(0,0,0,0.45)';
const BLEU = '#0B63D8'; // « lu »

// Coches d'un message que j'ai envoyé, comme sur WhatsApp :
//  - attente : horloge (envoi en cours) ; echec : point d'exclamation rouge
//  - envoye : une coche grise (enregistré par le serveur)
//  - recu : deux coches grises (la personne a l'application ouverte)
//  - lu : deux coches bleues (la personne a ouvert la discussion)
export default function Coches({ statut }) {
  switch (statut) {
    case 'attente':
      return <Ionicons name="time-outline" size={14} color={GRIS} />;
    case 'echec':
      return <Ionicons name="alert-circle" size={15} color={COLORS.rouge} />;
    case 'recu':
      return <Ionicons name="checkmark-done" size={16} color={GRIS} />;
    case 'lu':
      return <Ionicons name="checkmark-done" size={16} color={BLEU} />;
    default:
      return <Ionicons name="checkmark" size={16} color={GRIS} />;
  }
}
