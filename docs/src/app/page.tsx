'use client';

import React, { useState } from 'react';
import {
  CheckCircle2,
  AlertTriangle,
  XCircle,
  Terminal,
  Activity,
  Database,
  Cpu,
  ShieldCheck,
  Zap,
  Copy,
  Check,
} from 'lucide-react';

export default function HomePage() {
  const [copied, setCopied] = useState(false);
  const [activeTab, setActiveTab] = useState<'cli' | 'vscode' | 'mcp'>('cli');

  const copyCommand = (cmd: string) => {
    navigator.clipboard.writeText(cmd);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div>
      <header>
        <div className="container">
          <nav className="nav">
            <div className="brand">
              <img src="/logo-mark.svg" alt="" className="brand-mark" />
              <span>envpreflight</span>
            </div>
            <div className="nav-links">
              <a href="#features" className="nav-link">Features</a>
              <a href="#terminal" className="nav-link">Terminal Output</a>
              <a href="#surfaces" className="nav-link">Surfaces</a>
              <a
                href="https://github.com/poorvith/envpreflight"
                target="_blank"
                rel="noreferrer"
                className="btn"
              >
                GitHub
              </a>
            </div>
          </nav>
        </div>
      </header>

      <main>
        <section className="hero">
          <div className="container">
            <div className="hero-badge">
              <Zap size={14} />
              <span>One command · Zero config · 0.8s runtime</span>
            </div>
            <h1>Check your machine can actually run this project.</h1>
            <p>
              Before you waste a day finding out it cannot. envpreflight reads the manifests
              already in your repo and checks your local runtimes, services, Docker, ports,
              and environment keys in under 3 seconds.
            </p>

            <div className="hero-actions">
              <div
                className="cmd-box"
                onClick={() => copyCommand('npx envpreflight')}
                role="button"
                tabIndex={0}
              >
                <Terminal size={18} color="#16A34A" />
                <span>npx envpreflight</span>
                {copied ? <Check size={16} color="#16A34A" /> : <Copy size={16} color="#A3A3A3" />}
              </div>
              <a href="#surfaces" className="btn btn-primary">
                Explore 3 Surfaces
              </a>
            </div>

            {/* Interactive Terminal Demo */}
            <div className="terminal-card" id="terminal">
              <div className="terminal-header">
                <div className="terminal-dots">
                  <div className="terminal-dot" />
                  <div className="terminal-dot" />
                  <div className="terminal-dot" />
                </div>
                <div className="terminal-title">envpreflight · fullstack-saas</div>
                <div style={{ width: 40 }} />
              </div>
              <div className="terminal-body">
                <div style={{ color: '#A3A3A3', marginBottom: 12 }}>$ npx envpreflight</div>

                <div style={{ color: '#E5E5E5', fontWeight: 600, marginTop: 16, marginBottom: 6 }}>Runtime</div>
                <div>
                  <span style={{ color: '#16A34A' }}>  ✓</span> <span style={{ color: '#E5E5E5' }}>Node.js       </span> <span style={{ color: '#A3A3A3' }}>20.11.0 (.nvmrc wants 20)</span>
                </div>
                <div>
                  <span style={{ color: '#EF4444' }}>  ✗</span> <span style={{ color: '#E5E5E5' }}>Python        </span> <span style={{ color: '#A3A3A3' }}>3.9.6 (pyproject.toml wants &gt;=3.11)</span>
                </div>
                <div style={{ paddingLeft: 24, color: '#06B6D4' }}>
                  → pyenv install 3.11.7 && pyenv local 3.11.7
                </div>

                <div style={{ color: '#E5E5E5', fontWeight: 600, marginTop: 16, marginBottom: 6 }}>Services</div>
                <div>
                  <span style={{ color: '#16A34A' }}>  ✓</span> <span style={{ color: '#E5E5E5' }}>PostgreSQL    </span> <span style={{ color: '#A3A3A3' }}>reachable on 5432</span>
                </div>
                <div>
                  <span style={{ color: '#EF4444' }}>  ✗</span> <span style={{ color: '#E5E5E5' }}>Redis         </span> <span style={{ color: '#A3A3A3' }}>nothing listening on 6379</span>
                </div>
                <div style={{ paddingLeft: 24, color: '#06B6D4' }}>
                  → docker compose up -d redis
                </div>

                <div style={{ color: '#E5E5E5', fontWeight: 600, marginTop: 16, marginBottom: 6 }}>Environment</div>
                <div>
                  <span style={{ color: '#EAB308' }}>  !</span> <span style={{ color: '#E5E5E5' }}>.env          </span> <span style={{ color: '#A3A3A3' }}>2 keys in .env.example are missing: STRIPE_SECRET_KEY, RESEND_API_KEY</span>
                </div>

                <div style={{ color: '#E5E5E5', fontWeight: 600, marginTop: 16, marginBottom: 6 }}>Ports</div>
                <div>
                  <span style={{ color: '#EF4444' }}>  ✗</span> <span style={{ color: '#E5E5E5' }}>Port 3000     </span> <span style={{ color: '#A3A3A3' }}>in use by node (pid 48213)</span>
                </div>
                <div style={{ paddingLeft: 24, color: '#06B6D4' }}>
                  → kill 48213
                </div>

                <div style={{ marginTop: 24, paddingTop: 12, borderTop: '1px solid #262626', color: '#A3A3A3' }}>
                  <span style={{ color: '#EF4444' }}>3 failed</span> · <span style={{ color: '#EAB308' }}>1 warning</span> · <span style={{ color: '#16A34A' }}>2 passed</span> · <span style={{ color: '#737373' }}>0.8s</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Core Principles & Features */}
        <section className="container" id="features">
          <div className="section-title">
            <h2>Engineered for High-Velocity Devs</h2>
            <p>Every check runs locally with zero configuration and uncompromising privacy.</p>
          </div>

          <div className="grid-3">
            <div className="card">
              <div className="card-icon">
                <Cpu size={22} />
              </div>
              <h3>Automatic Manifest Detection</h3>
              <p>
                Reads <code>.nvmrc</code>, <code>package.json</code>, <code>pyproject.toml</code>, <code>go.mod</code>, <code>rust-toolchain.toml</code>, and <code>docker-compose.yml</code>. Runs only the checks your repo justifies.
              </p>
            </div>

            <div className="card">
              <div className="card-icon">
                <ShieldCheck size={22} />
              </div>
              <h3>Zero Value Leakage</h3>
              <p>
                Compares key diffs between <code>.env.example</code> and <code>.env</code>. Never parses, reads, logs, or transmits secret values. Complete privacy by design.
              </p>
            </div>

            <div className="card">
              <div className="card-icon">
                <Activity size={22} />
              </div>
              <h3>Native Socket Probing</h3>
              <p>
                Probes port availability and database services (Postgres, Redis, MySQL, Mongo) with Node standard library sockets. Zero bloated dependencies.
              </p>
            </div>
          </div>
        </section>

        {/* 3 Surfaces */}
        <section className="container" id="surfaces" style={{ marginBottom: 100 }}>
          <div className="section-title">
            <h2>Three Surfaces · One Core</h2>
            <p>Use envpreflight from the terminal, inside your editor, or connected to AI agents.</p>
          </div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 12, marginBottom: 32 }}>
            <button
              className={`btn ${activeTab === 'cli' ? 'btn-primary' : ''}`}
              onClick={() => setActiveTab('cli')}
            >
              CLI
            </button>
            <button
              className={`btn ${activeTab === 'vscode' ? 'btn-primary' : ''}`}
              onClick={() => setActiveTab('vscode')}
            >
              VS Code Extension
            </button>
            <button
              className={`btn ${activeTab === 'mcp' ? 'btn-primary' : ''}`}
              onClick={() => setActiveTab('mcp')}
            >
              MCP Server (AI Agents)
            </button>
          </div>

          <div className="card" style={{ maxWidth: 820, margin: '0 auto' }}>
            {activeTab === 'cli' && (
              <div>
                <h3>CLI Tool</h3>
                <p style={{ marginBottom: 16 }}>
                  Run in any repository root without installation or install globally:
                </p>
                <div className="cmd-box" style={{ width: '100%', marginBottom: 16 }}>
                  <code>npx envpreflight</code>
                </div>
                <p style={{ fontSize: '0.85rem', color: '#A3A3A3' }}>
                  Supports <code>--json</code>, <code>--fix</code> (interactive), <code>--only &lt;id&gt;</code>, <code>--skip &lt;id&gt;</code>, and <code>--quiet</code>.
                </p>
              </div>
            )}

            {activeTab === 'vscode' && (
              <div>
                <h3>VS Code Extension</h3>
                <p style={{ marginBottom: 16 }}>
                  Silent background checks on workspace open. Aggregate status in the status bar (green/amber/red) and interactive side panel with &ldquo;Run in terminal&rdquo; fix triggers.
                </p>
                <div className="cmd-box" style={{ width: '100%', marginBottom: 16 }}>
                  <code>code --install-extension envpreflight</code>
                </div>
              </div>
            )}

            {activeTab === 'mcp' && (
              <div>
                <h3>Model Context Protocol (MCP) Server</h3>
                <p style={{ marginBottom: 16 }}>
                  Equips Claude Code, Cursor, and Windsurf with the <code>envpreflight_check</code> tool so AI assistants can diagnose setup bottlenecks accurately.
                </p>
                <pre
                  style={{
                    backgroundColor: '#0a0a0a',
                    padding: 16,
                    borderRadius: 6,
                    border: '1px solid #262626',
                    fontSize: '0.85rem',
                    overflowX: 'auto',
                  }}
                >
{`{
  "mcpServers": {
    "envpreflight": {
      "command": "npx",
      "args": ["-y", "@envpreflight/mcp"]
    }
  }
}`}
                </pre>
              </div>
            )}
          </div>
        </section>
      </main>

      <footer>
        <div className="container">
          <p>© 2026 envpreflight. MIT License. Fast, offline, private.</p>
        </div>
      </footer>
    </div>
  );
}
