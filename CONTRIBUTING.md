# Contributing to envpreflight

Hey! Thanks for checking out `envpreflight`. Whether you're fixing a bug, adding a new runtime check, or improving docs, contributions are welcome.

Here's how to get set up and work on this repo without any friction.

---

## Quick Setup

1. **Clone the repo:**
   ```bash
   git clone https://github.com/poorvith-mp/envpreflight.git
   cd envpreflight
   ```

2. **Install dependencies:**
   ```bash
   pnpm install
   ```

3. **Run tests:**
   ```bash
   pnpm test
   ```

4. **Build everything:**
   ```bash
   pnpm run build
   ```

---

## Monorepo Layout

- `packages/core`: Pure check logic for runtimes, services, Docker, ports, and env vars. **Must have zero UI dependencies and never write to stdout directly.**
- `packages/cli`: The commander CLI and terminal renderer.
- `packages/vscode`: The VS Code extension.
- `packages/mcp`: The Model Context Protocol server for AI coding agents.
- `docs`: Next.js static documentation site.

---

## Development Guidelines

A few hard rules we keep across the codebase:

1. **Zero network calls in the check path.** All checks must run completely offline. No telemetry, no remote registry queries.
2. **Never read or leak env var values.** We only parse and diff key names. Values must never be read, printed, or transmitted.
3. **2-second timeout on all external commands.** Any command run via `execa` or child process must have a 2000ms timeout so things don't hang.
4. **Test your changes.** We use `vitest`. If you add or change a check, write a test for it first (covering pass, fail, absent, and malformed cases).

---

## Submitting a PR

1. Fork the repository and create a feature branch (`git checkout -b feat/my-new-check`).
2. Make your changes and make sure all tests pass (`pnpm test`).
3. Commit with clear, conventional commit messages (`feat: ...`, `fix: ...`).
4. Push to your branch and open a Pull Request.

I'll review your PR as quickly as possible. Thanks for helping make local dev setup faster for everyone!
