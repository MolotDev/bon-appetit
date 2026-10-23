/** Auth users are created with `{username}@{AUTH_EMAIL_DOMAIN}`. */
export const AUTH_EMAIL_DOMAIN = "bon-appetit.local";

export function usernameToEmail(username: string): string {
  const trimmed = username.trim();
  if (trimmed.includes("@")) {
    return trimmed.toLowerCase();
  }
  return `${trimmed.toLowerCase()}@${AUTH_EMAIL_DOMAIN}`;
}
