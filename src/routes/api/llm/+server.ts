import type { RequestHandler } from '@sveltejs/kit'
import { env } from '$env/dynamic/private'

function withTimeout<T>(promise: Promise<T>, ms = 30000): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => reject(new Error('LLM request timed out')), ms)
    promise
      .then((res) => {
        clearTimeout(id)
        resolve(res)
      })
      .catch((err) => {
        clearTimeout(id)
        reject(err)
      })
  })
}

export const POST: RequestHandler = async ({ request }) => {
  try {
    const { provider, prompt, model } = await request.json()
    console.log('LLM API called:', { provider, model, promptLength: prompt?.length })
    
    if (!provider || !prompt) {
      console.error('Missing required fields:', { provider: !!provider, prompt: !!prompt })
      return new Response(JSON.stringify({ error: 'provider and prompt are required' }), { status: 400 })
    }

    let content = ''

    if (provider === 'OpenAI GPT-5' || provider === 'OpenAI' || provider === 'OpenAI GPT-4') {
      const apiKey = env.OPENAI_API_KEY || env.VITE_OPENAI_API_KEY
      if (!apiKey) return new Response(JSON.stringify({ error: 'OpenAI API key not configured' }), { status: 500 })
      const selectedModel = 'gpt-5-nano'
      const payload: Record<string, any> = {
        model: selectedModel,
        input: prompt,
      }
      // Include lightweight reasoning controls for gpt-5 family
      if ((selectedModel as string).toLowerCase().startsWith('gpt-5')) {
        payload.reasoning = { effort: 'low' }
      }

      const resp = await withTimeout(
        fetch('https://api.openai.com/v1/responses', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify(payload)
        })
      )
      console.log('OpenAI response status:', resp.status)
      if (!resp.ok) {
        const t = await resp.text()
        console.error('OpenAI error details:', { status: resp.status, response: t })
        return new Response(JSON.stringify({ error: `OpenAI error ${resp.status}: ${t}` }), { status: 502 })
      }
      const data = await resp.json()
      console.log('OpenAI response data:', JSON.stringify(data, null, 2))
      
      // Parse the new Responses API structure
      content = ''
      if (data?.output && Array.isArray(data.output)) {
        // Find the message output (skip reasoning outputs)
        const messageOutput = data.output.find((item: any) => item.type === 'message')
        if (messageOutput?.content && Array.isArray(messageOutput.content)) {
          // Extract text from content items
          const textContent = messageOutput.content
            .filter((item: any) => item.type === 'output_text')
            .map((item: any) => item.text)
            .filter(Boolean)
            .join('\n')
            .trim()
          content = textContent
        }
      }
      
      // Fallbacks for other potential structures
      if (!content) {
        content = (typeof data?.output_text === 'string' && data.output_text.trim())
          ? data.output_text
          : (data?.choices?.[0]?.message?.content || '')
      }
      
      console.log('Extracted content length:', content?.length || 0)
    } else if (provider === 'Anthropic Claude' || provider === 'Anthropic') {
      const apiKey = env.ANTHROPIC_API_KEY || env.VITE_ANTHROPIC_API_KEY
      if (!apiKey) return new Response(JSON.stringify({ error: 'Anthropic API key not configured' }), { status: 500 })

      const resp = await withTimeout(
        fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': apiKey,
            'Content-Type': 'application/json',
            'anthropic-version': '2023-06-01'
          },
          body: JSON.stringify({
            model: 'claude-3-sonnet-20240229',
            max_tokens: 500,
            messages: [{ role: 'user', content: prompt }]
          })
        })
      )
      if (!resp.ok) {
        const t = await resp.text()
        return new Response(JSON.stringify({ error: `Anthropic error ${resp.status}: ${t}` }), { status: 502 })
      }
      const data = await resp.json()
      content = data?.content?.[0]?.text || ''
    } else if (provider === 'Google Gemini' || provider === 'Gemini') {
      const apiKey = env.GOOGLE_API_KEY || env.VITE_GOOGLE_API_KEY
      if (!apiKey) return new Response(JSON.stringify({ error: 'Google API key not configured' }), { status: 500 })

      const resp = await withTimeout(
        fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { maxOutputTokens: 500, temperature: 0.3 }
          })
        })
      )
      if (!resp.ok) {
        const t = await resp.text()
        return new Response(JSON.stringify({ error: `Gemini error ${resp.status}: ${t}` }), { status: 502 })
      }
      const data = await resp.json()
      content = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
    } else if (provider === 'Perplexity AI' || provider === 'Perplexity') {
      const apiKey = env.PERPLEXITY_API_KEY || env.VITE_PERPLEXITY_API_KEY
      if (!apiKey) return new Response(JSON.stringify({ error: 'Perplexity API key not configured' }), { status: 500 })

      const resp = await withTimeout(
        fetch('https://api.perplexity.ai/chat/completions', {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${apiKey}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'llama-3.1-sonar-small-128k-online',
            messages: [{ role: 'user', content: prompt }],
            max_tokens: 500,
            temperature: 0.3
          })
        })
      )
      if (!resp.ok) {
        const t = await resp.text()
        return new Response(JSON.stringify({ error: `Perplexity error ${resp.status}: ${t}` }), { status: 502 })
      }
      const data = await resp.json()
      content = data?.choices?.[0]?.message?.content || ''
    } else {
      return new Response(JSON.stringify({ error: `Unsupported provider: ${provider}` }), { status: 400 })
    }

    return new Response(JSON.stringify({ content }), { status: 200, headers: { 'Content-Type': 'application/json' } })
  } catch (err: any) {
    console.error('LLM API error:', err)
    return new Response(JSON.stringify({ error: err?.message || 'Unknown error' }), { status: 500 })
  }
}
