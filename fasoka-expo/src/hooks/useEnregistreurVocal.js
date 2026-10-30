import { useCallback, useEffect, useRef, useState } from 'react';
import { Audio } from 'expo-av';

const DUREE_MAX_SECONDES = 300; // 5 minutes

// Enregistrement d'un message vocal (micro). Un appui sur le micro démarre, puis « envoyer » termine ou « corbeille » annule.
// `surDureeMax` est appelé quand les 5 minutes sont atteintes (l'écran envoie alors le vocal automatiquement).
export default function useEnregistreurVocal({ surDureeMax } = {}) {
  const enregistrement = useRef(null);
  const [actif, setActif] = useState(false);
  const [secondes, setSecondes] = useState(0);
  const [erreur, setErreur] = useState(null);
  const surDureeMaxRef = useRef(surDureeMax);
  surDureeMaxRef.current = surDureeMax;

  const demarrer = useCallback(async () => {
    setErreur(null);
    try {
      const permission = await Audio.requestPermissionsAsync();
      if (!permission.granted) {
        setErreur('Autorisez le micro pour enregistrer un message vocal.');
        return false;
      }
      await Audio.setAudioModeAsync({ allowsRecordingIOS: true, playsInSilentModeIOS: true });
      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,
        (statut) => {
          if (statut.isRecording) setSecondes(Math.floor((statut.durationMillis || 0) / 1000));
        },
        500
      );
      enregistrement.current = recording;
      setSecondes(0);
      setActif(true);
      return true;
    } catch (e) {
      setErreur("Impossible de démarrer l'enregistrement. Vérifiez que le micro est autorisé.");
      return false;
    }
  }, []);

  // Termine l'enregistrement : { uri, duree } (secondes), ou null en cas de problème
  const terminer = useCallback(async () => {
    const rec = enregistrement.current;
    if (!rec) return null;
    enregistrement.current = null;
    setActif(false);
    try {
      const statut = await rec.stopAndUnloadAsync();
      await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      const uri = rec.getURI();
      if (!uri) return null;
      return { uri, duree: Math.max(1, Math.round((statut.durationMillis || 0) / 1000)) };
    } catch (e) {
      return null;
    }
  }, []);

  const annuler = useCallback(async () => {
    const rec = enregistrement.current;
    enregistrement.current = null;
    setActif(false);
    setSecondes(0);
    if (rec) {
      try {
        await rec.stopAndUnloadAsync();
        await Audio.setAudioModeAsync({ allowsRecordingIOS: false });
      } catch (e) {
        // déjà arrêté
      }
    }
  }, []);

  useEffect(() => {
    if (actif && secondes >= DUREE_MAX_SECONDES && surDureeMaxRef.current) surDureeMaxRef.current();
  }, [secondes, actif]);

  // Si l'écran se ferme pendant l'enregistrement, on le coupe
  useEffect(
    () => () => {
      if (enregistrement.current) enregistrement.current.stopAndUnloadAsync().catch(() => {});
    },
    []
  );

  return { actif, secondes, erreur, demarrer, terminer, annuler, effacerErreur: () => setErreur(null) };
}
