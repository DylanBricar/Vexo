import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;
const defaults: IconProps = {
  "aria-hidden": true,
  fill: "none",
  height: 20,
  stroke: "currentColor",
  strokeLinecap: "round",
  strokeLinejoin: "round",
  strokeWidth: 2,
  viewBox: "0 0 24 24",
  width: 20,
};

export function SunIcon(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <circle cx="12" cy="12" r="5" />
      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42" />
    </svg>
  );
}
export function MoonIcon(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z" />
    </svg>
  );
}
export function TrashIcon(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
    </svg>
  );
}
export function DatabaseIcon(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <ellipse cx="12" cy="5" rx="9" ry="3" />
      <path d="M3 5v14c0 1.66 4 3 9 3s9-1.34 9-3V5M3 12c0 1.66 4 3 9 3 1.2 0 2.34-.08 3.36-.24M16 9l5 5m0-5-5 5" />
    </svg>
  );
}
export function LogoutIcon(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="m10 17 5-5-5-5M15 12H3M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4" />
    </svg>
  );
}
export function ReplyIcon(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="m9 17-5-5 5-5M20 18v-2a4 4 0 0 0-4-4H4" />
    </svg>
  );
}
export function EditIcon(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7M18.5 2.5a2.12 2.12 0 0 1 3 3L12 15l-4 1 1-4z" />
    </svg>
  );
}
export function AttachmentIcon(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </svg>
  );
}
export function CameraIcon(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" />
      <circle cx="12" cy="13" r="4" />
    </svg>
  );
}
export function SendIcon(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M22 2 11 13M22 2l-7 20-4-9-9-4z" />
    </svg>
  );
}
export function CloseIcon(props: IconProps) {
  return (
    <svg {...defaults} {...props}>
      <path d="M18 6 6 18M6 6l12 12" />
    </svg>
  );
}
export function CheckIcon({
  double = false,
  ...props
}: IconProps & { double?: boolean }) {
  return (
    <svg {...defaults} {...props}>
      {double ? (
        <>
          <path d="m18 6-11 11-5-5" />
          <path d="m22 6-11 11" />
        </>
      ) : (
        <path d="m20 6-11 11-5-5" />
      )}
    </svg>
  );
}
