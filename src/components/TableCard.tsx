import axios from "axios";
import {
  Avatar,
  AvatarGroup,
  Button,
  Dropdown,
  DropdownItem,
  DropdownMenu,
  DropdownTrigger,
  Link,
} from "@nextui-org/react";
import { useEffect, useState } from "react";
import MoreVertRoundedIcon from "@mui/icons-material/MoreVertRounded";
import RemoveRedEyeOutlinedIcon from "@mui/icons-material/RemoveRedEyeOutlined";
import DeleteOutlinedIcon from "@mui/icons-material/DeleteOutlined";

interface Project {
  ProjectId: number;
  ProjectName: string;
  ProjectDescription: string;
  ProjectCreationDate: string;
  ProjectEndDate: string;
  ProjectManagerId: number;
  ProjectBannerId: number;
  CompanyId: number;
  StatusId: number;
}

interface Member {
  StafferId: number;
  StafferImageUrl: string;
  StafferFullName: string;
  StafferEmail: string;
  RoleName: string;
}

interface Company {
  CompanyId: number;
  CompanyName: string;
  CompnayPhoto: string;
}

interface Status {
  StatusId: number;
  StatusName: string;
  StatusColor: string;
}

interface ModalDeleteData {
  Project: Project;
  open: boolean;
}

export default function TableCard({ project }: { project: Project }) {
  const [company, setCompany] = useState<Company>({
    CompanyId: 0,
    CompanyName: "",
    CompnayPhoto: "",
  });
  const [toDoTasks, setToDoTasks] = useState<number>(0);
  const [statusList, setStatusList] = useState<Status[]>([]);
  const [teamMembers, setTeamMembers] = useState<Member[]>([]);
  const [modalDeleteData, setModalDeleteData] = useState<ModalDeleteData>({
    Project: {
      ProjectId: 0,
      ProjectName: "",
      ProjectDescription: "",
      ProjectCreationDate: "",
      ProjectEndDate: "",
      ProjectManagerId: 0,
      ProjectBannerId: 0,
      CompanyId: 0,
      StatusId: 0,
    },
    open: false,
  });

  useEffect(() => {
    axios.get("/Project/GET/GetAllStatus").then((res) => {
      setStatusList(res.data);
    });
    axios
      .get("/Company/GET/GetCompanyById", {
        params: { CompanyId: project.CompanyId },
      })
      .then((res) => {
        setCompany(res.data[0]);
      });

    axios
      .get("/Project/GET/GetProjetTeamMembers", {
        params: { ProjectId: project.ProjectId },
      })
      .then((res) => {
        setTeamMembers(res.data);
      });
    axios
      .get("/Project/GET/GetTaskToDo", {
        params: { ProjectId: project.ProjectId },
      })
      .then((res) => {
        setToDoTasks(res.data[0].TasksNumber);
      });
  }, []);

  const statuses = [
    "text-green-700 bg-green-50 ring-green-600/20",
    "text-orange-600 bg-orange-50 ring-orange-500/20",
    "text-red-700 bg-red-50 ring-red-600/10",
  ];

  function displayStatus() {
    return statusList.map((status) => {
      if (status.StatusId == project.StatusId) {
        return (
          <span
            key={status.StatusId}
            className={classNames(
              statuses[project.StatusId - 1],
              "rounded-md py-1 px-2 text-xs font-medium ring-1 ring-inset"
            )}
          >
            {status.StatusName}
          </span>
        );
      }
      return null;
    });
  }

  function classNames(...classes: (string | boolean | undefined)[]): string {
    return classes.filter((className) => !!className).join(" ");
  }

  return (
    <>
      <div
        key={project.ProjectId}
        className="overflow-hidden rounded-xl border border-gray-200 list-none"
      >
        <div className="flex items-center justify-between gap-x-4 border-b border-gray-900/5 bg-gray-50 p-6">
          <div className="flex flex-row gap-5">
            <Avatar
              size="lg"
              radius="sm"
              alt={String(project.CompanyId)}
              isBordered
            />
            <div className="flex flex-col">
              <div className="text-sm font-medium leading-6 text-gray-900">
                {project.ProjectName}
              </div>
              <div className="text-sm font-medium leading-6 text-gray-500">
                {company.CompanyName}
              </div>
            </div>
          </div>
          <Dropdown radius="sm">
            <DropdownTrigger>
              <Button isIconOnly size="sm" variant="light">
                <MoreVertRoundedIcon />
              </Button>
            </DropdownTrigger>
            <DropdownMenu>
              <DropdownItem
                as={Link}
                color="primary"
                startContent={<RemoveRedEyeOutlinedIcon />}
                aria-label="View"
                aria-labelledby="View"
                href={
                  "/projects/" +
                  company.CompanyName +
                  "/" +
                  project.ProjectId +
                  "/" +
                  project.ProjectName
                }
              >
                Visualizza
              </DropdownItem>
              <DropdownItem
                color="danger"
                startContent={<DeleteOutlinedIcon />}
                aria-label="Remove"
                aria-labelledby="Remove"
                onClick={() =>
                  setModalDeleteData({
                    ...modalDeleteData,
                    open: true,
                    Project: project,
                  })
                }
              >
                Rimuovi
              </DropdownItem>
            </DropdownMenu>
          </Dropdown>
        </div>
        <dl className="-my-3 divide-y divide-gray-100 px-6 py-4 text-sm leading-6">
          <div className="flex justify-between gap-x-4 py-3">
            <dt className="text-gray-500">Task da fare</dt>
            <dd className="text-gray-700">{toDoTasks}</dd>
          </div>
          <div className="flex justify-between gap-x-4 py-3">
            <dt className="text-gray-500">Team</dt>
            <dd className="text-gray-700">
              <AvatarGroup
                isBordered
                max={4}
                total={teamMembers.length - 4}
                size="sm"
              ></AvatarGroup>
            </dd>
          </div>
          <div className="flex justify-between gap-x-4 py-3">
            <dt className="text-gray-500">Status progetto</dt>
            <dd className="flex items-start gap-x-2">{displayStatus()}</dd>
          </div>
        </dl>
      </div>
    </>
  );
}
