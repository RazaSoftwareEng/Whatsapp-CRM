const UAE_PK_PHONE_REGEX = /^(\+971\d{9}|\+92\d{10})$/;

export function isValidUaePkPhone(value: string): boolean {
  return value.trim() === "" || UAE_PK_PHONE_REGEX.test(value.trim());
}

export const PHONE_HELP_TEXT = "UAE (+971XXXXXXXXX) or Pakistan (+92XXXXXXXXXX) only";
