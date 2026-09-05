import { ImageResponse } from "next/og";

export const alt =
  "Tom Green — I build teams, operating models, and agents to run them.";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

// The share card speaks the site's own system: paper ground, ink display
// type, record voice, hairlines. No off-palette colour, no decoration.
export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          background: "#ffffff",
          color: "#101410",
          padding: "56px 72px 48px",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            borderBottom: "1px solid #e3e3e3",
            paddingBottom: 28,
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                fontSize: 30,
                fontWeight: 800,
                letterSpacing: "-0.06em",
                textTransform: "uppercase",
                display: "flex",
              }}
            >
              Tom Green
            </div>
            <div style={{ width: 7, height: 34, background: "#101410", display: "flex" }} />
          </div>
          <div
            style={{
              fontSize: 17,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "#6a7068",
              display: "flex",
            }}
          >
            tomgreen.ai
          </div>
        </div>

        <div
          style={{
            marginTop: 64,
            fontSize: 84,
            fontWeight: 800,
            lineHeight: 1.0,
            letterSpacing: "-0.045em",
            textTransform: "uppercase",
            display: "flex",
            flexDirection: "column",
          }}
        >
          <span>I build teams,</span>
          <span>operating models,</span>
          <span>and agents to run them.</span>
        </div>

        <div
          style={{
            marginTop: "auto",
            fontSize: 17,
            letterSpacing: "0.14em",
            textTransform: "uppercase",
            color: "#4f554d",
            display: "flex",
          }}
        >
          AI organizations · People systems · Agent workflows
        </div>
      </div>
    ),
    size,
  );
}
