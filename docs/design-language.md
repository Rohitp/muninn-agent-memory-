# muninn design language: the console, with restraint

Chosen 2026-11-15, after five rounds on the canvas at https://claude.ai/artifact/4CWE1Rx61pzhKz5UhUjkYa (row "The console, with restraint"). Earlier rows (default, quiet familiar, notebook) are kept there for comparison.

## The idea

muninn is a small, well-made instrument on your desk. It watches, remembers, decides when to speak, and tells your agents, with your approval. The design shows that behaviour, not memory as an image: it's not a notebook.

It's grounded in Bruce Liu's *Beyond Taking Turns in Human-AI Interaction* (UCLA, 2026). muninn is proactive, persistent and runs in parallel with your chat, and his studies show what that costs: people want different amounts of proactivity in different places, automatic actions feel less controllable, and moving things distract. So every unprompted act is visible and explained, the amount is on a dial, and the screen stays still.

## Rules

1. **Every act says why.** Anything muninn told an agent carries a "↳ because …" line. This is the signature element on every surface.
2. **The amount is on a dial,** per repo, answering one question: *when should muninn speak up to your agents?* **Only when asked** (never on its own), **at session start** (every-session lessons and the handoff, then silence), **whenever relevant** (also mid-task, on a word or a failed command). The current setting is always shown with its one-line meaning, never as a bare word. Internally these are `quiet`, `start`, `anytime`.
3. **Stillness.** Nothing moves unless muninn acted. One light, one short arrival, then still.
4. **Memory fades visibly.** A lesson agents keep using stays lit; one not told for 14 days fades and is offered back, never deleted on its own.
5. **Roughly 80% flat, 20% physical.** Everything you read is flat and sharp. Only four things are physical:
   - **The dial:** a small matte knob with an orange pointer.
   - **The light:** a blue dot that glows when muninn has just told an agent something.
   - **The receipt:** the log of what muninn told agents, printed as a paper strip with a torn top edge, in monospace.
   - **Keys:** main buttons have a little depth and press down.
6. **No handwriting, textures or ruled lines.** These were tried and made text harder to read.

## Voice

Plain, short, about what happened. muninn reports back.

| Say | Not |
| --- | --- |
| told your agents | delivered lessons |
| waiting for your word | proposed |
| remember / let it go | keep / reject (the CLI keeps these words) |
| came back | recurrence detected |
| every session / when a word comes up / only when searched | always-on / keyword / none |
| speaks up only when asked / at session start / whenever relevant | quiet / start / anytime |
| fading | stale |

## Tokens

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| bg | #ECEDEA | #141519 | page |
| surface / card | #F7F7F5 / #FFFFFF | #1B1D22 / #1F2127 | panels, cards |
| line | #DADBD6 | #2C2E36 | rules, borders |
| ink / muted | #1C1D21 / #5E616B | #E8E9ED / #A2A5B0 | text |
| eye (muninn) | #4C5BFF | #6E7DFF | the light, lit dots, "because" in the terminal |
| signal | #E8550F (text #B23E06) | #FF7A3D | "came back" only, and the dial pointer |
| paper | #FFFFFF | #F3F2EE | the receipt stays paper in dark mode |

Type: IBM Plex Sans for reading, IBM Plex Mono for the receipt, times, numbers and labels. Neither is loaded from the web: the page makes no requests off the machine, so it uses Plex if installed, else the system fonts. Numbers in counters are zero-padded (034).

Dots: ● lit (told every session), ○ armed (told when its word comes up), grey (fading).

## Surfaces

- **Web (`muninn ui`):** Home (counters, the receipt, waiting, came back, what agents carry), Review (one card at a time, a three-way switch for how agents are told, three big keys K, L, R), Memory (grouped by how agents are told, with fading last), Ask (answer first, then sources).
- **Claude Code panel (`mods/muninn-panel`):** the same receipt as terminal text in a dashed box, the dial as words with the current one bracketed, the same dots. A terminal can't draw materials, so the physical touches become their text equivalents.
