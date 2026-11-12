export const DEPT_TOKEN_KEY = "civictwin_dept";

export function getDepartmentToken() {
  if (typeof window === "undefined") return "";
  return sessionStorage.getItem(DEPT_TOKEN_KEY) || "";
}

export function setDepartmentToken(token: string) {
  sessionStorage.setItem(DEPT_TOKEN_KEY, token);
}

export function clearDepartmentToken() {
  sessionStorage.removeItem(DEPT_TOKEN_KEY);
}
