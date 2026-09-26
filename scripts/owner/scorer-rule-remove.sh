#!/usr/bin/env bash
# Removes the one password-free sudo rule that let any process run the blind scorer as the key user
# (ADR 0026, amended 26 Sep 2026). Afterwards the owner types their password once per scoring run,
# and no agent can run the scorer at all. Run by the owner in a WSL terminal:
#   cd ~/vextrus-cubit && bash scripts/owner/scorer-rule-remove.sh
set -euo pipefail
RULE=/etc/sudoers.d/91-vx-score
KEY_USER=vxkeys
SCORER=/usr/local/bin/vx-score

echo "This removes $RULE (the password-free rule for $SCORER as $KEY_USER)."
echo "sudo will ask your password now."
if ! sudo test -f "$RULE"; then
  echo "✓ $RULE is already gone."
else
  sudo cat "$RULE" | sed 's/^/    /'
  read -r -p "Remove it? [y/N] " reply
  [[ "$reply" =~ ^[Yy] ]] || { echo "Nothing changed."; exit 0; }
  sudo cp -a "$RULE" /root/91-vx-score.bak
  sudo rm "$RULE"
  if sudo visudo -c >/dev/null; then
    echo "✓ removed; sudoers still valid (backup in /root/91-vx-score.bak)"
  else
    sudo cp -a /root/91-vx-score.bak "$RULE"
    echo "✗ sudoers failed to validate, so the rule was restored. Tell Claude."
    exit 1
  fi
fi

echo
echo "Proving it:"
sudo -k
if sudo -n -u "$KEY_USER" "$SCORER" >/dev/null 2>&1; then
  echo "✗ the scorer still runs without a password"
  exit 1
else
  echo "✓ the scorer no longer runs without a password"
fi
echo "Now with your password (the way you will run it):"
if sudo -u "$KEY_USER" "$SCORER"; then
  echo "✓ the scorer runs as $KEY_USER when you type your password"
else
  echo "✗ the scorer did not run with your password. Tell Claude."
  exit 1
fi
