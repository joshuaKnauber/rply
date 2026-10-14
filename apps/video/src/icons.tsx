import type { CSSProperties } from "react";

const paths = {
  plus: '<path d="M5 12h14"/><path d="M12 5v14"/>',
  "arrow-up": '<path d="m5 12 7-7 7 7"/><path d="M12 19V5"/>',
  ellipsis: '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>',
  app: '<rect x="2" y="4" width="20" height="16" rx="2"/><path d="M10 4v4"/><path d="M2 8h20"/><path d="M6 4v4"/>',
  bell: '<path d="M10.268 21a2 2 0 0 0 3.464 0"/><path d="M3.262 15.326A1 1 0 0 0 4 17h16a1 1 0 0 0 .74-1.673C19.41 13.956 18 12.499 18 8A6 6 0 0 0 6 8c0 4.499-1.411 5.956-2.738 7.326"/>',
  bot: '<path d="M12 8V4H8"/><rect width="16" height="12" x="4" y="8" rx="2"/><path d="M2 14h2"/><path d="M20 14h2"/><path d="M15 13v2"/><path d="M9 13v2"/>',
  check: '<path d="M20 6 9 17l-5-5"/>',
  lock: '<rect width="18" height="11" x="3" y="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>',
  eye: '<path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0"/><circle cx="12" cy="12" r="3"/>',
  loader: '<path d="M21 12a9 9 0 1 1-6.219-8.56"/>',
  terminal: '<path d="m4 17 6-6-6-6"/><path d="M12 19h8"/>',
  pin: '<path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7a1 1 0 0 1 1-1 2 2 0 0 0 0-4H8a2 2 0 0 0 0 4 1 1 0 0 1 1 1z"/>',
  server: '<rect width="20" height="8" x="2" y="2" rx="2" ry="2"/><rect width="20" height="8" x="2" y="14" rx="2" ry="2"/><line x1="6" x2="6.01" y1="6" y2="6"/><line x1="6" x2="6.01" y1="18" y2="18"/>',
  laptop: '<rect width="20" height="14" x="2" y="3" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>',
  phone: '<rect width="14" height="20" x="5" y="2" rx="2" ry="2"/><path d="M12 18h.01"/>',
  chevron: '<path d="m15 18-6-6 6-6"/>',
};

export type IconName = keyof typeof paths;

export const Icon = ({ name, className = "size-4", style }: { name: IconName; className?: string; style?: CSSProperties }) => (
  <svg
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth={1.75}
    strokeLinecap="round"
    strokeLinejoin="round"
    className={className}
    style={style}
    dangerouslySetInnerHTML={{ __html: paths[name] }}
  />
);

const birdPath =
  "M98.5728 24.1553C125.573 9.25532 156.273 -0.844261 196.073 0.0556508C230.973 -0.444349 260.974 10.8558 287.874 26.2558C314.473 41.5558 335.173 64.6555 351.173 90.1553C353.773 94.3551 357.573 96.7556 362.073 99.3555L434.173 141.556C439.173 144.456 441.573 147.556 441.573 151.256C441.573 155.456 438.973 159.056 433.874 162.056L374.173 197.256C366.673 201.656 364.473 205.956 364.073 213.256C362.473 252.556 349.673 286.156 316.573 314.855C294.873 334.755 271.273 350.155 240.673 356.655C222.173 360.655 203.073 361.255 182.073 360.855C174.573 360.656 171.173 362.756 165.374 367.756C147.774 380.356 119.873 398.755 91.4732 412.655C87.3732 414.655 84.2728 416.156 81.0728 416.056C73.2732 415.955 71.4734 409.055 74.1734 402.655L89.8736 364.855C91.5735 360.456 93.2732 356.055 93.4732 351.855C93.9731 344.956 92.2733 340.656 85.8736 337.056C74.4737 330.456 63.0735 321.256 53.8736 313.456C18.2737 284.956 1.27346 249.256 0.173359 207.456C-0.92664 178.356 3.17317 149.956 13.4732 122.556C30.3731 77.6557 57.4729 46.7553 98.5728 24.1553ZM255.012 84.5556C235.662 84.5559 221.338 99.9436 221.086 120.927C220.584 141.147 235.034 157.298 255.264 157.553C274.489 157.807 289.819 142.164 290.07 121.054C290.321 100.452 274.74 84.5556 255.012 84.5556Z";

export const Bird = ({ className = "size-4", style }: { className?: string; style?: CSSProperties }) => (
  <svg viewBox="0 0 442 417" fill="currentColor" className={className} style={style}>
    <path fillRule="evenodd" clipRule="evenodd" d={birdPath} />
  </svg>
);

export const AppIcon = ({ size, className = "" }: { size: number; className?: string }) => (
  <span
    className={`grid flex-none place-items-center border border-brand-600 bg-linear-to-b from-brand-400 to-brand-500 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.3)] ${className}`}
    style={{ width: size, height: size, borderRadius: size * 0.26 }}
  >
    <Bird style={{ width: size * 0.5, height: size * 0.5 }} />
  </span>
);
