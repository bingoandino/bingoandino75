import {createGeneralHandler} from './handler.mjs';
Deno.serve(createGeneralHandler(name => Deno.env.get(name)));
