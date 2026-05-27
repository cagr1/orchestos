// Existing auth module — used by the test task as context
export function validateToken(token: string): boolean {
  return token.startsWith('Bearer ')
}
