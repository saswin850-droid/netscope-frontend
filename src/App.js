/* eslint-disable react-hooks/exhaustive-deps */
import React, {
  useState, useEffect, useRef, useCallback, useMemo,
} from "react";
import { io } from "socket.io-client";
import D3Graph from "./D3Graph";

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL || "http://localhost:4000";

function cls(...args) { return args.filter(Boolean).join(" "); }

const PORT_BADGE = {
  http:  "bg-cyan-900 text-cyan-300 border-cyan-700",
  https: "bg-blue-900 text-blue-300 border-blue-700",
  ssh:   "bg-rose-900 text-rose-300 border-rose-700",
  ftp:   "bg-orange-900 text-orange-300 border-orange-700",
  smtp:  "bg-purple-900 text-purple-300 border-purple-700",
  dns:   "bg-green-900 text-green-300 border-green-700",
  rdp:   "bg-red-900 text-red-300 border-red-700",
};
function portBadge(service) {
  return PORT_BADGE[service?.toLowerCase()] || "bg-slate-800 text-slate-300 border-slate-600";
}

function osLabel(name) {
  if (!name) return { icon: "❓", label: "Unknown" };
  const n = name.toLowerCase();
  if (n.includes("windows")) return { icon: "🪟", label: name };
  if (n.includes("linux"))   return { icon: "🐧", label: name };
  if (n.includes("mac"))     return { icon: "🍎", label: name };
  if (n.includes("android")) return { icon: "🤖", label: name };
  return { icon: "💻", label: name };
}

function StatusBadge({ connected }) {
  return (
    <div className={cls(
      "flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono border",
      connected
        ? "bg-cyan-950 border-cyan-700 text-cyan-400"
        : "bg-red-950 border-red-700 text-red-400"
    )}>
      <span className={cls(
        "w-2 h-2 rounded-full",
        connected ? "bg-cyan-400 animate-pulse" : "bg-red-400"
      )} />
      {connected ? "CONNECTED" : "OFFLINE"}
    </div>
  );
}

function ProgressBar({ percent, scanning }) {
  return (
    <div className="w-full bg-slate-900 rounded-full h-2 border border-slate-700 overflow-hidden">
      <div
        className={cls(
          "h-full rounded-full transition-all duration-500",
          scanning
            ? "bg-gradient-to-r from-cyan-500 to-cyan-300"
            : percent >= 100
              ? "bg-gradient-to-r from-green-600 to-green-400"
              : "bg-slate-700"
        )}
        style={{ width: `${Math.min(100, percent)}%` }}
      />
    </div>
  );
}

function Terminal({ lines, scanning }) {
  const bottomRef = useRef(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [lines]);

  return (
    <div
      className="relative bg-black rounded-lg border border-cyan-900/50 overflow-hidden"
      style={{ fontFamily: "'Share Tech Mono', monospace" }}
    >
      <div className="flex items-center gap-2 px-4 py-2 bg-slate-950 border-b border-cyan-900/30">
        <span className="w-3 h-3 rounded-full bg-red-500" />
        <span className="w-3 h-3 rounded-full bg-yellow-500" />
        <span className="w-3 h-3 rounded-full bg-green-500" />
        <span className="ml-3 text-xs text-cyan-600">nmap — terminal</span>
        {scanning && (
          <span className="ml-auto flex items-center gap-1 text-xs text-cyan-400 animate-pulse">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-ping" />
            SCANNING
          </span>
        )}
      </div>

      <div
        className="h-64 overflow-y-auto p-4 text-xs leading-relaxed"
        style={{ scrollbarWidth: "thin", scrollbarColor: "#00f5ff33 transparent" }}
      >
        {lines.length === 0 ? (
          <p className="text-cyan-900">{">"} Awaiting target input…</p>
        ) : (
          lines.map((line, i) => {
            const isError   = line.startsWith("[stderr]") || line.includes("ERROR");
            const isSuccess = line.startsWith("[✓]");
            const isWarn    = line.startsWith("[!]");
            const isInfo    = line.startsWith("[*]");
            return (
              <p
                key={i}
                className={cls(
                  "whitespace-pre-wrap break-all",
                  isError   ? "text-red-400"
                  : isSuccess ? "text-green-400"
                  : isWarn    ? "text-yellow-400"
                  : isInfo    ? "text-cyan-300"
                  : "text-cyan-600"
                )}
              >
                {line}
              </p>
            );
          })
        )}
        <div ref={bottomRef} />
      </div>
    </div>
  );
}

function DeviceCard({ device, expanded, onToggle }) {
  const os = osLabel(device.osName);
  return (
    <div className="border border-cyan-900/40 rounded-lg overflow-hidden bg-slate-950/60 transition-all hover:border-cyan-700/60">
      <button
        onClick={onToggle}
        className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-cyan-950/30 transition-colors"
      >
        <span className="text-xl">{os.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-cyan-300 font-mono">{device.ip}</div>
          {device.hostnames?.length > 0 && (
            <div className="text-xs text-cyan-600 truncate">{device.hostnames.join(", ")}</div>
          )}
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span className="text-xs text-slate-500 font-mono">
            {device.ports?.length || 0} ports
          </span>
          {device.macVendor && (
            <span className="hidden sm:block text-xs bg-slate-800 text-slate-400 px-2 py-0.5 rounded border border-slate-700">
              {device.macVendor}
            </span>
          )}
          <span className={cls(
            "px-2 py-0.5 rounded-full text-xs border",
            device.status === "up"
              ? "bg-green-950 text-green-400 border-green-800"
              : "bg-red-950 text-red-400 border-red-800"
          )}>
            {device.status}
          </span>
          <span className={cls(
            "transition-transform duration-200 text-cyan-600",
            expanded ? "rotate-180" : ""
          )}>▾</span>
        </div>
      </button>

      {expanded && (
        <div className="border-t border-cyan-900/30 px-4 py-3 space-y-3">
          {device.osName && (
            <div className="text-xs font-mono">
              <span className="text-slate-500">OS: </span>
              <span className="text-cyan-400">{device.osName}</span>
              {device.osAccuracy > 0 && (
                <span className="text-slate-600 ml-1">({device.osAccuracy}%)</span>
              )}
            </div>
          )}
          {device.mac && (
            <div className="text-xs font-mono">
              <span className="text-slate-500">MAC: </span>
              <span className="text-slate-400">{device.mac}</span>
            </div>
          )}
          {device.ports?.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full text-xs font-mono">
                <thead>
                  <tr className="text-slate-600 border-b border-slate-800">
                    <th className="text-left py-1 pr-4">PORT</th>
                    <th className="text-left py-1 pr-4">PROTO</th>
                    <th className="text-left py-1 pr-4">SERVICE</th>
                    <th className="text-left py-1">VERSION</th>
                  </tr>
                </thead>
                <tbody>
                  {device.ports.map((p, i) => (
                    <tr key={i} className="border-b border-slate-900/50 hover:bg-cyan-950/20">
                      <td className="py-1 pr-4">
                        <span className={cls(
                          "px-1.5 py-0.5 rounded border text-xs",
                          portBadge(p.service)
                        )}>
                          {p.port}
                        </span>
                      </td>
                      <td className="py-1 pr-4 text-slate-500">{p.protocol}</td>
                      <td className="py-1 pr-4 text-cyan-400">{p.service || "—"}</td>
                      <td className="py-1 text-slate-400 truncate max-w-[140px]">
                        {[p.product, p.version, p.extrainfo].filter(Boolean).join(" ") || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-xs text-slate-600">No open ports detected.</div>
          )}
        </div>
      )}
    </div>
  );
}

function ScanHistory({ history, onSelect, sidebarOpen }) {
  return (
   <div style={{
      position: "fixed",
      top: 0,
      left: 0,
      height: "100%",
      width: "260px",
      zIndex: 40,
      background: "#020a14",
      borderRight: "1px solid #164e63",
      display: sidebarOpen ? "flex" : "none",
      flexDirection: "column",
    }}>
      <div className="px-4 py-4 border-b border-cyan-900/30">
        <h2 className="text-xs font-mono text-cyan-500 tracking-widest uppercase">Scan History</h2>
      </div>
      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {history.length === 0 ? (
          <p className="text-xs text-slate-600 font-mono px-2">No scans yet.</p>
        ) : (
          history.map((h, i) => (
            <button
              key={i}
              onClick={() => onSelect(h)}
              className="w-full text-left px-3 py-2 rounded bg-slate-900 hover:bg-cyan-950/50 border border-slate-800 hover:border-cyan-800 transition-colors"
            >
              <div className="text-xs text-cyan-400 font-mono truncate">{h.target}</div>
              <div className="text-xs text-slate-600 font-mono">{new Date(h.timestamp).toLocaleTimeString()}</div>
              <div className="text-xs text-green-500 font-mono">{h.devices?.length || 0} hosts</div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

export default function App() {
  const socketRef = useRef(null);
  const [connected, setConnected]         = useState(false);
  const [target, setTarget]               = useState("");
  const [scanning, setScanning]           = useState(false);
  const [progress, setProgress]           = useState(0);
  const [terminalLines, setLines]         = useState([]);
  const [devices, setDevices]             = useState([]);
  const [scanMeta, setScanMeta]           = useState(null);
  const [expandedId, setExpandedId]       = useState(null);
  const [error, setError]                 = useState("");
  const [scanType,  setScanType]          = useState("syn");
  const [timing,    setTiming]            = useState(3);
  const [osDetect,  setOsDetect]          = useState(true);
  const [verDetect, setVerDetect]         = useState(true);
  const [topPorts,  setTopPorts]          = useState(true);
  const [safeMode,  setSafeMode]          = useState(true);
  const [activeTab,    setActiveTab]      = useState("devices");
  const [sidebarOpen,  setSidebarOpen]    = useState(false);
  const [history,      setHistory]        = useState([]);
  const [selectedNode, setSelectedNode]   = useState(null);

  useEffect(() => {
    const socket = io(BACKEND_URL, { transports: ["websocket"] });
    socketRef.current = socket;

    socket.on("connect",    () => setConnected(true));
    socket.on("disconnect", () => setConnected(false));

    socket.on("terminal-line", (line) => {
      setLines((prev) => [...prev.slice(-500), line]);
    });

    socket.on("scan-started", ({ target: t }) => {
      setScanning(true);
      setProgress(1);
      setError("");
      setDevices([]);
      setScanMeta({ target: t, startTime: Date.now() });
    });

    socket.on("scan-progress", ({ percent }) => {
      setProgress(percent);
    });

    socket.on("scan-result", (result) => {
      setDevices(result.devices || []);
      setScanMeta((prev) => ({ ...prev, ...result.summary }));
    });

    socket.on("scan-complete", ({ aborted } = {}) => {
      setScanning(false);
      setProgress(100);
      if (!aborted) {
        setHistory((prev) => [
          {
            target: scanMeta?.target || "Unknown",
            timestamp: Date.now(),
            devices: devices,
          },
          ...prev.slice(0, 19),
        ]);
      }
    });

    socket.on("scan-error", ({ message }) => {
      setScanning(false);
      setError(message);
      setLines((prev) => [...prev, `[ERROR] ${message}\n`]);
    });

    return () => socket.disconnect();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startScan = useCallback(() => {
    if (!target.trim()) { setError("Please enter a target."); return; }
    setError("");
    setLines([]);
    setProgress(0);
    socketRef.current?.emit("start-scan", {
      target,
      options: { scanType, timing, osDetection: osDetect, versionDetection: verDetect, topPorts },
    });
  }, [target, scanType, timing, osDetect, verDetect, topPorts]);

  const stopScan = useCallback(() => {
    socketRef.current?.emit("stop-scan");
  }, []);

  const graphData = useMemo(() => ({
    target: scanMeta?.target,
    devices,
  }), [devices, scanMeta]);

  const upCount   = devices.filter((d) => d.status === "up").length;
  const portCount = devices.reduce((s, d) => s + (d.ports?.length || 0), 0);

  return (
    <div
      className="min-h-screen bg-[#030a0f] text-slate-200"
      style={{ fontFamily: "'Rajdhani', sans-serif" }}
    >
      {sidebarOpen && (
        <div
          onClick={() => setSidebarOpen(false)}
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(0,0,0,0.6)",
            zIndex: 30,
          }}
        />
      )}
      <ScanHistory
        history={history}
        sidebarOpen={sidebarOpen}
        onSelect={(h) => {
          setDevices(h.devices);
          setScanMeta({ target: h.target, timestamp: h.timestamp });
          setSidebarOpen(false);
        }}
      />

      <header className="sticky top-0 z-20 bg-slate-950/90 backdrop-blur border-b border-cyan-900/40 px-4 py-3 flex items-center gap-3">
        <button
          onClick={() => setSidebarOpen(!sidebarOpen)}
          className="p-2 rounded hover:bg-cyan-950/50 text-cyan-600 hover:text-cyan-400 transition-colors"
        >
          ☰
        </button>
        <div className="flex items-center gap-2 flex-1">
          <span className="text-cyan-400 font-bold text-lg tracking-wider">
            ⚡ NETSCOPE
          </span>
          <span className="hidden sm:block text-xs text-slate-600 font-mono">v2.0 | Network Analyzer</span>
        </div>
        <StatusBadge connected={connected} />
        <button
          onClick={() => setSafeMode(!safeMode)}
          className={cls(
            "hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full text-xs border font-mono transition-colors",
            safeMode
              ? "bg-green-950 border-green-800 text-green-400"
              : "bg-red-950 border-red-800 text-red-400 animate-pulse"
          )}
        >
          <span>{safeMode ? "🛡️" : "⚠️"}</span>
          {safeMode ? "SAFE MODE" : "UNSAFE"}
        </button>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-6 space-y-6">
        <div className="bg-slate-950/80 border border-cyan-900/40 rounded-xl p-5 shadow-lg shadow-cyan-950/20">
          <h2 className="text-xs font-mono text-cyan-600 tracking-widest uppercase mb-4">
            Target Configuration
          </h2>
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              type="text"
              value={target}
              onChange={(e) => setTarget(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !scanning && startScan()}
              placeholder="192.168.1.0/24  |  10.0.0.1  |  example.com"
              className={cls(
                "flex-1 bg-black border rounded-lg px-4 py-3 font-mono text-sm text-cyan-300",
                "placeholder-slate-700 outline-none focus:ring-1",
                "border-cyan-900/50 focus:border-cyan-500 focus:ring-cyan-500/20",
                "transition-colors"
              )}
              disabled={scanning}
            />
            <div className="flex gap-2">
              {scanning ? (
                <button
                  onClick={stopScan}
                  className="px-6 py-3 bg-red-950 hover:bg-red-900 border border-red-700 hover:border-red-500 rounded-lg text-red-400 font-semibold transition-colors text-sm"
                >
                  ■ STOP
                </button>
              ) : (
                <button
                  onClick={startScan}
                  disabled={!connected}
                  className={cls(
                    "px-6 py-3 rounded-lg font-bold text-sm transition-all duration-200",
                    connected
                      ? "bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500 text-cyan-400 hover:shadow-lg hover:shadow-cyan-500/20"
                      : "bg-slate-900 border border-slate-700 text-slate-600 cursor-not-allowed"
                  )}
                >
                  ▶ SCAN
                </button>
              )}
            </div>
          </div>

          <div className="mt-4 flex flex-wrap gap-4 text-xs font-mono">
            <div className="flex items-center gap-2">
              <span className="text-slate-500">Type:</span>
              <select
                value={scanType}
                onChange={(e) => setScanType(e.target.value)}
                disabled={scanning}
                className="bg-slate-900 border border-slate-700 text-cyan-400 rounded px-2 py-1 text-xs"
              >
                <option value="syn">SYN Stealth</option>
                <option value="tcp">TCP Connect</option>
                <option value="udp">UDP</option>
                <option value="ping">Ping Only</option>
              </select>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-slate-500">Speed:</span>
              <input
                type="range" min={0} max={5} value={timing}
                onChange={(e) => setTiming(Number(e.target.value))}
                disabled={scanning}
                className="w-20 accent-cyan-400"
              />
              <span className="text-cyan-400 w-4">T{timing}</span>
            </div>
        {[
              { label: "OS Detect",     val: osDetect,  set: setOsDetect },
              { label: "Version",       val: verDetect, set: setVerDetect },
              { label: "Top 100 Ports", val: topPorts,  set: setTopPorts  },
            ].map(({ label, val, set }) => (
              <label key={label} style={{ display: "flex", alignItems: "center", gap: "6px", cursor: "pointer", fontSize: "12px" }}>
                <input
                  type="checkbox"
                  checked={val}
                  onChange={() => !scanning && set(!val)}
                  disabled={scanning}
                  style={{ width: "16px", height: "16px", cursor: "pointer", accentColor: "#00f5ff" }}
                />
                <span style={{ color: val ? "#00f5ff" : "#94a3b8" }}>{label}</span>
              </label>
            ))}
          </div>

          {(scanning || progress > 0) && (
            <div className="mt-4 space-y-1">
              <div className="flex justify-between text-xs font-mono text-slate-500">
                <span>{scanning ? "Scanning…" : "Complete"}</span>
                <span>{Math.round(progress)}%</span>
              </div>
              <ProgressBar percent={progress} scanning={scanning} />
            </div>
          )}

          {error && (
            <div className="mt-3 flex items-start gap-2 bg-red-950/60 border border-red-800 rounded-lg px-4 py-3 text-sm text-red-400 font-mono">
              <span>⚠</span>
              <span>{error}</span>
            </div>
          )}
        </div>

        {devices.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Hosts Up",    value: upCount,        icon: "📡" },
              { label: "Total Found", value: devices.length, icon: "🔍" },
              { label: "Open Ports",  value: portCount,      icon: "🚪" },
              { label: "Elapsed",     value: `${scanMeta?.elapsed ?? "—"}s`, icon: "⏱" },
            ].map(({ label, value, icon }) => (
              <div key={label} className="bg-slate-950/80 border border-cyan-900/30 rounded-xl p-4 flex items-center gap-3">
                <span className="text-2xl">{icon}</span>
                <div>
                  <div className="text-xl font-bold text-cyan-300 font-mono">{value}</div>
                  <div className="text-xs text-slate-500 font-mono">{label}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="flex gap-1 border-b border-slate-800">
          {[
            { id: "devices",  label: "Devices",  icon: "📋" },
            { id: "graph",    label: "Topology", icon: "🕸️" },
            { id: "terminal", label: "Terminal", icon: "💻" },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cls(
                "px-4 py-2.5 text-sm font-semibold transition-colors border-b-2 -mb-px",
                activeTab === tab.id
                  ? "border-cyan-500 text-cyan-400"
                  : "border-transparent text-slate-500 hover:text-slate-300"
              )}
            >
              <span className="mr-1.5">{tab.icon}</span>
              {tab.label}
            </button>
          ))}
        </div>

        {activeTab === "devices" && (
          <div className="space-y-3">
            {devices.length === 0 ? (
              <div className="text-center py-16 text-slate-700 font-mono">
                <div className="text-5xl mb-4">📡</div>
                <div className="text-sm">No devices discovered yet.</div>
                <div className="text-xs mt-1">Enter a target and run a scan.</div>
              </div>
            ) : (
              devices.map((device) => {
                const key = device.ip || device.hostnames?.[0] || Math.random();
                return (
                  <DeviceCard
                    key={key}
                    device={device}
                    expanded={expandedId === key}
                    onToggle={() => setExpandedId(expandedId === key ? null : key)}
                  />
                );
              })
            )}
          </div>
        )}

        {activeTab === "graph" && (
          <div className="relative bg-slate-950/60 border border-cyan-900/30 rounded-xl overflow-hidden" style={{ height: 500 }}>
            <D3Graph data={graphData} onNodeClick={setSelectedNode} />
            {selectedNode && (
              <div className="absolute top-4 right-4 bg-slate-950/95 border border-cyan-800/60 rounded-xl p-4 max-w-xs w-64 shadow-xl shadow-cyan-950/30 backdrop-blur">
                <button
                  onClick={() => setSelectedNode(null)}
                  className="absolute top-2 right-3 text-slate-500 hover:text-cyan-400 text-lg"
                >×</button>
                <h3 className="text-sm font-bold text-cyan-400 font-mono mb-2">
                  {selectedNode.type === "target" ? "🎯 Target" : selectedNode.type === "port" ? `Port ${selectedNode.label}` : `📡 ${selectedNode.label}`}
                </h3>
                {selectedNode.sublabel && (
                  <p className="text-xs text-slate-400 font-mono mb-1">{selectedNode.sublabel}</p>
                )}
                {selectedNode.os && (
                  <p className="text-xs text-slate-500 font-mono">OS: {selectedNode.os}</p>
                )}
                {selectedNode.macVendor && (
                  <p className="text-xs text-slate-500 font-mono">Vendor: {selectedNode.macVendor}</p>
                )}
                {selectedNode.ports?.length > 0 && (
                  <div className="mt-2 flex flex-wrap gap-1">
                    {selectedNode.ports.slice(0, 10).map((p, i) => (
                      <span key={i} className={cls(
                        "text-xs px-1.5 py-0.5 rounded border",
                        portBadge(p.service)
                      )}>
                        {p.port}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            )}
            <div className="absolute bottom-4 left-4 flex gap-4 text-xs font-mono text-slate-600">
              <span>🎯 Target</span>
              <span>📡 Host</span>
              <span className="text-cyan-700">● Port</span>
              <span>Drag to rearrange · Scroll to zoom</span>
            </div>
          </div>
        )}

        {activeTab === "terminal" && (
          <Terminal lines={terminalLines} scanning={scanning} />
        )}
      </main>

      <footer className="mt-12 border-t border-slate-900 px-4 py-4 text-center font-mono text-xs text-slate-700">
        ⚡ NETSCOPE — For authorized use only. Only scan networks you own or have permission to test.
        {safeMode
          ? " · 🛡️ Safety Mode ACTIVE"
          : " · ⚠️ Safety Mode DISABLED — proceed with caution"}
      </footer>
    </div>
  );
}