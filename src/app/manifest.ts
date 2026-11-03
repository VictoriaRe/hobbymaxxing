import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Hobbymaxxing",
    short_name: "Hobbymaxxing",
    description: "Less scrolling, more doing the things that make you feel like you.",
    start_url: "/",
    display: "standalone",
    background_color: "#f7f4ec",
    theme_color: "#f7f4ec",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-512-maskable.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
