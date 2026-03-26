# Security Policy

## Supported Versions

| Version | Supported          |
|:-------:|:------------------:|
| latest  | :white_check_mark: |

## Reporting a Vulnerability

If you discover a security vulnerability in Claude Proxy, please report it responsibly.

**Do NOT open a public issue.** Instead:

1. Contact **edoquellovero.** on Discord
2. Or email the maintainer directly

Please include:
- A description of the vulnerability
- Steps to reproduce the issue
- Potential impact
- Suggested fix (if any)

## Response Timeline

- **Acknowledgment**: within 48 hours
- **Initial assessment**: within 1 week
- **Fix or mitigation**: as soon as possible, depending on severity

## Scope

This policy covers the Claude Proxy codebase. Issues related to Claude Code CLI itself or Anthropic's services should be reported directly to [Anthropic](https://www.anthropic.com/).

## Best Practices

When running Claude Proxy:
- Always set a `PROXY_API_KEY` to protect your instance
- Bind to `127.0.0.1` (default) — do not expose to the public internet without proper security measures
- Keep your Claude Code CLI and Node.js up to date
