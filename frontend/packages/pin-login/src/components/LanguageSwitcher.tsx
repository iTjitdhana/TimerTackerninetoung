import { useEffect, useRef, useState } from "react";
import { LANG_LABELS } from "../i18n/translations";
import { useI18n } from "../i18n/I18nProvider";
import type { Lang } from "../types";

const LANG_OPTIONS: { code: Lang; label: string }[] = [
  { code: "th", label: "ไทย" },
  { code: "en", label: "English" },
  { code: "my", label: "မြန်မာ" },
];

interface LanguageSwitcherProps {
  disabled?: boolean;
}

export function LanguageSwitcher({ disabled = false }: LanguageSwitcherProps) {
  const { lang, setLang, t } = useI18n();
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("click", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("click", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, []);

  return (
    <div className="lang-switcher" ref={rootRef}>
      <button
        type="button"
        suppressHydrationWarning
        className={`lang-toggle${open ? " is-open" : ""}`}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls="langMenu"
        aria-label={t("changeLanguage")}
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <svg className="lang-icon" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.5" />
          <path
            d="M3 12h18M12 3c2.5 2.8 3.8 6 3.8 9s-1.3 6.2-3.8 9M12 3c-2.5 2.8-3.8 6-3.8 9s1.3 6.2 3.8 9"
            stroke="currentColor"
            strokeWidth="1.5"
          />
        </svg>
        <span>{LANG_LABELS[lang]}</span>
        <svg className="lang-chevron" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <path
            d="M6 9l6 6 6-6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>
      <ul
        id="langMenu"
        className="lang-menu"
        role="listbox"
        hidden={!open}
      >
        {LANG_OPTIONS.map(({ code, label }) => (
          <li key={code} role="option" aria-selected={lang === code}>
            <button
              type="button"
              suppressHydrationWarning
              data-lang={code}
              className={`lang-option${lang === code ? " is-active" : ""}`}
              onClick={() => {
                setLang(code);
                setOpen(false);
              }}
            >
              {label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
