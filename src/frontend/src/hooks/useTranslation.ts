import { useCallback, useEffect, useState } from "react";
import enJson from "../i18n/en.json";
import esJson from "../i18n/es.json";
import frJson from "../i18n/fr.json";
import ruJson from "../i18n/ru.json";

const LANG_KEY = "revenueplanner_lang";
const CUSTOM_LANGS_KEY = "revenueplanner_custom_langs";

type TranslationLeaf = string | string[];
type TranslationValue = TranslationLeaf | { [key: string]: TranslationValue };
type TranslationDict = Record<string, TranslationValue>;

const BUILT_IN: Record<string, TranslationDict> = {
  fr: frJson as TranslationDict,
  en: enJson as TranslationDict,
  es: esJson as TranslationDict,
  ru: ruJson as TranslationDict,
};

function getCustomLangs(): Record<string, TranslationDict> {
  try {
    const raw = localStorage.getItem(CUSTOM_LANGS_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function getAllLangs(): Record<string, TranslationDict> {
  return { ...BUILT_IN, ...getCustomLangs() };
}

function resolvePath(
  obj: TranslationDict,
  path: string,
): TranslationValue | undefined {
  const parts = path.split(".");
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let cur: any = obj;
  for (const p of parts) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = cur[p];
  }
  return cur;
}

function t(
  dict: TranslationDict,
  fallback: TranslationDict,
  key: string,
): string {
  const val = resolvePath(dict, key);
  if (val !== undefined && typeof val === "string") return val;
  const fb = resolvePath(fallback, key);
  if (fb !== undefined && typeof fb === "string") return fb;
  return key;
}

function tArr(
  dict: TranslationDict,
  fallback: TranslationDict,
  key: string,
): string[] {
  const val = resolvePath(dict, key);
  if (Array.isArray(val)) return val as string[];
  const fb = resolvePath(fallback, key);
  if (Array.isArray(fb)) return fb as string[];
  return [];
}

const LANG_CHANGE_EVENT = "revenueplanner_lang_change";

export function setAppLanguage(code: string) {
  localStorage.setItem(LANG_KEY, code);
  window.dispatchEvent(new CustomEvent(LANG_CHANGE_EVENT, { detail: code }));
}

export function getAppLanguage(): string {
  return localStorage.getItem(LANG_KEY) ?? "fr";
}

export function addCustomLanguage(
  code: string,
  name: string,
  flag: string,
  dict: TranslationDict,
) {
  const existing = getCustomLangs();
  existing[code] = dict;
  localStorage.setItem(CUSTOM_LANGS_KEY, JSON.stringify(existing));
  const metaKey = "revenueplanner_lang_meta";
  const meta = JSON.parse(localStorage.getItem(metaKey) ?? "{}");
  meta[code] = { name, flag };
  localStorage.setItem(metaKey, JSON.stringify(meta));
}

export function getLanguageMeta(): Record<
  string,
  { name: string; flag: string }
> {
  const base: Record<string, { name: string; flag: string }> = {
    fr: { name: "Français", flag: "🇫🇷" },
    en: { name: "English", flag: "🇬🇧" },
    es: { name: "Español", flag: "🇪🇸" },
    ru: { name: "Русский", flag: "🇷🇺" },
  };
  try {
    const meta = JSON.parse(
      localStorage.getItem("revenueplanner_lang_meta") ?? "{}",
    );
    return { ...base, ...meta };
  } catch {
    return base;
  }
}

export function removeCustomLanguage(code: string) {
  const existing = getCustomLangs();
  delete existing[code];
  localStorage.setItem(CUSTOM_LANGS_KEY, JSON.stringify(existing));
  const metaKey = "revenueplanner_lang_meta";
  const meta = JSON.parse(localStorage.getItem(metaKey) ?? "{}");
  delete meta[code];
  localStorage.setItem(metaKey, JSON.stringify(meta));
}

export function useTranslation() {
  const [lang, setLang] = useState<string>(getAppLanguage);

  useEffect(() => {
    const handler = (e: Event) => {
      setLang((e as CustomEvent<string>).detail);
    };
    window.addEventListener(LANG_CHANGE_EVENT, handler);
    return () => window.removeEventListener(LANG_CHANGE_EVENT, handler);
  }, []);

  const translate = useCallback(
    (key: string): string => {
      const allLangs = getAllLangs();
      const fr = BUILT_IN.fr;
      const dict = allLangs[lang] ?? fr;
      return t(dict, fr, key);
    },
    [lang],
  );

  const translateArr = useCallback(
    (key: string): string[] => {
      const allLangs = getAllLangs();
      const fr = BUILT_IN.fr;
      const dict = allLangs[lang] ?? fr;
      return tArr(dict, fr, key);
    },
    [lang],
  );

  return { t: translate, tArr: translateArr, lang };
}

export function getBuiltInLangData(code: string): TranslationDict | null {
  return BUILT_IN[code] ?? null;
}

export function getCurrentLangData(): TranslationDict {
  const lang = getAppLanguage();
  const allLangs = getAllLangs();
  return allLangs[lang] ?? BUILT_IN.fr;
}
