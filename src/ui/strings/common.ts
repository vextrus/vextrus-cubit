import { table } from './index';

/** Strings more than one screen needs. */
export const strings = table({
  brand: 'VEXTRUS CUBIT',
  brandTagline: 'Takeoff · Cost · Estimation · Bidding',
  brandDescription: 'AI-native construction takeoff, cost database, estimation and bidding.',

  accountSettings: 'Account settings',
  saveChanges: 'Save changes',

  themeToggleToDark: 'Switch to the dark theme',
  themeToggleToLight: 'Switch to the light theme',

  refusalCodeLabel: 'Refusal code',
  refusalRemedyLabel: 'What resolves it',

  loading: 'Loading…',
  retry: 'Try again',

  /* R-UI-050 — the three states every screen owes besides empty and refusal. */
  loadingLabel: 'Loading this screen',
  errorTitle: 'This screen did not finish loading.',
  errorLede: 'Nothing was changed. Try again, or report the id below with what you were doing.',
  errorReportLabel: 'Report id',
  offlineTitle: 'You are offline.',
  offlineLede: 'This screen is read-only until the connection is back. Nothing you type will be saved.',
});
