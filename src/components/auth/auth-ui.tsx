import type { ButtonHTMLAttributes } from "react";

import Image from "next/image";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: "primary" | "outline";
};

export function Button({
  className = "",
  children,
  variant = "primary",
  ...props
}: ButtonProps) {
  const base =
    "flex h-12 w-full items-center justify-center gap-2 rounded-xl px-4 text-[14px] font-medium transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 hover:shadow-[0_4px_12px_rgba(0,0,0,0.07)]";
  const variants = {
    primary:
      "bg-[#6a90e0] text-white focus-visible:outline-[#5a82d6]",
    outline:
      "border border-[#dfe2e8] bg-white text-[#161b25] focus-visible:outline-[#c4cddc]",
  };

  return (
    <button className={`${base} ${variants[variant]} ${className}`} {...props}>
      {children}
    </button>
  );
}

export function Divider() {
  return (
    <p className="text-center text-sm font-medium text-[#5f6c7b]">or</p>
  );
}

export function AuthLogo() {
  return (
    <Image
      src="/airtable%20logo.png"
      alt="Airtable logo"
      width={42}
      height={42}
      priority
    />
  );
}

export function GoogleIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 20 20"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M19.6 10.23c0-.68-.06-1.36-.18-2.02H10v3.82h5.41a4.64 4.64 0 0 1-2 3.04v2.52h3.22c1.89-1.74 2.97-4.31 2.97-7.36Z"
        fill="#4285F4"
      />
      <path
        d="M10 20c2.7 0 4.96-.88 6.61-2.4l-3.22-2.52c-.89.6-2.03.94-3.39.94-2.6 0-4.8-1.75-5.58-4.1H1.08v2.58A10 10 0 0 0 10 20Z"
        fill="#34A853"
      />
      <path
        d="M4.42 11.92a6.01 6.01 0 0 1 0-3.84V5.5H1.08a10 10 0 0 0 0 9l3.34-2.58Z"
        fill="#FBBC05"
      />
      <path
        d="M10 3.96c1.46 0 2.77.5 3.8 1.47l2.85-2.85C14.95.88 12.7 0 10 0A10 10 0 0 0 1.08 5.5l3.34 2.58C5.2 5.7 7.4 3.96 10 3.96Z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function AppleIcon() {
  return (
    <svg
      className="h-4 w-4"
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M11.77 8.98c-.02-1.6.7-2.81 2.23-3.71-.84-1.19-2.08-1.86-3.69-1.87-1.55-.02-3.08.9-3.88.9-.8 0-2.09-.88-3.45-.86-1.78.03-3.42 1.04-4.33 2.64-1.86 3.23-.47 8.01 1.34 10.65.89 1.28 1.95 2.71 3.35 2.66 1.34-.05 1.85-.86 3.46-.86 1.61 0 2.06.86 3.45.83 1.42-.03 2.32-1.27 3.19-2.56 1-1.46 1.41-2.88 1.43-2.96-.02-.01-2.76-1.06-2.8-4.03Z"
        fill="#000000"
      />
      <path
        d="M9.88 2.01c.9-1.12 1.45-2.55 1.33-3.96-1.21.05-2.56.8-3.37 1.77-.74.87-1.39 2.24-1.22 3.55 1.29.1 2.6-.66 3.26-1.36Z"
        fill="#000000"
      />
    </svg>
  );
}
