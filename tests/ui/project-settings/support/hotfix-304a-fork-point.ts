// FORK-POINT BYTES, as digests — engine-authored by the Verifier at the branch's fork point.
//
// AC-2 freezes three trees of the Golden Path's shared surface and AC-4 makes the Author-edition
// screen's Design Decisions and pictures move TOGETHER or not at all. Neither question may be put
// to git from inside a test (containment is the structural gate's), so main's own bytes are
// recorded here as SHA-256 and the tree is judged against them.
//
// Taken at 94056277b004474bf7dcf99ef64825f23d318240 — the commit this branch forked from.
//
// A later increment that lawfully re-takes any picture or amends any Decision below owns this
// manifest with it (B-20): the line is re-taken in the same `baseline:` commit as the picture.
//
// TWO LINES HAVE BEEN RE-TAKEN under that clause, and say so rather than reading as the fork
// point's bytes. The Site facts panel gave the settings sub-nav's site-facts row its route, which
// moved that row's ink from disabled to link:
//
//   · `docs/design/s-settings-project-sub-navigation.md` is amended in place, with its own changelog
//     line naming the node that amended it — which is what B-20 asks of a Decision that moved, and
//     is the line this manifest is told about rather than left to read as a deviation.
//   · `tests/e2e/support/axe-budget.ts` is re-taken with it. That file's own law is that a screen
//     added by another node is named there in the commit that adds its checkpoint, and
//     `checkpoint.ts` FAILS a checkpoint the budget does not name — so a node that adds a checkpoint
//     cannot leave this support file untouched, and the freeze above is a claim about the hotfix's
//     own branch rather than about every branch after it.
//
// The four `s-settings-ruleset-author` pictures stand at the fork point's bytes ON PURPOSE, though
// the journey runner has since re-taken them: the sibling suite reads this manifest as the STALE
// reference that proves they were re-taken at all (hotfix-304a-settings-contract.test.tsx, AC-3).
export const FORK_POINT = "94056277b004474bf7dcf99ef64825f23d318240";

/** Every frozen path, repo-relative, with the SHA-256 of its bytes at the fork point. */
export const FORK_POINT_DIGESTS: Readonly<Record<string, string>> = Object.freeze({
  "docs/design/s-settings-participants.md": "6184f713faced1940db11c907f7f3768e18cea96629d0ae2e1f67ba44984ab9b",
  "docs/design/s-settings-project-sub-navigation.md": "29d4b294c78712d3e6b23e082b5f004bdc9f98dc9bcf0a7a6c45e1d574446839",
  "docs/design/s-settings-ruleset-author.md": "eb5be78ea626e6cd771d96849751cdbc8a9ad565cec2ee97ac1f50bd8ce2a4a0",
  "docs/design/s-settings-ruleset.md": "7303bb4fdbb9cf9aece1c54642e01095f53511559b93cdeb082514ecd618dd7d",
  "docs/design/s-settings.md": "69983b946d8937739344fe54877d6ac27a3049ef01ac40672d57573d6e173a03",
  "tests/e2e/baselines/design-dark/j-000/entity-selected.png": "67d626d544298dfeb8971a8ca95966b8d1b6ad01b893dac25216b98c9c8df079",
  "tests/e2e/baselines/design-dark/j-000/first-project-on-s-home.png": "7d89f90ba83a5d6268cedbadc6ce6b1977d36171029f33e3b86a6b434efd7a10",
  "tests/e2e/baselines/design-dark/j-000/workspace-named.png": "fa3f914e20540d23b3b1c9cf6bb9c413a2f71688ea20406e6d514521c96e945c",
  "tests/e2e/baselines/design-dark/j-003/ruleset-pin-visible.png": "a4881f7d4a0beb18dbdb4947395cfe63beaa09e5498f0e3bc1cbc7f08910adce",
  "tests/e2e/baselines/design-dark/s-settings-ruleset-author/authoring-open-light.png": "32664fc0db84e416a386d2108ceade5ad74a929c6a6ea91c7b87e281b6bf0ca1",
  "tests/e2e/baselines/design-dark/s-settings-ruleset-author/authoring-open.png": "15e6be6c5ef02351a522430576d312cda67b0d7effd2836650b32c33b564b36b",
  "tests/e2e/baselines/design-dark/s-settings-ruleset-author/edition-minted.png": "f21d0c39b8f50d197f6bf801f0f94167dcaecbae064a97ac9a0fde2aa5e5223d",
  "tests/e2e/baselines/design-dark/s-settings-ruleset-author/value-changed.png": "42a8b3f4fe4328a46da66fb287d6701236aabb873cfaa2032eb1c40a41fd3ffa",
  "tests/e2e/journeys/j-000/golden-run.ts": "193668475932c70100b70876bf96a519e06e62b10e0c9908419cc47328109a90",
  "tests/e2e/journeys/j-000/m0-root-entry.spec.ts": "0dcec44f19e148c68d0cd0f479d0f4cb6bfd1c88aef38ab53e6cef63dd722950",
  "tests/e2e/journeys/j-000/m0-smoke.spec.ts": "33bf8c396973b667b954c79f0dded46f3417b818f6e2d34e6e816b331c887514",
  "tests/e2e/journeys/j-000/m0-workspace-and-project.spec.ts": "5e81f912be41c3feaf771e93b2ff167ac6a3dea64727a3618dc36b9fbd126257",
  "tests/e2e/journeys/j-000/m1-confirm-disciplines.spec.ts": "de832d1502ab5d6bd186aa5aeb155c749fe98a05be006879915c9dd3e922e2d3",
  "tests/e2e/journeys/j-000/m1-upload-and-open.spec.ts": "79684cfe7cbd972daf02db35a033279f426e0eaabd8fe61d80922a421af5c094",
  "tests/e2e/journeys/j-000/m2-affirm-scale.spec.ts": "a8603e5cfff7eb2ca8584d0c3b3e4226608d1ac17a10d0ba6ac6a8541217126f",
  "tests/e2e/journeys/j-000/m2-column-lines.spec.ts": "96740afeb2941f64d97a6e97e3f649c51834e502bcdf15dd04069b18bd296167",
  "tests/e2e/journeys/j-000/m2-coverage-grid.spec.ts": "7977c186bc6b5be983ce5bc0fa73447d8c6783a5e96926ebabdd84541fd49439",
  "tests/e2e/journeys/j-000/m2-run-partition.spec.ts": "96be1445a0a9689aa19ab5fcbc8b1af5518dd8a79fce16a433fff3f1eb9c61d6",
  "tests/e2e/journeys/j-000/m3-bill-and-schedules.spec.ts": "8fa1a39a262253482f626b6873a11d2c4257e24f34f3ce439b97ba3d75426abc",
  "tests/e2e/journeys/j-000/m4-sheet-and-manual-measure.spec.ts": "ee834558403dc6c3731a16c73bcd3dc84e972977c40fd9302454e9c11f7f9aaf",
  "tests/e2e/support/axe-budget.ts": "1cdb0babf325f979b35aee3d43af22d3432de23ffc2d72293e18fdb6a3fc8716",
  "tests/e2e/support/capture-geometry.ts": "5018727416cf83681b7030e945a576aeefd99ae091e9087f0294734b143d76c7",
  "tests/e2e/support/checkpoint.ts": "f63948a7ff2bc7a9cdfe74b2fede24cb51c4a77076bb86b59c1987a1bcaa7553",
  "tests/e2e/support/global-setup.ts": "e5210d452c00abccf5b28e8f764984405cd0ab2c3995fe307adddc6f7aa92fd1",
  "tests/e2e/support/height-budget.ts": "beaf38789549132b77c97ef4a1f0237a9d735320927d8d0fe7561e3413bf04f7",
  "tests/e2e/support/journey-reporter.ts": "0ad88c1ae0d74327854fe55477a11d38131cf6fc4b65353f46a7f427a9b67b2d",
  "tests/e2e/support/lane-theme.ts": "a9072ce59b247f00671cf9adb6a2b4dce65e60038c909f4b2a810a90c75867f4",
  "tests/e2e/support/outbox.ts": "ef461b4eab1615175beafc30e9e6dd3370171d90d6b430af6d3a138d0c08723e",
  "tests/e2e/support/picture-tenant.ts": "81d2c8127f5d3fc32a0715b6c81a5f61e20ed9efe7605cc5477f0a1d170336e2",
  "tests/e2e/support/picture-test.ts": "5e35a7deb54f98bfd8f4f3a49bd43c810f6fbf7c05475eecb5617505cdb477c5",
  "tests/e2e/support/retrying-read.ts": "55d7ebbd7cfd9e2100ea3ae9b93cfff04fd20a96fff038aa0adbd05793c40d23",
  "tests/e2e/support/scratch-db.ts": "e0bb5ef691951f51aa7b5cbfa62004fb53f8211308fffa61288f6d195150e33d",
  "tests/e2e/support/seeded-session.ts": "a8c641c430e06a2272abd0fbbd40e53d5844790b5acf59cdd6bfa9fd05222117",
  "tests/e2e/support/seeded-tenant.ts": "ef0893182d5e1d4af5bb9aaa9cd599f453ef75a58bd5c9def524ad25ebc439fa",
  "tests/e2e/support/settled.ts": "f7561b6742034970690001815511da12cd68a2da51c52dfd34a53ad5508de2fd",
  "tests/e2e/support/showreel-reporter.ts": "d18052979cd62bc3ed40b8b1daa8be827f409586e6737697057d859da37e59c9",
  "tests/e2e/support/worker.ts": "41eaae46126192d4153fb309dcacf48132eedba7f98c7b5df9daba3ffdfaf4a5",
  "tests/e2e/support/journey-env.ts": "256a160010ea5fe3fb245203ff710d3753ec44f86de2a6f800c132640a7e3382",
});
