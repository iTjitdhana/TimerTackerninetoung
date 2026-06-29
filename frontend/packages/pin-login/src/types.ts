export type Lang = "th" | "en" | "my";

export interface AuthenticatedUser {
  employeeId: string;
  name: string;
  role: string;
}

export interface Employee {
  employeeId: string;
  name: string;
  role: string;
}

export interface AlertState {
  message: string;
  variant: "error" | "success";
  i18nKey?: string;
  i18nVars?: Record<string, string | number>;
}

export interface PinLoginBranding {
  title?: string;
  logoUrl?: string;
  logoAlt?: string;
  backgroundImageUrl?: string;
  footerText?: string;
}

export interface LoginPageProps extends PinLoginBranding {
  pinLength?: number;
  maxAttempts?: number;
  /** Custom auth — return user on success, null on failure */
  onLogin?: (pin: string) => Promise<AuthenticatedUser | null>;
  onSuccess?: (user: AuthenticatedUser) => void;
  /** Called when user clicks register link */
  onRegisterClick?: () => void;
  registerHref?: string;
  /** Use built-in demo auth (localStorage). Default: true when onLogin is omitted */
  useDemoAuth?: boolean;
  className?: string;
}

export interface RegisterPageProps extends PinLoginBranding {
  pinLength?: number;
  onRegister?: (newPin: string) => Promise<void>;
  onSuccess?: () => void;
  onLoginClick?: () => void;
  loginHref?: string;
  useDemoAuth?: boolean;
  className?: string;
}

export interface PinInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  disabled?: boolean;
  idPrefix?: string;
  shake?: boolean;
  groupLabel?: string;
  digitLabel?: (digit: number) => string;
  className?: string;
}

export interface I18nContextValue {
  lang: Lang;
  setLang: (lang: Lang) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
}
