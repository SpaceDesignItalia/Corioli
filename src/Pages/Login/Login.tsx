import { useState, ChangeEvent, useMemo } from "react";
import { Input } from "@nextui-org/react";
import { useNavigate } from "react-router-dom";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import dottoressa from "../../assets/dottoressa.png";
import axios from "axios";

interface LoginData {
  email: string;
  password: string;
}

export default function Login() {
  const navigate = useNavigate();
  const [loginData, setLoginData] = useState<LoginData>({
    email: "",
    password: "",
  });
  const [isVisible, setIsVisible] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const validateEmail = (value: string): boolean => {
    const emailRegex = /^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,4}$/i;
    return emailRegex.test(value);
  };

  const isInvalid = useMemo(() => {
    if (loginData.email === "") return false;
    return !validateEmail(loginData.email);
  }, [loginData.email]);

  const toggleVisibility = () => setIsVisible(!isVisible);

  const handleEmailChange = (e: ChangeEvent<HTMLInputElement>) => {
    const email = e.target.value;
    setLoginData({ ...loginData, email });
  };

  const handlePasswordChange = (e: ChangeEvent<HTMLInputElement>) => {
    const password = e.target.value;
    setLoginData({ ...loginData, password });
  };

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      const res = await axios.post(
        "/Authentication/POST/Login",
        {
          LoginData: loginData,
        },
        { withCredentials: true }
      );
      if (res.status === 200) {
        navigate("/dashboard");
      }
    } catch (error: any) {
      console.error("Error logging in:", error.response?.data || error.message);
      setErrorMessage(error.response?.data?.message || "Login failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        fontFamily: "sans-serif",
        background: "linear-gradient(105deg, #67a2b2, #e9f6ff)",
        color: "#333",
      }}
      className="md:h-screen relative"
    >
      <div className="absolute top-4 right-4 flex items-center space-x-2">
            <button
              onClick={() => navigate("/about-us")}
              className="text-blue-600 font-semibold hover:underline flex items-center space-x-1"
            >
              <span>About Us</span>
              <ArrowForwardIcon className="text-blue-600" />
            </button>
      </div>
      <div className="grid md:grid-cols-2 items-center gap-8 h-full">
        <div className="max-md:order-1 p-4">
          <img
            src={dottoressa}
            className="lg:max-w-[80%] w-full h-full object-contain block mx-auto"
            alt="Medical drawing template"
          />
        </div>
        <div className="flex items-center md:p-8 p-6 bg-white md:rounded-tl-[55px] md:rounded-bl-[55px] h-full">
          <form
            className="max-w-lg w-full mx-auto"
            onSubmit={(e) => {
              e.preventDefault();
              handleLogin();
            }}
          >
            <div className="mb-12">
              <h3 className="text-4xl font-extrabold">Accedi</h3>
              <p className="text-sm mt-4">
                Non hai un account?
                <a
                  href="/register"
                  className="text-blue-600 font-semibold hover:underline ml-1 whitespace-nowrap"
                >
                  Registrati qu
                </a>
              </p>
            </div>
            <div>
              <div className="relative flex items-center">
                <Input
                  type="email"
                  label="Email"
                  variant="underlined"
                  onChange={handleEmailChange}
                  value={loginData.email}
                  isInvalid={isInvalid}
                  errorMessage={isInvalid ? "Inserisci una email valida" : ""}
                />
              </div>
            </div>
            <div className="mt-8">
              <div className="relative flex items-center">
                <Input
                  type={isVisible ? "text" : "password"}
                  label="Password"
                  variant="underlined"
                  endContent={
                    <button
                      className="focus:outline-none"
                      type="button"
                      onClick={toggleVisibility}
                    >
                      {isVisible ? (
                        <VisibilityIcon className="text-2xl text-default-400 pointer-events-none" />
                      ) : (
                        <VisibilityOffIcon className="text-2xl text-default-400 pointer-events-none" />
                      )}
                    </button>
                  }
                  onChange={handlePasswordChange}
                  value={loginData.password}
                />
              </div>
            </div>
            <div className="flex items-center justify-between gap-2 mt-5">
              <div className="flex items-center"></div>
              <div>
                <a
                  href="/forgotten-password"
                  className="text-blue-600 font-semibold text-sm hover:underline"
                >
                  Password dimenticata?
                </a>
              </div>
            </div>
            {errorMessage && (
              <div className="mt-4 text-red-500 text-sm">{errorMessage}</div>
            )}
            <div className="mt-12">
              <button
                type="submit"
                disabled={isLoading}
                className={`w-full shadow-xl py-2.5 px-4 text-sm font-semibold rounded-full text-white ${
                  isLoading ? "bg-gray-400" : "bg-[#333] hover:bg-[#222]"
                } focus:outline-none`}
              >
                {isLoading ? "Caricamento..." : "Accedi"}
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
