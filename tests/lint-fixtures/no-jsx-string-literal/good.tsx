/**
 * Silent: every user-facing string comes from the module's typed string table, and the two
 * exceptions R-SPINE-060 names are used as exceptions — a test id and a reason code.
 */
const strings = {
  save: 'Save changes',
  saveHint: 'Save the current takeoff',
  lastSaved: 'Last saved a moment ago',
} as const;

const REFUSAL = 'PIN_STALE';

export function SaveBar() {
  return (
    <div className="flex items-center gap-2">
      <button type="submit" data-testid="save-takeoff" aria-label={strings.saveHint}>
        {strings.save}
      </button>
      <span>{strings.lastSaved}</span>
      <code data-testid="refusal-code">{REFUSAL}</code>
    </div>
  );
}
