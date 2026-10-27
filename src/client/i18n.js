/** Current-locale translator shared by client modules. */

/** @type {(key: string, values?: Record<string, unknown>) => string} */
let current = (key) => key;

/** Replace the translator used by non-component modules. */
export function setTranslator(translate) {
  current = translate;
}

/** Translate a key with the current locale. */
export function translate(key, values) {
  return current(key, values);
}
