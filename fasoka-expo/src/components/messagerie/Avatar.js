import React from 'react';
import { View, Text, Image } from 'react-native';
import { COLORS } from '../../theme/colors';

// Photo ronde, ou à défaut la première lettre du nom sur fond doré
export default function Avatar({ uri, nom, taille = 44 }) {
  const style = { width: taille, height: taille, borderRadius: taille / 2 };
  if (uri) {
    return <Image source={{ uri }} style={[style, { backgroundColor: COLORS.creme }]} />;
  }
  const lettre = String(nom || '?').trim().charAt(0).toUpperCase() || '?';
  return (
    <View style={[style, { backgroundColor: COLORS.or, alignItems: 'center', justifyContent: 'center' }]}>
      <Text style={{ color: COLORS.noir, fontWeight: '800', fontSize: taille * 0.42 }}>{lettre}</Text>
    </View>
  );
}
