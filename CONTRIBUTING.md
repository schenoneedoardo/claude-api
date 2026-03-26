# Contributing to Claude Proxy

Thanks for your interest in contributing! Here's how you can help.

## Getting Started

1. Fork the repository
2. Clone your fork and install dependencies:
   ```bash
   cd claude-proxy
   pnpm install
   ```
3. Create a feature branch:
   ```bash
   git checkout -b feature/your-feature
   ```
4. Make your changes and test them:
   ```bash
   pnpm dev
   ```

## Development Setup

| Requirement | Version |
|:-----------:|:-------:|
| Node.js     | 20+     |
| pnpm        | Latest  |
| Claude Code | Latest (authenticated) |

Copy the environment config:
```bash
cp .env.example .env
```

## Submitting Changes

1. Commit your changes with a clear message:
   ```bash
   git commit -m "feat: add new feature"
   ```
   We follow [Conventional Commits](https://www.conventionalcommits.org/) style:
   - `feat:` new features
   - `fix:` bug fixes
   - `docs:` documentation changes
   - `refactor:` code refactoring
   - `chore:` maintenance tasks

2. Push to your fork:
   ```bash
   git push origin feature/your-feature
   ```

3. Open a Pull Request against `main`

## Guidelines

- Keep PRs focused — one feature or fix per PR
- Follow the existing code style (TypeScript, Fastify patterns)
- Update documentation if you change public APIs or configuration
- Test your changes locally before submitting

## Reporting Bugs

Use the [Bug Report](https://github.com/schenoneedoardo/claude-api/issues/new?template=bug_report.md) issue template.

## Requesting Features

Use the [Feature Request](https://github.com/schenoneedoardo/claude-api/issues/new?template=feature_request.md) issue template.

## Questions?

Reach out on Discord: **edoquellovero.**
