import type { ButtonHTMLAttributes, ReactNode } from "react";

type Variant = "primary" | "secondary" | "success" | "danger";
const variants: Record<Variant, string> = {
  primary: "bg-brand text-white hover:bg-brand-light border border-brand",
  secondary: "bg-white text-brand border border-brand hover:bg-soft",
  success: "bg-ok text-white border border-ok hover:opacity-90",
  danger: "bg-bad text-white border border-bad hover:opacity-90",
};

export function Button({
  variant = "primary",
  small = false,
  className = "",
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant; small?: boolean }) {
  return (
    <button
      type="button"
      {...props}
      className={`${variants[variant]} ${small ? "px-2.5 py-1 text-[13px]" : "px-4 py-2.5"} cursor-pointer rounded-lg font-medium transition disabled:cursor-wait disabled:opacity-60 ${className}`}
    />
  );
}

export function Card({ title, children, className = "" }: { title?: ReactNode; children: ReactNode; className?: string }) {
  return (
    <div className={`mb-4 rounded-xl border border-line bg-white p-4 ${className}`}>
      {title && <h2 className="mb-3 text-[17px] font-semibold">{title}</h2>}
      {children}
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[13px] text-muted">{label}</span>
      {children}
    </label>
  );
}

export function Stat({ label, value, highlight = false }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-xl px-3 py-2.5 ${highlight ? "bg-[#dfe9f8]" : "bg-soft"}`}>
      <div className="text-[13px] text-muted">{label}</div>
      <div className="text-[19px] font-bold text-brand">{value}</div>
    </div>
  );
}

export const grid = "grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4";
