import abilityDescriptionsRu from './ability-locale/ability-descriptions.json'
import abilityNamesRu from './ability-locale/ability-names.json'
import facetDescriptionsRu from './ability-locale/facet-descriptions.json'
import facetTitlesRu from './ability-locale/facet-titles.json'
import propertyLabelsRu from './ability-locale/property-labels.json'
import talentNamesRu from './ability-locale/talent-names.json'
import typeLabelsRu from './ability-locale/type-labels.json'
import type { Locale } from './translations'

/**
 * Р СѓСЃСЃРєР°СЏ Р»РѕРєР°Р»РёР·Р°С†РёСЏ СЃРїРѕСЃРѕР±РЅРѕСЃС‚РµР№, С‚Р°Р»Р°РЅС‚РѕРІ Рё С„Р°СЃРµС‚РѕРІ (Task 19).
 *
 * ## Р—Р°С‡РµРј РѕС‚РґРµР»СЊРЅС‹Р№ СЃР»РѕР№
 *
 * РСЃС…РѕРґРЅС‹Рµ РјРµС‚Р°РґР°РЅРЅС‹Рµ РїСЂРёС…РѕРґСЏС‚ РѕС‚ OpenDota РЅР° Р°РЅРіР»РёР№СЃРєРѕРј Рё СЃРѕРґРµСЂР¶Р°С‚ Рё РјРµС…Р°РЅРёРєСѓ
 * (С‡РёСЃР»Р°, `attrib`), Рё РѕС‚РѕР±СЂР°Р¶Р°РµРјС‹Р№ С‚РµРєСЃС‚. Р§РёСЃР»Р° Рё РјРµС…Р°РЅРёРєР° РїРµСЂРµРІРѕРґРёС‚СЊ РЅРµР»СЊР·СЏ,
 * РїРѕСЌС‚РѕРјСѓ РёСЃС…РѕРґРЅС‹Р№ РѕР±СЉРµРєС‚ `HeroAbility` РѕСЃС‚Р°С‘С‚СЃСЏ РЅРµРёР·РјРµРЅРЅС‹Рј, Р° Р»РѕРєР°Р»РёР·Р°С†РёСЏ
 * РїСЂРёРјРµРЅСЏРµС‚СЃСЏ С‚РѕР»СЊРєРѕ РЅР° РѕС‚РѕР±СЂР°Р¶РµРЅРёРё вЂ” РїРѕ СЃС‚Р°Р±РёР»СЊРЅРѕРјСѓ РёРґРµРЅС‚РёС„РёРєР°С‚РѕСЂСѓ.
 *
 * ## РџСЂРёРЅС†РёРїС‹
 *
 * - РєР»СЋС‡ СЃР»РѕРІР°СЂСЏ вЂ” СЃС‚Р°Р±РёР»СЊРЅС‹Р№ РёРґРµРЅС‚РёС„РёРєР°С‚РѕСЂ (`ancient_apparition_cold_feet`,
 *   `special_bonus_hp_200`, РёРјСЏ С„Р°СЃРµС‚Р°, С‚РѕС‡РЅС‹Р№ `attrib[].header`), Р° РЅРµ РѕС‚РѕР±СЂР°Р¶Р°РµРјРѕРµ РёРјСЏ;
 * - Р°РЅРіР»РёР№СЃРєРёР№ РёСЃС‚РѕС‡РЅРёРє РЅРµ РґСѓР±Р»РёСЂСѓРµС‚СЃСЏ РІ СЃР»РѕРІР°СЂСЏС…: СЃР»РѕРІР°СЂРё СЃРѕРґРµСЂР¶Р°С‚ С‚РѕР»СЊРєРѕ СЂСѓСЃСЃРєРёР№
 *   С‚РµРєСЃС‚, РїРѕСЌС‚РѕРјСѓ В«РґРІСѓС… РєРѕРїРёР№ Р°РЅРіР»РёР№СЃРєРѕРіРѕВ» РЅРµ РІРѕР·РЅРёРєР°РµС‚;
 * - РїРµСЂРµРІРѕРґ РЅРµ РІС‹РїРѕР»РЅСЏРµС‚СЃСЏ РІ Р±СЂР°СѓР·РµСЂРµ РґРёРЅР°РјРёС‡РµСЃРєРё: СЃР»РѕРІР°СЂРё СЃС‚Р°С‚РёС‡РµСЃРєРёРµ Рё СЃРѕР±РёСЂР°СЋС‚СЃСЏ
 *   РІРјРµСЃС‚Рµ СЃ Р±Р°РЅРґР»РѕРј;
 * - РµСЃР»Рё РїРµСЂРµРІРѕРґР° РЅРµС‚ вЂ” РІРѕР·РІСЂР°С‰Р°РµС‚СЃСЏ РёСЃС…РѕРґРЅР°СЏ Р°РЅРіР»РёР№СЃРєР°СЏ СЃС‚СЂРѕРєР°, Р° РЅРµ РІС‹РґСѓРјР°РЅРЅС‹Р№ С‚РµРєСЃС‚;
 * - РµСЃР»Рё РѕРїРёСЃР°РЅРёСЏ РЅРµС‚ РІ СЃР°РјРѕРј РёСЃС‚РѕС‡РЅРёРєРµ, СЌС‚Рѕ РѕС‚РґРµР»СЊРЅРѕРµ СЃРѕСЃС‚РѕСЏРЅРёРµ (`source === null`),
 *   Рё РёРЅС‚РµСЂС„РµР№СЃ РїРѕРєР°Р·С‹РІР°РµС‚ Р»РѕРєР°Р»РёР·РѕРІР°РЅРЅСѓСЋ РїРѕРґРїРёСЃСЊ В«РЅРµРґРѕСЃС‚СѓРїРЅРѕ РІ РёСЃС‚РѕС‡РЅРёРєРµВ».
 *
 * ## РСЃС‚РѕС‡РЅРёРє Рё Р»РёС†РµРЅР·РёРё
 *
 * РЎР»РѕРІР°СЂРё СЃРѕСЃС‚Р°РІР»РµРЅС‹ РєР°Рє С‚РµСЂРјРёРЅРѕР»РѕРіРёС‡РµСЃРєРёР№ РїРµСЂРµРІРѕРґ СѓР¶Рµ РёРјРµСЋС‰РёС…СЃСЏ Р°РЅРіР»РёР№СЃРєРёС…
 * РјРµС‚Р°РґР°РЅРЅС‹С… (РїСѓРЅРєС‚ 3 РїСЂРёРѕСЂРёС‚РµС‚Р° РёР· С‚СЂРµР±РѕРІР°РЅРёР№ РІР»Р°РґРµР»СЊС†Р°). Р’РЅРµС€РЅРёРµ Р»РѕРєР°Р»РёР·Р°С†РёРѕРЅРЅС‹Рµ
 * РґР°С‚Р°СЃРµС‚С‹ РЅРµ РєРѕРїРёСЂРѕРІР°Р»РёСЃСЊ: РїРѕРґС…РѕРґСЏС‰РµРіРѕ РѕС„РёС†РёР°Р»СЊРЅРѕРіРѕ РЅР°Р±РѕСЂР° СЃ РїРѕРґС‚РІРµСЂР¶РґС‘РЅРЅС‹РјРё
 * РїСЂР°РІР°РјРё РЅР° РїРµСЂРµСЂР°СЃРїСЂРѕСЃС‚СЂР°РЅРµРЅРёРµ РІ РїСЂРѕРµРєС‚Рµ РЅРµС‚, Р° РІС‹РґСѓРјС‹РІР°С‚СЊ РјРµС…Р°РЅРёРєРё Р·Р°РїСЂРµС‰РµРЅРѕ.
 */

type Dictionary = Readonly<Record<string, string>>

/** РЎР»СѓР¶РµР±РЅС‹Р№ РєР»СЋС‡ РјРµС‚Р°РґР°РЅРЅС‹С… СЃР»РѕРІР°СЂСЏ вЂ” РЅРµ СЏРІР»СЏРµС‚СЃСЏ РїРµСЂРµРІРѕРґРѕРј. */
export const DICTIONARY_META_KEY = '_meta'

function lookup(dictionary: Dictionary, key: string): string | null {
  if (key.length === 0) {
    return null
  }
  const value = dictionary[key]
  return typeof value === 'string' && value.length > 0 ? value : null
}

/** Р СѓСЃСЃРєРёРµ РЅР°Р·РІР°РЅРёСЏ СЃРїРѕСЃРѕР±РЅРѕСЃС‚РµР№ (С‚РѕР»СЊРєРѕ RU). */
export const ABILITY_NAMES_RU: Dictionary = abilityNamesRu as unknown as Dictionary
/** Р СѓСЃСЃРєРёРµ РѕРїРёСЃР°РЅРёСЏ СЃРїРѕСЃРѕР±РЅРѕСЃС‚РµР№ (С‚РѕР»СЊРєРѕ RU). */
export const ABILITY_DESCRIPTIONS_RU: Dictionary = abilityDescriptionsRu as unknown as Dictionary
/** Р СѓСЃСЃРєРёРµ РЅР°Р·РІР°РЅРёСЏ С‚Р°Р»Р°РЅС‚РѕРІ (С‚РѕР»СЊРєРѕ RU). */
export const TALENT_NAMES_RU: Dictionary = talentNamesRu as unknown as Dictionary
/** Р СѓСЃСЃРєРёРµ РЅР°Р·РІР°РЅРёСЏ Р°РєС‚РёРІРЅС‹С… С„Р°СЃРµС‚РѕРІ (С‚РѕР»СЊРєРѕ RU). */
export const FACET_TITLES_RU: Dictionary = facetTitlesRu as unknown as Dictionary
/** Р СѓСЃСЃРєРёРµ РѕРїРёСЃР°РЅРёСЏ Р°РєС‚РёРІРЅС‹С… С„Р°СЃРµС‚РѕРІ (С‚РѕР»СЊРєРѕ RU). */
export const FACET_DESCRIPTIONS_RU: Dictionary = facetDescriptionsRu as unknown as Dictionary
/** Р СѓСЃСЃРєРёРµ РїРѕРґРїРёСЃРё СЃРІРѕР№СЃС‚РІ СЃРїРѕСЃРѕР±РЅРѕСЃС‚РµР№ (С‚РѕР»СЊРєРѕ RU). */
export const PROPERTY_LABELS_RU: Dictionary = propertyLabelsRu as unknown as Dictionary

/** РќР°Р·РІР°РЅРёРµ СЃРїРѕСЃРѕР±РЅРѕСЃС‚Рё: RU-СЃР»РѕРІР°СЂСЊ, РёРЅР°С‡Рµ Р°РЅРіР»РёР№СЃРєРёР№ РёСЃС‚РѕС‡РЅРёРє. */
export function localizedAbilityName(locale: Locale, abilityKey: string, source: string): string {
  if (locale !== 'ru') {
    return source
  }
  return lookup(ABILITY_NAMES_RU, abilityKey) ?? source
}

/**
 * РћРїРёСЃР°РЅРёРµ СЃРїРѕСЃРѕР±РЅРѕСЃС‚Рё. `source === null` РѕР·РЅР°С‡Р°РµС‚, С‡С‚Рѕ РѕРїРёСЃР°РЅРёСЏ РЅРµС‚ РІ РёСЃС‚РѕС‡РЅРёРєРµ вЂ”
 * СЌС‚Рѕ РЅРµ В«РЅРµРїРµСЂРµРІРµРґС‘РЅРЅР°СЏ СЃС‚СЂРѕРєР°В», Рё РїРѕРґРјРµРЅСЏС‚СЊ РµРіРѕ С‚РµРєСЃС‚РѕРј РЅРµР»СЊР·СЏ.
 */
export function localizedAbilityDescription(
  locale: Locale,
  abilityKey: string,
  source: string | null,
): string | null {
  if (source === null) {
    return null
  }
  if (locale !== 'ru') {
    return source
  }
  return lookup(ABILITY_DESCRIPTIONS_RU, abilityKey) ?? source
}

/** РќР°Р·РІР°РЅРёРµ С‚Р°Р»Р°РЅС‚Р°: RU-СЃР»РѕРІР°СЂСЊ, РёРЅР°С‡Рµ Р°РЅРіР»РёР№СЃРєРѕРµ РЅР°Р·РІР°РЅРёРµ РёСЃС‚РѕС‡РЅРёРєР°. */
export function localizedTalentName(
  locale: Locale,
  talentKey: string,
  source: string | null,
): string | null {
  if (source === null) {
    return null
  }
  if (locale !== 'ru') {
    return source
  }
  return lookup(TALENT_NAMES_RU, talentKey) ?? source
}

/** РќР°Р·РІР°РЅРёРµ Р°РєС‚РёРІРЅРѕРіРѕ С„Р°СЃРµС‚Р°. */
export function localizedFacetTitle(locale: Locale, facetKey: string, source: string): string {
  if (locale !== 'ru') {
    return source
  }
  return lookup(FACET_TITLES_RU, facetKey) ?? source
}

/** РћРїРёСЃР°РЅРёРµ С„Р°СЃРµС‚Р°; `null` РІ РёСЃС‚РѕС‡РЅРёРєРµ вЂ” РѕС‚РґРµР»СЊРЅРѕРµ СЃРѕСЃС‚РѕСЏРЅРёРµ. */
export function localizedFacetDescription(
  locale: Locale,
  facetKey: string,
  source: string | null,
): string | null {
  if (source === null) {
    return null
  }
  if (locale !== 'ru') {
    return source
  }
  return lookup(FACET_DESCRIPTIONS_RU, facetKey) ?? source
}

/** РџРѕРґРїРёСЃСЊ СЃРІРѕР№СЃС‚РІР° СЃРїРѕСЃРѕР±РЅРѕСЃС‚Рё (РЅР°РїСЂРёРјРµСЂ, `DAMAGE PER SECOND:`). */
export function localizedPropertyLabel(locale: Locale, header: string): string {
  if (locale !== 'ru') {
    return header
  }
  return lookup(PROPERTY_LABELS_RU, header) ?? header
}

/**
 * РџРѕРґРїРёСЃСЊ Р·РЅР°С‡РµРЅРёСЏ С‚РёРїР°. РџСЂРѕРІР°Р№РґРµСЂ РёРЅРѕРіРґР° РѕС‚РґР°С‘С‚ РЅРµСЃРєРѕР»СЊРєРѕ Р·РЅР°С‡РµРЅРёР№ СЃС‚СЂРѕРєРѕР№,
 * СЂР°Р·РґРµР»С‘РЅРЅРѕР№ `, ` вЂ” РєР°Р¶РґРѕРµ РїРµСЂРµРІРѕРґРёС‚СЃСЏ РѕС‚РґРµР»СЊРЅРѕ, РїРѕСЂСЏРґРѕРє СЃРѕС…СЂР°РЅСЏРµС‚СЃСЏ.
 */
export function localizedTypeLabel(locale: Locale, value: string): string {
  if (locale !== 'ru') {
    return value
  }
  return value
    .split(', ')
    .map((part) => lookup(TYPE_LABELS_RU, part) ?? part)
    .join(', ')
}

/** Р•СЃС‚СЊ Р»Рё СЂСѓСЃСЃРєРёР№ РїРµСЂРµРІРѕРґ РЅР°Р·РІР°РЅРёСЏ СЃРїРѕСЃРѕР±РЅРѕСЃС‚Рё (РґР»СЏ Р°СѓРґРёС‚Р° Рё С‚РµСЃС‚РѕРІ). */
export function hasAbilityNameRu(abilityKey: string): boolean {
  return lookup(ABILITY_NAMES_RU, abilityKey) !== null
}

/** Р•СЃС‚СЊ Р»Рё СЂСѓСЃСЃРєРёР№ РїРµСЂРµРІРѕРґ РѕРїРёСЃР°РЅРёСЏ СЃРїРѕСЃРѕР±РЅРѕСЃС‚Рё (РґР»СЏ Р°СѓРґРёС‚Р° Рё С‚РµСЃС‚РѕРІ). */
export function hasAbilityDescriptionRu(abilityKey: string): boolean {
  return lookup(ABILITY_DESCRIPTIONS_RU, abilityKey) !== null
}

/** Р СѓСЃСЃРєРёРµ РїРѕРґРїРёСЃРё С‚РёРїРѕРІ: behavior / dmg_type / target_type / dispellable / bkbpierce. */
export const TYPE_LABELS_RU: Dictionary = typeLabelsRu as unknown as Dictionary

