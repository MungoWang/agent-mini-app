/**
 * Unit tests for dsh-switch profile rewrites (no pnpm install).
 *
 * Inputs:       none
 * Writes:       none
 * Side effects: none
 * Run as:       pnpm test:dsh-switch
 */
import assert from "node:assert/strict";
import test from "node:test";
import {
  PLUGIN_NAME,
  applyProfileSwitch,
  renderWorkspaceYaml,
  type ProfilePackageJson,
} from "./dsh-switch.lib.mts";

const REPO = "/Users/dev/monkey-mini-app";

function dirtyProfile(): ProfilePackageJson {
  return {
    name: "dsh-profile-web",
    dependencies: {
      "@deepseek-ai/dsh-hermes": "^0.1.0",
      "@deepseek-ai/dsh-orbis": "^0.1.0",
      "@monkey-mini-app/dsh-mini-app": "link:/old/packages/dsh",
      "@monkey-mini-app/host": "link:/old/packages/host",
      "@monkey-mini-app/panel": "link:/old/packages/panel",
      "@monkey-mini-app/ui": "file:/old/packages/ui",
      "@monkey-mini-app/api": "workspace:*",
      "@monkey-mini-app/dsh-monkey-mini-app": "link:/old/packages/dsh",
      "@monkey-mini-app/dsh-plugin": "^0.0.1",
      "dsh-plugin": "link:/legacy",
    },
    dsh: {
      profile: {
        bundles: [
          "@deepseek-ai/dsh-base",
          "@deepseek-ai/dsh-web-app",
          "@monkey-mini-app/dsh-plugin",
          "@monkey-mini-app/dsh-monkey-mini-app",
        ],
      },
    },
  };
}

test("debug links five repo packages and lists packages/dsh in workspace", () => {
  const { pkg, workspaceYaml } = applyProfileSwitch({
    mode: "debug",
    pkg: dirtyProfile(),
    repoRoot: REPO,
    pluginVersion: "0.1.7",
  });
  const deps = pkg.dependencies ?? {};
  assert.equal(deps[PLUGIN_NAME], `link:${REPO}/packages/dsh`);
  assert.equal(deps["@monkey-mini-app/host"], `link:${REPO}/packages/host`);
  assert.equal(deps["@monkey-mini-app/panel"], `link:${REPO}/packages/panel`);
  assert.equal(deps["@monkey-mini-app/ui"], `link:${REPO}/packages/ui`);
  assert.equal(deps["@monkey-mini-app/api"], `link:${REPO}/packages/api`);
  assert.equal(deps["@deepseek-ai/dsh-hermes"], "^0.1.0");
  assert.equal(deps["@deepseek-ai/dsh-orbis"], "^0.1.0");
  assert.equal(deps["@monkey-mini-app/dsh-monkey-mini-app"], undefined);
  assert.equal(deps["@monkey-mini-app/dsh-plugin"], undefined);
  assert.equal(deps["dsh-plugin"], undefined);
  assert.match(workspaceYaml, new RegExp(`- ${REPO}/packages/dsh`));
  assert.match(workspaceYaml, new RegExp(`- ${REPO}/packages/host`));
  assert.match(workspaceYaml, new RegExp(`- ${REPO}/packages/panel`));
  assert.match(workspaceYaml, new RegExp(`- ${REPO}/packages/ui`));
  assert.match(workspaceYaml, new RegExp(`- ${REPO}/packages/api`));
  assert.match(workspaceYaml, /^packages:\n {2}- \.$/m);
  assert.match(workspaceYaml, /^nodeLinker: isolated$/m);
  assert.match(workspaceYaml, /^autoInstallPeers: false$/m);
  assert.deepEqual(pkg.dsh?.profile?.bundles, [
    "@deepseek-ai/dsh-base",
    "@deepseek-ai/dsh-web-app",
    PLUGIN_NAME,
  ]);
});

test("prod pins only dsh-mini-app exact and strips path / obsolete deps", () => {
  const { pkg, workspaceYaml } = applyProfileSwitch({
    mode: "prod",
    pkg: dirtyProfile(),
    repoRoot: REPO,
    pluginVersion: "0.1.7",
  });
  const deps = pkg.dependencies ?? {};
  assert.equal(deps[PLUGIN_NAME], "0.1.7");
  assert.equal(deps["@monkey-mini-app/host"], undefined);
  assert.equal(deps["@monkey-mini-app/panel"], undefined);
  assert.equal(deps["@monkey-mini-app/ui"], undefined);
  assert.equal(deps["@monkey-mini-app/api"], undefined);
  assert.equal(deps["@monkey-mini-app/dsh-monkey-mini-app"], undefined);
  assert.equal(deps["@monkey-mini-app/dsh-plugin"], undefined);
  assert.equal(deps["dsh-plugin"], undefined);
  assert.equal(deps["@deepseek-ai/dsh-hermes"], "^0.1.0");
  assert.equal(deps["@deepseek-ai/dsh-orbis"], "^0.1.0");
  assert.equal(workspaceYaml, renderWorkspaceYaml("prod", REPO));
  assert.doesNotMatch(workspaceYaml, /packages\/(dsh|host|panel|ui|api)/);
  assert.match(workspaceYaml, /^packages:\n {2}- \.\n\nnodeLinker: isolated\nautoInstallPeers: false\n$/);
  assert.deepEqual(pkg.dsh?.profile?.bundles, [
    "@deepseek-ai/dsh-base",
    "@deepseek-ai/dsh-web-app",
    PLUGIN_NAME,
  ]);
});

test("prod does not write a loose ^0.1.0 range", () => {
  const { pkg } = applyProfileSwitch({
    mode: "prod",
    pkg: { dependencies: { [PLUGIN_NAME]: "^0.1.0" } },
    repoRoot: REPO,
    pluginVersion: "0.1.7",
  });
  assert.equal(pkg.dependencies?.[PLUGIN_NAME], "0.1.7");
  assert.notEqual(pkg.dependencies?.[PLUGIN_NAME], "^0.1.0");
});
