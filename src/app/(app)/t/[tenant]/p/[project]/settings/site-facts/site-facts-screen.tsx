"use client";
// The Site facts panel, bound (docs/design/s-settings-site-facts.md, the levels workspace's I-170).
// This is the one file that may reach both `src/ui` and `src/modules`: it hands the presentational
// panel the SHIPPED renderers, the ids AM-09 §1 keeps in one registry a module may not import, and
// this route's own two doors — and adds nothing of its own to any of them.
//
// It also declares the screen's crumb, which is the frame's slot and therefore a client hook
// (R-UI-084): the page above it is the server component that does the reading.
import type { SiteFact, StandingSiteFact } from "@/core/site-facts/law";
import { SiteFactsPanel, type SiteFactsChrome } from "@/modules/takeoff/site-facts-ui";
import { ConsequenceDialog } from "@/ui/patterns/consequence-dialog";
import { RefusalState } from "@/ui/patterns/refusal-state";
import { BasisChip, Button, IdChip, Input, NumberInput, Select } from "@/ui/primitives/core";
import { useShellPage } from "@/ui/shell";
import { PROJECT_SETTINGS_PAGES } from "@/ui/shell/routes";
import { TESTIDS } from "@/ui/testids";
import { SettingsHeader } from "@/app/(app)/t/[tenant]/settings/settings-pane";
import { commitSiteFactAction, previewSiteFactAction } from "./actions";

/**
 * The chrome, assembled once: every renderer is the shipped one and every id is the registry's own
 * (B-17, AM-09 §1). Nothing is wrapped and nothing is re-styled on the way through.
 */
const CHROME: SiteFactsChrome = {
  testIds: {
    screen: TESTIDS.siteFacts.screen,
    section: TESTIDS.siteFacts.section,
    face: TESTIDS.siteFacts.face,
    table: TESTIDS.siteFacts.table,
    row: TESTIDS.siteFacts.row,
    rowValue: TESTIDS.siteFacts.rowValue,
    rowSource: TESTIDS.siteFacts.rowSource,
    rowAct: TESTIDS.siteFacts.rowAct,
    rowDeferral: TESTIDS.siteFacts.rowDeferral,
    enter: TESTIDS.siteFacts.enter,
    value: TESTIDS.siteFacts.value,
    unit: TESTIDS.siteFacts.unit,
    sourceNote: TESTIDS.siteFacts.sourceNote,
    submit: TESTIDS.siteFacts.submit,
    refusal: TESTIDS.siteFacts.refusal,
  },
  SettingsHeader,
  RefusalState,
  ConsequenceDialog,
  Button,
  NumberInput,
  Select,
  Input,
  IdChip,
  BasisChip,
};

export interface SiteFactsScreenProps {
  readonly tenantId: string;
  readonly projectId: string;
  readonly standing: Readonly<Partial<Record<SiteFact, StandingSiteFact>>>;
  readonly mayAuthor: boolean;
  readonly rulesetHref: string;
  readonly participantsHref: string;
}

export function SiteFactsScreen({ tenantId, projectId, standing, mayAuthor, rulesetHref, participantsHref }: SiteFactsScreenProps) {
  // R-UI-084: the screen declares its own crumb through the frame's slot, in the one home the area's
  // words live in — the nav row and the page crumb wear the same word (B-17).
  useShellPage(PROJECT_SETTINGS_PAGES["site-facts"]);

  return (
    <SiteFactsPanel
      tenantId={tenantId}
      projectId={projectId}
      standing={standing}
      mayAuthor={mayAuthor}
      rulesetHref={rulesetHref}
      participantsHref={participantsHref}
      preview={previewSiteFactAction}
      commit={commitSiteFactAction}
      chrome={CHROME}
    />
  );
}
