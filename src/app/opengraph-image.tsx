import { ImageResponse } from "next/og";

export const alt =
  "Tom Green — I build the teams, the operating model, and the agents to run it.";

export const size = {
  width: 1200,
  height: 630,
};

export const contentType = "image/png";

export default function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          overflow: "hidden",
          background: "#ffffff",
          color: "#191815",
          padding: "64px 72px",
          fontFamily: "sans-serif",
        }}
      >
        <div
          style={{
            position: "absolute",
            width: 520,
            height: 520,
            right: -40,
            top: 54,
            border: "1px solid #eae8e1",
            borderRadius: 999,
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 340,
            height: 340,
            right: 50,
            top: 144,
            border: "1px dashed #74c194",
            borderRadius: 999,
            display: "flex",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 124,
            height: 124,
            right: 158,
            top: 252,
            border: "2px solid #156d40",
            borderRadius: 999,
            display: "flex",
            background: "#fbfaf7",
          }}
        />
        <div
          style={{
            position: "absolute",
            width: 18,
            height: 18,
            right: 211,
            top: 305,
            borderRadius: 999,
            display: "flex",
            background: "#156d40",
          }}
        />
        <div style={{ display: "flex", flexDirection: "column", width: 760 }}>
          <div
            style={{
              fontSize: 25,
              fontWeight: 650,
              letterSpacing: "-0.055em",
              textTransform: "uppercase",
            }}
          >
            Tom Green
          </div>
          <div
            style={{
              marginTop: 90,
              fontSize: 67,
              lineHeight: 1.02,
              letterSpacing: "-0.045em",
              display: "flex",
              flexDirection: "column",
            }}
          >
            <span>I build the teams,</span>
            <span>the operating model,</span>
            <span style={{ color: "#156d40" }}>and the agents to run it.</span>
          </div>
          <div
            style={{
              marginTop: "auto",
              fontSize: 17,
              letterSpacing: "0.14em",
              textTransform: "uppercase",
              color: "#77746d",
            }}
          >
            AI organisations · People systems · Agent workflows
          </div>
        </div>
      </div>
    ),
    size,
  );
}
