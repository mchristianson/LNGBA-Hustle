import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "LNGBA Hustle Tracker",
    short_name: "Hustle",
    description: "Hustle points for Lakeville North Girls Basketball travel teams.",
    start_url: "/",
    display: "standalone",
    background_color: "#f6f5f4",
    theme_color: "#d7191f",
    icons: [{ src: "/icon.svg", sizes: "any", type: "image/svg+xml" }],
  };
}
