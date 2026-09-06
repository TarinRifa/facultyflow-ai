import { Assistant } from "@/components/assistant";
import { requireFacultyPage } from "@/lib/faculty-page";
export default async function AssistantPage() {
  await requireFacultyPage();
  return <Assistant />;
}
