import {createHandler} from './handler.mjs';
Deno.serve(createHandler(name=>Deno.env.get(name)));
