import { Workspace } from "@/components/workspace";
import { requireFacultyPage } from "@/lib/faculty-page";
export default async function Page() {
  await requireFacultyPage();
  return <Workspace view="tasks" />;
}
