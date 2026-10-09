"use client";
import { useCallback, useEffect, useState } from "react";
import { api } from "./api";
import { Btn, Card, inputCls, Notice, PageTitle } from "./ui";

type U = { id: string; email: string; name: string; role: "OWNER" | "MANAGER" | "KITCHEN"; active: boolean };
const ROLE_HELP = {
  OWNER: "Full access, including prices, refunds, sales and staff accounts.",
  MANAGER: "Orders, menu availability, scheduling and production.",
  KITCHEN: "Kitchen orders and production reports only.",
};

export function UsersAdmin({ meId }: { meId: string }) {
  const [users, setUsers] = useState<U[]>([]);
  const [f, setF] = useState({ name: "", email: "", role: "KITCHEN" as U["role"], password: "" });
  const [msg, setMsg] = useState<{ kind: "ok" | "error"; text: string } | null>(null);
  const load = useCallback(async () => setUsers(await api<U[]>("/api/staff/users")), []);
  useEffect(() => {
    load();
  }, [load]);
  const run = async (fn: () => Promise<unknown>, ok: string) => {
    try {
      await fn();
      setMsg({ kind: "ok", text: ok });
      await load();
    } catch (e) {
      setMsg({ kind: "error", text: e instanceof Error ? e.message : "Failed" });
    }
  };

  return (
    <div className="space-y-4">
      <PageTitle>Staff Accounts</PageTitle>
      {msg && <Notice kind={msg.kind}>{msg.text}</Notice>}
      <Card className="overflow-x-auto bg-white p-0">
        <table className="w-full text-sm">
          <thead className="bg-forest text-left text-cream"><tr><th className="p-2">Name</th><th>Email</th><th>Role</th><th>Status</th><th></th></tr></thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className={`border-b border-forest/10 ${u.active ? "" : "opacity-50"}`}>
                <td className="p-2 font-semibold">{u.name}{u.id === meId && " (you)"}</td>
                <td>{u.email}</td>
                <td>
                  <select className={`${inputCls} w-32`} value={u.role} onChange={(e) => run(() => api(`/api/staff/users/${u.id}`, { method: "PATCH", body: { role: e.target.value } }), "Role updated.")}>
                    <option value="OWNER">Owner</option><option value="MANAGER">Manager</option><option value="KITCHEN">Kitchen</option>
                  </select>
                </td>
                <td>{u.active ? "Active" : "Disabled"}</td>
                <td className="space-x-2 whitespace-nowrap pr-2 text-right">
                  <button
                    className="text-forest underline"
                    onClick={() => {
                      const p = prompt(`New password for ${u.name} (at least 10 characters):`);
                      if (p) run(() => api(`/api/staff/users/${u.id}`, { method: "PATCH", body: { password: p } }), "Password changed.");
                    }}
                  >
                    Reset password
                  </button>
                  {u.id !== meId && (
                    <button className="text-terracotta underline" onClick={() => run(() => api(`/api/staff/users/${u.id}`, { method: "PATCH", body: { active: !u.active } }), u.active ? "Account disabled." : "Account enabled.")}>
                      {u.active ? "Disable" : "Enable"}
                    </button>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
      <Card>
        <h2 className="font-display text-lg text-forest">Add a staff member</h2>
        <form
          className="mt-2 grid gap-2 sm:grid-cols-5"
          onSubmit={(e) => {
            e.preventDefault();
            run(() => api("/api/staff/users", { body: f }), `${f.name} added.`).then(() => setF({ name: "", email: "", role: "KITCHEN", password: "" }));
          }}
        >
          <input required placeholder="Name" className={inputCls} value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} />
          <input required type="email" placeholder="Email" className={inputCls} value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} />
          <select className={inputCls} value={f.role} onChange={(e) => setF({ ...f, role: e.target.value as U["role"] })}>
            <option value="KITCHEN">Kitchen</option><option value="MANAGER">Manager</option><option value="OWNER">Owner</option>
          </select>
          <input required minLength={10} type="password" placeholder="Temporary password" className={inputCls} value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} />
          <Btn type="submit">Add</Btn>
        </form>
        <p className="mt-2 text-xs text-ink/60">{ROLE_HELP[f.role]}</p>
      </Card>
    </div>
  );
}
