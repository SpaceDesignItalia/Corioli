import { motion } from "framer-motion";
import { useEffect, useState } from "react";

export type MascotField =
  | "nome"
  | "cognome"
  | "email"
  | "telefono"
  | "specializzazione"
  | "pin"
  | "pin-confirm"
  | null;

type Props = {
  activeField?: MascotField;
  /** PIN completo (4 cifre) → celebrazione. */
  pinComplete?: boolean;
  /** Diametro del cerchio di sfondo in px. */
  size?: number;
};

const FEATHER = "#2C5F5A";

const LOOK: Record<string, { x: number; y: number }> = {
  idle: { x: 0, y: 0 },
  nome: { x: -8, y: -1 },
  cognome: { x: 8, y: -1 },
  email: { x: 0, y: -7 },
  telefono: { x: -6, y: 7 },
  specializzazione: { x: 6, y: 7 },
};

const BROWS: Record<string, [string, string]> = {
  idle: ["M 62 66 Q 78 58 92 64", "M 108 64 Q 122 58 138 66"],
  nome: ["M 62 68 Q 78 60 92 62", "M 108 62 Q 122 58 138 66"],
  cognome: ["M 62 62 Q 78 58 92 66", "M 108 66 Q 122 60 138 68"],
  email: ["M 62 62 Q 78 54 92 60", "M 108 60 Q 122 54 138 62"],
  telefono: ["M 64 70 Q 78 64 92 68", "M 108 68 Q 122 64 136 70"],
  pin: ["M 64 70 Q 78 65 92 69", "M 108 69 Q 122 65 136 70"],
  happy: ["M 62 60 Q 78 54 92 58", "M 108 58 Q 122 54 138 60"],
};

const WING_REST = {
  l: "M 50 110 Q 30 114 28 146 Q 32 172 56 162 Q 48 138 52 116 Z",
  r: "M 150 110 Q 170 114 172 146 Q 168 172 144 162 Q 152 138 148 116 Z",
};
const WING_COVER = {
  l: "M 50 110 Q 34 70 64 56 Q 100 50 104 84 Q 100 112 78 116 Q 60 110 50 110 Z",
  r: "M 150 110 Q 166 70 136 56 Q 100 50 96 84 Q 100 112 122 116 Q 140 110 150 110 Z",
};

const SPRING = { type: "spring" as const, stiffness: 300, damping: 22 };
const WING_SPRING = { type: "spring" as const, stiffness: 220, damping: 18 };

export default function DoctorMascot({
  activeField = null,
  pinComplete = false,
  size = 96,
}: Props) {
  const isPin = activeField === "pin" || activeField === "pin-confirm";
  const af = activeField ?? "idle";

  // CELEBRAZIONE: PIN completo → ali giù, occhi felici, rimbalzo
  const celebrate = isPin && pinComplete;
  // le ali coprono solo se PIN attivo MA non completo
  const wingsCover = isPin && !pinComplete;

  // ANTICIPO: occhi spalancati per ~220ms quando il PIN si attiva
  const [anticipate, setAnticipate] = useState(false);
  useEffect(() => {
    if (isPin && !pinComplete) {
      setAnticipate(true);
      const t = setTimeout(() => setAnticipate(false), 220);
      return () => clearTimeout(t);
    }
    setAnticipate(false);
  }, [isPin, pinComplete]);

  const browKey = celebrate ? "happy" : isPin ? "pin" : BROWS[af] ? af : "idle";
  const o = LOOK[af] ?? LOOK.idle;
  const brow = BROWS[browKey];

  // posizioni pupille (occhio sx centro 78,92 — dx 122,92)
  const lP = { cx: 78 + o.x, cy: 92 + o.y };
  const rP = { cx: 122 + o.x, cy: 92 + o.y };
  const lIr = { cx: 78 + o.x * 0.45, cy: 92 + o.y * 0.45 };
  const rIr = { cx: 122 + o.x * 0.45, cy: 92 + o.y * 0.45 };

  const [blink, setBlink] = useState(false);
  useEffect(() => {
    if (isPin) return;
    const id = setInterval(() => {
      setBlink(true);
      setTimeout(() => setBlink(false), 110);
    }, 4200);
    return () => clearInterval(id);
  }, [isPin]);

  return (
    <motion.div
      animate={
        celebrate
          ? { scale: [1, 1.12, 0.96, 1.04, 1], y: [0, -6, 0] }
          : { scale: 1, y: 0 }
      }
      transition={celebrate ? { duration: 0.6, ease: "easeOut" } : { duration: 0.2 }}
      style={{
        width: size,
        height: size,
        borderRadius: "50%",
        background: celebrate ? "#9FE1CB" : "#E1F5EE",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        overflow: "visible",
        transition: "background 0.3s",
      }}
    >
      <svg
        width={size}
        height={size}
        viewBox="0 0 200 200"
        role="img"
        aria-label="Mascotte gufo Corioli"
        style={{ overflow: "visible" }}
      >
        {/* corpo */}
        <ellipse cx="100" cy="118" rx="56" ry="60" fill={FEATHER} />
        {/* ciuffi */}
        <path d="M 58 70 Q 52 44 64 40 Q 70 54 70 70 Z" fill={FEATHER} />
        <path d="M 142 70 Q 148 44 136 40 Q 130 54 130 70 Z" fill={FEATHER} />
        {/* petto */}
        <ellipse cx="100" cy="126" rx="34" ry="44" fill="#F4EFE4" />

        {/* occhi */}
        {celebrate ? (
          <>
            {/* occhi sorridenti (archi verso l'alto) */}
            <path
              d="M 66 94 Q 78 84 90 94"
              stroke="#163A33"
              strokeWidth="3.5"
              fill="none"
              strokeLinecap="round"
            />
            <path
              d="M 110 94 Q 122 84 134 94"
              stroke="#163A33"
              strokeWidth="3.5"
              fill="none"
              strokeLinecap="round"
            />
          </>
        ) : (
          <motion.g
            animate={{ scaleY: blink ? 0.1 : 1 }}
            style={{ transformOrigin: "100px 92px" }}
            transition={{ duration: 0.1 }}
          >
            {/* occhio sinistro */}
            <circle cx="78" cy="92" r="25" fill="#9FE1CB" />
            <circle cx="78" cy="92" r="19" fill="#FFFFFF" />
            <motion.circle
              r={anticipate ? 13 : 11}
              fill="#163A33"
              animate={{ cx: lIr.cx, cy: lIr.cy }}
              transition={SPRING}
            />
            <motion.circle
              r={anticipate ? 6.5 : 5.5}
              fill="#000"
              animate={lP}
              transition={SPRING}
            />
            <motion.circle
              r="2.4"
              fill="#fff"
              animate={{ cx: lP.cx + 3, cy: lP.cy - 3 }}
              transition={SPRING}
            />

            {/* occhio destro */}
            <circle cx="122" cy="92" r="25" fill="#9FE1CB" />
            <circle cx="122" cy="92" r="19" fill="#FFFFFF" />
            <motion.circle
              r={anticipate ? 13 : 11}
              fill="#163A33"
              animate={{ cx: rIr.cx, cy: rIr.cy }}
              transition={SPRING}
            />
            <motion.circle
              r={anticipate ? 6.5 : 5.5}
              fill="#000"
              animate={rP}
              transition={SPRING}
            />
            <motion.circle
              r="2.4"
              fill="#fff"
              animate={{ cx: rP.cx + 3, cy: rP.cy - 3 }}
              transition={SPRING}
            />
          </motion.g>
        )}

        {/* sopracciglia */}
        <motion.path
          stroke="#163A33"
          strokeWidth="3.2"
          fill="none"
          strokeLinecap="round"
          animate={{ d: brow[0] }}
          transition={SPRING}
        />
        <motion.path
          stroke="#163A33"
          strokeWidth="3.2"
          fill="none"
          strokeLinecap="round"
          animate={{ d: brow[1] }}
          transition={SPRING}
        />

        {/* becco */}
        <path d="M 93 104 L 100 116 L 107 104 Z" fill="#E8A020" />

        {/* zampette */}
        <path
          d="M 86 176 l -6 10 M 86 176 l 0 11 M 86 176 l 6 10"
          stroke="#E8A020"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />
        <path
          d="M 114 176 l -6 10 M 114 176 l 0 11 M 114 176 l 6 10"
          stroke="#E8A020"
          strokeWidth="3"
          strokeLinecap="round"
          fill="none"
        />

        {/* ALI — ULTIME, sempre sopra gli occhi. Cambiano FORMA, non ruotano */}
        <motion.path
          fill={FEATHER}
          animate={{ d: wingsCover ? WING_COVER.l : WING_REST.l }}
          transition={WING_SPRING}
        />
        <motion.path
          fill={FEATHER}
          animate={{ d: wingsCover ? WING_COVER.r : WING_REST.r }}
          transition={WING_SPRING}
        />
      </svg>
    </motion.div>
  );
}
