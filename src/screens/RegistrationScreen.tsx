import { type ComponentType, useEffect, useMemo, useRef, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  AlertCircle,
  Building2,
  Car,
  Check,
  ChevronRight,
  ClipboardCheck,
  FileText,
  Link as LinkIcon,
  type LucideProps,
  ShieldCheck,
  UserRound,
} from 'lucide-react-native';
import {
  Animated,
  Easing,
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
import {
  AccountRole,
  consentItems,
  getFieldsForRole,
  isSelfEmployedDriverRole,
  normalizeAccountRole,
  roleCopy,
  sectionTitles,
} from '../data/registration';
import { driverAccessPlans } from '../data/subscription';
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
import {
  kinetixBorders,
  kinetixColors,
  kinetixComponentTokens,
  kinetixIconography,
  kinetixMotion,
  kinetixRadii,
  kinetixSpacing,
  kinetixTouchTargets,
  kinetixTypography,
} from '../theme/kinetixTokens';

type Props = NativeStackScreenProps<RootStackParamList, 'Registration'>;

const roleIcons = {
  client: UserRound,
  self_employed_driver: Car,
  park_admin: Building2,
  park_driver: Car,
  driver: Car,
  fleet: Building2,
};

const orderedRoles: AccountRole[] = ['client', 'self_employed_driver'];
const sectionOrder = ['account', 'identity', 'legal', 'vehicle', 'business', 'payments'] as const;
const passwordFieldIds = new Set(['appPassword']);
const roleLeadCopy: Record<AccountRole, string> = {
  client: 'Заказать',
  driver: 'Принимать заказы',
  fleet: 'Управлять парком',
  park_admin: 'Управлять парком',
  park_driver: 'По приглашению',
  self_employed_driver: 'Принимать заказы',
};
type RegistrationStepId = 'confirm' | 'contact' | 'details' | 'password' | 'role';

export function RegistrationScreen({ navigation, route }: Props) {
  const { width } = useWindowDimensions();
  const { registerAccount, serverMessage } = useAppState();
  const referralCodeFromLink = normalizeReferralCodeParam(route.params?.referralCode);
  const roleFromLink = normalizeRoleParam(route.params?.role, referralCodeFromLink);
  const [role, setRole] = useState<AccountRole>(roleFromLink);
  const [values, setValues] = useState<FormValues>(() => {
    const initialValues: FormValues = {};

    if (referralCodeFromLink) {
      initialValues.referralCode = referralCodeFromLink;

      if (isFleetInviteCode(referralCodeFromLink)) {
        initialValues.parkInviteCode = referralCodeFromLink;
      }
    }

    return initialValues;
  });
  const [consents, setConsents] = useState<ConsentValues>(() => createConsentState());
  const [submitted, setSubmitted] = useState(false);
  const [isSavingApplication, setIsSavingApplication] = useState(false);
  const [serverNotice, setServerNotice] = useState<string | null>(null);
  const [activeStepId, setActiveStepId] = useState<RegistrationStepId>('role');
  const stepTransition = useRef(new Animated.Value(1)).current;

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
        : {
            ...current,
            referralCode: referralCodeFromLink,
            ...(isFleetInviteCode(referralCodeFromLink)
              ? { parkInviteCode: current.parkInviteCode || referralCodeFromLink }
              : {}),
          },
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
  const hasDetailsStep = fieldsBySection.some((group) => group.section !== 'account');
  const hasPasswordStep = fields.some((field) => passwordFieldIds.has(field.id));
  const registrationSteps = useMemo(() => {
    const steps: Array<{ id: RegistrationStepId; title: string; hint: string }> = [
      { id: 'role', title: 'Роль', hint: 'Кем вы входите в сервис' },
      { id: 'contact', title: 'Контакт', hint: 'Имя, телефон, почта и приглашение' },
    ];

    if (hasPasswordStep) {
      steps.push({ id: 'password', title: 'Пароль', hint: 'Отдельный пароль для приложения' });
    }

    if (hasDetailsStep) {
      steps.push({ id: 'details', title: 'Детали', hint: 'Данные для допуска' });
    }

    steps.push({ id: 'confirm', title: 'Готово', hint: 'Согласия и отправка' });

    return steps;
  }, [hasDetailsStep, hasPasswordStep]);
  const activeStepIndex = Math.max(0, registrationSteps.findIndex((step) => step.id === activeStepId));
  const activeStep = registrationSteps[activeStepIndex] ?? registrationSteps[0];
  const showSidebar = activeStep.id !== 'role' && isWide;
  const nextButtonLabel = isSavingApplication ? 'Отправляем заявку...' : 'Продолжить';
  const visibleFieldSections = useMemo(() => {
    if (activeStep.id === 'contact') {
      return fieldsBySection
        .filter((group) => group.section === 'account')
        .map((group) => ({
          ...group,
          fields: group.fields.filter((field) => !passwordFieldIds.has(field.id)),
        }))
        .filter((group) => group.fields.length > 0);
    }

    if (activeStep.id === 'password') {
      return fieldsBySection
        .filter((group) => group.section === 'account')
        .map((group) => ({
          ...group,
          fields: group.fields.filter((field) => passwordFieldIds.has(field.id)),
        }))
        .filter((group) => group.fields.length > 0);
    }

    if (activeStep.id === 'details') {
      return fieldsBySection.filter((group) => group.section !== 'account');
    }

    return [];
  }, [activeStep.id, fieldsBySection]);
  const stepAnimatedStyle = {
    opacity: stepTransition,
    transform: [
      {
        translateX: stepTransition.interpolate({
          inputRange: [0, 1],
          outputRange: [14, 0],
        }),
      },
    ],
  };

  useEffect(() => {
    if (!registrationSteps.some((step) => step.id === activeStepId)) {
      setActiveStepId('contact');
    }
  }, [activeStepId, registrationSteps]);

  useEffect(() => {
    stepTransition.setValue(0);
    Animated.timing(stepTransition, {
      duration: 220,
      easing: Easing.out(Easing.cubic),
      toValue: 1,
      useNativeDriver: true,
    }).start();
  }, [activeStep.id, stepTransition]);

  const updateValue = (id: string, nextValue: string) => {
    setSubmitted(false);
    setServerNotice(null);
    setValues((current) => ({ ...current, [id]: nextValue }));
  };

  const toggleConsent = (id: keyof ConsentValues) => {
    setSubmitted(false);
    setConsents((current) => ({ ...current, [id]: !current[id] }));
  };

  const handleRoleChange = (nextRole: AccountRole) => {
    setSubmitted(false);
    setRole(nextRole);
  };

  const goToNextStep = () => {
    if (activeStep.id === 'confirm') {
      void handleSubmit();
      return;
    }

    const nextStep = registrationSteps[activeStepIndex + 1];
    if (nextStep) {
      setActiveStepId(nextStep.id);
    }
  };

  const goToPreviousStep = () => {
    const previousStep = registrationSteps[activeStepIndex - 1];
    if (previousStep) {
      setActiveStepId(previousStep.id);
    }
  };

  const handleSubmit = async () => {
    if (!canSubmit) {
      setSubmitted(true);
      return;
    }

    setIsSavingApplication(true);
    setServerNotice(null);

    const normalizedReferralCode = normalizeReferralCodeParam(values.referralCode);
    const shouldValidateReferralCode = Boolean(
      normalizedReferralCode && !isFleetInviteCode(normalizedReferralCode),
    );

    if (shouldValidateReferralCode) {
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
      referralCode: shouldValidateReferralCode ? normalizedReferralCode : undefined,
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
        {activeStep.id === 'role' ? (
          <View style={styles.brandHeader}>
            <View style={styles.brandMark}>
              <Car color={kinetixColors.textPrimary} size={24} strokeWidth={2.4} />
            </View>
            <View style={styles.brandCopy}>
              <Text style={styles.brandTitle}>Такси Салават</Text>
              <Text style={styles.brandSubtitle}>Регистрация</Text>
            </View>
          </View>
        ) : null}

        <View style={styles.screenHeader}>
          <Text style={styles.screenTitle}>
            {activeStep.id === 'role' ? 'Аккаунт' : activeStep.title}
          </Text>
          <Text style={styles.screenHint}>
            {activeStep.id === 'role' ? 'Выберите роль' : activeStep.hint}
          </Text>
        </View>

        <View style={[styles.contentGrid, showSidebar && styles.contentGridWide]}>
          {showSidebar ? (
            <View style={[styles.sidebar, styles.sidebarWide]}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{activeStep.title}</Text>
                <Text numberOfLines={2} style={styles.sectionHint}>{activeStep.hint}</Text>
              </View>

              <InfoPanel Icon={ShieldCheck} title="Текущий шаг">
                <Text style={styles.panelText}>{activeStep.hint}</Text>
                <Text style={styles.panelTextMuted}>Выбрано: {roleCopy[role].title}</Text>
              </InfoPanel>

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
                  Ссылка открывает регистрацию, подставляет код и для PARK-кода сразу включает роль водителя таксопарка.
                </Text>
              </InfoPanel>

              {isSelfEmployedDriverRole(normalizeAccountRole(role)) ? (
                <InfoPanel Icon={Car} title="Партнёр PRO">
                  <Text style={styles.panelText}>
                    2 490 ₽ / месяц или 100 ₽ / день · вся сумма поездки остается водителю.
                  </Text>
                  <Text style={styles.panelTextMuted}>{driverAccessPlans.monthly.description}</Text>
                </InfoPanel>
              ) : null}
            </View>
          ) : null}

          <View style={[styles.formArea, activeStep.id === 'role' && styles.roleFormArea]}>
            {activeStep.id !== 'role' ? (
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>{roleCopy[role].title}</Text>
                <Text numberOfLines={2} style={styles.sectionHint}>{roleCopy[role].reviewStatus}</Text>
              </View>
            ) : null}

            {activeStep.id !== 'role' ? (
              <View style={styles.steps}>
                {registrationSteps.map((step, index) => {
                  const active = step.id === activeStep.id;
                  const done = index < activeStepIndex;

                  return (
                    <View key={step.id} style={[styles.stepRow, active && styles.stepRowActive]}>
                      <View style={[styles.stepBadge, done && styles.stepBadgeDone, active && styles.stepBadgeActive]}>
                        <Text style={[styles.stepBadgeText, (active || done) && styles.stepBadgeTextActive]}>
                          {done ? '✓' : index + 1}
                        </Text>
                      </View>
                      <View style={styles.stepCopy}>
                        <Text numberOfLines={1} style={[styles.stepText, active && styles.stepTextActive]}>
                          {step.title}
                        </Text>
                        <Text numberOfLines={1} style={styles.stepHint}>{step.hint}</Text>
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : null}

            <Animated.View style={[styles.stepPane, stepAnimatedStyle]}>
              {activeStep.id === 'role' ? (
                <>
                  <View style={styles.roleSection}>
                    <Text style={styles.formSectionTitle}>Роль</Text>
                    <View style={[styles.roleCards, isWide && styles.roleCardsWide]}>
                      {orderedRoles.map((item) => {
                        const copy = roleCopy[item];
                        const Icon = roleIcons[item];

                        return (
                          <RoleChoiceCard
                            Icon={Icon}
                            active={item === role}
                            key={item}
                            onPress={() => handleRoleChange(item)}
                            subtitle={roleLeadCopy[item]}
                            title={copy.title}
                            wide={isWide}
                          />
                        );
                      })}
                    </View>
                  </View>

                  <View style={styles.quickRows}>
                    <PreferenceRow
                      Icon={ShieldCheck}
                      onPress={() => setActiveStepId(hasPasswordStep ? 'password' : 'contact')}
                      subtitle="Отдельный пароль"
                      title="Безопасность"
                    />
                    <PreferenceRow
                      Icon={LinkIcon}
                      onPress={() => setActiveStepId('contact')}
                      subtitle="Код партнёра"
                      title="Инвайт"
                    />
                  </View>
                </>
              ) : null}

              {visibleFieldSections.map((group) => (
                <View key={group.section} style={styles.formSection}>
                  <View style={styles.formSectionHeader}>
                    <FileText color={kinetixColors.amber} size={18} strokeWidth={2.4} />
                    <Text style={styles.formSectionTitle}>
                      {activeStep.id === 'password' ? 'Пароль для приложения' : sectionTitles[group.section]}
                    </Text>
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

              {activeStep.id === 'confirm' ? (
                <>
                  <View style={styles.formSection}>
                    <View style={styles.formSectionHeader}>
                      <ClipboardCheck color={kinetixColors.amber} size={18} strokeWidth={2.4} />
                      <Text style={styles.formSectionTitle}>Проверка перед отправкой</Text>
                    </View>
                    <Text style={styles.panelText}>Роль: {roleCopy[role].title}</Text>
                    <Text style={styles.panelText}>Телефон: {values.phone || 'не указан'}</Text>
                    <Text style={styles.panelText}>Почта: {values.email || 'не указана'}</Text>
                    <Text style={styles.panelTextMuted}>
                      После отправки откроется подтверждение {skipPhoneVerification ? 'почты' : 'телефона'}.
                    </Text>
                  </View>

                  <View style={styles.formSection}>
                    <View style={styles.formSectionHeader}>
                      <ClipboardCheck color={kinetixColors.amber} size={18} strokeWidth={2.4} />
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
                </>
              ) : null}
            </Animated.View>

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
              {activeStepIndex > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={goToPreviousStep}
                  style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressedButton]}
                >
                  <Text style={styles.secondaryButtonText}>Назад</Text>
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="button"
                disabled={isSavingApplication}
                onPress={goToNextStep}
                style={({ pressed }) => [
                  styles.submitButton,
                  activeStep.id === 'confirm' && !canSubmit && styles.submitButtonMuted,
                  isSavingApplication && styles.submitButtonMuted,
                  pressed && styles.pressedButton,
                ]}
              >
                <Text style={styles.submitText}>{nextButtonLabel}</Text>
              </Pressable>
              <Pressable
                accessibilityRole="button"
                onPress={() => navigation.navigate('Welcome')}
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

type RoleChoiceCardProps = {
  active: boolean;
  Icon: ComponentType<LucideProps>;
  onPress: () => void;
  subtitle: string;
  title: string;
  wide: boolean;
};

function RoleChoiceCard({ active, Icon, onPress, subtitle, title, wide }: RoleChoiceCardProps) {
  return (
    <Pressable
      accessibilityLabel={`Выбрать роль: ${title}`}
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.roleChoice,
        wide && styles.roleChoiceWide,
        active && styles.roleChoiceActive,
        pressed && styles.pressedButton,
      ]}
    >
      {active ? (
        <View style={styles.roleCheck}>
          <Check color={kinetixColors.surface} size={14} strokeWidth={3} />
        </View>
      ) : null}

      <View style={[styles.roleIconWrap, active && styles.roleIconWrapActive]}>
        <Icon
          color={active ? kinetixColors.surface : kinetixColors.amber}
          size={kinetixIconography.sizes.regular}
          strokeWidth={2.3}
        />
      </View>
      <View style={styles.roleChoiceCopy}>
        <Text style={styles.roleChoiceTitle}>{title}</Text>
        <Text numberOfLines={2} style={styles.roleChoiceSubtitle}>{subtitle}</Text>
      </View>
    </Pressable>
  );
}

type PreferenceRowProps = {
  Icon: ComponentType<LucideProps>;
  onPress: () => void;
  subtitle: string;
  title: string;
};

function PreferenceRow({ Icon, onPress, subtitle, title }: PreferenceRowProps) {
  return (
    <Pressable
      accessibilityLabel={`${title}: ${subtitle}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [styles.quickRow, pressed && styles.pressedButton]}
    >
      <View style={styles.quickIcon}>
        <Icon
          color={kinetixColors.textPrimary}
          size={kinetixIconography.sizes.small}
          strokeWidth={2.3}
        />
      </View>
      <View style={styles.quickCopy}>
        <Text style={styles.quickTitle}>{title}</Text>
        <Text style={styles.quickSubtitle}>{subtitle}</Text>
      </View>
      <ChevronRight color={kinetixColors.textMuted} size={20} strokeWidth={2.4} />
    </Pressable>
  );
}

function normalizeReferralCodeParam(value?: string) {
  return String(value || '')
    .trim()
    .toUpperCase()
    .replace(/[^A-ZА-Я0-9]/g, '');
}

function normalizeRoleParam(value?: AccountRole, referralCode?: string) {
  const normalizedRole = normalizeAccountRole(value);

  if (orderedRoles.includes(normalizedRole)) {
    return normalizedRole;
  }

  if (isFleetInviteCode(referralCode)) {
    return 'self_employed_driver';
  }

  return 'client';
}

function getInviteLinkTemplate() {
  const linksOrigin = normalizePublicOrigin(getPublicEnv('EXPO_PUBLIC_LINKS_DOMAIN'));

  return linksOrigin ? `${linksOrigin}/invite/{code}` : 'taxipartner://invite/{code}';
}

function isFleetInviteCode(value?: string) {
  return Boolean(value?.startsWith('PARK'));
}

const styles = StyleSheet.create({
  actionRow: {
    gap: kinetixSpacing.sm,
  },
  brandCopy: {
    flex: 1,
    justifyContent: 'center',
    minWidth: 0,
  },
  brandHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: kinetixSpacing.sm,
    paddingHorizontal: kinetixSpacing.xs,
    paddingTop: kinetixSpacing.sm,
  },
  brandMark: {
    alignItems: 'center',
    backgroundColor: kinetixColors.amber,
    borderRadius: kinetixRadii.control,
    height: kinetixTouchTargets.iconLarge,
    justifyContent: 'center',
    shadowColor: kinetixColors.amberPressed,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.16,
    shadowRadius: 14,
    width: kinetixTouchTargets.iconLarge,
  },
  brandSubtitle: {
    color: kinetixColors.textSecondary,
    fontSize: kinetixTypography.sizes.body,
    fontWeight: kinetixTypography.weights.medium,
    lineHeight: kinetixTypography.lineHeights.body,
  },
  brandTitle: {
    color: kinetixColors.textPrimary,
    fontSize: kinetixTypography.sizes.title,
    fontWeight: '900',
    lineHeight: kinetixTypography.lineHeights.title,
  },
  contentGrid: {
    gap: kinetixSpacing.md,
  },
  contentGridWide: {
    alignItems: 'flex-start',
    flexDirection: 'row',
  },
  fieldGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: kinetixSpacing.sm,
  },
  fieldSlot: {
    flex: 1,
    minWidth: 230,
  },
  formArea: {
    flex: 1,
    gap: kinetixSpacing.md,
    minWidth: 0,
  },
  formSection: {
    backgroundColor: kinetixColors.surface,
    borderColor: kinetixColors.line,
    borderRadius: kinetixRadii.card,
    borderWidth: kinetixBorders.hairline,
    elevation: 1,
    gap: kinetixSpacing.sm,
    padding: kinetixSpacing.md,
    shadowColor: kinetixColors.shadow,
    shadowOffset: { height: 7, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
  },
  formSectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: kinetixSpacing.xs,
  },
  formSectionTitle: {
    color: kinetixColors.textPrimary,
    fontSize: kinetixTypography.sizes.body,
    fontWeight: '900',
    lineHeight: kinetixTypography.lineHeights.body,
  },
  page: {
    backgroundColor: kinetixColors.graphite,
    flexGrow: 1,
    gap: kinetixSpacing.lg,
    minHeight: '100%',
    paddingBottom: kinetixSpacing.xxl,
    paddingHorizontal: kinetixSpacing.md,
    paddingTop: kinetixSpacing.xl,
  },
  panelText: {
    color: kinetixColors.textPrimary,
    fontSize: kinetixTypography.sizes.meta,
    lineHeight: kinetixTypography.lineHeights.meta,
  },
  panelTextMuted: {
    color: kinetixColors.textSecondary,
    fontSize: kinetixTypography.sizes.caption,
    lineHeight: kinetixTypography.lineHeights.caption,
  },
  pressedButton: {
    opacity: 0.9,
    transform: [{ scale: kinetixMotion.pressScale }],
  },
  quickCopy: {
    flex: 1,
    minWidth: 0,
  },
  quickDivider: {
    backgroundColor: kinetixColors.line,
    display: 'none',
    height: kinetixBorders.hairline,
    marginLeft: kinetixTouchTargets.icon + kinetixSpacing.md,
  },
  quickIcon: {
    alignItems: 'center',
    backgroundColor: kinetixColors.surfaceRaised,
    borderRadius: kinetixRadii.control,
    height: kinetixTouchTargets.iconLarge,
    justifyContent: 'center',
    width: kinetixTouchTargets.iconLarge,
  },
  quickRow: {
    alignItems: 'center',
    backgroundColor: kinetixColors.surface,
    borderColor: kinetixColors.line,
    borderRadius: kinetixRadii.card,
    borderWidth: kinetixBorders.hairline,
    elevation: 1,
    flexDirection: 'row',
    gap: kinetixSpacing.md,
    minHeight: 80,
    paddingHorizontal: kinetixSpacing.md,
    paddingVertical: kinetixSpacing.sm,
    shadowColor: kinetixColors.shadow,
    shadowOffset: { height: 7, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
  },
  quickRows: {
    gap: kinetixSpacing.sm,
  },
  quickSubtitle: {
    color: kinetixColors.textSecondary,
    fontSize: kinetixTypography.sizes.meta,
    fontWeight: kinetixTypography.weights.semibold,
    lineHeight: kinetixTypography.lineHeights.meta,
  },
  quickTitle: {
    color: kinetixColors.textPrimary,
    fontSize: kinetixTypography.sizes.bodyLarge,
    fontWeight: '900',
    lineHeight: kinetixTypography.lineHeights.bodyLarge,
  },
  roleCards: {
    flexDirection: 'row',
    gap: kinetixSpacing.sm,
  },
  roleCardsWide: {
    flexDirection: 'row',
  },
  roleCheck: {
    alignItems: 'center',
    backgroundColor: kinetixColors.amber,
    borderRadius: kinetixRadii.mapPin,
    height: 24,
    justifyContent: 'center',
    position: 'absolute',
    right: kinetixSpacing.sm,
    top: kinetixSpacing.sm,
    width: 24,
  },
  roleChoice: {
    alignItems: 'center',
    backgroundColor: kinetixColors.surface,
    borderColor: kinetixColors.line,
    borderRadius: 12,
    borderWidth: kinetixBorders.hairline,
    elevation: 1,
    flex: 1,
    gap: kinetixSpacing.md,
    justifyContent: 'center',
    minHeight: 178,
    minWidth: 0,
    overflow: 'hidden',
    padding: kinetixSpacing.md,
    paddingTop: kinetixSpacing.xl,
    shadowColor: kinetixColors.shadow,
    shadowOffset: { height: 7, width: 0 },
    shadowOpacity: 0.08,
    shadowRadius: 14,
  },
  roleChoiceActive: {
    backgroundColor: kinetixColors.surfaceLight,
    borderColor: kinetixColors.lineStrong,
    borderWidth: kinetixBorders.active,
  },
  roleChoiceCopy: {
    alignItems: 'center',
    gap: kinetixSpacing.xxs,
    justifyContent: 'center',
    minWidth: 0,
  },
  roleChoiceSubtitle: {
    color: kinetixColors.textSecondary,
    fontSize: kinetixTypography.sizes.meta,
    lineHeight: kinetixTypography.lineHeights.meta,
    textAlign: 'center',
  },
  roleChoiceTitle: {
    color: kinetixColors.textPrimary,
    fontSize: kinetixTypography.sizes.bodyLarge,
    fontWeight: '900',
    lineHeight: kinetixTypography.lineHeights.bodyLarge,
    textAlign: 'center',
  },
  roleChoiceWide: {
    flex: 1,
    minWidth: 0,
  },
  roleFormArea: {
    alignSelf: 'center',
    maxWidth: 680,
    width: '100%',
  },
  roleIconWrap: {
    alignItems: 'center',
    backgroundColor: kinetixColors.surfaceRaised,
    borderRadius: kinetixRadii.card,
    height: 52,
    justifyContent: 'center',
    width: 52,
  },
  roleIconWrapActive: {
    backgroundColor: kinetixColors.amber,
  },
  roleSection: {
    gap: kinetixSpacing.md,
  },
  safeArea: {
    backgroundColor: kinetixColors.graphite,
    flex: 1,
  },
  screenEyebrow: {
    color: kinetixColors.amber,
    fontSize: kinetixTypography.sizes.meta,
    fontWeight: kinetixTypography.weights.bold,
    lineHeight: kinetixTypography.lineHeights.meta,
  },
  screenHeader: {
    gap: kinetixSpacing.xxs,
    paddingHorizontal: kinetixSpacing.xxs,
  },
  screenHint: {
    color: kinetixColors.textSecondary,
    fontSize: kinetixTypography.sizes.body,
    fontWeight: kinetixTypography.weights.bold,
    lineHeight: kinetixTypography.lineHeights.body,
    maxWidth: 620,
  },
  screenTitle: {
    color: kinetixColors.textPrimary,
    fontSize: 30,
    fontWeight: '900',
    lineHeight: kinetixTypography.lineHeights.headline,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: kinetixComponentTokens.secondaryButton.backgroundColor,
    borderColor: 'rgba(0, 141, 73, 0.28)',
    borderRadius: kinetixComponentTokens.secondaryButton.borderRadius,
    borderWidth: kinetixBorders.hairline,
    justifyContent: 'center',
    minHeight: kinetixComponentTokens.secondaryButton.minHeight,
    paddingHorizontal: kinetixSpacing.md,
  },
  secondaryButtonText: {
    color: kinetixColors.textPrimary,
    fontSize: kinetixTypography.sizes.meta,
    fontWeight: '900',
  },
  sectionHeader: {
    gap: kinetixSpacing.xxs,
  },
  sectionHint: {
    color: kinetixColors.textSecondary,
    fontSize: kinetixTypography.sizes.meta,
    lineHeight: kinetixTypography.lineHeights.meta,
  },
  sectionTitle: {
    color: kinetixColors.textPrimary,
    fontSize: kinetixTypography.sizes.bodyLarge,
    fontWeight: '900',
    lineHeight: kinetixTypography.lineHeights.bodyLarge,
  },
  sidebar: {
    flexShrink: 0,
    gap: kinetixSpacing.sm,
    width: '100%',
  },
  sidebarWide: {
    width: 330,
  },
  stepBadge: {
    alignItems: 'center',
    backgroundColor: kinetixColors.amberSoft,
    borderRadius: kinetixRadii.control,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  stepBadgeActive: {
    backgroundColor: kinetixColors.amber,
  },
  stepBadgeDone: {
    backgroundColor: kinetixColors.brandDeep,
  },
  stepBadgeText: {
    color: kinetixColors.amber,
    fontSize: kinetixTypography.sizes.caption,
    fontWeight: '900',
  },
  stepBadgeTextActive: {
    color: kinetixColors.surfaceLight,
  },
  stepCopy: {
    flex: 1,
    minWidth: 0,
  },
  stepHint: {
    color: kinetixColors.textMuted,
    fontSize: 11,
    lineHeight: 15,
  },
  stepPane: {
    gap: kinetixSpacing.sm,
  },
  stepRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: kinetixSpacing.xs,
  },
  stepRowActive: {
    backgroundColor: kinetixColors.amberSoft,
    borderRadius: kinetixRadii.control,
    marginHorizontal: -kinetixSpacing.xxs,
    padding: kinetixSpacing.xxs,
  },
  stepText: {
    color: kinetixColors.textPrimary,
    flex: 1,
    fontSize: kinetixTypography.sizes.meta,
    fontWeight: kinetixTypography.weights.bold,
    lineHeight: kinetixTypography.lineHeights.meta,
  },
  stepTextActive: {
    color: kinetixColors.amber,
    fontWeight: '900',
  },
  steps: {
    backgroundColor: kinetixColors.surface,
    borderColor: kinetixColors.line,
    borderRadius: kinetixRadii.card,
    borderWidth: kinetixBorders.hairline,
    gap: kinetixSpacing.xs,
    padding: kinetixSpacing.sm,
  },
  submitButton: {
    alignItems: 'center',
    backgroundColor: kinetixComponentTokens.primaryButton.backgroundColor,
    borderRadius: kinetixComponentTokens.primaryButton.borderRadius,
    elevation: 2,
    justifyContent: 'center',
    minHeight: kinetixComponentTokens.primaryButton.minHeight,
    paddingHorizontal: kinetixSpacing.md,
    shadowColor: kinetixColors.amberPressed,
    shadowOffset: { height: 8, width: 0 },
    shadowOpacity: 0.18,
    shadowRadius: 16,
  },
  submitButtonMuted: {
    backgroundColor: kinetixColors.disabled,
  },
  submitText: {
    color: kinetixComponentTokens.primaryButton.textColor,
    flexShrink: 1,
    fontSize: kinetixTypography.sizes.body,
    fontWeight: '900',
    textAlign: 'center',
  },
});
