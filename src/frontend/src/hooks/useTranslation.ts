import { useCallback, useEffect, useState } from "react";
import enTranslations from "../i18n/en.json";
import esTranslations from "../i18n/es.json";
import frTranslations from "../i18n/fr.json";
import ruTranslations from "../i18n/ru.json";

export type TranslationDict = Record<string, Record<string, string>>;

const STORAGE_KEY_LANG = "agenda_language";
const STORAGE_KEY_CUSTOM = "agenda_custom_languages";

// Built-in languages
const BUILT_IN_LANGUAGES: Record<
  string,
  { name: string; flag: string; dict: TranslationDict }
> = {
  fr: {
    name: "Français",
    flag: "🇫🇷",
    dict: frTranslations as unknown as TranslationDict,
  },
  en: {
    name: "English",
    flag: "🇬🇧",
    dict: enTranslations as unknown as TranslationDict,
  },
  es: {
    name: "Español",
    flag: "🇪🇸",
    dict: esTranslations as unknown as TranslationDict,
  },
  ru: {
    name: "Русский",
    flag: "🇷🇺",
    dict: ruTranslations as unknown as TranslationDict,
  },
};

export interface LangEntry {
  code: string;
  name: string;
  flag: string;
  builtIn: boolean;
  dict: TranslationDict;
}

function loadCustomLanguages(): Record<
  string,
  { name: string; flag: string; dict: TranslationDict }
> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CUSTOM);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export function saveCustomLanguage(
  code: string,
  name: string,
  flag: string,
  dict: TranslationDict,
): void {
  const customs = loadCustomLanguages();
  customs[code.toLowerCase()] = { name, flag, dict };
  localStorage.setItem(STORAGE_KEY_CUSTOM, JSON.stringify(customs));
  window.dispatchEvent(new CustomEvent("agenda_lang_change"));
}

export function deleteCustomLanguage(code: string): void {
  const customs = loadCustomLanguages();
  delete customs[code.toLowerCase()];
  localStorage.setItem(STORAGE_KEY_CUSTOM, JSON.stringify(customs));
  // If active language was deleted, fall back to fr
  if (localStorage.getItem(STORAGE_KEY_LANG) === code.toLowerCase()) {
    localStorage.setItem(STORAGE_KEY_LANG, "fr");
  }
  window.dispatchEvent(new CustomEvent("agenda_lang_change"));
}

export function getAllLanguages(): LangEntry[] {
  const customs = loadCustomLanguages();
  const result: LangEntry[] = [];
  for (const [code, data] of Object.entries(BUILT_IN_LANGUAGES)) {
    result.push({
      code,
      name: data.name,
      flag: data.flag,
      builtIn: true,
      dict: data.dict,
    });
  }
  for (const [code, data] of Object.entries(customs)) {
    // Custom can override built-in only if not in built-in list
    if (!BUILT_IN_LANGUAGES[code]) {
      result.push({
        code,
        name: data.name,
        flag: data.flag,
        builtIn: false,
        dict: data.dict,
      });
    } else {
      // Replace built-in with custom override
      const idx = result.findIndex((l) => l.code === code);
      if (idx >= 0)
        result[idx] = {
          code,
          name: data.name,
          flag: data.flag,
          builtIn: false,
          dict: data.dict,
        };
    }
  }
  return result;
}

export function getActiveLanguageCode(): string {
  return localStorage.getItem(STORAGE_KEY_LANG) ?? "fr";
}

export function setActiveLanguage(code: string): void {
  localStorage.setItem(STORAGE_KEY_LANG, code);
  window.dispatchEvent(new CustomEvent("agenda_lang_change"));
}

function getDictForCode(code: string): TranslationDict {
  // Check custom first (allows overriding built-ins)
  const customs = loadCustomLanguages();
  if (customs[code]) return customs[code].dict;
  if (BUILT_IN_LANGUAGES[code])
    return BUILT_IN_LANGUAGES[code].dict as TranslationDict;
  return BUILT_IN_LANGUAGES.fr.dict as TranslationDict;
}

const frDict = BUILT_IN_LANGUAGES.fr.dict as TranslationDict;

/**
 * Returns t("section.key") function that translates using active language,
 * falling back to French if key is missing.
 */
export function useTranslation() {
  const [langCode, setLangCode] = useState<string>(() =>
    getActiveLanguageCode(),
  );

  useEffect(() => {
    const handler = () => setLangCode(getActiveLanguageCode());
    window.addEventListener("agenda_lang_change", handler);
    window.addEventListener("storage", handler);
    return () => {
      window.removeEventListener("agenda_lang_change", handler);
      window.removeEventListener("storage", handler);
    };
  }, []);

  const t = useCallback(
    (key: string): string => {
      const [section, ...rest] = key.split(".");
      const subKey = rest.join(".");
      const dict = getDictForCode(langCode);
      const sectionDict = dict[section];
      if (sectionDict && subKey in sectionDict) return sectionDict[subKey];
      // Fallback to French
      const frSection = frDict[section];
      if (frSection && subKey in frSection) return frSection[subKey];
      return key;
    },
    [langCode],
  );

  return { t, langCode, setLang: setActiveLanguage };
}
