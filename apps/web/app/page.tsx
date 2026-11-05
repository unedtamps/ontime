"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { LogOut, KeyRound } from "lucide-react";
import { api, type SessionUser } from "@/lib/api";
import { MasterDashboard } from "@/components/master-dashboard";
import { EmployeeDashboard } from "@/components/employee-dashboard";
import { ChangePasswordDialog } from "@/components/change-password-dialog";

type Gate = "loading" | "anon" | SessionUser;

export default function Home() {
  const router = useRouter();
  const [gate, setGate] = useState<Gate>("loading");
  const [confirmSignOut, setConfirmSignOut] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);

  useEffect(() => {
    api
      .get<SessionUser>("/auth/me")
      .then((user) => setGate(user))
      .catch(() => {
        setGate("anon");
        router.replace("/login");
      });
  }, [router]);

  async function signOut() {
    setSigningOut(true);
    try {
      await api.post("/auth/logout");
      router.replace("/login");
    } finally {
      setSigningOut(false);
      setConfirmSignOut(false);
    }
  }

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="mx-auto flex w-full max-w-[1600px] items-center justify-between gap-3 px-4 py-4 sm:px-6 sm:py-5">
        <div className="flex min-w-0 items-baseline gap-2 sm:gap-3">
          <span className="shrink-0 text-title font-semibold">Ontime</span>
          <span className="hidden truncate text-caption text-muted-foreground sm:inline">
            Employee attendance
          </span>
        </div>
        {gate !== "loading" && gate !== "anon" && (
          <div className="flex min-w-0 shrink-0 items-center gap-2 sm:gap-3">
            <span className="hidden max-w-[12ch] truncate text-subtitle text-muted-foreground sm:inline">
              {gate.fullName}
            </span>
            <Badge variant="dot" color="gray" className="hidden sm:inline-flex">
              {gate.role === "MASTER" ? "Master" : "Employee"}
            </Badge>
            <Button
              variant="ghost"
              size="compact"
              leadingIcon={KeyRound}
              aria-label="Change password"
              onClick={() => setPasswordOpen(true)}
            >
              <span className="hidden sm:inline">Password</span>
            </Button>
            <Button
              variant="ghost"
              size="compact"
              leadingIcon={LogOut}
              aria-label="Sign out"
              onClick={() => setConfirmSignOut(true)}
            >
              <span className="hidden sm:inline">Sign out</span>
            </Button>
          </div>
        )}
      </header>
      <main className="mx-auto w-full max-w-[1600px] px-4 pb-10 sm:px-6 sm:pb-12">
        {gate === "loading" ? (
          <div className="flex flex-col gap-4 pt-4">
            <Skeleton className="h-9 w-64" />
            <Skeleton className="h-40 w-full" />
          </div>
        ) : gate === "anon" ? null : gate.role === "MASTER" ? (
          <MasterDashboard />
        ) : (
          <EmployeeDashboard user={gate} />
        )}
      </main>

      <ChangePasswordDialog open={passwordOpen} onOpenChange={setPasswordOpen} />

      <Dialog open={confirmSignOut} onOpenChange={setConfirmSignOut}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Sign out?</DialogTitle>
            <DialogDescription>
              {gate !== "loading" && gate !== "anon"
                ? `You are signed in as ${gate.fullName}. You can sign back in anytime.`
                : "You can sign back in anytime."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirmSignOut(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={signingOut} onClick={signOut}>
              Sign out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
