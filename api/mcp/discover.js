/**
 * api/mcp/discover.js
 * GET — MCP discovery endpoint.
 *   Without x-api-key: public tool list (name, description, requiresApproval).
 *   With x-api-key === process.env.MCP_API_KEY: full JSON schemas + metadata.
 */
import { MCP_REGISTRY } from "../../backend/lib/mcp/registry.js";

export default async function handler(req, res) {
  if (req.method !== "GET") return res.status(405).json({ error: "Method not allowed" });

  const key = req.headers["x-api-key"];
  const authenticated = Boolean(process.env.MCP_API_KEY && key && key === process.env.MCP_API_KEY);

  const tools = MCP_REGISTRY.map((t) => {
    const pub = {
      name: t.name,
      description: t.description,
      requiresApproval: t.requiresApproval,
    };
    if (authenticated) {
      pub.squadAccess = t.squadAccess;
      pub.costEstimate = t.costEstimate;
      pub.rateLimit = t.rateLimit;
      pub.parameters = t.parameters;
    }
    return pub;
  });

  return res.status(200).json({
    name: "Qimmah Digital Command Center",
    version: "1.0.0",
    protocol: "mcp-v1",
    authenticated,
    tools,
    endpoints: {
      execute: "/api/agents/execute-tool",
      approve: "/api/mcp/approve",
      discover: "/api/mcp/discover",
    },
  });
}
