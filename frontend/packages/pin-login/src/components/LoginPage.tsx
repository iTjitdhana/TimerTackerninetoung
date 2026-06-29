import { useCallback, useEffect, useState, type FormEvent } from "react";
import { I18nProvider, useI18n, useLocalizedAlert } from "../i18n/I18nProvider";
import { demoLogin } from "../lib/pinStore";
import type { AlertState, AuthenticatedUser, LoginPageProps } from "../types";
import { Alert } from "./Alert";
import { AuthLayout } from "./AuthLayout";
import { BrandHeader } from "./BrandHeader";
import { PinInput } from "./PinInput";

const DEFAULT_MAX_ATTEMPTS = 5;

function LoginPageInner({
  pinLength = 4,
  maxAttempts = DEFAULT_MAX_ATTEMPTS,
  onLogin,
  onSuccess,
  onRegisterClick,
  registerHref,
  logoUrl,
  logoAlt,
  title,
  backgroundImageUrl,
  footerText,
  className,
}: LoginPageProps) {
  const { t } = useI18n();
  const [pin, setPin] = useState("");
  const [loading, setLoading] = useState(false);
  const [shake, setShake] = useState(false);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [alert, setAlert] = useState<AlertState | null>(null);
  const localizedAlert = useLocalizedAlert(alert);

  const loginFn = onLogin ?? demoLogin;

  useEffect(() => {
    document.title = t("pageTitleLogin");
  }, [t]);

  const clearAlert = () => setAlert(null);

  const triggerShake = () => {
    setShake(true);
    setTimeout(() => setShake(false), 450);
  };

  const handleSubmit = useCallback(
    async (e?: FormEvent, pinOverride?: string) => {
      e?.preventDefault();
      const pinValue = pinOverride ?? pin;
      if (pinValue.length !== pinLength) return;

      clearAlert();

      if (failedAttempts >= maxAttempts) {
        setAlert({
          message: t("accountLocked"),
          variant: "error",
          i18nKey: "accountLocked",
        });
        return;
      }

      setLoading(true);
      try {
        const user = await loginFn(pinValue);
        setLoading(false);

        if (user) {
          setFailedAttempts(0);
          setAlert({
            message: t("loginSuccess"),
            variant: "success",
            i18nKey: "loginSuccess",
          });
          onSuccess?.(user);
        } else {
          const nextFailed = failedAttempts + 1;
          setFailedAttempts(nextFailed);
          const remaining = maxAttempts - nextFailed;

          if (remaining > 0) {
            setAlert({
              message: t("pinInvalid", { n: remaining }),
              variant: "error",
              i18nKey: "pinInvalid",
              i18nVars: { n: remaining },
            });
          } else {
            setAlert({
              message: t("accountLockedShort"),
              variant: "error",
              i18nKey: "accountLockedShort",
            });
          }

          triggerShake();
          setPin("");
        }
      } catch {
        setLoading(false);
        setAlert({
          message: t("pinInvalid", { n: maxAttempts - failedAttempts }),
          variant: "error",
        });
      }
    },
    [pin, pinLength, failedAttempts, maxAttempts, loginFn, onSuccess, t]
  );

  const footer = (
    <p className="page-footer">
      {footerText ?? (
        <>
          &copy; 2026 JITDHANA CO., LTD — {t("internalSystem")}
        </>
      )}
    </p>
  );

  return (
    <AuthLayout
      backgroundImageUrl={backgroundImageUrl}
      footer={footer}
      langSwitcherDisabled={loading}
      className={className}
    >
      <div className="login-card" role="main">
        <BrandHeader
          title={title}
          subtitle={t("subtitleLogin")}
          logoUrl={logoUrl}
          logoAlt={logoAlt}
        />

        <form
          className="login-form"
          noValidate
          onSubmit={(e) => handleSubmit(e)}
        >
          <div className="field">
            <label htmlFor="pin-0">
              PIN <span className="label-hint">{t("pinHint")}</span>
            </label>
            <PinInput
              length={pinLength}
              value={pin}
              onChange={(v) => {
                clearAlert();
                setPin(v);
              }}
              onComplete={(v) => handleSubmit(undefined, v)}
              disabled={loading}
              idPrefix="pin"
              shake={shake}
              groupLabel={t("pinGroupLabel")}
              digitLabel={(n) => t("pinDigit", { n })}
            />
          </div>

          <Alert alert={localizedAlert} />

          <button
            type="submit"
            suppressHydrationWarning
            className={`btn-primary${loading ? " loading" : ""}`}
            disabled={loading || pin.length !== pinLength}
          >
            <span className="btn-text">{t("signIn")}</span>
            {loading && <span className="btn-spinner" aria-hidden="true" />}
          </button>
        </form>

        {(onRegisterClick || registerHref) && (
          <p className="form-nav">
            {registerHref ? (
              <a href={registerHref}>{t("goRegister")}</a>
            ) : (
              <button
                type="button"
                suppressHydrationWarning
                className="link-button"
                onClick={onRegisterClick}
              >
                {t("goRegister")}
              </button>
            )}
          </p>
        )}
      </div>
    </AuthLayout>
  );
}

export function LoginPage(props: LoginPageProps) {
  return (
    <I18nProvider>
      <LoginPageInner {...props} />
    </I18nProvider>
  );
}

export type { AuthenticatedUser };
