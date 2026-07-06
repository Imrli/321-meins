import { useEffect, useState } from "react";

const STORAGE_KEY = "321meins_cookie_notice_ack";

export function CookieConsentBanner() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(STORAGE_KEY) !== "1") setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  if (!visible) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(STORAGE_KEY, "1");
    } catch {
      /* ignore quota / private mode */
    }
    setVisible(false);
  };

  return (
    <div
      role="region"
      aria-label="Hinweis zu Cookies"
      className="fixed bottom-0 left-0 right-0 z-[85] border-t border-slate-200/90 bg-white/95 px-4 py-4 shadow-[0_-8px_30px_rgba(15,23,42,0.08)] backdrop-blur-md supports-[backdrop-filter]:bg-white/90 md:px-6 md:py-4"
    >
      <div className="mx-auto flex max-w-6xl flex-col gap-4 md:flex-row md:items-center md:justify-between md:gap-8">
        <p className="text-sm leading-relaxed text-slate-700 md:text-[0.9375rem] md:leading-relaxed">
          Diese Website verwendet ausschliesslich technisch notwendige Cookies
          für den Login. Es werden keine Tracking- oder Analyse-Cookies
          eingesetzt. Mehr dazu in unserer{" "}
          <a
            href="#/datenschutz"
            className="font-medium text-[var(--color-brand-600)] underline decoration-slate-300 underline-offset-2 transition-colors hover:text-[var(--color-brand-700)] hover:decoration-[var(--color-brand-400)]"
          >
            Datenschutzerklärung
          </a>
          .
        </p>
        <button
          type="button"
          className="btn-primary-321 shrink-0 self-stretch md:self-center"
          onClick={dismiss}
        >
          Verstanden
        </button>
      </div>
    </div>
  );
}
