import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import * as os from 'node:os';
import { InMemoryTransport } from '@modelcontextprotocol/sdk/inMemory.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { createMcpServer } from '../src/index.js';

describe('MCP Server', () => {
  let tempDir: string;
  let client: Client;
  let clientTransport: InMemoryTransport;
  let serverTransport: InMemoryTransport;

  beforeEach(async () => {
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'envpreflight-mcp-test-'));

    const server = createMcpServer();
    [clientTransport, serverTransport] = InMemoryTransport.createLinkedPair();

    client = new Client(
      {
        name: 'test-client',
        version: '1.0.0',
      },
      {
        capabilities: {},
      }
    );

    await Promise.all([
      client.connect(clientTransport),
      server.connect(serverTransport),
    ]);
  });

  afterEach(async () => {
    await client.close();
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  it('lists the envpreflight_check tool', async () => {
    const list = await client.listTools();
    expect(list.tools).toHaveLength(1);
    expect(list.tools[0].name).toBe('envpreflight_check');
  });

  it('executes envpreflight_check tool and returns valid JSON Report', async () => {
    await fs.writeFile(
      path.join(tempDir, 'package.json'),
      JSON.stringify({ name: 'mcp-test-app', engines: { node: '>=18.0.0' } })
    );

    const result = await client.callTool({
      name: 'envpreflight_check',
      arguments: {
        path: tempDir,
      },
    });

    expect(result.content).toBeDefined();
    expect(result.content[0].type).toBe('text');

    const report = JSON.parse((result.content[0] as any).text);
    expect(report.projectName).toBe('mcp-test-app');
    expect(Array.isArray(report.results)).toBe(true);
  });
});
