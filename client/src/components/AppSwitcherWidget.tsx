import { useEffect, useRef } from "react";

interface Props {
  token: string;
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
}

const SCRIPT_ID = "signsuiteiq-app-switcher-script";

export function AppSwitcherWidget({ token, position = "top-right" }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!token) return;

    const existing = document.getElementById(SCRIPT_ID) as HTMLScriptElement | null;
    if (existing) {
      if (existing.dataset.token !== token) {
        existing.remove();
      } else {
        return;
      }
    }

    const script = document.createElement("script");
    script.id = SCRIPT_ID;
    script.src = "https://signsuiteiq.ai/widget/app-switcher.js";
    script.defer = true;
    script.dataset.apiBase = "https://signsuiteiq.ai";
    script.dataset.token = token;
    script.dataset.position = position;
    document.body.appendChild(script);

    return () => {
      const s = document.getElementById(SCRIPT_ID);
      if (s) s.remove();
    };
  }, [token, position]);

  return <div ref={containerRef} data-testid="app-switcher-mount" />;
}
