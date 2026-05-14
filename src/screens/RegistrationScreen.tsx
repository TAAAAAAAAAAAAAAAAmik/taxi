import { useMemo, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  AlertCircle,
  Building2,
  Car,
  ClipboardCheck,
  FileText,
  Link as LinkIcon,
  ShieldCheck,
  UserRound,
} from 'lucide-react-native';
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from 'react-native';

import { ConsentToggle } from '../components/ConsentToggle';
import { FieldInput } from '../components/FieldInput';
import { InfoPanel } from '../components/InfoPanel';
import { RoleCard } from '../components/RoleCard';
import {
  AccountRole,
  consentItems,
  getFieldsForRole,
  roleCopy,
  sectionTitles,
  verificationSteps,
} from '../data/registration';
import { RootStackParamList } from '../navigation/types';
import {
  ConsentValues,
  FormValues,
  createConsentState,
  validateRegistration,
} from '../utils/validation';

type Props = NativeStackScreenProps<RootStackParamList, 'Registration'>;

const roleIcons = {
  client: UserRound,
  driver: Car,
  fleet: Building2,
};

const orderedRoles: AccountRole[] = ['client', 'driver'];
const sectionOrder = ['account', 'identity', 'legal', 'vehicle', 'business', 'payments'] as const;

export function RegistrationScreen({ navigation }: Props) {
  const { width } = useWindowDimensions();
  const [role, setRole] = useState<AccountRole>('client');
  const [values, setValues] = useState<FormValues>({});
  const [consents, setConsents] = useState<ConsentValues>(() => createConsentState());
  const [submitted, setSubmitted] = useState(false);

  const fields = useMemo(() => getFieldsForRole(role), [role]);
  const validationErrors = useMemo(
    () => validateRegistration(role, values, consents),
    [consents, role, values],
  );
  const canSubmit = validationErrors.length === 0;
  const isWide = width >= 720;

  const fieldsBySection = useMemo(() => {
    return sectionOrder
      .map((section) => ({
        section,
        fields: fields.filter((field) => field.section === section),
      }))
      .filter((group) => group.fields.length > 0);
  }, [fields]);

  const updateValue = (id: string, nextValue: string) => {
    setSubmitted(false);
    setValues((current) => ({ ...current, [id]: nextValue }));
  };

  const toggleConsent = (id: keyof ConsentValues) => {
    setSubmitted(false);
    setConsents((current) => ({ ...current, [id]: !current[id] }));
  };

  const handleSubmit = () => {
    if (!canSubmit) {
      setSubmitted(true);
      return;
    }

    navigation.navigate('VerifyPhone', {
      email: values.email,
      firstName: values.firstName,
      phone: values.phone,
      role,
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <View style={styles.headerBand}>
          <View style={styles.brandRow}>
            <View style={styles.brandMark}>
              <Car color="#FFFFFF" size={24} strokeWidth={2.4} />
            </View>
            <View>
              <Text style={styles.appName}>Такси Партнер</Text>
              <Text style={styles.appMeta}>Регистрация и проверка профиля</Text>
            </View>
          </View>

          <View style={styles.heroCopy}>
            <Text style={styles.heroTitle}>Создание аккаунта</Text>
              <Text style={styles.heroText}>
              Выберите роль, заполните анкету и подтвердите телефон с почтой. Водитель получает
              доступ к заказам после проверки документов и оплаты месячной подписки.
            </Text>
          </View>
        </View>

        <View style={[styles.contentGrid, isWide && styles.contentGridWide]}>
          <View style={[styles.sidebar, isWide && styles.sidebarWide]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Тип аккаунта</Text>
              <Text style={styles.sectionHint}>Роль определяет поля анкеты и будущий кабинет.</Text>
            </View>

            <View style={styles.roleList}>
              {orderedRoles.map((item) => {
                const copy = roleCopy[item];
                const Icon = roleIcons[item];

                return (
                  <RoleCard
                    Icon={Icon}
                    active={item === role}
                    key={item}
                    onPress={() => {
                      setSubmitted(false);
                      setRole(item);
                    }}
                    subtitle={copy.subtitle}
                    title={copy.title}
                  />
                );
              })}
            </View>

            <InfoPanel Icon={ShieldCheck} title="Безопасность данных">
              <Text style={styles.panelText}>
                Используется отдельный пароль для приложения. Пароль от почты не запрашивается.
              </Text>
            </InfoPanel>

            <InfoPanel Icon={LinkIcon} title="Инвайт-ссылка">
              <Text style={styles.panelText}>https://links.example.com/invite/{role}</Text>
              <Text style={styles.panelTextMuted}>
                Позже этот домен подключается к Universal Links и Android App Links.
              </Text>
            </InfoPanel>
          </View>

          <View style={styles.formArea}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{roleCopy[role].title}</Text>
              <Text style={styles.sectionHint}>{roleCopy[role].reviewStatus}</Text>
            </View>

            <View style={styles.steps}>
              {verificationSteps[role].map((step, index) => (
                <View key={step} style={styles.stepRow}>
                  <View style={styles.stepBadge}>
                    <Text style={styles.stepBadgeText}>{index + 1}</Text>
                  </View>
                  <Text style={styles.stepText}>{step}</Text>
                </View>
              ))}
            </View>

            {fieldsBySection.map((group) => (
              <View key={group.section} style={styles.formSection}>
                <View style={styles.formSectionHeader}>
                  <FileText color="#146C5D" size={18} strokeWidth={2.4} />
                  <Text style={styles.formSectionTitle}>{sectionTitles[group.section]}</Text>
                </View>
                <View style={styles.fieldGrid}>
                  {group.fields.map((field) => (
                    <FieldInput
                      field={field}
                      key={field.id}
                      onChangeText={(nextValue) => updateValue(field.id, nextValue)}
                      value={values[field.id] ?? ''}
                    />
                  ))}
                </View>
              </View>
            ))}

            <View style={styles.formSection}>
              <View style={styles.formSectionHeader}>
                <ClipboardCheck color="#146C5D" size={18} strokeWidth={2.4} />
                <Text style={styles.formSectionTitle}>Согласия</Text>
              </View>
              <View>
                {consentItems.map((item) => (
                  <ConsentToggle
                    checked={consents[item.id]}
                    key={item.id}
                    label={item.label}
                    onToggle={() => toggleConsent(item.id)}
                    text={item.text}
                  />
                ))}
              </View>
            </View>

            {submitted && validationErrors.length > 0 ? (
              <InfoPanel Icon={AlertCircle} title="Нужно проверить анкету" tone="warning">
                {validationErrors.slice(0, 4).map((error) => (
                  <Text key={error} style={styles.panelText}>
                    {error}
                  </Text>
                ))}
              </InfoPanel>
            ) : null}

            <View style={styles.actionRow}>
              <Pressable
                accessibilityRole="button"
                onPress={handleSubmit}
                style={({ pressed }) => [
                  styles.submitButton,
                  !canSubmit && styles.submitButtonMuted,
                  pressed && styles.pressedButton,
                ]}
              >
                <Text style={styles.submitText}>Продолжить к подтверждению</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => navigation.navigate('Login')}
                style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressedButton]}
              >
                <Text style={styles.secondaryButtonText}>Уже есть аккаунт</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  actionRow: {
    gap: 10,
  },
  appMeta: {
    color: '#59616C',
    fontSize: 13,
    marginTop: 2,
  },
  appName: {
    color: '#20242A',
    fontSize: 18,
    fontWeight: '900',
  },
  brandMark: {
    alignItems: 'center',
    backgroundColor: '#146C5D',
    borderRadius: 8,
    height: 46,
    justifyContent: 'center',
    width: 46,
  },
  brandRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  contentGrid: {
    gap: 20,
  },
  contentGridWide: {
    alignItems: 'flex-start',
    flexDirection: 'row',
  },
  fieldGrid: {
    gap: 16,
  },
  formArea: {
    flex: 1,
    gap: 16,
    minWidth: 0,
  },
  formSection: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D8DEE6',
    borderRadius: 8,
    borderWidth: 1,
    gap: 16,
    padding: 16,
  },
  formSectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  formSectionTitle: {
    color: '#20242A',
    fontSize: 17,
    fontWeight: '900',
  },
  headerBand: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D8DEE6',
    borderRadius: 8,
    borderWidth: 1,
    gap: 24,
    padding: 18,
  },
  heroCopy: {
    gap: 8,
  },
  heroText: {
    color: '#59616C',
    fontSize: 15,
    lineHeight: 22,
    maxWidth: 640,
  },
  heroTitle: {
    color: '#20242A',
    fontSize: 32,
    fontWeight: '900',
    lineHeight: 38,
  },
  page: {
    backgroundColor: '#F4F7F5',
    gap: 20,
    minHeight: '100%',
    padding: 16,
  },
  panelText: {
    color: '#20242A',
    fontSize: 13,
    lineHeight: 19,
  },
  panelTextMuted: {
    color: '#59616C',
    fontSize: 12,
    lineHeight: 17,
  },
  pressedButton: {
    opacity: 0.78,
  },
  roleList: {
    gap: 10,
  },
  safeArea: {
    backgroundColor: '#F4F7F5',
    flex: 1,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderColor: '#D8DEE6',
    borderRadius: 8,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: '#20242A',
    fontSize: 14,
    fontWeight: '900',
  },
  sectionHeader: {
    gap: 5,
  },
  sectionHint: {
    color: '#59616C',
    fontSize: 14,
    lineHeight: 20,
  },
  sectionTitle: {
    color: '#20242A',
    fontSize: 22,
    fontWeight: '900',
  },
  sidebar: {
    flexShrink: 0,
    gap: 14,
    width: '100%',
  },
  sidebarWide: {
    width: 330,
  },
  stepBadge: {
    alignItems: 'center',
    backgroundColor: '#E9F4F1',
    borderRadius: 8,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  stepBadgeText: {
    color: '#146C5D',
    fontSize: 13,
    fontWeight: '900',
  },
  stepRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  stepText: {
    color: '#20242A',
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  steps: {
    backgroundColor: '#FFFFFF',
    borderColor: '#D8DEE6',
    borderRadius: 8,
    borderWidth: 1,
    gap: 10,
    padding: 14,
  },
  submitButton: {
    alignItems: 'center',
    backgroundColor: '#146C5D',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 52,
    paddingHorizontal: 16,
  },
  submitButtonMuted: {
    backgroundColor: '#89958F',
  },
  submitText: {
    color: '#FFFFFF',
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
  },
});
