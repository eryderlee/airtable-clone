"use client";

import { usePathname, useRouter } from "next/navigation";
import type { ReactNode, SVGProps } from "react";


const navItems = [
  { label: "Home", icon: <HomeIcon className="h-5 w-5" />, href: "/", mb: "mb-1" },
  {
    label: "Starred",
    icon: <StarIcon className="h-5 w-5" />,
    chevron: true,
    disabled: true,
    mb: "mb-2",
  },
  { label: "Shared", icon: <SharedIcon className="h-5 w-5" />, disabled: true, mb: "mb-1" },
];

type SidebarProps = {
  collapsed: boolean;
  hoverExpand: boolean;
  setHoverExpand: (value: boolean) => void;
  onCreateClick: () => void;
};

export function AppSidebar({
  collapsed,
  hoverExpand,
  setHoverExpand,
  onCreateClick,
}: SidebarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const isExpanded = !collapsed || hoverExpand;
  const width = isExpanded ? 300 : 56;
  return (
    <aside
      className="flex h-full flex-col border-r border-[#e4e7ec] bg-white transition-[width] duration-200"
      style={{ width }}
      onMouseEnter={() => collapsed && setHoverExpand(true)}
      onMouseLeave={() => collapsed && setHoverExpand(false)}
    >
      <nav className={`flex flex-1 flex-col ${isExpanded ? "px-3 pt-4 pb-2" : "items-center px-2 py-3"}`}>
        <div>
          {navItems.map((item) => {
            const isActive = item.href ? pathname === item.href : false;
            return (
              <button
                key={item.label}
                onClick={() => item.href && router.push(item.href)}
                disabled={item.disabled}
                className={`flex w-full items-center ${item.mb} ${
                  isExpanded ? "gap-2 rounded-xl px-3 py-2 text-[15px]" : "justify-center rounded-xl py-3"
                } ${
                  isActive && isExpanded
                    ? "bg-[#F2F4F8] font-semibold text-[#1f2328]"
                    : "font-medium text-[#1f2328]"
                } ${isExpanded ? "hover:bg-[#f4f6fb]" : ""} ${item.disabled ? "cursor-default opacity-50" : ""}`}
              >
                <span className="text-[#1f2328]">{item.icon}</span>
                {isExpanded && (
                  <>
                    <span className="flex-1 text-left">{item.label}</span>
                    {item.chevron && <ChevronRightIcon className="h-3.5 w-3.5 text-[#1D1F25]" />}
                  </>
                )}
              </button>
            );
          })}
        </div>

        <div>
          <div
            className={`flex items-center ${
              isExpanded ? "justify-between rounded-xl px-3 py-2 text-[15px] font-medium" : "justify-center py-3"
            } text-[#1f2328]`}
          >
            <span className="flex items-center gap-2">
              <WorkspaceIcon />
              {isExpanded && "Workspaces"}
            </span>
            {isExpanded && (
              <span className="flex items-center gap-4 text-[#1D1F25]">
                <span className="relative -top-px text-2xl font-light leading-none">+</span>
                <ChevronRightIcon className="h-3.5 w-3.5" />
              </span>
            )}
          </div>
        </div>
      </nav>

      <div className={`${isExpanded ? "px-[12px]" : "px-2"} pb-[12px] text-[13px] text-[#1f2328]`}>
        <div className={`mb-[16px] h-px bg-[#e4e7ec] ${isExpanded ? "mx-[8px]" : "mx-1"}`} />
        <SidebarFooterButton icon={<TemplateIcon />} label="Templates and apps" isExpanded={isExpanded} />
        <SidebarFooterButton icon={<MarketplaceIcon />} label="Marketplace" isExpanded={isExpanded} />
        <SidebarFooterButton icon={<ImportIcon />} label="Import" isExpanded={isExpanded} />
        <div className={`mt-[16px] mb-[8px] ${!isExpanded ? "flex justify-center" : ""}`}>
          <button
            onClick={onCreateClick}
            className={`flex items-center justify-center border-none font-semibold transition ${
              isExpanded
                ? "w-full rounded-lg bg-[#166EE1] px-[12px] py-[7px] text-[12px] font-medium text-white shadow-[0_1px_2px_rgba(0,0,0,0.12)] hover:bg-[#1550b6] hover:shadow-[0_1px_3px_rgba(0,0,0,0.16)]"
                : "h-7 w-7 shrink-0 rounded-xl border border-[#9aa4b6] bg-white text-[#9aa4b6] hover:border-[#7a8499] hover:text-[#7a8499]"
            }`}
          >
            {isExpanded ? (
              <>
                <svg width="18" height="18" viewBox="0 0 16 16" fill="currentColor" className="mr-1 flex-none" aria-hidden="true">
                  <path d="M8 3a.5.5 0 0 1 .5.5v4h4a.5.5 0 0 1 0 1h-4v4a.5.5 0 0 1-1 0v-4h-4a.5.5 0 0 1 0-1h4v-4A.5.5 0 0 1 8 3Z" />
                </svg>
                <span>Create</span>
              </>
            ) : "+"}
          </button>
        </div>
      </div>
    </aside>
  );
}

function SidebarFooterButton({
  icon,
  label,
  isExpanded,
}: {
  icon: ReactNode;
  label: string;
  isExpanded: boolean;
}) {
  return (
    <button
      className={`flex w-full items-center rounded opacity-50 cursor-default ${
        isExpanded ? "h-[32px] px-[8px] text-left" : "justify-center py-2"
      }`}
      disabled
    >
      <span>{icon}</span>
      {isExpanded && <span className="ml-[4px]">{label}</span>}
    </button>
  );
}

function HomeIcon({ className }: SVGProps<SVGSVGElement>) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="m4 8 6-5 6 5v8a1 1 0 0 1-1 1h-2v-5H7v5H5a1 1 0 0 1-1-1V8Z"
        stroke="currentColor"
        strokeWidth="1.3"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function StarIcon({ className }: SVGProps<SVGSVGElement>) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor">
      <path
        d="M10 2l2.4 5 5.6.8-4 4 .9 5.6L10 14.8l-4.9 2.6.9-5.6-4-4 5.6-.8L10 2Z"
        strokeWidth="1.5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    </svg>
  );
}

function SharedIcon({ className }: SVGProps<SVGSVGElement>) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="currentColor" aria-hidden="true">
      <path
        fillRule="nonzero"
        d="M10.4999 6C7.53819 6.00085 4.94618 8.00758 4.20349 10.8746C4.17025 11.003 4.18936 11.1393 4.25661 11.2536C4.32387 11.3679 4.43377 11.4508 4.56213 11.484C4.6905 11.5173 4.82682 11.4981 4.94109 11.4309C5.05537 11.3636 5.13826 11.2537 5.17151 11.1254C5.80119 8.69457 7.98899 7.00077 10.5 7H14C14.1326 7 14.2598 6.94732 14.3536 6.85355C14.4473 6.75979 14.5 6.63261 14.5 6.5C14.5 6.36739 14.4473 6.24021 14.3536 6.14645C14.2598 6.05268 14.1326 6 14 6H10.5ZM11 3C10.8674 3.00002 10.7402 3.05271 10.6465 3.14648C10.5527 3.24025 10.5001 3.36741 10.5001 3.5C10.5001 3.63259 10.5527 3.75975 10.6465 3.85352L13.293 6.5L10.6465 9.14648C10.5527 9.24025 10.5001 9.36741 10.5001 9.5C10.5001 9.63259 10.5527 9.75975 10.6465 9.85352C10.7402 9.94726 10.8674 9.99992 11 9.99992C11.1326 9.99992 11.2598 9.94726 11.3535 9.85352L14.3535 6.85352C14.4472 6.75974 14.4999 6.63259 14.4999 6.5C14.4999 6.36741 14.4472 6.24026 14.3535 6.14648L11.3535 3.14648C11.2598 3.05271 11.1326 3.00002 11 3ZM2 5C1.86739 5 1.74021 5.05268 1.64645 5.14645C1.55268 5.24021 1.5 5.36739 1.5 5.5V13C1.50007 13.5464 1.95357 13.9999 2.49988 14H12C12.1326 14 12.2598 13.9473 12.3536 13.8536C12.4473 13.7598 12.5 13.6326 12.5 13.5C12.5 13.3674 12.4473 13.2402 12.3536 13.1464C12.2598 13.0527 12.1326 13 12 13H2.5V5.5C2.5 5.36739 2.44732 5.24021 2.35355 5.14645C2.25979 5.05268 2.13261 5 2 5Z"
      />
    </svg>
  );
}

function ChevronRightIcon({ className }: SVGProps<SVGSVGElement>) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" stroke="currentColor">
      <path d="m7 5 5 5-5 5" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function WorkspaceIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 16 16" fill="currentColor">
      <path fillRule="nonzero" d="M3.68726 2.76918C3.00369 2.77619 2.31788 3.05605 1.8208 3.65761C0.919321 4.74857 1.17576 6.24775 2.08557 7.09572C1.40673 7.38504 0.802933 7.84404 0.349488 8.4507C0.310181 8.50329 0.281619 8.56312 0.265432 8.62675C0.249245 8.69038 0.24575 8.75658 0.255147 8.82157C0.264544 8.88656 0.286648 8.94905 0.320199 9.00549C0.353749 9.06194 0.398088 9.11122 0.450684 9.15053C0.503281 9.18983 0.563104 9.21839 0.626738 9.23458C0.690373 9.25077 0.756572 9.25426 0.821558 9.24487C0.886543 9.23547 0.949041 9.21337 1.00548 9.17981C1.06193 9.14626 1.11121 9.10193 1.15051 9.04933C1.76315 8.2297 2.72586 7.74834 3.74915 7.75001C3.74907 7.75005 3.74923 7.74997 3.74915 7.75001C3.74953 7.75001 3.75011 7.75001 3.75049 7.75001C3.87664 7.74769 3.99725 7.69777 4.08814 7.61024C4.09539 7.60337 4.10243 7.59629 4.10925 7.589C4.19691 7.49831 4.24706 7.37783 4.24963 7.25172C4.24951 7.252 4.24976 7.25144 4.24963 7.25172C4.24959 7.25147 4.24992 7.25038 4.24988 7.25013C4.24984 7.25034 4.24992 7.24993 4.24988 7.25013C4.24976 7.24984 4.24976 7.24894 4.24963 7.24865C4.24718 7.12237 4.19703 7.0017 4.10925 6.91088C4.10254 6.90377 4.09562 6.89685 4.0885 6.89013C3.99767 6.80248 3.87706 6.75243 3.75086 6.75001C3.75044 6.75001 3.75005 6.75014 3.74963 6.75014C3.74967 6.75018 3.74959 6.7501 3.74963 6.75014C2.44509 6.75147 1.76078 5.30012 2.59168 4.29457C3.42258 3.28902 4.97671 3.68735 5.22131 4.96876C5.23363 5.03326 5.25853 5.09471 5.29459 5.14958C5.33066 5.20446 5.37718 5.25169 5.4315 5.28859C5.48582 5.32549 5.54687 5.35132 5.61118 5.36462C5.67548 5.37792 5.74178 5.37843 5.80628 5.3661C5.93651 5.34123 6.05154 5.26564 6.12605 5.15596C6.20057 5.04629 6.22847 4.91151 6.20361 4.78126C5.95974 3.50367 4.82653 2.7575 3.68726 2.76918Z M12.3127 2.76918C11.1735 2.7575 10.0403 3.50367 9.79639 4.78126C9.77154 4.91151 9.79943 5.04629 9.87395 5.15596C9.94846 5.26564 10.0635 5.34123 10.1937 5.3661C10.2582 5.37843 10.3245 5.37792 10.3888 5.36462C10.4531 5.35132 10.5142 5.32549 10.5685 5.28859C10.6228 5.25169 10.6693 5.20446 10.7054 5.14958C10.7415 5.09471 10.7664 5.03326 10.7787 4.96876C11.0233 3.68735 12.5774 3.28902 13.4083 4.29457C14.2392 5.30012 13.555 6.75134 12.2505 6.75001C12.2505 6.74997 12.2504 6.75005 12.2505 6.75001C12.25 6.75001 12.2496 6.75001 12.2491 6.75001C12.1871 6.76292 12.1282 6.78748 12.0753 6.8224C12.0115 6.83534 11.9508 6.86064 11.8966 6.89686C11.8603 6.95112 11.835 7.01196 11.8221 7.07594C11.7873 7.12872 11.7629 7.18762 11.75 7.24952C11.75 7.24931 11.7501 7.24973 11.75 7.24952C11.75 7.24976 11.7501 7.25064 11.75 7.25088C11.7629 7.31289 11.7875 7.37187 11.8224 7.42471C11.8353 7.48856 11.8606 7.54927 11.8969 7.60342C11.9511 7.63969 12.0119 7.66499 12.0759 7.67788C12.1287 7.71269 12.1876 7.73717 12.2495 7.75003C12.2499 7.75003 12.2502 7.7499 12.2506 7.7499C12.2505 7.74986 12.2507 7.74994 12.2506 7.7499C13.2738 7.7481 14.237 8.22964 14.8495 9.04934C14.8888 9.10194 14.9381 9.14628 14.9945 9.17983C15.051 9.21338 15.1135 9.23548 15.1785 9.24488C15.2434 9.25428 15.3096 9.25078 15.3733 9.2346C15.4369 9.21841 15.4967 9.18985 15.5493 9.15054C15.6019 9.11123 15.6463 9.06195 15.6798 9.00551C15.7134 8.94907 15.7355 8.88657 15.7449 8.82158C15.7543 8.7566 15.7508 8.6904 15.7346 8.62676C15.7184 8.56313 15.6898 8.50331 15.6505 8.45071C15.1971 7.844 14.5934 7.38493 13.9146 7.09561C14.8243 6.24762 15.0806 4.74853 14.1792 3.65762C13.6821 3.05606 12.9962 2.77619 12.3127 2.76918Z M8 5.75001C6.34908 5.75001 5 7.0991 5 8.75001C5 9.72266 5.47549 10.5819 6.19788 11.1309C5.23485 11.5518 4.42849 12.3022 3.95068 13.2808C3.92187 13.3398 3.90497 13.4039 3.90093 13.4694C3.8969 13.535 3.90582 13.6007 3.92717 13.6628C3.94853 13.7249 3.98191 13.7821 4.0254 13.8313C4.0689 13.8805 4.12165 13.9207 4.18067 13.9495C4.29982 14.0076 4.4372 14.0161 4.56258 13.9729C4.68796 13.9298 4.79107 13.8386 4.84924 13.7195C5.43767 12.5144 6.65894 11.7517 8 11.7517C9.34106 11.7517 10.5623 12.5144 11.1508 13.7195C11.2089 13.8386 11.312 13.9298 11.4374 13.9729C11.5628 14.0161 11.7002 14.0076 11.8193 13.9495C11.8783 13.9207 11.9311 13.8805 11.9746 13.8313C12.0181 13.7821 12.0515 13.7249 12.0728 13.6628C12.0942 13.6007 12.1031 13.535 12.0991 13.4694C12.095 13.4039 12.0781 13.3398 12.0493 13.2808C11.5715 12.3022 10.7652 11.5518 9.80212 11.1309C10.5245 10.5819 11 9.72266 11 8.75001C11 7.0991 9.65092 5.75001 8 5.75001ZM8 6.75001C9.11046 6.75001 10 7.63956 10 8.75001C10 9.86047 9.11046 10.75 8 10.75C6.88955 10.75 6 9.86047 6 8.75001C6 7.63956 6.88955 6.75001 8 6.75001Z" />
    </svg>
  );
}

function TemplateIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor">
      <rect x="3" y="3" width="14" height="14" rx="2" strokeWidth="1.5" />
      <path d="M3 7h14" strokeWidth="1.5" />
      <path d="M7 7v10" strokeWidth="1.5" />
    </svg>
  );
}

function MarketplaceIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor">
      <path d="M3 5h14l-1.5 7H4.5L3 5Z" strokeWidth="1.5" strokeLinejoin="round" />
      <circle cx="7" cy="16" r="1.5" strokeWidth="1.5" />
      <circle cx="13" cy="16" r="1.5" strokeWidth="1.5" />
    </svg>
  );
}

function ImportIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 20 20" fill="none" stroke="currentColor">
      <path d="M10 3v10m0 0-3-3m3 3 3-3" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3 15h14" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}
