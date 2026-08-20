import { table } from './index';

/** Onboarding (R-UI-033) and the tenant home. */
export const strings = table({
  createTitle: 'Name your tenant',
  createLede: 'A tenant holds your projects, books and bids. You can create more later.',
  createName: 'Tenant name',
  createNameHint: 'The address is derived from the name, e.g. Acme Construction → acme-construction.',
  createSubmit: 'Create tenant',
  createSkip: 'Skip for now',
  createSkipHint: 'Your personal tenant is ready either way.',

  homeTitle: 'Tenant home',
  homeSlugLabel: 'Tenant address',
  homeEmptyTitle: 'Nothing here yet',
  homeEmptyLede: 'A project is the next thing to make: it holds the drawings you will take off.',
  homeEmptyAction: 'Projects arrive with the next increment — the address above is already live.',
  homeSessions: 'Signed-in devices',
});
