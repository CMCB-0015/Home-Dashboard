import { useEffect, useRef, useState } from 'react'

/** Home Assistant's raw stream errors ("webrtc: streams: exec/rtsp … 404") → plain words; the raw text goes to the console */
function friendly(msg: string | null): string | null {
  if (!msg) return msg
  if (/webrtc|ffmpeg|rtsp|DESCRIBE|exec\/|Error opening/i.test(msg)) {
    console.warn('[live view]', msg)
    return 'The camera’s video stream didn’t start.'
  }
  return msg
}

export type LivePhase = 'connecting' | 'live' | 'error' | 'ended'

async function api<T>(path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api/cameras/live/${path}`, body === undefined ? undefined : {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body), keepalive: true,
  })
  const json = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(json.error ?? 'Live view didn’t start')
  return json as T
}

/**
 * One camera's live video over WebRTC, set up through Panel's server (which
 * relays to Home Assistant). Streams only while mounted: unmounting, switching
 * camera or the screen going to the background ends the stream.
 */
export function useLiveStream(camera: string, attempt: number) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const [phase, setPhase] = useState<LivePhase>('connecting')
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let stopped = false
    let session: string | null = null
    const early: RTCIceCandidateInit[] = []
    setPhase('connecting'); setError(null)
    const pc = new RTCPeerConnection()

    const fail = (msg: string) => { if (!stopped) { setError(friendly(msg)); setPhase('error') } }

    // Video only: live view plays muted, and asking for audio makes Home Assistant
    // start a sound converter (camera AAC → Opus) that failed on the Slate (404)
    pc.addTransceiver('video', { direction: 'recvonly' })
    pc.ontrack = (e) => {
      const v = videoRef.current
      if (v && e.streams[0] && v.srcObject !== e.streams[0]) v.srcObject = e.streams[0]
    }
    pc.onicecandidate = (e) => {
      if (!e.candidate) return
      const c = e.candidate.toJSON()
      if (session) void api('candidate', { id: session, candidate: c }).catch(() => {})
      else early.push(c)
    }
    pc.onconnectionstatechange = () => {
      if (pc.connectionState === 'failed') fail('The video connection dropped. Tap Try again.')
    }

    ;(async () => {
      try {
        const ice = await api<{ iceServers: RTCIceServer[] }>(`ice?camera=${encodeURIComponent(camera)}`).catch(() => ({ iceServers: [] }))
        if (ice.iceServers.length) pc.setConfiguration({ iceServers: ice.iceServers })
        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)
        const r = await api<{ id: string; answer: string | null; candidates: RTCIceCandidateInit[]; error: string | null }>('start', { camera, offer: offer.sdp })
        session = r.id
        if (stopped) { void api('stop', { id: r.id }).catch(() => {}); return }
        if (!r.answer) return fail(r.error ?? 'The camera didn’t answer. Try again.')
        try { await pc.setRemoteDescription({ type: 'answer', sdp: r.answer }) } catch { return fail('Home Assistant’s video answer wasn’t usable. Try again.') }
        for (const c of r.candidates) await pc.addIceCandidate(c).catch(() => {})
        for (const c of early.splice(0)) void api('candidate', { id: r.id, candidate: c }).catch(() => {})
        // Keep listening for Home Assistant's routes; this also tells the server the screen is still here
        while (!stopped) {
          const p = await api<{ candidates: RTCIceCandidateInit[]; ended: boolean; error: string | null }>(`poll?id=${r.id}`)
          for (const c of p.candidates) await pc.addIceCandidate(c).catch(() => {})
          if (p.ended) {
            if (!stopped) { setError(friendly(p.error)); setPhase(p.error ? 'error' : 'ended') }
            break
          }
        }
      } catch (e) {
        fail(e instanceof TypeError ? 'Live view needs the dashboard server (it isn’t reachable).' : e instanceof Error ? e.message : 'Live view didn’t start')
      }
    })()

    const v = videoRef.current
    const playing = () => { if (!stopped) setPhase('live') }
    v?.addEventListener('playing', playing)

    return () => {
      stopped = true
      v?.removeEventListener('playing', playing)
      if (session) void api('stop', { id: session }).catch(() => {})
      pc.close()
      if (v) v.srcObject = null
    }
  }, [camera, attempt])

  return { videoRef, phase, error }
}
