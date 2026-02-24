import { Input, Button } from "@nextui-org/react";
import { ChangeEvent, useState } from "react";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import axios from "axios";

interface RegisterData {
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  VAT: string;
  regionalCode: string;
  password: string;
}

export default function Register() {
  const [registerData, setRegisterData] = useState<RegisterData>({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    VAT: "",
    regionalCode: "",
    password: "",
  });
  const [confirmPassword, setConfirmPassword] = useState<string>("");
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [isVisible2, setIsVisible2] = useState<boolean>(false);
  const [alert, setAlert] = useState<{
    open: boolean;
    message: string;
    severity: "error" | "success";
  }>({
    open: false,
    message: "",
    severity: "error",
  });

  const handleChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setRegisterData((prevData) => ({ ...prevData, [id]: value }));
  };

  const handleConfirmPasswordChange = (e: ChangeEvent<HTMLInputElement>) => {
    setConfirmPassword(e.target.value);
  };

  const checkSamePassword = () => registerData.password === confirmPassword;

  const validateEmail = (email: string) => {
    const re = /\S+@\S+\.\S+/;
    return re.test(email);
  };

  const validatePhone = (phone: string) => {
    const re = /^[0-9]{10,15}$/;
    return re.test(phone);
  };

  const validateVAT = (VAT: string) => {
    const re = /^[A-Z0-9]{11}$/;
    return re.test(VAT);
  };

  const handleRegistration = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();

    if (!checkSamePassword()) {
      setAlert({
        open: true,
        message: "Le due password non coincidono",
        severity: "error",
      });
      return;
    }

    if (!validateEmail(registerData.email)) {
      setAlert({ open: true, message: "Email non valida", severity: "error" });
      return;
    }

    if (!validatePhone(registerData.phone)) {
      setAlert({
        open: true,
        message: "Numero di telefono non valido",
        severity: "error",
      });
      return;
    }

    if (!validateVAT(registerData.VAT)) {
      setAlert({
        open: true,
        message: "Partita IVA non valida",
        severity: "error",
      });
      return;
    }

    try {
      const res = await axios.post(
        "/Authentication/POST/Register",
        {
          userData: registerData,
        },
        { withCredentials: true }
      );

      if (res.status === 200) {
        setAlert({
          open: true,
          message: "Registrazione avvenuta con successo!",
          severity: "success",
        });
        window.location.href = "/";
      }

      // Handle successful registration, e.g., redirect, show message, etc.
    } catch (error: any) {
      if (axios.isAxiosError(error)) {
        console.error(
          "Error registering:",
          error.response?.data || error.message
        );
        setAlert({
          open: true,
          message: error.response?.data?.message || "Registration failed",
          severity: "error",
        });
      } else {
        console.error("Unexpected error:", error);
        setAlert({
          open: true,
          message: "An unexpected error occurred. Please try again.",
          severity: "error",
        });
      }
    }
  };

  const handleClose = (
    event?: React.SyntheticEvent | Event,
    reason?: string
  ) => {
    if (reason === "clickaway") {
      return;
    }
    console.log(event);
    setAlert((prevAlert) => ({ ...prevAlert, open: false }));
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-r from-blue-50 to-blue-100 py-10 px-4">
      <div className="bg-white shadow-xl ring-1 ring-gray-900/10 rounded-2xl p-8 w-full max-w-3xl">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-8 text-center">
          Crea un account
        </h1>
        <Snackbar
          open={alert.open}
          autoHideDuration={6000}
          onClose={handleClose}
        >
          <Alert
            onClose={handleClose}
            severity={alert.severity}
            variant="filled"
            sx={{ width: "100%" }}
          >
            {alert.message}
          </Alert>
        </Snackbar>
        <form className="space-y-6" onSubmit={handleRegistration}>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label
                htmlFor="firstName"
                className="block text-sm font-medium text-gray-700"
              >
                Nome
              </label>
              <Input
                variant="bordered"
                radius="sm"
                id="firstName"
                onChange={handleChange}
                fullWidth
                required
              />
            </div>

            <div>
              <label
                htmlFor="lastName"
                className="block text-sm font-medium text-gray-700"
              >
                Cognome
              </label>
              <Input
                variant="bordered"
                radius="sm"
                id="lastName"
                onChange={handleChange}
                fullWidth
                required
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-gray-700"
              >
                Email
              </label>
              <Input
                type="email"
                variant="bordered"
                radius="sm"
                id="email"
                onChange={handleChange}
                fullWidth
                required
              />
            </div>

            <div>
              <label
                htmlFor="phone"
                className="block text-sm font-medium text-gray-700"
              >
                Telefono
              </label>
              <Input
                variant="bordered"
                radius="sm"
                id="phone"
                onChange={handleChange}
                fullWidth
                required
              />
            </div>
          </div>

          <div>
            <label
              htmlFor="VAT"
              className="block text-sm font-medium text-gray-700"
            >
              Partita IVA
            </label>
            <Input
              variant="bordered"
              radius="sm"
              id="VAT"
              onChange={handleChange}
              fullWidth
              required
            />
          </div>

          <div>
            <label
              htmlFor="regionalCode"
              className="block text-sm font-medium text-gray-700"
            >
              Codice Regionale
            </label>
            <Input
              variant="bordered"
              radius="sm"
              id="regionalCode"
              onChange={handleChange}
              fullWidth
              required
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-gray-700"
            >
              Password
            </label>
            <Input
              type={isVisible ? "text" : "password"}
              variant="bordered"
              radius="sm"
              id="password"
              onChange={handleChange}
              endContent={
                <button
                  className="focus:outline-none"
                  type="button"
                  onClick={() => setIsVisible(!isVisible)}
                >
                  {isVisible ? (
                    <VisibilityIcon className="text-2xl text-default-400 pointer-events-none" />
                  ) : (
                    <VisibilityOffIcon className="text-2xl text-default-400 pointer-events-none" />
                  )}
                </button>
              }
              fullWidth
              required
            />
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-gray-700"
            >
              Conferma Password
            </label>
            <Input
              type={isVisible2 ? "text" : "password"}
              variant="bordered"
              radius="sm"
              id="confirmPassword"
              endContent={
                <button
                  className="focus:outline-none"
                  type="button"
                  onClick={() => setIsVisible2(!isVisible2)}
                >
                  {isVisible2 ? (
                    <VisibilityIcon className="text-2xl text-default-400 pointer-events-none" />
                  ) : (
                    <VisibilityOffIcon className="text-2xl text-default-400 pointer-events-none" />
                  )}
                </button>
              }
              onChange={handleConfirmPasswordChange}
              fullWidth
              required
            />
          </div>

          <Button
            type="submit"
            color="primary"
            radius="sm"
            className="w-full mt-6 text-lg"
            size="lg"
          >
            Registrati
          </Button>
        </form>
      </div>
    </div>
  );
}
