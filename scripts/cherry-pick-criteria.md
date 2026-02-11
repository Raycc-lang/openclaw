# miniAgent Cherry-Pick Criteria

## INCLUDE (Auto-accept)

- Bug fixes (`fix:`, `fix(`)
- Security fixes (`fix(security)`, vulnerability)
- Discord-related updates (`fix(discord)`, `feat(discord)`)
- Core infrastructure (config, gateway, agents, memory)
- Dependencies/build fixes
- Performance improvements
- Documentation fixes (critical only)

## REVIEW (Manual decision)

- New features that might be useful (`feat:`)
- Refactoring (`refactor:`)
- Testing improvements (`test:`)
- CLI improvements

## EXCLUDE (Auto-reject)

- New channels: `irc`, `matrix`, `telegram`, `slack`, `signal`, `imessage`, `feishu`, `line`, `whatsapp`
- Browser/Canvas: `browser`, `canvas`, `a2ui`
- Mobile: `macos`, `ios`, `testflight`
- UI changes: `ui`, `control-ui` (unless critical)
- Documentation: `docs:` (unless security/critical)
- Changelog: `chore:`, `changelog`

## Version Strategy

- Maintain version as `2026.2.X-miniAgent` where X tracks upstream minor version
- Skip version bump commits from upstream
