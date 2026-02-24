import { Avatar } from "@nextui-org/react";
import { FaMale, FaFemale } from "react-icons/fa"; // Gender-specific icons
import { useNavigate } from "react-router-dom";
import { CodiceFiscaleValue } from "../CodiceFiscaleValue";

interface PatientData {
  name?: string;
  surname?: string;
  birthday?: string;
  gender?: string;
  email?: string;
  phone?: string;
  cf?: string;
  cfGenerated?: boolean;
  imageUrl?: string;
}

export default function CardPatient({ patient }: { patient: PatientData }) {
  const navigate = useNavigate();
  
  const handleNewVisit = (e: React.MouseEvent<HTMLButtonElement>) => {
    e.stopPropagation();
    const patientId = patient.cf;
    navigate(`/add-visit?patientId=${patientId}`);
  };

  // Determine the icon and color based on the patient's gender
  const GenderIcon = patient.gender === "M" ? FaMale : FaFemale;
  const iconColor = patient.gender === "M" ? "text-blue-500" : "text-pink-500";

  return (
    <div className="col-span-1 flex flex-col divide-y divide-gray-200 rounded-lg bg-white text-center shadow transform transition-transform hover:scale-105 hover:shadow-lg cursor-pointer">
      <div className="flex flex-1 flex-col p-8 items-center">
        {patient.imageUrl ? (
          <Avatar
            alt={patient.name + " " + patient.surname}
            src={patient.imageUrl}
            size="lg"
          />
        ) : (
          <div className="rounded-full bg-gray-200 p-4">
            <GenderIcon className={`h-10 w-10 ${iconColor}`} />{" "}
            {/* Gender-specific icon */}
          </div>
        )}
        <h3 className="mt-6 text-sm font-medium text-gray-900">
          {patient.name + " " + patient.surname}
          <br />
          <CodiceFiscaleValue value={patient.cf} generatedFromImport={Boolean(patient.cfGenerated)} />
        </h3>
      </div>
      <div>
        <div className="-mt-px flex divide-x divide-gray-200">
          <button
            onClick={handleNewVisit}
            className="relative -mr-px inline-flex w-0 flex-1 items-center justify-center gap-x-3 rounded-bl-lg border border-transparent py-4 text-sm font-semibold text-gray-900 transition-colors duration-500 ease-in-out hover:bg-green-500 hover:text-white"
          >
            Nuova Visita
          </button>
        </div>
      </div>
    </div>
  );
}
