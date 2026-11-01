const {test}=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs');
test('entrada create-session antigua no crea sesiones',()=>{
 const s=fs.readFileSync('supabase/functions/create-session/index.ts','utf8');
 assert.match(s,/Ruta anterior de acceso deshabilitada/);
});
test('frontend conserva flujo sin guardar código en consola',()=>{
 const s=fs.readFileSync('script.js','utf8');
 assert.match(s,/supabase.auth.signInWithOtp/);
 assert.match(s,/supabase.auth.verifyOtp/);
 assert.match(s,/pending_admin_login_proof/);
 assert.doesNotMatch(s,/console.log\([^\n]*otpCode/);
});
