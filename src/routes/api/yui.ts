import { createFileRoute } from "@tanstack/react-router";
import { handleYuiChat } from "@/lib/yui.server";

export const Route = createFileRoute("/api/yui")({
  server: { handlers: { POST: ({ request }) => handleYuiChat(request) } },
});
