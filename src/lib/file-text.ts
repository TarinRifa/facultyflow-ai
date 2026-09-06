import "server-only";
import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";
import { ApiError } from "./api-error";

const MAX_FILE = 8 * 1024 * 1024;
const allowed = new Map([
  ["application/pdf", "pdf"],
  [
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "docx",
  ],
  ["text/plain", "txt"],
]);
export async function extractUpload(file: File) {
  if (!file || file.size === 0)
    throw new ApiError(400, "Choose a non-empty file.");
  if (file.size > MAX_FILE)
    throw new ApiError(413, "Files must be 8 MB or smaller.");
  const extension = file.name.split(".").pop()?.toLowerCase();
  const expected = file.type
    ? allowed.get(file.type)
    : extension && ["pdf", "docx", "txt"].includes(extension)
      ? extension
      : undefined;
  if (!expected || extension !== expected)
    throw new ApiError(
      400,
      "Upload a PDF, DOCX, or TXT file with matching content type.",
    );
  const buffer = Buffer.from(await file.arrayBuffer());
  let value = "";
  try {
    if (expected === "txt")
      value = new TextDecoder("utf-8", { fatal: true }).decode(buffer);
    else if (expected === "docx")
      value = (await mammoth.extractRawText({ buffer })).value;
    else {
      const parser = new PDFParse({ data: buffer });
      try {
        value = (await parser.getText()).text;
      } finally {
        await parser.destroy();
      }
    }
  } catch {
    throw new ApiError(
      422,
      "The file could not be read. Check that it is not encrypted or damaged.",
    );
  }
  value = value
    .replace(/\0/g, "")
    .replace(/\r\n/g, "\n")
    .trim()
    .slice(0, 120000);
  if (value.length < 20)
    throw new ApiError(
      422,
      "The file does not contain enough extractable text.",
    );
  return {
    filename: file.name.slice(0, 255),
    file_type: expected,
    text: value,
  };
}

export function splitQuestions(text: string) {
  const lines = text
    .split(/\n+/)
    .map((v) => v.replace(/^\s*(?:Q(?:uestion)?\s*)?\d+[.)\-:]\s*/i, "").trim())
    .filter((v) => v.length >= 10);
  const source =
    lines.length > 1
      ? lines
      : text.split(/(?<=[?.])\s+(?=(?:Q(?:uestion)?\s*)?\d+[.)\-:]?)/i);
  return [
    ...new Set(source.map((v) => v.trim()).filter((v) => v.length >= 10)),
  ].slice(0, 100);
}
