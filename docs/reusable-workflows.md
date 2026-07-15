# Reusable CI/CD workflows

`@orgsdk/plugins` ships two centrally maintained **reusable GitHub workflows**
that every plugin repository calls instead of duplicating CI/publish mechanics:

| Workflow | Path | Purpose |
|---|---|---|
| `plugin-ci.yml` | `.github/workflows/plugin-ci.yml` | Lint, typecheck, tests, version guard, validate, package, upload artifact. |
| `plugin-publish.yml` | `.github/workflows/plugin-publish.yml` | Self-contained build + validated catalog publish (dry-run by default). |

They run in the **caller's** repository context: `actions/checkout` checks out
the caller repo, the caller's `GITHUB_TOKEN` / secrets / variables apply, and
the workflows only invoke the caller's own `bun run` scripts plus the
`orgsdk-plugin` CLI. No plugin logic is duplicated.

## Prerequisites

In the **caller** (plugin) repository:

1. Depend on the SDK so the `orgsdk-plugin` CLI resolves:
   ```json
   { "devDependencies": { "@orgsdk/plugins": "^0.2.1" } }
   ```
2. Define these npm scripts (the v0.2.1 contract):
   ```json
   {
     "scripts": {
       "check": "biome check .",
       "typecheck": "tsc --noEmit",
       "test": "bun test",
       "validate": "orgsdk-plugin validate",
       "package": "orgsdk-plugin package",
       "version-guard": "orgsdk-plugin version-guard"
     }
   }
   ```
   (Repositories still on local `scripts/*.ts` shims keep working — any script
   named `validate`/`package`/`version-guard` is invoked as-is.)

## Pinning

Pin the call to an **immutable ref**. A commit SHA is the strongest guarantee:

```yaml
uses: OrgSDK/plugins/.github/workflows/plugin-ci.yml@<full-40-char-sha>
```

A release tag (`@v0.2.1`) is readable and acceptable, but a tag can be moved by
repo admins; prefer a SHA for supply-chain safety.

## CI — caller workflow

`.github/workflows/ci.yml` in the plugin repo:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]
  workflow_dispatch:

concurrency:
  group: ci-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  ci:
    uses: OrgSDK/plugins/.github/workflows/plugin-ci.yml@<full-40-char-sha>
    with:
      artifact-name: my-plugin-${{ github.sha }}
```

No secrets or `permissions:` block needed at the caller — the reusable
workflow declares least-privilege (`contents: read`) and needs nothing else.

## Catalog publish — caller workflow

### One-time repository setup (GitHub Settings)

| Where | Name | Value |
|---|---|---|
| Variables | `ORGSDK_CATALOG_URL` | Your catalog base URL (e.g. `https://app.orgsdk.ai`). |
| Variables | `ORGSDK_ENABLE_CATALOG_PUBLISH` | `true` to opt in to **real** publishing. Omit/unset to stay dry-run only. |
| Secrets | `ORGSDK_PUBLISH_TOKEN` | Scoped catalog publisher token. Must be a **repository** secret — see note below. Never printed. |
| Environments | `catalog-publish` | Optional protection rules (branch restriction to `main`, emergency reviewers). Do **not** enable required reviewers by default (that makes publishing approval-based). |

> **Why a repository secret?** A caller job that calls a reusable workflow
> cannot itself declare `environment:`, so `${{ secrets.ORGSDK_PUBLISH_TOKEN }}`
> at the caller scope resolves only **repository-level** secrets (the
> `catalog-publish` environment is applied *inside* the reusable workflow, where
> it governs protection rules and where an environment secret of the same name
> would take precedence if also defined). Put the token in
> **Settings → Secrets and variables → Actions → Repository secrets**.

### Caller workflow

`.github/workflows/publish-catalog.yml` in the plugin repo:

```yaml
name: Publish to Catalog

on:
  push:
    branches: [main]
    paths: ["plugin/**", "package.json"]
  workflow_dispatch:
    inputs:
      dry_run:
        description: "Dry-run only (do not POST to catalog)"
        required: false
        default: "true"
        type: choice
        options: ["true", "false"]

permissions:
  contents: read

jobs:
  publish:
    # Auto path: only when the opt-in variable is 'true'. Manual dispatch is
    # always allowed (a manual real publish is re-gated inside the reusable
    # workflow). pull_request is excluded — there is no pull_request trigger.
    if: |
      github.event_name == 'workflow_dispatch' ||
      (github.event_name == 'push' && vars.ORGSDK_ENABLE_CATALOG_PUBLISH == 'true')
    uses: OrgSDK/plugins/.github/workflows/plugin-publish.yml@<full-40-char-sha>
    with:
      # push → real publish; manual → honor the dry_run choice.
      dry-run: ${{ !(github.event_name == 'push' || github.event.inputs.dry_run == 'false') }}
      publish-enabled: ${{ vars.ORGSDK_ENABLE_CATALOG_PUBLISH }}
      catalog-url: ${{ vars.ORGSDK_CATALOG_URL }}
      artifact-name: my-plugin-publish-${{ github.sha }}
    secrets:
      ORGSDK_PUBLISH_TOKEN: ${{ secrets.ORGSDK_PUBLISH_TOKEN }}
```

`secrets: inherit` is a valid shorthand, but explicit mapping (above) is
preferred — it limits the reusable workflow to exactly the token it needs.

### How the opt-in / dry-run logic resolves

| Trigger | `dry-run` input | `publish-enabled` | Result |
|---|---|---|---|
| push to main (gated) | `false` | `true` | **Real publish** (serialized). |
| manual, `dry_run=false` | `false` | `true` | **Real publish**. |
| manual, `dry_run=false` | `false` | unset/other | Fails clearly — opt-in required. |
| manual, `dry_run=true` (default) | `true` | any | **Dry-run** (no token used). |

A real publish requires the token secret **and** the opt-in variable. A dry-run
needs neither and never touches the token.

## Concrete examples

### Template repo (`orgsdk-plugin-template`)

CI — identical to the [CI caller](#ci--caller-workflow) with
`artifact-name: plugin-template-${{ github.sha }}`.

Publish — the [caller workflow](#caller-workflow) verbatim, with
`artifact-name: plugin-template-publish-${{ github.sha }}`. The template ships
**without** `ORGSDK_ENABLE_CATALOG_PUBLISH`, so it never auto-publishes the
placeholder `my-plugin`; a generated repo opts in by setting the variable.

### Serper repo (`orgsdk-plugin-serper`)

Same caller workflows, with `artifact-name: plugin-serper(-publish)-${{ github.sha }}`.
Serper sets `ORGSDK_ENABLE_CATALOG_PUBLISH=true`, `ORGSDK_CATALOG_URL`, and the
`ORGSDK_PUBLISH_TOKEN` secret, so pushes to `main` that touch `plugin/**` or
`package.json` publish a real, validated artifact.

## Local validation

The static guard over these workflows runs in the test suite:

```sh
bun test tests/workflows.test.ts
```

It asserts SHA-pinning, least-privilege permissions, frozen installs, full
history fetch, serialized non-cancelled publication, and that the token is never
echoed.

## Limitations

- **Environment must exist in the caller repo.** The publish workflow uses
  `environment: catalog-publish`. GitHub auto-creates it on first use (no
  rules); create it explicitly to add branch protection / reviewers.
- **Token must be a repository secret.** A caller job that calls a reusable
  workflow cannot set `environment:`, so the token is resolved at caller scope
  where only repository-level secrets are visible. Set
  `ORGSDK_PUBLISH_TOKEN` as a repository secret (an environment secret of the
  same name would take precedence *inside* the called workflow, but cannot be
  the sole source).
- **Variables are not inherited.** GitHub does not auto-forward repo variables
  to a called workflow, so the caller passes them as inputs
  (`catalog-url`, `publish-enabled`). Secrets are mapped explicitly (or
  `secrets: inherit`, which still forwards only repository-level secrets).
- **One plugin per repo.** The workflows assume the standard layout
  (`plugin/` source, root `package.json`). Multi-plugin repos should call the
  reusable workflows per-plugin with `--root`/`--plugin-dir` in their own
  scripts.
- **`workflow_call` cannot be combined with other triggers in the same file.**
  The reusable workflow files contain only `workflow_call`; the caller owns the
  `on:` triggers.
- **Version history depth.** `fetch-depth: 0` fetches full history. On very
  large repos this adds checkout time but is required so the version guard can
  resolve `github.event.before` and PR merge-bases.
