import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: "/",
    name: "Sharpener Fights",
    short_name: "SharpFights",
    description: "Pool-style aiming meets real 3D school-desk sharpener physics.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "any",
    background_color: "#f5efd9",
    theme_color: "#183345",
    categories: ["games", "entertainment"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
    shortcuts: [
      {
        name: "Local Play",
        short_name: "Local",
        description: "Start a same-device sharpener fight.",
        url: "/play/local",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
      {
        name: "Choose Match Mode",
        short_name: "Modes",
        description: "Choose local, friend, or instant play.",
        url: "/modes",
        icons: [{ src: "/icons/icon-192.png", sizes: "192x192", type: "image/png" }],
      },
    ],
  };
}
