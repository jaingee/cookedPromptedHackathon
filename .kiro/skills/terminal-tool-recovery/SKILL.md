---
name: terminal-tool-recovery
description: Use when shell, PowerShell, RTK, npm, git, or command execution tools fail repeatedly. Prevents retry loops by requiring diagnosis, fallback, and clear blocker reporting.
---

# Terminal Tool Recovery Skill

## Purpose

Prevent Kiro from getting stuck repeatedly calling a failing terminal tool, especially `execute_pwsh`.

## Core Rule

If the same terminal tool or same command fails twice in a row, **stop retrying it unchanged**.

- Do not attempt the same failing `execute_pwsh` command repeatedly.
- After two failures, switch strategy.

## Recovery Steps

### 1. Capture the exact failure type

- command not found
- shell/tool unavailable
- quoting/syntax error
- permission/path error
- dependency missing
- command timed out
- native package/build error
- unknown tool failure

### 2. Simplify the command

- use `pwd` / `Get-Location`
- use `git status --short`
- use `npm --version`
- use `node --version`
- use a targeted file read instead of a broad command

### 3. Change one variable at a time

- different shell/tool if available
- narrower command
- safer quoting
- shorter path
- no pipes/redirection
- no command chaining

### 4. If PowerShell-specific execution fails

- Do not keep using `execute_pwsh`.
- Try `cmd /c "command"` syntax if available.
- Avoid PowerShell-only constructs unless required.
- Use Node/npm/git commands directly where possible.

### 5. If RTK fails

- Fall back to narrow exact commands.
- Do not wrap commit/push commands in RTK.

### 6. If the tool itself appears broken

- Stop.
- Explain the blocker.
- State the exact command attempted.
- State what fallback was tried.
- Ask for user/environment help only after a best-effort diagnosis.

## Retry Budget

For one task:

- **Max 2 attempts** for the same exact command.
- **Max 3 attempts** for the same terminal tool if the tool itself is failing.
- After that, **stop and report the blocker**.
- Do not spend the whole pass retrying the same tool.

## Good Behavior Examples

**Bad:**

```
execute_pwsh npm test
execute_pwsh npm test
execute_pwsh npm test
execute_pwsh npm test
```

**Good:**

```
Attempt 1: npm test via execute_pwsh failed.
Attempt 2: npm test via execute_pwsh failed again.
Stop using execute_pwsh.
Try: npm --version using cmd /c, or run a narrower command.
If that also fails, report terminal tool failure and do not continue retrying.
```

## Git Rules

Normal Git commands should not be RTK-wrapped when exact behavior matters.

Use exact commands for:

- `git status --short`
- `git diff --check`
- `git add .`
- `git commit -m "..."`
- `git push origin main`

If Git commands fail twice because the terminal tool is broken, stop and report the blocker rather than retrying blindly.

## Package Install Rules

For native packages such as `better-sqlite3`:

- Run package install in a normal shell command.
- Capture exact install error if it fails.
- Do not repeat the same failing install more than twice.
- Check Node version and npm version.
- If native/prebuild error occurs, report it clearly and suggest fallback path.
- Do not switch SQLite libraries silently without updating design/tasks.

## Final Reporting Rule

When a terminal/tool blocker occurs, report:

- command attempted
- tool used
- exact failure summary
- fallback attempted
- current repo state if known
- whether working tree is clean
- recommended next user action
