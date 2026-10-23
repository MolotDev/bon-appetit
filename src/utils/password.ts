const PASSWORD_ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";

export function generateTempPassword(length = 10): string {
  const bytes = new Uint8Array(length);
  crypto.getRandomValues(bytes);
  let result = "";
  for (const byte of bytes) {
    result += PASSWORD_ALPHABET.charAt(byte % PASSWORD_ALPHABET.length);
  }
  return result;
}
