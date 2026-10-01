import { createFileRoute } from "@tanstack/react-router";
import { handleYuiVoz } from "@/lib/yui-voz.server";

export const Route = createFileRoute("/api/yui/voz")({
  server: { handlers: { POST: ({ request }) => handleYuiVoz(request) } },
});
