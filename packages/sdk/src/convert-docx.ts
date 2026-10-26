import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";

/** Builds a real, openable .docx from extracted paragraphs. */
export async function toDocx(pagesParagraphs: string[][], title: string): Promise<Uint8Array> {
  const children: Paragraph[] = [
    new Paragraph({ text: title, heading: HeadingLevel.TITLE }),
  ];

  pagesParagraphs.forEach((paragraphs, pageIndex) => {
    paragraphs.forEach((text, i) => {
      children.push(
        new Paragraph({
          pageBreakBefore: i === 0 && pageIndex > 0,
          children: [new TextRun(text)],
        })
      );
    });
    if (paragraphs.length === 0 && pageIndex > 0) {
      children.push(new Paragraph({ pageBreakBefore: true, children: [] }));
    }
  });

  const doc = new Document({ sections: [{ children }] });
  const blob = await Packer.toBlob(doc);
  return new Uint8Array(await blob.arrayBuffer());
}
