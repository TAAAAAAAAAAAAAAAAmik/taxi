import { useMemo, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { ArrowLeft, Home, LocateFixed, MapPinned, Save } from 'lucide-react-native';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';

import {
  findSalavatAddressSuggestions,
  formatSalavatAddress,
  getCoverageText,
  getCoverageTitle,
  GeoPoint,
} from '../data/salavatDistrict';
import { RootStackParamList } from '../navigation/types';
import { useAppState } from '../state/AppState';
import { requestUserLocation, reverseGeocodePoint } from '../services/locationService';

type Props = NativeStackScreenProps<RootStackParamList, 'SavedPlace'>;

export function SavedPlaceScreen({ navigation, route }: Props) {
  const { firstName, role } = route.params;
  const { saveHomeAddress, savedHomeAddress } = useAppState();
  const [address, setAddress] = useState(savedHomeAddress?.address ?? '');
  const [entrance, setEntrance] = useState(savedHomeAddress?.entrance ?? '');
  const [comment, setComment] = useState(savedHomeAddress?.comment ?? '');
  const [locationPoint, setLocationPoint] = useState<GeoPoint | undefined>();
  const [locationMessage, setLocationMessage] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const suggestions = useMemo(() => findSalavatAddressSuggestions(address), [address]);
  const canSave = address.trim().length >= 4;

  const requestLocation = async () => {
    setLocationMessage('Запрашиваем геолокацию...');
    const result = await requestUserLocation();

    if (result.status === 'granted') {
      setLocationPoint(result.point);
      setLocationMessage('Геолокация получена, определяем адрес...');

      const geocoded = await reverseGeocodePoint(result.point);

      if (geocoded.status === 'resolved') {
        setAddress(geocoded.address.displayAddress);
        setLocationMessage('Адрес определен. Можно уточнить дом, подъезд или ориентир.');
        return;
      }

      setLocationMessage(geocoded.message);
      return;
    }

    setLocationMessage(result.message);
  };

  const save = () => {
    if (!canSave) {
      return;
    }

    saveHomeAddress({
      address: address.trim(),
      comment: comment.trim(),
      entrance: entrance.trim(),
    });
    setSaved(true);
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <ArrowLeft color="#146C5D" size={20} strokeWidth={2.4} />
            <Text style={styles.backButtonText}>Назад</Text>
          </Pressable>
          <Text style={styles.roleText}>{role === 'client' ? 'Клиент' : 'Профиль'}</Text>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <Home color="#146C5D" size={30} strokeWidth={2.4} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.title}>Домашний адрес</Text>
            <Text style={styles.subtitle}>
              Сохраните дом один раз, чтобы быстрый заказ сразу подставлял точку подачи.
            </Text>
            <Text style={styles.metaLine}>{firstName?.trim() || 'Пользователь'}</Text>
          </View>
        </View>

        <View style={styles.panel}>
          <View style={styles.coverageBox}>
            <MapPinned color="#146C5D" size={20} strokeWidth={2.4} />
            <View style={styles.coverageCopy}>
              <Text style={styles.coverageTitle}>{getCoverageTitle(locationPoint)}</Text>
              <Text style={styles.coverageText}>{getCoverageText(locationPoint)}</Text>
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            onPress={requestLocation}
            style={({ pressed }) => [styles.locationButton, pressed && styles.pressed]}
          >
            <LocateFixed color="#146C5D" size={18} strokeWidth={2.4} />
            <Text style={styles.locationButtonText}>Определить мое место</Text>
          </Pressable>
          {locationMessage ? <Text style={styles.locationMessage}>{locationMessage}</Text> : null}

          <View style={styles.field}>
            <Text style={styles.label}>Адрес дома</Text>
            <TextInput
              autoCorrect={false}
              onChangeText={(value) => {
                setAddress(value);
                setSaved(false);
              }}
              placeholder="Например: Малояз, Коммунистическая улица, 65/1"
              placeholderTextColor="#8A8F98"
              style={styles.input}
              value={address}
            />
          </View>

          {suggestions.length > 0 && address.trim().length > 0 ? (
            <View style={styles.suggestions}>
              {suggestions.map((suggestion) => (
                <Pressable
                  accessibilityRole="button"
                  key={suggestion.id}
                  onPress={() => {
                    setAddress(formatSalavatAddress(suggestion));
                    setSaved(false);
                  }}
                  style={({ pressed }) => [styles.suggestion, pressed && styles.pressed]}
                >
                  <Text style={styles.suggestionTitle}>{suggestion.title}</Text>
                  <Text style={styles.suggestionSubtitle}>{suggestion.subtitle}</Text>
                </Pressable>
              ))}
            </View>
          ) : null}

          <View style={styles.fieldGrid}>
            <View style={styles.fieldFlex}>
              <Text style={styles.label}>Подъезд</Text>
              <TextInput
                onChangeText={setEntrance}
                placeholder="Подъезд 2"
                placeholderTextColor="#8A8F98"
                style={styles.input}
                value={entrance}
              />
            </View>
            <View style={styles.fieldFlex}>
              <Text style={styles.label}>Комментарий</Text>
              <TextInput
                onChangeText={setComment}
                placeholder="Ждать у ворот"
                placeholderTextColor="#8A8F98"
                style={styles.input}
                value={comment}
              />
            </View>
          </View>

          <Pressable
            accessibilityRole="button"
            disabled={!canSave}
            onPress={save}
            style={({ pressed }) => [
              styles.primaryButton,
              !canSave && styles.primaryButtonMuted,
              pressed && styles.pressed,
            ]}
          >
            <Save color="#FFFFFF" size={18} strokeWidth={2.4} />
            <Text style={styles.primaryButtonText}>Сохранить дом</Text>
          </Pressable>

          {saved || savedHomeAddress ? (
            <View style={styles.savedBox}>
              <Text style={styles.savedTitle}>{saved ? 'Адрес сохранен' : 'Сохраненный дом'}</Text>
              <Text style={styles.savedText}>
                {saved ? address.trim() : savedHomeAddress?.address}
              </Text>
            </View>
          ) : null}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  backButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#D8DEE6',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 42,
    paddingHorizontal: 12,
  },
  backButtonText: {
    color: '#146C5D',
    fontSize: 14,
    fontWeight: '900',
  },
  coverageBox: {
    alignItems: 'flex-start',
    backgroundColor: '#EEF5F3',
    borderColor: '#C5DDD7',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  coverageCopy: {
    flex: 1,
    gap: 4,
  },
  coverageText: {
    color: '#59616C',
    fontSize: 13,
    lineHeight: 19,
  },
  coverageTitle: {
    color: '#0B4C42',
    fontSize: 15,
    fontWeight: '900',
  },
  field: {
    gap: 8,
  },
  fieldFlex: {
    flex: 1,
    gap: 8,
    minWidth: 180,
  },
  fieldGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  hero: {
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderColor: '#D8DEE6',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 14,
    padding: 18,
  },
  heroCopy: {
    flex: 1,
    gap: 7,
    minWidth: 0,
  },
  heroIcon: {
    alignItems: 'center',
    backgroundColor: '#E9F4F1',
    borderRadius: 8,
    height: 58,
    justifyContent: 'center',
    width: 58,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D8DEE6',
    borderRadius: 8,
    borderWidth: 1,
    color: '#20242A',
    fontSize: 16,
    minHeight: 50,
    paddingHorizontal: 14,
  },
  label: {
    color: '#20242A',
    fontSize: 14,
    fontWeight: '900',
  },
  locationButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#146C5D',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 46,
    paddingHorizontal: 14,
  },
  locationButtonText: {
    color: '#146C5D',
    fontSize: 14,
    fontWeight: '900',
  },
  locationMessage: {
    color: '#59616C',
    fontSize: 13,
    lineHeight: 19,
  },
  metaLine: {
    color: '#146C5D',
    fontSize: 13,
    fontWeight: '900',
  },
  page: {
    backgroundColor: '#F4F7F5',
    gap: 16,
    minHeight: '100%',
    padding: 16,
  },
  panel: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D8DEE6',
    borderRadius: 8,
    borderWidth: 1,
    gap: 14,
    padding: 16,
  },
  pressed: {
    opacity: 0.76,
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#146C5D',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 16,
  },
  primaryButtonMuted: {
    backgroundColor: '#89958F',
  },
  primaryButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '900',
  },
  roleText: {
    color: '#146C5D',
    fontSize: 14,
    fontWeight: '900',
  },
  safeArea: {
    backgroundColor: '#F4F7F5',
    flex: 1,
  },
  savedBox: {
    backgroundColor: '#EAF6EA',
    borderColor: '#B9DDBB',
    borderRadius: 8,
    borderWidth: 1,
    gap: 5,
    padding: 12,
  },
  savedText: {
    color: '#59616C',
    fontSize: 13,
    lineHeight: 19,
  },
  savedTitle: {
    color: '#26733E',
    fontSize: 15,
    fontWeight: '900',
  },
  subtitle: {
    color: '#59616C',
    fontSize: 15,
    lineHeight: 22,
  },
  suggestion: {
    backgroundColor: '#F8FAF9',
    borderColor: '#D8DEE6',
    borderRadius: 8,
    borderWidth: 1,
    gap: 3,
    padding: 11,
  },
  suggestions: {
    gap: 8,
  },
  suggestionSubtitle: {
    color: '#59616C',
    fontSize: 12,
    lineHeight: 17,
  },
  suggestionTitle: {
    color: '#20242A',
    fontSize: 14,
    fontWeight: '900',
  },
  title: {
    color: '#20242A',
    fontSize: 30,
    fontWeight: '900',
    lineHeight: 36,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
});
