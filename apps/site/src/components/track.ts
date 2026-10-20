declare global {
  interface Window {
    plausible?: (event: string, options?: { props?: Record<string, string | number> }) => void;
  }
}

export const track = (event: string, props?: Record<string, string | number>) => window.plausible?.(event, props && { props });

export const tagged = (event: string, props: Record<string, string> = {}) =>
  [["name", event], ...Object.entries(props)].map(([k, v]) => `plausible-event-${k}=${v.replaceAll(" ", "+")}`).join(" ");
