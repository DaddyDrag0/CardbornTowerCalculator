# Void Tower update: v51

Source: the user-provided October 5, 2026 update log and `225x Luck Cardborn RNG.rbxl`, place version 3786. The binary file's SHA-256 is recorded in `data/progression.json`. Script text was extracted for inspection; the attached scripts were not executed. The export has client scripts and replicated definitions, and explicitly omits server scripts.

## Calculator changes

- Import all 160 card definitions, images, rarity values, weather multipliers, and 140 Fabled descriptions from the new export. The ten additions are Verdant Worm, The Grand Contraption, Nihilus, Aurelion, the five Void World cards, and The Unwritten.
- Add the described normal and Fabled combat effects for those cards. Preserve the existing seeded damage-reduction shuffle, entry/death limits, and Void border.
- Add missing Fabled upgrades for Rift Dragon, Cosmic Dragon, Dread Lord, Arcane Overlord, World Eater, King of Yellow, and The Creator.
- Add a saved selector for 3–6 unlocked bans. Preserve the existing 10-ban Experimental mode, four presets, exported codes, and hidden bans when reducing the unlocked slot count.
- Load the update through the page, primary child worker, and legacy worker. Update cache/version strings together.
- Preserve current progression definitions in `data/progression.json`: six skill trees and their buffs, seven Transcendence nodes, both Grandmasteries, Abyss/Oblivion configuration, Tower/Void shops, 19 Index Sets, and 18 Personal Artifact stat definitions. Artifact slots now have a configured maximum of 11. The stat optimizer has not been started.
- Regression coverage confirms Ghostly Minions remain living combatants and never replace the saved four-card loadout. The omitted server fix itself cannot be audited here.

## Estimated Void Fracture values

The update log confirms **Shatter at three stacks**, but neither it nor the client export gives the new generic Fracture damage increase, healing reduction, Shatter damage amount/basis, or stack limit. On October 5, 2026, the user explicitly authorized releasing the calculator with reasonable estimates for the missing values.

The released estimates are **+10% damage taken and −10% healing per stack, 50% of the applying card's attack as base Shatter damage, and a five-stack cap**. These are provisional modeling choices, not values extracted from the game. The modest modifiers and attack-based burst keep the generic effect below the explicitly described card-specific Shatter strikes; the five-stack cap bounds retained stacks under Vaeloryn. None of that reasoning confirms the actual server behavior.

The simulation panel has an expandable notice showing these values and their estimated status. Public engine status also distinguishes estimated rules from confirmed mechanics. Tests and workers use the same released defaults without injecting replacement constants. Passing the tests verifies the implementation and worker agreement, not accuracy against the unavailable server formula. Replace these estimates if authoritative values become available.

## Interpretations requiring server or owner confirmation

- Nihilus' normal `CardModule` description has a third-turn burst and no recurring pulse. The normal fallback in `FabledAbilityText` also mentions 15% pulses. The draft follows the actual normal card description. Fabled pulses/burst/debuff are explicit.
- The Unwritten interprets “strongest” as HP + 2 × ATK, matching the exported Lucky Hand score. The server's ability-steal selection rule is absent.
- Vaeloryn's two-turn cooldown uses the battle's global turn count; ability cancellation is evaluated at the next applicable entry, turn, defense, attack preparation, or after-attack phase. Server timing/order is absent.
- Choir increases damage additively within its described cap. Orphax rounds transferred stacks down. Their server rounding, multiple-source interactions, and exact Shatter ordering are absent.
- Newly added Fabled Cosmic growth follows the existing fixed-baseline growth convention, with 40% ATK and 20% HP per Starfall-entry kill. Its description restricts the benefit to kills from that entry damage.
- The Void Shop text says an artifact slot also adds a lock, but the exported `GetMaxLockedStats` has no Tower-slot parameter. Extra locks and the ordering of Tower, artifact, Index Set, and skill tree bonuses remain unconfirmed.
- Roll speed 0.2s and the 1.25× Luck boost below 10M rolls are saved as update-log claims. They do not alter this combat simulator's battle-speed timing.

## Validation

Run `npm ci` and `npm test` with Node 24. Tests cover card/Fabled coverage, known combat changes, Void border persistence, 3–6 ban migration/presets, summon/copy behavior, visible estimate labeling, missing-configuration handling, the released Fracture defaults, and nine seeded page/worker comparisons. Browser checks also cover desktop/mobile layout, six-ban persistence, all four named Void cards, and actual child-worker runs with both regular and Void teams. GitHub Pages deployment waits for this test job.
