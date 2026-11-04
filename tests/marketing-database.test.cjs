const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { PGlite } = require('@electric-sql/pglite');

const sql = fs.readFileSync(path.join(__dirname, '..', 'supabase/marketing-visitas.sql'), 'utf8');

test('migración ANDY aislada con RLS y sin grants públicos', async () => {
  const db = new PGlite();
  try {
    await db.exec('create role anon; create role authenticated; create role service_role;');
    await db.exec(sql);
    const rls = await db.query("select relrowsecurity from pg_class where oid = 'public.marketing_visitas'::regclass");
    assert.equal(rls.rows[0].relrowsecurity, true);

    const access = await db.query(
      "select has_table_privilege('anon','public.marketing_visitas','SELECT') as anon_select," +
      "has_table_privilege('anon','public.marketing_visitas','INSERT') as anon_insert," +
      "has_table_privilege('authenticated','public.marketing_visitas','SELECT') as auth_select," +
      "has_table_privilege('service_role','public.marketing_visitas','INSERT') as service_insert," +
      "has_function_privilege('anon','public.marketing_resumen(integer)','EXECUTE') as anon_report"
    );
    assert.equal(access.rows[0].anon_select,false);
    assert.equal(access.rows[0].anon_insert,false);
    assert.equal(access.rows[0].auth_select,false);
    assert.equal(access.rows[0].service_insert,true);
    assert.equal(access.rows[0].anon_report,false);

    const sample = ['11111111-1111-4111-8111-111111111111','22222222-2222-4222-8222-222222222222'];
    await db.query("insert into public.marketing_visitas(sesion_id,tipo,origen) values($1,'visita','instagram'),($2,'click_comprar','whatsapp')",sample);
    await assert.rejects(
      db.query("insert into public.marketing_visitas(sesion_id,tipo,origen) values($1,'visita','instagram')",[sample[0]]),
      /unique|duplicate/i
    );
    const aggregate = await db.query("select * from public.marketing_resumen(7)");
    assert.equal(aggregate.rows.length,2);
    assert.equal(aggregate.rows.every(row=>'sesion_id' in row===false),true);
  } finally {
    await db.close();
  }
});
