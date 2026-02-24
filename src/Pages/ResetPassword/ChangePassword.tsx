import { useState } from "react";
import { Input, Button } from "@nextui-org/react";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import axios from "axios";
import { useNavigate, useSearchParams } from "react-router-dom";

export default function ChangePassword() {
  const [resetPasswordData, setResetPasswordData] = useState({
    newPassword: "",
    confirmPassword: "",
    verificationCode: "",
  });
  const [alert, setAlert] = useState({
    open: false,
    message: "",
    severity: "error" | "success",
  });
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const email = searchParams.get("email");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setResetPasswordData((prevData) => ({ ...prevData, [id]: value }));
  };

  const handleResetPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (resetPasswordData.newPassword !== resetPasswordData.confirmPassword) {
      setAlert({
        open: true,
        message: "Le due password non coincidono",
        severity: "error",
      });
      return;
    }
    try {
      await axios.post("/Authentication/POST/ResetPassword", {
        email,
        code: resetPasswordData.verificationCode,
        newPassword: resetPasswordData.newPassword,
      });
      setAlert({
        open: true,
        message: "Password cambiata con successo!",
        severity: "success",
      });

      setTimeout(() => {
        navigate("/login");
      }, 2000);
    } catch (error: any) {
      setAlert({
        open: true,
        message: "Errore durante il reset della password, riprova più tardi.",
        severity: "error",
      });
      console.error(
        "Error resetting password:",
        error.response?.data || error.message
      );
    }
  };

  const handleClose = () => {
    setAlert({ ...alert, open: false });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-r from-blue-50 to-blue-100 py-10 px-4">
      <div className="bg-white shadow-xl ring-1 ring-gray-900/10 rounded-2xl p-8 w-full max-w-3xl">
        <h1 className="text-4xl font-extrabold text-gray-900 mb-8 text-center">
          Cambia Password
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
        <form className="space-y-6" onSubmit={handleResetPassword}>
          <div>
            <label
              htmlFor="verificationCode"
              className="block text-sm font-medium text-gray-700"
            >
              Codice di Verifica
            </label>
            <Input
              type="text"
              id="verificationCode"
              variant="bordered"
              radius="sm"
              onChange={handleChange}
              fullWidth
              required
            />
          </div>
          <div>
            <label
              htmlFor="newPassword"
              className="block text-sm font-medium text-gray-700"
            >
              Nuova Password
            </label>
            <Input
              type="password"
              id="newPassword"
              variant="bordered"
              radius="sm"
              onChange={handleChange}
              fullWidth
              required
            />
          </div>
          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-gray-700"
            >
              Conferma Nuova Password
            </label>
            <Input
              type="password"
              id="confirmPassword"
              variant="bordered"
              radius="sm"
              onChange={handleChange}
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
            Reset Password
          </Button>
        </form>
      </div>
    </div>
  );
}
