export const SETUP_GUIDE_CONTENT = `# Salesforce MCP Integration Setup Guide (v1.1.0)

Connect Claude to your Salesforce production org using the Model Context Protocol (MCP). This gives you the ability to query records, inspect schemas, manage data, and work with Apex code — all through natural language in Claude.

## Migrating from @tsmztech/mcp-server-salesforce

If you previously set up the \`@tsmztech\` version, update to the new package:

**Claude Code:**

\`\`\`bash
claude mcp remove salesforce
claude mcp add-json "salesforce" '{"command":"npx","args":["-y","@aaron-pienza/mcp-server-salesforce"],"env":{"SALESFORCE_CONNECTION_TYPE":"Salesforce_CLI"}}' -s user
\`\`\`

**Claude Desktop:** Replace the \`salesforce\` block in \`~/Library/Application Support/Claude/claude_desktop_config.json\`:

\`\`\`json
"salesforce": {
  "command": "npx",
  "args": ["-y", "@aaron-pienza/mcp-server-salesforce"],
  "env": {
    "SALESFORCE_CONNECTION_TYPE": "Salesforce_CLI"
  }
}
\`\`\`

Then fully quit (Cmd+Q) and reopen Claude Desktop.

Your Salesforce CLI auth, default org, and all other settings stay the same — only the package name changes. The new package adds reports/dashboards, REST API passthrough, pagination, and security hardening.

---

## How It Works

A lightweight MCP server runs locally on your machine as a child process of Claude. It connects outbound to Salesforce's REST API over HTTPS using your personal OAuth session managed by the Salesforce CLI. No secrets are stored in any config file. All access is governed by your existing Salesforce profile and permission sets.

## Prerequisites

- **Node.js v18 or later** (v20+ recommended) — check with \`node --version\`
- **Claude Code** (CLI, VS Code extension, or JetBrains plugin) and/or the **Claude desktop app**
- **A Salesforce user account** with API access enabled

## Setup Steps (Fresh Install)

### Step 1: Install the Salesforce CLI

\`\`\`bash
sudo npm install -g @salesforce/cli
sudo chown -R \$(whoami) ~/.npm
\`\`\`

The \`chown\` command fixes npm cache ownership after the \`sudo\` install — without it, \`npx\` will fail with permission errors later.

Verify it's available:

\`\`\`bash
sf --version
\`\`\`

### Step 2: Enable 256-Bit Token Encryption

Before authenticating, enable full 256-bit encryption for stored tokens. Add this to your \`~/.zshrc\` (or equivalent shell profile):

\`\`\`bash
echo 'export SF_CRYPTO_V2=true' >> ~/.zshrc
source ~/.zshrc
\`\`\`

This ensures the Salesforce CLI uses proper AES-256-GCM encryption when storing OAuth tokens. It must be set before your first login.

### Step 3: Authenticate to Salesforce

\`\`\`bash
sf org login web --alias production
\`\`\`

This opens a browser window. Log in with your Salesforce credentials. The CLI stores the resulting OAuth tokens locally (encrypted, with the key in your macOS Keychain) — you only need to do this once.

Verify the connection:

\`\`\`bash
sf org display --target-org production
\`\`\`

### Step 4: Set Your Default Org

\`\`\`bash
sf config set target-org production --global
\`\`\`

The \`--global\` flag is required — without it, the command expects a Salesforce DX project directory.

### Step 5: Add the MCP Server to Claude

Choose the setup for the Claude product(s) you use. You can do both.

#### Option A: Claude Code (CLI / VS Code / JetBrains)

Run this command in your terminal:

\`\`\`bash
claude mcp add-json "salesforce" '{"command":"npx","args":["-y","@aaron-pienza/mcp-server-salesforce"],"env":{"SALESFORCE_CONNECTION_TYPE":"Salesforce_CLI"}}' -s user
\`\`\`

This registers the Salesforce MCP server in your user-level Claude Code settings (\`~/.claude/settings.json\`), making it available across all projects.

#### Option B: Claude Desktop App

Edit the desktop app config file:

\`\`\`
~/Library/Application Support/Claude/claude_desktop_config.json
\`\`\`

Add the \`salesforce\` entry inside the \`mcpServers\` object:

\`\`\`json
{
  "mcpServers": {
    "salesforce": {
      "command": "npx",
      "args": ["-y", "@aaron-pienza/mcp-server-salesforce"],
      "env": {
        "SALESFORCE_CONNECTION_TYPE": "Salesforce_CLI"
      }
    }
  }
}
\`\`\`

If the file already has other entries in \`mcpServers\`, add the \`"salesforce": { ... }\` block alongside them.

After saving, **fully quit the Claude desktop app** (Cmd+Q, not just close the window) and reopen it.

> **Note:** Local MCP servers do **not** appear in the "Connectors" menu. Instead, look for the tools/hammer icon in the chat input area — that's where your Salesforce MCP tools will show up.

### Step 6: Verify the Connection

You can test that the MCP server starts correctly before involving Claude:

\`\`\`bash
npx -y @aaron-pienza/mcp-server-salesforce
\`\`\`

You should see \`Salesforce MCP Server running on stdio\`. This means the server started and is waiting for input. Press Ctrl+C to stop it.

Then open Claude (Code or desktop) and ask something like:

> "List the fields on the Account object."

If the MCP server is working, Claude will query Salesforce and return the schema.

### Step 7: Point Claude to the Salesforce Guide

This repository contains a reference guide (\`SALESFORCE_GUIDE.md\`) that teaches Claude how to use the Salesforce MCP tools effectively — which tool to use for each task, known limitations, and workarounds. Without it, Claude may take inconsistent or broken approaches.

Add this line to your **global** \`~/.claude/CLAUDE.md\`, replacing the path with the actual location of this repository on your machine:

\`\`\`
When using Salesforce MCP tools, read /path/to/sfdc-mcp/SALESFORCE_GUIDE.md first.
\`\`\`

For example, if you cloned this repo to \`~/repos/sfdc-mcp\`:

\`\`\`
When using Salesforce MCP tools, read ~/repos/sfdc-mcp/SALESFORCE_GUIDE.md first.
\`\`\`

If \`~/.claude/CLAUDE.md\` doesn't exist yet, create it:

\`\`\`bash
echo 'When using Salesforce MCP tools, read ~/repos/sfdc-mcp/SALESFORCE_GUIDE.md first.' >> ~/.claude/CLAUDE.md
\`\`\`

The global \`CLAUDE.md\` is loaded into every Claude Code session regardless of which directory you're working in. The guide itself stays up to date when you \`git pull\` this repository.

## What You Can Do

Once connected, Claude can:

- **Query records** — SOQL queries with relationship support, complex filters, aggregations, and pagination
- **Modify records** — Insert, update, delete, and upsert operations
- **Search across objects** — SOSL-based cross-object search
- **Inspect schemas** — Describe objects, fields, relationships, and picklist values
- **Manage custom objects and fields** — Create and modify custom objects and fields, including field-level security
- **Work with Apex** — Read, create, and update Apex classes and triggers; execute anonymous Apex
- **Manage debug logs** — Enable, disable, and retrieve debug logs for specific users
- **Reports & Dashboards** — List, describe, run reports with filter overrides, and retrieve dashboard data
- **REST API passthrough** — Call any Salesforce REST endpoint directly (Composite API, Files, Limits, etc.)

## Troubleshooting

### MCP server fails to connect

1. **Salesforce CLI not authenticated** — run \`sf org display\` to check. If it fails, re-authenticate with \`sf org login web --alias production\`.
2. **No default org set** — run \`sf config set target-org production --global\`.
3. **API access not enabled** — your Salesforce profile must have "API Enabled" permission. Contact your Salesforce admin.
4. **Node.js not installed or below v18** — check with \`node --version\`.

### npm cache errors (EEXIST, EACCES, TAR_ENTRY_ERROR)

These typically occur when \`sudo npm install -g\` corrupts the npm cache with root-owned files. Fix with:

\`\`\`bash
sudo chown -R \$(whoami) ~/.npm
\`\`\`

If that doesn't resolve it, clear the corrupted cache entirely:

\`\`\`bash
rm -rf ~/.npm/_npx
rm -rf ~/.npm/_cacache
\`\`\`

Then restart Claude. The MCP server package will be re-downloaded fresh.

### When to Re-Authenticate

You'll need to run \`sf org login web --alias production\` again if:

- Your refresh token expires (configurable by Salesforce admins — default is no expiration, but many orgs enforce a rotation policy such as 90 days)
- An admin revokes your OAuth session from Salesforce Setup
- You explicitly log out with \`sf org logout\`
- Your Salesforce password is reset (may invalidate sessions depending on org policy)

## Security Notes

- **No secrets in config files.** The MCP config contains zero credentials. The Salesforce CLI handles all token management.
- **Per-user identity.** Each developer authenticates as themselves. Salesforce audit logs accurately reflect who performed each action.
- **Standard Salesforce security applies.** Your access is governed by your own profile and permission sets.
- **No network exposure.** The MCP server runs locally and does not listen on any port.

### How Token Storage Works

The Salesforce CLI stores auth files in \`~/.sfdx/\` (e.g., \`~/.sfdx/username@org.json\`). These files contain **AES-256-GCM encrypted** tokens, not plaintext. The encryption key is stored in the **macOS Keychain** (under service \`sfdx\`, account \`local\`), so the token files are useless without Keychain access.

**256-bit encryption:** If you followed the setup steps above, you already have v2 (256-bit) encryption enabled via Step 2. If you set up the Salesforce CLI before this guide existed and are still on v1 (128-bit), you can upgrade by deleting the old key and re-authenticating:

\`\`\`bash
export SF_CRYPTO_V2=true
sf org logout --target-org production --no-prompt
security delete-generic-password -a local -s sfdx
sf org login web --alias production
sf config set target-org production --global
\`\`\`

The \`security delete-generic-password\` step is required — without it, the CLI reuses the existing v1 key. Add \`export SF_CRYPTO_V2=true\` to your \`~/.zshrc\` to make it permanent.

To verify which version you're on, check the key length (64 chars = v2/256-bit, 32 chars = v1/128-bit):

\`\`\`bash
security find-generic-password -a local -s sfdx -w | wc -c
\`\`\`

**Additional hardening:**

- **FileVault** — ensure full disk encryption is enabled (\`fdesetup status\`). This protects token files when your machine is off or locked.
- **File permissions** — tighten auth file permissions to owner-only: \`chmod 600 ~/.sfdx/*.json\`
- **If your laptop is compromised** — an attacker with access to your unlocked Mac (including Keychain) could decrypt the tokens. In this scenario, have your Salesforce admin revoke your OAuth session from Salesforce Setup immediately. This kills both the access and refresh tokens.

## Architecture

\`\`\`
Developer's Machine
┌──────────────────────────────────────────────────┐
│                                                  │
│  ┌──────────────┐  stdio  ┌──────────────┐      │
│  │ Claude       │◄───────►│ MCP Server   │      │
│  │ (Code or     │         │ (local       │      │
│  │  Desktop)    │         │  process)    │      │
│  └──────────────┘         └──────┬───────┘      │
│                                  │               │
│  ┌──────────────┐   token        │               │
│  │ Salesforce   │   retrieval    │               │
│  │ CLI (sf)     │◄───────────────┘               │
│  └──────┬───────┘                                │
│         │ stored refresh token                   │
│         │ (managed by CLI)                       │
└─────────┼────────────────────────────────────────┘
          │
          │ HTTPS (outbound only)
          ▼
┌──────────────────┐
│    Salesforce    │
│  Production Org  │
│                  │
│  (profiles,      │
│   permissions,   │
│   field security │
│   all enforced)  │
└──────────────────┘
\`\`\`

## Questions or Issues

- **Salesforce MCP server issues:** https://github.com/aaron-pienza/mcp-server-salesforce/issues
- **Upstream (tsmztech) repo:** https://github.com/tsmztech/mcp-server-salesforce/issues
- **Claude Code issues:** https://github.com/anthropics/claude-code/issues`;
