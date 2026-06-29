import { useI18n } from "../i18n/I18nProvider";

interface BrandHeaderProps {
  title?: string;
  subtitle: string;
  logoUrl?: string;
  logoAlt?: string;
  compact?: boolean;
}

export function BrandHeader({
  title,
  subtitle,
  logoUrl,
  logoAlt = "Logo",
  compact = false,
}: BrandHeaderProps) {
  const { t } = useI18n();
  const brandTitle = title ?? t("appTitle");

  return (
    <div className={`brand${compact ? " brand--compact" : ""}`}>
      {logoUrl && (
        <div className="brand-logo">
          <img src={logoUrl} alt={logoAlt} width={120} height={120} />
        </div>
      )}
      <h1 className="brand-title">{brandTitle}</h1>
      <p className="brand-subtitle">{subtitle}</p>
    </div>
  );
}
