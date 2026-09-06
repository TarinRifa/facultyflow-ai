import { FacultyHub } from "@/components/faculty-hub";
import { requireFacultyPage } from "@/lib/faculty-page";
export default async function FacultyPage() {
  await requireFacultyPage();
  return <FacultyHub />;
}
