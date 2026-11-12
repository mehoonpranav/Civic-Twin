import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { Camera, LayoutList, Menu, ScanEye, Sparkles, Trophy, UserRound } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useProfile, useSession } from "@/hooks/use-session";
import { cn } from "@/lib/utils";
import { UserAvatar } from "@/components/UserAvatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const links = [
  { to: "/", label: "Feed", icon: LayoutList },
  { to: "/leaderboard", label: "Leaderboard", icon: Trophy },
  { to: "/dashboard", label: "Reports", icon: ScanEye },
] as const;

export function SiteNav() {
  const { user } = useSession();
  const { data: profile } = useProfile(user?.id);
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  return (
    <header className="fixed inset-x-0 top-0 z-50 border-b border-border/60 bg-background/80 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-2 px-3 sm:gap-4 sm:px-6">
        <Link to="/" className="flex items-center gap-2.5">
          <span className="flex size-9 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <ScanEye className="size-5" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight">CivicTwin</span>
        </Link>

        <nav className="hidden items-center gap-1 sm:flex">
          {links.map((l) => (
            <Link
              key={l.to}
              to={l.to}
              className={cn(
                "rounded-full px-4 py-2 text-sm font-medium text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground",
                pathname === l.to && "bg-secondary text-foreground",
              )}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-1.5 sm:gap-2">
          <span
            title="AI triage is built in"
            className="hidden size-9 items-center justify-center rounded-full border border-primary/40 bg-accent text-accent-foreground sm:flex"
          >
            <Sparkles className="size-4" />
          </span>
          <Button
            size="sm"
            className="hidden rounded-full sm:inline-flex"
            onClick={() => navigate({ to: "/report/new" })}
          >
            <Camera className="size-4" />
            Report a problem
          </Button>
          {user ? (
            <Link
              to="/profile"
              className="flex items-center gap-1.5 rounded-full border border-border bg-card py-1 pl-1 pr-2.5 text-sm font-medium transition-colors hover:bg-secondary sm:gap-2 sm:pl-1.5 sm:pr-3"
            >
              <UserAvatar
                name={profile?.full_name}
                src={profile?.avatar_url}
                className="size-7 rounded-full text-[11px]"
              />
              <span className="max-w-20 truncate sm:max-w-28">
                {(profile?.full_name ?? "You").trim().split(/\s+/)[0]}
              </span>
            </Link>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="hidden rounded-full sm:inline-flex"
              onClick={() => navigate({ to: "/auth" })}
            >
              Sign in
            </Button>
          )}

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="size-9 rounded-full sm:hidden"
                aria-label="Open menu"
              >
                <Menu className="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 rounded-2xl p-1.5">
              <DropdownMenuLabel className="px-2 py-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                Menu
              </DropdownMenuLabel>
              {links.map((l) => (
                <DropdownMenuItem
                  key={l.to}
                  className={cn("rounded-xl", pathname === l.to && "bg-accent")}
                  onSelect={() => navigate({ to: l.to })}
                >
                  <l.icon className="size-4" />
                  {l.label}
                </DropdownMenuItem>
              ))}
              <DropdownMenuSeparator />
              <DropdownMenuItem className="rounded-xl" onSelect={() => navigate({ to: "/report/new" })}>
                <Camera className="size-4" />
                Report a problem
              </DropdownMenuItem>
              {user ? (
                <DropdownMenuItem className="rounded-xl" onSelect={() => navigate({ to: "/profile" })}>
                  <UserRound className="size-4" />
                  Profile
                </DropdownMenuItem>
              ) : (
                <DropdownMenuItem className="rounded-xl" onSelect={() => navigate({ to: "/auth" })}>
                  <UserRound className="size-4" />
                  Sign in
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
}
