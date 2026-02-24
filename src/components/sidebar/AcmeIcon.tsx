import React from "react";

export const AcmeIcon = ({className = ""}: {className?: string}) => (
  <svg
    aria-hidden="true"
    fill="none"
    focusable="false"
    height="18"
    viewBox="0 0 32 32"
    width="18"
    className={className}
  >
    <path
      clipRule="evenodd"
      d="M17.41 3.3c-.8-1.067-2.42-1.067-3.22 0L1.042 18.63c-.94 1.253-.063 3.04 1.61 3.04H7.98c.37 0 .67.3.67.67v5.62c0 1.3 1.05 2.35 2.35 2.35h9.99c1.3 0 2.35-1.05 2.35-2.35v-5.62c0-.37.3-.67.67-.67h5.33c1.67 0 2.55-1.787 1.61-3.04L17.41 3.3zM16 6.1l10.26 13.69h-4.58c-1.3 0-2.35 1.05-2.35 2.35v5.62h-6.65v-5.62c0-1.3-1.05-2.35-2.35-2.35H5.74L16 6.1z"
      fill="currentColor"
      fillRule="evenodd"
    />
  </svg>
);


