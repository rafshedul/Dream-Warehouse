import DashboardClient from "../dashboard-client";

// The operational dashboard loads authenticated, live API data in the browser.
export const instant = false;

export default function DashboardPage() {
  return <DashboardClient />;
}
