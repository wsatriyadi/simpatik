import { useParams } from "react-router-dom";
import { EmployeeAssessment } from "../../components/kabid/EmployeeAssessment";
import { useDocumentTitle } from "../../lib/hooks";

export default function KabidEmployee() {
  const { id } = useParams();
  useDocumentTitle("Detail Pegawai");

  if (!id) return null;

  return (
    <div className="mx-auto w-full max-w-3xl">
      <EmployeeAssessment key={id} employeeId={id} />
    </div>
  );
}
