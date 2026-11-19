import { it, expect } from 'vitest'
import { readConfig } from './config'

it('reads a valid environment with sensible defaults', () => {
  expect(readConfig({ APP_PIN: '2468' })).toMatchObject({
    pin: '2468',
    port: 8787,
    cookieSecure: true,
    trustProxy: false,
    e2eReset: false,
  })
  expect(readConfig({ APP_PIN: '0001', PORT: '9000', COOKIE_SECURE: '0', TRUST_PROXY: '1' })).toMatchObject({
    port: 9000,
    cookieSecure: false,
    trustProxy: true,
  })
})

it('refuses to start without a 4-digit APP_PIN', () => {
  for (const pin of [undefined, '', '123', '12345', 'abcd', ' 1234'])
    expect(() => readConfig({ APP_PIN: pin })).toThrow('APP_PIN doit contenir exactement 4 chiffres')
})

it('refuses E2E_RESET in production', () => {
  expect(() => readConfig({ APP_PIN: '2468', E2E_RESET: '1', NODE_ENV: 'production' })).toThrow('E2E_RESET')
})

it('API_TOKEN shorter than 32 characters refuses to start', () => {
  expect(() => readConfig({ APP_PIN: '2468', API_TOKEN: 'short-token' })).toThrow(
    'API_TOKEN doit contenir au moins 32 caractères (ex. : openssl rand -hex 32).',
  )
  expect(readConfig({ APP_PIN: '2468', API_TOKEN: 'test-token-0123456789abcdef0123456789' }).apiToken).toBe(
    'test-token-0123456789abcdef0123456789',
  )
})

it('no API_TOKEN gives apiToken null', () => {
  expect(readConfig({ APP_PIN: '2468' }).apiToken).toBeNull()
  expect(readConfig({ APP_PIN: '2468', API_TOKEN: '' }).apiToken).toBeNull()
})
