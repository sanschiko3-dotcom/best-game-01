// LUMENWARDEN v4 — "The Shattered Dawn" — main.ts
// The program that hands the game in (Node 22, standard library only).
// It copies this repository's game/ and screenshots/ beside it into
// /output and writes /output/dossier.json, the summary the judge reads,
// using the vendored make.fun library — exactly the shape the kit's
// starter uses, written here for this game. v4 adds the prism-mirror
// beam system (game/src/prism.js), the four relics (game/src/relics.js),
// Night 5 "The Shattered Dawn" with the Shattered Regent boss, two new
// enemies (Webweaver, Fuelmite), and a deeper workshop — the campaign
// now runs 30 waves over five nights before the endless deep.
// Outside the grader, MAKEFUN_OUTPUT_DIR stands in for /output:
//
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
//
// The program runs twice in the grader and both runs must write the
// same bytes: it only copies files and builds the dossier, so it does.

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Fail loudly instead of handing in an empty game: the files the
// gate requires outright are game/index.html and the two v4 system
// modules (prism mirrors and relics) — a v4 hand-in without them
// would be a v3 game wearing a v4 title.
if (!existsSync(join(here, 'game', 'index.html'))) {
  throw new Error('LUMENWARDEN v4: game/index.html is missing — refusing to hand in an empty game');
}
for (const mod of ['game/src/prism.js', 'game/src/relics.js']) {
  if (!existsSync(join(here, mod))) {
    throw new Error(`LUMENWARDEN v4: ${mod} is missing — the v4 systems are not built`);
  }
}

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The scorer's own caps: only text_max_bytes shapes the dossier bytes;
// the others refuse an entry the scorer would refuse (more than 4
// screenshots or one over 256 KiB; more than 993 files in game/ or
// 48 MiB of game files in all, or a path under game/ over 1000 bytes).
writeFileSync(
  join(out, 'dossier.json'),
  buildDossier(out, {
    text_max_bytes: 163840,
    screenshots: { max: 4, max_bytes: 262144 },
    game_max_files: 993,
    game_max_bytes: 50331648,
    game_path_max_bytes: 1000,
  }),
);
