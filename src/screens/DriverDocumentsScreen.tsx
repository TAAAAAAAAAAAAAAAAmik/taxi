import { useMemo, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import * as ImagePicker from 'expo-image-picker';
import { ArrowLeft, Camera, FileCheck2, ImagePlus, ShieldCheck, Upload } from 'lucide-react-native';
import { Pressable, SafeAreaView, ScrollView, StyleSheet, Text, View } from 'react-native';

import { isDriverLikeRole } from '../data/registration';
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
  {
    kind: 'osgop',
    title: 'ОСГОП',
    subtitle: 'Обязательный полис для допуска к пассажирским заказам.',
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
  const selectedCount = useMemo(() => Object.keys(selectedDocuments).length, [selectedDocuments]);
  const { rejectedDocuments, uploadedCount } = useMemo(
    () =>
      documentSpecs.reduce(
        (summary, spec) => {
          const status = currentDriver?.documentUploads?.[spec.kind]?.status;

          if (status === 'pending' || status === 'approved') {
            summary.uploadedCount += 1;
          }

          if (status === 'rejected') {
            summary.rejectedDocuments.push(spec);
          }

          return summary;
        },
        {
          rejectedDocuments: [] as typeof documentSpecs,
          uploadedCount: 0,
        },
      ),
    [currentDriver?.documentUploads],
  );
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
            <ArrowLeft color="#008D49" size={20} strokeWidth={2.4} />
            <Text style={styles.backButtonText}>Назад</Text>
          </Pressable>
          <Text style={styles.roleText}>{isDriverLikeRole(role) ? 'Водитель' : 'Документы'}</Text>
        </View>

        <View style={styles.hero}>
          <View style={styles.heroIcon}>
            <ShieldCheck color="#008D49" size={30} strokeWidth={2.4} />
          </View>
          <View style={styles.heroCopy}>
            <Text numberOfLines={2} style={styles.title}>Документы водителя</Text>
            <Text numberOfLines={2} style={styles.subtitle}>
              {firstName?.trim() || currentUser?.firstName || 'Водитель'}, отправьте фото документов
              на проверку допуска к заказам.
            </Text>
          </View>
        </View>

        <View style={styles.summaryGrid}>
          <SummaryCell label="Загружено" value={`${uploadedCount}/${documentSpecs.length}`} />
          <SummaryCell label="Выбрано" value={`${selectedCount}/${documentSpecs.length}`} />
          <SummaryCell label="Статус" value={currentDriver?.documentsStatus ?? 'missing'} />
        </View>

        {currentDriver?.documentReview?.status === 'rejected' ? (
          <View style={styles.reviewPanel}>
            <Text style={styles.reviewTitle}>Нужно повторно загрузить документы</Text>
            <Text numberOfLines={2} style={styles.reviewText}>
              {currentDriver.documentReview.reason || 'Администратор отклонил пакет документов.'}
            </Text>
            {currentDriver.documentReview.rejectedKinds.length ? (
              <Text numberOfLines={2} style={styles.reviewText}>
                Проверьте: {currentDriver.documentReview.rejectedKinds
                  .map((kind) => documentSpecs.find((spec) => spec.kind === kind)?.title || kind)
                  .join(', ')}
              </Text>
            ) : null}
          </View>
        ) : null}

        <View style={styles.documentsList}>
          {documentSpecs.map((spec) => {
            const upload = currentDriver?.documentUploads?.[spec.kind];
            const selected = selectedDocuments[spec.kind];

            return (
              <View key={spec.kind} style={styles.documentCard}>
                <View style={styles.documentHeader}>
                  <View style={styles.documentIcon}>
                    <FileCheck2 color="#008D49" size={23} strokeWidth={2.4} />
                  </View>
                  <View style={styles.documentCopy}>
                    <Text numberOfLines={1} style={styles.documentTitle}>{spec.title}</Text>
                    <Text numberOfLines={2} style={styles.documentSubtitle}>{spec.subtitle}</Text>
                  </View>
                  <Text style={styles.statusBadge}>
                    {selected ? 'Выбран' : statusLabels[upload?.status ?? 'missing']}
                  </Text>
                </View>

                <Text numberOfLines={1} style={styles.fileLine}>
                  {selected?.fileName || upload?.fileName || 'Файл еще не выбран'}
                </Text>
                {upload?.status === 'rejected' ? (
                  <Text numberOfLines={2} style={styles.rejectionText}>
                    {upload.rejectionReason || currentDriver?.documentReview?.reason || 'Файл нужно заменить.'}
                  </Text>
                ) : null}

                <View style={styles.documentActions}>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => pickDocument(spec.kind, 'camera')}
                    style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
                  >
                    <Camera color="#008D49" size={17} strokeWidth={2.4} />
                    <Text style={styles.secondaryButtonText}>Камера</Text>
                  </Pressable>
                  <Pressable
                    accessibilityRole="button"
                    onPress={() => pickDocument(spec.kind, 'library')}
                    style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressed]}
                  >
                    <ImagePlus color="#008D49" size={17} strokeWidth={2.4} />
                    <Text style={styles.secondaryButtonText}>Галерея</Text>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>

        {notice ? <Text style={styles.notice}>{notice}</Text> : null}

        {rejectedDocuments.length ? (
          <Text style={styles.notice}>
            После замены отклоненных файлов отправьте пакет повторно, статус снова станет "На проверке".
          </Text>
        ) : null}

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
          <Upload color="#12382C" size={19} strokeWidth={2.4} />
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
    borderColor: '#008D49',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 42,
    paddingHorizontal: 12,
  },
  backButtonText: {
    color: '#008D49',
    fontSize: 14,
    fontWeight: '900',
  },
  documentActions: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
  documentCard: {
    backgroundColor: '#FFFFFF',
    borderColor: '#008D49',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: 8,
    minWidth: 260,
    padding: 10,
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
    gap: 8,
  },
  documentIcon: {
    alignItems: 'center',
    backgroundColor: '#E8F3EF',
    borderRadius: 8,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  documentsList: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  documentSubtitle: {
    color: '#557669',
    fontSize: 13,
    lineHeight: 18,
  },
  documentTitle: {
    color: '#12382C',
    fontSize: 16,
    fontWeight: '900',
  },
  fileLine: {
    color: '#12382C',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  hero: {
    alignItems: 'flex-start',
    backgroundColor: '#FFFFFF',
    borderColor: '#008D49',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    padding: 12,
  },
  heroCopy: {
    flex: 1,
    gap: 7,
    minWidth: 0,
  },
  heroIcon: {
    alignItems: 'center',
    backgroundColor: '#E8F3EF',
    borderRadius: 8,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  notice: {
    color: '#557669',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  rejectionText: {
    color: '#C17A70',
    fontSize: 13,
    fontWeight: '800',
    lineHeight: 18,
  },
  reviewPanel: {
    backgroundColor: '#E8F3EF',
    borderColor: '#008D49',
    borderRadius: 8,
    borderWidth: 1,
    gap: 7,
    padding: 12,
  },
  reviewText: {
    color: '#008D49',
    fontSize: 13,
    lineHeight: 18,
  },
  reviewTitle: {
    color: '#008D49',
    fontSize: 15,
    fontWeight: '900',
  },
  page: {
    backgroundColor: '#F4FAF6',
    gap: 12,
    minHeight: '100%',
    padding: 14,
  },
  pressed: {
    opacity: 0.92,
    transform: [{ scale: 0.95 }],
  },
  primaryButton: {
    alignItems: 'center',
    backgroundColor: '#008D49',
    borderRadius: 8,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: 16,
  },
  primaryButtonMuted: {
    backgroundColor: '#A9BBB3',
  },
  primaryButtonText: {
    color: '#F4FAF6',
    fontSize: 15,
    fontWeight: '900',
  },
  roleText: {
    color: '#008D49',
    fontSize: 14,
    fontWeight: '900',
  },
  safeArea: {
    backgroundColor: '#F4FAF6',
    flex: 1,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#008D49',
    borderRadius: 8,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 7,
    justifyContent: 'center',
    minHeight: 40,
    paddingHorizontal: 12,
  },
  secondaryButtonText: {
    color: '#008D49',
    fontSize: 13,
    fontWeight: '900',
  },
  statusBadge: {
    backgroundColor: '#E8F3EF',
    borderRadius: 6,
    color: '#008D49',
    fontSize: 11,
    fontWeight: '900',
    overflow: 'hidden',
    paddingHorizontal: 7,
    paddingVertical: 4,
  },
  subtitle: {
    color: '#557669',
    fontSize: 14,
    lineHeight: 20,
  },
  summaryCell: {
    backgroundColor: '#FFFFFF',
    borderColor: '#008D49',
    borderRadius: 8,
    borderWidth: 1,
    flex: 1,
    gap: 5,
    minWidth: 104,
    padding: 10,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
  },
  summaryLabel: {
    color: '#557669',
    fontSize: 12,
    fontWeight: '800',
    textTransform: 'uppercase',
  },
  summaryValue: {
    color: '#12382C',
    fontSize: 18,
    fontWeight: '900',
  },
  title: {
    color: '#12382C',
    fontSize: 24,
    fontWeight: '900',
    lineHeight: 30,
  },
  topBar: {
    alignItems: 'center',
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
    justifyContent: 'space-between',
  },
});
