# Why the functions run in Tokyo

The Supabase database for this app lives in `ap-northeast-1` (Tokyo). Vercel,
with no configuration, runs serverless functions in `iad1` (Washington DC).

Prisma talks to the database several times to answer one request — a query per
relation it loads — so every one of those was crossing the Pacific and back. A
436-byte response from `/api/stores` took 1.5–3 seconds, almost none of which
was the query itself.

`regions: ["hnd1"]` puts the functions in the same AWS region as the database,
so those round trips become local. Static assets are unaffected: Vercel still
serves them from the edge nearest the shop (`bom1`, Mumbai).

**If the database is ever moved, this must move with it.** Check the region at
Supabase → Project Settings → General, and map it:

| Supabase        | Vercel |
| --------------- | ------ |
| ap-south-1      | bom1   |
| ap-southeast-1  | sin1   |
| ap-northeast-1  | hnd1   |
| us-east-1       | iad1   |
