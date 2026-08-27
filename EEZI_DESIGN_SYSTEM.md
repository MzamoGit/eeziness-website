# Eezi Design System — Version 1.0

**Status:** Canonical design standard for all Eezi products  
**Owner:** Eezi / Nasela Capital product family  
**Effective:** 27 August 2026

## 1. Purpose

The Eezi family must look and behave like one product ecosystem, not a collection of unrelated apps. Every Eezi product must use this system by default. Product-specific identity may appear through a restrained accent colour, iconography and product name, but the structural visual language remains shared.

## 2. Core visual principles

1. **White first.** Application canvases are pure white. Do not use blue-grey, beige, gradient or tinted page backgrounds.
2. **Crisp hierarchy.** High-contrast dark text on white surfaces. Avoid low-contrast pastel text.
3. **Navy carries structure.** Headers, side navigation, strong headings and structural controls use Eezi Navy.
4. **Orange carries energy.** Eezi Orange is used for active states, progress, important highlights, focus and selected navigation. It must feel vivid, not washed out.
5. **Colour is deliberate.** Product accent colours may support charts, status or product identity, but must not flood the interface.
6. **Panels are secondary.** Light grey may be used inside contained secondary panels only. Never use it as the main page canvas.
7. **One interaction language.** Buttons, tabs, cards, alerts, fields, spacing and typography should behave consistently across all Eezi products.
8. **Mobile is first-class.** No overlapping cards, hidden actions or horizontal workflow breakage.

## 3. Canonical colour tokens

| Token | Value | Use |
|---|---|---|
| Eezi White | #FFFFFF | Page canvas, cards, inputs |
| Eezi Navy | #173F70 | Primary structure, headings, navigation |
| Eezi Navy Dark | #102F57 | Hover/pressed structural states |
| Eezi Orange | #F58220 | Active state, progress, highlight, focus |
| Eezi Orange Dark | #DF7014 | Orange hover/pressed |
| Eezi Ink | #243447 | Primary body text |
| Eezi Muted | #667085 | Secondary text |
| Eezi Line | #DFE5EB | Borders and separators |
| Eezi Soft | #F7F8FA | Secondary contained panels only |
| Success | #23845F | Positive status |
| Warning | #D99319 | Warning status |
| Danger | #B42318 | Error/destructive status |
| Teal | #0D7E72 | Optional semantic/product accent |

## 4. Surface rules

### Page canvas
- Always #FFFFFF.
- No full-page blue-grey tint.
- No decorative gradients behind operational forms/workflows.

### Cards
- White background.
- 1px Eezi Line border.
- 14–18px radius depending on density.
- Subtle shadow only where separation is needed.
- Do not stack multiple tinted cards inside one another without a functional reason.

### Secondary panels
- Eezi Soft may be used for explanatory content, read-only values or grouped metadata.
- The panel must remain inside a white page.

## 5. Typography

- UI family: Arial / Inter / system sans-serif.
- Primary text colour: Eezi Ink.
- Major page heading: 28–34px desktop, 24–28px mobile.
- Section heading: 18–22px.
- Body: 14–16px.
- Helper text: 12–13px.
- Avoid oversized marketing typography inside operational applications.
- Use bold weight for decisions and labels, not for every sentence.

## 6. Navigation

### Side navigation
- Deep navy background.
- White labels.
- Active item: Eezi Orange treatment or orange indicator.
- Product name/logo at top.
- User/company context visible but visually secondary.

### Workflow tabs
- White or navy structural container.
- Active step clearly marked with orange.
- Completed steps use success only where completion is meaningful.
- Horizontal overflow must be handled intentionally on smaller screens.

## 7. Buttons

### Standard primary action
- Eezi Navy background, white text.
- Hover: Eezi Navy Dark.
- Used for normal workflow actions: Continue, Save, Generate, Review.

### Emphasis / active action
- Eezi Orange may be used for the single highest-attention action on a screen, active navigation and progress.

### Secondary
- White background, Eezi Navy text, Eezi Line border.

### Destructive
- Danger red only.

Do not have multiple visually competing “primary” buttons in the same action group.

## 8. Form controls

- White background.
- 1px neutral border.
- Minimum 44px touch height for primary inputs.
- Focus ring: Eezi Orange.
- Labels above fields.
- Read-only values should still be high contrast.
- Do not use greyed-out backgrounds for normal editable fields.

## 9. Status language

- Success: green.
- Warning/needs attention: amber.
- Error/blocking: red.
- Informational: navy/neutral.
- Do not use colour alone; always include plain-language status text.

## 10. AI assistants

All “Ask Eezi…” assistants use the same shell:
- White conversation body.
- Navy header.
- Orange or product-accent AI mark.
- Clear user/assistant message separation.
- Answers must be substantive; navigation suggestions are secondary.
- Same-language response by default when multilingual capability is enabled.

## 11. Empty states and guidance

- Explain what the user can do next.
- Keep empty states on white.
- Use one simple icon/mark, one concise explanation and one clear action.
- Never use filler content merely to occupy space.

## 12. Product accents

Each product may define one accent token for charts, small identifiers or product-specific semantic cues. The accent does not replace Eezi Navy or Eezi Orange for the core interaction system.

## 13. Accessibility

- Maintain WCAG AA text contrast wherever practical.
- Keyboard focus must be visible.
- Buttons and fields must have accessible names.
- Do not encode status by colour alone.
- Mobile controls must remain tappable and unobscured.

## 14. Prohibited patterns

- Bluish-grey full-page canvases.
- Pastel gradients behind operational workflows.
- Multiple unrelated primary colours on one screen.
- Pale grey body text on tinted backgrounds.
- Oversized fonts that reduce usable workspace.
- Floating panels that obscure required controls.
- Product-specific button/nav conventions that conflict with the Eezi standard.
- “Design by patch”: new components must use the canonical tokens.

## 15. Implementation rule

Every Eezi repository must declare conformance to **Eezi Design System v1.0** and implement the canonical tokens. New products must start from these tokens rather than creating a new palette.

Any intentional deviation must be documented as a product-specific exception.
