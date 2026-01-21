"use client";
import Link from "next/link";
import Icon, { IconName } from "@/components/Icon";

type ActionCardProps = {
  label: string;
  description?: string;
  href: string;
  icon?: IconName;
};

export default function ActionCard({ label, description, href, icon }: ActionCardProps) {
  return (
    <Link href={href} prefetch className="sp-card block focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--focus)]" aria-label={label}>
      <div className="sp-card-body">
        <div className="flex items-center gap-3">
          {icon && <Icon variant="hero" name={icon} size={18} className="text-[var(--text)]" />}
          <div className="font-semibold">{label}</div>
        </div>
        {description && <p className="sp-muted mt-1 text-sm">{description}</p>}
      </div>
    </Link>
  );
}
