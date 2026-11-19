import { it, expect } from 'vitest'
import { readConfig } from './config'

it('reads a valid environment with sensible defaults', () => {
  expect(readConfig({ APP_PIN: '2468' })).toMatchObject({ pin: '2468', port: 8787, cookieSecure: true, trustProxy: false, e2eReset: false })
  expect(readConfig({ APP_PIN: '0001', PORT: '9000', COOKIE_SECURE: '0', TRUST_PROXY: '1' })).toMatchObject({ port: 9000, cookieSecure: false, trustProxy: true })
})

it('refuses to start without a 4-digit APP_PIN', () => {
  for (const pin of [undefined, '', '123', '12345', 'abcd', ' 1234'])
    expect(() => readConfig({ APP_PIN: pin })).toThrow('APP_PIN doit contenir exactement 4 chiffres')
})

it('refuses E2E_RESET in production', () => {
  expect(() => readConfig({ APP_PIN: '2468', E2E_RESET: '1', NODE_ENV: 'production' })).toThrow('E2E_RESET')
})
