import { AccountRole, ConsentId, consentItems, getFieldsForRole } from '../data/registration';

export type FormValues = Record<string, string>;
export type ConsentValues = Record<ConsentId, boolean>;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\+?[0-9\s()-]{10,20}$/;
const digitsOnlyPattern = /^\d+$/;

export function createConsentState(): ConsentValues {
  return consentItems.reduce((accumulator, item) => {
    accumulator[item.id] = false;
    return accumulator;
  }, {} as ConsentValues);
}

export function validateRegistration(
  role: AccountRole,
  values: FormValues,
  consents: ConsentValues,
) {
  const errors: string[] = [];
  const fields = getFieldsForRole(role);

  fields.forEach((field) => {
    if (field.required && !values[field.id]?.trim()) {
      errors.push(`Заполните поле "${field.label}".`);
    }
  });

  if (values.email && !emailPattern.test(values.email.trim())) {
    errors.push('Проверьте формат почты.');
  }

  if (values.phone && !phonePattern.test(values.phone.trim())) {
    errors.push('Проверьте формат телефона.');
  }

  if (values.appPassword && values.appPassword.length < 8) {
    errors.push('Пароль для приложения должен быть не короче 8 символов.');
  }

  if (role === 'driver') {
    validateDriverLegalFields(values, errors);
  }

  const missingConsent = consentItems.find((item) => !consents[item.id]);

  if (missingConsent) {
    errors.push('Подтвердите обязательные согласия.');
  }

  return errors;
}

function validateDriverLegalFields(values: FormValues, errors: string[]) {
  const driverInn = onlyDigits(values.driverInn);

  if (driverInn && driverInn.length !== 12) {
    errors.push('ИНН водителя должен состоять из 12 цифр.');
  }

  const experienceYear = Number(values.drivingExperienceSince);
  const currentYear = new Date().getFullYear();

  if (values.drivingExperienceSince?.trim()) {
    if (
      !digitsOnlyPattern.test(values.drivingExperienceSince.trim()) ||
      experienceYear < 1950 ||
      experienceYear > currentYear
    ) {
      errors.push('Укажите корректный год начала водительского стажа.');
    } else if (currentYear - experienceYear < 3) {
      errors.push('Для работы в легковом такси нужен водительский стаж не менее 3 лет.');
    }
  }

  requireAffirmation(
    values.vehicleDocumentsReady,
    'Подтвердите готовность предоставить документы автомобиля.',
    errors,
  );
  requireAffirmation(
    values.noLegalRestrictionsDeclaration,
    'Подтвердите отсутствие ограничений для работы в такси.',
    errors,
  );
}

function requireAffirmation(value: string | undefined, message: string, errors: string[]) {
  if (!value?.trim()) {
    return;
  }

  if (!/(да|есть|подтверждаю|оформля|готов)/i.test(value)) {
    errors.push(message);
  }
}

function onlyDigits(value: string | undefined) {
  return value?.replace(/\D/g, '') ?? '';
}
