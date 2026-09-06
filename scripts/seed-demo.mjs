import { createClient } from "@supabase/supabase-js";
if(!process.argv.includes("--confirm-demo"))throw new Error("Use --confirm-demo with a dedicated empty demo account.");
const {DEMO_EMAIL,DEMO_PASSWORD,NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY}=process.env;
if(!DEMO_EMAIL||!DEMO_PASSWORD)throw new Error("Set DEMO_EMAIL and DEMO_PASSWORD locally.");
const client=createClient(NEXT_PUBLIC_SUPABASE_URL,NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY);
const {data,error}=await client.auth.signInWithPassword({email:DEMO_EMAIL,password:DEMO_PASSWORD});
if(error)throw new Error("Demo account sign-in failed.");
try{
 const existing=await client.from("tasks").select("id",{count:"exact",head:true});
 if(existing.error)throw new Error("Database schema is not ready.");
 if(existing.count)throw new Error("Demo seeding requires an empty account; existing tasks are preserved.");
 const now=Date.now(),day=86400000;
 const entries=[
 ["Grade midterm scripts","CSE101","Grading","urgent",-2,"pending"],
 ["Prepare next lecture slides","CSE101","Teaching","high",.2,"in_progress"],
 ["Review thesis proposal","CSE499","Advising","high",2,"pending"],
 ["Publish weekly lab assignment","CSE220","Teaching","medium",4,"pending"],
 ["Outline research paper","","Research","medium",null,"pending"],
 ["Prepare department meeting agenda","","Administration","low",6,"pending"],
 ["Submit semester course outline","CSE101","Teaching","high",-4,"completed"],
 ["Review lab equipment request","","Administration","low",-3,"completed"]];
 const result=await client.from("tasks").insert(entries.map(([title,course_code,category,priority,days,status])=>({user_id:data.user.id,title,course_code,category,priority,status,description:"Fictional faculty demo task.",due_at:days===null?null:new Date(now+Number(days)*day).toISOString()})));
 if(result.error)throw new Error("Demo seed failed.");
 console.log("Created 8 demo tasks in the signed-in demo account.");
}finally{await client.auth.signOut();}
