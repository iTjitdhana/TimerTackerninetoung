import type { CSSProperties, ReactNode } from "react";
import { LanguageSwitcher } from "./LanguageSwitcher";

interface AuthLayoutProps {
  children: ReactNode;
  backgroundImageUrl?: string;
  footer?: ReactNode;
  langSwitcherDisabled?: boolean;
  className?: string;
}

export function AuthLayout({
  children,
  backgroundImageUrl,
  footer,
  langSwitcherDisabled = false,
  className = "",
}: AuthLayoutProps) {
  const bgStyle = backgroundImageUrl
    ? ({
        "--pin-login-bg-image": `url("${backgroundImageUrl}")`,
      } as CSSProperties)
    : undefined;

  return (
    <>
      <div className="page-bg" aria-hidden="true" style={bgStyle} />
      <LanguageSwitcher disabled={langSwitcherDisabled} />
      <div className={`page${className ? ` ${className}` : ""}`}>
        {children}
        {footer}
      </div>
    </>
  );
}
