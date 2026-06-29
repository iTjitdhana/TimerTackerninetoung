import { useCallback, useEffect, useState, type FormEvent } from "react";
import { I18nProvider, useI18n, useLocalizedAlert } from "../i18n/I18nProvider";
import { demoRegister } from "../lib/pinStore";
import type { AlertState, RegisterPageProps } from "../types";
import { Alert } from "./Alert";
import { AuthLayout } from "./AuthLayout";
import { BrandHeader } from "./BrandHeader";
import { PinInput } from "./PinInput";

function RegisterPageInner({
  pinLength = 4,
  onRegister,
  onSuccess,
  onLoginClick,
  loginHref,
  logoUrl,
  logoAlt,
  title,
  backgroundImageUrl,
  footerText,
  className,
}: RegisterPageProps) {
  const { t } = useI18n();
  const [pinNew, setPinNew] = useState("");
  const [pinConfirm, setPinConfirm] = useState("");
  const [loading, setLoading] = useState(false);
  const [shakeNew, setShakeNew] = useState(false);
  const [shakeConfirm, setShakeConfirm] = useState(false);
  const [alert, setAlert] = useState<AlertState | null>(null);
  const localizedAlert = useLocalizedAlert(alert);

  const registerFn = onRegister ?? (async (pin: string) => demoRegister("demo", pin));

  useEffect(() => {
    document.title = t("pageTitleRegister");
  }, [t]);

  const isComplete =
    pinNew.length === pinLength &&
    pinConfirm.length === pinLength;

  const clearAlert = () => setAlert(null);

  const triggerShake = (target: "new" | "confirm") => {
    if (target === "new") {
      setShakeNew(true);
      setTimeout(() => setShakeNew(false), 450);
    } else {
      setShakeConfirm(true);
      setTimeout(() => setShakeConfirm(false), 450);
    }
  };

  const handleSubmit = useCallback(
    async (e: FormEvent) => {
      e.preventDefault();
      if (!isComplete) {
        setAlert({
          message: t("fillAllFields"),
          variant: "error",
          i18nKey: "fillAllFields",
        });
        return;
      }

      clearAlert();

      if (pinNew !== pinConfirm) {
        setAlert({
          message: t("pinMismatch"),
          variant: "error",
          i18nKey: "pinMismatch",
        });
        triggerShake("confirm");
        setPinConfirm("");
        return;
      }

      setLoading(true);
      try {
        await registerFn(pinNew);
        setLoading(false);
        setAlert({
          message: t("registerSuccess"),
          variant: "success",
          i18nKey: "registerSuccess",
        });
        onSuccess?.();
      } catch (error) {
        setLoading(false);
        setAlert({
          message:
            error instanceof Error ? error.message : t("fillAllFields"),
          variant: "error",
        });
      }
    },
    [isComplete, pinNew, pinConfirm, registerFn, onSuccess, t]
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
      <div className="login-card login-card--register" role="main">
        <BrandHeader
          title={title}
          subtitle={t("subtitleRegister")}
          logoUrl={logoUrl}
          logoAlt={logoAlt}
          compact
        />

        <form className="login-form" noValidate onSubmit={handleSubmit}>
          <div className="field">
            <label htmlFor="pin-new-0">
              {t("pinSetLabel")}{" "}
              <span className="label-hint">{t("pinHint")}</span>
            </label>
            <PinInput
              length={pinLength}
              value={pinNew}
              onChange={(v) => {
                clearAlert();
                setPinNew(v);
              }}
              disabled={loading}
              idPrefix="pin-new"
              shake={shakeNew}
              groupLabel={t("pinSetLabel")}
              digitLabel={(n) => t("pinDigit", { n })}
            />
          </div>

          <div className="field">
            <label htmlFor="pin-confirm-0">
              {t("pinConfirmLabel")}{" "}
              <span className="label-hint">{t("pinHint")}</span>
            </label>
            <PinInput
              length={pinLength}
              value={pinConfirm}
              onChange={(v) => {
                clearAlert();
                setPinConfirm(v);
              }}
              disabled={loading}
              idPrefix="pin-confirm"
              shake={shakeConfirm}
              groupLabel={t("pinConfirmLabel")}
              digitLabel={(n) => t("pinDigit", { n })}
            />
          </div>

          <Alert alert={localizedAlert} />

          <button
            type="submit"
            suppressHydrationWarning
            className={`btn-primary${loading ? " loading" : ""}`}
            disabled={loading || !isComplete}
          >
            <span className="btn-text">{t("register")}</span>
            {loading && <span className="btn-spinner" aria-hidden="true" />}
          </button>
        </form>

        {(onLoginClick || loginHref) && (
          <p className="form-nav">
            {loginHref ? (
              <a href={loginHref}>{t("goBackLogin")}</a>
            ) : (
              <button
                type="button"
                suppressHydrationWarning
                className="link-button"
                onClick={onLoginClick}
              >
                {t("goBackLogin")}
              </button>
            )}
          </p>
        )}
      </div>
    </AuthLayout>
  );
}

export function RegisterPage(props: RegisterPageProps) {
  return (
    <I18nProvider>
      <RegisterPageInner {...props} />
    </I18nProvider>
  );
}
