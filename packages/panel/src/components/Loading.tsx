import { usePanelI18n } from "../context.tsx";

export function Loading() {
  const { t } = usePanelI18n();
  return (
    <div className="mma-load" role="status" aria-label={t("load.label")}>
      <div className="mma-load-art" aria-hidden="true">
        <svg viewBox="0 0 88 64" fill="none">
          <rect x="10" y="8" width="68" height="48" rx="10" stroke="currentColor" strokeWidth="1.6" opacity=".35" />
          <rect x="10" y="8" width="68" height="12" rx="10" fill="currentColor" opacity=".08" />
          <circle cx="20" cy="14" r="2.2" fill="currentColor" opacity=".35" />
          <rect x="26" y="12.2" width="18" height="3.6" rx="1.8" fill="currentColor" opacity=".22" />
          <rect x="20" y="28" width="28" height="4" rx="2" fill="currentColor" opacity=".16" />
          <rect x="20" y="36" width="40" height="4" rx="2" fill="currentColor" opacity=".1" />
          <rect x="20" y="44" width="22" height="4" rx="2" fill="currentColor" opacity=".08" />
          <path d="M62 40c6 0 10 5 10 10" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" opacity=".85" />
          <circle cx="72" cy="50" r="3.2" fill="currentColor" opacity=".9" />
        </svg>
      </div>
      <div className="mma-load-dots">
        <i />
        <i />
        <i />
      </div>
    </div>
  );
}
