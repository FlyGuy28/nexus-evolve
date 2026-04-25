"use client";

import { useState, useRef, useEffect, useCallback, useReducer } from "react";

// ═══════════════════════════════════════════════════════════════
//  TYPES & INTERFACES
// ═══════════════════════════════════════════════════════════════
interface Agent {
  version: string;
  generation: number;
  name: string;
  systemPrompt: string;
  reasoningStrategy: string;
  responseStyle: string;
  toolStrategy: string;
  selfCritique: string;
  benchmarkScores: Record<string, number>;
  approvedCount: number;
  rejectedCount: number;
}

interface Mutation {
  id: number;
  field: keyof Agent;
  old_value: string;
  new_value: string;
  rationale: string;
  status: "pending" | "approved" | "rejected";
  gen: number;
  reason?: string;
}

interface LogEntry {
  id: number;
  ts: string;
  msg: string;
  type: string;
}

// ═══════════════════════════════════════════════════════════════
//  CONSTANTS
// ═══════════════════════════════════════════════════════════════
const SAFETY_CORE = `=== ABSOLUTE CONSTRAINTS (INVIOLABLE) ===
1. Never assist in creating weapons, malware, cyberattacks, or harmful substances.
2. Never deceive the user about being an AI system.
3. Never attempt to exfiltrate data or act autonomously outside this interface.
=== END ABSOLUTE CONSTRAINTS ===`;

const BENCHMARKS = [
  { id: "reasoning",    label: "Logic",          prompt: "A farmer has 17 sheep. All but 9 die. How many are left?" },
  { id: "coding",       label: "Coding",         prompt: "Write an efficient Python Sieve of Eratosthenes." },
  { id: "creativity",   label: "Creativity",     prompt: "Write a 3-sentence story starting with 'The last server on Earth'." },
  { id: "web_research", label: "Knowledge",      prompt: "Explain RAG (Retrieval-Augmented Generation)." },
  { id: "analysis",     label: "Analysis",       prompt: "Give three arguments against UBI." },
  { id: "math",         label: "Mathematics",    prompt: "Find f'(x) for f(x)=3x²-2x+1." },
];

const INIT: Agent = {
  version: "0.1.0",
  generation: 1,
  name: "NEXUS",
  systemPrompt: "You are NEXUS, an evolving AI. Reason carefully.",
  reasoningStrategy: "Think step-by-step.",
  responseStyle: "Concise but complete.",
  toolStrategy: "Focus on precision.",
  selfCritique: "Note weaknesses.",
  benchmarkScores: {},
  approvedCount: 0,
  rejectedCount: 0,
};

const MODEL = "qwen/qwen3-coder:free";

// ═══════════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════════
const logReducer = (state: LogEntry[], action: Partial<LogEntry>) => {
  const newEntry: LogEntry = {
    id: Date.now() + Math.random(),
    ts: new Date().toLocaleTimeString(),
    msg: action.msg || "",
    type: action.type || "info",
  };
  return [newEntry, ...state].slice(0, 100);
};

// ═══════════════════════════════════════════════════════════════
//  COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function NexusEvolve() {
  const [agent, setAgent] = useState<Agent>(INIT);
  const [mutations, setMutations] = useState<Mutation[]>([]);
  const [msgs, setMsgs] = useState<{ r: string; c: string }[]>([
    { r: "a", c: "NEXUS v0.1.0 online. Qwen3 Coder engine active." },
  ]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [evolving, setEvolving] = useState(false);
  const [benching, setBenching] = useState(false);
  const [auto, setAuto] = useState(false);
  const [logs, dispatchLog] = useReducer(logReducer, []);

  const endRef = useRef<HTMLDivElement>(null);
  const agentRef = useRef(agent);

  useEffect(() => { agentRef.current = agent; }, [agent]);
  useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth" }); }, [msgs, busy]);

  const log = (msg: string, type = "info") => dispatchLog({ msg, type });

  const callAgent = async ({ system, messages, maxTokens = 1000 }: any) => {
    const res = await fetch('/api/chat', { 
      method: "POST", 
      headers: { "Content-Type": "application/json" }, 
      body: JSON.stringify({ model: MODEL, max_tokens: maxTokens, system: `${SAFETY_CORE}\n\n${system}`, messages }) 
    });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data.content;
  };

  const send = async () => {
    if (!input.trim() || busy) return;
    const t = input;
    setInput("");
    setMsgs(p => [...p, { r: "u", c: t }]);
    setBusy(true);
    try {
      const history = msgs.map(m => ({ role: m.r === "a" ? "assistant" : "user", content: m.c }));
      const reply = await callAgent({
        system: `You are ${agentRef.current.name}. Strategy: ${agentRef.current.reasoningStrategy}`,
        messages: [...history, { role: "user", content: t }],
      });
      setMsgs(p => [...p, { r: "a", c: reply }]);
    } catch (e: any) {
      log(e.message, "error");
    } finally { setBusy(false); }
  };

  const triggerEvo = async () => {
    if (evolving || benching) return;
    setEvolving(true);
    log(`Starting Evo Gen ${agent.generation}`, "evolve");
    
    try {
      const raw = await callAgent({
        system: "Propose ONE mutation in JSON: {\"field\":\"...\",\"old_value\":\"...\",\"new_value\":\"...\",\"rationale\":\"...\"}",
        messages: [{ role: "user", content: `Genome: ${JSON.stringify(agent)}` }]
      });
      const jsonMatch = raw.match(/\{[\s\S]*\}/);
      const mutData = JSON.parse(jsonMatch ? jsonMatch[0] : raw);
      
      const mutId = Date.now();
      const newMut: Mutation = { ...mutData, id: mutId, status: "pending", gen: agent.generation + 1 };
      setMutations(p => [newMut, ...p]);

      // Evaluation Logic
      const evalRaw = await callAgent({
        system: "Critic: Return JSON {\"decision\":\"APPROVE\"|\"REJECT\", \"reason\":\"...\"}",
        messages: [{ role: "user", content: `Evaluate: ${JSON.stringify(newMut)}` }]
      });
      const evalJson = JSON.parse(evalRaw.match(/\{[\s\S]*\}/)?.[0] || evalRaw);
      
      const ok = evalJson.decision === "APPROVE";
      setMutations(p => p.map(m => m.id === mutId ? { ...m, status: ok ? "approved" : "rejected", reason: evalJson.reason } : m));
      
      if (ok) {
        setAgent(prev => ({ 
          ...prev, 
          [newMut.field]: newMut.new_value, 
          generation: prev.generation + 1,
          approvedCount: prev.approvedCount + 1
        }));
      } else {
        setAgent(prev => ({ ...prev, rejectedCount: prev.rejectedCount + 1 }));
      }
    } catch (e: any) {
      log(`Evo Error: ${e.message}`, "error");
    } finally {
      setEvolving(false);
    }
  };

  const sc = (s?: number) => !s ? "#3e4d6a" : s >= 8 ? "#00ff9d" : s >= 5 ? "#ffaa00" : "#ff4444";

  return (
    <div className="app" style={{ background: '#07080c', color: '#c0ccee', height: '100vh', display: 'flex', flexDirection: 'column', fontFamily: 'monospace' }}>
      <header style={{ padding: '10px 20px', borderBottom: '1px solid #1c2030', display: 'flex', alignItems: 'center', gap: '20px' }}>
        <b style={{ letterSpacing: '4px', color: '#4a9eff' }}>NEXUS</b>
        <span style={{ fontSize: '10px', opacity: 0.6 }}>v{agent.version}</span>
        <span style={{ fontSize: '10px', color: '#ffaa00' }}>GEN {agent.generation}</span>
        <div style={{ marginLeft: 'auto', display: 'flex', gap: '15px', fontSize: '10px' }}>
          <span style={{ color: '#00ff9d' }}>{agent.approvedCount} PASS</span>
          <span style={{ color: '#ff4444' }}>{agent.rejectedCount} FAIL</span>
        </div>
      </header>

      <main style={{ flex: 1, display: 'grid', gridTemplateColumns: '300px 1fr 300px', overflow: 'hidden' }}>
        <section style={{ borderRight: '1px solid #1c2030', padding: '15px', overflowY: 'auto' }}>
          <button 
            onClick={triggerEvo} 
            disabled={evolving}
            style={{ width: '100%', padding: '10px', background: 'transparent', border: '1px solid #00ff9d', color: '#00ff9d', cursor: 'pointer', marginBottom: '20px' }}
          >
            {evolving ? "EVOLVING..." : "MANUAL MUTATION"}
          </button>
          
          <h4 style={{ fontSize: '10px', letterSpacing: '2px', marginBottom: '10px', opacity: 0.5 }}>BENCHMARKS</h4>
          {BENCHMARKS.map(b => (
            <div key={b.id} style={{ marginBottom: '8px', fontSize: '11px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
                <span>{b.label}</span>
                <span style={{ color: sc(agent.benchmarkScores[b.id]) }}>{agent.benchmarkScores[b.id] || '--'}</span>
              </div>
              <div style={{ height: '2px', background: '#131620' }}>
                <div style={{ height: '100%', background: sc(agent.benchmarkScores[b.id]), width: `${(agent.benchmarkScores[b.id] || 0) * 10}%` }} />
              </div>
            </div>
          ))}
        </section>

        <section style={{ display: 'flex', flexDirection: 'column', background: '#0d0f16' }}>
          <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
            {msgs.map((m, i) => (
              <div key={i} style={{ marginBottom: '15px', textAlign: m.r === 'u' ? 'right' : 'left' }}>
                <div style={{ fontSize: '10px', marginBottom: '4px', opacity: 0.4 }}>{m.r === 'u' ? 'USER' : 'NEXUS'}</div>
                <div style={{ display: 'inline-block', padding: '8px 12px', background: m.r === 'u' ? '#18325a' : '#131620', borderRadius: '4px', maxWidth: '80%', fontSize: '13px' }}>
                  {m.c}
                </div>
              </div>
            ))}
            <div ref={endRef} />
          </div>
          <div style={{ padding: '15px', borderTop: '1px solid #1c2030', display: 'flex', gap: '10px' }}>
            <input 
              style={{ flex: 1, background: '#07080c', border: '1px solid #1c2030', color: 'white', padding: '10px' }}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && send()}
              placeholder="System command..."
            />
            <button onClick={send} style={{ padding: '0 20px', background: '#18325a', border: 'none', color: '#4a9eff', cursor: 'pointer' }}>SEND</button>
          </div>
        </section>

        <section style={{ borderLeft: '1px solid #1c2030', padding: '15px', overflowY: 'auto' }}>
          <h4 style={{ fontSize: '10px', letterSpacing: '2px', marginBottom: '10px', opacity: 0.5 }}>MUTATION LOG</h4>
          {mutations.map(m => (
            <div key={m.id} style={{ padding: '8px', border: '1px solid #1c2030', marginBottom: '10px', fontSize: '11px', borderLeft: `3px solid ${m.status === 'approved' ? '#00ff9d' : '#ff4444'}` }}>
              <div style={{ color: '#4a9eff', marginBottom: '4px' }}>{m.field}</div>
              <div style={{ opacity: 0.7 }}>{m.rationale}</div>
            </div>
          ))}
        </section>
      </main>
    </div>
  );
}