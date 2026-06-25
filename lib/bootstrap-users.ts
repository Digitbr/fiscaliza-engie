import { z } from "zod";

const bootstrapUserSchema = z.object({
  email: z.string().trim().toLowerCase().email(),
  password: z.string().min(6).max(72),
  name: z.string().trim().min(2).max(200),
  role: z.enum(["ADMIN", "MANAGER", "SUPERVISOR", "INSPECTOR", "VIEWER"]).default("MANAGER")
});

export type BootstrapUser = z.infer<typeof bootstrapUserSchema>;

export function defaultUserPermissions(role: BootstrapUser["role"]) {
  const permissions = {
    dashboard: true,
    inspections: false,
    kilometers: false,
    records: true,
    scales: false,
    employees: false,
    notices: false,
    users: false,
    editRecords: false,
    deleteRecords: false
  };

  if (role === "ADMIN") {
    return Object.fromEntries(Object.keys(permissions).map((permission) => [permission, true]));
  }

  if (role === "MANAGER") {
    return {
      ...permissions,
      inspections: true,
      kilometers: true,
      scales: true,
      employees: true,
      notices: true,
      editRecords: true,
      deleteRecords: true
    };
  }

  if (role === "SUPERVISOR" || role === "INSPECTOR") {
    return {
      ...permissions,
      inspections: true,
      kilometers: true,
      editRecords: true
    };
  }

  return permissions;
}

export function bootstrapUsersFromEnv() {
  const raw = process.env.BOOTSTRAP_USERS_JSON;
  if (!raw) return [];
  const parsed = JSON.parse(raw);
  return z.array(bootstrapUserSchema).parse(parsed);
}

export function findBootstrapUser(email: string) {
  return bootstrapUsersFromEnv().find((user) => user.email === email.trim().toLowerCase());
}
