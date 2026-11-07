import {test} from "node:test";
import assert from "node:assert/strict";
import type {SupabaseClient} from "@supabase/supabase-js";
import {authorizeMember} from "../src/lib/project-authorization";
import {ApiError} from "../src/lib/api-http";
function fixture({role = "client", confirmed = true, authStatus = 0, member = true, queryError = false} = {}) {
  const filters: unknown[] = [];
  const client = {auth: {getUser: async (token: string) => {
    assert.equal(token, "verified-token");
    return {data: {user: authStatus ? null : {id: "actual-user", email_confirmed_at: confirmed ? "date" : null, user_metadata: {perspective: "client"}}}, error: authStatus ? {status: authStatus} : null};
  }}, from: (table: string) => ({select() {return this;}, eq(key: string, value: string) {filters.push([table,key,value]); return this;},
    maybeSingle: async () => ({data: table === "projects" ? {id: "project"} : member ? {role} : null, error: queryError ? {message: "private detail"} : null})})} as unknown as SupabaseClient;
  return {client,filters};
}
const status = (code: number) => (e: unknown) => e instanceof ApiError && e.status === code;
test("server authorization scopes membership to Auth-verified identity and project", async () => {
  const f = fixture();
  const result = await authorizeMember(f.client, "verified-token", "project", "client");
  assert.equal(result.user.id, "actual-user");
  assert(f.filters.some(v=>JSON.stringify(v)===JSON.stringify(["project_members","user_id","actual-user"])));
  assert(f.filters.some(v=>JSON.stringify(v)===JSON.stringify(["project_members","project_id","project"])));
});
test("outsiders, wrong roles, unverified accounts and unavailable authorization fail closed", async () => {
  for (const [options, code] of [[{member:false},404], [{role:"freelancer"},403], [{confirmed:false},403], [{authStatus:401},401], [{authStatus:503},503], [{queryError:true},503]] as const) {
    await assert.rejects(authorizeMember(fixture(options).client,"verified-token","project","client"), status(code));
  }
});
test("freelancer membership permits freelancer actions regardless of client metadata preference", async () => {
  const result = await authorizeMember(fixture({role:"freelancer"}).client,"verified-token","project","freelancer");
  assert.equal(result.role, "freelancer");
});
