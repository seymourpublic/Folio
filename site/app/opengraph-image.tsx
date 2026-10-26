import { ImageResponse } from "next/og";

export const alt = "Folio — The modern document workspace";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpengraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          background: "#fafaf8",
          padding: 80,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
          <div
            style={{
              width: 52,
              height: 52,
              borderRadius: 12,
              background: "#111827",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              color: "#fafaf8",
              fontSize: 30,
              fontWeight: 600,
            }}
          >
            F
          </div>
          <div style={{ fontSize: 30, fontWeight: 600, color: "#111827" }}>Folio</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div
            style={{
              fontSize: 76,
              fontWeight: 600,
              color: "#111827",
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
            }}
          >
            The modern
          </div>
          <div
            style={{
              fontSize: 76,
              fontWeight: 600,
              color: "#111827",
              letterSpacing: "-0.03em",
              lineHeight: 1.05,
            }}
          >
            document workspace.
          </div>
          <div style={{ fontSize: 30, color: "#6b7280", marginTop: 28 }}>
            Read, edit, organize and protect documents — open source.
          </div>
        </div>

        <div style={{ display: "flex", gap: 28, fontSize: 22, color: "#9ca3af" }}>
          <span>Windows · Free and open source</span>
          <span>·</span>
          <span>GPL-3.0</span>
        </div>
      </div>
    ),
    size
  );
}
