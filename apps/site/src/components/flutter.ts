import { birdPath } from "./bird.ts";

const colors = ["#6f7ef6", "#97a3ff", "#aab3ff", "#5b68e0"];
const svgNs = "http://www.w3.org/2000/svg";

export function flutter(from: HTMLElement, count = 12) {
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  const rect = from.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  for (let i = 0; i < count; i++) {
    const size = 12 + Math.random() * 12;
    const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.5;
    const distance = 70 + Math.random() * 70;
    const dx = Math.cos(angle) * distance * 1.4;
    const dy = Math.sin(angle) * distance - 20;
    const flip = dx < 0 ? -1 : 1;
    const tilt = Math.max(-30, Math.min(30, (dy / distance) * 30)) * flip;

    const svg = document.createElementNS(svgNs, "svg");
    svg.setAttribute("viewBox", "0 0 442 417");
    svg.setAttribute("aria-hidden", "true");
    const path = document.createElementNS(svgNs, "path");
    path.setAttribute("d", birdPath);
    path.setAttribute("fill-rule", "evenodd");
    path.setAttribute("fill", colors[i % colors.length]);
    Object.assign(path.style, { transformBox: "fill-box", transformOrigin: "center" });
    svg.append(path);
    Object.assign(svg.style, {
      position: "fixed",
      left: `${cx - size / 2 + (Math.random() - 0.5) * rect.width * 0.4}px`,
      top: `${cy - size / 2}px`,
      width: `${size}px`,
      height: `${size}px`,
      pointerEvents: "none",
      zIndex: "50",
    });
    document.body.append(svg);

    const at = (t: number, scale: number) =>
      `translate(${dx * t}px, ${dy * t}px) rotate(${tilt}deg) scale(${flip * scale}, ${scale})`;
    const flight = svg.animate(
      [
        { offset: 0, opacity: 0, transform: at(0, 0.2) },
        { offset: 0.25, opacity: 1, transform: at(0.35, 0.9) },
        { offset: 0.7, opacity: 1, transform: at(0.85, 1) },
        { offset: 1, opacity: 0, transform: at(1, 1) },
      ],
      { duration: 1100 + Math.random() * 400, delay: Math.random() * 80, easing: "cubic-bezier(0.22, 1, 0.36, 1)", fill: "both" },
    );
    path.animate([{ transform: "scaleY(1)" }, { transform: "scaleY(0.72)" }], {
      duration: 110 + Math.random() * 40,
      iterations: Infinity,
      direction: "alternate",
      easing: "ease-in-out",
    });
    flight.finished.then(() => svg.remove());
  }
}
