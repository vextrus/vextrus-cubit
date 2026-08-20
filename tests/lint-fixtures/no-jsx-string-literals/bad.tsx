// FIXTURE: cubit/no-jsx-string-literals MUST report on this file.
// R-SPINE-060: user-facing strings live in one typed string table.

export function SaveButton() {
  return (
    <div>
      <h1>Account settings</h1>
      <button type="button">Save changes</button>
    </div>
  );
}
