"use client";

import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { toast } from "sonner";

import { api } from "~/trpc/react";
import { AppSidebar } from "./AppSidebar";
import { AppTopBar } from "./AppTopBar";

type AppShellProps = {
  user: {
    name?: string | null;
    email?: string | null;
    image?: string | null;
  };
  children: React.ReactNode;
};

export function AppShell({ user, children }: AppShellProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const [hoverExpand, setHoverExpand] = useState(false);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [workspaceDropdown, setWorkspaceDropdown] = useState(false);

  // Inside a base route — show only children (base layout handles its own chrome)
  const isBaseRoute = pathname.startsWith("/base/");

  const utils = api.useUtils();

  // Cold start prefetch — cache base list before user navigates home
  useEffect(() => {
    void utils.base.getAll.prefetch();
  }, [utils]);

  const pendingBaseIdRef = useRef<string | null>(null);

  const createTable = api.table.create.useMutation({
    onSuccess: async (newTable) => {
      const baseId = newTable.baseId ?? pendingBaseIdRef.current;
      const fetchedViews = await utils.view.getByTableId.fetch({ tableId: newTable.id });
      if (fetchedViews[0]) {
        router.push(`/base/${baseId}/${newTable.id}/view/${fetchedViews[0].id}`);
      } else {
        router.push(`/base/${baseId}/${newTable.id}`);
      }
    },
    onError: () => {
      toast.error("Failed to create table.");
    },
    onSettled: () => {
      void utils.base.getAll.invalidate();
    },
  });

  const createBase = api.base.create.useMutation({
    onMutate: () => {
      setShowCreateModal(false); // Close modal immediately
    },
    onSuccess: (base) => {
      pendingBaseIdRef.current = base.id;
      createTable.mutate({ baseId: base.id, seed: true });
    },
    onError: () => {
      toast.error("Failed to create base.");
    },
  });

  const isCreatingBase = createBase.isPending || createTable.isPending;

  function handleCreateBase() {
    if (isCreatingBase) return;
    createBase.mutate({ name: "Untitled Base" });
  }

  function handleToggleSidebar() {
    setCollapsed((prev) => {
      const next = !prev;
      if (!next) setHoverExpand(false);
      return next;
    });
  }

  const sidebarWidth = 300;

  if (isBaseRoute) {
    return (
      <div className="flex h-screen w-screen overflow-hidden bg-white">
        {children}
      </div>
    );
  }

  return (
    <div className="flex h-screen w-screen flex-col bg-white">
      <AppTopBar
        user={user}
        collapsed={collapsed}
        onToggleSidebar={handleToggleSidebar}
        sidebarWidth={sidebarWidth}
      />
      <div className="flex flex-1 overflow-hidden">
        <AppSidebar
          collapsed={collapsed}
          hoverExpand={hoverExpand}
          setHoverExpand={setHoverExpand}
          onCreateClick={() => setShowCreateModal(true)}
        />
        <div className="flex-1 overflow-auto bg-[#f7f8fa]">
          {children}
        </div>
      </div>

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 px-4">
          <div className="w-full max-w-3xl rounded-2xl border border-[#e1e4eb] bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-[#eef0f5] px-6 py-4">
              <h2 className="text-xl font-semibold text-[#1f2328]">
                How do you want to start?
              </h2>
              <button
                aria-label="Close"
                className="rounded-full p-1 text-[#6a7385] hover:bg-[#f5f6f8]"
                onClick={() => setShowCreateModal(false)}
              >
                ✕
              </button>
            </div>

            <div className="px-6 py-5 text-sm text-[#5f6c7b]">
              <div className="mb-5 flex items-center gap-2 text-sm">
                <span className="font-semibold text-[#1f2328]">
                  Workspace:
                </span>
                <button
                  onClick={() => setWorkspaceDropdown((v) => !v)}
                  className="flex items-center gap-1 rounded-full border border-[#dfe3ea] px-3 py-1 text-sm font-medium text-[#1c64e4] hover:border-[#1c64e4]"
                >
                  Select a workspace
                  <svg className="h-3.5 w-3.5" viewBox="0 0 16 16" fill="none" stroke="currentColor">
                    <path d="m4 6 4 4 4-4" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                </button>
              </div>
              {workspaceDropdown && (
                <div className="mb-5 rounded-2xl border border-[#e1e4eb] bg-[#f7f8fa] px-4 py-3 text-sm text-[#6a7385]">
                  Workspaces have not been implemented.
                </div>
              )}

              <div className="grid gap-4 md:grid-cols-2">
                <button
                  className="flex flex-col gap-4 rounded-2xl border border-[#e5dff9] bg-[#f5efff] p-4 text-left shadow-sm transition hover:border-[#cbb9f1]"
                  onClick={() => setShowCreateModal(false)}
                >
                  <Image
                    src="/omni.png"
                    alt="Build an app with Omni"
                    width={220}
                    height={150}
                    className="w-full rounded-xl object-cover"
                  />
                  <div>
                    <h3 className="text-base font-semibold text-[#1f2328]">
                      Build an app
                    </h3>
                    <p className="text-sm text-[#6a7385]">
                      Quickly create a custom app with data and interfaces
                      tailored to your team.
                    </p>
                  </div>
                </button>

                <button
                  className="flex flex-col gap-4 rounded-2xl border border-[#dfe7ff] bg-[#f3f6ff] p-4 text-left shadow-sm transition hover:border-[#c0d0ff] disabled:cursor-not-allowed disabled:opacity-60"
                  onClick={handleCreateBase}
                  disabled={isCreatingBase}
                >
                  <Image
                    src="/build an app.png"
                    alt="Build an app on your own"
                    width={220}
                    height={150}
                    className="w-full rounded-xl object-cover"
                  />
                  <div>
                    <h3 className="text-base font-semibold text-[#1f2328]">
                      Build an app on your own
                    </h3>
                    <p className="text-sm text-[#6a7385]">
                      Start with a blank app and build your ideal workflow.
                    </p>
                  </div>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
