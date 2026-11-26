import assert from "node:assert/strict";
import { test } from "node:test";
import { launchdPlist, systemdUnit } from "../src/service.ts";

const env = { PATH: "/usr/bin:/bin" };

test("the systemd unit restarts a crash but not a deliberate exit", () => {
  const unit = systemdUnit("mybot", ["/usr/bin/node", "/opt/rply.js"], env, "/home/me/project");
  assert.match(unit, /^Restart=on-failure$/m);
  assert.match(unit, /^RestartSec=5$/m);
  assert.doesNotMatch(unit, /^Restart=always$/m);
  assert.match(unit, /^WantedBy=default\.target$/m);
  assert.match(unit, /^Description=rply serve \(mybot\)$/m);
});

test("the launchd agent restarts on a failed exit only", () => {
  const plist = launchdPlist("mybot", ["/usr/bin/node", "/opt/rply.js"], env, "/home/me/project");
  assert.match(plist, /<key>KeepAlive<\/key>\s*<dict>\s*<key>SuccessfulExit<\/key><false\/>\s*<\/dict>/);
  assert.doesNotMatch(plist, /<key>KeepAlive<\/key><true\/>/);
  assert.match(plist, /<key>RunAtLoad<\/key><true\/>/);
});
