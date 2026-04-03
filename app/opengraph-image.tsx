import { ImageResponse } from "next/og";

export const alt = "Domio — Condo Management (HOA)";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

export default function OpenGraphImage() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(145deg, #0f172a 0%, #134e4a 45%, #0d9488 100%)",
        }}
      >
        <div
          style={{
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
            justifyContent: "center",
            gap: 20,
            padding: 48,
          }}
        >
          <div
            style={{
              fontSize: 96,
              fontWeight: 800,
              color: "#ffffff",
              letterSpacing: "-0.04em",
              lineHeight: 1,
            }}
          >
            Domio
          </div>
          <div
            style={{
              fontSize: 32,
              color: "rgba(255,255,255,0.9)",
              fontWeight: 500,
            }}
          >
            Condo Management (HOA)
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
