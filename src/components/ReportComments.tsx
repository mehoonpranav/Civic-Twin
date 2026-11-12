import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { formatDistanceToNow } from "date-fns";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useProfile, useSession } from "@/hooks/use-session";
import { UserAvatar } from "@/components/UserAvatar";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useNavigate } from "@tanstack/react-router";

const QUICK = ["👍", "🙏", "😤", "😮", "💧", "🗑️", "⚠️"];

interface CommentRow {
  id: string;
  body: string;
  created_at: string;
  author_id: string | null;
  profiles: { full_name: string | null; avatar_url: string | null } | null;
}

export function ReportComments({ reportId }: { reportId: string }) {
  const { user } = useSession();
  const { data: profile } = useProfile(user?.id);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [body, setBody] = useState("");

  const { data: comments = [], isLoading } = useQuery({
    queryKey: ["comments", reportId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("report_comments")
        .select("id, body, created_at, author_id, profiles(full_name, avatar_url)")
        .eq("report_id", reportId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as unknown as CommentRow[];
    },
  });

  const post = useMutation({
    mutationFn: async (text: string) => {
      if (!user) throw new Error("Sign in to comment.");
      const { error } = await supabase.from("report_comments").insert({
        report_id: reportId,
        author_id: user.id,
        body: text,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setBody("");
      void queryClient.invalidateQueries({ queryKey: ["comments", reportId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not post comment"),
  });

  const submit = () => {
    const text = body.trim();
    if (!text) return;
    if (text.length > 500) {
      toast.error("Keep comments under 500 characters.");
      return;
    }
    post.mutate(text);
  };

  return (
    <section className="mt-4 rounded-2xl border border-border bg-card p-4 shadow-card sm:p-5">
      <div className="mb-4 flex items-center gap-2">
        <MessageCircle className="size-4 text-primary" />
        <h2 className="text-sm font-semibold">Comments</h2>
        <span className="text-xs text-muted-foreground">{comments.length}</span>
      </div>

      <div className="space-y-3">
        {isLoading && <div className="h-16 animate-pulse rounded-xl bg-muted" />}
        {!isLoading && comments.length === 0 && (
          <p className="text-sm text-muted-foreground">
            No comments yet. Say how this issue affects you.
          </p>
        )}
        {comments.map((c) => (
          <div key={c.id} className="flex gap-3">
            <UserAvatar
              name={c.profiles?.full_name}
              src={c.profiles?.avatar_url}
              className="size-8 shrink-0 rounded-full text-[11px]"
            />
            <div className="min-w-0 flex-1 rounded-xl bg-secondary/60 px-3 py-2">
              <div className="flex flex-wrap items-baseline gap-2">
                <p className="text-sm font-medium">{c.profiles?.full_name ?? "Citizen"}</p>
                <p className="text-[11px] text-muted-foreground">
                  {formatDistanceToNow(new Date(c.created_at), { addSuffix: true })}
                </p>
              </div>
              <p className="mt-0.5 whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground/90">
                {c.body}
              </p>
            </div>
          </div>
        ))}
      </div>

      {user ? (
        <div className="mt-4">
          <div className="mb-2 flex items-center gap-1.5">
            {QUICK.map((emoji) => (
              <button
                key={emoji}
                type="button"
                className="flex size-8 items-center justify-center rounded-full border border-border bg-background text-base transition-colors hover:bg-secondary"
                onClick={() => setBody((prev) => (prev ? `${prev} ${emoji}` : emoji))}
              >
                {emoji}
              </button>
            ))}
          </div>
          <div className="flex gap-3">
            <UserAvatar
              name={profile?.full_name}
              src={profile?.avatar_url}
              className="mt-1 size-8 shrink-0 rounded-full text-[11px]"
            />
            <div className="min-w-0 flex-1">
              <Textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="How does this affect you?"
                rows={3}
                maxLength={500}
              />
              <div className="mt-2 flex items-center justify-between">
                <span className="text-[11px] text-muted-foreground">{body.length}/500</span>
                <Button
                  size="sm"
                  className="rounded-full"
                  disabled={post.isPending || !body.trim()}
                  onClick={submit}
                >
                  Post comment
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <Button
          variant="outline"
          className="mt-4 w-full rounded-full"
          onClick={() => navigate({ to: "/auth", search: { next: `/report/${reportId}` } })}
        >
          Sign in to comment
        </Button>
      )}
    </section>
  );
}
