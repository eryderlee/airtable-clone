import Image from "next/image";
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

export default function SignInPage() {
  return (
    <main className="min-h-screen bg-white text-[#1f2328]">
      <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col items-center gap-12 px-6 pt-12 pb-16 lg:flex-row lg:items-center lg:justify-between lg:gap-32">
        <section className="w-full max-w-[500px] lg:-ml-20">
          <div className="mb-12">
            <AuthLogo />
          </div>
          <div className="space-y-8">
            <h1 className="mb-6 text-[32px] font-[550] leading-tight text-[#13141c]">
              Sign in to Airtable
            </h1>
            <EmailCaptureForm
              label="Email"
              placeholder="Email address"
              buttonText="Continue"
              inputId="signin-email"
            />
            <Divider />
            <div className="space-y-3 !mt-2 ">
              <Button variant="outline">
                Sign in with <span className="font-[650]">Single Sign On</span>
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
                Continue with <span className="font-semibold">Apple ID</span>
              </Button>
            </div>
          </div>

          <div className="pt-12 text-[13px] text-[#5f6c7b]" style={{ transform: "translateY(25px)" }}>
            <p>
              New to Airtable?{" "}
              <Link
                href="/sign-up"
                className="font-semibold text-[#0f5cff] underline hover:no-underline"
              >
                Create an account
              </Link>{" "}
              instead
            </p>
          </div>
          <div className="pt-3 text-[13px] text-[#5f6c7b]" style={{ transform: "translateY(30px)" }}>
            <p>
              Manage your cookie preferences{" "}
              <Link
                href="#"
                className="font-semibold text-[#0f5cff] underline hover:no-underline"
              >
                here
              </Link>
              .
            </p>
          </div>
        </section>
        <aside className="hidden w-full max-w-[400px] shrink-0 self-center lg:block lg:mr-0 lg:ml-auto" style={{ transform: "translate(35px, 36px)" }}>
          <Image
            src="/omni_signin_large@2x.png"
            alt="Meet Omni, your AI collaborator for building custom apps"
            width={440}
            height={620}
            className="w-full rounded-lg transition duration-300 hover:scale-[1.02]"
            priority
          />
        </aside>
      </div>
    </main>
  );
}
