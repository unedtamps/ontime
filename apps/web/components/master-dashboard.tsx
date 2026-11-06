"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
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
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { InputGroup, InputField } from "@/components/ui/input-group";
import { DatePicker } from "@/components/ui/date-picker";
import { Plus, Pencil, Trash2, Users, CalendarCheck, UserX } from "lucide-react";
import { api, type EmployeeRecord, type AttendanceRecord } from "@/lib/api";
import { formatCoords, mapsUrl } from "@/lib/geolocation";
import { cn } from "@/lib/utils";

interface EmployeeForm {
  fullName: string;
  email: string;
  password: string;
  department: string;
  position: string;
}

const emptyForm: EmployeeForm = {
  fullName: "",
  email: "",
  password: "",
  department: "",
  position: "",
};

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
  });
}

function fmtDateTime(iso: string): string {
  const date = new Date(iso);
  const day = date.toLocaleDateString([], {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
  const time = date.toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
  return `${day} · ${time}`;
}

type AttendanceStatus = "checked_out" | "on_duty" | "incomplete";

function statusOf(
  record: AttendanceRecord,
  today: string | null,
): AttendanceStatus {
  if (record.checkOutAt) return "checked_out";
  return record.workDate === today ? "on_duty" : "incomplete";
}

function isIncomplete(record: AttendanceRecord, today: string | null): boolean {
  return statusOf(record, today) === "incomplete";
}

function parseISODate(value: string): Date {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function toISODate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

type Section = "employees" | "attendance" | "not-present";

const SECTIONS: { id: Section; label: string; icon: typeof Users }[] = [
  { id: "employees", label: "Employees", icon: Users },
  { id: "attendance", label: "Attendance", icon: CalendarCheck },
  { id: "not-present", label: "Not present", icon: UserX },
];

export function MasterDashboard() {
  const [employees, setEmployees] = useState<EmployeeRecord[] | null>(null);
  const [attendance, setAttendance] = useState<AttendanceRecord[] | null>(null);
  const [today, setToday] = useState<string | null>(null);
  const [section, setSection] = useState<Section>("employees");
  const [dateFilter, setDateFilter] = useState<Date | undefined>(undefined);
  const [absenceDate, setAbsenceDate] = useState<Date | undefined>(undefined);
  const [onlyIncomplete, setOnlyIncomplete] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<EmployeeRecord | null>(null);
  const [form, setForm] = useState<EmployeeForm>(emptyForm);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState<EmployeeRecord | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [photoRecord, setPhotoRecord] = useState<AttendanceRecord | null>(null);

  const load = useCallback(async () => {
    const [users, records, day] = await Promise.all([
      api.get<EmployeeRecord[]>("/users"),
      api.get<AttendanceRecord[]>("/attendance"),
      api.get<{ workDate: string }>("/attendance/today"),
    ]);
    setEmployees(users);
    setAttendance(records);
    setToday(day.workDate);
  }, []);

  useEffect(() => {
    load().catch(() => setEmployees([]));
  }, [load]);

  useEffect(() => {
    if (today) setAbsenceDate((current) => current ?? parseISODate(today));
  }, [today]);

  const staff = useMemo(
    () => (employees ?? []).filter((e) => e.role === "EMPLOYEE"),
    [employees],
  );

  const nameById = useMemo(() => {
    const map = new Map<number, string>();
    for (const e of employees ?? []) map.set(e.id, e.fullName);
    return map;
  }, [employees]);

  const absenceDateISO = absenceDate
    ? toISODate(absenceDate)
    : (today ?? "");

  const filteredAttendance = useMemo(() => {
    if (!attendance) return null;
    let rows = attendance;
    if (dateFilter) {
      const iso = toISODate(dateFilter);
      rows = rows.filter((r) => r.workDate === iso);
    }
    if (onlyIncomplete) rows = rows.filter((r) => isIncomplete(r, today));
    return rows;
  }, [attendance, dateFilter, onlyIncomplete, today]);

  const presentToday = useMemo(
    () => (attendance ?? []).filter((r) => r.workDate === today).length,
    [attendance, today],
  );

  const stillOnDuty = useMemo(
    () =>
      (attendance ?? []).filter(
        (r) => r.workDate === today && !r.checkOutAt,
      ).length,
    [attendance, today],
  );

  const absentOn = useMemo(() => {
    const presentIds = new Set(
      (attendance ?? [])
        .filter((r) => r.workDate === absenceDateISO)
        .map((r) => r.userId),
    );
    return staff.filter((e) => !presentIds.has(e.id));
  }, [attendance, staff, absenceDateISO]);

  const absentTodayCount = useMemo(() => {
    const presentIds = new Set(
      (attendance ?? [])
        .filter((r) => r.workDate === today)
        .map((r) => r.userId),
    );
    return staff.filter((e) => !presentIds.has(e.id)).length;
  }, [attendance, staff, today]);

  function openCreate() {
    setEditing(null);
    setForm(emptyForm);
    setFormError(null);
    setFormOpen(true);
  }

  function openEdit(employee: EmployeeRecord) {
    setEditing(employee);
    setForm({
      fullName: employee.fullName,
      email: employee.email,
      password: "",
      department: employee.department ?? "",
      position: employee.position ?? "",
    });
    setFormError(null);
    setFormOpen(true);
  }

  async function saveForm() {
    setFormError(null);

    if (editing && form.password && form.password.length < 6) {
      setFormError("New password must be at least 6 characters");
      return;
    }
    if (!form.fullName.trim()) {
      setFormError("Full name is required");
      return;
    }
    if (!editing && !form.email.trim()) {
      setFormError("Email is required");
      return;
    }

    setSaving(true);
    try {
      if (editing) {
        await api.patch(`/users/${editing.id}`, {
          fullName: form.fullName || undefined,
          department: form.department || undefined,
          position: form.position || undefined,
          password: form.password || undefined,
        });
      } else {
        await api.post("/users", {
          fullName: form.fullName,
          email: form.email,
          department: form.department || undefined,
          position: form.position || undefined,
        });
      }
      setFormOpen(false);
      await load();
    } catch (err) {
      setFormError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function confirmDelete() {
    if (!deleting) return;
    setSaving(true);
    setDeleteError(null);
    try {
      await api.delete(`/users/${deleting.id}`);
      setDeleting(null);
      await load();
    } catch (err) {
      setDeleteError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setSaving(false);
    }
  }

  const counts: Record<Section, string> = {
    employees: `${staff.length}`,
    attendance: `${attendance?.length ?? 0}`,
    "not-present": `${absentTodayCount} today`,
  };

  return (
    <div className="reveal-product flex flex-col gap-6 lg:flex-row lg:items-start">
      <nav
        aria-label="Dashboard sections"
        className="shrink-0 lg:sticky lg:top-6 lg:w-56"
      >
        <div className="flex gap-1 overflow-x-auto rounded-xl border border-border bg-card p-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden lg:flex-col lg:overflow-visible lg:p-1.5">
          {SECTIONS.map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-9 min-w-0 flex-1 shrink-0 items-center justify-center gap-1 rounded-lg px-1 text-left text-caption transition-colors duration-80 sm:gap-1.5 sm:px-1.5 sm:text-subtitle lg:flex-none lg:justify-start lg:gap-2.5 lg:px-2.5",
                  active
                    ? "bg-accent text-foreground"
                    : "text-muted-foreground hover:bg-hover hover:text-foreground",
                )}
              >
                <Icon
                  size={16}
                  strokeWidth={active ? 2 : 1.5}
                  className="hidden shrink-0 sm:block"
                />
                <span className={cn("truncate whitespace-nowrap", active && "font-semibold")}>
                  {item.label}
                </span>
                <span className="hidden shrink-0 font-mono text-caption tabular-nums text-muted-foreground lg:inline">
                  {counts[item.id]}
                </span>
              </button>
            );
          })}
        </div>
      </nav>

      <div className="min-w-0 flex-1">
        {section === "employees" && (
          <section>
            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 className="text-subtitle font-semibold">Employees</h2>
              <span className="font-mono text-caption tabular-nums text-muted-foreground">
                {staff.length} on staff
              </span>
            </div>
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <Table className="min-w-[760px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Name</TableHead>
                    <TableHead className="whitespace-nowrap">Email</TableHead>
                    <TableHead className="whitespace-nowrap">Department</TableHead>
                    <TableHead className="whitespace-nowrap">Position</TableHead>
                    <TableHead className="whitespace-nowrap">Role</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(employees ?? []).map((employee, index) => (
                    <TableRow key={employee.id} index={index}>
                      <TableCell className="font-medium">
                        {employee.fullName}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {employee.email}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {employee.department ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {employee.position ?? "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="dot"
                          color={employee.role === "MASTER" ? "amber" : "gray"}
                        >
                          {employee.role === "MASTER" ? "Master" : "Employee"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {employee.role === "EMPLOYEE" && (
                          <div className="flex justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="compact"
                              onClick={() => openEdit(employee)}
                            >
                              <Pencil size={16} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="compact"
                              onClick={() => {
                                setDeleteError(null);
                                setDeleting(employee);
                              }}
                            >
                              <Trash2 size={16} />
                            </Button>
                          </div>
                        )}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {employees && employees.length === 0 && (
                <div className="px-6 pb-5 text-caption text-muted-foreground">
                  No employees yet
                </div>
              )}
            </div>
            <Button
              variant="primary"
              size="compact"
              className="mt-4"
              leadingIcon={Plus}
              onClick={openCreate}
            >
              Add employee
            </Button>
          </section>
        )}

        {section === "attendance" && (
          <section>
            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 className="text-subtitle font-semibold">Attendance</h2>
              <span className="font-mono text-caption tabular-nums text-muted-foreground">
                {presentToday} present today · {stillOnDuty} on duty
              </span>
            </div>
            <div className="mb-3 flex flex-wrap items-center gap-2 sm:gap-3">
              <div className="w-full sm:w-56">
                <DatePicker
                  mode="single"
                  value={dateFilter}
                  onValueChange={setDateFilter}
                  placeholder="All dates"
                  aria-label="Filter by date"
                  className="w-full"
                />
              </div>
              <Button
                variant={onlyIncomplete ? "primary" : "secondary"}
                size="compact"
                active={onlyIncomplete}
                onClick={() => setOnlyIncomplete((v) => !v)}
              >
                No check-out only
              </Button>
              {onlyIncomplete && (
                <span className="font-mono text-caption tabular-nums text-muted-foreground">
                  {(filteredAttendance ?? []).length} row
                  {(filteredAttendance ?? []).length === 1 ? "" : "s"}
                </span>
              )}
            </div>
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <Table className="min-w-[860px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Employee</TableHead>
                    <TableHead className="whitespace-nowrap">Date</TableHead>
                    <TableHead className="whitespace-nowrap">Check-in</TableHead>
                    <TableHead className="whitespace-nowrap">Check-out</TableHead>
                    <TableHead className="whitespace-nowrap">Status</TableHead>
                    <TableHead className="w-[45%]">Planned work</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(filteredAttendance ?? []).map((record, index) => (
                    <TableRow
                      key={record.id}
                      index={index}
                      onClick={() => setPhotoRecord(record)}
                      className="cursor-pointer"
                    >
                      <TableCell className="whitespace-nowrap font-medium">
                        {nameById.get(record.userId) ??
                          `User ${record.userId}`}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-caption tabular-nums text-muted-foreground">
                        {record.workDate}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-caption tabular-nums text-muted-foreground">
                        {fmtTime(record.createdAt)}
                      </TableCell>
                      <TableCell className="whitespace-nowrap font-mono text-caption tabular-nums text-muted-foreground">
                        {record.checkOutAt ? fmtTime(record.checkOutAt) : "—"}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="dot"
                          color={
                            statusOf(record, today) === "checked_out"
                              ? "gray"
                              : statusOf(record, today) === "on_duty"
                                ? "green"
                                : "amber"
                          }
                        >
                          {statusOf(record, today) === "checked_out"
                            ? "Checked out"
                            : statusOf(record, today) === "on_duty"
                              ? "On duty"
                              : "No check-out"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        <span className="line-clamp-2">
                          {record.description ?? "—"}
                        </span>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {filteredAttendance && filteredAttendance.length === 0 && (
                <div className="px-6 pb-5 text-caption text-muted-foreground">
                  No attendance records
                </div>
              )}
            </div>
          </section>
        )}

        {section === "not-present" && (
          <section>
            <div className="mb-1 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
              <h2 className="text-subtitle font-semibold">Not present</h2>
              <span className="font-mono text-caption tabular-nums text-muted-foreground">
                {absentOn.length} of {staff.length} absent · {absenceDateISO}
              </span>
            </div>
            <div className="mb-3 w-full sm:w-56">
              <DatePicker
                mode="single"
                value={absenceDate}
                onValueChange={setAbsenceDate}
                placeholder="Pick a date"
                aria-label="Attendance date"
                className="w-full"
              />
            </div>
            <div className="overflow-x-auto rounded-xl border border-border bg-card">
              <Table className="min-w-[700px]">
                <TableHeader>
                  <TableRow>
                    <TableHead className="whitespace-nowrap">Employee</TableHead>
                    <TableHead className="whitespace-nowrap">Department</TableHead>
                    <TableHead className="whitespace-nowrap">Position</TableHead>
                    <TableHead className="whitespace-nowrap">Date</TableHead>
                    <TableHead className="whitespace-nowrap">Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {absentOn.map((employee, index) => (
                    <TableRow key={employee.id} index={index}>
                      <TableCell className="font-medium">
                        {employee.fullName}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {employee.department ?? "—"}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {employee.position ?? "—"}
                      </TableCell>
                      <TableCell className="font-mono text-caption tabular-nums text-muted-foreground">
                        {absenceDateISO}
                      </TableCell>
                      <TableCell>
                        <Badge variant="dot" color="red">
                          Not present
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {staff.length === 0 && (
                <div className="px-6 pb-5 text-caption text-muted-foreground">
                  No employees on staff
                </div>
              )}
              {staff.length > 0 && absentOn.length === 0 && (
                <div className="px-6 pb-5 text-caption text-muted-foreground">
                  Everyone checked in on {absenceDateISO}
                </div>
              )}
            </div>
          </section>
        )}
      </div>

      <Dialog open={formOpen} onOpenChange={setFormOpen}>
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>
              {editing ? `Edit ${editing.fullName}` : "Add employee"}
            </DialogTitle>
            <DialogDescription>
              {editing
                ? "Update the details. Leave the password empty to keep it as it is"
                : "A password is generated automatically and emailed to the employee"}
            </DialogDescription>
          </DialogHeader>
          <InputGroup className="w-full">
            <InputField
              label="Full name"
              index={0}
              value={form.fullName}
              onChange={(v) => setForm({ ...form, fullName: v })}
            />
            {!editing && (
              <InputField
                label="Email"
                index={1}
                type="email"
                value={form.email}
                onChange={(v) => setForm({ ...form, email: v })}
              />
            )}
            {editing && (
              <InputField
                label="New password (optional)"
                index={2}
                type="password"
                value={form.password}
                onChange={(v) => setForm({ ...form, password: v })}
                placeholder="Leave empty to keep current"
              />
            )}
            <InputField
              label="Department"
              index={3}
              value={form.department}
              onChange={(v) => setForm({ ...form, department: v })}
            />
            <InputField
              label="Position"
              index={4}
              value={form.position}
              onChange={(v) => setForm({ ...form, position: v })}
            />
          </InputGroup>
          {formError && (
            <div className="mt-3 text-caption text-destructive">{formError}</div>
          )}
          <DialogFooter>
            <Button variant="secondary" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={saving} onClick={saveForm}>
              {editing ? "Save changes" : "Create employee"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!deleting}
        onOpenChange={(open) => !open && setDeleting(null)}
      >
        <DialogContent size="sm">
          <DialogHeader>
            <DialogTitle>Remove {deleting?.fullName}</DialogTitle>
            <DialogDescription>
              The account is deleted and can no longer sign in. Past attendance
              records stay on file.
            </DialogDescription>
          </DialogHeader>
          {deleteError && (
            <div className="mt-2 text-caption text-destructive">
              {deleteError}
            </div>
          )}
          <DialogFooter>
            <Button variant="secondary" onClick={() => setDeleting(null)}>
              Cancel
            </Button>
            <Button variant="primary" loading={saving} onClick={confirmDelete}>
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!photoRecord}
        onOpenChange={(open) => !open && setPhotoRecord(null)}
      >
        <DialogContent size="lg">
          <DialogHeader>
            <DialogTitle>
              {photoRecord && (nameById.get(photoRecord.userId) ?? "Photo")} —{" "}
              {photoRecord?.workDate}
            </DialogTitle>
            <DialogDescription>Photo proof for this check-in</DialogDescription>
          </DialogHeader>
          {photoRecord && (
            <div className="flex flex-col gap-3">
              <img
                src={`/api/attendance/photo/${photoRecord.id}`}
                alt="Attendance photo proof"
                className="max-h-[65dvh] w-full rounded-lg border border-border bg-muted object-contain"
              />
              <div className="flex flex-col gap-2 border-t border-border pt-3">
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-caption text-muted-foreground">
                    Recorded by server
                  </span>
                  <span className="font-mono text-subtitle tabular-nums">
                    {fmtDateTime(photoRecord.createdAt)}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-caption text-muted-foreground">
                    Work date
                  </span>
                  <span className="font-mono text-caption tabular-nums text-muted-foreground">
                    {photoRecord.workDate}
                  </span>
                </div>
                <div className="flex items-baseline justify-between gap-4">
                  <span className="text-caption text-muted-foreground">
                    Location
                  </span>
                  {photoRecord.latitude !== null &&
                  photoRecord.longitude !== null ? (
                    <a
                      href={mapsUrl(photoRecord.latitude, photoRecord.longitude)}
                      target="_blank"
                      rel="noreferrer"
                      className="font-mono text-caption tabular-nums underline underline-offset-2 hover:text-foreground"
                    >
                      {formatCoords(
                        photoRecord.latitude,
                        photoRecord.longitude,
                        photoRecord.locationAccuracy,
                      )}
                    </a>
                  ) : (
                    <span className="font-mono text-caption tabular-nums text-muted-foreground">
                      Not available
                    </span>
                  )}
                </div>
                <div className="text-body text-muted-foreground">
                  {photoRecord.description ?? "No description"}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
