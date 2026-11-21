import { isTestAccountClaims } from 'deepspace/worker'

// True when the caller is a DeepSpace test account (the accounts browser tests
// sign in with). Reads the `isTestAccount` claim from the caller's token.
// The action route has already verified this token, so decoding is enough.
export function isTestAccountCaller(callerJwt: string): boolean {
  try {
    const payload = callerJwt.split('.')[1] ?? ''
    const json = atob(payload.replace(/-/g, '+').replace(/_/g, '/'))
    return isTestAccountClaims(JSON.parse(json))
  } catch {
    return false
  }
}
