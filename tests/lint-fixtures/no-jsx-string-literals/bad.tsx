// FIXTURE: cubit/no-jsx-string-literals MUST report on this file.
// R-SPINE-060: user-facing strings live in one typed string table — the ones a
// screen reader announces (aria-label, placeholder, alt, title) as much as the
// ones printed between the tags.

export function SaveButton() {
  return (
    <div>
      <h1>Account settings</h1>
      <button type="button">Save changes</button>
      <button type="button" aria-label="Revoke this device" />
      <input placeholder="Email address" title="Your work address" />
      <img alt="The tenant's logo" />
    </div>
  );
}
