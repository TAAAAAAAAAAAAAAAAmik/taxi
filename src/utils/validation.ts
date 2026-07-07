import {
  AccountRole,
  ConsentId,
  consentItems,
  getFieldsForRole,
  isParkDriverRole,
  isSelfEmployedDriverRole,
} from '../data/registration';

export type FormValues = Record<string, string>;
export type ConsentValues = Record<ConsentId, boolean>;
// Ошибки по полям: id поля → короткое сообщение под этим полем.
export type FieldErrors = Record<string, string>;

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const phonePattern = /^\+?[0-9\s()-]{10,20}$/;
const digitsOnlyPattern = /^\d+$/;

export function createConsentState(): ConsentValues {
  return consentItems.reduce((accumulator, item) => {
    accumulator[item.id] = false;
    return accumulator;
  }, {} as ConsentValues);
}

// По-полевая валидация — база для пошаговой проверки анкеты: каждый шаг
// проверяет только свои поля и подсвечивает ошибки прямо под ними.
export function validateRegistrationFields(role: AccountRole, values: FormValues): FieldErrors {
  const errors: FieldErrors = {};
  const fields = getFieldsForRole(role);
  const setError = (id: string, message: string) => {
    if (!errors[id]) {
      errors[id] = message;
    }
  };

  fields.forEach((field) => {
    if (field.required && !values[field.id]?.trim()) {
      setError(field.id, 'Заполните это поле');
    }
  });

  if (values.email?.trim() && !emailPattern.test(values.email.trim())) {
    setError('email', 'Похоже на опечатку — проверьте формат почты');
  }

  if (values.phone?.trim() && !phonePattern.test(values.phone.trim())) {
    setError('phone', 'Проверьте номер — например, +7 900 000-00-00');
  }

  if (values.appPassword && values.appPassword.length < 8) {
    setError('appPassword', 'Минимум 8 символов');
  }

  if (isSelfEmployedDriverRole(role)) {
    const driverInn = onlyDigits(values.driverInn);

    if (driverInn && driverInn.length !== 12) {
      setError('driverInn', 'ИНН — ровно 12 цифр');
    }

    validateExperienceYear(values, setError);
    requireAffirmation(values.vehicleDocumentsReady, 'vehicleDocumentsReady', 'Напишите «да» или «готов предоставить»', setError);
    requireAffirmation(values.noLegalRestrictionsDeclaration, 'noLegalRestrictionsDeclaration', 'Напишите «да» или «подтверждаю»', setError);
  }

  if (isParkDriverRole(role)) {
    validateExperienceYear(values, setError);
    requireAffirmation(values.taxiParkDriverAgreement, 'taxiParkDriverAgreement', 'Напишите «да» или «подтверждаю»', setError);
  }

  return errors;
}

export function hasMissingConsent(consents: ConsentValues) {
  return consentItems.some((item) => !consents[item.id]);
}

// Плоский список для финального шага — собирается из по-полевых ошибок,
// чтобы формулировки совпадали с подсветкой на шагах.
export function validateRegistration(
  role: AccountRole,
  values: FormValues,
  consents: ConsentValues,
) {
  const fieldErrors = validateRegistrationFields(role, values);
  const fields = getFieldsForRole(role);
  const errors = fields
    .filter((field) => fieldErrors[field.id])
    .map((field) =>
      fieldErrors[field.id] === 'Заполните это поле'
        ? `Заполните поле "${field.label}".`
        : `${field.label}: ${fieldErrors[field.id].toLowerCase()}.`,
    );

  if (hasMissingConsent(consents)) {
    errors.push('Подтвердите обязательные согласия.');
  }

  return errors;
}

function validateExperienceYear(values: FormValues, setError: (id: string, message: string) => void) {
  const raw = values.drivingExperienceSince?.trim();

  if (!raw) {
    return;
  }

  const experienceYear = Number(raw);
  const currentYear = new Date().getFullYear();

  if (!digitsOnlyPattern.test(raw) || experienceYear < 1950 || experienceYear > currentYear) {
    setError('drivingExperienceSince', `Год числом: 1950–${currentYear}`);
  } else if (currentYear - experienceYear < 3) {
    setError('drivingExperienceSince', 'Для такси нужен стаж от 3 лет');
  }
}

function requireAffirmation(
  value: string | undefined,
  fieldId: string,
  message: string,
  setError: (id: string, message: string) => void,
) {
  if (!value?.trim()) {
    return;
  }

  if (!/(да|есть|подтверждаю|оформля|готов)/i.test(value)) {
    setError(fieldId, message);
  }
}

function onlyDigits(value: string | undefined) {
  return value?.replace(/\D/g, '') ?? '';
}
