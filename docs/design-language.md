# muninn design language: calm and plain

Chosen 2026-11-15 after several rounds on the canvas at https://claude.ai/artifact/4CWE1Rx61pzhKz5UhUjkYa. The rows there (default, quiet familiar, notebook, console) are kept for comparison. The console's physical touches (knob, paper receipt, glowing lights, raised keys) were tried and walked back: they added noise without adding meaning. What stays from that work is the behaviour: reasons, the speaks-up setting, fading, literal words.

## The idea

muninn watches your sessions, remembers what you taught your agents, decides when to speak up, and tells them, with your approval. The interface should feel like a calm assistant reporting back, not a dashboard.

It's grounded in Bruce Liu's *Beyond Taking Turns in Human-AI Interaction* (UCLA, 2026). muninn is proactive, persistent and runs alongside your chat, and his studies show the costs: people want different amounts of proactivity in different places, automatic actions feel less controllable, and busy screens distract. So every unprompted act is explained, the amount is a setting, and screens stay quiet.

## Rules

1. **Each screen answers "what am I looking at, and what do I do here?" in its first lines.** One heading, one sentence, then the content. At most one primary button per screen.
2. **Home is one next step.** The thing to do now (fix, review, first learn, or nothing to do), the last few things muninn told your agents, and one sentence about the week. Everything else lives on its own tab.
3. **Every act says why.** Anything muninn told an agent carries a "because …" line.
4. **Proactivity is a setting,** per repo, answering one question: *when should muninn speak up to your agents?* Only when asked, at session start, or whenever relevant. Shown as a plain dropdown, and as a sentence on Home. Internally `quiet`, `start`, `anytime`.
5. **Memory fades.** A lesson not told for two weeks moves to "Not needed lately" and is offered back, never deleted on its own.
6. **Flat and quiet.** Plain surfaces, thin borders, no gradients, shadows, textures, glows or metaphors (paper, knobs, stamps, handwriting). Nothing moves except a brief confirmation after you act.
7. **Literal beats clever.** Every label makes sense to someone seeing it for the first time. No figures of speech.
8. **Numbers live in sentences.** "None of the 3 problems you kept a lesson for came back", never a bare counter.

## Voice

| Say | Not |
| --- | --- |
| told your agents | delivered lessons |
| new lessons to review (agents aren't told until you keep one) | waiting for your word, proposed |
| keep / don't keep | remember / let it go, reject |
| the problem came back | came back, recurrence detected |
| every session / when a word comes up / only when searched | always-on / keyword / none |
| speaks up only when asked / at session start / whenever relevant | quiet / start / anytime |
| not needed lately | fading, stale |

## Tokens

| Token | Light | Dark | Use |
| --- | --- | --- | --- |
| bg | #F6F6F4 | #151619 | page |
| card | #FFFFFF | #1D1F24 | cards, header |
| line / line-strong | #E2E2DE / #CFCFCA | #2D2F37 / #3B3E49 | borders |
| ink / muted | #1C1D21 / #5E616B | #E8E9ED / #A2A5B0 | text |
| accent | #3546D8 | #8C98FF | links, the review count |
| signal | #B23E06 | #FF9C6E | only "a lesson didn't reach your agent" and "the problem came back" |

Primary buttons are solid ink. Everything else is outlined.

Type: IBM Plex Sans if installed, else the system font. Monospace only for lesson text being edited and for commands. No web fonts, so the page makes no requests off the machine.

## Surfaces

- **Web (`muninn ui`):** design C, "Switches", chosen by the author from three simple concepts (inbox, guided, switches) on the canvas's first page. One screen like phone settings, titled "What your agents know": **Suggested from your sessions** (Add, or × to dismiss; tap to change wording or when it's told first), **Your lessons** (an on/off switch each; off keeps the lesson but agents aren't told it; tap to edit or remove), and **Settings** for the repo as two switches: "Tell agents when a session starts" and "Tell agents mid-task too" (both off = only when asked). A **Plan for this branch** section (with a branch picker) sits between suggestions and lessons: goal, open items with round checkboxes, decisions and done folded away, "+ Add a next step". No tabs, no dashboard. The activity log and helped / wrong here live in the Claude Code panel; `muninn ask` stays in the terminal.
- **Claude Code panel (`mods/muninn-panel`):** plain terminal text in the same order and words: what it told your agent this session and why, the speaks-up setting, one lesson to review, what agents know, and a one-line week.
