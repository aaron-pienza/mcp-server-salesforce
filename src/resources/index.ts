import type { Resource, TextResourceContents } from "@modelcontextprotocol/sdk/types.js";
import { SALESFORCE_GUIDE_CONTENT } from "./salesforceGuide.js";
import { SETUP_GUIDE_CONTENT } from "./setupGuide.js";

const GUIDE_URI = "salesforce://guide";
const SETUP_URI = "salesforce://setup";

export const RESOURCES: Resource[] = [
  {
    uri: GUIDE_URI,
    name: "Salesforce MCP Tools — Reference Guide",
    description:
      "Comprehensive guide for using the Salesforce MCP tools: which tool to use for each task, known limitations, workarounds, and patterns that work reliably. Read this before working with Salesforce data.",
    mimeType: "text/markdown",
  },
  {
    uri: SETUP_URI,
    name: "Salesforce MCP Integration Setup Guide",
    description:
      "Step-by-step setup instructions for connecting Claude to Salesforce via the MCP server: Salesforce CLI installation, authentication, Claude Code and Claude Desktop configuration, troubleshooting, and security notes.",
    mimeType: "text/markdown",
  },
];

const CONTENT_MAP: Record<string, TextResourceContents> = {
  [GUIDE_URI]: {
    uri: GUIDE_URI,
    mimeType: "text/markdown",
    text: SALESFORCE_GUIDE_CONTENT,
  },
  [SETUP_URI]: {
    uri: SETUP_URI,
    mimeType: "text/markdown",
    text: SETUP_GUIDE_CONTENT,
  },
};

export function getResourceContent(uri: string): TextResourceContents | undefined {
  return CONTENT_MAP[uri];
}
