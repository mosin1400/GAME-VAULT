function normalizePasswordDigits(value) {
  return String(value || '')
    .replace(/[۰-۹]/g, digit => String(digit.charCodeAt(0) - 0x06F0));
}

module.exports = { normalizePasswordDigits };
