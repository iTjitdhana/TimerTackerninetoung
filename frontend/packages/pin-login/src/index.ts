export { LoginPage } from "./components/LoginPage";
export { RegisterPage } from "./components/RegisterPage";
export { PinInput } from "./components/PinInput";
export { AuthLayout } from "./components/AuthLayout";
export { BrandHeader } from "./components/BrandHeader";
export { LanguageSwitcher } from "./components/LanguageSwitcher";
export { Alert } from "./components/Alert";
export { I18nProvider, useI18n } from "./i18n/I18nProvider";
export {
  demoLogin,
  demoRegister,
  findUserByPin,
  registerEmployeePin,
  seedDemoPin,
  EMPLOYEE_ROSTER,
} from "./lib/pinStore";
export { translate, I18N, LANG_LABELS } from "./i18n/translations";
export type {
  Lang,
  AuthenticatedUser,
  Employee,
  LoginPageProps,
  RegisterPageProps,
  PinInputProps,
  PinLoginBranding,
  AlertState,
  I18nContextValue,
} from "./types";

import "./styles/pin-login.css";
