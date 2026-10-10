import { json, route } from "@/lib/api";
import { getStaffUser } from "@/lib/auth";

export const GET = route(async () => {
  const user = await getStaffUser();
  return user ? json(user) : json({ error: "Not signed in" }, 401);
});
