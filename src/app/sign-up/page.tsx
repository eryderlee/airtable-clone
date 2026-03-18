import Link from "next/link";

import {
  AppleIcon,
  AuthLogo,
  Button,
  Divider,
  GoogleIcon,
} from "~/components/auth/auth-ui";
import { EmailCaptureForm } from "~/components/auth/email-capture-form";
import { signIn } from "~/server/auth";

export default function SignUpPage() {
  return (
    <main className="min-h-screen bg-white text-[#1f2328]">
      <div className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-6 py-12">
        <section className="w-full max-w-xl">
          <div className="-mt-6">
            <AuthLogo />
          </div>
          <div className="mt-10 space-y-6">
            <h1 className="text-4xl font-[450] text-[#13141c]">
              Welcome to Airtable
            </h1>
            <EmailCaptureForm
              label="Work email"
              placeholder="name@company.com"
              buttonText="Continue with email"
              inputId="signup-email"
            />
            <Divider />
            <div className="space-y-3">
              <Button variant="outline">
                Continue with <span className="font-semibold">Single Sign On</span>
              </Button>
              <form
                action={async () => {
                  "use server";
                  await signIn("google", { redirectTo: "/" });
                }}
              >
                <Button type="submit" variant="outline">
                  <GoogleIcon />
                  Continue with <span className="font-semibold">Google</span>
                </Button>
              </form>
              <Button variant="outline">
                <AppleIcon />
                Continue with <span className="font-semibold">Apple</span>
              </Button>
            </div>
          </div>

          <div className="mt-8 space-y-4 text-xs text-[#5f6c7b]">
            <div className="space-y-2 pl-6">
              <p>
                By creating an account, you agree to the{" "}
                <Link href="#" className="font-semibold text-[#0f5cff] underline hover:no-underline">
                  Terms of Service
                </Link>{" "}
                and{" "}
                <Link href="#" className="font-semibold text-[#0f5cff] underline hover:no-underline">
                  Privacy Policy
                </Link>
                .
              </p>
              <p>
                Manage your cookie preferences{" "}
                <Link href="#" className="font-semibold text-[#0f5cff] underline hover:no-underline">
                  here
                </Link>
                .
              </p>
            </div>
            <label className="flex items-start gap-2 text-left text-xs text-[#3c4654]">
              <input type="checkbox" className="mt-1 h-4 w-4 rounded border border-[#c7ced9]" />
              <span>
                By checking this box, I agree to receive marketing communications about Airtable
                products and events. I understand that I can manage my preferences at any time by
                following the instructions in the communications received.
              </span>
            </label>
            <p className="pt-2 pl-6 text-sm">
              Already have an account?{" "}
              <Link href="/sign-in" className="font-semibold text-[#0f5cff] underline hover:no-underline">
                Sign in
              </Link>
            </p>
          </div>
        </section>
      </div>
    </main>
  );
}
