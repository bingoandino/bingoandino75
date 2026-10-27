import {createHandler} from './handler.mjs';
Deno.serve(createHandler({url:Deno.env.get('SUPABASE_URL')!,key:Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!}));
