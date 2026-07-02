import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { execFile } from "node:child_process";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const port = Number(globalThis.process?.env?.PORT ?? 4173);
const execFileAsync = promisify(execFile);
const jsonLimitBytes = 80 * 1024 * 1024;

const templates = {
  itapemirim: "tag-itapemirim-template.xlsx",
  tims: "tag-tims-template.xlsx",
  viana: "tag-viana-template.xlsx"
};

const fixed = {
  client: "ESOM – Engie Soluções de Operação e Manutenção",
  contract: "AC380ESOM",
  contractor: "V F S SISTEMA ELETRÔNICO DE ALARME LTDA",
  transcriptionResponsible: "RICARDO OLIVEIRA - GERENTE DE OPERAÇÕES - GRUPO PRIME",
  esomResponsible: "",
  permanenceMinutes: 30
};

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".svg": "image/svg+xml; charset=utf-8",
  ".ico": "image/x-icon"
};

const server = http.createServer(async (request, response) => {
  try {
    const url = new URL(request.url, `http://${request.headers.host}`);

    if (request.method === "POST" && url.pathname === "/api/export-xlsx") {
      await exportXlsx(request, response);
      return;
    }

    const cleanPath = decodeURIComponent(url.pathname === "/" ? "/index.html" : url.pathname);
    const filePath = path.normalize(path.join(__dirname, cleanPath));

    if (!filePath.startsWith(__dirname)) {
      send(response, 403, "text/plain; charset=utf-8", "Acesso negado");
      return;
    }

    const file = await fs.readFile(filePath);
    send(response, 200, mimeTypes[path.extname(filePath)] ?? "application/octet-stream", file);
  } catch (error) {
    console.error(error);
    if (request.url?.startsWith("/api/")) {
      send(response, 500, "application/json; charset=utf-8", JSON.stringify({ error: "Falha ao processar solicitação" }));
      return;
    }
    const fallback = await fs.readFile(path.join(__dirname, "index.html"));
    send(response, 200, mimeTypes[".html"], fallback);
  }
});

server.listen(port, () => {
  console.log(`Fiscaliza Pro ENGIE rodando em http://localhost:${port}`);
});

function send(response, status, contentType, body) {
  response.writeHead(status, {
    "Content-Type": contentType,
    "Cache-Control": "no-store"
  });
  response.end(body);
}

async function exportXlsx(request, response) {
  const record = await readJson(request);
  const templateName = templates[record.tag];
  if (!templateName) {
    send(response, 400, "application/json; charset=utf-8", JSON.stringify({ error: "TAG inválida" }));
    return;
  }

  const tempRoot = await fs.mkdtemp(path.join(os.tmpdir(), "fiscalizapro-xlsx-"));
  const zipPath = path.join(tempRoot, "template.zip");
  const extractDir = path.join(tempRoot, "xlsx");
  const outputZip = path.join(tempRoot, "output.zip");
  const outputXlsx = path.join(tempRoot, safeFilename(record));

  try {
    await fs.copyFile(path.join(__dirname, "templates", templateName), zipPath);
    await runPowerShell(`Expand-Archive -LiteralPath '${ps(zipPath)}' -DestinationPath '${ps(extractDir)}' -Force`);

    const sheetPath = await resolveSheetPath(extractDir, record.date);
    let sheetXml = await fs.readFile(sheetPath, "utf8");
    sheetXml = setInlineString(sheetXml, "A3", `DATA: ${formatLongDate(record.date)} - 18:00 às 06:00`);
    sheetXml = setInlineString(sheetXml, "A5", fixed.client);
    sheetXml = setInlineString(sheetXml, "F5", fixed.contract);
    sheetXml = setInlineString(sheetXml, "H5", fixed.contractor);
    sheetXml = setInlineString(sheetXml, "A7", occurrenceText(record));
    sheetXml = setInlineString(sheetXml, "A9", record.stoppages || "Sem paralisações.");
    sheetXml = setNumber(sheetXml, "A16", timeToExcel(record.arrivalRound1));
    sheetXml = setNumber(sheetXml, "C16", fixed.permanenceMinutes / 1440);
    sheetXml = setNumber(sheetXml, "E16", timeToExcel(record.exitRound1 || calcExit(record.arrivalRound1)));

    if (record.tag === "tims") {
      sheetXml = setNumber(sheetXml, "G16", timeToExcel(record.arrivalRound2));
      sheetXml = setNumber(sheetXml, "I16", fixed.permanenceMinutes / 1440);
      sheetXml = setNumber(sheetXml, "J16", timeToExcel(record.exitRound2 || calcExit(record.arrivalRound2)));
    } else {
      sheetXml = setEmptyCell(sheetXml, "G16");
      sheetXml = setEmptyCell(sheetXml, "I16");
      sheetXml = setEmptyCell(sheetXml, "J16");
    }

    sheetXml = setInlineString(sheetXml, "A18", teamLabel(record.team));
    sheetXml = setInlineString(sheetXml, "D18", fixed.transcriptionResponsible);
    sheetXml = setInlineString(sheetXml, "G18", fixed.esomResponsible);
    await fs.writeFile(sheetPath, sheetXml);
    await replaceSheetImages(extractDir, sheetPath, record.photos || []);

    await runPowerShell(`Compress-Archive -Path '${ps(path.join(extractDir, "*"))}' -DestinationPath '${ps(outputZip)}' -Force`);
    await fs.rename(outputZip, outputXlsx);
    const file = await fs.readFile(outputXlsx);
    response.writeHead(200, {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="${encodeURIComponent(path.basename(outputXlsx))}"`,
      "Cache-Control": "no-store"
    });
    response.end(file);
  } finally {
    await fs.rm(tempRoot, { recursive: true, force: true });
  }
}

async function readJson(request) {
  const chunks = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > jsonLimitBytes) throw new Error("JSON muito grande");
    chunks.push(chunk);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

async function resolveSheetPath(extractDir, date) {
  const sheetName = date ? date.slice(5, 10).split("-").reverse().join("_") : "";
  const workbookPath = path.join(extractDir, "xl", "workbook.xml");
  let workbookXml = await fs.readFile(workbookPath, "utf8");
  const relsXml = await fs.readFile(path.join(extractDir, "xl", "_rels", "workbook.xml.rels"), "utf8");
  const rels = Object.fromEntries([...relsXml.matchAll(/<Relationship[^>]+Id="([^"]+)"[^>]+Target="([^"]+)"/g)].map((match) => [match[1], match[2]]));
  const sheets = [...workbookXml.matchAll(/<sheet[^>]+name="([^"]+)"[^>]+r:id="([^"]+)"/g)];
  const exact = sheets.find((match) => match[1] === sheetName);
  const selected = exact || sheets[0];
  if (!exact && sheetName) {
    workbookXml = workbookXml.replace(selected[0], selected[0].replace(/name="[^"]+"/, `name="${xmlEscape(sheetName)}"`));
    await fs.writeFile(workbookPath, workbookXml);
  }
  return path.join(extractDir, "xl", rels[selected[2]].replace(/^\/?xl\//, ""));
}

async function replaceSheetImages(extractDir, sheetPath, photos) {
  const relPath = path.join(path.dirname(sheetPath), "_rels", `${path.basename(sheetPath)}.rels`);
  let sheetRelsXml;
  try {
    sheetRelsXml = await fs.readFile(relPath, "utf8");
  } catch {
    return;
  }

  const drawingRel = [...sheetRelsXml.matchAll(/<Relationship[^>]+Type="[^"]+\/drawing"[^>]+Target="([^"]+)"/g)][0]?.[1];
  if (!drawingRel) return;

  const drawingPath = path.normalize(path.join(path.dirname(sheetPath), drawingRel));
  const drawingRelsPath = path.join(path.dirname(drawingPath), "_rels", `${path.basename(drawingPath)}.rels`);
  const drawingXml = await fs.readFile(drawingPath, "utf8");
  const drawingRelsXml = await fs.readFile(drawingRelsPath, "utf8");
  const rels = Object.fromEntries([...drawingRelsXml.matchAll(/<Relationship[^>]+Id="([^"]+)"[^>]+Target="([^"]+)"/g)].map((match) => [match[1], match[2]]));
  const pics = [...drawingXml.matchAll(/<xdr:(?:oneCellAnchor|twoCellAnchor)[\s\S]*?<xdr:from>[\s\S]*?<xdr:col>(\d+)<\/xdr:col>[\s\S]*?<xdr:row>(\d+)<\/xdr:row>[\s\S]*?r:embed="([^"]+)"[\s\S]*?<\/xdr:(?:oneCellAnchor|twoCellAnchor)>/g)]
    .map((match) => ({ col: Number(match[1]), row: Number(match[2]), rid: match[3] }))
    .filter((pic) => pic.row >= 10)
    .sort((a, b) => a.row - b.row || a.col - b.col);
  const ordered = [...pics.filter((pic) => pic.row <= 11).sort((a, b) => a.col - b.col), ...pics.filter((pic) => pic.row > 11).sort((a, b) => a.col - b.col)];

  for (let index = 0; index < Math.min(4, ordered.length, photos.length); index += 1) {
    if (!photos[index]) continue;
    const target = rels[ordered[index].rid];
    if (!target) continue;
    await fs.writeFile(path.normalize(path.join(path.dirname(drawingPath), target)), dataUrlToBuffer(photos[index]));
  }
}

function setInlineString(xml, cell, value) {
  return replaceCell(xml, cell, (style) => `<c r="${cell}"${style} t="inlineStr"><is><t xml:space="preserve">${xmlEscape(value)}</t></is></c>`);
}

function setNumber(xml, cell, value) {
  return replaceCell(xml, cell, (style) => `<c r="${cell}"${style}><v>${Number(value || 0)}</v></c>`);
}

function setEmptyCell(xml, cell) {
  return replaceCell(xml, cell, (style) => `<c r="${cell}"${style}></c>`);
}

function replaceCell(xml, cell, render) {
  const cellRegex = new RegExp(`<c\\s+r="${cell}"([^>]*)>[\\s\\S]*?<\\/c>`);
  const match = xml.match(cellRegex);
  if (!match) return xml;
  const style = (match[1].match(/\s+s="[^"]+"/) || [""])[0];
  return xml.replace(cellRegex, render(style));
}

function occurrenceText(record) {
  if (record.tag === "tims") {
    return `1ª Ronda:\n${record.occurrenceRound1 || ""}\n2ª Ronda:\n${record.occurrenceRound2 || ""}`;
  }
  return `1ª Ronda:\n${record.occurrenceRound1 || ""}`;
}

function dataUrlToBuffer(dataUrl) {
  const [, base64] = String(dataUrl).split(",");
  return Buffer.from(base64 || dataUrl, "base64");
}

function timeToExcel(time) {
  if (!time) return 0;
  const [hour, minute] = time.split(":").map(Number);
  return ((hour * 60) + minute) / 1440;
}

function calcExit(time) {
  if (!time) return "";
  const [hour, minute] = time.split(":").map(Number);
  const total = (hour * 60) + minute + fixed.permanenceMinutes;
  return `${String(Math.floor((total / 60) % 24)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

function teamLabel(team) {
  return String(team).toLowerCase().includes("marcos") ? "MARCOS E ROGÉRIO" : "JOÃO VICTOR E ADIELTON";
}

function formatLongDate(date) {
  const [year, month, day] = date.split("-").map(Number);
  const months = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
  return `${day} de ${months[month - 1]} de ${year}`;
}

function safeFilename(record) {
  const tag = record.tag === "tims" ? "TIMS" : record.tag === "viana" ? "Viana" : "Itapemirim";
  return `Relatório de Rondas - TAG ${tag}-ES - ${record.date || "ronda"}.xlsx`;
}

function xmlEscape(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function ps(value) {
  return String(value).replaceAll("'", "''");
}

async function runPowerShell(command) {
  await execFileAsync("powershell.exe", ["-NoProfile", "-ExecutionPolicy", "Bypass", "-Command", command], { windowsHide: true, maxBuffer: 1024 * 1024 * 10 });
}
