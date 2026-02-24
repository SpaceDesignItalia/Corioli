import img1 from "../../assets/img1.jpg";
import img2 from "../../assets/img2.jpg";
import img3 from "../../assets/img3.jpg";
import img4 from "../../assets/img4.jpg";
import img5 from "../../assets/imgBraia.jpg";
import ArrowForwardIcon from "@mui/icons-material/ArrowForward";
import { useNavigate } from "react-router-dom";

export default function About() {
  const navigate = useNavigate();
  
  return (
    <div className="bg-gray-50 min-h-screen">
      <main className="relative isolate">
        {/* Top Navigation */}
        <div className="absolute top-4 right-4 flex items-center space-x-2">
          <button
            onClick={() => navigate("/")}
            className="text-blue-600 font-semibold hover:underline flex items-center space-x-1"
          >
            <span>Login</span>
            <ArrowForwardIcon className="text-blue-600" />
          </button>
        </div>

        {/* Background Gradient */}
        <div className="relative isolate -z-10">
          <div
            className="absolute left-1/2 right-0 top-0 -z-10 -ml-24 transform-gpu overflow-hidden blur-3xl lg:ml-24 xl:ml-48"
            aria-hidden="true"
          >
            <div
              className="aspect-[801/1036] w-full h-full bg-gradient-to-tr from-[#67a2b2] to-[#dbeaff]"
              style={{
                clipPath:
                  "polygon(63.1% 29.5%, 100% 17.1%, 76.6% 3%, 48.4% 0%, 44.6% 4.7%, 54.5% 25.3%, 59.8% 49%, 55.2% 57.8%, 44.4% 57.2%, 27.8% 47.9%, 35.1% 81.5%, 0% 97.7%, 39.2% 100%, 35.2% 81.4%, 97.2% 52.8%, 63.1% 29.5%)",
              }}
            />
          </div>

          {/* Content Section */}
          <div className="overflow-hidden">
            <div className="mx-auto max-w-7xl px-6 pb-32 pt-36 sm:pt-60 lg:px-8 lg:pt-32">
              <div className="mx-auto max-w-2xl gap-x-14 lg:mx-0 lg:flex lg:max-w-none lg:items-center">
                <div className="w-full max-w-xl lg:shrink-0 xl:max-w-2xl">
                  <h1 className="text-4xl font-bold tracking-tight text-gray-900 sm:text-6xl">
                    Corioli
                  </h1>
                  <p className="relative mt-6 text-lg leading-8 text-gray-700 sm:max-w-md lg:max-w-none">
                    <strong>Corioli</strong> è un'applicazione medica
                    rivoluzionaria, creata per rendere la gestione sanitaria
                    semplice e intuitiva. Con una combinazione di tecnologia
                    avanzata e interfacce intuitive, Corioli fornisce un
                    supporto completo sia per i medici che per i pazienti.
                  </p>
                  <p className="mt-4 text-lg leading-8 text-gray-700 sm:max-w-md lg:max-w-none">
                    Corioli consente ai medici di organizzare cartelle cliniche,
                    pianificare appuntamenti e monitorare trattamenti in modo
                    efficiente. I pazienti, invece, possono facilmente accedere
                    alle proprie informazioni mediche e comunicare direttamente
                    con i professionisti sanitari.
                  </p>
                  <p className="mt-4 text-lg leading-8 text-gray-700 sm:max-w-md lg:max-w-none">
                    Con un impegno costante verso la sicurezza dei dati, Corioli
                    utilizza le più recenti tecnologie di crittografia per
                    proteggere tutte le informazioni sensibili, partecipando
                    attivamente a competizioni di cybersecurity per dimostrare
                    l'affidabilità del sistema.
                  </p>
                </div>

                {/* Image Section */}
                <div className="mt-14 flex justify-end gap-8 sm:-mt-44 sm:justify-start sm:pl-20 lg:mt-0 lg:pl-0">
                  <div className="ml-auto w-44 flex-none space-y-8 pt-32 sm:ml-0 sm:pt-80 lg:order-last lg:pt-36 xl:order-none xl:pt-80">
                    <div className="relative">
                      <img
                        src={img1}
                        alt="Team meeting"
                        className="aspect-[2/3] w-full rounded-2xl bg-gray-200 object-cover shadow-lg"
                      />
                      <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-gray-900/10" />
                    </div>
                  </div>
                  <div className="mr-auto w-44 flex-none space-y-8 sm:mr-0 sm:pt-52 lg:pt-36">
                    <div className="relative">
                      <img
                        src={img2}
                        alt="Healthcare professionals"
                        className="aspect-[2/3] w-full rounded-2xl bg-gray-200 object-cover shadow-lg"
                      />
                      <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-gray-900/10" />
                    </div>
                    <div className="relative">
                      <img
                        src={img3}
                        alt="Cybersecurity event"
                        className="aspect-[2/3] w-full rounded-2xl bg-gray-200 object-cover shadow-lg"
                      />
                      <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-gray-900/10" />
                    </div>
                  </div>
                  <div className="w-44 flex-none space-y-8 pt-32 sm:pt-0">
                    <div className="relative">
                      <img
                        src={img4}
                        alt="Award ceremony"
                        className="aspect-[2/3] w-full rounded-2xl bg-gray-200 object-cover shadow-lg"
                      />
                      <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-gray-900/10" />
                    </div>
                    <div className="relative">
                      <img
                        src={img5}
                        alt="Teamwork"
                        className="aspect-[2/3] w-full rounded-2xl bg-gray-200 object-cover shadow-lg"
                      />
                      <div className="pointer-events-none absolute inset-0 rounded-2xl ring-1 ring-inset ring-gray-900/10" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
