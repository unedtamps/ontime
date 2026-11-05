export interface SessionUser {
  id: number;
  role: "MASTER" | "EMPLOYEE";
  email: string;
  fullName: string;
}

export interface EmployeeRecord {
  id: number;
  email: string;
  fullName: string;
  role: "MASTER" | "EMPLOYEE";
  department: string | null;
  position: string | null;
}

export interface AttendanceRecord {
  id: number;
  userId: number;
  workDate: string;
  description: string | null;
  photoPath: string;
  checkOutAt: string | null;
  latitude: number | null;
  longitude: number | null;
  locationAccuracy: number | null;
  createdAt: string;
  updatedAt: string;
}

export class ApiError extends Error {
  status: number;

  constructor(status: number, message: string) {
    super(message);
    this.status = status;
  }
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`/api${path}`, {
    credentials: "include",
    ...init,
    headers: {
      ...(init?.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...init?.headers,
    },
  });
  if (!response.ok) {
    let message = `Request failed (${response.status})`;
    try {
      const data = await response.json();
      message = typeof data.message === "string" ? data.message : message;
    } catch {}
    throw new ApiError(response.status, message);
  }
  if (response.status === 204) return undefined as T;
  const text = await response.text();
  if (!text) return undefined as T;
  return JSON.parse(text) as T;
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body?: unknown) =>
    request<T>(path, {
      method: "POST",
      body: body instanceof FormData ? body : JSON.stringify(body ?? {}),
    }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: "PATCH", body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: "DELETE" }),
};
