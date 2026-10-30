import React, { useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, ActivityIndicator, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Audio } from 'expo-av';
import { COLORS } from '../../theme/colors';
import { dureeLisible } from './formatage';

// Lecteur d'un message vocal : bouton lecture / pause, barre de progression et durée.
// `duree` (en secondes) est celle enregistrée avec le message : elle sert tant que le lecteur ne connaît pas la sienne.
export default function LecteurAudio({ uri, duree }) {
  const son = useRef(null);
  const [lecture, setLecture] = useState(false);
  const [chargement, setChargement] = useState(false);
  const [position, setPosition] = useState(0); // millisecondes
  const [total, setTotal] = useState((duree || 0) * 1000);
  const [erreur, setErreur] = useState(false);

  // Libère le son quand le message n'est plus affiché
  useEffect(
    () => () => {
      if (son.current) son.current.unloadAsync().catch(() => {});
    },
    []
  );

  function surStatut(statut) {
    if (!statut.isLoaded) return;
    setPosition(statut.positionMillis || 0);
    if (statut.durationMillis && Number.isFinite(statut.durationMillis)) setTotal(statut.durationMillis);
    setLecture(Boolean(statut.isPlaying));
    if (statut.didJustFinish) {
      setLecture(false);
      setPosition(0);
      if (son.current) son.current.setPositionAsync(0).catch(() => {});
    }
  }

  async function basculer() {
    try {
      setErreur(false);
      if (!son.current) {
        setChargement(true);
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false, playsInSilentModeIOS: true });
        const { sound } = await Audio.Sound.createAsync({ uri }, { shouldPlay: true }, surStatut);
        son.current = sound;
        setChargement(false);
        return;
      }
      const statut = await son.current.getStatusAsync();
      if (statut.isLoaded && statut.isPlaying) await son.current.pauseAsync();
      else await son.current.playAsync();
    } catch (e) {
      setChargement(false);
      setErreur(true);
    }
  }

  const progression = total > 0 ? Math.min(1, position / total) : 0;
  const affichee = lecture || position > 0 ? position / 1000 : total / 1000;

  return (
    <View style={styles.ligne}>
      <TouchableOpacity
        onPress={basculer}
        style={styles.bouton}
        accessibilityRole="button"
        accessibilityLabel={lecture ? 'Mettre en pause le message vocal' : 'Écouter le message vocal'}
      >
        {chargement ? (
          <ActivityIndicator size="small" color={COLORS.blanc} />
        ) : (
          <Ionicons name={lecture ? 'pause' : 'play'} size={18} color={COLORS.blanc} style={!lecture && { marginLeft: 2 }} />
        )}
      </TouchableOpacity>
      <View style={styles.centre}>
        <View style={styles.piste}>
          <View style={[styles.avancee, { width: `${progression * 100}%` }]} />
        </View>
        <Text style={styles.duree}>{erreur ? 'Lecture impossible' : dureeLisible(affichee)}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  ligne: { flexDirection: 'row', alignItems: 'center', minWidth: 200 },
  bouton: { width: 38, height: 38, borderRadius: 19, backgroundColor: COLORS.noir, alignItems: 'center', justifyContent: 'center' },
  centre: { flex: 1, marginLeft: 10 },
  piste: { height: 4, borderRadius: 2, backgroundColor: 'rgba(0,0,0,0.18)', overflow: 'hidden' },
  avancee: { height: 4, backgroundColor: COLORS.noir },
  duree: { fontSize: 11.5, color: 'rgba(0,0,0,0.6)', marginTop: 4 },
});
