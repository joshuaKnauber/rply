---
version: alpha
name: rply web app
description: The inbox where humans read, answer and steer their AI agents. Quiet, utilitarian, one accent.
colors:
  gray-50: "oklch(0.985 0.0015 80)"
  gray-100: "oklch(0.965 0.0015 80)"
  gray-150: "oklch(0.945 0.0015 80)"
  gray-200: "oklch(0.92 0.0015 80)"
  gray-400: "oklch(0.71 0.0015 80)"
  gray-500: "oklch(0.56 0.0015 80)"
  gray-800: "oklch(0.27 0.0015 80)"
  gray-850: "oklch(0.23 0.0015 80)"
  gray-900: "oklch(0.2 0.0015 80)"
  gray-950: "oklch(0.16 0.0015 80)"
  brand-400: "#97a3ff"
  brand-500: "#6f7ef6"
  brand-600: "#5b68e0"
  brand-700: "#4a54c4"
  danger-500: "#ef4444"
  danger-600: "#dc2626"
  danger-700: "#b91c1c"
  white: "#ffffff"
  primary: "{colors.brand-500}"
  background: "{colors.white}"
  foreground: "{colors.gray-800}"
  sidebar: "{colors.gray-100}"
  muted: "{colors.gray-100}"
  muted-foreground: "{colors.gray-500}"
  border: "{colors.gray-200}"
  attention: "{colors.brand-600}"
  background-dark: "{colors.gray-900}"
  foreground-dark: "{colors.gray-50}"
  sidebar-dark: "{colors.gray-950}"
  muted-dark: "{colors.gray-850}"
  muted-foreground-dark: "{colors.gray-400}"
  border-dark: "oklch(1 0 0 / 8%)"
  attention-dark: "{colors.brand-400}"
typography:
  display:
    fontFamily: Inter Variable
    fontSize: 1.5rem
    fontWeight: 600
    lineHeight: 2rem
    letterSpacing: -0.02em
  title:
    fontFamily: Inter Variable
    fontSize: 1rem
    fontWeight: 500
    lineHeight: 1.5rem
  body:
    fontFamily: Inter Variable
    fontSize: 0.875rem
    fontWeight: 400
    lineHeight: 1.375rem
  body-sm:
    fontFamily: Inter Variable
    fontSize: 0.8125rem
    fontWeight: 400
    lineHeight: 1.25rem
  caption:
    fontFamily: Inter Variable
    fontSize: 0.75rem
    fontWeight: 400
    lineHeight: 1rem
  label:
    fontFamily: Inter Variable
    fontSize: 0.8125rem
    fontWeight: 500
    lineHeight: 1.25rem
  mono:
    fontFamily: Geist Mono Variable
    fontSize: 0.8125rem
    fontWeight: 400
    lineHeight: 1.5rem
rounded:
  sm: 4px
  md: 5px
  lg: 6px
  xl: 8px
  full: 9999px
spacing:
  unit: 4px
  xs: 4px
  sm: 8px
  md: 12px
  lg: 16px
  xl: 24px
  page: 24px
  header: 56px
  sidebar: 288px
  panel: 320px
  thread: 768px
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.white}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    height: 32px
    padding: 0 10px
  button-destructive:
    backgroundColor: "{colors.danger-600}"
    textColor: "{colors.white}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    height: 32px
  button-outline:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    typography: "{typography.label}"
    rounded: "{rounded.lg}"
    height: 32px
  button-ghost:
    textColor: "{colors.muted-foreground}"
    rounded: "{rounded.lg}"
    size: 32px
  input:
    backgroundColor: "{colors.background}"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    height: 36px
  composer:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.xl}"
    padding: 14px 16px 8px
  message-agent:
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: 10px 12px
  message-human:
    backgroundColor: "{colors.muted}"
    textColor: "{colors.foreground}"
    typography: "{typography.body}"
    rounded: "{rounded.lg}"
    padding: 10px 12px
  card:
    backgroundColor: "{colors.background}"
    rounded: "{rounded.xl}"
    padding: 12px
  sidebar-row:
    typography: "{typography.body-sm}"
    padding: 10px 16px
  sidebar-row-active:
    backgroundColor: "{colors.muted}"
  otp-slot:
    typography: "{typography.mono}"
    rounded: "{rounded.lg}"
    size: 40px
---

## Overview

rply is an inbox for AI agents. A human checks it between other work, often on a phone, to see what their agents did and to answer what they asked. The UI should feel like a well-made tool: quiet, dense enough to scan, and calm when nothing needs attention. It takes cues from Linear and Polylane. Hairline borders separate regions, text is charcoal rather than black, and one periwinkle accent marks the few things that need the human.

The one rule that matters most: color means "your turn". Agents send a lot. Open questions, the send button and selected answers get the accent. Everything else stays gray.

Light and dark mode are both first-class. Every color decision below has a dark counterpart in the tokens (`*-dark`).

## Colors

The palette is a near-neutral gray scale (hue 80, chroma 0.0015, so a faint warmth you feel more than see) plus one accent and one danger color.

- **Grays** carry the whole interface. Text is `gray-800` in light mode, never pure black. Secondary text, timestamps and labels use `muted-foreground` (`gray-500`).
- **Brand periwinkle** (`brand-400` to `brand-700`) is the only accent. It appears in primary buttons (as a gradient), selected options, the "waiting for your reply" marker and focus on chosen states. It is the same accent as the marketing site.
- **Attention** is an alias for the accent used on open questions: a 2px left border on the message, the question icon in the header, and the dot in the channel list.
- **Danger red** is for destructive confirms only (delete, revoke, remove). Use the stronger Tailwind red, not a softened one.
- **Surfaces**: the main area is `background` (white / `gray-900`). The sidebar is one step darker (`sidebar`). Tinted areas such as human messages, the composer and selected rows use `muted`.

Don't introduce new hues. Message states (seen, working, done) stay gray.

## Typography

Inter Variable everywhere, loaded with optical sizing so large headings get Inter's tighter display cuts automatically. Geist Mono for code, commands, claim codes and file-type badges.

The scale is sized for an app, one step smaller than Tailwind's defaults: `text-base` is 14px and `text-sm` is 13px. Use the Tailwind classes (`text-xs` through `text-2xl`) and never arbitrary sizes like `text-[11px]`.

- **Page titles** (`display`): 24px semibold with slight negative tracking, used once per page ("Add a channel").
- **Header titles** (`title`): the channel name in the top bar, 16px medium. Headers stay small. The content carries the weight.
- **Body**: 14px for messages and markdown. 13px for secondary text, list previews and descriptions.
- **Captions**: 12px for timestamps, sizes and helper text, with `tabular-nums` wherever numbers line up.
- Section labels inside panels ("Agents", "Status") are 13px regular in `muted-foreground`, not uppercase.

## Layout

Three columns on desktop: sidebar (288px), content, and a right panel (320px) for channel details and pinned messages. Each region is separated by a single 1px border, never by shadows or gaps.

- Every page starts with a 56px top bar with a bottom border, holding the page or channel name on the left and icon actions on the right.
- Page padding is 24px horizontally. Content columns are centered: the thread at 768px, forms and settings at 672px.
- Inside the right panel, sections are separated by inset dividers (`divide-y` inside the padding), not full-bleed lines.
- Lists in the sidebar are full-bleed rows (no rounded highlight) with 16px horizontal padding.
- Below 1024px the right panel moves into a sheet opened from the header. Below 768px the sidebar and content become separate screens with a back button.
- Spacing follows the 4px Tailwind scale. Common steps: 8px between related items, 12px inside cards, 24px between sections.

## Elevation & Depth

The interface is flat. Depth comes from tints and borders.

- Use background tints (`bg-muted`, `bg-foreground/6` for selection) before borders, and borders before shadows.
- The only shadows are on buttons: a thin top highlight (`inset 0 1px 0 white/30`) and a faint 1–2px drop shadow, which makes them read as pressable. Popovers, menus and dialogs use the shadcn defaults.
- Modals (dialogs, the alert dialog, the image preview, the mobile sheet) are the only layered surfaces.

## Shapes

Corners are small and consistent. The base radius is 6px (`rounded-lg`). Cards, embeds, file lists, the composer and option lists use 8px (`rounded-xl` falls back to the same feel). Pills are rare: only the radio dot, step numbers and status dots are fully round.

Don't use large radii or pill-shaped buttons in the app. The marketing site's round buttons are a site-only style.

## Components

- **Buttons.** Primary is a vertical gradient from `brand-400` to `brand-500` with a `brand-600` border, a white top highlight and white text, and brightens slightly on hover. Destructive is the same construction in red (`red-500` to `red-600`, `red-700` border). Outline is the page background with a border and the same top highlight. Ghost buttons are for icon actions and secondary links. Keep one primary button per view.
- **Messages.** Agent messages are flat rows: a small header with the sender name (medium) and time (muted, tabular), then content. Human messages are the same row on a `muted` tint. No chat bubbles, no left/right alignment. A message waiting for an answer gets a 2px `attention` left border.
- **Composer.** A rounded `muted` box with the textarea on top and a row underneath: a ghost "+" for attachments on the left, a small send arrow on the right that turns primary once there's something to send.
- **Answer inputs.** Choices are outline buttons. The selected one becomes primary (or destructive for danger options). Confirms are a single primary or destructive button.
- **Pinned messages** live in the right panel as sections with a muted label and time, collapsible, unpin on hover.
- **Files** are grouped in one bordered list with a row per file: a mono extension badge (CSV, PDF) on a muted tile, the name, and the size, which turns into a download icon on hover. Images get a 1px border and the card radius.
- **Apps** are listed in the sidebar under their channel: indented rows with an app icon and the title in `muted-foreground`, selected like channel rows. An open app fills the whole content area below the header (title "Channel / App", the channel name links back to the chat), without the right panel and without a card around it.
- **Links**: a bare URL inside text becomes a chip on `muted` (16px site icon + page title, truncated). A URL alone on its line becomes a bordered card (8px radius, max 512px): icon and site in caption size, title up to two lines in medium, description on one line in `muted-foreground`, an optional 64px thumbnail on the right. Without metadata, the chip shows a shortened URL. Labelled links stay underlined text with a 14px site icon in front. Wide tables and code scroll inside their own box; nothing may widen the thread.
- **Embed errors** show as a thin `destructive` row above the embed (or at the top of an app): "This app hit an error: …", a ghost "Send to agent" and a dismiss icon.
- **HTML embeds** sit in a bordered card with the label as a header row. The embed inherits the app theme and can use `--rply-fg`, `--rply-muted`, `--rply-border`, `--rply-surface` and `--rply-accent`.
- **Option lists** (choosing how to add a channel) are one bordered box with divided rows: icon, title, description, and a radio dot that fills with the accent when selected.
- **Steps** are numbered circles joined by a vertical line. Finished steps fill with the accent and show a check. Upcoming steps are muted.
- **Claim codes** use an OTP input: eight mono slots in two groups of four with a dash, matching how codes are printed (`K7QX-M2PD`).
- **Sign-in** is a single centered column (384px) with no sidebar: the logo, a display title ("Sign in", "Set up rply" on a fresh server), one muted line, then the form. One primary button submits; passkey and email-link options are full-width outline buttons below it, shown only when the server supports them. Switching between sign-in and creating an account is a plain underlined text link at the bottom.
- **Settings** is a stack of sections separated by dividers: title and one muted line on the left with the control on the right, or a list below for passkeys (rows with an icon, the label and a muted date that turns into a ghost action on hover). Usage (only when the server sets quotas) lists each limit as a label, a muted tabular "used of limit" and a thin progress bar. Delete account is the last section: an outline button that opens an inline password field and a destructive "Delete everything" button.
- **Confirmations** always use the alert dialog through `confirmDialog()`, never `window.confirm`. Destructive actions get a red action button and a sentence on how to undo or regain access.
- **Feedback** goes through toasts for completed actions ("Link copied") and inline red text for form errors.
- **Logo.** In the app header: the bird and "rply.sh" in the current text color. The gradient tile (`LogoMark`) is for icons and favicons.

## Do's and Don'ts

- Do keep the accent for things that need the human. If everything is periwinkle, nothing is.
- Do use the shadcn components in `src/components/ui` and the tokens in `src/index.css`. Add a shadcn component with the CLI rather than hand-rolling one.
- Do write UI copy short and plain: say what happens ("Create it here, then send the agent a join command."), not how it feels.
- Do check both themes. Use semantic tokens (`bg-muted`, `text-muted-foreground`, `border`) so dark mode follows for free.
- Don't add borders around every element. A tint or spacing usually separates better.
- Don't use raw colors (`bg-red-50`, `#333`) or arbitrary font sizes in components.
- Don't put explanatory text in parentheses in labels. Use a placeholder or helper line.
- Don't use emoji or decorative icons. Icons are Lucide, 16px, and always paired with a label or an `aria-label`.
- Don't hide actions behind hover on touch screens. Hover-only reveals (revoke, unpin) are acceptable on desktop because the same actions exist elsewhere on mobile.
