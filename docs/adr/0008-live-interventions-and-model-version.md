# ADR-0008: Live interventions and model version

- Status: Accepted. The owner accepted the 1.0 renewal design and its decisions on 2026-10-26 ([RENEWAL-1.0.md §12](../design/RENEWAL-1.0.md#12-owner-decisions)). The compatibility rule in §6 (a page meeting a link of a model version it does not run) was added during implementation (#124) and is not part of that decision record.
- Date: 2026-10-26
- Issue: #124
- Design: [docs/design/RENEWAL-1.0.md §10.1–§10.4](../design/RENEWAL-1.0.md#10-technical-plan)
- Amends: [ADR-0003](0003-no-backend-url-sharing.md)

## Context

ADR-0003 says that because the seed is in the link, "the shared link reproduces identical results". That holds only while the model never changes. The classic engine is frozen (ADR-0007), so v1 and v2 links keep that promise. The free engine is still provisional, and 1.0 brings changes that alter its results:

- Live variable cards (renewal §4.3) change a battle while it runs. A link must replay the same cards at the same ticks with the same effects, even after a card is retuned.
- A later retune of the mass-rout cascade (owner decision R4 (a), after 1.0) changes who wins some matchups.
- Calibration (FREE-MATCHUPS §8 P8) may change presets and constants.

A v3 link (`#s=` with `m: "free"`) carries no model version. After any such change it would open with different numbers and nothing would say so. Result links carry a snapshot, and the `chk=` reproduction check reports a difference for them, but plain settings links change silently.

## Decision

1. **Model version `mv`.** A positive integer names the behaviour of the free engine and, from M3, of the variable-card catalogue. Free-model payloads carry it: the v3 config of `#s=` links and `TVT3-` codes, and the `c` of free result links (result format v2, later v3).
2. **An absent `mv` means 1.** Every free link made before this ADR is a version 1 link and stays one. Encoders omit `mv` while it is 1, so links made before and after this ADR are byte-identical.
3. **ADR-0003 is amended.** "The shared link reproduces identical results" now reads "the shared link reproduces identical results **per model version**": a free link reproduces bit for bit under the `mv` it names (within one JavaScript engine, MODEL.md §2.2). Classic links have no `mv` and are unaffected.
4. **When `mv` increments.** Any change to the free engine or to the card catalogue that alters any result (any golden, any run of any config) is a new `mv`. A change that keeps every result bit-identical (a refactor, an empty intervention hook) keeps the version.
5. **Old versions stay reproducible where possible.**
   - A constant-only retune keeps a constants table per `mv`, so old links run with their own constants.
   - The variable-card catalogue is keyed by `mv` (`CARDS_BY_MV`). The intervention log stores card codes, not raw effects. Card codes are append-only indices. Retuning a card is a new `mv` with the old catalogue kept.
   - A structural change that cannot keep the old behaviour opens old links with a "made with model vN" note. Links that carry a summary are also flagged by the existing `chk=` check.
6. **A page built from this ADR on that does not know a link's `mv`** (a newer link opened in an older, cached page) never presents that link under its own model. Proposed, pending owner confirmation (see Status).
   - A free result link is rejected as a `version` error, without **Run it yourself**.
   - A settings link opens the free model at its defaults; the link's settings are not applied. Values defined under an unknown model cannot be read safely, so the existing rule for settings payloads (malformed input yields the defaults) applies to the whole payload.
   - Only an integer `mv` above the newest version the build runs is a newer model. For such a link the simulator keeps the address until the user edits something, and a note says that the link was made with a newer model and that reloading opens it. Reloading loads the current build, which knows the version, and the kept address opens the link there.
   - Any other `mv` the build does not run (0, a negative or fractional number, a string, `null`) is malformed, and no build will ever run it. It opens the defaults like any malformed payload: the address is rewritten and no note is shown.
   - A newer model's `TVT3-` code or settings link pasted into the import field is refused: nothing is applied, and the field says that the code was made with a newer model and that it opens after a reload. The import never reports the defaults as the pasted settings.
   - Builds up to v0.2.16 predate this rule: they ignore `mv` and run such a link under model 1 with its settings, and accept a newer free result link as valid. Pages already in a cache cannot be changed.
7. **Live interventions are a free-engine feature.** The classic engine gets no live mode.
   - The log is a list of `[tick, card, side]` entries (at most 64, sorted by tick) in the link's optional `live` field. It is applied at the top of the tick loop, and trait effects are recomputed from base values on every start or expiry, never reverted.
   - No card draws random numbers in 1.0. Future randomized cards use a new stream. The branch hook for the live win chance reseeds only when it is set.
   - With an empty log the hook takes no branch, draws no random number and changes no arithmetic, so every result stays bit-identical and `mv` stays 1.
8. **Goldens.** No golden fixture is ever regenerated. The social-species golden (`tests/free-golden-social.test.ts`) joins the free golden before any engine change of the renewal, so the pack-buff layer is pinned for `mv` 1 as well.

## Alternatives considered

- **Bump the payload version `v` instead.** `v` describes the link format, not the model. A format change (adding `live`) and a model change (a retune) happen independently, and one number for both would force a format bump for every retune. Rejected.
- **Write `mv: 1` into every new link.** It changes the bytes of every free link made from now on for no gain, because absent already means 1. Rejected.
- **Store the raw card effects in the log.** Old links would keep their effects without a catalogue, but each entry would have to carry every op and magnitude, and the engine would have to trust them. Rejected: the log stores codes, and the catalogue for the link's `mv` defines and bounds the effects.

## Consequences

- Every existing free link keeps decoding and reproducing exactly as before.
- A change that alters free results costs a version bump and, where possible, the old constants or catalogue kept beside the new ones. Reviews check the free goldens to decide whether a bump is due.
- An older cached page built from this ADR on cannot open a link from a newer model. It shows the free defaults with a note, refuses a pasted code with a note, or shows the invalid-link message, instead of different numbers. A page built up to v0.2.16 ignores `mv` and shows such a link's numbers under model 1.
- Viewer names are never encoded in links (owner decision R9).
