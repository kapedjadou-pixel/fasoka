import { Platform } from 'react-native';

const LOCAL_URLS = {
  web: 'http://localhost:4000/api',
  android: 'http://10.0.2.2:4000/api',
  ios: 'http://localhost:4000/api',
  default: 'http://localhost:4000/api',
};

export const API_BASE_URL = process.env.EXPO_PUBLIC_API_URL || Platform.select(LOCAL_URLS);
