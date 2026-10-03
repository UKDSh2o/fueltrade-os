# Brag Plan: FuelTrade OS

## What is this app?
A deal command centre for physical fuel trading: model landed economics on a cargo, run due diligence, collect approvals and keep the paper trail, all in one audited screen.

## The angle
Everyone else in fuel trading runs a $23M cargo from spreadsheets and email threads. FuelTrade OS puts the whole deal on one screen, and the brag is the discipline: the profit number is real, and nothing moves without a recorded sign-off. Calm, expensive-feeling, no jokes: the numbers are the flex.

## Hook (first 2-3 seconds)
Dark navy, a single route line draws FUJ -> CMB with the cargo label "25,000 MT Jet A-1". Line: "$23.4M of jet fuel. One screen." (holds ~1.8s, lands on the 4.23s strong beat).

## Key moments (the middle)
- Trade model: sale price field gets typed to 936 $/MT; cost lines stack (freight 48, inspection 1.85, port 7.4, storage 4.8, legal 0.8) and Net trade profit counts up to $1,765,552 / 7.55% net margin; margin bar fills; risk badge reads "Controlled" (18).
- Deal control gate: due-diligence checks tick green one by one (Sanctions, KYC, Vessel, Insurance), then the approval chain shows two distinct approvers.
- Command Centre lenses: Trader, Legal, Vessel captain, Port operator, Finance, Administrator slide in as a row.

## Outro / punchline
"Every approval on record." then the FuelTrade OS mark and the app's own line "Make faster decisions." Brief silence on the last frame.

## User flow worth showing
Entry -> key action -> result:
1. Open the active model (FT-2026-0018, Jet A-1, Fujairah -> Colombo, 25,000 MT, CIF).
2. Edit the sale price in the Trade model panel; economics recompute live.
3. Net profit + margin + risk score land; then the control gate and approval chain clear it.
All numbers come from `calculateTrade(initialTrade)` in the repo (seed data, fictional deal), so they are true to the product.

## Tone
- Preset: polished
- Creative direction: quiet premium product film, finance-terminal confidence
- Interpretation: slow reveals, long holds, mixed-case light type, soft crossfades; restraint is the flex, the profit counter is the single loud moment.

## Format: landscape - 1920x1080
## Duration: 21 seconds

## Visual identity (from the project)
- Background: #07111f (panel #0c1a2b, line #1b2d43)
- Accent: #2fd8d0 cyan (gradient #4ce0d3 -> #22a9db); positive/profit green #36d697
- Text: #dce7f3 (muted #718399)
- Display font: Manrope (700-800)
- Body font: DM Sans (400-600)
- Strongest visual element: the Trade model panel with the net-profit metric, margin bar and route line port chips (FUJ -> CMB).

## Share copy (draft)
25,000 MT of Jet A-1, Fujairah to Colombo: $1.77M net, 7.5% margin, every approval on record. This is FuelTrade OS.

## Audio direction
- Role: sparse professional accents over a warm, low bed
- Music: bundled "Happy Beats / Business Moves vol. 9" (~114.8 BPM, cleanest cue grid)
- Music treatment: start at 0s, low-to-moderate volume, 1s fade-in, fade out over final 2s into the silent end card
- Music cue guidance: preset read. Strong cues at 4.23s (scene 2 reveal), 6.34s (profit counter start), 10.54s (control gate), 12.65s; beat grid ~0.52s. Sequential text items snap to every other beat (~1.05s) so each holds the reading floor.
- Audio-reactive treatment: subtle; bass energy gently lifts the cyan glow behind the profit figure. No waveform bars.
- SFX posture: sparse, motion-matched (typing ticks, soft UI clicks on each check, one low hit on the profit landing)
- Audio-coupled moments: price typing, profit count-up, check-by-check ticks
- Restraint rule: no risers, no whooshes on every cut, never louder than the music bed.

Music license: bundled tracks carry an unverified license note in the skill's README. Confirm terms before posting publicly.

## Storyboard

### Scene 1 - Hook - 4.2s
Navy field, faint grid. A cyan route line draws FUJ -> CMB with port chips; cargo chip "25,000 MT Jet A-1" appears. Headline types: "$23.4M of jet fuel. One screen." (about 7 words, settled hold ~2.1s).
Sequential/interaction: yes - headline types out character by character, then holds.
Audio intent: calm, confident opening.
Audio-coupled idea: subtle key ticks on typing.
Music: warm bed fades in.
Transition mood: soft crossfade -> Scene 2

### Scene 2 - The economics - 6.3s
Recreated Trade model panel for FT-2026-0018. Cursor clicks "Sale price", types 936. Cost rows (Freight 48, Inspection 1.85, Port 7.4, Storage 4.8, Legal 0.8 $/MT) slide in; "Net trade profit" counts up to $1,765,552 with "7.55% net margin"; margin bar fills; risk badge "Controlled". Settled hold of final numbers >= 1.5s.
Sequential/interaction: yes - simulated click and typing, then cost rows one by one (accents, not read-critical), then counter.
Audio intent: precision, then a quiet payoff.
Audio-coupled idea: click, typing ticks, count-up, one low hit on landing at ~6.34s.
Music: bed steady.
Transition mood: slide -> Scene 3

### Scene 3 - The control gate - 6.3s
Title "Nothing moves without sign-off." Four check chips tick green one at a time, ~1.05s apart: Sanctions screening, KYC, Vessel, Insurance. Then the approval chain: two distinct approver avatars (fictional, initials only) turn green and a status reads "Approved".
Sequential/interaction: yes - chips tick every other beat; each label holds ~1.0s+ after settling; final status holds ~1.2s.
Audio intent: trust accumulating.
Audio-coupled idea: soft tick per check, slightly warmer tick on Approved.
Music: bed steady.
Transition mood: soft crossfade -> Scene 4

### Scene 4 - Outro - 4.2s
Six lens pills slide in as a row: Trader, Legal, Vessel captain, Port operator, Finance, Administrator. Then clear to the FuelTrade OS mark (cyan gradient tile) and "Every approval on record." with the app's line "Make faster decisions." beneath. Final frame holds ~1.2s with music faded out.
Sequential/interaction: lens pills staggered quickly (decoration; the end card is the read).
Audio intent: resolution, then silence.
Audio-coupled idea: none.
Music: fade out over final 2s.
Transition mood: end

**Music mood for this video:** warm, restrained, corporate-but-premium
**Audio summary:** a low warm bed, typing and click accents in the middle, one low hit on the profit landing, fading to silence on the end card.

Scene total: 4.2 + 6.3 + 6.3 + 4.2 = 21.0s

Safety check: no secrets, owner email, live URL, or real deal data used. Deal FT-2026-0018 is the repo's seed model; approver names are initials only.
