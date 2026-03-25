# Signal — Intelligence Scouting Platform

Plataforma pública de intelligence scouting. Briefing diario automático a las 7am CDMX sobre startups, AI y oportunidades de negocio.

## Stack
- **Frontend**: Next.js 14 + React
- **Database**: Supabase (PostgreSQL)
- **AI**: Anthropic Claude API con web search
- **Audio**: Web Speech API (TTS del navegador)
- **Hosting**: Vercel (con cron jobs diarios)

## Deploy a Vercel

1. Sube este repo a GitHub
2. Conecta el repo en vercel.com
3. Agrega estas environment variables en Vercel:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ANTHROPIC_API_KEY`
   - `CRON_SECRET`
4. Deploy

El cron job se ejecuta diariamente a las 12:00 UTC (6:00 AM CDMX).
