/**
 * S-AUDIT — the project's audit surfaces: act log explorer, model-call ledger, job history
 * (R-SPINE-081, C-SPINE-PLATFORM, S-Audit, L-ACT-01; `docs/design/s-audit.md`).
 *
 * One walk, six named checkpoints in the order the work happens: acts-recorded (the project and
 * the grants this log is a record of) → log-reads (consequence, evidence, newest first) →
 * filters-compose (type, actor, subject, and the empty a filter can honestly produce) →
 * models-teach → jobs-teach → outsider-404. They are one test because each step is the state
 * the next one starts from: the log cannot be read before the acts exist, and every filter
 * claim is about those same acts.
 *
 * The fixture tenant is the seeded one (`fixtures/e2e/tenant.json`), because an act log that
 * only ever names one person cannot show that the actor filter and the subject filter are two
 * different questions. Which colleague is read off the roster the product itself offers rather
 * than pinned to an address — a later increment that adds a fourth fixture member must not
 * redden this file.
 *
 * `S-AUDIT` is on the describe *and* on the test because `pnpm e2e --journey S-AUDIT` is
 * Playwright's `--grep` over the full title path (the J-003 pattern the contract names).
 *
 * Copy is asserted by what it must *say*, not by the sentence it says it in: the Design
 * Decision owns the wording (§7) and a designer may re-word it tomorrow, while "the evidence
 * slot teaches an absence" and "the ledger's empty state names calls, cost and outcome" are
 * the Bible's own requirements (R-SPINE-081, R-UI-020, R-UI-033) and are what this file grades.
 */
import { expect, test } from '@playwright/test';
import { OWNER_EMAIL, TENANT_SLUG, signIn } from './pages/settings';
import { breadcrumb, pageSettled } from './pages/shell';
import {
  ASSIGN_PARTICIPANT_ROLE,
  MEASURER,
  PRINCIPAL,
  REVIEWER,
  actLog,
  actLogEmpty,
  actLogEntries,
  actTypesInOrder,
  applyFilters,
  auditNav,
  auditNavActs,
  auditNavJobs,
  auditNavModels,
  auditRoute,
  consequenceOf,
  entryTextsInOrder,
  evidenceOf,
  expectNoSeriousAxeViolations,
  filterActor,
  filterApply,
  filterSubject,
  filterType,
  grantRole,
  jobHistory,
  jobHistoryEmpty,
  jobsRoute,
  modelLedger,
  modelLedgerEmpty,
  modelsRoute,
  openAudit,
  optionsOf,
  selectedValue,
  someoneElse,
} from './pages/audit';
import {
  createProjectThroughForm,
  freshProject,
  participantsRoute,
  participantsPane,
  settled,
} from './pages/projects';

/**
 * SEAM-FORMAT's date, as `BD_DOCUMENT` writes one: DD MMM YYYY, zero-padded day, English
 * month (`src/core/format.ts`). The month alphabet is spelled out rather than matched with
 * `\w{3}`, so a date rendered by `toLocaleDateString` in some other shape does not pass.
 */
const SEAM_DATE = /\b\d{2} (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) \d{4}\b/;

/** The Dhaka wall-clock time the Design Decision adds beside it (Interpretation 5). */
const WALL_CLOCK = /\b\d{2}:\d{2}\b/;

/** A project id shaped like a project id and belonging to nobody (AC-1's 404). */
const NO_SUCH_PROJECT = '00000000-0000-4000-8000-000000000000';

/** Teaching copy is a sentence, not a word: an empty state that says "None" teaches nothing. */
const teaches = (text: string): boolean => text.trim().length >= 20;

test.describe('S-AUDIT', () => {
  test('S-AUDIT acts-recorded → log-reads → filters-compose → models-teach → jobs-teach → outsider-404: a project’s audit surfaces', async ({
    page,
  }) => {
    await signIn(page, OWNER_EMAIL);

    /* ── checkpoint "acts-recorded": the acts the log is a record of (L-ACT-01) ────────── */

    const project = freshProject('SAUDIT');
    const projectId = await createProjectThroughForm(page, TENANT_SLUG, project);

    // The founding PRINCIPAL grant is already an act (L-ACT-03); these two are the later
    // ASSIGN_PARTICIPANT_ROLE acts AC-2 asks the log to hold beside it.
    await page.goto(participantsRoute(TENANT_SLUG, projectId));
    await expect(participantsPane(page)).toBeVisible();
    const colleague = await someoneElse(page, [OWNER_EMAIL]);
    await grantRole(page, TENANT_SLUG, projectId, colleague, REVIEWER);
    await grantRole(page, TENANT_SLUG, projectId, colleague, MEASURER);

    /* ── checkpoint "log-reads": AC-1 and AC-2 ────────────────────────────────────────── */

    await openAudit(page, TENANT_SLUG, projectId);
    await expect(actLog(page)).toBeVisible();
    await expect(auditNav(page)).toBeVisible();
    await expect(auditNavActs(page)).toHaveAttribute('aria-current', 'page');

    // AC-2: one entry per act. Three acts have been performed on this project and the reader
    // has performed them all, so the log holds at least those three — asserted as a floor and
    // not as a total, because a later increment may lawfully record acts this file knows
    // nothing about.
    const entries = actLogEntries(page);
    expect(
      await entries.count(),
      'the log holds fewer entries than the founding grant plus the two role grants just made',
    ).toBeGreaterThanOrEqual(3);

    // "each carrying data-act-type": the attribute is the contract's, and its value is the act
    // type code the seam's ACT_TYPE table names (never a literal invented by the screen).
    const types = await actTypesInOrder(page);
    expect(types, 'an entry carries no data-act-type').not.toContain('');
    expect(
      types.filter((type) => type === ASSIGN_PARTICIPANT_ROLE).length,
      `the log names no ${ASSIGN_PARTICIPANT_ROLE} act, though three were performed`,
    ).toBeGreaterThanOrEqual(3);

    // "newest first": the three acts were performed in a known order, so their entries must
    // appear in the opposite one. Read by position rather than by index, so entries an
    // unrelated increment adds cannot redden the claim.
    const texts = await entryTextsInOrder(page);
    const positionOf = (role: string, email: string): number => {
      const found = texts.findIndex((text) => text.includes(role) && text.includes(email));
      expect(found, `no entry names ${role} for ${email}\n${texts.join('\n')}`).toBeGreaterThanOrEqual(0);
      return found;
    };
    const measurerAt = positionOf(MEASURER, colleague);
    const reviewerAt = positionOf(REVIEWER, colleague);
    const foundingAt = positionOf(PRINCIPAL, OWNER_EMAIL);
    expect(
      [measurerAt, reviewerAt, foundingAt],
      'the log is not newest-first: the founding grant, the REVIEWER grant and the MEASURER grant were made in that order',
    ).toEqual([measurerAt, reviewerAt, foundingAt].slice().sort((a, b) => a - b));
    expect(measurerAt, 'the newest act is not the first entry').toBe(0);

    // AC-2, the newest entry read whole: the act type, both people, the time through the seam,
    // the derived consequence and the taught evidence absence.
    const newest = entries.first();
    await expect(newest).toHaveAttribute('data-act-type', ASSIGN_PARTICIPANT_ROLE);
    await expect(newest).toContainText(ASSIGN_PARTICIPANT_ROLE);
    await expect(newest).toContainText(OWNER_EMAIL);
    await expect(newest).toContainText(colleague);
    await expect(newest).toHaveText(SEAM_DATE);
    await expect(newest).toHaveText(WALL_CLOCK);

    // "the entry's act-consequence names the granted role and grantee" — the pair derived by
    // joining participant_roles on act_id, said on the screen.
    await expect(consequenceOf(newest)).toBeVisible();
    await expect(consequenceOf(newest)).toContainText(MEASURER);
    await expect(consequenceOf(newest)).toContainText(colleague);

    // "act-evidence shows the teaching copy rather than an empty cell": M0 acts cite nothing,
    // and an absence a reader can understand is the requirement (R-UI-020).
    await expect(evidenceOf(newest)).toBeVisible();
    const evidence = ((await evidenceOf(newest).textContent()) ?? '').trim();
    expect(
      teaches(evidence) && /evidence/i.test(evidence),
      `the evidence slot of the newest act says “${evidence}” — M0 cites none, so it must teach the absence`,
    ).toBe(true);

    // Every entry, not only the newest: no blank consequence and no blank evidence anywhere.
    const entryCount = await entries.count();
    for (let index = 0; index < entryCount; index += 1) {
      const entry = entries.nth(index);
      await expect(consequenceOf(entry)).not.toBeEmpty();
      await expect(evidenceOf(entry)).not.toBeEmpty();
    }

    await settled(actLog(page));
    await pageSettled(page);
    await expectNoSeriousAxeViolations(page);

    /* ── checkpoint "filters-compose": AC-3 ───────────────────────────────────────────── */

    // Native `<select>`s, server-rendered: the options are in the served document, which is
    // what makes a closed set readable without opening anything (§3, Interpretation 3).
    for (const [name, control] of [
      ['act-filter-type', filterType(page)],
      ['act-filter-actor', filterActor(page)],
      ['act-filter-subject', filterSubject(page)],
    ] as const) {
      await expect(control).toBeVisible();
      expect(
        (await control.evaluate((element) => element.tagName.toLowerCase())),
        `${name} is not a native select, so its options are not in the served document`,
      ).toBe('select');
      const options = await optionsOf(control);
      expect(options.length, `${name} offers no options`).toBeGreaterThanOrEqual(2);
      expect(
        options.filter((option) => option.value === '').length,
        `${name} offers no "all" option (the unfiltered value is the empty one)`,
      ).toBe(1);
    }
    expect(
      (await optionsOf(filterType(page))).map((option) => option.value),
      `the type filter does not offer ${ASSIGN_PARTICIPANT_ROLE}`,
    ).toContain(ASSIGN_PARTICIPANT_ROLE);
    for (const control of [filterActor(page), filterSubject(page)] as const) {
      expect(
        (await optionsOf(control)).map((option) => option.value),
        'the actor/subject filters are valued as participant emails (the test contract)',
      ).toEqual(expect.arrayContaining([OWNER_EMAIL, colleague]));
    }
    await expect(filterApply(page)).toBeVisible();

    // By type: only that act type is listed, and the URL carries the choice.
    await applyFilters(page, { type: ASSIGN_PARTICIPANT_ROLE });
    expect(new URL(page.url()).searchParams.get('type')).toBe(ASSIGN_PARTICIPANT_ROLE);
    expect(
      new Set(await actTypesInOrder(page)),
      `filtering by ${ASSIGN_PARTICIPANT_ROLE} listed another act type`,
    ).toEqual(new Set([ASSIGN_PARTICIPANT_ROLE]));
    expect(await actLogEntries(page).count()).toBeGreaterThanOrEqual(3);
    // The control shows the filter the URL is holding.
    expect((await selectedValue(filterType(page))).trim()).toBe(ASSIGN_PARTICIPANT_ROLE);

    // By subject: only acts *about* that person — the founding grant is about the reader and
    // must fall away, which is what makes subject a different question from actor.
    await openAudit(page, TENANT_SLUG, projectId);
    await applyFilters(page, { type: '', subject: colleague });
    expect(new URL(page.url()).searchParams.get('subject')).toBe(colleague);
    const aboutColleague = await entryTextsInOrder(page);
    expect(aboutColleague.length, `no acts about ${colleague}`).toBeGreaterThanOrEqual(2);
    for (const text of aboutColleague) {
      expect(text, `an entry about somebody else survived subject=${colleague}`).toContain(colleague);
    }
    const consequences = await actLogEntries(page)
      .getByTestId('act-consequence')
      .allTextContents();
    for (const said of consequences) {
      expect(
        said,
        `the founding grant (about ${OWNER_EMAIL}) survived subject=${colleague}`,
      ).not.toContain(OWNER_EMAIL);
    }

    // Composed: actor AND subject. Every act here was performed by the reader, so adding the
    // actor narrows nothing — and an AND that dropped rows would be visible immediately.
    await applyFilters(page, { actor: OWNER_EMAIL });
    const url = new URL(page.url());
    expect(url.searchParams.get('actor')).toBe(OWNER_EMAIL);
    expect(url.searchParams.get('subject')).toBe(colleague);
    expect(
      await entryTextsInOrder(page),
      'actor AND subject dropped acts that satisfy both',
    ).toEqual(aboutColleague);

    // By actor, discriminating: the colleague has performed no act at all, so their acts are
    // none — and none is the taught empty of AC-3, never an error.
    await applyFilters(page, { actor: colleague, subject: colleague });
    await expect(actLogEmpty(page)).toBeVisible();
    await expect(actLogEntries(page)).toHaveCount(0);
    const emptyCopy = ((await actLogEmpty(page).textContent()) ?? '').trim();
    expect(teaches(emptyCopy), `the filtered-empty state says “${emptyCopy}”`).toBe(true);
    // "not an error": the filter row is still there, still holding what filtered everything out.
    await expect(filterActor(page)).toBeVisible();
    expect((await selectedValue(filterActor(page))).trim()).toBe(colleague);

    // A value naming nobody — a hand-edited URL — filters honestly rather than throwing.
    await openAudit(page, TENANT_SLUG, projectId, {
      actor: 'nobody@cubit-e2e.invalid',
      type: 'NO_SUCH_ACT_TYPE',
    });
    await expect(actLogEmpty(page)).toBeVisible();
    await expect(actLogEntries(page)).toHaveCount(0);

    // And clearing them all brings the whole log back (§3's clear affordance is a plain link
    // to the unfiltered address, which is what a reader can always reach).
    await openAudit(page, TENANT_SLUG, projectId);
    await expect(actLog(page)).toBeVisible();
    expect(await actLogEntries(page).count()).toBeGreaterThanOrEqual(3);

    /* ── checkpoint "models-teach": AC-1 and AC-4 ─────────────────────────────────────── */

    const modelsLabel = ((await auditNavModels(page).textContent()) ?? '').trim();
    await auditNavModels(page).click();
    await expect(page).toHaveURL(new RegExp(`${modelsRoute(TENANT_SLUG, projectId)}$`));
    await expect(modelLedger(page)).toBeVisible();
    await expect(modelLedgerEmpty(page)).toBeVisible();
    await expect(auditNavModels(page)).toHaveAttribute('aria-current', 'page');
    // AC-1: "the breadcrumb pane crumb names each pane" — in the sub-nav's own words.
    expect(modelsLabel, 'the models nav item is unlabelled').not.toBe('');
    await expect(breadcrumb(page)).toContainText(modelsLabel);

    // AC-4: R-SPINE-081's own three words for what will appear here.
    const ledgerCopy = ((await modelLedger(page).textContent()) ?? '').trim();
    for (const word of [/calls?\b/i, /cost/i, /outcome/i]) {
      expect(
        word.test(ledgerCopy),
        `the model ledger's empty state does not name ${String(word)} — it says “${ledgerCopy}”`,
      ).toBe(true);
    }
    expect(teaches(ledgerCopy)).toBe(true);

    await settled(modelLedger(page));
    await pageSettled(page);
    await expectNoSeriousAxeViolations(page);

    /* ── checkpoint "jobs-teach": AC-1 and AC-4 ───────────────────────────────────────── */

    const jobsLabel = ((await auditNavJobs(page).textContent()) ?? '').trim();
    await auditNavJobs(page).click();
    await expect(page).toHaveURL(new RegExp(`${jobsRoute(TENANT_SLUG, projectId)}$`));
    await expect(jobHistory(page)).toBeVisible();
    await expect(jobHistoryEmpty(page)).toBeVisible();
    await expect(auditNavJobs(page)).toHaveAttribute('aria-current', 'page');
    expect(jobsLabel, 'the jobs nav item is unlabelled').not.toBe('');
    await expect(breadcrumb(page)).toContainText(jobsLabel);

    const jobsCopy = ((await jobHistory(page).textContent()) ?? '').trim();
    for (const word of [/jobs?\b/i, /runs?\b/i]) {
      expect(
        word.test(jobsCopy),
        `the job history's empty state does not name ${String(word)} — it says “${jobsCopy}”`,
      ).toBe(true);
    }
    expect(teaches(jobsCopy)).toBe(true);

    await settled(jobHistory(page));
    await pageSettled(page);
    await expectNoSeriousAxeViolations(page);

    // The sub-nav walks back, too: three panes, reachable from each other (AC-1).
    const actsLabel = ((await auditNavActs(page).textContent()) ?? '').trim();
    await auditNavActs(page).click();
    await expect(page).toHaveURL(new RegExp(`${auditRoute(TENANT_SLUG, projectId)}$`));
    await expect(actLog(page)).toBeVisible();
    expect(actsLabel, 'the acts nav item is unlabelled').not.toBe('');
    await expect(breadcrumb(page)).toContainText(actsLabel);

    /* ── checkpoint "outsider-404": AC-1 ──────────────────────────────────────────────── */

    // "exactly as the project segment layout already does": the answer for an unknown project
    // is read off an existing route of that segment rather than pinned to a number here, so
    // this claim stays true if the guard's answer is ever lawfully changed for all of them.
    const settlement = await page.goto(
      `/t/${TENANT_SLUG}/p/${NO_SUCH_PROJECT}/settings/project`,
    );
    const expected = settlement?.status();
    expect(expected, 'the project segment answers an unknown project id with no status').toBe(404);
    for (const route of [
      auditRoute(TENANT_SLUG, NO_SUCH_PROJECT),
      modelsRoute(TENANT_SLUG, NO_SUCH_PROJECT),
      jobsRoute(TENANT_SLUG, NO_SUCH_PROJECT),
    ]) {
      const answered = await page.goto(route);
      expect(answered?.status(), `${route} did not answer as the project segment does`).toBe(
        expected,
      );
    }
  });
});
