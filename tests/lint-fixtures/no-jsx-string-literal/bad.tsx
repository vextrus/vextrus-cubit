/**
 * Fires: cubit/no-jsx-string-literal (R-SPINE-060).
 * Copy improvised in JSX — as element text, as an expression, and as an aria-label. None
 * of it is keyed, so no compiler can refuse a missing key and no reviewer sees the voice.
 */
export function SaveBar() {
  return (
    <div className="flex items-center gap-2">
      <button type="submit" aria-label="Save the current takeoff">
        Save changes
      </button>
      <span>{'Last saved a moment ago'}</span>
    </div>
  );
}
