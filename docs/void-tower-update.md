# Void Tower update: v51 draft

Source: the user-provided October 5, 2026 update log and `225x Luck Cardborn RNG.rbxl`, place version 3786. The binary file's SHA-256 is recorded in `data/progression.json`. Script text was extracted for inspection; the attached scripts were not executed. The export has client scripts and replicated definitions, and explicitly omits server scripts.

## Calculator changes

- Import all 160 card definitions, images, rarity values, weather multipliers, and 140 Fabled descriptions from the new export. The ten additions are Verdant Worm, The Grand Contraption, Nihilus, Aurelion, the five Void World cards, and The Unwritten.
- Add the described normal and Fabled combat effects for those cards. Preserve the existing seeded damage-reduction shuffle, entry/death limits, and Void border.
- Add missing Fabled upgrades for Rift Dragon, Cosmic Dragon, Dread Lord, Arcane Overlord, World Eater, King of Yellow, and The Creator.
- Add a saved selector for 3–6 unlocked bans. Preserve the existing 10-ban Experimental mode, four presets, exported codes, and hidden bans when reducing the unlocked slot count.
- Load the update through the page, primary child worker, and legacy worker. Update cache/version strings together.
- Preserve current progression definitions in `data/progression.json`: six skill trees and their buffs, seven Transcendence nodes, both Grandmasteries, Abyss/Oblivion configuration, Tower/Void shops, 19 Index Sets, and 18 Personal Artifact stat definitions. Artifact slots now have a configured maximum of 11. The stat optimizer has not been started.
- Regression coverage confirms Ghostly Minions remain living combatants and never replace the saved four-card loadout. The omitted server fix itself cannot be audited here.

## Required before release

The update log confirms **Shatter at three stacks**, but neither it nor the client export gives the new generic Fracture damage increase, healing reduction, Shatter damage amount/basis, or stack limit. `VOID_FRACTURE_RULES` leaves those fields unset. World 8 battles stop with a clear error instead of producing numbers from invented constants. The UI states that World 8 values are pending.

The tests use synthetic Fracture values solely to exercise the control flow. Passing those tests does not verify the missing game constants. The draft must not be merged or deployed until the actual values and mechanics are confirmed and exercised again.

## Interpretations requiring server or owner confirmation

- Nihilus' normal `CardModule` description has a third-turn burst and no recurring pulse. The normal fallback in `FabledAbilityText` also mentions 15% pulses. The draft follows the actual normal card description. Fabled pulses/burst/debuff are explicit.
- The Unwritten interprets “strongest” as HP + 2 × ATK, matching the exported Lucky Hand score. The server's ability-steal selection rule is absent.
- Vaeloryn's two-turn cooldown uses the battle's global turn count; ability cancellation is evaluated at the next applicable entry, turn, defense, attack preparation, or after-attack phase. Server timing/order is absent.
- Choir increases damage additively within its described cap. Orphax rounds transferred stacks down. Their server rounding, multiple-source interactions, and exact Shatter ordering are absent.
- Newly added Fabled Cosmic growth follows the existing fixed-baseline growth convention, with 40% ATK and 20% HP per Starfall-entry kill. Its description restricts the benefit to kills from that entry damage.
- The Void Shop text says an artifact slot also adds a lock, but the exported `GetMaxLockedStats` has no Tower-slot parameter. Extra locks and the ordering of Tower, artifact, Index Set, and skill tree bonuses remain unconfirmed.
- Roll speed 0.2s and the 1.25× Luck boost below 10M rolls are saved as update-log claims. They do not alter this combat simulator's battle-speed timing.

## Validation

Run `npm ci` and `npm test` with Node 24. Tests cover card/Fabled coverage, known combat changes, Void border persistence, 3–6 ban migration/presets, summon/copy behavior, missing-value handling, and nine seeded page/worker comparisons. Local browser checks also cover desktop/mobile layout, six-ban persistence, and an actual child-worker run. GitHub Pages deployment waits for this test job.
