---
name: rtk-token-efficient-cli
description: Use RTK for token-efficient command output inspection when reading repository structure, git state, diffs, search results, file snippets, tests, lint output, build output, dependency summaries, or large logs. Do not use RTK for secrets, destructive commands, production deploy commands, or cases where exact full output is required.
---

# RTK Token-Efficient CLI Skill

## Purpose

Use RTK (Rust Token Killer) to reduce token usage when inspecting command output, repository structure, git state, diffs, search results, tests, lint output, build output, dependency summaries, and large logs.

RTK is a command-output inspection helper. It is not a replacement for exact output when exact output matters.

## Use When

Use RTK for:

- Inspecting large directory structures.
- Searching code with grep or find.
- Reading files through shell commands.
- Viewing git status, diffs, and recent logs.
- Running tests when summarized output is enough.
- Running lint output when summarized output is enough.
- Running build output when summarized output is enough.
- Viewing dependency summaries.
- Viewing large logs when safe to summarize.

## Do Not Use When

Do not use RTK for:

- Commands that may print secrets, tokens, credentials, cookies, private keys, or environment values.
- Inspecting `.env` files or secret-bearing config files unless the user explicitly asks and it is safe.
- Commands that require exact full output for debugging.
- Commands where summarized output could hide important failures.
- Destructive commands.
- Production deploy commands.
- Commands that mutate data, files, remotes, cloud resources, or databases.

## Safety Rule

Never use RTK as an excuse to inspect sensitive files.

For cookedPrompts, privacy and safety steering remains higher priority than token efficiency.

Do not run commands that may expose:

- API keys
- access tokens
- private keys
- credentials
- customer data
- personal data
- raw private prompt logs
- full model answers

## Command Patterns

Directory listing:

```
rtk ls .
```

File finding:

```
rtk find "*.ts" .
rtk find "*.tsx" .
rtk find "*.md" .
```

Code searching:

```
rtk grep "pattern" .
```

File reading:

```
rtk read path/to/file
```

Git operations:

```
rtk git status
rtk git diff
rtk git log -n 10
```

Test/lint/build summaries:

```
rtk test npm test
rtk test npm run lint
rtk test npm run build
```

Error summaries:

```
rtk err <command>
rtk summary <long command>
```

## Fallback Rule

If `rtk` is not installed or a command fails because RTK is unavailable, fall back to the normal shell command and keep output narrow.

Examples:

- Use `git status --short` instead of full `git status`.
- Use `git diff --stat` before full diff.
- Read targeted file ranges instead of whole files.
- Run targeted tests where possible.

## Exact Output Rule

If a failure is subtle, security-sensitive, or tool output may be truncated incorrectly, rerun the narrow exact command without RTK.

Examples:

- exact TypeScript compiler error lines
- exact failed test assertion
- exact migration error
- exact schema diff
- exact privacy/redaction test failure

## cookedPrompts-Specific Guidance

Use RTK during future Kiro passes for:

- repo structure inspection
- git status and diffs before commit
- searching project files
- reading Markdown planning files
- summarizing test/lint/build output once the app exists

Avoid RTK for:

- raw imported prompt logs
- sensitive demo data
- private user prompt examples
- `.env` or secret files
- cloud/auth/deploy commands in future phases

## Commit Closeout Usage

During Git closeout, prefer:

```
rtk git status
rtk git diff
```

Then run exact commands where needed:

```
git diff --check
git status --short
```

Commit and push commands should be normal git commands, not RTK-wrapped.
