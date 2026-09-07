import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/ambulance")({
  staticData: { sitemap: false },
  component: AmbulanceLayout,
});

function AmbulanceLayout() {
  return <Outlet />;
}
