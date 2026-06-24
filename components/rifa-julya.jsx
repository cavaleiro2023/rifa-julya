"use client";

import { useState, useCallback, useMemo, useEffect } from "react";
import { createClient } from "@supabase/supabase-js";

// ── Supabase ──
const SUPABASE_URL     = process.env.NEXT_PUBLIC_SUPABASE_URL     || "https://umahniullotisfaqyllt.supabase.co";
const SUPABASE_ANON    = process.env.NEXT_PUBLIC_SUPABASE_ANON    || "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVtYWhuaXVsbG90aXNmYXF5bGx0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODIyNTA0NzcsImV4cCI6MjA5NzgyNjQ3N30.oMdDgxW_YEVFA_lgufT-Fi1Ed3sytVbKe4MkM9X2-Uw";
const supabase         = createClient(SUPABASE_URL, SUPABASE_ANON);

// ── Config ──
const WHATSAPP_NUMBER  = "5599991371300";
const TICKET_PRICE     = 20;
const GOAL_AMOUNT      = 20000;
const ADMIN_USER       = "admin";
const ADMIN_PASSWORD   = "@Julya311225";
const RESERVE_MINUTES  = 240;

const fmt = (n) => n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });

const statusColor = (s) => ({
  disponivel: { bg: "#16a34a", label: "Disponivel" },
  reservado:  { bg: "#d97706", label: "Reservado"  },
  vendido:    { bg: "#dc2626", label: "Vendido"    },
}[s] || { bg: "#6b7280", label: "?" });

function buildWhatsAppMsg(nome, telefone, sorted, obs) {
  const totalFmt = "R$ " + (sorted.length * TICKET_PRICE).toFixed(2).replace(".", ",");
  const qtd = sorted.length + (sorted.length > 1 ? " numeros" : " numero");
  var lines = [];
  lines.push("RIFA BENEFICENTE - JULYA");
  lines.push("Ola! Gostaria de reservar o(s) seguinte(s) numero(s) da rifa:");
  lines.push("");
  lines.push("Nome: " + nome);
  lines.push("Telefone: " + telefone);
  lines.push("Numero(s): " + sorted.join(", "));
  lines.push("Quantidade: " + qtd);
  lines.push("Valor Total: " + totalFmt);
  lines.push("Chave PIX para pagamento:");
  lines.push("julyafigueiredo2512@gmail.com");
  if (obs) lines.push("Obs: " + obs);
  lines.push("");
  lines.push("Aguardo a confirmacao da reserva e os dados para pagamento.");
  lines.push("Apos realizar o pagamento, por favor envie o comprovante.");
  lines.push("");
  lines.push("Desde ja, muito obrigada pela ajuda e colaboracao!");
  return lines.join("\n");
}

// ══════════════════════════════════════════════
//  MAIN APP
// ══════════════════════════════════════════════
export default function RifaJulya() {
  const [tickets, setTickets]       = useState({});
  const [loading, setLoading]       = useState(true);
  const [selected, setSelected]     = useState([]);
  const [filter, setFilter]         = useState("todos");
  const [search, setSearch]         = useState("");
  const [form, setForm]             = useState({ nome: "", telefone: "", obs: "", vendedor: "" });
  const [view, setView]             = useState("home");
  const [adminAuth, setAdminAuth]   = useState(false);
  const [adminUser, setAdminUser]   = useState("");
  const [adminPass, setAdminPass]   = useState("");
  const [adminSearch, setAdminSearch] = useState("");
  const [adminFilter, setAdminFilter] = useState("todos");
  const [purchases, setPurchases]   = useState([]);
  const [toast, setToast]           = useState(null);

  const showToast = (msg, type = "success") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 3500);
  };

  // ── Carregar bilhetes do Supabase ──
  const loadTickets = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("rifa_numeros")
      .select("*")
      .order("numero", { ascending: true });

    if (error) { showToast("Erro ao carregar bilhetes!", "error"); setLoading(false); return; }

    const map = {};
    data.forEach((t) => { map[t.numero] = t; });
    setTickets(map);

    // Montar lista de compras (vendidos e reservados com nome)
    const comp = data
      .filter((t) => (t.status === "vendido" || t.status === "reservado") && t.nome_cliente)
      .reduce((acc, t) => {
        const key = t.nome_cliente + "|" + t.telefone;
        if (!acc[key]) acc[key] = { nome_cliente: t.nome_cliente, telefone: t.telefone, vendedor: t.vendedor || null, numeros: [], status: t.status, criado_em: t.criado_em };
        acc[key].numeros.push(t.numero);
        return acc;
      }, {});
    setPurchases(Object.values(comp).slice(0, 20));
    setLoading(false);
  }, []);

  useEffect(() => { loadTickets(); }, [loadTickets]);

  // ── Realtime: atualiza bilhetes automaticamente ──
  useEffect(() => {
    const channel = supabase
      .channel("rifa_realtime")
      .on("postgres_changes", { event: "*", schema: "public", table: "rifa_numeros" }, (payload) => {
        const t = payload.new;
        if (t) setTickets((prev) => ({ ...prev, [t.numero]: t }));
      })
      .subscribe();
    return () => supabase.removeChannel(channel);
  }, []);

  // ── Liberar reservas expiradas ──
  useEffect(() => {
    const liberar = async () => {
      const expiry = new Date(Date.now() - RESERVE_MINUTES * 60 * 1000).toISOString();
      await supabase
        .from("rifa_numeros")
        .update({ status: "disponivel", nome_cliente: null, telefone: null, data_reserva: null })
        .eq("status", "reservado")
        .lt("data_reserva", expiry);
    };
    liberar();
    const interval = setInterval(liberar, 60 * 1000);
    return () => clearInterval(interval);
  }, []);

  const vendedoresSalvos = useMemo(() => {
    const set = new Set();
    Object.values(tickets).forEach((t) => { if (t.vendedor) set.add(t.vendedor); });
    return [...set].sort();
  }, [tickets]);

  const stats = useMemo(() => {
    const arr = Object.values(tickets);
    const vendidos    = arr.filter((t) => t.status === "vendido").length;
    const reservados  = arr.filter((t) => t.status === "reservado").length;
    const disponiveis = arr.filter((t) => t.status === "disponivel").length;
    return { vendidos, reservados, disponiveis, arrecadado: vendidos * TICKET_PRICE };
  }, [tickets]);

  const toggleTicket = useCallback((num) => {
    const t = tickets[num];
    if (!t) return;
    if (t.status === "vendido")   { showToast("Numero " + num + " ja esta vendido!", "error");   return; }
    if (t.status === "reservado") { showToast("Numero " + num + " ja esta reservado!", "error"); return; }
    setSelected((prev) => prev.includes(num) ? prev.filter((n) => n !== num) : [...prev, num]);
  }, [tickets]);

  const removeSelected = (num) => setSelected((prev) => prev.filter((n) => n !== num));

  const filteredTickets = useMemo(() => {
    let arr = Object.values(tickets);
    if (filter !== "todos") arr = arr.filter((t) => t.status === filter);
    if (search.trim()) arr = arr.filter((t) => String(t.numero).includes(search.trim()));
    return arr;
  }, [tickets, filter, search]);

  // ── Comprar: reserva no Supabase + abre WhatsApp ──
  const handleComprar = async () => {
    if (!form.nome.trim())     { showToast("Informe seu nome!", "error");     return; }
    if (!form.telefone.trim()) { showToast("Informe seu telefone!", "error"); return; }
    if (selected.length === 0) { showToast("Selecione pelo menos 1 numero!", "error"); return; }

    const sorted = [...selected].sort((a, b) => a - b);

    // Verificar se ainda estao disponiveis
    const { data: check } = await supabase
      .from("rifa_numeros")
      .select("numero, status")
      .in("numero", sorted);

    const indisponiveis = check.filter((t) => t.status !== "disponivel");
    if (indisponiveis.length > 0) {
      showToast("Numero(s) " + indisponiveis.map((t) => t.numero).join(", ") + " ja foram reservados!", "error");
      setSelected([]);
      return;
    }

    // Reservar no banco
    const { error } = await supabase
      .from("rifa_numeros")
      .update({
        status: "reservado",
        nome_cliente: form.nome,
        telefone: form.telefone,
        observacao: form.obs || null,
        vendedor: form.vendedor || null,
        data_reserva: new Date().toISOString(),
      })
      .in("numero", sorted)
      .eq("status", "disponivel");

    if (error) {
      // tenta sem vendedor se coluna ainda nao existe
      const { error: e2 } = await supabase
        .from("rifa_numeros")
        .update({ status: "reservado", nome_cliente: form.nome, telefone: form.telefone, observacao: form.obs || null, data_reserva: new Date().toISOString() })
        .in("numero", sorted).eq("status", "disponivel");
      if (e2) { showToast("Erro ao reservar. Tente novamente!", "error"); return; }
    }

    // Abrir WhatsApp — usando <a> programatico para funcionar no iOS Safari
    const texto = buildWhatsAppMsg(form.nome, form.telefone, sorted, form.obs);
    const msg   = encodeURIComponent(texto);
    const waUrl = "https://wa.me/" + WHATSAPP_NUMBER + "?text=" + msg;
    const link  = document.createElement("a");
    link.href   = waUrl;
    link.target = "_blank";
    link.rel    = "noopener noreferrer";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    setSelected([]);
    setForm({ nome: "", telefone: "", obs: "", vendedor: "" });
    showToast(sorted.length + (sorted.length > 1 ? " numeros reservados" : " numero reservado") + "! WhatsApp aberto.");
    loadTickets();
  };

  // ── Admin: alterar status (aceita numero unico ou array) ──
  const changeStatus = async (nums, newStatus, extra = {}) => {
    const lista = Array.isArray(nums) ? nums : [nums];
    const updates = { status: newStatus };
    if (newStatus === "disponivel") {
      updates.nome_cliente = null;
      updates.telefone = null;
      updates.observacao = null;
      updates.vendedor = null;
      updates.data_reserva = null;
      updates.data_pagamento = null;
    } else {
      if (extra.nome_cliente) updates.nome_cliente = extra.nome_cliente;
      if (extra.telefone)     updates.telefone     = extra.telefone;
      if (extra.vendedor)     updates.vendedor     = extra.vendedor;
      if (newStatus === "reservado") updates.data_reserva   = new Date().toISOString();
      if (newStatus === "vendido")   updates.data_pagamento = new Date().toISOString();
    }

    let { error } = await supabase.from("rifa_numeros").update(updates).in("numero", lista);
    if (error) {
      const fallback = { ...updates };
      delete fallback.vendedor;
      const { error: e2 } = await supabase.from("rifa_numeros").update(fallback).in("numero", lista);
      if (e2) { showToast("Erro ao atualizar! Verifique o banco.", "error"); return; }
    }
    const label = lista.length > 1 ? lista.length + " numeros" : "Numero " + lista[0];
    showToast(label + " -> " + newStatus);
    loadTickets();
  };

  const adminTickets = useMemo(() => {
    let arr = Object.values(tickets);
    if (adminFilter !== "todos") arr = arr.filter((t) => t.status === adminFilter);
    if (adminSearch.trim()) {
      const q = adminSearch.trim().toLowerCase();
      arr = arr.filter((t) =>
        String(t.numero).includes(q) ||
        (t.nome_cliente || "").toLowerCase().includes(q) ||
        (t.telefone || "").includes(q) ||
        (t.vendedor || "").toLowerCase().includes(q)
      );
    }
    return arr;
  }, [tickets, adminFilter, adminSearch]);

  const progress = Math.min(100, (stats.arrecadado / GOAL_AMOUNT) * 100);

  // ── Views ──
  if (view === "admin") {
    if (!adminAuth) {
      return (
        <AdminLogin
          user={adminUser} setUser={setAdminUser}
          pass={adminPass} setPass={setAdminPass}
          onLogin={() => {
            if (adminUser === ADMIN_USER && adminPass === ADMIN_PASSWORD) {
              setAdminAuth(true); showToast("Bem-vindo, admin!");
            } else {
              showToast("Login ou senha incorretos!", "error");
            }
          }}
          onBack={() => setView("home")}
          toast={toast}
        />
      );
    }
    return (
      <AdminPanel
        stats={stats} tickets={adminTickets} purchases={purchases}
        search={adminSearch} setSearch={setAdminSearch}
        filter={adminFilter} setFilter={setAdminFilter}
        onChangeStatus={changeStatus}
        onLogout={() => { setAdminAuth(false); setView("home"); }}
        onRefresh={loadTickets}
        toast={toast} fmt={fmt} progress={progress} goal={GOAL_AMOUNT}
      />
    );
  }

  return (
    <div style={{ minHeight: "100vh", background: "#0f0f13", color: "#f1f5f9", fontFamily: "'DM Sans','Segoe UI',sans-serif", paddingBottom: 120 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&family=Playfair+Display:wght@700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        .ticket-btn{border:none;cursor:pointer;border-radius:8px;font-size:11px;font-weight:600;transition:transform .12s,filter .12s;padding:0}
        .ticket-btn:hover{transform:scale(1.12);filter:brightness(1.15)}
        .ticket-btn:active{transform:scale(0.96)}
        .ticket-btn.selected{outline:3px solid #f472b6;outline-offset:2px;transform:scale(1.08)}
        .pill{display:inline-flex;align-items:center;gap:5px;padding:5px 12px;border-radius:999px;font-size:12px;font-weight:600;cursor:pointer;border:1.5px solid transparent;transition:all .15s}
        .pill.active{border-color:#f472b6;background:#2d1a24;color:#f472b6}
        .pill.inactive{border-color:#333;background:#1a1a22;color:#94a3b8}
        .pill:hover{border-color:#f472b6;color:#f472b6}
        input,textarea{background:#1a1a22;border:1.5px solid #2d2d3a;border-radius:10px;color:#f1f5f9;padding:12px 14px;font-size:15px;width:100%;outline:none;font-family:inherit;transition:border-color .15s}
        input:focus,textarea:focus{border-color:#f472b6}
        .buy-btn{background:linear-gradient(135deg,#ec4899,#be185d);color:white;border:none;border-radius:14px;padding:16px;font-size:16px;font-weight:700;width:100%;cursor:pointer;transition:transform .15s,filter .15s}
        .buy-btn:hover{filter:brightness(1.1);transform:translateY(-2px)}
        .buy-btn:active{transform:translateY(0) scale(0.98)}
        .toast{position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:9999;padding:12px 20px;border-radius:12px;font-weight:600;font-size:14px;white-space:nowrap;animation:slideDown .3s ease}
        @keyframes slideDown{from{opacity:0;transform:translateX(-50%) translateY(-10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
        .summary-bar{position:fixed;bottom:0;left:0;right:0;z-index:100;background:#13131a;border-top:1px solid #2d2d3a;padding:12px 16px}
        .tag{background:#1e1e2a;border:1px solid #2d2d3a;border-radius:8px;padding:4px 10px;font-size:12px;display:inline-flex;align-items:center;gap:6px;cursor:pointer;transition:background .15s}
        .tag:hover{background:#2d2d3a}
        .progress-track{background:#1e1e2a;border-radius:999px;height:10px;overflow:hidden}
        .progress-fill{height:100%;border-radius:999px;background:linear-gradient(90deg,#ec4899,#f472b6);transition:width .8s ease}
        .tickets-scroll-wrap{max-height:530px;overflow-y:scroll;border:1px solid #2d2d3a;border-radius:14px;padding:10px;background:#13131a;scrollbar-width:thick;scrollbar-color:#f472b6 #1e1e2a}
        .tickets-scroll-wrap::-webkit-scrollbar{width:12px}
        .tickets-scroll-wrap::-webkit-scrollbar-track{background:#1e1e2a;border-radius:999px}
        .tickets-scroll-wrap::-webkit-scrollbar-thumb{background:linear-gradient(180deg,#ec4899,#be185d);border-radius:999px;border:2px solid #1e1e2a}
        .tickets-scroll-wrap::-webkit-scrollbar-thumb:hover{background:linear-gradient(180deg,#f472b6,#ec4899)}
        .grid-tickets{display:grid;grid-template-columns:repeat(auto-fill,minmax(52px,1fr));gap:6px}
        @media(max-width:480px){.grid-tickets{grid-template-columns:repeat(auto-fill,minmax(46px,1fr));gap:5px}}
        select{background:#1a1a22;border:1.5px solid #2d2d3a;border-radius:10px;color:#f1f5f9;padding:10px 12px;font-size:14px;width:100%;outline:none;font-family:inherit}
        .skeleton{background:linear-gradient(90deg,#1a1a22 25%,#252530 50%,#1a1a22 75%);background-size:200% 100%;animation:shimmer 1.5s infinite;border-radius:8px}
        @keyframes shimmer{0%{background-position:200%}100%{background-position:-200%}}
        @keyframes pulse2{0%,100%{box-shadow:0 4px 20px rgba(236,72,153,.5)}50%{box-shadow:0 4px 28px rgba(236,72,153,.8)}}
      `}</style>

      {toast && (
        <div className="toast" style={{ background: toast.type === "error" ? "#7f1d1d" : "#14532d", color: toast.type === "error" ? "#fca5a5" : "#86efac" }}>
          {toast.type === "error" ? "X " : "OK "}{toast.msg}
        </div>
      )}

      {/* Header */}
      <div style={{ background: "linear-gradient(160deg,#1a0d1e 0%,#0f0f13 100%)", padding: "0 0 1px" }}>
        <div style={{ maxWidth: 680, margin: "0 auto", padding: "20px 16px 0" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
            <div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#f472b6", letterSpacing: 2, textTransform: "uppercase", marginBottom: 4 }}>Rifa Beneficente</div>
              <h1 style={{ fontFamily: "'Playfair Display',serif", fontSize: 28, fontWeight: 700, lineHeight: 1.2, color: "#f9fafb" }}>Ajude a Julya</h1>
              <p style={{ color: "#94a3b8", fontSize: 13, marginTop: 4 }}>Cirurgia &bull; 1.000 numeros &bull; R$ 20 cada</p>
            </div>
            <div style={{ width: 72, height: 72, borderRadius: "50%", background: "linear-gradient(135deg,#ec4899,#7c3aed)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, flexShrink: 0, border: "3px solid #2d1a3a" }}>
              ❤️
            </div>
          </div>

          {/* Progress */}
          <div style={{ background: "#13131a", border: "1px solid #2d2d3a", borderRadius: 16, padding: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <span style={{ fontSize: 13, color: "#94a3b8" }}>Arrecadado</span>
              <span style={{ fontSize: 13, fontWeight: 600, color: "#f472b6" }}>{progress.toFixed(1)}% da meta</span>
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: "#f9fafb", marginBottom: 10 }}>{fmt(stats.arrecadado)}</div>
            <div className="progress-track"><div className="progress-fill" style={{ width: progress + "%" }} /></div>
            <div style={{ fontSize: 12, color: "#64748b", marginTop: 6, textAlign: "right" }}>Meta: {fmt(GOAL_AMOUNT)}</div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10, marginTop: 14 }}>
              {[
                { label: "Vendidos",    val: stats.vendidos,    color: "#dc2626" },
                { label: "Reservados",  val: stats.reservados,  color: "#d97706" },
                { label: "Disponiveis", val: stats.disponiveis, color: "#16a34a" },
              ].map((s) => (
                <div key={s.label} style={{ textAlign: "center" }}>
                  <div style={{ fontSize: 20, fontWeight: 700, color: s.color }}>{s.val}</div>
                  <div style={{ fontSize: 11, color: "#64748b" }}>{s.label}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 12, marginBottom: 4, flexWrap: "wrap" }}>
            {[["#16a34a","Disponivel"],["#d97706","Reservado"],["#dc2626","Vendido"]].map(([c,l]) => (
              <div key={l} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "#94a3b8" }}>
                <div style={{ width: 12, height: 12, borderRadius: 3, background: c }} />{l}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Tickets */}
      <div style={{ maxWidth: 680, margin: "0 auto", padding: 16 }}>
        <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" }}>
          {["todos","disponivel","reservado","vendido"].map((f) => (
            <button key={f} className={"pill " + (filter === f ? "active" : "inactive")} onClick={() => setFilter(f)}>
              {f === "todos" ? "Todos" : statusColor(f).label}
            </button>
          ))}
        </div>

        <input placeholder="Buscar numero..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ marginBottom: 14, fontSize: 14 }} />

        {/* Skeleton loading */}
        {loading ? (
          <div className="tickets-scroll-wrap">
            <div className="grid-tickets">
              {Array.from({ length: 100 }).map((_, i) => (
                <div key={i} className="skeleton" style={{ height: 44 }} />
              ))}
            </div>
          </div>
        ) : (
          <div className="tickets-scroll-wrap">
            <div className="grid-tickets">
              {filteredTickets.map((t) => {
                const isSel = selected.includes(t.numero);
                const col   = statusColor(t.status);
                return (
                  <button
                    key={t.numero}
                    className={"ticket-btn" + (isSel ? " selected" : "")}
                    style={{ background: isSel ? "#f472b6" : col.bg, color: "white", height: 44, display: "flex", alignItems: "center", justifyContent: "center" }}
                    onClick={() => toggleTicket(t.numero)}
                    title={t.numero + " - " + col.label + (t.nome_cliente ? " - " + t.nome_cliente : "")}
                  >
                    {String(t.numero).padStart(3, "0")}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Form */}
        <div id="secao-compra" style={{ background: "#17171f", border: "1px solid #2d2d3a", borderRadius: 18, padding: 20, marginTop: 24 }}>
          <h2 style={{ fontSize: 18, fontWeight: 700, marginBottom: 16, color: "#f9fafb" }}>Seus Dados</h2>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <input placeholder="Nome completo *"       value={form.nome}     onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            <input placeholder="Telefone (WhatsApp) *" value={form.telefone} onChange={(e) => setForm({ ...form, telefone: e.target.value })} />
            <div>
              <input
                list="vendedores-home-list"
                placeholder="Vendedor (opcional)"
                value={form.vendedor}
                onChange={(e) => setForm({ ...form, vendedor: e.target.value })}
              />
              <datalist id="vendedores-home-list">
                {vendedoresSalvos.map((v) => <option key={v} value={v} />)}
              </datalist>
              {vendedoresSalvos.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                  {vendedoresSalvos.map((v) => (
                    <button
                      key={v}
                      type="button"
                      onClick={() => setForm({ ...form, vendedor: v })}
                      style={{ background: form.vendedor === v ? "#f472b622" : "#1e1e2a", border: "1px solid " + (form.vendedor === v ? "#f472b6" : "#2d2d3a"), borderRadius: 8, padding: "4px 10px", fontSize: 12, color: form.vendedor === v ? "#f472b6" : "#94a3b8", cursor: "pointer" }}
                    >
                      {v}
                    </button>
                  ))}
                </div>
              )}
            </div>
            <textarea placeholder="Observacao (opcional)" value={form.obs} onChange={(e) => setForm({ ...form, obs: e.target.value })} rows={2} style={{ resize: "none" }} />
          </div>

          {selected.length > 0 && (
            <div style={{ background: "#0f0f18", border: "1px solid #2d2d3a", borderRadius: 12, padding: 14, marginTop: 16 }}>
              <div style={{ fontSize: 13, color: "#94a3b8", marginBottom: 10 }}>Numeros selecionados:</div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 12 }}>
                {[...selected].sort((a,b) => a-b).map((n) => (
                  <button key={n} className="tag" onClick={() => removeSelected(n)} style={{ color: "#f472b6", borderColor: "#4d1f3a" }}>
                    {String(n).padStart(3,"0")} X
                  </button>
                ))}
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", paddingTop: 10, borderTop: "1px solid #2d2d3a" }}>
                <span style={{ color: "#94a3b8", fontSize: 14 }}>{selected.length} numero{selected.length > 1 ? "s" : ""}</span>
                <span style={{ fontWeight: 700, fontSize: 18, color: "#f472b6" }}>{fmt(selected.length * TICKET_PRICE)}</span>
              </div>
            </div>
          )}

          <button className="buy-btn" style={{ marginTop: 16 }} onClick={handleComprar}>
            Comprar via WhatsApp
          </button>
          <p style={{ fontSize: 12, color: "#64748b", textAlign: "center", marginTop: 10 }}>
            Apos clicar, voce sera redirecionado ao WhatsApp para confirmar.
          </p>
        </div>

        <div style={{ textAlign: "center", marginTop: 20 }}>
          <button onClick={() => setView("admin")} style={{ background: "none", border: "none", color: "#64748b", fontSize: 12, cursor: "pointer", textDecoration: "underline" }}>
            Area administrativa
          </button>
        </div>
      </div>

      {/* Botao flutuante Comprar Agora */}
      <button
        onClick={() => window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" })}
        style={{ position: "fixed", bottom: 24, right: 20, zIndex: 999, background: "linear-gradient(135deg,#ec4899,#be185d)", color: "white", border: "none", borderRadius: 30, padding: "14px 20px", fontSize: 14, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", gap: 7, whiteSpace: "nowrap", animation: "pulse2 2s infinite" }}
      >
        Comprar Agora
      </button>

      {/* Barra inferior quando ha selecao */}
      {selected.length > 0 && (
        <div className="summary-bar">
          <div style={{ maxWidth: 680, margin: "0 auto", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
            <div>
              <div style={{ fontSize: 12, color: "#94a3b8" }}>{selected.length} numero{selected.length > 1 ? "s" : ""} selecionado{selected.length > 1 ? "s" : ""}</div>
              <div style={{ fontSize: 20, fontWeight: 700, color: "#f472b6" }}>{fmt(selected.length * TICKET_PRICE)}</div>
            </div>
            <button className="buy-btn" style={{ width: "auto", padding: "12px 24px", fontSize: 15 }} onClick={handleComprar}>
              Comprar Agora
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════
//  ADMIN LOGIN
// ══════════════════════════════════════════════
function AdminLogin({ user, setUser, pass, setPass, onLogin, onBack, toast }) {
  return (
    <div style={{ minHeight: "100vh", background: "#0f0f13", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>
      <style>{`
        input{background:#1a1a22;border:1.5px solid #2d2d3a;border-radius:10px;color:#f1f5f9;padding:12px 14px;font-size:15px;width:100%;outline:none;font-family:inherit;transition:border-color .15s}
        input:focus{border-color:#f472b6}
        .lbl{font-size:11px;color:#94a3b8;text-align:left;display:block;margin-bottom:5px;font-weight:700;letter-spacing:.8px;text-transform:uppercase}
        .toast{position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:9999;padding:12px 20px;border-radius:12px;font-weight:600;font-size:14px;white-space:nowrap;animation:slideDown .3s ease}
        @keyframes slideDown{from{opacity:0;transform:translateX(-50%) translateY(-10px)}to{opacity:1;transform:translateX(-50%) translateY(0)}}
      `}</style>

      {toast && (
        <div className="toast" style={{ background: toast.type === "error" ? "#7f1d1d" : "#14532d", color: toast.type === "error" ? "#fca5a5" : "#86efac" }}>
          {toast.type === "error" ? "X " : "OK "}{toast.msg}
        </div>
      )}

      <div style={{ background: "#17171f", border: "1px solid #2d2d3a", borderRadius: 20, padding: 32, width: "100%", maxWidth: 360, textAlign: "center" }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🔐</div>
        <h2 style={{ color: "#f9fafb", fontSize: 22, fontWeight: 700, marginBottom: 6 }}>Painel Admin</h2>
        <p style={{ color: "#64748b", fontSize: 14, marginBottom: 24 }}>Acesso restrito ao organizador</p>

        <div style={{ textAlign: "left", marginBottom: 14 }}>
          <span className="lbl">Login</span>
          <input type="text" placeholder="Digite o login" value={user} onChange={(e) => setUser(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onLogin()} autoComplete="username" />
        </div>
        <div style={{ textAlign: "left", marginBottom: 22 }}>
          <span className="lbl">Senha</span>
          <input type="password" placeholder="Digite a senha" value={pass} onChange={(e) => setPass(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onLogin()} autoComplete="current-password" />
        </div>

        <button onClick={onLogin} style={{ background: "linear-gradient(135deg,#ec4899,#be185d)", color: "white", border: "none", borderRadius: 12, padding: "14px 0", fontSize: 15, fontWeight: 700, width: "100%", cursor: "pointer", marginBottom: 10 }}>
          Entrar
        </button>
        <button onClick={onBack} style={{ background: "none", border: "none", color: "#64748b", fontSize: 13, cursor: "pointer", textDecoration: "underline" }}>
          Voltar ao site
        </button>
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════
//  ADMIN PANEL
// ══════════════════════════════════════════════
function AdminPanel({ stats, tickets, purchases, search, setSearch, filter, setFilter, onChangeStatus, onLogout, onRefresh, toast, fmt, progress, goal }) {
  const sc = (s) => ({ disponivel: "#16a34a", reservado: "#d97706", vendido: "#dc2626" }[s] || "#888");

  const [modal, setModal]       = useState(null); // { numeros:[], newStatus }
  const [mForm, setMForm]       = useState({ nome: "", telefone: "", vendedor: "" });
  const [selNums, setSelNums]   = useState([]);   // numeros selecionados na tabela
  const [saving, setSaving]     = useState(false);

  // ── Vendedores e clientes conhecidos ──
  const vendedoresSalvos = useMemo(() => {
    const set = new Set();
    tickets.forEach((t) => { if (t.vendedor) set.add(t.vendedor); });
    return [...set].sort();
  }, [tickets]);

  const clientesPorTelefone = useMemo(() => {
    const map = {};
    tickets.forEach((t) => {
      if (t.telefone && t.nome_cliente && !map[t.telefone]) {
        map[t.telefone] = t.nome_cliente;
      }
    });
    return map;
  }, [tickets]);

  // ── Lookup automático ao digitar telefone ──
  const handleTelefoneChange = (val) => {
    const nome = clientesPorTelefone[val] || "";
    setMForm((f) => ({ ...f, telefone: val, nome: nome || f.nome }));
  };

  // ── Abrir modal (unico ou multiplo) ──
  const abrirModal = (numeros, newStatus) => {
    const lista = Array.isArray(numeros) ? numeros : [numeros];
    const primeiro = tickets.find((t) => t.numero === lista[0]);
    setMForm({
      nome:     primeiro?.nome_cliente || "",
      telefone: primeiro?.telefone     || "",
      vendedor: primeiro?.vendedor     || "",
    });
    setModal({ numeros: lista, newStatus });
  };

  // ── Confirmar modal ──
  const confirmarModal = async () => {
    if (!mForm.nome.trim())     { alert("Informe o nome do cliente."); return; }
    if (!mForm.telefone.trim()) { alert("Informe o telefone."); return; }
    if (!mForm.vendedor.trim()) { alert("Informe o vendedor."); return; }

    const { numeros, newStatus } = modal;

    // Avisa bilhetes ja vendidos em lote
    if (newStatus === "vendido" && numeros.length > 1) {
      const jaVendidos = tickets.filter((t) => numeros.includes(t.numero) && t.status === "vendido").map((t) => t.numero);
      if (jaVendidos.length > 0) {
        const continuar = window.confirm(jaVendidos.length + " bilhete(s) ja vendido(s): " + jaVendidos.join(", ") + ". Continuar apenas com os disponiveis?");
        if (!continuar) return;
        modal.numeros = numeros.filter((n) => !jaVendidos.includes(n));
        if (modal.numeros.length === 0) { setModal(null); return; }
      }
    }

    setSaving(true);
    await onChangeStatus(modal.numeros, modal.newStatus, {
      nome_cliente: mForm.nome.trim(),
      telefone:     mForm.telefone.trim(),
      vendedor:     mForm.vendedor.trim(),
    });
    setSaving(false);
    setSelNums([]);
    setModal(null);
  };

  // ── Checkboxes ──
  const visiveis      = tickets.slice(0, 100).map((t) => t.numero);
  const todosMarcados = visiveis.length > 0 && visiveis.every((n) => selNums.includes(n));

  const toggleSel = (num) => setSelNums((prev) => prev.includes(num) ? prev.filter((n) => n !== num) : [...prev, num]);
  const toggleTodos = () => setSelNums(todosMarcados ? [] : visiveis);

  return (
    <div style={{ minHeight: "100vh", background: "#0a0a10", color: "#f1f5f9", fontFamily: "'DM Sans','Segoe UI',sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        *{box-sizing:border-box;margin:0;padding:0}
        input,select{background:#1a1a22;border:1.5px solid #2d2d3a;border-radius:10px;color:#f1f5f9;padding:10px 12px;font-size:14px;width:100%;outline:none;font-family:inherit;transition:border-color .15s}
        input:focus,select:focus{border-color:#f472b6}
        table{width:100%;border-collapse:collapse}
        th{font-size:12px;color:#64748b;font-weight:600;text-align:left;padding:8px 12px;border-bottom:1px solid #2d2d3a;text-transform:uppercase;letter-spacing:.5px}
        td{padding:8px 12px;font-size:13px;border-bottom:1px solid #1e1e28}
        tr:hover td{background:#141420}
        tr.row-sel td{background:#1a0d1e}
        .spill{display:inline-flex;align-items:center;padding:3px 10px;border-radius:999px;font-size:11px;font-weight:700;white-space:nowrap}
        .admin-btn{border:none;border-radius:8px;padding:5px 10px;font-size:12px;font-weight:600;cursor:pointer;transition:filter .15s}
        .admin-btn:hover{filter:brightness(1.15)}
        .toast{position:fixed;top:20px;left:50%;transform:translateX(-50%);z-index:9999;padding:12px 20px;border-radius:12px;font-weight:600;font-size:14px;white-space:nowrap}
        input[type=checkbox]{width:16px;height:16px;cursor:pointer;accent-color:#f472b6}
        .chip-v{background:#f472b622;border:1px solid #f472b6;border-radius:8px;padding:3px 10px;font-size:12px;color:#f472b6;cursor:pointer}
        .chip-v:hover{background:#f472b644}
      `}</style>

      {toast && (
        <div className="toast" style={{ background: toast.type === "error" ? "#7f1d1d" : "#14532d", color: toast.type === "error" ? "#fca5a5" : "#86efac" }}>
          {toast.msg}
        </div>
      )}

      {/* ── Modal ── */}
      {modal && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.75)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center", padding: 20 }}>
          <div style={{ background: "#17171f", border: "1px solid #2d2d3a", borderRadius: 18, padding: 24, width: "100%", maxWidth: 440, maxHeight: "90vh", overflowY: "auto" }}>

            <h3 style={{ color: "#f9fafb", fontSize: 17, fontWeight: 700, marginBottom: 4 }}>
              {modal.newStatus === "vendido" ? "Marcar como Vendido" : "Reservar"}
            </h3>
            <p style={{ color: "#64748b", fontSize: 13, marginBottom: 6 }}>
              {modal.numeros.length === 1
                ? "Bilhete #" + String(modal.numeros[0]).padStart(3,"0")
                : modal.numeros.length + " bilhetes selecionados: " + [...modal.numeros].sort((a,b)=>a-b).map((n)=>String(n).padStart(3,"0")).join(", ")}
            </p>

            <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

              {/* Telefone primeiro para lookup automático */}
              <div>
                <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, letterSpacing: .8, textTransform: "uppercase", marginBottom: 5 }}>Telefone *</div>
                <input
                  list="telefones-list"
                  value={mForm.telefone}
                  onChange={(e) => handleTelefoneChange(e.target.value)}
                  placeholder="(00) 00000-0000"
                />
                <datalist id="telefones-list">
                  {Object.keys(clientesPorTelefone).map((tel) => <option key={tel} value={tel} label={clientesPorTelefone[tel]} />)}
                </datalist>
                {clientesPorTelefone[mForm.telefone] && (
                  <div style={{ fontSize: 12, color: "#4ade80", marginTop: 5 }}>
                    ✓ Cliente encontrado: {clientesPorTelefone[mForm.telefone]}
                  </div>
                )}
              </div>

              <div>
                <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, letterSpacing: .8, textTransform: "uppercase", marginBottom: 5 }}>Nome do Cliente *</div>
                <input value={mForm.nome} onChange={(e) => setMForm({ ...mForm, nome: e.target.value })} placeholder="Nome completo" />
              </div>

              <div>
                <div style={{ fontSize: 11, color: "#94a3b8", fontWeight: 700, letterSpacing: .8, textTransform: "uppercase", marginBottom: 5 }}>Vendedor *</div>
                <input
                  list="vendedores-list"
                  value={mForm.vendedor}
                  onChange={(e) => setMForm({ ...mForm, vendedor: e.target.value })}
                  placeholder="Digite ou selecione um vendedor"
                />
                <datalist id="vendedores-list">
                  {vendedoresSalvos.map((v) => <option key={v} value={v} />)}
                </datalist>
                {vendedoresSalvos.length > 0 && (
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                    {vendedoresSalvos.map((v) => (
                      <button key={v} className="chip-v"
                        style={{ background: mForm.vendedor === v ? "#f472b644" : "#f472b622", fontWeight: mForm.vendedor === v ? 700 : 400 }}
                        onClick={() => setMForm({ ...mForm, vendedor: v })}>
                        {v}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div style={{ display: "flex", gap: 10, marginTop: 22 }}>
              <button
                onClick={confirmarModal}
                disabled={saving}
                style={{ flex: 1, background: modal.newStatus === "vendido" ? "linear-gradient(135deg,#dc2626,#991b1b)" : "linear-gradient(135deg,#d97706,#92400e)", color: "white", border: "none", borderRadius: 12, padding: "13px 0", fontSize: 14, fontWeight: 700, cursor: saving ? "not-allowed" : "pointer", opacity: saving ? .7 : 1 }}
              >
                {saving ? "Salvando..." : "Confirmar " + (modal.newStatus === "vendido" ? "Venda" : "Reserva") + (modal.numeros.length > 1 ? " (" + modal.numeros.length + ")" : "")}
              </button>
              <button onClick={() => setModal(null)} style={{ background: "#1e1e2a", border: "1px solid #2d2d3a", borderRadius: 12, padding: "13px 18px", fontSize: 14, color: "#94a3b8", cursor: "pointer" }}>
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Header */}
      <div style={{ background: "#13131c", borderBottom: "1px solid #2d2d3a", padding: "16px 20px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 11, color: "#f472b6", fontWeight: 600, letterSpacing: 1.5, textTransform: "uppercase" }}>Painel Admin</div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: "#f9fafb" }}>Rifa da Julya</h1>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={onRefresh} style={{ background: "#1e1e2a", border: "1px solid #2d2d3a", borderRadius: 10, padding: "8px 14px", color: "#94a3b8", fontSize: 13, cursor: "pointer" }}>Atualizar</button>
          <button onClick={onLogout}  style={{ background: "#1e1e2a", border: "1px solid #2d2d3a", borderRadius: 10, padding: "8px 14px", color: "#94a3b8", fontSize: 13, cursor: "pointer" }}>Sair</button>
        </div>
      </div>

      <div style={{ maxWidth: 960, margin: "0 auto", padding: 20 }}>

        {/* Stats */}
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(140px,1fr))", gap: 12, marginBottom: 24 }}>
          {[
            { label: "Arrecadado",  val: fmt(stats.arrecadado), color: "#f472b6" },
            { label: "Vendidos",    val: stats.vendidos,         color: "#dc2626" },
            { label: "Reservados",  val: stats.reservados,       color: "#d97706" },
            { label: "Disponiveis", val: stats.disponiveis,      color: "#16a34a" },
          ].map((s) => (
            <div key={s.label} style={{ background: "#13131c", border: "1px solid #2d2d3a", borderRadius: 14, padding: "14px 16px" }}>
              <div style={{ fontSize: 11, color: "#64748b", marginBottom: 4, textTransform: "uppercase", letterSpacing: .5 }}>{s.label}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: s.color }}>{s.val}</div>
            </div>
          ))}
        </div>

        {/* Progress */}
        <div style={{ background: "#13131c", border: "1px solid #2d2d3a", borderRadius: 14, padding: 16, marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <span style={{ fontSize: 14, color: "#94a3b8" }}>Progresso da meta</span>
            <span style={{ fontSize: 14, fontWeight: 600, color: "#f472b6" }}>{progress.toFixed(1)}%</span>
          </div>
          <div style={{ background: "#1e1e2a", borderRadius: 999, height: 8, overflow: "hidden" }}>
            <div style={{ height: "100%", borderRadius: 999, background: "linear-gradient(90deg,#ec4899,#f472b6)", width: progress + "%", transition: "width .8s ease" }} />
          </div>
          <div style={{ fontSize: 12, color: "#64748b", marginTop: 6, textAlign: "right" }}>Meta: {fmt(goal)}</div>
        </div>

        {/* Filtros */}
        <div style={{ display: "flex", gap: 10, marginBottom: 14, flexWrap: "wrap" }}>
          <input placeholder="Buscar numero, nome, telefone ou vendedor..." value={search} onChange={(e) => setSearch(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
          <select value={filter} onChange={(e) => setFilter(e.target.value)} style={{ width: "auto", minWidth: 140 }}>
            <option value="todos">Todos os status</option>
            <option value="disponivel">Disponiveis</option>
            <option value="reservado">Reservados</option>
            <option value="vendido">Vendidos</option>
          </select>
        </div>

        {/* Barra de acao em lote */}
        {selNums.length > 0 && (
          <div style={{ background: "#1a0d2e", border: "1px solid #f472b644", borderRadius: 12, padding: "12px 16px", marginBottom: 14, display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap" }}>
            <span style={{ fontSize: 13, color: "#f472b6", fontWeight: 600 }}>{selNums.length} bilhete{selNums.length > 1 ? "s" : ""} selecionado{selNums.length > 1 ? "s" : ""}</span>
            <button className="admin-btn" style={{ background: "#14532d22", color: "#86efac", border: "1px solid #14532d" }} onClick={() => abrirModal(selNums, "vendido")}>Vender todos</button>
            <button className="admin-btn" style={{ background: "#78350f22", color: "#fcd34d", border: "1px solid #78350f" }} onClick={() => abrirModal(selNums, "reservado")}>Reservar todos</button>
            <button className="admin-btn" style={{ background: "#1e293b", color: "#94a3b8", border: "1px solid #2d2d3a" }} onClick={() => { onChangeStatus(selNums, "disponivel"); setSelNums([]); }}>Liberar todos</button>
            <button style={{ marginLeft: "auto", background: "none", border: "none", color: "#64748b", fontSize: 13, cursor: "pointer" }} onClick={() => setSelNums([])}>Limpar seleção</button>
          </div>
        )}

        {/* Tabela bilhetes */}
        <div style={{ background: "#13131c", border: "1px solid #2d2d3a", borderRadius: 14, overflow: "hidden", marginBottom: 24 }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid #2d2d3a", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>Gerenciar Numeros</h2>
            <span style={{ fontSize: 12, color: "#64748b" }}>{tickets.length} resultado{tickets.length !== 1 ? "s" : ""}</span>
          </div>
          <div style={{ overflowX: "auto" }}>
            <table>
              <thead>
                <tr>
                  <th style={{ width: 36 }}><input type="checkbox" checked={todosMarcados} onChange={toggleTodos} title="Selecionar todos visíveis" /></th>
                  <th>#</th><th>Status</th><th>Cliente</th><th>Telefone</th><th>Vendedor</th><th>Acoes</th>
                </tr>
              </thead>
              <tbody>
                {tickets.slice(0, 100).map((t) => {
                  const sel = selNums.includes(t.numero);
                  return (
                    <tr key={t.numero} className={sel ? "row-sel" : ""}>
                      <td><input type="checkbox" checked={sel} onChange={() => toggleSel(t.numero)} /></td>
                      <td style={{ fontWeight: 700, color: "#f9fafb" }}>{String(t.numero).padStart(3,"0")}</td>
                      <td>
                        <span className="spill" style={{ background: sc(t.status) + "22", color: sc(t.status), border: "1px solid " + sc(t.status) + "44" }}>
                          {t.status}
                        </span>
                      </td>
                      <td style={{ color: "#94a3b8" }}>{t.nome_cliente || "-"}</td>
                      <td style={{ color: "#94a3b8" }}>{t.telefone || "-"}</td>
                      <td style={{ color: "#f472b6", fontWeight: 600 }}>{t.vendedor || "-"}</td>
                      <td>
                        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                          {t.status !== "vendido"    && <button className="admin-btn" style={{ background: "#14532d22", color: "#86efac", border: "1px solid #14532d" }} onClick={() => abrirModal(t.numero, "vendido")}>Vendido</button>}
                          {t.status !== "reservado"  && <button className="admin-btn" style={{ background: "#78350f22", color: "#fcd34d", border: "1px solid #78350f" }} onClick={() => abrirModal(t.numero, "reservado")}>Reservar</button>}
                          {t.status !== "disponivel" && <button className="admin-btn" style={{ background: "#1e293b",   color: "#94a3b8", border: "1px solid #2d2d3a" }} onClick={() => onChangeStatus(t.numero, "disponivel")}>Liberar</button>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {tickets.length > 100 && (
              <div style={{ padding: "12px 16px", color: "#64748b", fontSize: 12, textAlign: "center" }}>
                Mostrando 100 de {tickets.length}. Use a busca para filtrar.
              </div>
            )}
          </div>
        </div>

        {/* Compradores */}
        <div style={{ background: "#13131c", border: "1px solid #2d2d3a", borderRadius: 14, overflow: "hidden" }}>
          <div style={{ padding: "14px 16px", borderBottom: "1px solid #2d2d3a" }}>
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>Compradores</h2>
          </div>
          {purchases.length === 0 ? (
            <div style={{ padding: 24, textAlign: "center", color: "#64748b", fontSize: 14 }}>Nenhuma compra registrada ainda.</div>
          ) : (
            <table>
              <thead><tr><th>Cliente</th><th>Telefone</th><th>Vendedor</th><th>Numeros</th><th>Qtd</th><th>Valor</th><th>Status</th></tr></thead>
              <tbody>
                {purchases.map((p, i) => (
                  <tr key={i}>
                    <td style={{ fontWeight: 600, color: "#f9fafb" }}>{p.nome_cliente}</td>
                    <td style={{ color: "#94a3b8" }}>{p.telefone}</td>
                    <td style={{ color: "#f472b6", fontWeight: 600 }}>{p.vendedor || "-"}</td>
                    <td style={{ color: "#94a3b8", maxWidth: 120, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{p.numeros.sort((a,b)=>a-b).join(", ")}</td>
                    <td style={{ color: "#94a3b8" }}>{p.numeros.length}</td>
                    <td style={{ fontWeight: 700, color: "#f472b6" }}>R$ {(p.numeros.length * TICKET_PRICE).toFixed(2).replace(".",",")}</td>
                    <td>
                      <span style={{ display: "inline-flex", padding: "2px 8px", borderRadius: 999, fontSize: 11, fontWeight: 700, background: (p.status === "vendido" ? "#dc262622" : "#d9770622"), color: (p.status === "vendido" ? "#dc2626" : "#d97706"), border: "1px solid " + (p.status === "vendido" ? "#dc262644" : "#d9770644") }}>
                        {p.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

      </div>
    </div>
  );
}
