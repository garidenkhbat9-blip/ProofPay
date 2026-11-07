import { test } from "node:test";
import assert from "node:assert/strict";
import type { SupabaseClient } from "@supabase/supabase-js";
import { saveWorkspacePreference } from "../src/lib/workspace-preference";

test("workspace persistence pins verified account token and never writes membership", async () => {
  const original=globalThis.fetch;
  let current="account-a", writes=0;
  const client={auth:{getSession:async()=>({data:{session:{user:{id:"account-a"},access_token:"token-a"}}}),getUser:async(token?:string)=>({data:{user:{id:token?"account-a":current,email_confirmed_at:"confirmed"}}})}} as unknown as SupabaseClient;
  globalThis.fetch=async(url,init)=>{
    assert(String(url).endsWith("/auth/v1/user"));
    assert.equal(new Headers(init?.headers).get("Authorization"),"Bearer token-a");
    assert.deepEqual(JSON.parse(String(init?.body)),{data:{preferred_workspace:"freelancer"}});
    writes++;
    return Response.json({id:"account-a",user_metadata:{preferred_workspace:"freelancer"}});
  };
  try {
    await saveWorkspacePreference(client,"account-a","freelancer");
    assert.equal(writes,1);
    await assert.rejects(saveWorkspacePreference(client,"account-b","client"),/account changed/);
    assert.equal(writes,1);
    current="account-b";
    await assert.rejects(saveWorkspacePreference(client,"account-a","freelancer"),/account changed/);
    assert.equal(writes,2);
  } finally {globalThis.fetch=original;}
});
test("unverified identity cannot persist preference", async()=>{
  const client={auth:{getSession:async()=>({data:{session:{user:{id:"a"},access_token:"a"}}}),getUser:async()=>({data:{user:{id:"a",email_confirmed_at:null}}})}} as unknown as SupabaseClient;
  await assert.rejects(saveWorkspacePreference(client,"a","client"),/confirm your account/);
});
