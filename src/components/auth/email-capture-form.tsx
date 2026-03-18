"use client";

import { useState, type FormEvent } from "react";

import { Button } from "./auth-ui";

type Props = {
  label: string;
  placeholder: string;
  buttonText: string;
  inputId: string;
};

export function EmailCaptureForm({
  label,
  placeholder,
  buttonText,
  inputId,
}: Props) {
  const [value, setValue] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    // Submit logic handled by actual auth flow; this UI mirrors Airtable.
  }

  const buttonStateClass = value
    ? "!bg-[#1c64e4]"
    : "!bg-[#8fb0e9] !cursor-not-allowed";

  return (
    <form className="space-y-3" onSubmit={handleSubmit}>
      <label
        htmlFor={inputId}
        className="block text-sm font-medium text-[#3b424d]"
      >
        {label}
      </label>
      <input
        id={inputId}
        type="email"
        placeholder={placeholder}
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="w-full rounded-xl border border-[#dfe2e8] px-4 py-3 text-base text-[#1b1f2b] outline-none transition focus:border-[#2667ff] focus:bg-[#eef3ff] focus:ring-2 focus:ring-[#c8d9ff]"
      />
      <Button type="submit" className={`${buttonStateClass} text-white`}>
        {buttonText}
      </Button>
    </form>
  );
}
