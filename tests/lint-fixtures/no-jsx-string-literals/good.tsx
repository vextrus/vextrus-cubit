// FIXTURE: cubit/no-jsx-string-literals MUST NOT report on this file.
// Strings come from the typed table; test ids and codes are exempt.

import { strings } from '@/ui/strings/common';

export function SaveButton() {
  return (
    <div data-testid="account-settings">
      <h1>{strings.accountSettings}</h1>
      <button type="button" data-testid="save-button" aria-label={strings.saveChanges}>
        {strings.saveChanges}
      </button>
      <span data-testid="refusal-code">AUTH_TOKEN_EXPIRED</span>
    </div>
  );
}
