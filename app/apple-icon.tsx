import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          borderRadius: 40,
          background: "linear-gradient(145deg, #0f172a 0%, #0d9488 100%)",
          color: "#ffffff",
          fontSize: 96,
          fontWeight: 800,
          fontFamily: "system-ui, sans-serif",
        }}
      >
        D
      </div>
    ),
    { ...size }
  );
}
