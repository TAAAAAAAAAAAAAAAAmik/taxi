import { type ComponentType, useEffect, useMemo, useRef, useState } from 'react';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import {
  AlertCircle,
  ArrowLeft,
  AtSign,
  Building2,
  Car,
  Check,
  ChevronRight,
  ClipboardCheck,
  FileText,
  KeyRound,
  Link as LinkIcon,
  type LucideProps,
  Navigation,
  Phone,
  ShieldCheck,
  UserRound,
  Wallet,
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
  FieldErrors,
  FormValues,
  createConsentState,
  hasMissingConsent,
  validateRegistration,
  validateRegistrationFields,
} from '../utils/validation';
import { useReducedMotionPreference } from '../hooks/useReducedMotionPreference';
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

// Иконки в тёмном hero — по активному шагу.
const stepHeroIcons: Record<RegistrationStepId, ComponentType<LucideProps>> = {
  confirm: ClipboardCheck,
  contact: UserRound,
  details: Car,
  password: KeyRound,
  role: Navigation,
};

// Иконки секций анкеты — в светло-зелёном сквиркле, как по всему приложению.
const sectionIcons: Record<(typeof sectionOrder)[number], ComponentType<LucideProps>> = {
  account: UserRound,
  business: Building2,
  identity: FileText,
  legal: ShieldCheck,
  payments: Wallet,
  vehicle: Car,
};

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
  // Ошибки, показанные на текущем шаге (подсветка полей включается только
  // после попытки продолжить — не пугаем красным во время набора).
  const [stepErrors, setStepErrors] = useState<FieldErrors>({});
  const [stepNotice, setStepNotice] = useState<string | null>(null);
  const stepTransition = useRef(new Animated.Value(1)).current;
  const scrollRef = useRef<ScrollView>(null);
  const reducedMotion = useReducedMotionPreference();

  const fields = useMemo(() => getFieldsForRole(role), [role]);
  const fieldErrors = useMemo(() => validateRegistrationFields(role, values), [role, values]);
  const consentMissing = hasMissingConsent(consents);
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
    const animation = Animated.timing(stepTransition, {
      duration: reducedMotion ? 0 : 240,
      easing: Easing.out(Easing.cubic),
      toValue: 1,
      useNativeDriver: false,
    });

    animation.start();

    return () => animation.stop();
  }, [activeStep.id, reducedMotion, stepTransition]);

  const updateValue = (id: string, nextValue: string) => {
    setSubmitted(false);
    setServerNotice(null);
    // Поправил поле — красная подсветка гаснет сразу.
    setStepErrors((current) => {
      if (!current[id]) {
        return current;
      }

      const next = { ...current };
      delete next[id];
      return next;
    });
    setValues((current) => ({ ...current, [id]: nextValue }));
  };

  const toggleConsent = (id: keyof ConsentValues) => {
    setSubmitted(false);
    setConsents((current) => ({ ...current, [id]: !current[id] }));
  };

  const handleRoleChange = (nextRole: AccountRole) => {
    setSubmitted(false);
    setStepErrors({});
    setStepNotice(null);
    setRole(nextRole);
  };

  const scrollToTop = () => {
    scrollRef.current?.scrollTo({ animated: !reducedMotion, y: 0 });
  };

  // Поля, видимые на текущем шаге, — их и проверяем перед переходом дальше.
  const currentStepFieldIds = useMemo(
    () => visibleFieldSections.flatMap((group) => group.fields.map((field) => field.id)),
    [visibleFieldSections],
  );

  // Шаг, на котором живёт поле, — для перехода к ошибке с финального шага.
  const stepForField = (fieldId: string): RegistrationStepId => {
    if (passwordFieldIds.has(fieldId)) {
      return hasPasswordStep ? 'password' : 'contact';
    }

    const field = fields.find((item) => item.id === fieldId);
    return field?.section === 'account' ? 'contact' : 'details';
  };

  const errorSteps = useMemo(() => {
    const stepIds = new Set(Object.keys(fieldErrors).map(stepForField));
    return registrationSteps.filter((step) => stepIds.has(step.id));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fieldErrors, fields, hasPasswordStep, registrationSteps]);

  const goToStep = (stepId: RegistrationStepId) => {
    setStepErrors({});
    setStepNotice(null);
    setActiveStepId(stepId);
  };

  const jumpToFix = (stepId: RegistrationStepId) => {
    // Открываем шаг сразу с подсвеченными проблемными полями.
    setSubmitted(false);
    setStepNotice('Поправьте подсвеченные поля.');
    setStepErrors(fieldErrors);
    setActiveStepId(stepId);
  };

  const goToNextStep = () => {
    if (activeStep.id === 'confirm') {
      void handleSubmit();
      return;
    }

    // Пошаговая проверка: дальше пускаем только с валидным текущим шагом,
    // ошибки показываем под конкретными полями.
    const errorsForStep: FieldErrors = {};
    currentStepFieldIds.forEach((id) => {
      if (fieldErrors[id]) {
        errorsForStep[id] = fieldErrors[id];
      }
    });

    if (Object.keys(errorsForStep).length > 0) {
      setStepErrors(errorsForStep);
      setStepNotice(
        Object.keys(errorsForStep).length === 1
          ? 'Осталось одно поле — оно подсвечено.'
          : 'Поправьте подсвеченные поля — и едем дальше.',
      );
      return;
    }

    setStepErrors({});
    setStepNotice(null);
    const nextStep = registrationSteps[activeStepIndex + 1];
    if (nextStep) {
      setActiveStepId(nextStep.id);
    }
  };

  const goToPreviousStep = () => {
    setStepErrors({});
    setStepNotice(null);
    const previousStep = registrationSteps[activeStepIndex - 1];
    if (previousStep) {
      setActiveStepId(previousStep.id);
    }
  };

  // Новый шаг всегда начинается с начала экрана.
  useEffect(() => {
    scrollToTop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeStep.id]);

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
      <ScrollView contentContainerStyle={styles.page} keyboardShouldPersistTaps="handled" ref={scrollRef}>
        <View style={styles.hero}>
          <View style={styles.heroGlow} />
          <View style={styles.heroTop}>
            <Pressable
              accessibilityLabel="Назад"
              accessibilityRole="button"
              onPress={() => (activeStepIndex > 0 ? goToPreviousStep() : navigation.navigate('Welcome'))}
              style={({ pressed }) => [styles.heroBack, pressed && styles.pressedButton]}
            >
              <ArrowLeft color={kinetixColors.lime} size={21} strokeWidth={2.3} />
            </Pressable>
            <View style={styles.heroBrand}>
              <Navigation color={kinetixColors.lime} fill={kinetixColors.lime} size={13} strokeWidth={2} />
              <Text style={styles.heroBrandText}>KINETIX</Text>
            </View>
          </View>

          <View style={styles.heroMain}>
            <View style={styles.heroIcon}>
              {(() => {
                const StepIcon = stepHeroIcons[activeStep.id];
                return <StepIcon color={kinetixColors.lime} size={23} strokeWidth={2.3} />;
              })()}
            </View>
            <View style={styles.heroCopy}>
              <Text style={styles.heroTitle}>
                {activeStep.id === 'role' ? 'Регистрация' : activeStep.title}
              </Text>
              <Text numberOfLines={2} style={styles.heroSub}>
                {activeStep.id === 'role' ? 'Минута — и вы в Kinetix' : activeStep.hint}
              </Text>
            </View>
          </View>

          <View style={styles.heroProgressTrack}>
            <View
              style={[
                styles.heroProgressFill,
                { width: `${Math.round(((activeStepIndex + 1) / registrationSteps.length) * 100)}%` },
              ]}
            />
          </View>
          <View style={styles.heroSteps}>
            {registrationSteps.map((step, index) => {
              const done = index < activeStepIndex;
              const active = step.id === activeStep.id;

              return (
                <Pressable
                  accessibilityLabel={`Шаг ${index + 1}: ${step.title}`}
                  accessibilityRole="button"
                  disabled={!done}
                  key={step.id}
                  onPress={() => goToStep(step.id)}
                  style={({ pressed }) => [styles.heroStep, pressed && done && styles.pressedButton]}
                >
                  <View
                    style={[
                      styles.heroStepDot,
                      done && styles.heroStepDotDone,
                      active && styles.heroStepDotActive,
                    ]}
                  >
                    {done ? (
                      <Check color="#0A1411" size={12} strokeWidth={3.2} />
                    ) : (
                      <Text style={[styles.heroStepNum, active && styles.heroStepNumActive]}>
                        {index + 1}
                      </Text>
                    )}
                  </View>
                  {active ? (
                    <Text numberOfLines={1} style={[styles.heroStepLabel, styles.heroStepLabelActive]}>
                      {step.title}
                    </Text>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
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
                    3 290 ₽ / месяц или 120 ₽ / день · вся сумма поездки остается водителю.
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

              {visibleFieldSections.map((group) => {
                const SectionIcon =
                  activeStep.id === 'password' ? KeyRound : sectionIcons[group.section];

                return (
                <View key={group.section} style={styles.formSection}>
                  <View style={styles.formSectionHeader}>
                    <View style={styles.sectionIconWrap}>
                      <SectionIcon color={kinetixColors.amber} size={18} strokeWidth={2.4} />
                    </View>
                    <Text style={styles.formSectionTitle}>
                      {activeStep.id === 'password' ? 'Пароль для приложения' : sectionTitles[group.section]}
                    </Text>
                  </View>
                  <View style={styles.fieldGrid}>
                    {group.fields.map((field) => (
                      <View key={field.id} style={styles.fieldSlot}>
                        <FieldInput
                          error={stepErrors[field.id]}
                          field={field}
                          onChangeText={(nextValue) => updateValue(field.id, nextValue)}
                          value={values[field.id] ?? ''}
                        />
                      </View>
                    ))}
                  </View>
                </View>
                );
              })}

              {activeStep.id === 'confirm' ? (
                <>
                  <View style={styles.formSection}>
                    <View style={styles.formSectionHeader}>
                      <View style={styles.sectionIconWrap}>
                        <ClipboardCheck color={kinetixColors.amber} size={18} strokeWidth={2.4} />
                      </View>
                      <Text style={styles.formSectionTitle}>Проверка перед отправкой</Text>
                    </View>
                    <View style={styles.summaryRows}>
                      <SummaryRow Icon={UserRound} label="Роль" value={roleCopy[role].title} />
                      <SummaryRow Icon={Phone} label="Телефон" value={values.phone || 'не указан'} />
                      <SummaryRow Icon={AtSign} label="Почта" value={values.email || 'не указана'} />
                    </View>
                    <Text style={styles.panelTextMuted}>
                      После отправки откроется подтверждение {skipPhoneVerification ? 'почты' : 'телефона'}.
                    </Text>
                  </View>

                  <View style={styles.formSection}>
                    <View style={styles.formSectionHeader}>
                      <View style={styles.sectionIconWrap}>
                        <ShieldCheck color={kinetixColors.amber} size={18} strokeWidth={2.4} />
                      </View>
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

            {stepNotice && activeStep.id !== 'confirm' ? (
              <InfoPanel Icon={AlertCircle} title="Почти готово" tone="warning">
                <Text style={styles.panelText}>{stepNotice}</Text>
              </InfoPanel>
            ) : null}

            {submitted && validationErrors.length > 0 ? (
              <InfoPanel Icon={AlertCircle} title="Нужно проверить анкету" tone="warning">
                {validationErrors.slice(0, 4).map((error) => (
                  <Text key={error} style={styles.panelText}>
                    {error}
                  </Text>
                ))}
                {errorSteps.length > 0 ? (
                  <View style={styles.fixRow}>
                    {errorSteps.map((step) => (
                      <Pressable
                        accessibilityRole="button"
                        key={step.id}
                        onPress={() => jumpToFix(step.id)}
                        style={({ pressed }) => [styles.fixChip, pressed && styles.pressedButton]}
                      >
                        <Text style={styles.fixChipText}>Исправить: {step.title}</Text>
                      </Pressable>
                    ))}
                  </View>
                ) : null}
                {consentMissing && errorSteps.length === 0 ? (
                  <Text style={styles.panelTextMuted}>Отметьте согласия выше — и можно отправлять.</Text>
                ) : null}
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
                disabled={isSavingApplication}
                onPress={goToNextStep}
                style={({ pressed }) => [
                  styles.submitButton,
                  activeStep.id === 'confirm' && !canSubmit && styles.submitButtonMuted,
                  isSavingApplication && styles.submitButtonMuted,
                  pressed && styles.pressedButton,
                ]}
              >
                <Text style={styles.submitText}>
                  {activeStep.id === 'confirm' && !isSavingApplication
                    ? 'Создать аккаунт'
                    : nextButtonLabel}
                </Text>
                {!isSavingApplication ? (
                  <ChevronRight color="#F4FAF6" size={19} strokeWidth={2.6} />
                ) : null}
              </Pressable>

              <View style={styles.quietRow}>
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
                  onPress={() => navigation.navigate('Welcome')}
                  style={({ pressed }) => [styles.secondaryButton, pressed && styles.pressedButton]}
                >
                  <Text style={styles.secondaryButtonText}>Уже есть аккаунт</Text>
                </Pressable>
              </View>
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
          <Check color="#0A1411" size={14} strokeWidth={3.2} />
        </View>
      ) : null}

      <View style={[styles.roleIconWrap, active && styles.roleIconWrapActive]}>
        <Icon
          color={active ? '#F4FAF6' : kinetixColors.amber}
          size={kinetixIconography.sizes.regular}
          strokeWidth={2.3}
        />
      </View>
      <View style={styles.roleChoiceCopy}>
        <Text style={[styles.roleChoiceTitle, active && styles.roleChoiceTitleActive]}>{title}</Text>
        <Text
          numberOfLines={2}
          style={[styles.roleChoiceSubtitle, active && styles.roleChoiceSubtitleActive]}
        >
          {subtitle}
        </Text>
      </View>

      {/* Фирменный рельс маршрута — точка → линия → пин */}
      <View style={styles.roleRoute}>
        <View style={[styles.roleRouteDot, active && styles.roleRouteDotActive]} />
        <View style={[styles.roleRouteLine, active && styles.roleRouteLineActive]} />
        <View style={[styles.roleRoutePin, active && styles.roleRoutePinActive]} />
      </View>
    </Pressable>
  );
}

type SummaryRowProps = {
  Icon: ComponentType<LucideProps>;
  label: string;
  value: string;
};

function SummaryRow({ Icon, label, value }: SummaryRowProps) {
  return (
    <View style={styles.summaryRow}>
      <View style={styles.summaryIcon}>
        <Icon color={kinetixColors.amber} size={16} strokeWidth={2.4} />
      </View>
      <Text style={styles.summaryLabel}>{label}</Text>
      <Text numberOfLines={1} style={styles.summaryValue}>{value}</Text>
    </View>
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
  hero: {
    backgroundColor: '#0A1411',
    borderBottomLeftRadius: 26,
    borderBottomRightRadius: 26,
    gap: 14,
    marginHorizontal: -kinetixSpacing.md,
    marginTop: -kinetixSpacing.md,
    overflow: 'hidden',
    paddingBottom: 18,
    paddingHorizontal: 20,
    paddingTop: 22,
    position: 'relative',
  },
  heroBack: {
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderColor: 'rgba(92, 230, 160, 0.22)',
    borderRadius: 13,
    borderWidth: 1,
    height: 42,
    justifyContent: 'center',
    width: 42,
  },
  heroBrand: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  heroBrandText: {
    color: 'rgba(183, 244, 106, 0.85)',
    fontSize: 12,
    fontWeight: '900',
    letterSpacing: 3,
  },
  heroCopy: {
    flex: 1,
    minWidth: 0,
  },
  heroGlow: {
    backgroundColor: 'rgba(92, 230, 160, 0.10)',
    borderRadius: 90,
    height: 180,
    position: 'absolute',
    right: -40,
    top: -30,
    width: 180,
  },
  heroIcon: {
    alignItems: 'center',
    backgroundColor: 'rgba(92, 230, 160, 0.12)',
    borderColor: 'rgba(92, 230, 160, 0.22)',
    borderRadius: 16,
    borderWidth: 1,
    height: 50,
    justifyContent: 'center',
    width: 50,
  },
  heroMain: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 14,
    position: 'relative',
    zIndex: 1,
  },
  heroProgressTrack: {
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    borderRadius: 999,
    height: 4,
    overflow: 'hidden',
  },
  heroProgressFill: {
    backgroundColor: kinetixColors.lime,
    borderRadius: 999,
    height: 4,
  },
  heroStep: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1,
    gap: 6,
    minWidth: 0,
  },
  heroStepDot: {
    alignItems: 'center',
    borderColor: 'rgba(255, 255, 255, 0.22)',
    borderRadius: 999,
    borderWidth: 1.5,
    height: 22,
    justifyContent: 'center',
    width: 22,
  },
  heroStepDotActive: {
    backgroundColor: 'rgba(183, 244, 106, 0.16)',
    borderColor: kinetixColors.lime,
  },
  heroStepDotDone: {
    backgroundColor: kinetixColors.lime,
    borderColor: kinetixColors.lime,
  },
  heroStepLabel: {
    color: 'rgba(244, 250, 246, 0.45)',
    flexShrink: 1,
    fontSize: 12,
    fontWeight: '700',
  },
  heroStepLabelActive: {
    color: '#F2FBF6',
  },
  heroStepNum: {
    color: 'rgba(244, 250, 246, 0.55)',
    fontSize: 11,
    fontWeight: '900',
  },
  heroStepNumActive: {
    color: kinetixColors.lime,
  },
  heroSteps: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    position: 'relative',
    zIndex: 1,
  },
  heroSub: {
    color: '#93BAA8',
    fontSize: 13,
    lineHeight: 18,
    marginTop: 3,
  },
  heroTitle: {
    color: '#F2FBF6',
    fontSize: 23,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  heroTop: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
    position: 'relative',
    zIndex: 1,
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
  fixChip: {
    backgroundColor: kinetixColors.surface,
    borderColor: 'rgba(0, 141, 73, 0.3)',
    borderRadius: 999,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: 14,
  },
  fixChipText: {
    color: kinetixColors.amber,
    fontSize: 13,
    fontWeight: '800',
  },
  fixRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginTop: 4,
  },
  formArea: {
    flex: 1,
    gap: kinetixSpacing.md,
    minWidth: 0,
  },
  formSection: {
    backgroundColor: kinetixColors.surface,
    borderColor: 'rgba(11, 47, 37, 0.10)',
    borderRadius: 20,
    borderWidth: 1,
    elevation: 2,
    gap: kinetixSpacing.sm,
    padding: kinetixSpacing.md,
    shadowColor: '#0B2F25',
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
  },
  formSectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: kinetixSpacing.sm,
  },
  sectionIconWrap: {
    alignItems: 'center',
    backgroundColor: kinetixColors.surfaceLight,
    borderColor: 'rgba(0, 141, 73, 0.16)',
    borderRadius: 12,
    borderWidth: 1,
    height: 38,
    justifyContent: 'center',
    width: 38,
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
    gap: kinetixSpacing.md,
    minHeight: '100%',
    paddingBottom: kinetixSpacing.xxl,
    paddingHorizontal: kinetixSpacing.md,
    paddingTop: kinetixSpacing.md,
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
    backgroundColor: kinetixColors.surfaceLight,
    borderColor: 'rgba(0, 141, 73, 0.16)',
    borderRadius: 14,
    borderWidth: 1,
    height: kinetixTouchTargets.iconLarge,
    justifyContent: 'center',
    width: kinetixTouchTargets.iconLarge,
  },
  quickRow: {
    alignItems: 'center',
    backgroundColor: kinetixColors.surface,
    borderColor: 'rgba(11, 47, 37, 0.10)',
    borderRadius: 18,
    borderWidth: 1,
    elevation: 2,
    flexDirection: 'row',
    gap: kinetixSpacing.md,
    minHeight: 80,
    paddingHorizontal: kinetixSpacing.md,
    paddingVertical: kinetixSpacing.sm,
    shadowColor: '#0B2F25',
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
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
    backgroundColor: kinetixColors.lime,
    borderRadius: kinetixRadii.mapPin,
    height: 26,
    justifyContent: 'center',
    position: 'absolute',
    right: kinetixSpacing.sm,
    top: kinetixSpacing.sm,
    width: 26,
    zIndex: 1,
  },
  roleChoice: {
    alignItems: 'center',
    backgroundColor: kinetixColors.surface,
    borderColor: 'rgba(11, 47, 37, 0.10)',
    borderRadius: 20,
    borderWidth: 1,
    elevation: 2,
    flex: 1,
    gap: kinetixSpacing.sm,
    justifyContent: 'center',
    minHeight: 196,
    minWidth: 0,
    overflow: 'hidden',
    padding: kinetixSpacing.md,
    paddingTop: kinetixSpacing.xl,
    shadowColor: '#0B2F25',
    shadowOffset: { height: 10, width: 0 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
  },
  roleChoiceActive: {
    backgroundColor: '#0B7C48',
    borderColor: '#0B7C48',
    shadowColor: '#0B7C48',
    shadowOpacity: 0.3,
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
  roleChoiceSubtitleActive: {
    color: 'rgba(244, 250, 246, 0.75)',
  },
  roleChoiceTitle: {
    color: kinetixColors.textPrimary,
    fontSize: kinetixTypography.sizes.bodyLarge,
    fontWeight: '900',
    lineHeight: kinetixTypography.lineHeights.bodyLarge,
    textAlign: 'center',
  },
  roleChoiceTitleActive: {
    color: '#F4FAF6',
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
    backgroundColor: kinetixColors.surfaceLight,
    borderColor: 'rgba(0, 141, 73, 0.16)',
    borderRadius: 16,
    borderWidth: 1,
    height: 54,
    justifyContent: 'center',
    width: 54,
  },
  roleIconWrapActive: {
    backgroundColor: 'rgba(255, 255, 255, 0.16)',
    borderColor: 'rgba(255, 255, 255, 0.28)',
  },
  roleRoute: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 5,
    marginTop: 2,
  },
  roleRouteDot: {
    backgroundColor: kinetixColors.surface,
    borderColor: kinetixColors.amber,
    borderRadius: 999,
    borderWidth: 2,
    height: 9,
    width: 9,
  },
  roleRouteDotActive: {
    backgroundColor: '#0B7C48',
    borderColor: kinetixColors.lime,
  },
  roleRouteLine: {
    backgroundColor: 'rgba(0, 141, 73, 0.3)',
    borderRadius: 999,
    height: 2,
    width: 34,
  },
  roleRouteLineActive: {
    backgroundColor: 'rgba(183, 244, 106, 0.45)',
  },
  roleRoutePin: {
    backgroundColor: kinetixColors.amber,
    borderRadius: 3,
    height: 9,
    width: 9,
  },
  roleRoutePinActive: {
    backgroundColor: kinetixColors.lime,
  },
  roleSection: {
    gap: kinetixSpacing.md,
  },
  safeArea: {
    backgroundColor: kinetixColors.graphite,
    flex: 1,
  },
  quietRow: {
    flexDirection: 'row',
    gap: kinetixSpacing.sm,
  },
  secondaryButton: {
    alignItems: 'center',
    backgroundColor: kinetixColors.surface,
    borderColor: 'rgba(11, 47, 37, 0.12)',
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    justifyContent: 'center',
    minHeight: 50,
    paddingHorizontal: kinetixSpacing.md,
  },
  secondaryButtonText: {
    color: kinetixColors.textPrimary,
    fontSize: kinetixTypography.sizes.meta,
    fontWeight: '900',
  },
  summaryIcon: {
    alignItems: 'center',
    backgroundColor: kinetixColors.surfaceLight,
    borderColor: 'rgba(0, 141, 73, 0.16)',
    borderRadius: 10,
    borderWidth: 1,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  summaryLabel: {
    color: kinetixColors.textMuted,
    fontSize: kinetixTypography.sizes.meta,
    fontWeight: kinetixTypography.weights.semibold,
    width: 76,
  },
  summaryRow: {
    alignItems: 'center',
    backgroundColor: kinetixColors.surfaceLight,
    borderRadius: 12,
    flexDirection: 'row',
    gap: kinetixSpacing.sm,
    paddingHorizontal: kinetixSpacing.sm,
    paddingVertical: kinetixSpacing.xs,
  },
  summaryRows: {
    gap: kinetixSpacing.xs,
  },
  summaryValue: {
    color: kinetixColors.textPrimary,
    flex: 1,
    fontSize: kinetixTypography.sizes.meta,
    fontWeight: '800',
    minWidth: 0,
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
  stepPane: {
    gap: kinetixSpacing.sm,
  },
  submitButton: {
    alignItems: 'center',
    backgroundColor: kinetixColors.amber,
    borderRadius: 14,
    elevation: 2,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 56,
    paddingHorizontal: kinetixSpacing.md,
    shadowColor: 'rgba(0, 111, 58, 0.28)',
    shadowOffset: { height: 6, width: 0 },
    shadowOpacity: 0.28,
    shadowRadius: 12,
  },
  submitButtonMuted: {
    backgroundColor: kinetixColors.disabled,
  },
  submitText: {
    color: '#F4FAF6',
    flexShrink: 1,
    fontSize: kinetixTypography.sizes.body,
    fontWeight: '900',
    textAlign: 'center',
  },
});
