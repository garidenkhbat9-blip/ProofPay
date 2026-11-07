export const authOrigins = ["https://proof-pay-beta.vercel.app", "http://localhost:3000"];
export function authOrigin(url: string) {
  const origin = new URL(url).origin;
  if (!authOrigins.includes(origin)) throw Error("Unrecognized application origin");
  return origin;
}
export function oauthDestination(preference: unknown) {
  return preference === "client" || preference === "freelancer"
    ? "/dashboard?perspective=" + preference : "/auth/workspace";
}
