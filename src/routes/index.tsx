import { createFileRoute } from "@tanstack/react-router";
import App from "@/components/App";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Pega Aí" },
      { name: "description", content: "Listas, agenda e organização da vida a dois." },
      { property: "og:title", content: "Pega Aí" },
      { property: "og:description", content: "Listas, agenda e organização da vida a dois." },
    ],
  }),
  component: App,
});
