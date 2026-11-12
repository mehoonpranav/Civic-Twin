import { createHmac, timingSafeEqual } from "node:crypto";

const USER = process.env.DEPT_USER || "civictwin";
const PASS = process.env.DEPT_PASS || "@Civictwin1010";

function secret() {
  return (
    process.env.DEPT_SESSION_SECRET ||
    process.env.SUPABASE_SERVICE_ROLE_KEY ||
    process.env.SUPABASE_SECRET_KEY ||
    "civictwin-department"
  );
}

export function departmentCredentialsOk(id: string, password: string) {
  return id === USER && password === PASS;
}

export function signDepartmentToken() {
  const body = Buffer.from(JSON.stringify({ role: "department", exp: Date.now() + 1000 * 60 * 60 * 12 })).toString(
    "base64url",
  );
  const sig = createHmac("sha256", secret()).update(body).digest("base64url");
  return `${body}.${sig}`;
}

export function verifyDepartmentToken(token: string) {
  const [body, sig] = token.split(".");
  if (!body || !sig) return false;
  const expected = createHmac("sha256", secret()).update(body).digest("base64url");
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return false;
  try {
    const payload = JSON.parse(Buffer.from(body, "base64url").toString()) as { exp?: number };
    return typeof payload.exp === "number" && payload.exp > Date.now();
  } catch {
    return false;
  }
}
