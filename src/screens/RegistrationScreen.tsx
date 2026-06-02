import { useEffect, useMemo, useState } from 'react';
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
  isSelfEmployedDriverRole,
  normalizeAccountRole,
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
import { validateReferralCode } from '../services/apiClient';
import { useAppState } from '../state/AppState';
import { getPublicEnv, isPhoneVerificationSkipped, normalizePublicOrigin } from '../utils/runtimeFlags';

type Props = NativeStackScreenProps<RootStackParamList, 'Registration'>;

const roleIcons = {
  client: UserRound,
  self_employed_driver: Car,
  park_admin: Building2,
  park_driver: Car,
  driver: Car,
  fleet: Building2,
};

const orderedRoles: AccountRole[] = ['client', 'self_employed_driver', 'park_admin'];
const sectionOrder = ['account', 'identity', 'legal', 'vehicle', 'business', 'payments'] as const;

export function RegistrationScreen({ navigation, route }: Props) {
  const { width } = useWindowDimensions();
  const { registerAccount, serverMessage } = useAppState();
  const referralCodeFromLink = normalizeReferralCodeParam(route.params?.referralCode);
  const roleFromLink = normalizeRoleParam(route.params?.role);
  const [role, setRole] = useState<AccountRole>(roleFromLink);
  const [values, setValues] = useState<FormValues>(() => {
    const initialValues: FormValues = {};

    if (referralCodeFromLink) {
      initialValues.referralCode = referralCodeFromLink;
    }

    return initialValues;
  });
  const [consents, setConsents] = useState<ConsentValues>(() => createConsentState());
  const [submitted, setSubmitted] = useState(false);
  const [isSavingApplication, setIsSavingApplication] = useState(false);
  const [serverNotice, setServerNotice] = useState<string | null>(null);

  const fields = useMemo(() => getFieldsForRole(role), [role]);
  const validationErrors = useMemo(
    () => validateRegistration(role, values, consents),
    [consents, role, values],
  );
  const canSubmit = validationErrors.length === 0;
  const isWide = width >= 720;
  const skipPhoneVerification = isPhoneVerificationSkipped();

  useEffect(() => {
    if (!referralCodeFromLink) {
      return;
    }

    setValues((current) =>
      current.referralCode === referralCodeFromLink
        ? current
        : { ...current, referralCode: referralCodeFromLink },
    );
  }, [referralCodeFromLink]);

  useEffect(() => {
    setRole(roleFromLink);
  }, [roleFromLink]);

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
    setServerNotice(null);
    setValues((current) => ({ ...current, [id]: nextValue }));
  };

  const toggleConsent = (id: keyof ConsentValues) => {
    setSubmitted(false);
    setConsents((current) => ({ ...current, [id]: !current[id] }));
  };

  const handleSubmit = async () => {
    if (!canSubmit) {
      setSubmitted(true);
      return;
    }

    setIsSavingApplication(true);
    setServerNotice(null);

    const normalizedReferralCode = normalizeReferralCodeParam(values.referralCode);

    if (normalizedReferralCode) {
      try {
        const referralValidation = await validateReferralCode(
          normalizedReferralCode,
          values.email,
          values.phone,
        );

        if (!referralValidation.valid) {
          setIsSavingApplication(false);
          setServerNotice(referralValidation.error || 'Реферальный код не найден.');
          return;
        }

        setValues((current) => ({ ...current, referralCode: referralValidation.code }));
      } catch {
        setIsSavingApplication(false);
        setServerNotice('Не удалось проверить реферальный код. Проверьте backend и попробуйте еще раз.');
        return;
      }
    }

    const user = await registerAccount({
      carBrand: values.carBrand,
      carModel: values.carModel,
      carPlate: values.carPlate,
      companyName: values.companyName,
      driverInn: values.driverInn,
      driverLicense: values.driverLicense,
      drivingExperienceSince: values.drivingExperienceSince,
      email: values.email,
      firstName: values.firstName,
      fleetContact: values.fleetContact,
      fleetPayoutAccount: values.fleetPayoutAccount,
      inn: values.inn,
      lastName: values.lastName,
      legalAddress: values.legalAddress,
      noLegalRestrictionsDeclaration: values.noLegalRestrictionsDeclaration,
      ogrn: values.ogrn,
      parkInviteCode: values.parkInviteCode,
      password: values.appPassword ?? '',
      phone: values.phone,
      passportSeriesNumber: values.passportSeriesNumber,
      payoutAccount: values.payoutAccount,
      referralCode: normalizedReferralCode,
      role: normalizeAccountRole(role),
      stsNumber: values.stsNumber,
      taxiParkDriverAgreement: values.taxiParkDriverAgreement,
      taxStatus: values.taxStatus,
      vehicleDocumentsReady: values.vehicleDocumentsReady,
    });

    setIsSavingApplication(false);

    if (!user) {
      setServerNotice(serverMessage || 'Backend не создал аккаунт. Проверьте данные или сервер.');
      return;
    }

    const canonicalRole = normalizeAccountRole(role);
    setServerNotice(
      isSelfEmployedDriverRole(canonicalRole)
        ? 'Аккаунт и заявка водителя созданы на backend со статусом проверки.'
        : canonicalRole === 'park_admin'
          ? 'Аккаунт таксопарка создан на backend и отправлен на проверку.'
          : canonicalRole === 'park_driver'
            ? 'Аккаунт водителя таксопарка создан и привязан к приглашению.'
            : 'Аккаунт клиента создан на backend.',
    );

    const nextRouteParams = {
      email: values.email,
      firstName: values.firstName,
      role: normalizeAccountRole(role),
    };

    if (skipPhoneVerification) {
      navigation.navigate('VerifyEmail', nextRouteParams);
      return;
    }

    navigation.navigate('VerifyPhone', {
      ...nextRouteParams,
      phone: values.phone,
    });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled">
        <View style={styles.headerBand}>
          <View style={styles.brandRow}>
            <View style={styles.brandMark}>
              <Car color="#12382C" size={24} strokeWidth={2.4} />
            </View>
            <View style={styles.brandCopy}>
              <Text style={styles.appName}>Такси Салават</Text>
              <Text style={styles.appMeta}>Регистрация и проверка профиля</Text>
            </View>
          </View>

          <View style={styles.heroCopy}>
            <Text numberOfLines={2} style={styles.heroTitle}>Создание аккаунта</Text>
            <Text numberOfLines={3} style={styles.heroText}>
              Выберите роль, заполните анкету и подтвердите {skipPhoneVerification ? 'почту' : 'телефон с почтой'}.
              Водитель получает доступ к заказам после проверки документов и выбора модели: подписка 3000 ₽ или комиссия 7%.
            </Text>
          </View>
        </View>

        <View style={[styles.contentGrid, isWide && styles.contentGridWide]}>
          <View style={[styles.sidebar, isWide && styles.sidebarWide]}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Тип аккаунта</Text>
              <Text numberOfLines={2} style={styles.sectionHint}>Роль определяет поля анкеты и будущий кабинет.</Text>
            </View>

            {isWide ? (
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
            ) : (
              <ScrollView
                contentContainerStyle={styles.roleRail}
                horizontal
                showsHorizontalScrollIndicator={false}
              >
                {orderedRoles.map((item) => {
                  const copy = roleCopy[item];
                  const Icon = roleIcons[item];

                  return (
                    <View key={item} style={styles.roleRailItem}>
                      <RoleCard
                        Icon={Icon}
                        active={item === role}
                        onPress={() => {
                          setSubmitted(false);
                          setRole(item);
                        }}
                        subtitle={copy.subtitle}
                        title={copy.title}
                      />
                    </View>
                  );
                })}
              </ScrollView>
            )}

            <InfoPanel Icon={ShieldCheck} title="Безопасность данных">
              <Text numberOfLines={2} style={styles.panelText}>
                Используется отдельный пароль для приложения. Пароль от почты не запрашивается.
              </Text>
            </InfoPanel>

            <InfoPanel Icon={LinkIcon} title="Инвайт-ссылка">
              <Text numberOfLines={2} style={styles.panelText}>
                {referralCodeFromLink
                  ? `Код из приглашения: ${referralCodeFromLink}`
                  : getInviteLinkTemplate()}
              </Text>
              <Text numberOfLines={2} style={styles.panelTextMuted}>
                Ссылка открывает регистрацию и автоматически подставляет реферальный код.
              </Text>
            </InfoPanel>
          </View>

          <View style={styles.formArea}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>{roleCopy[role].title}</Text>
              <Text numberOfLines={2} style={styles.sectionHint}>{roleCopy[role].reviewStatus}</Text>
            </View>

            <View style={styles.steps}>
              {verificationSteps[role].map((step, index) => (
                <View key={step} style={styles.stepRow}>
                  <View style={styles.stepBadge}>
                    <Text style={styles.stepBadgeText}>{index + 1}</Text>
                  </View>
                  <Text numberOfLines={2} style={styles.stepText}>{step}</Text>
                </View>
              ))}
            </View>

            {fieldsBySection.map((group) => (
              <View key={group.section} style={styles.formSection}>
                <View style={styles.formSectionHeader}>
                  <FileText color="#008D49" size={18} strokeWidth={2.4} />
                  <Text style={styles.formSectionTitle}>{sectionTitles[group.section]}</Text>
                </View>
                <View style={styles.fieldGrid}>
                  {group.fields.map((field) => (
                    <View key={field.id} style={styles.fieldSlot}>
                      <FieldInput
                        field={field}
                        onChangeText={(nextValue) => updateValue(field.id, nextValue)}
                        value={values[field.id] ?? ''}
                      />
                    </View>
                  ))}
                </View>
              </View>
            ))}

            <View style={styles.formSection}>
              <View style={styles.formSectionHeader}>
                <ClipboardCheck color="#008D49" size={18} strokeWidth={2.4} />
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

            {serverNotice ? (
              <InfoPanel Icon={ShieldCheck} title="Статус заявки">
                <Text style={styles.panelText}>{serverNotice}</Text>
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
                <Text style={styles.submitText}>
                  {isSavingApplication ? 'Отправляем заявку...' : 'Продолжить к подтверждению'}
                </Text>
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

function normalizeReferralCodeParam(value?: string) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-ZА-Я0-9]/g, '');
}

function normalizeRoleParam(value?: AccountRole) {
  return normalizeAccountRole(value);
}

function getInviteLinkTemplate() {
  const linksOrigin = normalizePublicOrigin(getPublicEnv('EXPO_PUBLIC_LINKS_DOMAIN'));

  return linksOrigin ? `${linksOrigin}/invite/{code}` : 'taxipartner://invite/{code}';
}

const styles = StyleSheet.create({
  actionRow: {
    gap: 10,
  },
  appMeta: {
    color: '#557669',
    fontSize: 13,
    marginTop: 2,
  },
  appName: {
    color: '#12382C',
    fontSize: 18,
    fontWeight: '900',
  },
  brandMark: {
    alignItems: 'center',
    backgroundColor: '#008D49',
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
  brandCopy: {
    flex: 1,
    minWidth: 0,
  },
  contentGrid: {
    gap: 12,
  },
  contentGridWide: {
    alignItems: 'flex-start',
    flexDirection: 'row',
  },
  fieldGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },
  fieldSlot: {
    flex: 1,
    minWidth: 230,
  },
  formArea: {
    flex: 1,
    gap: 12,
    minWidth: 0,
  },
  formSection: {
    backgroundColor: '#FFFFFF',
    borderColor: '#008D49',
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 12,
  },
  formSectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  formSectionTitle: {
    color: '#12382C',
    fontSize: 17,
    fontWeight: '900',
  },
  headerBand: {
    backgroundColor: '#FFFFFF',
    borderColor: '#008D49',
    borderRadius: 8,
    borderWidth: 1,
    gap: 12,
    padding: 12,
  },
  heroCopy: {
    gap: 8,
  },
  heroText: {
    color: '#557669',
    fontSize: 14,
    lineHeight: 20,
    maxWidth: 640,
  },
  heroTitle: {
    color: '#12382C',
    fontSize: 26,
    fontWeight: '900',
    lineHeight: 30,
  },
  page: {
    backgroundColor: '#F4FAF6',
    gap: 12,
    minHeight: '100%',
    padding: 14,
  },
  panelText: {
    color: '#12382C',
    fontSize: 13,
    lineHeight: 19,
  },
  panelTextMuted: {
    color: '#557669',
    fontSize: 12,
    lineHeight: 17,
  },
  pressedButton: {
    opacity: 0.78,
  },
  roleList: {
    gap: 8,
  },
  roleRail: {
    gap: 8,
    paddingRight: 4,
  },
  roleRailItem: {
    width: 210,
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
    justifyContent: 'center',
    minHeight: 48,
    paddingHorizontal: 16,
  },
  secondaryButtonText: {
    color: '#12382C',
    fontSize: 14,
    fontWeight: '900',
  },
  sectionHeader: {
    gap: 5,
  },
  sectionHint: {
    color: '#557669',
    fontSize: 13,
    lineHeight: 18,
  },
  sectionTitle: {
    color: '#12382C',
    fontSize: 18,
    fontWeight: '900',
  },
  sidebar: {
    flexShrink: 0,
    gap: 10,
    width: '100%',
  },
  sidebarWide: {
    width: 330,
  },
  stepBadge: {
    alignItems: 'center',
    backgroundColor: '#E8F3EF',
    borderRadius: 8,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  stepBadgeText: {
    color: '#008D49',
    fontSize: 13,
    fontWeight: '900',
  },
  stepRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  stepText: {
    color: '#12382C',
    flex: 1,
    fontSize: 13,
    fontWeight: '700',
    lineHeight: 18,
  },
  steps: {
    backgroundColor: '#FFFFFF',
    borderColor: '#008D49',
    borderRadius: 8,
    borderWidth: 1,
    gap: 8,
    padding: 10,
  },
  submitButton: {
    alignItems: 'center',
    backgroundColor: '#008D49',
    borderRadius: 8,
    justifyContent: 'center',
    minHeight: 56,
    paddingHorizontal: 16,
  },
  submitButtonMuted: {
    backgroundColor: '#5A544E',
  },
  submitText: {
    color: '#FFFFFF',
    flexShrink: 1,
    fontSize: 15,
    fontWeight: '900',
    textAlign: 'center',
  },
});
