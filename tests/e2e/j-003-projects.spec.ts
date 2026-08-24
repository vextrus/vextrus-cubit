/**
 * J-003 — Project create/edit; participants; last PRINCIPAL protection; rule-set pin visible
 * (R-SPINE-010, R-SPINE-011, L-ACT-03, R-UI-021, S-Home, S-Project-Settings).
 *
 * Five named checkpoints, in the order the work happens: create-and-read, edit-persists,
 * participants-assigned, last-principal-refused, pin-visible — then archive-leaves-home, which
 * is the same project's end. They are one walk through one project, so they are one test: each
 * step is the state the next one starts from, and split apart every one of them would have to
 * rebuild the last one's work before it could begin.
 *
 * The fixture tenant is the seeded one (`fixtures/e2e/tenant.json`), because R-SPINE-011 needs
 * more than one person: the reader founds the project and is therefore its only PRINCIPAL, and
 * the assignment checkpoint needs somebody else in the workspace to assign a role to. Which
 * somebody is read off the roster the product itself offers rather than pinned to an address —
 * a later increment that adds a fourth fixture member must not redden this file.
 *
 * `J-003` is on the describe *and* each test because `pnpm e2e --journey J-003` is Playwright's
 * `--grep` over the full title path.
 */
import { expect, test } from '@playwright/test';
import type { Page } from '@playwright/test';
import { OWNER_EMAIL, TENANT_SLUG, signIn } from './pages/settings';
import { pageSettled } from './pages/shell';
import {
  BUILDING_TYPES,
  LEAD,
  MEASURER,
  PRINCIPAL,
  PROJECT_WOULD_HAVE_NO_PRINCIPAL,
  consequenceConfirm,
  consequenceDialog,
  consequenceRefusal,
  consequenceSummary,
  createProjectThroughForm,
  createRoute,
  expectNoSeriousAxeViolations,
  fieldBuildingType,
  fieldClient,
  fieldCode,
  fieldDistrict,
  fieldGfaM2,
  fieldName,
  fieldNotes,
  fieldSiteAddress,
  fieldStoreys,
  freshProject,
  gfaSft,
  homeProjects,
  participantAssign,
  participantRow,
  participantRows,
  participantsPane,
  participantsRoster,
  participantsRoute,
  projectArchive,
  projectCard,
  projectForm,
  projectRuleset,
  projectSave,
  projectStatus,
  roleHistory,
  roleHistoryEntries,
  roleOf,
  rulesetEdition,
  selectOption,
  selectedValue,
  settingsFields,
  settled,
} from './pages/projects';

/**
 * The panes file §4's two assign controls. They are the Design Decision's own test hooks
 * (§10, "Introduced here"), which is the contract a screen is graded against.
 */
const assignMember = (page: Page) => page.getByTestId('participant-assign-member');
const assignRole = (page: Page) => page.getByTestId('participant-assign-role');

/** The pane nav J-003 reaches the pin through (panes file §1). */
const settingsNav = (page: Page) => page.getByTestId('project-settings-nav');

/**
 * The panes file pins the conversion as a rule (Interpretation 9): sft = m² ÷ 0.09290304,
 * rounded half-up, the integer grouped through `formatNumber`. 1000 m² is the worked example
 * the document itself gives, so the journey enters 1000 and reads back what the rule says.
 */
const GFA_M2 = '1000';
const GFA_SFT_GROUPED = '10,764';

/** A device-local `YYYY-MM-DD HH:mm` time slot — the history's own idiom (panes file §5). */
const TIME_SLOT = /\d{4}-\d{2}-\d{2}\s+\d{2}:\d{2}/;

/** The email of a workspace member who is not the reader, taken from the product's own list. */
async function someoneElse(page: Page): Promise<string> {
  const options = assignMember(page).locator('option');
  const count = await options.count();
  if (count > 0) {
    for (let index = 0; index < count; index += 1) {
      const value = (await options.nth(index).getAttribute('value')) ?? '';
      const label = ((await options.nth(index).textContent()) ?? '').trim();
      const candidate = value.includes('@') ? value : label;
      if (candidate.includes('@') && candidate !== OWNER_EMAIL) return candidate;
    }
  }
  // A Datum Select is not a native one: its value is what the trigger says it holds, and §4
  // preselects "the first member who is not the reader" — which is exactly what is wanted.
  const preselected = (await selectedValue(assignMember(page))).trim();
  expect(
    preselected.includes('@') && preselected !== OWNER_EMAIL,
    `the member Select offers nobody but the reader (${preselected}) — R-SPINE-011 needs a second person`,
  ).toBe(true);
  return preselected;
}

test.describe('J-003', () => {
  test('J-003 create-and-read → edit-persists → participants-assigned → last-principal-refused → pin-visible → archive-leaves-home: a project and the people on it', async ({
    page,
  }) => {
    await signIn(page, OWNER_EMAIL);
    const project = freshProject('J003', { buildingType: 'commercial', gfaM2: GFA_M2 });

    // S-Home as the reader meets it, and the accessibility gate AC-5 puts on it.
    await page.goto(`/t/${TENANT_SLUG}`);
    await settled(page.getByTestId('tenant-home'));
    await expectNoSeriousAxeViolations(page);

    // The create form, open on its own route (s-home Interpretation 2), scanned before it is
    // filled — an empty form is the state a person actually meets.
    await page.goto(createRoute(TENANT_SLUG));
    await expect(projectForm(page)).toBeVisible();
    await settled(projectForm(page));
    await expectNoSeriousAxeViolations(page);

    // The closed enum is offered whole (R-SPINE-010): every one of the five is choosable, so
    // a form that shipped four of them is a defect this journey names rather than steps past.
    for (const buildingType of BUILDING_TYPES) {
      await selectOption(fieldBuildingType(page), buildingType);
      expect(
        (await selectedValue(fieldBuildingType(page))).trim(),
        `the building type Select would not take ${buildingType}`,
      ).toBe(buildingType);
    }

    // Checkpoint "create-and-read": every R-SPINE-010 field, in and back out again.
    const projectId = await createProjectThroughForm(page, TENANT_SLUG, project);
    await expect(settingsFields(page)).toBeVisible();

    await expect(fieldName(page)).toHaveValue(project.name);
    await expect(fieldCode(page)).toHaveValue(project.code);
    await expect(fieldClient(page)).toHaveValue(project.client);
    await expect(fieldSiteAddress(page)).toHaveValue(project.siteAddress);
    await expect(fieldDistrict(page)).toHaveValue(project.district);
    await expect(fieldStoreys(page)).toHaveValue(project.storeys);
    await expect(fieldGfaM2(page)).toHaveValue(project.gfaM2);
    await expect(fieldNotes(page)).toHaveValue(project.notes);
    expect(
      (await selectedValue(fieldBuildingType(page))).trim(),
      'the saved building type is not the one that was chosen',
    ).toBe(project.buildingType);

    // AC-3: "target GFA in m² AND its derived sft display". The m² is the field above; this
    // is the pinned conversion, grouped — 1000 m² is 10,764 sft and nothing else.
    await expect(gfaSft(page)).toBeVisible();
    await expect(gfaSft(page)).toContainText(GFA_SFT_GROUPED);

    // The card on S-Home carries what the grid promises (AC-2), for a project that now exists.
    await page.goto(`/t/${TENANT_SLUG}`);
    await expect(homeProjects(page)).toBeVisible();
    const card = projectCard(page, project.name);
    await expect(card).toBeVisible();
    await expect(card).toContainText(project.code);
    await expect(card.getByTestId('project-card-status')).toBeVisible();
    await expect(card.getByTestId('project-card-stats')).toBeVisible();

    // Checkpoint "edit-persists": a change made through `project-save` survives a fresh GET —
    // the pane holds nothing of its own, it reads the row every time.
    await page.goto(`/t/${TENANT_SLUG}/p/${projectId}/settings/project`);
    const renamed = `${project.name} renamed`;
    await fieldName(page).fill(renamed);
    await projectSave(page).click();
    await page.goto(`/t/${TENANT_SLUG}/p/${projectId}/settings/project`);
    await expect(fieldName(page)).toHaveValue(renamed);

    // Checkpoint "participants-assigned" (R-SPINE-011, R-UI-021).
    await page.goto(participantsRoute(TENANT_SLUG, projectId));
    await expect(participantsPane(page)).toBeVisible();
    await expect(participantsRoster(page)).toBeVisible();

    // Interpretation 7: the founding grant guarantees the roster and the history are never
    // empty — the creator is on both from the project's first moment (L-ACT-03).
    await expect(participantRow(page, OWNER_EMAIL)).toBeVisible();
    expect(await roleOf(page, OWNER_EMAIL)).toBe(PRINCIPAL);
    await expect(roleHistory(page)).toBeVisible();
    await expect(roleHistoryEntries(page)).toHaveCount(1);
    await expect(roleHistoryEntries(page).first()).toContainText(OWNER_EMAIL);
    await expect(roleHistoryEntries(page).first()).toContainText(PRINCIPAL);
    await expect(roleHistoryEntries(page).first()).toHaveText(TIME_SLOT);

    await settled(participantsPane(page));
    await expectNoSeriousAxeViolations(page);

    const colleague = await someoneElse(page);
    await selectOption(assignMember(page), colleague);
    await selectOption(assignRole(page), LEAD);
    await participantAssign(page).click();

    // R-UI-021: "every act opens a ConsequenceDialog showing the typed consequence … computed
    // by the server". The summary is the seam's preview: this person, and the role proposed.
    await expect(consequenceDialog(page)).toBeVisible();
    await expect(consequenceSummary(page)).toBeVisible();
    await expect(consequenceSummary(page)).toContainText(colleague);
    await expect(consequenceSummary(page)).toContainText(LEAD);

    // The panes file §10 asks for the pane's accessibility scan twice over: with everything
    // closed (above) and "separately with the dialog open". This is the surface the gate most
    // needs — the ConsequenceDialog (R-UI-021) is the one part of this increment composed by
    // hand rather than taken whole from the frozen pattern. A Dialog brings no overlay axe rule
    // of its own, so the threshold here is AC-5's plain zero serious/critical.
    //
    // The wait is `pageSettled`, not `settled` alone: a dialog's arrival is animated on the
    // surface the primitive owns, which may be an *ancestor* of the node carrying the test id,
    // and `element.getAnimations()` sees neither ancestors nor subtree. A scan on that frame
    // reads every label blended toward the scrim and reports contrast nobody can ever see.
    await settled(consequenceDialog(page));
    await pageSettled(page);
    await expectNoSeriousAxeViolations(page);

    await consequenceConfirm(page).click();
    await expect(consequenceDialog(page)).toBeHidden();

    // The roster and the history are what the act moved.
    await expect(participantRow(page, colleague)).toBeVisible();
    expect(await roleOf(page, colleague)).toBe(LEAD);
    await expect(roleHistoryEntries(page)).toHaveCount(2);
    const forColleague = roleHistoryEntries(page).filter({ hasText: colleague }).first();
    await expect(forColleague).toContainText(OWNER_EMAIL);
    await expect(forColleague).toContainText(LEAD);
    await expect(forColleague).toHaveText(TIME_SLOT);

    // Checkpoint "last-principal-refused" (L-ACT-03). The reader is the project's only
    // PRINCIPAL, so demoting themselves is the one act that would leave it with none.
    const rosterBefore = await participantRows(page).count();
    const historyBefore = await roleHistoryEntries(page).count();

    await selectOption(assignMember(page), OWNER_EMAIL);
    await selectOption(assignRole(page), MEASURER);
    await participantAssign(page).click();

    // Interpretation 3: the preview answers honestly and the dialog opens; the refusal arrives
    // at confirm, in place — never a dead control and never a toast.
    await expect(consequenceDialog(page)).toBeVisible();
    await consequenceConfirm(page).click();
    await expect(consequenceRefusal(page)).toBeVisible();
    await settled(consequenceRefusal(page));
    await expect(consequenceRefusal(page)).toContainText(PROJECT_WOULD_HAVE_NO_PRINCIPAL);
    await expect(consequenceDialog(page)).toBeVisible();

    // "and changes nothing" — the journey checkpoint's own words.
    await page.goto(participantsRoute(TENANT_SLUG, projectId));
    expect(await roleOf(page, OWNER_EMAIL)).toBe(PRINCIPAL);
    await expect(participantRows(page)).toHaveCount(rosterBefore);
    await expect(roleHistoryEntries(page)).toHaveCount(historyBefore);

    // Checkpoint "pin-visible" (R-SPINE-012, L-REG-07): reached from the project's own
    // navigation, which is what makes the pane part of the project rather than a deep link.
    await expect(settingsNav(page)).toBeVisible();
    await settingsNav(page).locator(`a[href$="/p/${projectId}/settings/ruleset"]`).click();
    await expect(projectRuleset(page)).toBeVisible();
    await expect(rulesetEdition(page)).toBeVisible();
    await expect(rulesetEdition(page)).not.toBeEmpty();

    // Checkpoint "archive-leaves-home" (AC-3): the status says so, and the default grid drops
    // it — `?archived=1` is where it went (s-home Interpretation 5), not oblivion.
    await page.goto(`/t/${TENANT_SLUG}/p/${projectId}/settings/project`);
    await projectArchive(page).click();
    await expect(projectStatus(page)).toHaveAttribute('data-status', 'archived');

    await page.goto(`/t/${TENANT_SLUG}`);
    await expect(projectCard(page, renamed)).toHaveCount(0);
    await page.goto(`/t/${TENANT_SLUG}?archived=1`);
    await expect(projectCard(page, renamed)).toBeVisible();
    await expect(projectCard(page, renamed)).toHaveAttribute('data-status', 'archived');
  });
});
