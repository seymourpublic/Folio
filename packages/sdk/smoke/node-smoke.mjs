// Tier A: plain Node, zero-DOM smoke test. Proves the "pure engine" half of the package
// (core model, text conversion, encryption, PKI, crypto) works in a more restrictive
// environment than Folio itself ever runs in — a Node backend/CLI embedding just the
// non-visual parts of the engine.
import assert from "node:assert/strict";
import { PDFDocument } from "pdf-lib";
import {
  createId,
  pagesFromSource,
  toPlainText,
  toMarkdown,
  toHtml,
  toRtf,
  sampleRunAppearance,
  describeFont,
  wrapText,
} from "../dist/index.js";
import { encryptDocument, decryptPdfBytes, generateSelfSignedCertificate, certInfo } from "../dist/signing.js";

const decoder = new TextDecoder();
let passed = 0;

function check(name, fn) {
  return Promise.resolve()
    .then(fn)
    .then(() => {
      console.log(`  ok - ${name}`);
      passed++;
    });
}

console.log("Tier A: plain Node smoke test");

await check("createId produces unique non-empty ids", () => {
  const a = createId();
  const b = createId();
  assert.ok(typeof a === "string" && a.length > 0);
  assert.notEqual(a, b);
});

await check("pagesFromSource builds the expected page shape", () => {
  const pages = pagesFromSource("src-1", 3);
  assert.equal(pages.length, 3);
  assert.equal(pages[0].sourceId, "src-1");
  assert.equal(pages[2].sourcePageIndex, 2);
  assert.deepEqual(pages[0].annotations, []);
});

const paragraphs = [["Hello world.", "Second paragraph."], ["Page two."]];

await check("toPlainText contains the source text", () => {
  const text = decoder.decode(toPlainText(paragraphs));
  assert.ok(text.includes("Hello world."));
  assert.ok(text.includes("Page two."));
});

await check("toMarkdown contains the source text", () => {
  const text = decoder.decode(toMarkdown(paragraphs, "Smoke Test Doc"));
  assert.ok(text.includes("Hello world."));
  assert.ok(text.includes("Smoke Test Doc"));
});

await check("toHtml contains the source text", () => {
  const text = decoder.decode(toHtml(paragraphs, "Smoke Test Doc"));
  assert.ok(text.includes("Hello world."));
});

await check("toRtf produces non-empty RTF bytes", () => {
  const bytes = toRtf(paragraphs);
  assert.ok(bytes.length > 0);
  assert.ok(decoder.decode(bytes).startsWith("{\\rtf"));
});

await check("encryptDocument + decryptPdfBytes round-trips a real PDF", async () => {
  const doc = await PDFDocument.create();
  const page = doc.addPage([200, 200]);
  page.drawText("smoke test", { x: 20, y: 100 });

  await encryptDocument(doc, {
    userPassword: "user-pw",
    ownerPassword: "owner-pw",
    permissions: { printing: true, copying: false, modifying: false, annotating: true },
    aesKeyBits: 128,
  });
  const encryptedBytes = await doc.save({ useObjectStreams: false });

  const reloadedEncrypted = await PDFDocument.load(encryptedBytes, { ignoreEncryption: true });
  assert.ok(reloadedEncrypted.isEncrypted);

  const decryptedBytes = await decryptPdfBytes(encryptedBytes, "user-pw");
  const decrypted = await PDFDocument.load(decryptedBytes);
  assert.equal(decrypted.getPageCount(), 1);
  assert.equal(decrypted.isEncrypted, false);

  await assert.rejects(() => decryptPdfBytes(encryptedBytes, "wrong-password"));
});

await check("generateSelfSignedCertificate + certInfo round-trips subject info", async () => {
  const { certPem, privateKeyPem } = await generateSelfSignedCertificate({
    commonName: "Smoke Test",
    validityDays: 1,
  });
  assert.ok(certPem.includes("BEGIN CERTIFICATE"));
  assert.ok(privateKeyPem.includes("BEGIN"));

  const info = certInfo(certPem);
  assert.equal(info.subjectName, "Smoke Test");
  assert.equal(info.isSelfSigned, true);
});

/** RGBA buffer of `bg`, with the top `inkRows` rows painted `ink`. */
function boxPixels({ width, height, bg, ink, inkRows }) {
  const px = new Uint8ClampedArray(width * height * 4);
  for (let y = 0; y < height; y++) {
    const color = y < inkRows ? ink : bg;
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      [px[i], px[i + 1], px[i + 2], px[i + 3]] = [color[0], color[1], color[2], 255];
    }
  }
  return px;
}

await check("sampleRunAppearance reads black ink on a white background", () => {
  const px = boxPixels({ width: 10, height: 10, bg: [255, 255, 255], ink: [0, 0, 0], inkRows: 2 });
  const out = sampleRunAppearance(px, 10, 10);
  assert.equal(out.background, "#ffffff");
  assert.equal(out.ink, "#000000");
  assert.equal(out.confident, true);
});

await check("sampleRunAppearance reads light ink on a dark background", () => {
  const px = boxPixels({ width: 10, height: 10, bg: [32, 32, 40], ink: [255, 255, 255], inkRows: 3 });
  const out = sampleRunAppearance(px, 10, 10);
  assert.equal(out.background, "#202028");
  assert.equal(out.ink, "#ffffff");
  assert.equal(out.confident, true);
});

await check("sampleRunAppearance is not confident about a varied box", () => {
  const px = new Uint8ClampedArray(20 * 20 * 4);
  for (let i = 0; i < 400; i++) {
    [px[i * 4], px[i * 4 + 1], px[i * 4 + 2], px[i * 4 + 3]] = [
      (i * 37) % 256,
      (i * 91) % 256,
      (i * 53) % 256,
      255,
    ];
  }
  assert.equal(sampleRunAppearance(px, 20, 20).confident, false);
});

await check("sampleRunAppearance is not confident when the box has no ink", () => {
  const px = boxPixels({ width: 10, height: 10, bg: [255, 255, 255], ink: [0, 0, 0], inkRows: 0 });
  const out = sampleRunAppearance(px, 10, 10);
  assert.equal(out.background, "#ffffff");
  assert.equal(out.confident, false);
});

await check("describeFont maps a sans-serif stack to helvetica, not times", () => {
  assert.equal(describeFont('"Helvetica Neue", Arial, sans-serif').family, "helvetica");
  assert.equal(describeFont("sans-serif").family, "helvetica");
});

await check("describeFont maps serif and monospace stacks", () => {
  assert.equal(describeFont('Georgia, "Times New Roman", serif').family, "times");
  assert.equal(describeFont("Consolas, monospace").family, "courier");
});

await check("describeFont detects bold and italic in a subset-prefixed PDF font name", () => {
  assert.deepEqual(describeFont("ABCDEF+TimesNewRomanPS-BoldItalicMT"), {
    family: "times",
    bold: true,
    italic: true,
  });
  assert.deepEqual(describeFont("g_d0_f1"), { family: "helvetica", bold: false, italic: false });
});

/** Stand-in for PDFFont.widthOfTextAtSize: every glyph is 10 units wide. */
const tenPerChar = (s) => s.length * 10;

await check("wrapText keeps text that fits on one line", () => {
  assert.deepEqual(wrapText("ab cd", 100, tenPerChar), ["ab cd"]);
});

await check("wrapText wraps at word boundaries", () => {
  assert.deepEqual(wrapText("aaa bbb ccc", 60, tenPerChar), ["aaa", "bbb", "ccc"]);
});

await check("wrapText preserves explicit newlines", () => {
  assert.deepEqual(wrapText("ab\ncd", 100, tenPerChar), ["ab", "cd"]);
});

await check("wrapText breaks a word that cannot fit a line", () => {
  assert.deepEqual(wrapText("aaaaaa", 30, tenPerChar), ["aaa", "aaa"]);
});

console.log(`Tier A: ${passed} checks passed`);
