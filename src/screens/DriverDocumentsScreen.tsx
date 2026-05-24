import { useMemo, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { ArrowLeft, Camera, FileCheck2, ImagePlus, ShieldCheck, Upload } from 'lucide-react-native';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { RootStackParamList } from '../navigation/types';
import {
  DriverDocumentKind,
  DriverDocumentUpload,
  DriverDocumentUploadInput,
  useAppState,
} from '../state/AppState';

type Props = NativeStackScreenProps<RootStackParamList, 'DriverDocuments'>;

const documentSpecs: Array<{
  kind: DriverDocumentKind;
  title: string;
  subtitle: string;
}> = [
  {
    kind: 'passport',
    title: 'Паспорт',
    subtitle: 'Разворот с фото и основными данными.',
  },
  {
    kind: 'driverLicense',
    title: 'Водительское удостоверение',
    subtitle: 'Фото лицевой стороны, данные должны быть читаемыми.',
  },
  {
    kind: 'sts',
    title: 'СТС',
    subtitle: 'Документ автомобиля, который выходит на линию.',
  },
  {
    kind: 'osago',
    title: 'ОСАГО',
    subtitle: 'Полис страхования для автомобиля.',
  },
];

const statusLabels: Record<DriverDocumentUpload['status'], string> = {
  approved: 'Одобрено',
  missing: 'Нет файла',
  pending: 'На проверке',
  rejected: 'Отклонено',
};

export function DriverDocumentsScreen({ navigation, route }: Props) {
  const { firstName, role } = route.params;
  const { currentUser, drivers, serverMessage, submitDriverDocuments } = useAppState();
  const [selectedDocuments, setSelectedDocuments] = useState<
    Partial<Record<DriverDocumentKind, DriverDocumentUploadInput>>
  >({});
  const [notice, setNotice] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const currentDriver = useMemo(
    () => (currentUser ? drivers.find((driver) => driver.userId === currentUser.id) : undefined),
    [currentUser, drivers],
  );
  const selectedCount = Object.keys(selectedDocuments).length;
  const uploadedCount = documentSpecs.filter(
    (spec) => currentDriver?.documentUploads?.[spec.kind]?.status === 'pending' ||
      currentDriver?.documentUploads?.[spec.kind]?.status === 'approved',
  ).length;
  const canSubmit = Boolean(currentDriver?.id && selectedCount > 0 && !isSubmitting);

  const pickDocument = async (kind: DriverDocumentKind, source: 'camera' | 'library') => {
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
        ? await ImagePicker.launchCameraAsync({
            allowsEditing: false,
            base64: true,
            quality: 0.72,
          })
        : await ImagePicker.launchImageLibraryAsync({
            allowsEditing: false,
            base64: true,
            mediaTypes: ImagePicker.MediaTypeOptions.Images,
            quality: 0.72,
          });

    if (result.canceled) {
      return;
    }

    const asset = result.assets[0];

    if (!asset.base64) {
      setNotice('Не удалось получить файл для отправки. Выберите другое фото.');
      return;
    }

    setSelectedDocuments((current) => ({
      ...current,
      [kind]: {
        base64: asset.base64,
        fileName: asset.fileName ?? `${kind}.jpg`,
        fileSize: asset.fileSize,
        height: asset.height,
        kind,
        mimeType: asset.mimeType ?? 'image/jpeg',
        source,
        width: asset.width,
      },
    }));
  };

  const submitDocuments = async () => {
    if (!currentDriver?.id) {
      setNotice('Профиль водителя не найден. Войдите как водитель.');
      return;
    }

    const documents = Object.values(selectedDocuments).filter(Boolean) as DriverDocumentUploadInput[];

    if (!documents.length) {
      setNotice('Выберите хотя бы один документ.');
      return;
    }

    setIsSubmitting(true);
    setNotice('');
    await submitDriverDocuments(currentDriver.id, documents);
    setIsSubmitting(false);
    setSelectedDocuments({});
    setNotice(serverMessage || 'Документы отправлены на проверку.');
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.page}>
        <View style={styles.topBar}>
          <Pressable
            accessibilityRole="button"
            onPress={() => navigation.goBack()}
            style={({ pressed }) => [styles.backButton, pressed && styles.pressed]}
          >
            <ArrowLeft color="#146C5D" size={20} strokeWidth={2.4} />
            <Text style={styles.backButtonText}>Назад</Text>
          </Pressable>
          <Text style={styles.roleText}>{role === 'driver' ? 'Водитель' : 'Документы'}</Text>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <ShieldCheck color="#146C5D" size={30} strokeWidth={2.4} />
          </View>
          <View style={styles.heroCopy}>
            <Text style={styles.title}>Документы водителя</Text>
            <Text style={styles.subtitle}>
              {firstName?.trim() || currentUser?.firstName || 'Водитель'}, отправьте фото документов
              на проверку допуска к заказам.
            </Text>
          </View>
        </View>

        <View style={styles.summaryGrid}>
          <SummaryCell label="Загружено" value={`${uploadedCount}/4`} />
          <SummaryCell label="Выбрано" value={`${selectedCount}/4`} />
          <SummaryCell label="Статус" value={currentDriver?.documentsStatus ?? 'missing'} />
        </View>

        <View style={styles.documentsList}>
          {documentSpecs.map((spec) => {
            const upload = currentDriver?.documentUploads?.[spec.kind];
            const selected = selectedDocuments[spec.kind];

            return (
              <View key={spec.kind} style={styles.documentCard}>
                <View style={styles.documentHeader}>
                  <View style={styles.documentIcon}>
                    <FileCheck2 color="#146C5D" size={23} strokeWidth={2.4} />
                  </View>
                  <View style={styles.documentCopy}>
                    <Text style={styles.documentTitle}>{spec.title}</Text>
                    <Text style={styles.documentSubtitle}>{spec.subtitle}</Text>
                  </View>
                  <Text style={styles.statusBadge}>
                    {selected ? 'Выбран' : statusLabels[upload?.status ?? 'missing']}
                  </Text>
                </View>

                <Text style={styles.fileLine}>
                  {selected?.fileName || upload?.fileName || 'Файл еще не выбран'}
                </Text>

                <View style={styles.documentActions}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => pickDocument(spec.kind, 'camera')}
                    style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
                  >
                    <Camera color="#146C5D" size={17} strokeWidth={2.4} />
                    <Text style={styles.secondaryButtonText}>Камера</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => pickDocument(spec.kind, 'library')}
                    style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
                  >
                    <ImagePlus color="#146C5D" size={17} strokeWidth={2.4} />
                    <Text style={styles.secondaryButtonText}>Галерея</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>

        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        <Pressable
          accessibilityRole="button"
          disabled={!canSubmit}
          onPress={submitDocuments}
          style={({ pressed }) => [
            styles.primaryButton,
            !canSubmit && styles.primaryButtonMuted,
            pressed && styles.pressed,
          ]}
        >
          <Upload color="#FFFFFF" size={19} strokeWidth={2.4} />
          <Text style={styles.primaryButtonText}>
            {isSubmitting ? 'Отправляем...' : 'Отправить на проверку'}
          </Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.summaryCell}>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text style={styles.summaryValue}>{value}</Text>
    </View>
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
  documentActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  documentCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D8DEE6',
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 14,
  },
  documentCopy: {
    flex: 1,
    gap: 4,
    minWidth: 0,
  },
  documentHeader: {
    alignItems: 'flex-start',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  documentIcon: {
    alignItems: 'center',
    backgroundColor: '#E9F4F1',
    borderRadius: 8,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  documentsList: {
    gap: 12,
  },
  documentSubtitle: {
    color: '#59616C',
    fontSize: 13,
    lineHeight: 18,
  },
  documentTitle: {
    color: '#20242A',
    fontSize: 16,
    fontWeight: '900',
  },
  fileLine: {
    color: '#20242A',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
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
  notice: {
    color: '#59616C',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  page: {
    backgroundColor: '#F4F7F5',
    gap: 16,
    minHeight: '100%',
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
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#146C5D',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 12,
  },
  secondaryButtonText: {
    color: '#146C5D',
    fontSize: 13,
    fontWeight: '900',
  },
  statusBadge: {
    backgroundColor: '#E9F4F1',
    borderRadius: 6,
    color: '#146C5D',
    fontSize: 11,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  subtitle: {
    color: '#59616C',
    fontSize: 15,
    lineHeight: 22,
  },
  summaryCell: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D8DEE6',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: 5,
    minWidth: 110,
    padding: 13,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  summaryLabel: {
    color: '#59616C',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  summaryValue: {
    color: '#20242A',
    fontSize: 20,
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
