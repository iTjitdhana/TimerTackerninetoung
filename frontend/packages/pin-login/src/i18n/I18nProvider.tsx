import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  getStoredLang,
  storeLang,
  translate,
} from "./translations";
import type { AlertState, I18nContextValue, Lang } from "../types";

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>("th");

  useEffect(() => {
    setLangState(getStoredLang());
  }, []);

  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    storeLang(next);
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>) =>
      translate(lang, key, vars),
    [lang]
  );

  useEffect(() => {
    document.documentElement.lang = lang;
    document.body.dataset.lang = lang;
  }, [lang]);

  const value = useMemo(() => ({ lang, setLang, t }), [lang, setLang, t]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext);
  if (!ctx) throw new Error("useI18n must be used within I18nProvider");
  return ctx;
}

/** Re-translate alert when language changes */
export function useLocalizedAlert(alert: AlertState | null): AlertState | null {
  const { lang, t } = useI18n();
  return useMemo(() => {
    if (!alert?.i18nKey) return alert;
    return {
      ...alert,
      message: t(alert.i18nKey, alert.i18nVars),
    };
  }, [alert, lang, t]);
}
