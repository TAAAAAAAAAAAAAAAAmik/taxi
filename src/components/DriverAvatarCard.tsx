import { useState } from 'react';
import * as ImagePicker from 'expo-image-picker';
import { Camera, Images, UserRound } from 'lucide-react-native';
import { Image, Pressable, StyleSheet, Text, View } from 'react-native';

import { updateDriverAvatar } from '../services/apiClient';
import { useAppState } from '../state/AppState';

// Фото профиля водителя: клиент видит его в карточке «кто приедет».
export function DriverAvatarCard() {
  const { currentUser, drivers } = useAppState();
  const [notice, setNotice] = useState('');
  const [busy, setBusy] = useState(false);
  const [localAvatar, setLocalAvatar] = useState<string | undefined>();

  const currentDriver = drivers.find((driver) => driver.userId === currentUser?.id);
  const avatar = localAvatar ?? currentDriver?.avatar;

  const pick = async (source: 'camera' | 'library') => {
    setNotice('');

    const permission =
      source === 'camera'
        ? await ImagePicker.requestCameraPermissionsAsync()
        : await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      setNotice('Нет доступа к камере или галерее.');
      return;
    }

    const result =
      source === 'camera'
        ? await ImagePicker.launchCameraAsync({ allowsEditing: true, aspect: [1, 1], base64: true, quality: 0.5 })
        : await ImagePicker.launchImageLibraryAsync({
            allowsEditing: true,
            aspect: [1, 1],
            base64: true,
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.5,
          });

    if (result.canceled || !result.assets[0]?.base64) {
      return;
    }

    const asset = result.assets[0];
    const dataUri = `data:${asset.mimeType || 'image/jpeg'};base64,${asset.base64}`;

    if (dataUri.length > 900000) {
      setNotice('Фото слишком большое — выберите поменьше.');
      return;
    }

    if (!currentDriver?.id) {
      // Демо без бэка: показываем локально, честно сообщаем.
      setLocalAvatar(dataUri);
      setNotice('Фото сохранится на сервере после входа водителем с backend.');
      return;
    }

    setBusy(true);

    try {
      await updateDriverAvatar(currentDriver.id, dataUri);
      setLocalAvatar(dataUri);
      setNotice('Фото профиля обновлено — клиенты увидят его в заказе.');
    } catch (error) {
      setNotice(error instanceof Error ? error.message : 'Не удалось сохранить фото.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.row}>
        <View style={styles.avatarWrap}>
          {avatar ? (
            <Image source={{ uri: avatar }} style={styles.avatarImage} />
          ) : (
            <UserRound color="#008D49" size={30} strokeWidth={2.2} />
          )}
        </View>
        <View style={styles.copy}>
          <Text style={styles.title}>Фото профиля</Text>
          <Text style={styles.text}>Клиент видит его, когда вы приняли заказ.</Text>
        </View>
      </View>
      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => pick('library')}
          style={({ pressed }) => [styles.button, busy && styles.disabled, pressed && styles.pressed]}
        >
          <Images color="#008D49" size={17} strokeWidth={2.4} />
          <Text style={styles.buttonText}>Из галереи</Text>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          disabled={busy}
          onPress={() => pick('camera')}
          style={({ pressed }) => [styles.button, busy && styles.disabled, pressed && styles.pressed]}
        >
          <Camera color="#008D49" size={17} strokeWidth={2.4} />
          <Text style={styles.buttonText}>Камера</Text>
        </Pressable>
      </View>
      {notice ? <Text style={styles.notice}>{notice}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: 'row', gap: 10 },
  avatarImage: { borderRadius: 999, height: 64, width: 64 },
  avatarWrap: {
    alignItems: 'center',
    backgroundColor: '#F7FBF8',
    borderColor: 'rgba(0, 141, 73, 0.18)',
    borderRadius: 999,
    borderWidth: 1,
    height: 64,
    justifyContent: 'center',
    overflow: 'hidden',
    width: 64,
  },
  button: {
    alignItems: 'center',
    backgroundColor: '#F7FBF8',
    borderColor: 'rgba(0, 141, 73, 0.2)',
    borderRadius: 12,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    minHeight: 44,
  },
  buttonText: { color: '#008D49', fontSize: 13, fontWeight: '800' },
  card: {
    backgroundColor: '#FFFFFF',
    borderColor: 'rgba(11, 47, 37, 0.10)',
    borderRadius: 18,
    borderWidth: 1,
    gap: 12,
    marginBottom: 12,
    padding: 15,
    shadowColor: '#0B2F25',
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.05,
    shadowRadius: 16,
  },
  copy: { flex: 1, gap: 3, minWidth: 0 },
  disabled: { opacity: 0.6 },
  notice: { color: '#008D49', fontSize: 12, fontWeight: '700', lineHeight: 17 },
  pressed: { opacity: 0.9, transform: [{ scale: 0.98 }] },
  row: { alignItems: 'center', flexDirection: 'row', gap: 13 },
  text: { color: '#71877D', fontSize: 12, lineHeight: 17 },
  title: { color: '#12382C', fontSize: 15, fontWeight: '900' },
});
