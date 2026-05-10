import React, { useEffect, useRef, useCallback } from "react";
import * as d3 from "d3";

const PORT_COLORS = {
  http:    "#00f5ff",
  https:   "#00b4d8",
  ssh:     "#f72585",
  ftp:     "#ff9f1c",
  smtp:    "#7b2d8b",
  dns:     "#06d6a0",
  rdp:     "#ef233c",
  smb:     "#ff4d6d",
  mysql:   "#4361ee",
  default: "#a8dadc",
};

function portColor(service) {
  return PORT_COLORS[service?.toLowerCase()] || PORT_COLORS.default;
}

function osIcon(name = "") {
  const n = name.toLowerCase();
  if (n.includes("windows")) return "🪟";
  if (n.includes("linux"))   return "🐧";
  if (n.includes("mac") || n.includes("darwin")) return "🍎";
  if (n.includes("android")) return "🤖";
  if (n.includes("ios"))     return "📱";
  if (n.includes("router") || n.includes("cisco")) return "📡";
  return "❓";
}

function buildGraph(data) {
  const nodes = [];
  const links = [];
  if (!data || !data.devices) return { nodes, links };

  const centerId = `__target__`;
  nodes.push({ id: centerId, label: data.target || "Target", type: "target", r: 28 });

  for (const device of data.devices) {
    if (device.status !== "up") continue;
    const deviceId = device.ip || device.hostnames?.[0] || Math.random().toString(36);
    nodes.push({
      id: deviceId, label: device.ip, sublabel: device.hostnames?.[0] || "",
      type: "device", os: device.osName, mac: device.mac,
      macVendor: device.macVendor, ports: device.ports, r: 18,
    });
    links.push({ source: centerId, target: deviceId, type: "host" });
    const topPorts = (device.ports || []).slice(0, 6);
    for (const port of topPorts) {
      const portId = `${deviceId}:${port.port}`;
      nodes.push({
        id: portId, label: `${port.port}`, sublabel: port.service || "",
        type: "port", service: port.service, r: 10, color: portColor(port.service),
      });
      links.push({ source: deviceId, target: portId, type: "port" });
    }
  }
  return { nodes, links };
}

export default function D3Graph({ data, onNodeClick }) {
  const svgRef     = useRef(null);
  const simRef     = useRef(null);
  const tooltipRef = useRef(null);

  const draw = useCallback(() => {
    if (!svgRef.current) return;
    const { nodes, links } = buildGraph(data);
    const container = svgRef.current.parentElement;
    const W = container?.clientWidth  || 800;
    const H = container?.clientHeight || 600;

    d3.select(svgRef.current).selectAll("*").remove();
    const svg = d3.select(svgRef.current).attr("width", W).attr("height", H).attr("viewBox", `0 0 ${W} ${H}`);

    const defs = svg.append("defs");
    const glowFilter = defs.append("filter").attr("id", "glow");
    glowFilter.append("feGaussianBlur").attr("stdDeviation", "4").attr("result", "coloredBlur");
    const feMerge = glowFilter.append("feMerge");
    feMerge.append("feMergeNode").attr("in", "coloredBlur");
    feMerge.append("feMergeNode").attr("in", "SourceGraphic");

    defs.append("marker").attr("id", "arrow").attr("viewBox", "0 -5 10 10")
      .attr("refX", 18).attr("refY", 0).attr("markerWidth", 6).attr("markerHeight", 6)
      .attr("orient", "auto").append("path").attr("d", "M0,-5L10,0L0,5").attr("fill", "#00f5ff44");

    const gridGroup = svg.append("g");
    const gridSize  = 40;
    for (let x = 0; x < W; x += gridSize) {
      gridGroup.append("line").attr("x1", x).attr("y1", 0).attr("x2", x).attr("y2", H)
        .attr("stroke", "#00f5ff08").attr("stroke-width", 1);
    }
    for (let y = 0; y < H; y += gridSize) {
      gridGroup.append("line").attr("x1", 0).attr("y1", y).attr("x2", W).attr("y2", y)
        .attr("stroke", "#00f5ff08").attr("stroke-width", 1);
    }

    const zoomG = svg.append("g");
    const zoom  = d3.zoom().scaleExtent([0.3, 4]).on("zoom", (event) => {
      zoomG.attr("transform", event.transform);
    });
    svg.call(zoom);

    if (simRef.current) simRef.current.stop();
    const simulation = d3.forceSimulation(nodes)
      .force("link", d3.forceLink(links).id((d) => d.id).distance((l) => l.type === "port" ? 80 : 160).strength(0.9))
      .force("charge", d3.forceManyBody().strength(-300))
      .force("center", d3.forceCenter(W / 2, H / 2))
      .force("collision", d3.forceCollide().radius((d) => d.r + 12));
    simRef.current = simulation;

    const link = zoomG.append("g").selectAll("line").data(links).join("line")
      .attr("stroke", (d) => d.type === "port" ? "#00f5ff33" : "#00f5ff66")
      .attr("stroke-width", (d) => d.type === "port" ? 1 : 1.5)
      .attr("stroke-dasharray", (d) => d.type === "port" ? "4 3" : "none")
      .attr("marker-end", "url(#arrow)");

    const nodeG = zoomG.append("g").selectAll("g").data(nodes).join("g")
      .style("cursor", "pointer")
      .call(d3.drag()
        .on("start", (event, d) => { if (!event.active) simulation.alphaTarget(0.3).restart(); d.fx = d.x; d.fy = d.y; })
        .on("drag",  (event, d) => { d.fx = event.x; d.fy = event.y; })
        .on("end",   (event, d) => { if (!event.active) simulation.alphaTarget(0); d.fx = null; d.fy = null; })
      )
      .on("click", (event, d) => { event.stopPropagation(); if (onNodeClick) onNodeClick(d); })
      .on("mouseover", (event, d) => {
        const tt = tooltipRef.current;
        if (!tt) return;
        let html = "";
        if (d.type === "target") html = `<div class="tt-title">🎯 ${d.label}</div>`;
        else if (d.type === "device") html = `<div class="tt-title">${osIcon(d.os)} ${d.label}</div>${d.macVendor ? `<div class="tt-val">Vendor: ${d.macVendor}</div>` : ""}${d.os ? `<div class="tt-val">OS: ${d.os}</div>` : ""}<div class="tt-val">Ports: ${d.ports?.length || 0}</div>`;
        else html = `<div class="tt-title" style="color:${d.color}">${d.label}/${d.sublabel}</div>`;
        tt.innerHTML = html;
        tt.style.display = "block";
        tt.style.left = (event.pageX + 14) + "px";
        tt.style.top  = (event.pageY - 28) + "px";
      })
      .on("mouseout", () => { if (tooltipRef.current) tooltipRef.current.style.display = "none"; });

    nodeG.filter((d) => d.type === "target").append("circle").attr("r", (d) => d.r + 12)
      .attr("fill", "none").attr("stroke", "#00f5ff").attr("stroke-width", 1)
      .attr("opacity", 0.4).attr("class", "pulse-ring");

    nodeG.append("circle").attr("r", (d) => d.r)
      .attr("fill", (d) => d.type === "port" ? d.color + "22" : "#001a2e")
      .attr("stroke", (d) => d.type === "target" ? "#00f5ff" : d.type === "port" ? d.color || "#00f5ff" : "#0096c7")
      .attr("stroke-width", (d) => d.type === "target" ? 2.5 : 1.5)
      .attr("filter", (d) => d.type !== "port" ? "url(#glow)" : null);

    nodeG.filter((d) => d.type === "device").append("text")
      .attr("text-anchor", "middle").attr("dominant-baseline", "central")
      .attr("font-size", "14px").text((d) => osIcon(d.os));

    nodeG.filter((d) => d.type === "target").append("text")
      .attr("text-anchor", "middle").attr("dominant-baseline", "central")
      .attr("font-size", "18px").text("🎯");

    nodeG.filter((d) => d.type === "port").append("text")
      .attr("text-anchor", "middle").attr("dominant-baseline", "central")
      .attr("font-size", "8px").attr("fill", (d) => d.color || "#00f5ff")
      .attr("font-family", "'Share Tech Mono', monospace").text((d) => d.label);

    nodeG.filter((d) => d.type !== "port").append("text")
      .attr("text-anchor", "middle").attr("y", (d) => d.r + 14)
      .attr("font-size", (d) => d.type === "target" ? "12px" : "10px")
      .attr("fill", "#00f5ff").attr("font-family", "'Share Tech Mono', monospace")
      .text((d) => d.label);

    simulation.on("tick", () => {
      link.attr("x1", (d) => d.source.x).attr("y1", (d) => d.source.y)
          .attr("x2", (d) => d.target.x).attr("y2", (d) => d.target.y);
      nodeG.attr("transform", (d) => `translate(${d.x ?? W/2},${d.y ?? H/2})`);
    });

    svg.on("click", () => { if (tooltipRef.current) tooltipRef.current.style.display = "none"; });

    if (!document.getElementById("d3-pulse-style")) {
      const style = document.createElement("style");
      style.id = "d3-pulse-style";
      style.textContent = `@keyframes d3-pulse { 0% { r: 30; opacity: 0.6; } 100% { r: 48; opacity: 0; } } .pulse-ring { animation: d3-pulse 2s ease-out infinite; }`;
      document.head.appendChild(style);
    }
  }, [data, onNodeClick]);

  useEffect(() => {
    draw();
    const obs = new ResizeObserver(draw);
    if (svgRef.current?.parentElement) obs.observe(svgRef.current.parentElement);
    return () => { obs.disconnect(); if (simRef.current) simRef.current.stop(); };
  }, [draw]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <svg ref={svgRef} style={{ display: "block", background: "transparent" }} />
      <div ref={tooltipRef} style={{
        display: "none", position: "fixed", background: "#000d1a",
        border: "1px solid #00f5ff44", borderRadius: "6px", padding: "8px 12px",
        fontSize: "11px", fontFamily: "'Share Tech Mono', monospace", color: "#00f5ff",
        pointerEvents: "none", zIndex: 9999, boxShadow: "0 0 16px #00f5ff33", maxWidth: "200px",
      }} />
      <style>{`.tt-title { font-size: 13px; font-weight: bold; margin-bottom: 4px; color: #00f5ff; } .tt-val { font-size: 10px; color: #a8dadc; }`}</style>
      {(!data || !data.devices || data.devices.length === 0) && (
        <div style={{
          position: "absolute", inset: 0, display: "flex", flexDirection: "column",
          alignItems: "center", justifyContent: "center", color: "#00f5ff33",
          fontFamily: "'Share Tech Mono', monospace", pointerEvents: "none",
        }}>
          <div style={{ fontSize: "48px", marginBottom: "12px" }}>🕸️</div>
          <div style={{ fontSize: "13px" }}>Network topology will appear here</div>
          <div style={{ fontSize: "11px", marginTop: "4px" }}>Run a scan to populate the map</div>
        </div>
      )}
    </div>
  );
}