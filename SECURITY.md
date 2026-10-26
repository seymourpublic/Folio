# Security Policy

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Use GitHub's private reporting instead: go to the [Security tab](https://github.com/naledisandamela/folio/security/advisories/new) and open a draft advisory. This keeps the report private until a fix is available.

Please include:

- The type of issue and which component is affected (`electron/`, `src/`, or `packages/sdk/`)
- Steps to reproduce, ideally with a sample file
- Whether it is exploitable through a document alone, or requires user action
- Any proof-of-concept you have

You should get an initial response within **7 days**. If a fix is needed, we'll keep you updated on progress and credit you in the advisory unless you'd rather stay anonymous.

## Scope

Folio parses untrusted input by design — a PDF from anywhere on the internet is opened with full trust in the parser. Reports in these areas are especially valuable:

| Area | Examples |
| --- | --- |
| Document parsing | Malformed PDFs causing memory exhaustion, infinite loops, or crashes in the render or export path |
| Cryptography | Flaws in encryption (`pdf-encrypt.ts`, `pdf-standard-security.ts`), signing (`pdf-sign.ts`), or timestamping (`rfc3161.ts`) |
| Signature validation | A document that reports a valid signature when it should not, or whose signed content can be altered without detection |
| Redaction and scrubbing | Content that survives redaction or metadata scrubbing and is still recoverable from the exported file |
| Electron surface | Anything escaping the renderer sandbox, or reaching the filesystem or network beyond what the user asked for |
| Plugin runtime | A plugin escaping its intended boundaries |

### Out of scope

- Vulnerabilities in upstream dependencies that already have a public advisory — please open a normal issue so we can bump the version
- Attacks requiring a already-compromised machine or physical access
- Missing hardening that has no demonstrated impact

## A note on trust boundaries

Two things are worth stating plainly, because they set expectations for what counts as a vulnerability:

**Folio executes no PDF JavaScript.** Form logic — calculation, validation, formatting — is *written* as standard Acrobat core-JS actions so that other readers run it, but Folio itself never evaluates JavaScript embedded in a document. A report that depends on Folio executing document script is not applicable.

**Plugins are trusted code.** The plugin runtime is a convenience for extending the command palette, not a sandbox. Anyone installing a plugin is running its author's code. Hardening this is on the roadmap; until then, plugin escapes are a known limitation rather than a vulnerability.

## Supported versions

Folio is pre-1.0. Security fixes land on the latest release only. Once 1.0 ships, this section will describe the supported release window.
