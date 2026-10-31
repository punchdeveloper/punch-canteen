/**
 * App icons, drawn on demand: the red PUNCH "P" mark used across v63
 * (favicon, install banner, login logo).
 *   /icons/icon-192.png   /icons/icon-512.png   /icons/apple-touch-icon.png
 */
import { ImageResponse } from "next/og";

const SIZES: Record<string, number> = { "icon-192.png": 192, "icon-512.png": 512, "apple-touch-icon.png": 180 };

export async function GET(_req: Request, ctx: { params: Promise<{ name: string }> }) {
  const { name } = await ctx.params;
  const size = SIZES[name];
  if (!size) return new Response("Not found", { status: 404 });
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#ed1c24",
          color: "#fff",
          fontSize: size * 0.62,
          fontWeight: 800,
          fontFamily: "Arial",
        }}
      >
        P
      </div>
    ),
    { width: size, height: size, headers: { "Cache-Control": "public, max-age=86400" } },
  );
}
