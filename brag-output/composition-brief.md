# Hyperframes Composition Brief: FuelTrade OS

## Objective
Create a short launch-style brag video for FuelTrade OS.

## Output
- Composition directory: `brag-output/composition/`
- Rendered video: `brag-output/brag.mp4`
- Format: landscape - 1920x1080
- Duration: 21 seconds

## Source Material
- Project root: /home/user/fueltrade-os
- Primary files read: README.md, app/dashboard.jsx, app/command-dashboard.jsx, app/data.js, app/calculate.js, app/fueltrade.css, lib/dashboard-layout.js, docs/ROADMAP.md
- Product name: FuelTrade OS
- Tagline / strongest claim: "Trade intelligence" / "Model landed economics, compare exposure and make faster decisions."
- Key UI moment to recreate: Trade model panel (sale price edit -> cost rows -> Net trade profit metric, margin bar, risk badge), then Deal control gate and Approval chain
- Copy that must appear verbatim:
  - "$23.4M of jet fuel. One screen."
  - "Nothing moves without sign-off."
  - "Every approval on record."
  - "Make faster decisions."
  - Net trade profit $1,765,552 / 7.55% net margin / Risk Controlled (computed from calculateTrade on seed deal FT-2026-0018)

## Creative Direction
- Tone preset: polished
- Creative direction: quiet premium product film, finance-terminal confidence
- Interpretation: slow reveals, long holds, soft crossfades; the profit counter is the single loud moment
- Angle: spreadsheets and email threads vs one audited screen; the numbers are the flex
- Hook: route line FUJ -> CMB draws, headline types "$23.4M of jet fuel. One screen."
- Outro / punchline: "Every approval on record." then the mark and "Make faster decisions."
- Avoid: generic SaaS language; abstract filler; redesigning the app's look; any real names/emails/URLs

## Visual Identity
- Background: #07111f (panel #0c1a2b, line #1b2d43)
- Text: #dce7f3 (muted #718399)
- Accent: #2fd8d0 cyan, gradient #4ce0d3 -> #22a9db; green #36d697
- Display font: Manrope 700/800 (local woff2)
- Body font: DM Sans 400-600 (local woff2)
- Visual references: Trade model panel, metric tile with green tone, margin bar, port chips, sidebar brandmark tile

## Storyboard
Use `brag-output/brag-plan.md`. Scenes: 1 Hook 4.2s, 2 Economics 6.3s, 3 Control gate 6.3s, 4 Outro 4.2s (crossfaded, ~0.3s overlaps).

## Audio
- Audio role: sparse professional accents over a warm low bed
- Music: happy-beats-business-moves-vol-9 (114.84 BPM)
- Music treatment: 1s fade-in, ~0.45 level, fade to 0 over final 2s
- Music cue guidance: bundled preset. Strong cues 4.23, 6.34, 10.54, 12.65s; beat grid ~0.52s. Lock 4.23 (scene 2 reveal), 6.34 (profit counter), 10.54 (control gate). Sequential text on every other beat.
- Audio-reactive: subtle (bass lifts the cyan glow behind profit figure); skipped if extraction unavailable
- Audio-coupled moments: headline typing (keyboard), price typing, profit count-up + low hit, check ticks
- SFX: low-HF-risk picks from sfx-analysis.md (click_002/003/005, impactSoft_medium, bong_001 sparingly)
- Audio files copied into `composition/assets/`.

## Hyperframes Instructions
Domain skills loaded: hyperframes-core, -animation, -creative, -keyframes, -cli (+ -audio for fades). Not using the generic promo workflow. Gate: `hyperframes check` with zero errors before render. Local render only.
