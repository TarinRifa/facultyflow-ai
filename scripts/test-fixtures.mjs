import fs from "node:fs";
import crypto from "node:crypto";
import pg from "pg";
import { lookup } from "node:dns/promises";
export async function testDatabase(){
 try{process.loadEnvFile(".env.local");}catch{}
 if(!process.env.DATABASE_URL)throw new Error("Live database tests require DATABASE_URL.");
 const url=new URL(process.env.DATABASE_URL);
 const servername=url.hostname;
 const {address}=await lookup(servername,{family:4});
 url.hostname=address;
 const client=new pg.Client({connectionString:url.toString(),connectionTimeoutMillis:15000,ssl:{servername,rejectUnauthorized:true,ca:fs.readFileSync(process.env.SUPABASE_DB_CA_PATH||".connection-check/supabase-ca.crt","utf8")}});
 await client.connect();return client;
}
export async function createTestUser(client){
 const id=crypto.randomUUID(),email="facultyflow-test-"+id+"@example.com",password=crypto.randomBytes(24).toString("base64url");
 await client.query(`insert into auth.users(instance_id,id,aud,role,email,encrypted_password,email_confirmed_at,raw_app_meta_data,raw_user_meta_data,created_at,updated_at,confirmation_token,recovery_token,email_change_token_new,email_change)
 values ('00000000-0000-0000-0000-000000000000',$1,'authenticated','authenticated',$2,extensions.crypt($3,extensions.gen_salt('bf')),now(),'{"provider":"email","providers":["email"]}','{"display_name":"Dr. Alex Morgan"}',now(),now(),'','','','')`,[id,email,password]);
 try{
 await client.query(`insert into auth.identities(id,user_id,provider_id,identity_data,provider,created_at,updated_at) values($1::uuid,$2::uuid,($2::uuid)::text,jsonb_build_object('sub',($2::uuid)::text,'email',$3::text,'email_verified',true),'email',now(),now())`,[crypto.randomUUID(),id,email]);
 }catch(error){await client.query("delete from auth.users where id=$1",[id]);throw error;}
 return {id,email,password};
}
export async function removeTestUsers(client,users){
 for(const user of users){await client.query("delete from auth.users where id=$1 and email=$2",[user.id,user.email]);}
}
