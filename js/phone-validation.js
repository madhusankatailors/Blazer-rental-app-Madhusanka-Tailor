export function isValidPhoneNumber(value, { required = true } = {}) {
  const phone = String(value || '').trim();
  if (!phone) return !required;
  return /^[0-9\s()+-]+$/.test(phone) && phone.replace(/\D/g, '').length === 10;
}

export function updatePhoneFieldState(input, messageElement, messages, { required = false } = {}) {
  const value = input.value.trim();
  const digits = value.replace(/\D/g, '');
  const valid = isValidPhoneNumber(value, { required });
  const hasValue = Boolean(value);

  input.classList.toggle('phone-field-invalid', hasValue && !valid);
  input.classList.toggle('phone-field-valid', hasValue && valid);
  input.setAttribute('aria-invalid', String(hasValue && !valid));

  if (!messageElement) return valid;
  messageElement.textContent = !hasValue
    ? ''
    : valid
      ? messages.valid
      : digits.length < 10
        ? messages.progress(digits.length)
        : messages.invalid;
  messageElement.classList.toggle('is-visible', hasValue && !valid);
  messageElement.classList.toggle('is-valid', hasValue && valid);
  return valid;
}