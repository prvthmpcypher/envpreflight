import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { runAllChecks, detectManifests, type Report } from '@envpreflight/core';

export function createMcpServer(): Server {
  const server = new Server(
    {
      name: 'envpreflight-mcp',
      version: '0.1.0',
    },
    {
      capabilities: {
        tools: {},
      },
    }
  );

  // List available tools
  server.setRequestHandler(ListToolsRequestSchema, async () => {
    return {
      tools: [
        {
          name: 'envpreflight_check',
          description:
            'Run zero-config dev environment preflight checks against repository manifests (Node, Python, Go, Rust, Docker, services, ports, env keys) to verify local environment health with zero network calls.',
          inputSchema: {
            type: 'object',
            properties: {
              path: {
                type: 'string',
                description: 'Path to the repository/project root to inspect. Defaults to current working directory.',
              },
            },
          },
        },
      ],
    };
  });

  // Handle tool execution
  server.setRequestHandler(CallToolRequestSchema, async (request) => {
    if (request.params.name !== 'envpreflight_check') {
      throw new Error(`Unknown tool: ${request.params.name}`);
    }

    const args = request.params.arguments as { path?: string } | undefined;
    const targetDir = args?.path || process.cwd();

    const manifests = await detectManifests(targetDir);
    let report: Report;

    if (manifests.manifestFiles.length === 0) {
      report = {
        results: [],
        exitCode: 0,
        durationMs: 0,
        projectName: 'unknown',
      };
    } else {
      report = await runAllChecks(targetDir);
    }

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify(report, null, 2),
        },
      ],
    };
  });

  return server;
}

export async function runMcpServer() {
  const server = createMcpServer();
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

// Auto-run if executed directly as entrypoint
if (process.argv[1] && process.argv[1].endsWith('index.js')) {
  runMcpServer().catch((err) => {
    console.error('MCP Server Error:', err);
    process.exit(1);
  });
}
