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
export const FORK_POINT = "94056277b004474bf7dcf99ef64825f23d318240";

/** Every frozen path, repo-relative, with the SHA-256 of its bytes at the fork point. */
export const FORK_POINT_DIGESTS: Readonly<Record<string, string>> = Object.freeze({
  "docs/design/s-settings-participants.md": "6184f713faced1940db11c907f7f3768e18cea96629d0ae2e1f67ba44984ab9b",
  "docs/design/s-settings-project-sub-navigation.md": "7c4fa29323f0daa48cf2fac634f2eda26baca6859be6a2b75ce7a88a54b1a1b4",
  "docs/design/s-settings-ruleset-author.md": "eb5be78ea626e6cd771d96849751cdbc8a9ad565cec2ee97ac1f50bd8ce2a4a0",
  "docs/design/s-settings-ruleset.md": "7303bb4fdbb9cf9aece1c54642e01095f53511559b93cdeb082514ecd618dd7d",
  "docs/design/s-settings.md": "69983b946d8937739344fe54877d6ac27a3049ef01ac40672d57573d6e173a03",
  "tests/e2e/baselines/design-dark/j-000/entity-selected.png": "ce6a00409fe73b36c418bf2fe6b5b35f5ea5f8eb18aa8036d0b76b0c3ea4ba5a",
  "tests/e2e/baselines/design-dark/j-000/first-project-on-s-home.png": "e46bded0d311a745786150623d51f4c923590c555d513d47a9e0b5cb4e67ff8b",
  "tests/e2e/baselines/design-dark/j-000/workspace-named.png": "31c4adf8adba9889a8965ec9f90cd25a53b1659a600a44040fed90392f6d47b9",
  "tests/e2e/baselines/design-dark/j-003/ruleset-pin-visible.png": "a4881f7d4a0beb18dbdb4947395cfe63beaa09e5498f0e3bc1cbc7f08910adce",
  "tests/e2e/baselines/design-dark/s-settings-ruleset-author/authoring-open-light.png": "32664fc0db84e416a386d2108ceade5ad74a929c6a6ea91c7b87e281b6bf0ca1",
  "tests/e2e/baselines/design-dark/s-settings-ruleset-author/authoring-open.png": "15e6be6c5ef02351a522430576d312cda67b0d7effd2836650b32c33b564b36b",
  "tests/e2e/baselines/design-dark/s-settings-ruleset-author/edition-minted.png": "f21d0c39b8f50d197f6bf801f0f94167dcaecbae064a97ac9a0fde2aa5e5223d",
  "tests/e2e/baselines/design-dark/s-settings-ruleset-author/value-changed.png": "42a8b3f4fe4328a46da66fb287d6701236aabb873cfaa2032eb1c40a41fd3ffa",
  "tests/e2e/journeys/j-000/golden-run.ts": "64051dd6489980cbfaf3dae886a335ebb90a7dbbbba6f7d8c7c0ed60a6cda093",
  "tests/e2e/journeys/j-000/m0-root-entry.spec.ts": "0dcec44f19e148c68d0cd0f479d0f4cb6bfd1c88aef38ab53e6cef63dd722950",
  "tests/e2e/journeys/j-000/m0-smoke.spec.ts": "33bf8c396973b667b954c79f0dded46f3417b818f6e2d34e6e816b331c887514",
  "tests/e2e/journeys/j-000/m0-workspace-and-project.spec.ts": "5e81f912be41c3feaf771e93b2ff167ac6a3dea64727a3618dc36b9fbd126257",
  "tests/e2e/journeys/j-000/m1-confirm-disciplines.spec.ts": "de832d1502ab5d6bd186aa5aeb155c749fe98a05be006879915c9dd3e922e2d3",
  "tests/e2e/journeys/j-000/m1-upload-and-open.spec.ts": "79684cfe7cbd972daf02db35a033279f426e0eaabd8fe61d80922a421af5c094",
  "tests/e2e/journeys/j-000/m2-affirm-scale.spec.ts": "48e09819cb222ce1a0cced3429bf6d48d9ffd27e8abf26363addd43bd010c3c4",
  "tests/e2e/journeys/j-000/m2-column-lines.spec.ts": "9cf37bf6debae7056000498d001f9cb6e55e58cc4e6213cbcb397c2a32b5b0fd",
  "tests/e2e/journeys/j-000/m2-coverage-grid.spec.ts": "1be8d4c221f7208be85f9353e41e6d007cd9ee05c891fed9b246aefa5aa8308a",
  "tests/e2e/journeys/j-000/m2-run-partition.spec.ts": "96be1445a0a9689aa19ab5fcbc8b1af5518dd8a79fce16a433fff3f1eb9c61d6",
  "tests/e2e/journeys/j-000/m3-bill-and-schedules.spec.ts": "8fa1a39a262253482f626b6873a11d2c4257e24f34f3ce439b97ba3d75426abc",
  "tests/e2e/journeys/j-000/m4-sheet-and-manual-measure.spec.ts": "ee834558403dc6c3731a16c73bcd3dc84e972977c40fd9302454e9c11f7f9aaf",
  "tests/e2e/support/axe-budget.ts": "d46134f7e2bd3c5e9b6da88c5f11e0aa5533d604364efec2afe5195b343648c1",
  "tests/e2e/support/capture-geometry.ts": "5018727416cf83681b7030e945a576aeefd99ae091e9087f0294734b143d76c7",
  "tests/e2e/support/checkpoint.ts": "f63948a7ff2bc7a9cdfe74b2fede24cb51c4a77076bb86b59c1987a1bcaa7553",
  "tests/e2e/support/global-setup.ts": "a41116276c5385cb2182cc10a9f82387b7c2301dfc86a7290d19c0df268b2000",
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
  "tests/e2e/support/worker.ts": "93b60a749a810f69502e22040e94c515eb7c175b30f25faa1012e8cb7f5f4148",
});
