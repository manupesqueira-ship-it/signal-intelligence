import Anthropic from '@anthropic-ai/sdk';
import { getServiceClient } from '../../../lib/supabase';

export const maxDuration = 300; // 5 min timeout for Vercel

export async function POST(request) {
  // Verify cron secret
  const { searchParams } = new URL(request.url);
  const secret = searchParams.get('secret');
  if (secret !== process.env.CRON_SECRET) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const db = getServiceClient();
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  try {
    // 1. Check if today's brief already exists
    const today = new Date().toISOString().split('T')[0];
    const { data: existing } = await db
      .from('daily_briefs')
      .select('id')
      .eq('date', today)
      .single();

    if (existing) {
      return Response.json({ message: 'Brief already exists for today', date: today });
    }

    // 2. Get recent topics for anti-repetition
    const { data: recentMemory } = await db
      .from('repetition_memory')
      .select('topic, times_seen, last_seen')
      .gte('last_seen', new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString().split('T')[0])
      .order('last_seen', { ascending: false })
      .limit(50);

    const recentTopics = (recentMemory || []).map(m => m.topic).join(', ');

    // 3. Get sources list
    const { data: sources } = await db
      .from('sources')
      .select('name, url, tier, region, type, credibility')
      .eq('active', true)
      .order('tier', { ascending: true });

    const sourcesList = (sources || []).map(s => `${s.name} (${s.url}, tier ${s.tier}, ${s.region})`).join('\n');

    // 4. Call Claude with web search to generate the briefing
    const systemPrompt = `Eres el editor jefe de "Signal", una plataforma de intelligence scouting premium. Tu trabajo es generar un briefing diario de altísima calidad sobre startups, AI, tendencias emergentes y oportunidades de negocio.

REGLAS EDITORIALES ESTRICTAS:
- Prioriza SEÑAL sobre RUIDO. Solo incluye lo que realmente importa.
- Enfoque geográfico: Asia primero, luego global con relevancia para México.
- Si usas términos en inglés complejos, explícalos brevemente: ej "moat (ventaja difícil de copiar)"
- Distingue entre hechos, inferencias e hipótesis.
- Si algo está sobrehypeado, dilo. Si algo es prometedoro pero incierto, dilo.
- NO inventes datos. NO exageres.

ANTI-REPETICIÓN - Estos temas ya fueron cubiertos recientemente, NO los repitas salvo que haya un update genuinamente nuevo:
${recentTopics || 'Ninguno todavía (primer briefing)'}

FUENTES PRIORITARIAS:
${sourcesList}

FORMATO DE SALIDA:
Responde EXCLUSIVAMENTE con un JSON válido (sin markdown, sin backticks) con esta estructura exacta:
{
  "title": "Título del briefing del día",
  "opening": "Apertura editorial de 3-4 oraciones. Visión rápida del día, qué señales importan más.",
  "items": [
    {
      "title": "Nombre descriptivo del item",
      "category": "AI Agents|HealthTech|Fintech|Quick Commerce|SMB Tools|AI Dev Tools|Regulation|Foundation Models|Robotics|EdTech|otro",
      "status": "Nuevo|Update|Seguimiento",
      "score": 85,
      "confidence": "Alta|Media-Alta|Media|Baja",
      "novelty": 80,
      "region": "Asia|Global|LATAM|US|Europe",
      "summary": "Resumen ejecutivo de 2-3 oraciones",
      "why_it_matters": "Por qué importa, 2-3 oraciones",
      "prob_success": 75,
      "signals": ["Señal 1", "Señal 2", "Señal 3"],
      "risks": ["Riesgo 1", "Riesgo 2"],
      "mexico_relevance": 85,
      "mx_exists": "No|Sí|Parcialmente — explicación",
      "mx_barrier": "Baja|Media|Alta — explicación breve",
      "mx_timing": "Ahora|6-12 meses|12-18 meses|2+ años",
      "mx_buyer": "B2B|B2C|B2B2C — descripción",
      "mx_defendible": "Explicación de defendibilidad",
      "opportunity": "Oportunidad concreta de negocio derivada para México",
      "sources_used": ["Nombre de fuente 1"],
      "tags": ["tag1", "tag2"],
      "section_type": "top5|opportunity|trend_related",
      "section_order": 1
    }
  ],
  "trends": [
    {
      "name": "Nombre de la tendencia",
      "strength": 85,
      "direction": "up|down|stable",
      "weeks_active": 8,
      "description": "Descripción de 2-3 oraciones"
    }
  ],
  "mexico_lens": "Análisis de 4-5 oraciones sobre las oportunidades concretas para México hoy",
  "closing": "Cierre de 3-4 oraciones: qué vigilar mañana, qué temas suben, qué temas bajan"
}

INSTRUCCIONES PARA HOY:
- Genera entre 6-8 items (startups, productos, noticias de AI, oportunidades)
- Genera 4-6 tendencias
- Asegúrate de que al menos 3 items tengan mexico_relevance >= 80
- Los scores deben ser honestos y bien justificados
- Busca en las fuentes las noticias más recientes e importantes de hoy
- La fecha de hoy es: ${today}`;

    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 8000,
      tools: [{ type: 'web_search_20250305', name: 'web_search' }],
      messages: [
        {
          role: 'user',
          content: `Genera el briefing de intelligence scouting para hoy ${today}. Busca las últimas noticias de startups, AI, innovación y tendencias de las fuentes prioritarias (Tech in Asia, KrASIA, e27, CB Insights, Anthropic, OpenAI, Hugging Face, etc). Enfócate en Asia y en oportunidades con relevancia para México. Responde SOLO con el JSON, nada más.`
        }
      ],
      system: systemPrompt,
    });

    // 5. Extract the JSON from Claude's response
    let briefData = null;
    for (const block of response.content) {
      if (block.type === 'text' && block.text.trim()) {
        try {
          // Clean potential markdown fences
          let text = block.text.trim();
          if (text.startsWith('```')) {
            text = text.replace(/^```json?\n?/, '').replace(/\n?```$/, '');
          }
          briefData = JSON.parse(text);
        } catch (e) {
          // Try to find JSON in the text
          const match = text.match(/\{[\s\S]*\}/);
          if (match) {
            try { briefData = JSON.parse(match[0]); } catch (e2) {}
          }
        }
      }
    }

    if (!briefData) {
      return Response.json({ error: 'Failed to parse Claude response', raw: response.content }, { status: 500 });
    }

    // 6. Insert the daily brief
    const { data: brief, error: briefError } = await db
      .from('daily_briefs')
      .insert({
        date: today,
        title: briefData.title,
        opening: briefData.opening,
        mexico_lens: briefData.mexico_lens,
        closing: briefData.closing,
        status: 'published'
      })
      .select()
      .single();

    if (briefError) throw briefError;

    // 7. Insert items
    if (briefData.items && briefData.items.length > 0) {
      const itemsToInsert = briefData.items.map((item, idx) => ({
        brief_id: brief.id,
        title: item.title,
        category: item.category,
        status: item.status || 'Nuevo',
        date: today,
        score: item.score,
        confidence: item.confidence,
        novelty: item.novelty,
        region: item.region,
        summary: item.summary,
        why_it_matters: item.why_it_matters,
        prob_success: item.prob_success,
        signals: item.signals,
        risks: item.risks,
        mexico_relevance: item.mexico_relevance,
        mx_exists: item.mx_exists,
        mx_barrier: item.mx_barrier,
        mx_timing: item.mx_timing,
        mx_buyer: item.mx_buyer,
        mx_defendible: item.mx_defendible,
        opportunity: item.opportunity,
        sources_used: item.sources_used,
        tags: item.tags,
        section_type: item.section_type,
        section_order: item.section_order || idx + 1
      }));

      await db.from('items').insert(itemsToInsert);
    }

    // 8. Insert trends
    if (briefData.trends && briefData.trends.length > 0) {
      const trendsToInsert = briefData.trends.map(t => ({
        brief_id: brief.id,
        name: t.name,
        strength: t.strength,
        direction: t.direction,
        weeks_active: t.weeks_active,
        description: t.description
      }));

      await db.from('trends').insert(trendsToInsert);
    }

    // 9. Update anti-repetition memory
    if (briefData.items) {
      for (const item of briefData.items) {
        const topicKey = item.title.toLowerCase().substring(0, 100);
        const { data: existingMem } = await db
          .from('repetition_memory')
          .select('id, times_seen')
          .eq('topic', topicKey)
          .single();

        if (existingMem) {
          await db.from('repetition_memory')
            .update({ last_seen: today, times_seen: existingMem.times_seen + 1 })
            .eq('id', existingMem.id);
        } else {
          await db.from('repetition_memory').insert({
            topic: topicKey,
            first_seen: today,
            last_seen: today,
            times_seen: 1
          });
        }
      }
    }

    // 10. Generate audio script (separate call for better quality)
    const audioResponse = await anthropic.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 6000,
      messages: [
        {
          role: 'user',
          content: `Convierte este briefing en un guion de audio de 30-35 minutos. El guion debe sonar como un briefing ejecutivo premium para escuchar en el coche. Español fluido, con términos en inglés cuando sea natural. Ritmo editorial cómodo, claridad narrativa. NO leas datos planos — cuenta una historia de inteligencia. Incluye transiciones entre secciones. El formato debe ser texto plano listo para TTS, sin marcas de formato.

BRIEFING:
${JSON.stringify(briefData, null, 2)}`
        }
      ]
    });

    let audioScript = '';
    for (const block of audioResponse.content) {
      if (block.type === 'text') audioScript += block.text;
    }

    // Update brief with audio script
    await db.from('daily_briefs')
      .update({ audio_script: audioScript })
      .eq('id', brief.id);

    return Response.json({
      success: true,
      date: today,
      brief_id: brief.id,
      items_count: briefData.items?.length || 0,
      trends_count: briefData.trends?.length || 0
    });

  } catch (error) {
    console.error('Brief generation error:', error);
    return Response.json({ error: error.message }, { status: 500 });
  }
}
