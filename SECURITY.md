# Security Policy

## Supported Versions

We release patches and bug fixes for the current major version of `envpreflight`.

| Version | Supported          |
| ------- | ------------------ |
| 0.1.x / 1.x   | :white_check_mark: |

---

## Security Architecture

`envpreflight` is designed from the ground up to protect your privacy and local environment:

1. **Zero Network Calls:** The tool runs 100% locally. It never transmits analytics, metrics, or telemetry.
2. **Zero Value Extraction:** When parsing `.env` or `.env.example` files, `envpreflight` only reads key names. It never reads, prints, stores, or logs environment variable values.
3. **Bounded Execution:** Every external command execution has a strict 2-second timeout to prevent hung processes.

---

## Reporting a Vulnerability

If you discover a security vulnerability or privacy bug in `envpreflight`, please do not open a public issue.

Instead, please report it privately:

- **Email:** `poorvithmp.work@gmail.com`
- **Subject:** `[Security] envpreflight vulnerability report`

Please include:
- A description of the vulnerability and its potential impact
- Steps or a minimal reproduction repository to reproduce the issue
- Any potential fixes or mitigations you recommend

You will receive an acknowledgment within 48 hours, and a patch will be released promptly after verification.
