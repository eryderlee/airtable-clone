import { expect, test } from "@playwright/test";
import { encode } from "next-auth/jwt";
import "dotenv/config";

const APP_ORIGIN = process.env.PLAYWRIGHT_APP_ORIGIN ?? "http://127.0.0.1:3000";
const SESSION_COOKIE = "next-auth.session-token";

async function createSessionToken() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) {
    throw new Error("AUTH_SECRET is required for Playwright authentication.");
  }

  return encode({
    secret,
    salt: "playwright-test",
    maxAge: 30 * 24 * 60 * 60,
    token: {
      sub: "ui-user-1",
      name: "UI Tester",
      email: "ui@test.com",
      picture: null,
    },
  });
}

test("base view layout matches reference snapshot", async ({ page }) => {
  const token = await createSessionToken();
  await page.context().addCookies([
    {
      name: SESSION_COOKIE,
      value: token,
      url: APP_ORIGIN,
      httpOnly: true,
      sameSite: "Lax",
      secure: APP_ORIGIN.startsWith("https"),
    },
  ]);

  await page.goto("/base/ui-base-1/ui-table-1/view/ui-view-1");
  await page.waitForURL("**/view/**");

  await expect(page.getByTestId("grid-toolbar")).toBeVisible();
  await expect(page.getByTestId("grid-view-button")).toBeVisible();
  await expect(page.getByTestId("add-or-import-button")).toBeVisible();
  await expect(page.getByTestId("create-view-button")).toBeVisible();

  await expect(page).toHaveScreenshot("base-layout.png", {
    fullPage: true,
    animations: "disabled",
    caret: "hide",
  });
});
