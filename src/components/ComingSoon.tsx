import React from "react";

const ComingSoon: React.FC = () => {
  const handleNotifyClick = () => {
    const email = "pablobertot@gmail.com"; // Sostituisci con il tuo indirizzo email
    const subject = "Applicativo Corioli";
    const body = "Come sta andando il tuo progetto?";
    const mailtoUrl = `mailto:${email}?subject=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;
    const gmailUrl = `https://mail.google.com/mail/?view=cm&fs=1&to=${email}&su=${encodeURIComponent(
      subject
    )}&body=${encodeURIComponent(body)}`;

    // Verifica se è un dispositivo mobile
    if (/Android|iPhone|iPad|iPod/i.test(navigator.userAgent)) {
      window.location.href = mailtoUrl;
    } else {
      window.location.href = gmailUrl;
    }
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-r from-brand-200 to-brand-700 py-10 px-4">
      <div className="bg-white shadow-xl ring-1 ring-gray-900/10 rounded-2xl p-8 w-full max-w-2xl text-center">
        <h1 className="text-5xl font-extrabold text-gray-900 mb-8 bg-clip-text text-transparent bg-gradient-to-r from-brand-300 via-brand-500 to-brand-800">
          In Costruzione
        </h1>
        <p className="text-lg mb-8 text-gray-800">
          Stiamo lavorando per portare nuove funzionalità!
        </p>
        <button
          className="px-6 py-3 bg-brand-800 text-white rounded-lg hover:bg-brand-900 transition text-lg"
          onClick={handleNotifyClick}
        >
          Domande
        </button>
      </div>
    </div>
  );
};

export default ComingSoon;
