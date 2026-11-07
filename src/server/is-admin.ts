// Admin rights follow the email address, so the address must be one the sign-in method verified.
export function isAdmin(user: { email: string; emailVerified: boolean }, adminEmails: string[]): boolean {
  return user.emailVerified && adminEmails.includes(user.email.toLowerCase());
}
