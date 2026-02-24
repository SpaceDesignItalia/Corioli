import { useState } from "react";
import { Input, Button } from "@nextui-org/react";
import Snackbar from "@mui/material/Snackbar";
import Alert from "@mui/material/Alert";
import axios from "axios";
import { useNavigate } from "react-router-dom";

export default function ForgottenPassword() {
  const [email, setEmail] = useState("");
  const [alert, setAlert] = useState<{
    open: boolean;
    message: string;
    severity: "error" | "success";
  }>({
    open: false,
    message: "",
    severity: "error",
  });
  const navigate = useNavigate();

  const handleEmailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEmail(e.target.value);
  };

  const handleForgotPassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    try {
      await axios.post("/Authentication/POST/ForgotPassword", { email });
      setAlert({
        open: true,
        message:
          "Codice di verifica inviato, controlla la tua casella di posta.",
        severity: "success",
      });

      // Reindirizza alla pagina di reset della password dopo un breve ritardo
      setTimeout(() => {
        navigate(`/change-password?email=${encodeURIComponent(email)}`);
      }, 2000);
    } catch (error: any) {
      setAlert({
        open: true,
        message: "Errore durante l'invio dell'email, riprova più tardi.",
        severity: "error",
      });
      console.error(
        "Errore durante l'invio dell'email:",
        error.response?.data || error.message
      );
    }
  };

  const handleClose = () => {
    setAlert({ ...alert, open: false });
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-r from-blue-50 to-blue-100 py-10 px-4">
      <div className="bg-white shadow-xl ring-1 ring-gray-900/10 rounded-2xl p-8 w-full max-w-lg">
        <h1 className="text-3xl font-extrabold text-gray-900 mb-8 text-center">
          Password Dimenticata
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
        <form onSubmit={handleForgotPassword} className="space-y-6">
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium text-gray-700"
            >
              Inserisci la tua email
            </label>
            <Input
              type="email"
              id="email"
              variant="bordered"
              radius="sm"
              onChange={handleEmailChange}
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
            Invia Codice
          </Button>
        </form>
      </div>
    </div>
  );
}
