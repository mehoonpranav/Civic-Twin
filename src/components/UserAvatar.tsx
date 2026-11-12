import { cn } from "@/lib/utils";

interface UserAvatarProps {
  name?: string | null;
  src?: string | null;
  className?: string;
  textClassName?: string;
}

export function UserAvatar({ name, src, className, textClassName }: UserAvatarProps) {
  const initial = (name ?? "C").trim().slice(0, 1).toUpperCase() || "C";
  if (src) {
    return (
      <img
        src={src}
        alt={name ?? "Profile photo"}
        className={cn("shrink-0 rounded-2xl object-cover", className)}
      />
    );
  }
  return (
    <span
      className={cn(
        "flex shrink-0 items-center justify-center rounded-2xl bg-primary font-display font-bold text-primary-foreground",
        className,
      )}
    >
      <span className={textClassName}>{initial}</span>
    </span>
  );
}
