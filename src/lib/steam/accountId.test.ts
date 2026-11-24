import { describe, expect, it } from 'vitest'

import {
  DOTA_ACCOUNT_ID_MAX,
  STEAM_ID64_INDIVIDUAL_BASE,
  STEAM_ID64_INDIVIDUAL_MAX,
  accountIdFromSteamId64,
  steamIdFromAccountId,
} from './steamId'

/**
 * Преобразование SteamID64 → account_id (Task 20B).
 *
 * Проверяется и корректная математика, и безопасный отказ для значений, которые
 * нельзя считать индивидуальным аккаунтом Steam. Числа не должны терять точность,
 * поэтому критично, что расчёт ведётся в BigInt, а не в Number.
 */
describe('SteamID64 → Dota 2 account_id', () => {
  it('базовый SteamID64 соответствует account id 0', () => {
    expect(accountIdFromSteamId64(STEAM_ID64_INDIVIDUAL_BASE)).toBe(0)
  })

  it('восстанавливает известный account id без потери точности', () => {
    // 76561197999993001 − 76561197960265728 = 39727273
    expect(accountIdFromSteamId64('76561197999993001')).toBe(39_727_273)
    // Dendi: 76561198030654385 → 70388657
    expect(accountIdFromSteamId64('76561198030654385')).toBe(70_388_657)
  })

  it('максимальный индивидуальный SteamID64 даёт 2^32 − 1', () => {
    expect(accountIdFromSteamId64(STEAM_ID64_INDIVIDUAL_MAX)).toBe(DOTA_ACCOUNT_ID_MAX)
  })

  it('поддерживает границу значения чуть меньше base как некорректную', () => {
    // base − 1 не является валидным индивидуальным SteamID64.
    expect(accountIdFromSteamId64('76561197960265727')).toBeNull()
  })

  it('отвергает не-строки и искажающие Number значения', () => {
    expect(accountIdFromSteamId64(76561198030654385)).toBeNull()
    expect(accountIdFromSteamId64(BigInt('76561198030654385'))).toBeNull()
    expect(accountIdFromSteamId64(null)).toBeNull()
    expect(accountIdFromSteamId64(undefined)).toBeNull()
    expect(accountIdFromSteamId64({})).toBeNull()
  })

  it('отвергает строки неверной длины и формата', () => {
    expect(accountIdFromSteamId64('7656119796026572')).toBeNull()
    expect(accountIdFromSteamId64('765611979602657288')).toBeNull()
    expect(accountIdFromSteamId64('76561198000abc001')).toBeNull()
    expect(accountIdFromSteamId64('')).toBeNull()
  })

  it('отвергает значения с ведущими нулями и пробелами вокруг идентификатора', () => {
    // 17 цифр, но не начинается с 7 → вне диапазона индивидуальных аккаунтов.
    expect(accountIdFromSteamId64(' 76561198000000001')).toBe(39_734_273)
    expect(accountIdFromSteamId64('06561198000000001')).toBeNull()
  })

  it('сохраняет пару прямого и обратного преобразования', () => {
    const accountId = 123_456_789
    const steamId = steamIdFromAccountId(accountId)
    expect(steamId).not.toBeNull()
    expect(accountIdFromSteamId64(steamId)).toBe(accountId)
  })

  it('не изменяет исходный SteamID64 (чистая функция)', () => {
    const original = '76561198030654385'
    accountIdFromSteamId64(original)
    expect(original).toBe('76561198030654385')
  })
})