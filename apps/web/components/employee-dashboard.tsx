"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogFooter,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { CameraCapture } from "@/components/camera-capture";
import { requestLocation, formatCoords, mapsUrl, type GeoCoords } from "@/lib/geolocation";

const MAX_ACCURACY_METERS = 100;
import { Pencil, CheckCircle2, LogOut, MapPin } from "lucide-react";
import { api, type AttendanceRecord, type SessionUser } from "@/lib/api";

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function EmployeeDashboard({ user }: { user: SessionUser }) {
  const [records, setRecords] = useState<AttendanceRecord[] | null>(null);
  const [today, setToday] = useState<string | null>(null);
  const [clock, setClock] = useState(() => new Date());
  const [description, setDescription] = useState("");
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoUrl, setPhotoUrl] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [justRecorded, setJustRecorded] = useState(false);
  const [editingRecord, setEditingRecord] = useState<AttendanceRecord | null>(null);
  const [editText, setEditText] = useState("");
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmCheckOut, setConfirmCheckOut] = useState(false);
  const [location, setLocation] = useState<GeoCoords | null>(null);
  const [locating, setLocating] = useState(false);

  const load = useCallback(async () => {
    const [mine, day] = await Promise.all([
      api.get<AttendanceRecord[]>("/attendance/me"),
      api.get<{ workDate: string }>("/attendance/today"),
    ]);
    setRecords(mine);
    setToday(day.workDate);
  }, []);

  useEffect(() => {
    load().catch(() => setRecords([]));
  }, [load]);

  useEffect(() => {
    const timer = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    return () => {
      if (photoUrl) URL.revokeObjectURL(photoUrl);
    };
  }, [photoUrl]);

  const todayRecord = useMemo(
    () => (records ?? []).find((r) => r.workDate === today) ?? null,
    [records, today],
  );

  function pickPhoto(file: File | null) {
    setPhoto(file);
    if (photoUrl) URL.revokeObjectURL(photoUrl);
    setPhotoUrl(file ? URL.createObjectURL(file) : null);
    if (file) {
      refreshLocation();
    } else {
      setLocation(null);
      setLocating(false);
    }
  }

  function refreshLocation() {
    setLocating(true);
    setLocation(null);
    setError(null);
    requestLocation()
      .then((coords) => setLocation(coords))
      .finally(() => setLocating(false));
  }

  const accuracyOk = location !== null && location.accuracy <= MAX_ACCURACY_METERS;

  async function checkIn() {
    if (!photo) {
      setError("Take your photo first");
      return;
    }
    if (!location) {
      setError("Location is required. Allow location access and try again.");
      return;
    }
    if (!accuracyOk) {
      setError(
        `Location accuracy is ${Math.round(location.accuracy)} m. It must be ${MAX_ACCURACY_METERS} m or better. Move somewhere with a clearer signal and check again.`,
      );
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const data = new FormData();
      data.append("photo", photo);
      if (description) data.append("description", description);
      data.append("latitude", String(location.latitude));
      data.append("longitude", String(location.longitude));
      data.append("accuracy", String(location.accuracy));
      await api.post("/attendance", data);
      pickPhoto(null);
      setDescription("");
      setLocation(null);
      setJustRecorded(true);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Check-in failed");
    } finally {
      setSubmitting(false);
    }
  }

  async function checkOut() {
    if (!todayRecord) return;
    setSubmitting(true);
    setError(null);
    try {
      await api.patch(`/attendance/${todayRecord.id}/checkout`, {});
      setConfirmCheckOut(false);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Check-out failed");
    } finally {
      setSubmitting(false);
    }
  }

  function openEdit(record: AttendanceRecord) {
    setEditingRecord(record);
    setEditText(record.description ?? "");
  }

  async function saveEdit() {
    if (!editingRecord) return;
    setSavingEdit(true);
    try {
      await api.patch(`/attendance/${editingRecord.id}/description`, {
        description: editText,
      });
      setEditingRecord(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Update failed");
    } finally {
      setSavingEdit(false);
    }
  }

  const clockText = clock.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  const dateText = clock.toLocaleDateString([], {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="reveal-product flex flex-col gap-10">
      <section>
        <div className="mb-1">
          <h2 className="text-subtitle font-semibold">Check in</h2>
        </div>
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          {todayRecord ? (
            <div className="p-6">
              <div className="flex items-center gap-2">
                {todayRecord.checkOutAt ? (
                  <>
                    <CheckCircle2
                      size={16}
                      className="text-muted-foreground"
                      strokeWidth={1.5}
                    />
                    <span className="text-body font-medium">Day complete</span>
                    <Badge variant="dot" color="gray">
                      Checked out
                    </Badge>
                  </>
                ) : (
                  <>
                    <CheckCircle2
                      size={16}
                      className="text-success"
                      strokeWidth={1.5}
                    />
                    <span className="text-body font-medium">On duty</span>
                    <Badge variant="dot" color="green">
                      Present
                    </Badge>
                  </>
                )}
              </div>
              <div className="mt-4 grid grid-cols-2 gap-6">
                <div>
                  <div className="text-micro text-muted-foreground">
                    Check-in
                  </div>
                  <div className="font-mono text-display tabular-nums">
                    {fmtTime(todayRecord.createdAt)}
                  </div>
                </div>
                <div>
                  <div className="text-micro text-muted-foreground">
                    Check-out
                  </div>
                  <div className="font-mono text-display tabular-nums">
                    {todayRecord.checkOutAt
                      ? fmtTime(todayRecord.checkOutAt)
                      : "—"}
                  </div>
                </div>
              </div>
              <div className="mt-1 font-mono text-caption tabular-nums text-muted-foreground">
                {todayRecord.workDate}
              </div>
              <div className="mt-4 max-w-xl text-body text-muted-foreground">
                {todayRecord.description ?? "No description given"}
              </div>
              <div className="mt-4 flex items-center gap-2">
                <Button
                  variant="secondary"
                  size="compact"
                  leadingIcon={Pencil}
                  onClick={() => openEdit(todayRecord)}
                >
                  Edit description
                </Button>
                {!todayRecord.checkOutAt && (
                  <Button
                    variant="primary"
                    size="compact"
                    leadingIcon={LogOut}
                    onClick={() => setConfirmCheckOut(true)}
                  >
                    Check out
                  </Button>
                )}
              </div>
              {error && (
                <div className="mt-3 text-caption text-destructive">{error}</div>
              )}
              {justRecorded && (
                <div className="mt-4 text-caption text-muted-foreground">
                  A confirmation email with your photo proof is on its way
                </div>
              )}
            </div>
          ) : (
            <div className="p-6">
              <div className="font-mono text-display tabular-nums">
                {clockText}
              </div>
              <div className="mt-1 font-mono text-caption tabular-nums text-muted-foreground">
                {dateText} — {user.fullName}
              </div>
              <div className="mt-5 flex flex-col gap-4 lg:flex-row lg:items-start">
                <CameraCapture onCapture={pickPhoto} previewUrl={photoUrl} />
                <div className="flex-1">
                  <div className="mb-2 text-caption text-muted-foreground">
                    What are you working on today?
                  </div>
                  <textarea
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Describe today's work"
                    className="min-h-28 w-full resize-none rounded-[10px] border border-input bg-transparent px-3 py-2 text-body outline-none transition-colors placeholder:text-muted-foreground focus:bg-card focus:ring-2 focus:ring-border"
                  />
                </div>
              </div>
              {photo && (
                <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
                  <div className="flex items-center gap-2 text-caption">
                    <MapPin
                      size={14}
                      strokeWidth={1.5}
                      className={
                        locating
                          ? "shrink-0 text-muted-foreground"
                          : accuracyOk
                            ? "shrink-0 text-success"
                            : "shrink-0 text-destructive"
                      }
                    />
                    {locating ? (
                      <span className="text-muted-foreground">
                        Getting your location
                      </span>
                    ) : location ? (
                      <>
                        <a
                          href={mapsUrl(location.latitude, location.longitude)}
                          target="_blank"
                          rel="noreferrer"
                          className="font-mono tabular-nums underline underline-offset-2 hover:text-foreground"
                        >
                          {formatCoords(
                            location.latitude,
                            location.longitude,
                            location.accuracy,
                          )}
                        </a>
                        {!accuracyOk && (
                          <span className="text-destructive">
                            — too imprecise, needs ≤ {MAX_ACCURACY_METERS} m
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="text-destructive">
                        Location not available — required to check in
                      </span>
                    )}
                  </div>
                  {!locating && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="compact"
                      onClick={refreshLocation}
                    >
                      {location ? "Refresh location" : "Allow location"}
                    </Button>
                  )}
                </div>
              )}
              {error && (
                <div className="mt-3 text-caption text-destructive">{error}</div>
              )}
              <Button
                variant="primary"
                className="mt-5"
                loading={submitting}
                onClick={checkIn}
              >
                Check in
              </Button>
            </div>
          )}
        </div>
      </section>

      <section>
        <div className="mb-1">
          <h2 className="text-subtitle font-semibold">Your records</h2>
        </div>
        <div className="overflow-hidden rounded-xl border border-border bg-card">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Check-in</TableHead>
                <TableHead>Check-out</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Planned work</TableHead>
                <TableHead className="w-16" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {(records ?? []).map((record, index) => (
                <TableRow key={record.id} index={index}>
                  <TableCell className="font-mono text-caption tabular-nums text-muted-foreground">
                    {record.workDate}
                  </TableCell>
                  <TableCell className="font-mono text-caption tabular-nums text-muted-foreground">
                    {fmtTime(record.createdAt)}
                  </TableCell>
                  <TableCell className="font-mono text-caption tabular-nums text-muted-foreground">
                    {record.checkOutAt ? fmtTime(record.checkOutAt) : "—"}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant="dot"
                      color={record.checkOutAt ? "gray" : "green"}
                    >
                      {record.checkOutAt ? "Checked out" : "On duty"}
                    </Badge>
                  </TableCell>
                  <TableCell className="max-w-md truncate text-muted-foreground">
                    {record.description ?? "—"}
                  </TableCell>
                  <TableCell>
                    <div className="flex justify-end">
                      <Button
                        variant="ghost"
                        size="compact"
                        onClick={() => openEdit(record)}
                      >
                        <Pencil size={16} />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {records && records.length === 0 && (
            <div className="px-6 pb-5 text-caption text-muted-foreground">
              No records yet — your first check-in shows up here
            </div>
          )}
        </div>
      </section>

      <Dialog
        open={!!editingRecord}
        onOpenChange={(open) => !open && setEditingRecord(null)}
      >
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>
              Edit description — {editingRecord?.workDate}
            </DialogTitle>
            <DialogDescription>
              Describe what you worked on that day
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="min-h-28 w-full resize-none rounded-[10px] border border-input bg-transparent px-3 py-2 text-body outline-none transition-colors placeholder:text-muted-foreground focus:bg-card focus:ring-2 focus:ring-border"
            placeholder="What did you work on?"
          />
          <DialogFooter>
            <Button variant="secondary" onClick={() => setEditingRecord(null)}>
              Cancel
            </Button>
            <Button variant="primary" loading={savingEdit} onClick={saveEdit}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmCheckOut} onOpenChange={setConfirmCheckOut}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>End your day?</DialogTitle>
            <DialogDescription>
              This records your check-out for {today}. Check-out cannot be
              undone.
            </DialogDescription>
          </DialogHeader>
          {todayRecord && (
            <div className="flex items-baseline gap-2 text-body">
              <span className="text-muted-foreground">Checked in at</span>
              <span className="font-mono tabular-nums">
                {fmtTime(todayRecord.createdAt)}
              </span>
            </div>
          )}
          {error && (
            <div className="mt-3 text-caption text-destructive">{error}</div>
          )}
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirmCheckOut(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={submitting} onClick={checkOut}>
              Check out
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
