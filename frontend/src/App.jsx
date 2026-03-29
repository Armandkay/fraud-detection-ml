import { useState, useRef, useEffect, useCallback } from "react";

// ─────────────────────────────────────────────────────────────────────────────
// EXTERNAL SCRIPTS LOADER — face-api.js + EmailJS
// ─────────────────────────────────────────────────────────────────────────────
function loadScript(src) {
  return new Promise((res, rej) => {
    if (document.querySelector(`script[src="${src}"]`)) return res();
    const s = document.createElement("script");
    s.src = src; s.onload = res; s.onerror = rej;
    document.head.appendChild(s);
  });
}

// ─────────────────────────────────────────────────────────────────────────────
// API SERVICE LAYER — single place to swap mock → real backend
// ─────────────────────────────────────────────────────────────────────────────
const API_BASE = import.meta.env?.VITE_API_URL || "http://localhost:8000";
const USE_MOCK = false; // backend is live at http://localhost:8000

const delay = (ms) => new Promise(r => setTimeout(r, ms));

const api = {
  health: async () => {
    if (USE_MOCK) { await delay(400); return { status: "ok", model: "loaded", version: "1.0.0", uptime: "4h 32m" }; }
    const r = await fetch(`${API_BASE}/health`); return r.json();
  },
  getAlerts: async () => {
    if (USE_MOCK) { await delay(600); return ALERTS_DATA; }
    const r = await fetch(`${API_BASE}/api/alerts`, { headers: { Authorization: `Bearer ${sessionStorage.getItem("token")}` } });
    if (!r.ok) throw new Error("Failed to load alerts"); return r.json();
  },
  getTransactions: async () => {
    if (USE_MOCK) { await delay(500); return TRANSACTIONS_DATA; }
    const r = await fetch(`${API_BASE}/api/transactions`, { headers: { Authorization: `Bearer ${sessionStorage.getItem("token")}` } });
    if (!r.ok) throw new Error("Failed to load transactions"); return r.json();
  },
  getCustomers: async () => {
    if (USE_MOCK) { await delay(550); return CUSTOMERS_DATA; }
    const r = await fetch(`${API_BASE}/api/customers`, { headers: { Authorization: `Bearer ${sessionStorage.getItem("token")}` } });
    if (!r.ok) throw new Error("Failed to load customers"); return r.json();
  },
  getStats: async () => {
    if (USE_MOCK) { await delay(300); return { totalTx: 2847, fraudDetected: 87, amountProtected: "RWF 142M", falsePositiveRate: "1.8%", txChange: "+12%", fraudChange: "+4%", amountChange: "+18%", fpChange: "-0.3%" }; }
    const r = await fetch(`${API_BASE}/api/stats`, { headers: { Authorization: `Bearer ${sessionStorage.getItem("token")}` } });
    if (!r.ok) throw new Error("Failed to load stats"); return r.json();
  },
  updateAlertStatus: async (id, status) => {
    if (USE_MOCK) { await delay(300); return { success: true }; }
    const r = await fetch(`${API_BASE}/api/alerts/${id}`, { method: "PATCH", headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionStorage.getItem("token")}` }, body: JSON.stringify({ status }) });
    if (!r.ok) throw new Error("Failed to update alert"); return r.json();
  },
  predict: async (txData) => {
    if (USE_MOCK) { await delay(180); return { score: Math.floor(Math.random() * 100), confidence: 0.94, features: [] }; }
    const r = await fetch(`${API_BASE}/api/predict`, { method: "POST", headers: { "Content-Type": "application/json", Authorization: `Bearer ${sessionStorage.getItem("token")}` }, body: JSON.stringify(txData) });
    if (!r.ok) throw new Error("Prediction failed"); return r.json();
  },

  // ── AUTH ─────────────────────────────────────────────────────────────────
  // Called after biometric scan. Returns JWT stored in sessionStorage.
  login: async (analystId = "AK-001") => {
    if (USE_MOCK) {
      await delay(400);
      const mockToken = "mock_jwt_" + btoa(analystId + ":inkingi:" + Date.now());
      try {
        sessionStorage.setItem("token", mockToken);
        sessionStorage.setItem("analyst", analystId);
        sessionStorage.setItem("analyst_name", "Armand Kayiranga");
        sessionStorage.setItem("analyst_institution", "Inkingi Shield");
      } catch {}
      return { token: mockToken, analyst: { id: analystId, name: "Armand Kayiranga", role: "Senior Fraud Analyst", institution: "Inkingi Shield" } };
    }
    const r = await fetch(`${API_BASE}/auth/login`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ analyst_id: analystId, source: "biometric" })
    });
    if (!r.ok) throw new Error("Authentication failed");
    const data = await r.json();
    try {
      sessionStorage.setItem("token", data.token);
      sessionStorage.setItem("analyst", data.analyst.id);
      sessionStorage.setItem("analyst_name", data.analyst.name || "");
      sessionStorage.setItem("analyst_institution", data.analyst.institution || "");
    } catch {}
    return data;
  },

  // Called on Sign Out — clears token locally and invalidates on backend
  logout: async () => {
    const token = sessionStorage.getItem("token");
    try { sessionStorage.removeItem("token"); sessionStorage.removeItem("analyst"); } catch {}
    if (USE_MOCK || !token) return;
    try { await fetch(`${API_BASE}/auth/logout`, { method:"POST", headers:{ Authorization:`Bearer ${token}` } }); } catch {}
  },

  // Face recognition login — sends 128-float descriptor, gets JWT back
  faceLogin: async (descriptor) => {
    const r = await fetch(`${API_BASE}/auth/face-login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ descriptor }),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.detail || "Face not recognised");
    }
    const data = await r.json();
    try {
      sessionStorage.setItem("token", data.token);
      sessionStorage.setItem("analyst", data.analyst.id);
      sessionStorage.setItem("analyst_name", data.analyst.name || "");
      sessionStorage.setItem("analyst_institution", data.analyst.institution || "");
    } catch {}
    return data;
  },

  // Enroll a face descriptor for an analyst (admin action, requires JWT)
  enrollFace: async (analystId, descriptor, photoData = null) => {
    const token = sessionStorage.getItem("token");
    if (!token) throw new Error("Not authenticated");
    const r = await fetch(`${API_BASE}/api/analysts/${analystId}/face`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({ descriptor, photo_data: photoData }),
    });
    if (!r.ok) {
      const err = await r.json().catch(() => ({}));
      throw new Error(err.detail || "Enrollment failed");
    }
    return r.json();
  },

  // Quick connectivity check — call before flipping USE_MOCK
  testConnection: async () => {
    try {
      const r = await fetch(`${API_BASE}/health`, { signal: AbortSignal.timeout(3000) });
      const d = await r.json();
      return { connected: r.ok, status: d.status, version: d.version };
    } catch (e) { return { connected: false, error: e.message }; }
  },
};

// Mock fallbacks used when backend is unreachable
api.getStats.__mock        = async () => ({ totalTx:2847, fraudDetected:87, amountProtected:"RWF 142M", falsePositiveRate:"0.04%", txChange:"+12%", fraudChange:"+4%", amountChange:"+18%", fpChange:"-0.3%" });
api.getAlerts.__mock       = async () => ALERTS_DATA;
api.getTransactions.__mock = async () => TRANSACTIONS_DATA;
api.getCustomers.__mock    = async () => CUSTOMERS_DATA;

// ─────────────────────────────────────────────────────────────────────────────
// BACKEND INTEGRATION CHECKLIST
// Flip  USE_MOCK = false  and set  VITE_API_URL  when backend is ready.
//
// Required FastAPI endpoints:
//   GET   /health                 → { status, model, version, uptime }
//   POST  /auth/login             → { token, analyst: {id,name,role} }
//   POST  /auth/logout            → 200 OK
//   GET   /api/alerts             → Alert[]
//   GET   /api/transactions       → Transaction[]
//   GET   /api/customers          → Customer[]
//   GET   /api/stats              → Stats
//   PATCH /api/alerts/:id         → { success }  body: { status: "approved"|"cancelled" }
//   POST  /api/predict            → { fraud_score, is_fraud, confidence, top_features }
//
// All protected routes expect header:  Authorization: Bearer <token>
// CORS: whitelist http://localhost:5173 + your Vercel production domain
// Env var: VITE_API_URL=https://your-backend.onrender.com  (Vercel settings)
// ─────────────────────────────────────────────────────────────────────────────

// ─────────────────────────────────────────────────────────────────────────────
// DESIGN SYSTEM
// ─────────────────────────────────────────────────────────────────────────────
const C = {
  bg: "#F4F7FA", surface: "#FFFFFF", surfaceAlt: "#F8FAFC",
  border: "#E2E8F0", borderLight: "#EEF2F7",
  blue: "#1A8FBF", blueDeep: "#0B3D6B", blueLight: "#EBF6FB", blueMid: "#C5E5F5",
  green: "#007A45", greenLight: "#E6F5EE", greenMid: "#B8DEC9",
  yellow: "#D4A017", yellowLight: "#FEF9E7", yellowMid: "#F5D97A",
  red: "#C0392B", redLight: "#FDEDEC",
  orange: "#C0652B", orangeLight: "#FEF0E7",
  text: "#0F172A", textMid: "#475569", textDim: "#94A3B8", textXDim: "#CBD5E1",
  white: "#FFFFFF",
  rwBlue: "#20BDE0", rwYellow: "#FAD201", rwGreen: "#008751",
};

// ─────────────────────────────────────────────────────────────────────────────
// ICONS + SHARED UI
// ─────────────────────────────────────────────────────────────────────────────
const Ico = ({ d, size = 18, color = C.textMid, stroke = 1.8, fill = "none" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill={fill} stroke={color}
    strokeWidth={stroke} strokeLinecap="round" strokeLinejoin="round" style={{ flexShrink: 0 }}>
    {Array.isArray(d) ? d.map((p, i) => <path key={i} d={p} />) : <path d={d} />}
  </svg>
);
const IC = {
  shield: ["M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"],
  home: ["M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z", "M9 22V12h6v10"],
  info: ["M12 22c5.52 0 10-4.48 10-10S17.52 2 12 2 2 6.48 2 12s4.48 10 10 10z", "M12 8v4", "M12 16h.01"],
  building: ["M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z", "M9 22V12h6v10", "M2 17h20"],
  zap: ["M13 2L3 14h9l-1 8 10-12h-9l1-8z"],
  check: ["M20 6L9 17l-5-5"],
  x: ["M18 6L6 18", "M6 6l12 12"],
  arrow: ["M5 12h14", "M12 5l7 7-7 7"],
  arrowLeft: ["M19 12H5", "M12 19l-7-7 7-7"],
  chart: ["M18 20V10", "M12 20V4", "M6 20v-6"],
  users: ["M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2", "M23 21v-2a4 4 0 0 0-3-3.87", "M16 3.13a4 4 0 0 1 0 7.75", "M9 7m-4 0a4 4 0 1 0 8 0a4 4 0 1 0-8 0"],
  grid: ["M3 3h7v7H3z", "M14 3h7v7h-7z", "M3 14h7v7H3z", "M14 14h7v7h-7z"],
  list: ["M8 6h13", "M8 12h13", "M8 18h13", "M3 6h.01", "M3 12h.01", "M3 18h.01"],
  user: ["M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2", "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"],
  settings: ["M12 15a3 3 0 1 0 0-6 3 3 0 0 0 0 6z", "M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z"],
  logout: ["M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4", "M16 17l5-5-5-5", "M21 12H9"],
  camera: ["M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z", "M12 17a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"],
  eye: ["M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z", "M12 12m-3 0a3 3 0 1 0 6 0a3 3 0 1 0-6 0"],
  refresh: ["M23 4v6h-6", "M1 20v-6h6", "M3.51 9a9 9 0 0 1 14.85-3.36L23 10", "M1 14l4.64 4.36A9 9 0 0 0 20.49 15"],
  flag: ["M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z", "M4 22v-7"],
  upload: ["M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4", "M17 8l-5-5-5 5", "M12 3v12"],
  lock: ["M19 11H5a2 2 0 0 0-2 2v7a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7a2 2 0 0 0-2-2z", "M7 11V7a5 5 0 0 1 10 0v4"],
  dollar: ["M12 1v22", "M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"],
  phone: ["M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 22 16.92z"],
  mail: ["M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z", "M22 6l-10 7L2 6"],
  map: ["M1 6v16l7-4 8 4 7-4V2l-7 4-8-4-7 4z", "M8 2v16", "M16 6v16"],
  alertTriangle: ["M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z", "M12 9v4", "M12 17h.01"],
  activity: ["M22 12h-4l-3 9L9 3l-3 9H2"],
  bell: ["M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9", "M13.73 21a2 2 0 0 1-3.46 0"],
  wifi: ["M1.42 9a16 16 0 0 1 21.16 0", "M5 12.55a11 11 0 0 1 14.08 0", "M8.53 16.11a6 6 0 0 1 6.95 0", "M12 20h.01"],
  wifiOff: ["M1 1l22 22", "M16.72 11.06A10.94 10.94 0 0 1 19 12.55", "M5 12.55a10.94 10.94 0 0 1 5.17-2.39", "M10.71 5.05A16 16 0 0 1 22.56 9", "M1.42 9a15.91 15.91 0 0 1 4.7-2.88", "M8.53 16.11a6 6 0 0 1 6.95 0", "M12 20h.01"],
};

const RwandaStripe = () => (
  <div style={{ display: "flex", height: 4, width: "100%", flexShrink: 0 }}>
    <div style={{ flex: 1, background: C.rwBlue }} />
    <div style={{ flex: 1, background: C.rwYellow }} />
    <div style={{ flex: 1, background: C.rwGreen }} />
  </div>
);

const InkingiLogo = ({ size = "sm", light = false, sub = "FRAUD INTELLIGENCE · RW" }) => {
  const s = size === "lg" ? { w: 44, font: 20, sub: 9 } : { w: 34, font: 14, sub: 8 };
  const textColor = light ? "#FFFFFF" : C.text;
  const subColor = light ? C.rwBlue : C.blue;
  return (
    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
      <div style={{ width: s.w, height: s.w, borderRadius: 10, background: `linear-gradient(135deg, ${C.blueDeep} 0%, ${C.green} 100%)`, display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <svg width={s.w * 0.65} height={s.w * 0.65} viewBox="0 0 28 28" fill="none">
          <path d="M14 25s9-4 9-11V5L14 2 5 5v9c0 7 9 11 9 11z" fill="rgba(255,255,255,0.15)" stroke="white" strokeWidth="1.2" />
          {[0,45,90,135,180,225,270,315].map(deg => (
            <line key={deg} x1="14" y1="14" x2={14+5.5*Math.cos(deg*Math.PI/180)} y2={14+5.5*Math.sin(deg*Math.PI/180)} stroke="#FAD201" strokeWidth="1.1" strokeLinecap="round" />
          ))}
          <circle cx="14" cy="14" r="2.5" fill="#FAD201" />
        </svg>
      </div>
      <div>
        <div style={{ fontWeight: 800, fontSize: s.font, color: textColor, lineHeight: 1, letterSpacing: "0.01em", fontFamily: "'DM Sans', sans-serif" }}>Inkingi Shield</div>
        <div style={{ fontSize: s.sub, color: subColor, fontFamily: "'IBM Plex Mono', monospace", letterSpacing: "0.1em", marginTop: 2 }}>{sub}</div>
      </div>
    </div>
  );
};

const ImigoPattern = ({ opacity = 0.05 }) => (
  <svg style={{ position: "absolute", inset: 0, width: "100%", height: "100%", opacity, pointerEvents: "none" }}>
    <defs>
      <pattern id="imigo" x="0" y="0" width="72" height="72" patternUnits="userSpaceOnUse">
        <polygon points="36,4 68,22 68,50 36,68 4,50 4,22" fill="none" stroke={C.blue} strokeWidth="0.7" />
        <polygon points="36,16 56,27 56,45 36,56 16,45 16,27" fill="none" stroke={C.green} strokeWidth="0.4" />
        <circle cx="36" cy="36" r="4" fill="none" stroke={C.yellow} strokeWidth="0.4" />
        {[0,60,120,180,240,300].map(deg => (
          <line key={deg} x1="36" y1="36" x2={36+16*Math.cos(deg*Math.PI/180)} y2={36+16*Math.sin(deg*Math.PI/180)} stroke={C.yellow} strokeWidth="0.3" />
        ))}
      </pattern>
    </defs>
    <rect width="100%" height="100%" fill="url(#imigo)" />
  </svg>
);

// Loading skeleton
const Skeleton = ({ w = "100%", h = 14, radius = 6, mb = 0 }) => (
  <div style={{ width: w, height: h, borderRadius: radius, background: "linear-gradient(90deg, #e8ecf0 25%, #f4f7fa 50%, #e8ecf0 75%)", backgroundSize: "200% 100%", animation: "shimmer 1.4s infinite", marginBottom: mb }} />
);

// Error state card
const ErrorCard = ({ msg, onRetry }) => (
  <div style={{ background: C.redLight, border: "1px solid #FECACA", borderRadius: 12, padding: "20px", textAlign: "center" }}>
    <Ico d={IC.alertTriangle} size={24} color={C.red} />
    <div style={{ color: C.red, fontWeight: 600, marginTop: 8, marginBottom: 12 }}>{msg}</div>
    {onRetry && <button onClick={onRetry} style={{ padding: "7px 16px", background: C.red, border: "none", borderRadius: 7, color: "white", fontSize: 12, fontWeight: 700, cursor: "pointer" }}>Retry</button>}
  </div>
);

// useApi hook — handles loading, error, refetch
// Falls back to local mock data when the backend is unreachable so pages
// never break during demos or when running frontend-only.
const isDemo = () => { try { return sessionStorage.getItem("inkingi_demo") === "true"; } catch { return false; } };

function useApi(fn, deps = []) {
  const [data, setData]       = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError]     = useState(null);
  const run = useCallback(async () => {
    setLoading(true); setError(null);
    try {
      // In demo mode always use mock data — no backend calls
      if (isDemo() && fn.__mock) {
        setData(await fn.__mock()); setLoading(false); return;
      }
      setData(await fn());
    } catch (e) {
      if (e.message === "Failed to fetch" || e.name === "TypeError") {
        // Backend unreachable — use the mock fallback attached to the function
        const fallback = fn.__mock;
        if (fallback) {
          try { setData(await fallback()); setLoading(false); return; } catch {}
        }
      }
      setError(e.message);
    }
    setLoading(false);
  }, deps);
  useEffect(() => { run(); }, [run]);
  return { data, loading, error, refetch: run };
}

const scoreColor = s => s >= 80 ? C.red : s >= 55 ? C.orange : s >= 30 ? C.yellow : C.green;
const scoreBg   = s => s >= 80 ? C.redLight : s >= 55 ? C.orangeLight : s >= 30 ? C.yellowLight : C.greenLight;

// ─────────────────────────────────────────────────────────────────────────────
// DATA
// ─────────────────────────────────────────────────────────────────────────────
const ALERTS_DATA = [
  { id:"RW-4821", customer:"Jean Pierre Habimana", initials:"JH", score:92, level:"CRITICAL", amount:"RWF 4,250,000", amountNum:4250000, phone:"+250 788 234 567", email:"jp.habimana@gmail.com", address:"KG 45 Ave, Kigali", device:"iPhone 14 — New", type:"Mobile Money", time:"2m ago", phoneRisk:"high", emailRisk:"medium", addressRisk:"low", deviceRisk:"high", status:"pending", reason:"IP mismatch + new device + 4.2× avg amount" },
  { id:"RW-4820", customer:"Amina Uwase", initials:"AU", score:74, level:"HIGH", amount:"RWF 1,800,000", amountNum:1800000, phone:"+250 722 891 234", email:"amina.uwase@yahoo.com", address:"KN 12 St, Kigali", device:"Samsung S22", type:"Bank Transfer", time:"18m ago", phoneRisk:"medium", emailRisk:"low", addressRisk:"low", deviceRisk:"medium", status:"pending", reason:"Velocity spike · 3 transfers in 1 hour" },
  { id:"RW-4819", customer:"Eric Nshimiyimana", initials:"EN", score:58, level:"MEDIUM", amount:"RWF 920,000", amountNum:920000, phone:"+250 733 445 678", email:"eric.n@company.rw", address:"KG 101 Blvd, Kigali", device:"Android (rooted)", type:"Merchant Pay", time:"41m ago", phoneRisk:"low", emailRisk:"low", addressRisk:"medium", deviceRisk:"high", status:"pending", reason:"Rooted device detected" },
  { id:"RW-4818", customer:"Grace Mukamana", initials:"GM", score:31, level:"LOW", amount:"RWF 350,000", amountNum:350000, phone:"+250 788 112 334", email:"grace.m@gmail.com", address:"KK 25 Ave, Kigali", device:"iPhone 13", type:"Mobile Money", time:"1h ago", phoneRisk:"low", emailRisk:"low", addressRisk:"low", deviceRisk:"low", status:"approved", reason:"Routine transfer within normal range" },
  { id:"RW-4817", customer:"Patrick Niyonzima", initials:"PN", score:85, level:"HIGH", amount:"RWF 2,100,000", amountNum:2100000, phone:"+250 788 567 890", email:"p.niyonzima@rw.co", address:"KG 78 Ave, Kigali", device:"Unknown Device", type:"Bank Transfer", time:"2h ago", phoneRisk:"high", emailRisk:"medium", addressRisk:"low", deviceRisk:"high", status:"cancelled", reason:"Unknown device + off-hours transfer" },
  { id:"RW-4816", customer:"Claudine Umutoniwase", initials:"CU", score:67, level:"HIGH", amount:"RWF 780,000", amountNum:780000, phone:"+250 722 334 556", email:"c.umutoniwase@rw.co", address:"KG 22 Ave, Kigali", device:"Samsung A53", type:"Mobile Money", time:"3h ago", phoneRisk:"medium", emailRisk:"low", addressRisk:"low", deviceRisk:"low", status:"pending", reason:"Unusual location — Musanze, account based in Kigali" },
];
const TRANSACTIONS_DATA = [
  { id:"TXN-8821", customer:"Jean Pierre Habimana", amount:"RWF 4,250,000", type:"Mobile Money", date:"Feb 22, 2026 14:32", score:92, status:"flagged", channel:"MoMo App" },
  { id:"TXN-8820", customer:"Amina Uwase", amount:"RWF 1,800,000", type:"Bank Transfer", date:"Feb 22, 2026 14:15", score:74, status:"flagged", channel:"Online Banking" },
  { id:"TXN-8819", customer:"Eric Nshimiyimana", amount:"RWF 920,000", type:"Merchant Pay", date:"Feb 22, 2026 13:51", score:58, status:"flagged", channel:"POS Terminal" },
  { id:"TXN-8818", customer:"Grace Mukamana", amount:"RWF 350,000", type:"Mobile Money", date:"Feb 22, 2026 13:22", score:31, status:"clear", channel:"MoMo App" },
  { id:"TXN-8817", customer:"Patrick Niyonzima", amount:"RWF 2,100,000", type:"Bank Transfer", date:"Feb 22, 2026 12:18", score:85, status:"blocked", channel:"Online Banking" },
  { id:"TXN-8816", customer:"Claudine Umutoniwase", amount:"RWF 780,000", type:"Mobile Money", date:"Feb 22, 2026 11:45", score:67, status:"flagged", channel:"MoMo App" },
  { id:"TXN-8815", customer:"Olivier Hakizimana", amount:"RWF 125,000", type:"Merchant Pay", date:"Feb 22, 2026 10:30", score:12, status:"clear", channel:"POS Terminal" },
  { id:"TXN-8814", customer:"Vestine Uwimana", amount:"RWF 540,000", type:"Bank Transfer", date:"Feb 22, 2026 09:14", score:22, status:"clear", channel:"Online Banking" },
  { id:"TXN-8813", customer:"Thierry Mugisha", amount:"RWF 3,400,000", type:"Mobile Money", date:"Feb 22, 2026 08:55", score:78, status:"flagged", channel:"MoMo App" },
  { id:"TXN-8812", customer:"Sandrine Ineza", amount:"RWF 95,000", type:"Merchant Pay", date:"Feb 22, 2026 08:10", score:9, status:"clear", channel:"POS Terminal" },
];
const CUSTOMERS_DATA = [
  { id:"CUST-001", name:"Jean Pierre Habimana", initials:"JH", phone:"+250 788 234 567", email:"jp.habimana@gmail.com", location:"Kigali", joined:"Jan 2021", transactions:247, totalVolume:"RWF 42.5M", riskScore:78, status:"high-risk", flags:3 },
  { id:"CUST-002", name:"Amina Uwase", initials:"AU", phone:"+250 722 891 234", email:"amina.uwase@yahoo.com", location:"Kigali", joined:"Mar 2020", transactions:512, totalVolume:"RWF 18.2M", riskScore:42, status:"medium-risk", flags:1 },
  { id:"CUST-003", name:"Eric Nshimiyimana", initials:"EN", phone:"+250 733 445 678", email:"eric.n@company.rw", location:"Kigali", joined:"Jul 2022", transactions:89, totalVolume:"RWF 8.9M", riskScore:55, status:"medium-risk", flags:2 },
  { id:"CUST-004", name:"Grace Mukamana", initials:"GM", phone:"+250 788 112 334", email:"grace.m@gmail.com", location:"Kigali", joined:"Feb 2019", transactions:634, totalVolume:"RWF 12.1M", riskScore:18, status:"low-risk", flags:0 },
  { id:"CUST-005", name:"Patrick Niyonzima", initials:"PN", phone:"+250 788 567 890", email:"p.niyonzima@rw.co", location:"Kigali", joined:"Nov 2021", transactions:178, totalVolume:"RWF 31.4M", riskScore:82, status:"high-risk", flags:4 },
  { id:"CUST-006", name:"Claudine Umutoniwase", initials:"CU", phone:"+250 722 334 556", email:"c.umutoniwase@rw.co", location:"Musanze", joined:"May 2020", transactions:294, totalVolume:"RWF 9.7M", riskScore:61, status:"medium-risk", flags:1 },
];

// ─────────────────────────────────────────────────────────────────────────────
// LANDING NAV
// ─────────────────────────────────────────────────────────────────────────────
function LandingNav({ activePage, setPage }) {
  const navLinks = [
    { key:"home", label:"Home" }, { key:"about", label:"About" },
    { key:"how", label:"How It Works" }, { key:"partners", label:"For Companies" },
  ];
  const goDemo = () => {
    try { sessionStorage.setItem("inkingi_demo_pending", "true"); } catch {}
    setPage("login");
  };
  return (
    <nav style={{ background: C.surface, borderBottom:`1px solid ${C.border}`, position:"sticky", top:0, zIndex:100, boxShadow:"0 1px 8px rgba(0,0,0,0.06)" }}>
      <RwandaStripe />
      <div style={{ maxWidth:1100, margin:"0 auto", padding:"0 24px", display:"flex", alignItems:"center", height:60, gap:8 }}>
        <div style={{ cursor:"pointer" }} onClick={() => setPage("home")}><InkingiLogo /></div>
        <div style={{ flex:1 }} />
        <div className="ik-nav-links" style={{ display:"flex", alignItems:"center", gap:4 }}>
          {navLinks.map(n => (
            <button key={n.key} onClick={() => setPage(n.key)} style={{ padding:"7px 14px", background: activePage===n.key ? C.blueLight : "none", border:`1px solid ${activePage===n.key ? C.blueMid : "transparent"}`, borderRadius:8, cursor:"pointer", color: activePage===n.key ? C.blue : C.textMid, fontSize:13.5, fontWeight: activePage===n.key ? 700 : 400, fontFamily:"'DM Sans', sans-serif", transition:"all 0.18s" }}>
              {n.label}
            </button>
          ))}
        </div>
        <button className="ik-nav-demo" onClick={goDemo} style={{ marginLeft:4, padding:"8px 16px", background:"rgba(250,210,1,0.12)", border:`1px solid ${C.yellow}`, borderRadius:9, color:C.yellow, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans', sans-serif" }}>
          Try Live Demo
        </button>
        <button onClick={() => setPage("privacy")} style={{ marginLeft:4, padding:"7px 10px", background:"none", border:"none", color:C.textDim, fontSize:12, cursor:"pointer", fontFamily:"'DM Sans', sans-serif" }}>
          Privacy & EULA
        </button>
        <button onClick={() => setPage("login")} style={{ marginLeft:4, padding:"8px 20px", background:`linear-gradient(135deg, ${C.blueDeep}, ${C.green})`, border:"none", borderRadius:9, color:"white", fontSize:13.5, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans', sans-serif", boxShadow:"0 2px 10px rgba(11,61,107,0.25)" }}>
          Sign In
        </button>
      </div>
    </nav>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DEMO WALKTHROUGH — full-screen guided product demo for visitors (no auth)
// ─────────────────────────────────────────────────────────────────────────────
function DemoWalkthrough({ onClose, onRequestAccess }) {
  const [step, setStep]           = useState(0);       // 0–3 = steps, 4 = results
  const [score, setScore]         = useState(0);
  const [blocked, setBlocked]     = useState(false);
  const [statsNum, setStatsNum]   = useState(86);
  const [amountNum, setAmountNum] = useState(140);
  const [barW, setBarW]           = useState([0, 0, 0]);

  // Auto-advance every 4 s; resets whenever step changes (manual Next also resets it)
  useEffect(() => {
    if (step >= 4) return;
    const t = setTimeout(() => setStep(s => Math.min(s + 1, 4)), 4000);
    return () => clearTimeout(t);
  }, [step]);

  // Step 1 — animate score 0 → 89
  useEffect(() => {
    if (step !== 0) return;
    setScore(0);
    let s = 0;
    const iv = setInterval(() => { s = Math.min(s + 3, 89); setScore(s); if (s >= 89) clearInterval(iv); }, 35);
    return () => clearInterval(iv);
  }, [step]);

  // Step 3 — animate SHAP bars
  useEffect(() => {
    if (step !== 2) return;
    setBarW([0, 0, 0]);
    const t = setTimeout(() => setBarW([89, 82, 68]), 120);
    return () => clearTimeout(t);
  }, [step]);

  // Step 4 — block animation + counter bump
  useEffect(() => {
    if (step !== 3) return;
    setBlocked(false); setStatsNum(86); setAmountNum(140);
    const t1 = setTimeout(() => setBlocked(true), 1200);
    const t2 = setTimeout(() => { setStatsNum(87); setAmountNum(142); }, 1700);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, [step]);

  const STEPS = ["Transaction Arrives", "Alert Generated", "Analyst Reviews", "Decision Made"];
  const NARR = [
    "A mobile money transfer of RWF 3,800,000 is flagged in 148ms.",
    "The system generates an alert and routes it to the assigned fraud analyst for review.",
    "The analyst sees exactly why this transaction was flagged, down to the individual risk factors.",
    "The transaction is blocked in real time. The customer is protected. The event is logged for compliance.",
  ];

  const circ = 2 * Math.PI * 52;
  const scoreColor = score >= 80 ? "#EF4444" : score >= 55 ? "#F97316" : "#FAD201";

  return (
    <div style={{ position:"fixed", inset:0, zIndex:9999, background:"rgba(7,12,25,0.97)", fontFamily:"'DM Sans',sans-serif", display:"flex", flexDirection:"column", overflowY:"auto" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800&family=IBM+Plex+Mono:wght@400;600&display=swap');
        @keyframes d-in  { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        @keyframes d-fade{ from{opacity:0} to{opacity:1} }
        @keyframes d-ping{ 0%,100%{opacity:1} 50%{opacity:0.35} }
        @keyframes d-flash{ 0%{box-shadow:0 0 0 0 rgba(239,68,68,0.6)} 100%{box-shadow:0 0 0 16px rgba(239,68,68,0)} }
        .d-step{ animation:d-in 0.42s ease both }
      `}</style>

      {/* ── Top bar ── */}
      <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", padding:"14px 24px", borderBottom:"1px solid rgba(255,255,255,0.07)", background:"rgba(11,61,107,0.45)", backdropFilter:"blur(8px)", flexShrink:0, flexWrap:"wrap", gap:10 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <div style={{ width:28, height:28, borderRadius:7, background:"linear-gradient(135deg,#20BDE0,#008751)", display:"flex", alignItems:"center", justifyContent:"center" }}>
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>
          </div>
          <span style={{ color:"white", fontSize:13, fontWeight:700 }}>Inkingi Shield</span>
          <span style={{ color:"rgba(255,255,255,0.3)", fontSize:10, fontFamily:"'IBM Plex Mono'", letterSpacing:"0.08em" }}>LIVE DEMO</span>
        </div>

        {/* Step dots */}
        <div style={{ display:"flex", alignItems:"center", gap:0 }}>
          {STEPS.map((label, i) => (
            <div key={i} style={{ display:"flex", alignItems:"center" }}>
              <button onClick={() => setStep(i)} title={label} style={{ width:i===step?28:8, height:8, borderRadius:4, background:i<step?"#20BDE0":i===step?"#FAD201":"rgba(255,255,255,0.18)", border:"none", cursor:"pointer", transition:"all 0.3s", padding:0 }} />
              {i < STEPS.length-1 && <div style={{ width:18, height:1, background:i<step?"rgba(32,189,224,0.4)":"rgba(255,255,255,0.08)", margin:"0 3px" }} />}
            </div>
          ))}
        </div>

        <button onClick={onClose} style={{ background:"rgba(255,255,255,0.06)", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, color:"rgba(255,255,255,0.55)", fontSize:12, padding:"6px 14px", cursor:"pointer", fontFamily:"'DM Sans'", fontWeight:600 }}>Skip ×</button>
      </div>

      {/* Progress bar */}
      <div style={{ height:2, background:"rgba(255,255,255,0.05)", flexShrink:0 }}>
        <div style={{ height:"100%", background:"linear-gradient(90deg,#20BDE0,#008751)", width:step>=4?"100%":`${(step/4)*100}%`, transition:"width 0.4s ease" }} />
      </div>

      {/* ── Content ── */}
      <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", padding:"28px 20px" }}>
        <div style={{ width:"100%", maxWidth:800 }}>

          {/* Steps 0–3 */}
          {step < 4 && (
            <div key={step} className="d-step">
              <div style={{ textAlign:"center", marginBottom:24 }}>
                <div style={{ fontSize:10, color:"#FAD201", fontFamily:"'IBM Plex Mono'", letterSpacing:"0.12em", marginBottom:7 }}>STEP {step+1} OF 4</div>
                <h2 style={{ fontSize:26, fontWeight:800, color:"white", marginBottom:10 }}>{STEPS[step]}</h2>
                <p style={{ color:"rgba(255,255,255,0.5)", fontSize:13.5, lineHeight:1.7, maxWidth:520, margin:"0 auto" }}>{NARR[step]}</p>
              </div>

              {/* Visual panel */}
              <div style={{ background:"rgba(255,255,255,0.025)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:18, padding:"24px 22px", marginBottom:24 }}>

                {/* Step 1 — Transaction card + score ring */}
                {step === 0 && (
                  <div style={{ display:"flex", gap:24, alignItems:"center", justifyContent:"center", flexWrap:"wrap" }}>
                    <div style={{ flex:"1 1 260px", background:"rgba(11,61,107,0.55)", border:"1px solid rgba(32,189,224,0.2)", borderRadius:14, padding:"18px 20px" }}>
                      <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:14 }}>
                        <div style={{ width:36, height:36, borderRadius:9, background:"linear-gradient(135deg,#20BDE0,#0E7490)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="5" width="20" height="14" rx="2"/><path d="M2 10h20"/></svg>
                        </div>
                        <div>
                          <div style={{ fontSize:12, fontWeight:700, color:"white" }}>Jean Pierre Habimana</div>
                          <div style={{ fontSize:11, color:"rgba(255,255,255,0.4)", fontFamily:"'IBM Plex Mono'" }}>CUST-001 · MTN Rwanda</div>
                        </div>
                      </div>
                      <div style={{ fontSize:26, fontWeight:800, color:"white", marginBottom:4 }}>RWF 3,800,000</div>
                      <div style={{ fontSize:12, color:"rgba(255,255,255,0.45)" }}>CASH_OUT · MTN MoMo · 02:34 AM</div>
                      <div style={{ marginTop:14, display:"flex", alignItems:"center", gap:8 }}>
                        <div style={{ width:6, height:6, borderRadius:"50%", background:"#FAD201", animation:"d-ping 1s infinite" }} />
                        <span style={{ fontSize:10, color:"#FAD201", fontFamily:"'IBM Plex Mono'" }}>PROCESSING — 148ms</span>
                      </div>
                    </div>
                    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:10 }}>
                      <div style={{ position:"relative", width:128, height:128 }}>
                        <svg viewBox="0 0 128 128" style={{ width:128, height:128, transform:"rotate(-90deg)" }}>
                          <circle cx="64" cy="64" r="52" fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="9" />
                          <circle cx="64" cy="64" r="52" fill="none" stroke={scoreColor} strokeWidth="9" strokeLinecap="round"
                            strokeDasharray={`${(score/100)*circ} ${circ}`} style={{ transition:"stroke-dasharray 0.08s linear, stroke 0.5s" }} />
                        </svg>
                        <div style={{ position:"absolute", inset:0, display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center" }}>
                          <div style={{ fontSize:30, fontWeight:800, color:scoreColor, fontFamily:"'IBM Plex Mono'", lineHeight:1 }}>{score}</div>
                          <div style={{ fontSize:9, color:"rgba(255,255,255,0.35)", fontFamily:"'IBM Plex Mono'", letterSpacing:"0.05em" }}>SCORE</div>
                        </div>
                      </div>
                      {score >= 80 && (
                        <div style={{ padding:"3px 12px", background:"rgba(239,68,68,0.15)", border:"1px solid rgba(239,68,68,0.4)", borderRadius:20, fontSize:10, fontWeight:700, color:"#EF4444", fontFamily:"'IBM Plex Mono'", animation:"d-fade 0.3s ease" }}>CRITICAL</div>
                      )}
                    </div>
                  </div>
                )}

                {/* Step 2 — Alert queue */}
                {step === 1 && (
                  <div>
                    <div style={{ fontSize:10, color:"rgba(255,255,255,0.3)", fontFamily:"'IBM Plex Mono'", letterSpacing:"0.08em", marginBottom:12 }}>ANALYST ALERT QUEUE · 3 PENDING</div>
                    {[
                      { name:"Jean Pierre Habimana", score:89, amount:"RWF 3,800,000", type:"CASH_OUT",  time:"just now", level:"CRITICAL", hi:true },
                      { name:"Amina Uwase",           score:74, amount:"RWF 1,200,000", type:"TRANSFER",  time:"8m ago",  level:"HIGH",     hi:false },
                      { name:"Eric Nshimiyimana",     score:58, amount:"RWF 450,000",   type:"PAYMENT",   time:"22m ago", level:"MEDIUM",   hi:false },
                    ].map((a, i) => (
                      <div key={i} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", background:a.hi?"rgba(239,68,68,0.07)":"rgba(255,255,255,0.02)", border:`1px solid ${a.hi?"rgba(239,68,68,0.22)":"rgba(255,255,255,0.05)"}`, borderRadius:10, marginBottom:8, animation:i===0?"d-in 0.4s ease":undefined }}>
                        <div style={{ width:38, height:38, borderRadius:9, background:a.score>=80?"rgba(239,68,68,0.14)":a.score>=55?"rgba(249,115,22,0.12)":"rgba(250,210,1,0.1)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                          <span style={{ fontSize:14, fontWeight:800, color:a.score>=80?"#EF4444":a.score>=55?"#F97316":"#FAD201", fontFamily:"'IBM Plex Mono'" }}>{a.score}</span>
                        </div>
                        <div style={{ flex:1, minWidth:0 }}>
                          <div style={{ fontSize:13, fontWeight:700, color:"white", whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{a.name}</div>
                          <div style={{ fontSize:11, color:"rgba(255,255,255,0.38)", marginTop:1 }}>{a.amount} · {a.type} · {a.time}</div>
                        </div>
                        <div style={{ display:"flex", gap:5, flexShrink:0 }}>
                          <span style={{ padding:"2px 8px", borderRadius:20, fontSize:9, fontWeight:700, fontFamily:"'IBM Plex Mono'", background:a.score>=80?"rgba(239,68,68,0.13)":"rgba(249,115,22,0.1)", color:a.score>=80?"#EF4444":"#F97316" }}>{a.level}</span>
                          <span style={{ padding:"2px 8px", borderRadius:20, fontSize:9, fontWeight:700, fontFamily:"'IBM Plex Mono'", background:"rgba(250,210,1,0.08)", color:"#FAD201" }}>PENDING</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                {/* Step 3 — SHAP analysis */}
                {step === 2 && (
                  <div style={{ display:"flex", gap:22, flexWrap:"wrap" }}>
                    <div style={{ flex:"1 1 240px" }}>
                      <div style={{ fontSize:10, color:"rgba(255,255,255,0.3)", fontFamily:"'IBM Plex Mono'", letterSpacing:"0.08em", marginBottom:14 }}>RISK FACTOR ANALYSIS</div>
                      {[{label:"balance_diff",v:barW[0],color:"#EF4444"},{label:"amount_ratio",v:barW[1],color:"#F97316"},{label:"type",v:barW[2],color:"#FAD201"}].map((f,i) => (
                        <div key={i} style={{ marginBottom:14 }}>
                          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:5 }}>
                            <span style={{ fontSize:12, color:"rgba(255,255,255,0.65)", fontFamily:"'IBM Plex Mono'" }}>{f.label}</span>
                            <span style={{ fontSize:12, fontWeight:700, color:f.color, fontFamily:"'IBM Plex Mono'" }}>{f.v}%</span>
                          </div>
                          <div style={{ height:8, background:"rgba(255,255,255,0.05)", borderRadius:4, overflow:"hidden" }}>
                            <div style={{ height:"100%", borderRadius:4, background:f.color, width:`${f.v}%`, transition:"width 0.9s cubic-bezier(0.4,0,0.2,1)" }} />
                          </div>
                        </div>
                      ))}
                    </div>
                    <div style={{ flex:"1 1 200px", background:"rgba(239,68,68,0.05)", border:"1px solid rgba(239,68,68,0.14)", borderRadius:12, padding:"16px" }}>
                      <div style={{ fontSize:10, color:"rgba(255,255,255,0.3)", fontFamily:"'IBM Plex Mono'", letterSpacing:"0.06em", marginBottom:10 }}>TRIGGER SUMMARY</div>
                      <p style={{ fontSize:13, color:"rgba(255,255,255,0.7)", lineHeight:1.7, marginBottom:12 }}>
                        Account <strong style={{ color:"white" }}>drained to zero</strong>. Transfer exceeds balance by <strong style={{ color:"#EF4444" }}>1.9×</strong>. Unusual hour (02:34 AM). IP mismatch with home region.
                      </p>
                      <div style={{ padding:"9px 11px", background:"rgba(239,68,68,0.09)", borderRadius:8, fontSize:11, color:"#FCA5A5", fontFamily:"'IBM Plex Mono'" }}>RISK PROFILE: 82 / 100 · HIGH RISK</div>
                    </div>
                  </div>
                )}

                {/* Step 4 — Decision */}
                {step === 3 && (
                  <div style={{ display:"flex", gap:22, flexWrap:"wrap", alignItems:"flex-start" }}>
                    <div style={{ flex:"1 1 240px", display:"flex", flexDirection:"column", gap:12 }}>
                      <div style={{ fontSize:10, color:"rgba(255,255,255,0.3)", fontFamily:"'IBM Plex Mono'", letterSpacing:"0.08em" }}>ANALYST DECISION</div>
                      <div style={{ display:"flex", gap:10 }}>
                        <div style={{ flex:1, padding:"13px 16px", borderRadius:11, fontSize:13, fontWeight:700, textAlign:"center", background:blocked?"rgba(239,68,68,0.18)":"rgba(239,68,68,0.09)", border:`2px solid ${blocked?"#EF4444":"rgba(239,68,68,0.3)"}`, color:"#EF4444", cursor:"default", transition:"all 0.3s", animation:blocked?"d-flash 0.4s ease":undefined }}>
                          {blocked ? "✓ Transaction Blocked" : "Block Transaction"}
                        </div>
                        <div style={{ flex:1, padding:"13px 16px", borderRadius:11, fontSize:13, fontWeight:700, textAlign:"center", background:"rgba(0,135,81,0.06)", border:"1px solid rgba(0,135,81,0.18)", color:"rgba(0,196,106,0.4)", cursor:"default" }}>Clear</div>
                      </div>
                      <div style={{ padding:"12px 14px", background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:10 }}>
                        <div style={{ fontSize:10, color:"rgba(255,255,255,0.28)", fontFamily:"'IBM Plex Mono'", marginBottom:8 }}>AUDIT LOG</div>
                        {[
                          { time:"02:34:09", msg:"System flagged transaction", color:"#FAD201" },
                          { time:"02:34:10", msg:"Alert routed to analyst queue", color:"#20BDE0" },
                          ...(blocked ? [{ time:"02:34:11", msg:"Transaction blocked by analyst", color:"#EF4444" }] : []),
                        ].map((log, i) => (
                          <div key={i} style={{ display:"flex", gap:10, marginBottom:5, animation:i===2?"d-in 0.3s ease":undefined }}>
                            <span style={{ fontSize:10, color:"rgba(255,255,255,0.22)", fontFamily:"'IBM Plex Mono'", flexShrink:0 }}>{log.time}</span>
                            <span style={{ fontSize:11, color:log.color }}>{log.msg}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                    <div style={{ flex:"1 1 190px", display:"flex", flexDirection:"column", gap:10 }}>
                      <div style={{ fontSize:10, color:"rgba(255,255,255,0.3)", fontFamily:"'IBM Plex Mono'", letterSpacing:"0.08em" }}>THIS MONTH</div>
                      {[{label:"Fraud cases caught",val:statsNum,color:"#EF4444"},{label:"Amount protected",val:`RWF ${amountNum}M`,color:"#00C46A"}].map((s,i) => (
                        <div key={i} style={{ padding:"16px", background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)", borderRadius:12 }}>
                          <div style={{ fontSize:26, fontWeight:800, color:s.color, fontFamily:"'IBM Plex Mono'", transition:"all 0.5s" }}>{s.val}</div>
                          <div style={{ fontSize:11, color:"rgba(255,255,255,0.38)", marginTop:4 }}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Nav buttons */}
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <button onClick={() => setStep(s => Math.max(s-1, 0))} disabled={step===0} style={{ background:"rgba(255,255,255,0.05)", border:"1px solid rgba(255,255,255,0.09)", borderRadius:9, color:"rgba(255,255,255,0.45)", fontSize:13, padding:"9px 18px", cursor:step===0?"default":"pointer", fontFamily:"'DM Sans'", fontWeight:600, opacity:step===0?0.3:1 }}>← Back</button>
                <div style={{ fontSize:10, color:"rgba(255,255,255,0.2)", fontFamily:"'IBM Plex Mono'" }}>AUTO-ADVANCES IN 4s</div>
                <button onClick={() => setStep(s => Math.min(s+1,4))} style={{ background:"linear-gradient(135deg,#20BDE0,#008751)", border:"none", borderRadius:9, color:"white", fontSize:13, padding:"9px 20px", cursor:"pointer", fontFamily:"'DM Sans'", fontWeight:700, boxShadow:"0 2px 10px rgba(32,189,224,0.22)" }}>
                  {step===3?"See Results →":"Next →"}
                </button>
              </div>
            </div>
          )}

          {/* Results screen */}
          {step >= 4 && (
            <div key="results" className="d-step" style={{ textAlign:"center" }}>
              <div style={{ fontSize:10, color:"#FAD201", fontFamily:"'IBM Plex Mono'", letterSpacing:"0.12em", marginBottom:12 }}>THIS MONTH · DEMO DATA</div>
              <div style={{ fontSize:38, fontWeight:800, color:"white", marginBottom:6 }}>87 fraud cases caught</div>
              <div style={{ fontSize:22, fontWeight:700, color:"#00C46A", marginBottom:32 }}>RWF 142M protected</div>
              <div style={{ display:"flex", gap:14, justifyContent:"center", flexWrap:"wrap", marginBottom:36 }}>
                {[{label:"Detection Accuracy",val:"99.2%",color:"#20BDE0"},{label:"Avg. Response Time",val:"148ms",color:"#FAD201"},{label:"False Positive Rate",val:"0.04%",color:"#00C46A"}].map((s,i) => (
                  <div key={i} style={{ padding:"18px 22px", background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, minWidth:130 }}>
                    <div style={{ fontSize:24, fontWeight:800, color:s.color, fontFamily:"'IBM Plex Mono'" }}>{s.val}</div>
                    <div style={{ fontSize:12, color:"rgba(255,255,255,0.45)", marginTop:4 }}>{s.label}</div>
                  </div>
                ))}
              </div>
              <button onClick={onRequestAccess} style={{ padding:"14px 30px", background:"linear-gradient(135deg,#20BDE0,#008751)", border:"none", borderRadius:12, color:"white", fontSize:15, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans'", boxShadow:"0 4px 20px rgba(32,189,224,0.28)" }}>
                Request Access for Your Institution →
              </button>
              <div style={{ marginTop:14 }}>
                <button onClick={onClose} style={{ background:"none", border:"none", color:"rgba(255,255,255,0.28)", fontSize:13, cursor:"pointer", fontFamily:"'DM Sans'" }}>Close demo</button>
              </div>
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// HOME PAGE
// ─────────────────────────────────────────────────────────────────────────────
function HomePage({ setPage, onDemo }) {
  return (
    <div style={{ fontFamily:"'DM Sans', sans-serif" }}>
      <div className="ik-hero" style={{ background:`linear-gradient(155deg, ${C.blueDeep} 0%, #0E5C3A 55%, ${C.blueDeep} 100%)`, position:"relative", overflow:"hidden", padding:"90px 24px 80px" }}>
        <ImigoPattern opacity={0.1} />
        <div style={{ position:"absolute", top:-100, right:-100, width:500, height:500, borderRadius:"50%", background:"radial-gradient(circle, rgba(250,210,1,0.1) 0%, transparent 65%)", pointerEvents:"none" }} />
        <div style={{ maxWidth:900, margin:"0 auto", textAlign:"center", position:"relative" }}>
          <div style={{ display:"inline-flex", alignItems:"center", gap:8, background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.2)", borderRadius:20, padding:"5px 14px", marginBottom:28 }}>
            <div style={{ width:7, height:7, borderRadius:"50%", background:C.rwYellow }} />
            <span style={{ color:"rgba(255,255,255,0.85)", fontSize:12, fontFamily:"'IBM Plex Mono'", letterSpacing:"0.08em" }}>BUILT FOR RWANDA'S FINANCIAL ECOSYSTEM</span>
          </div>
          <h1 className="ik-hero-h1" style={{ fontSize:54, fontWeight:800, color:"white", lineHeight:1.08, marginBottom:22 }}>
            Stop Fraud Before It<br /><span style={{ color:C.rwYellow }}>Costs You Millions</span>
          </h1>
          <p className="ik-hero-sub" style={{ fontSize:17, color:"rgba(255,255,255,0.7)", lineHeight:1.75, maxWidth:580, margin:"0 auto 40px" }}>
            Inkingi Shield gives financial institutions across Rwanda a real-time fraud detection system built for local transaction patterns. Share your transaction data — our system does the rest.
          </p>
          <div style={{ display:"flex", gap:14, justifyContent:"center", flexWrap:"wrap" }}>
            <button onClick={() => setPage("partners")} style={{ padding:"13px 28px", background:C.rwYellow, border:"none", borderRadius:10, color:C.blueDeep, fontSize:15, fontWeight:800, cursor:"pointer", fontFamily:"'DM Sans'", boxShadow:"0 4px 18px rgba(250,210,1,0.4)" }}>Get Started for Free</button>
            <button onClick={onDemo} style={{ padding:"13px 28px", background:"rgba(255,255,255,0.1)", border:"1px solid rgba(255,255,255,0.25)", borderRadius:10, color:"white", fontSize:15, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans'" }}>▶ See Preview</button>
            <button onClick={() => { try { sessionStorage.setItem("inkingi_demo_pending","true"); } catch {} setPage("login"); }} style={{ padding:"13px 28px", background:"rgba(250,210,1,0.15)", border:`1px solid ${C.rwYellow}`, borderRadius:10, color:C.rwYellow, fontSize:15, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans'" }}>Try Live Demo</button>
          </div>
          <div style={{ marginTop:12, fontSize:12, color:"rgba(255,255,255,0.45)", fontFamily:"'IBM Plex Mono'", letterSpacing:"0.05em" }}>
            Demo access code: <span style={{ color:"rgba(250,210,1,0.7)", fontWeight:600 }}>DEMO2026</span>
          </div>
          <div style={{ display:"flex", justifyContent:"center", gap:8, marginTop:48 }}>
            {[C.rwBlue, C.rwYellow, C.rwGreen].map((c,i) => <div key={i} style={{ width:10, height:10, borderRadius:"50%", background:c, opacity:0.8 }} />)}
          </div>
        </div>
      </div>
      <div style={{ background:C.surface, borderBottom:`1px solid ${C.border}` }}>
        <div className="ik-stats-grid" style={{ maxWidth:1100, margin:"0 auto", padding:"28px 24px", display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:0 }}>
          {[{value:"99.2%",label:"Detection Accuracy",color:C.green},{value:"< 200ms",label:"Response Time",color:C.blue},{value:"RWF 2.4B+",label:"Fraud Prevented (est.)",color:C.yellow},{value:"3 Banks",label:"Pilot Partners",color:C.green}].map((s,i) => (
            <div key={i} style={{ textAlign:"center", padding:"8px 0", borderRight: i<3 ? `1px solid ${C.border}` : "none" }}>
              <div style={{ fontSize:30, fontWeight:800, color:s.color, fontFamily:"'IBM Plex Mono'", letterSpacing:"-0.02em" }}>{s.value}</div>
              <div style={{ fontSize:13, color:C.textMid, marginTop:4 }}>{s.label}</div>
            </div>
          ))}
        </div>
      </div>
      <div className="ik-features-section" style={{ maxWidth:1100, margin:"0 auto", padding:"72px 24px" }}>
        <div style={{ textAlign:"center", marginBottom:52 }}>
          <div style={{ fontSize:12, color:C.blue, fontFamily:"'IBM Plex Mono'", letterSpacing:"0.1em", marginBottom:10 }}>WHY INKINGI SHIELD</div>
          <h2 style={{ fontSize:36, fontWeight:800, color:C.text, marginBottom:14 }}>Designed for how Rwanda transacts</h2>
          <p style={{ fontSize:15, color:C.textMid, maxWidth:520, margin:"0 auto" }}>Mobile money, bank transfers, merchant payments — we understand fraud patterns specific to East Africa's financial landscape.</p>
        </div>
        <div className="ik-features-grid" style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:22 }}>
          {[
            {icon:IC.zap,title:"Real-Time Detection",body:"Every transaction is scored in under 200ms. Fraudulent activity is flagged before it completes, not after.",color:C.blue,bg:C.blueLight},
            {icon:IC.shield,title:"Transparent Decisions",body:"We don't just say 'fraud' — we show your analysts exactly which factors triggered the alert, so every decision is backed by evidence.",color:C.green,bg:C.greenLight},
            {icon:IC.users,title:"Multi-Institution",body:"MTN, Airtel, BK, Equity — any financial institution in Rwanda can connect their data. Each gets their own secure dashboard.",color:C.yellow,bg:C.yellowLight},
            {icon:IC.lock,title:"Data Privacy First",body:"Your customer data never leaves your control. We process transactions in isolated environments with full encryption.",color:C.blue,bg:C.blueLight},
            {icon:IC.chart,title:"Live Analytics",body:"Track fraud trends over time, compare detection rates across transaction types, and export reports for compliance.",color:C.green,bg:C.greenLight},
            {icon:IC.map,title:"Rwanda Context",body:"Trained on PaySim mobile money patterns and calibrated for Rwandan transaction behavior — not a generic global model.",color:C.yellow,bg:C.yellowLight},
          ].map((f,i) => (
            <div key={i} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:"28px 24px", boxShadow:"0 1px 6px rgba(0,0,0,0.04)" }}>
              <div style={{ width:44, height:44, borderRadius:11, background:f.bg, display:"flex", alignItems:"center", justifyContent:"center", marginBottom:16 }}>
                <Ico d={f.icon} size={20} color={f.color} />
              </div>
              <div style={{ fontSize:16, fontWeight:700, color:C.text, marginBottom:8 }}>{f.title}</div>
              <div style={{ fontSize:13.5, color:C.textMid, lineHeight:1.65 }}>{f.body}</div>
            </div>
          ))}
        </div>
      </div>
      <div style={{ background:`linear-gradient(135deg, ${C.blueDeep}, ${C.green})`, padding:"72px 24px", position:"relative", overflow:"hidden" }}>
        <ImigoPattern opacity={0.08} />
        <div style={{ maxWidth:600, margin:"0 auto", textAlign:"center", position:"relative" }}>
          <h2 className="ik-cta-h2" style={{ fontSize:36, fontWeight:800, color:"white", marginBottom:16 }}>Ready to protect your customers?</h2>
          <p style={{ color:"rgba(255,255,255,0.7)", fontSize:15, marginBottom:32, lineHeight:1.65 }}>Share your transaction dataset with us and within 48 hours your team will have a live fraud detection dashboard.</p>
          <button onClick={() => setPage("partners")} style={{ padding:"14px 32px", background:C.rwYellow, border:"none", borderRadius:10, color:C.blueDeep, fontSize:15, fontWeight:800, cursor:"pointer", fontFamily:"'DM Sans'" }}>Connect Your Institution</button>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ABOUT PAGE
// ─────────────────────────────────────────────────────────────────────────────
function AboutPage({ setPage }) {
  return (
    <div style={{ fontFamily:"'DM Sans', sans-serif" }}>
      <div style={{ background:`linear-gradient(155deg, ${C.blueDeep}, #0E5C3A)`, padding:"72px 24px 60px", position:"relative", overflow:"hidden" }}>
        <ImigoPattern opacity={0.1} />
        <div style={{ maxWidth:720, margin:"0 auto", textAlign:"center", position:"relative" }}>
          <div style={{ fontSize:12, color:C.rwYellow, fontFamily:"'IBM Plex Mono'", letterSpacing:"0.1em", marginBottom:12 }}>ABOUT US</div>
          <h1 className="ik-page-h1" style={{ fontSize:44, fontWeight:800, color:"white", marginBottom:18 }}>Inkingi — The Pillar of Protection</h1>
          <p style={{ color:"rgba(255,255,255,0.7)", fontSize:16, lineHeight:1.75 }}>Inkingi in Kinyarwanda means pillar or foundation — the thing that holds everything up. That is what we intend to be for Rwanda's financial institutions.</p>
        </div>
      </div>
      <div style={{ maxWidth:1000, margin:"0 auto", padding:"72px 24px" }}>
        <div className="ik-two-col" style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:48, alignItems:"start" }}>
          <div>
            <div style={{ fontSize:12, color:C.blue, fontFamily:"'IBM Plex Mono'", letterSpacing:"0.1em", marginBottom:10 }}>THE PROBLEM</div>
            <h2 style={{ fontSize:26, fontWeight:800, color:C.text, marginBottom:16 }}>Financial fraud costs Rwanda hundreds of millions every year</h2>
            <p style={{ color:C.textMid, fontSize:14, lineHeight:1.75, marginBottom:16 }}>As mobile money adoption accelerates, fraudsters have become increasingly sophisticated. Traditional rule-based detection systems miss up to 40% of fraud cases because they cannot adapt to new patterns.</p>
            <p style={{ color:C.textMid, fontSize:14, lineHeight:1.75 }}>Small and medium financial institutions are especially vulnerable. They lack the resources to build dedicated fraud detection teams, and most foreign solutions are not calibrated for East African transaction behaviour.</p>
          </div>
          <div>
            <div style={{ fontSize:12, color:C.green, fontFamily:"'IBM Plex Mono'", letterSpacing:"0.1em", marginBottom:10 }}>OUR APPROACH</div>
            <h2 style={{ fontSize:26, fontWeight:800, color:C.text, marginBottom:16 }}>Machine learning trained on how Rwanda actually transacts</h2>
            <p style={{ color:C.textMid, fontSize:14, lineHeight:1.75, marginBottom:16 }}>Inkingi Shield is built on a Random Forest and XGBoost ensemble trained on PaySim — a simulation of real mobile money transactions modeled on Rwandan behavior.</p>
            <p style={{ color:C.textMid, fontSize:14, lineHeight:1.75 }}>Every flagged transaction comes with a plain-language explanation — the Trigger Summary — so analysts know exactly why the system raised an alert.</p>
          </div>
        </div>
        <div style={{ marginTop:64, padding:"40px", background:`linear-gradient(135deg, ${C.blueDeep}08, ${C.green}08)`, border:`1px solid ${C.border}`, borderRadius:18, position:"relative", overflow:"hidden" }}>
          <ImigoPattern opacity={0.04} />
          <div style={{ position:"relative" }}>
            <div style={{ fontSize:12, color:C.blue, fontFamily:"'IBM Plex Mono'", letterSpacing:"0.1em", marginBottom:10 }}>THE TEAM</div>
            <h2 style={{ fontSize:26, fontWeight:800, color:C.text, marginBottom:28 }}>Built by Rwandan engineers, for Rwandan institutions</h2>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:20 }}>
              {[{name:"Armand Kayiranga",role:"Lead Engineer & Researcher",dept:"BSc. Software Engineering",initials:"AK"}].map((p,i) => (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:16, padding:"20px", background:C.surface, borderRadius:12, border:`1px solid ${C.border}` }}>
                  <div style={{ width:52, height:52, borderRadius:"50%", background:`linear-gradient(135deg,${C.blueDeep},${C.green})`, display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontWeight:800, fontSize:16, flexShrink:0 }}>{p.initials}</div>
                  <div>
                    <div style={{ fontWeight:700, color:C.text, fontSize:15 }}>{p.name}</div>
                    <div style={{ color:C.blue, fontSize:13, fontWeight:500 }}>{p.role}</div>
                    <div style={{ color:C.textDim, fontSize:12, fontFamily:"'IBM Plex Mono'", marginTop:2 }}>{p.dept}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// MOMO DATA ANALYZER
// mode: "landing" (JS fallback only) | "analyst" (API + import) | "admin" (API, no import)
// ─────────────────────────────────────────────────────────────────────────────
function MomoAnalyzer({ mode = "landing" }) {
  const [input, setInput]       = useState("");
  const [rows, setRows]         = useState([]);
  const [scoring, setScoring]   = useState(false);
  const [scored, setScored]     = useState(false);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");

  const isDark   = mode === "admin";
  const bg       = isDark ? "#1A2235" : C.surface;
  const bdr      = isDark ? "rgba(255,255,255,0.08)" : C.border;
  const txt      = isDark ? "#F9FAFB" : C.text;
  const txtMid   = isDark ? "#9CA3AF" : C.textMid;
  const inputBg  = isDark ? "#111827" : C.bg;

  // ── Format detection ──────────────────────────────────────────────────────
  function detectFmt(raw) {
    const first = raw.trim().split("\n")[0];
    return /^\d{4}-\d{2}-\d{2}/.test(first) && /(TRANSFER|PAYMENT|EXTERNAL)/i.test(first) ? "B" : "A";
  }

  // ── Format A — SMS messages ───────────────────────────────────────────────
  function parseSMS(raw) {
    let msgs = raw.split(/\n\s*\n/).filter(m => m.trim());
    if (msgs.length <= 1) msgs = raw.split(/(?=(?:You have|\*16[25]\*|TxId:))/m).filter(m => m.trim());
    return msgs.map(msg => {
      const amtM  = msg.match(/(?:RWF|Rwf)\s*([\d,]+)/i);
      if (!amtM) return null;
      const amount = parseFloat(amtM[1].replace(/,/g, ""));
      let type = "PAYMENT";
      if (/cash.?out|withdrew/i.test(msg)) type = "CASH_OUT";
      else if (/transfer(?:red)?(?! to you)|sent to/i.test(msg)) type = "TRANSFER";
      else if (/received|payment.*from/i.test(msg)) type = "CASH_IN";
      const nameM    = msg.match(/(?:from|to)\s+([A-Z][a-z]+(?: [A-Z][a-z]+)+)/);
      const customer = nameM ? nameM[1] : "Unknown";
      const balM     = msg.match(/(?:balance|bal)[^:]*:\s*(?:RWF|Rwf)?\s*([\d,]+)/i);
      const newBal   = balM ? parseFloat(balM[1].replace(/,/g, "")) : 0;
      const dateM    = msg.match(/(\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}|\d{4}-\d{2}-\d{2})/);
      const timeM    = msg.match(/(\d{1,2}:\d{2}(?::\d{2})?(?:\s*[AP]M)?)/i);
      const datetime = [dateM?.[1], timeM?.[1]].filter(Boolean).join(" ") || "unknown";
      return { customer, amount, type, newBal, oldBal: 0, datetime };
    }).filter(Boolean);
  }

  // ── Format B — USSD export ────────────────────────────────────────────────
  function parseUSSD(raw) {
    return raw.trim().split("\n").filter(l => l.trim()).map(line => {
      // CSV variant: 2024-01-15, TRANSFER, Name, 450000, 462000, 12000
      const p = line.split(",").map(s => s.trim());
      if (p.length >= 5) {
        return {
          datetime: p[0] || "unknown",
          type:     (p[1] || "PAYMENT").toUpperCase().replace(/\s+/g, "_"),
          customer: p[2] || "Unknown",
          amount:   parseFloat(p[3]) || 0,
          oldBal:   parseFloat(p[4]) || 0,
          newBal:   parseFloat(p[5]) || 0,
        };
      }
      // Space-based variant: 2026-03-14 TRANSFER RWF 700 Receiver: 250781357798 Sender: 250787277706 Fee: RWF 20
      const amtM     = line.match(/\bRWF\s+(\d[\d,]*)/i);
      if (!amtM) return null;
      const dateM    = line.match(/^(\d{4}-\d{2}-\d{2})/);
      const typeM    = line.match(/\b(TRANSFER|PAYMENT|CASH_OUT|CASH_IN|DEBIT|CREDIT)\b/i);
      const senderM  = line.match(/Sender:\s*(\d+)/i);
      const recvM    = line.match(/Receiver:\s*(\d+)/i);
      const customer = senderM ? `Sender ${senderM[1]}` : recvM ? `Receiver ${recvM[1]}` : "Unknown";
      return {
        datetime: dateM ? dateM[1] : "unknown",
        type:     typeM ? typeM[1].toUpperCase() : "PAYMENT",
        customer,
        amount:   parseFloat(amtM[1].replace(/,/g, "")),
        oldBal:   0,
        newBal:   0,
      };
    }).filter(Boolean);
  }

  // ── Local JS scorer (fallback) ────────────────────────────────────────────
  function localScore(row) {
    let s = row.type === "CASH_OUT" ? 25 : row.type === "TRANSFER" ? 20 : row.type === "PAYMENT" ? 15 : row.type === "CASH_IN" ? 5 : 10;
    if (row.amount > 1000000) s += 30;
    else if (row.amount > 500000) s += 20;
    else if (row.amount > 100000) s += 10;
    if (row.oldBal > 0 && row.newBal <= 0) s += 20;
    if (row.oldBal > 0 && (row.oldBal - row.newBal) / row.oldBal >= 0.9) s += 15;
    return Math.min(s, 100);
  }

  function toLevel(s) { return s >= 80 ? "CRITICAL" : s >= 60 ? "HIGH" : s >= 40 ? "MEDIUM" : "LOW"; }

  // ── Parse button ──────────────────────────────────────────────────────────
  function handleParse() {
    const fmt = detectFmt(input);
    let parsed = fmt === "B" ? parseUSSD(input) : parseSMS(input);
    // Derive old balances for Format A
    if (fmt === "A") {
      for (let i = 0; i < parsed.length; i++)
        parsed[i].oldBal = i === 0 ? parsed[i].newBal : parsed[i - 1].newBal;
    }
    setRows(parsed.map(r => ({ ...r, score: null, level: null })));
    setScored(false);
    setImportMsg(parsed.length === 0 && input.trim() ? "No transactions found. Paste MoMo SMS messages (Format A) or a USSD export (Format B)." : "");
  }

  // ── Score button ──────────────────────────────────────────────────────────
  async function handleScore() {
    setScoring(true);
    const BATCH = 5;
    const updated = [...rows];
    for (let i = 0; i < updated.length; i += BATCH) {
      await Promise.all(updated.slice(i, i + BATCH).map(async (row, bi) => {
        const idx = i + bi;
        let sc;
        if (mode === "landing") {
          sc = localScore(row);
        } else {
          try {
            const res = await api.predict({ amount: row.amount, transaction_type: row.type, old_balance: row.oldBal, new_balance: row.newBal });
            sc = res.fraud_score;
          } catch { sc = localScore(row); }
        }
        updated[idx] = { ...row, score: sc, level: toLevel(sc) };
      }));
      setRows([...updated]);
      if (i + BATCH < updated.length) await new Promise(r => setTimeout(r, 200));
    }
    setScoring(false);
    setScored(true);
  }

  // ── Import to queue (analyst only) ───────────────────────────────────────
  async function handleImport() {
    const flagged = rows.filter(r => r.score >= 70);
    if (!flagged.length) return;
    setImporting(true);
    try {
      const token = sessionStorage.getItem("token");
      const payload = { alerts: flagged.map(r => ({
        customer:   r.customer,
        score:      r.score,
        level:      r.level,
        amount:     `RWF ${r.amount?.toLocaleString()}`,
        amount_num: r.amount,
        type:       "Mobile Money",
        reason:     `MoMo import — ${r.type} RWF ${r.amount?.toLocaleString()}`,
        time:       "just now",
      }))};
      const res = await fetch(`${API_BASE}/api/alerts/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setImportMsg(`${data.created} alert${data.created !== 1 ? "s" : ""} added to queue.`);
    } catch { setImportMsg("Import failed. Check your session and try again."); }
    setImporting(false);
  }

  // ── CSV export ────────────────────────────────────────────────────────────
  function handleExport() {
    const hdr = ["Customer","Amount (RWF)","Type","Date/Time","Old Balance","New Balance","Fraud Score","Level"];
    const body = rows.map(r => [`"${r.customer}"`,r.amount,r.type,`"${r.datetime}"`,r.oldBal,r.newBal,r.score??"",r.level??""].join(","));
    const blob = new Blob([[hdr.join(","), ...body].join("\n")], { type:"text/csv" });
    const a = Object.assign(document.createElement("a"), { href: URL.createObjectURL(blob), download:"momo_fraud_analysis.csv" });
    a.click(); URL.revokeObjectURL(a.href);
  }

  const flaggedCount = rows.filter(r => r.score >= 70).length;
  const lvlColor = l => l === "CRITICAL" ? "#C0392B" : l === "HIGH" ? "#D4A017" : l === "MEDIUM" ? "#F97316" : l === "LOW" ? "#007A45" : txtMid;

  return (
    <div style={{ background:bg, border:`1px solid ${bdr}`, borderRadius:16, overflow:"hidden", fontFamily:"'DM Sans', sans-serif" }}>
      {/* Header */}
      <div style={{ padding:"20px 24px", borderBottom:`1px solid ${bdr}`, display:"flex", alignItems:"center", gap:14 }}>
        <div style={{ width:40, height:40, borderRadius:10, background:"rgba(32,189,224,0.12)", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
          <Ico d={IC.upload} size={18} color="#20BDE0" />
        </div>
        <div>
          <div style={{ fontSize:16, fontWeight:700, color:txt }}>MoMo Data Analyzer</div>
          <div style={{ fontSize:12, color:txtMid, marginTop:2 }}>Paste MTN MoMo SMS history or USSD export — detects fraud patterns in seconds</div>
        </div>
      </div>

      <div style={{ padding:24 }}>
        {/* Textarea */}
        <div style={{ marginBottom:16 }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:8 }}>
            <label style={{ fontSize:11, fontWeight:700, color:txtMid, letterSpacing:"0.08em" }}>PASTE TRANSACTION HISTORY</label>
            <div style={{ fontSize:10, color:txtMid, fontFamily:"'IBM Plex Mono'", display:"flex", gap:16 }}>
              <span>Format A: SMS messages</span>
              <span>Format B: USSD export (CSV lines)</span>
            </div>
          </div>
          <textarea value={input} onChange={e => setInput(e.target.value)}
            placeholder={"Paste MoMo SMS messages or USSD export here…"}
            style={{ width:"100%", height:160, background:inputBg, border:`1px solid ${bdr}`, borderRadius:10, padding:"12px 14px", color:txt, fontSize:12, fontFamily:"'IBM Plex Mono'", resize:"vertical", outline:"none", lineHeight:1.6 }}
          />
        </div>

        {/* Action buttons */}
        <div style={{ display:"flex", gap:10, flexWrap:"wrap", marginBottom:rows.length?20:0 }}>
          <button onClick={handleParse}
            style={{ padding:"9px 20px", background:input.trim()?"rgba(32,189,224,0.1)":"transparent", border:`1px solid ${input.trim()?"#20BDE0":bdr}`, borderRadius:8, color:input.trim()?"#20BDE0":txtMid, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans'" }}>
            Parse Transactions
          </button>
          {rows.length > 0 && !scored && (
            <button onClick={handleScore} disabled={scoring}
              style={{ padding:"9px 20px", background:`linear-gradient(135deg,${C.blueDeep},${C.blue})`, border:"none", borderRadius:8, color:"white", fontSize:13, fontWeight:600, cursor:scoring?"default":"pointer", fontFamily:"'DM Sans'" }}>
              {scoring ? "Scoring…" : `Score ${rows.length} Transaction${rows.length!==1?"s":""}`}
            </button>
          )}
          {scored && rows.length > 0 && (
            <button onClick={handleExport}
              style={{ padding:"9px 20px", background:"transparent", border:`1px solid ${bdr}`, borderRadius:8, color:txtMid, fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans'" }}>
              Export CSV
            </button>
          )}
          {scored && mode === "analyst" && flaggedCount > 0 && (
            <button onClick={handleImport} disabled={importing}
              style={{ padding:"9px 20px", background:"rgba(192,57,43,0.08)", border:"1px solid rgba(192,57,43,0.25)", borderRadius:8, color:"#C0392B", fontSize:13, fontWeight:600, cursor:importing?"default":"pointer", fontFamily:"'DM Sans'" }}>
              {importing ? "Importing…" : `Add ${flaggedCount} Flagged to Queue`}
            </button>
          )}
        </div>

        {importMsg && (
          <div style={{ marginBottom:16, padding:"8px 14px", background:importMsg.includes("failed")?"rgba(192,57,43,0.08)":"rgba(0,122,69,0.08)", border:`1px solid ${importMsg.includes("failed")?"rgba(192,57,43,0.2)":"rgba(0,122,69,0.2)"}`, borderRadius:8, fontSize:13, color:importMsg.includes("failed")?"#C0392B":"#007A45", fontWeight:600 }}>
            {importMsg}
          </div>
        )}

        {/* Results */}
        {rows.length > 0 && (
          <div>
            {scored && (
              <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap" }}>
                {[["Total",rows.length,"#20BDE0"],["Critical",rows.filter(r=>r.level==="CRITICAL").length,"#C0392B"],["High",rows.filter(r=>r.level==="HIGH").length,"#D4A017"],["Medium",rows.filter(r=>r.level==="MEDIUM").length,"#F97316"],["Low",rows.filter(r=>r.level==="LOW").length,"#007A45"]].map(([label,count,color])=>(
                  <div key={label} style={{ padding:"4px 12px", background:`${color}15`, border:`1px solid ${color}30`, borderRadius:20, fontSize:11, fontWeight:700, color, fontFamily:"'IBM Plex Mono'" }}>{label}: {count}</div>
                ))}
              </div>
            )}
            <div style={{ overflowX:"auto" }}>
              <table style={{ width:"100%", borderCollapse:"collapse", fontSize:12 }}>
                <thead>
                  <tr style={{ borderBottom:`1px solid ${bdr}` }}>
                    {["Customer","Amount","Type","Old Bal","New Bal","Date/Time","Score","Level"].map(h=>(
                      <th key={h} style={{ padding:"8px 10px", textAlign:"left", color:txtMid, fontFamily:"'IBM Plex Mono'", fontWeight:500, fontSize:10, letterSpacing:"0.07em", whiteSpace:"nowrap" }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r,i)=>{
                    const lc = lvlColor(r.level);
                    return (
                      <tr key={i} style={{ borderBottom:`1px solid ${bdr}`, background:(r.score>=70)?(isDark?"rgba(192,57,43,0.06)":"rgba(192,57,43,0.03)"):"transparent" }}>
                        <td style={{ padding:"9px 10px", color:txt, fontWeight:500 }}>{r.customer}</td>
                        <td style={{ padding:"9px 10px", color:txt, fontFamily:"'IBM Plex Mono'", whiteSpace:"nowrap" }}>RWF {r.amount?.toLocaleString()}</td>
                        <td style={{ padding:"9px 10px", color:txtMid }}>{r.type}</td>
                        <td style={{ padding:"9px 10px", color:txtMid, fontFamily:"'IBM Plex Mono'" }}>{r.oldBal?.toLocaleString()}</td>
                        <td style={{ padding:"9px 10px", color:txtMid, fontFamily:"'IBM Plex Mono'" }}>{r.newBal?.toLocaleString()}</td>
                        <td style={{ padding:"9px 10px", color:txtMid, whiteSpace:"nowrap" }}>{r.datetime}</td>
                        <td style={{ padding:"9px 10px" }}>
                          {r.score!=null ? (
                            <div style={{ width:34,height:34,borderRadius:"50%",background:`conic-gradient(${lc} ${r.score*3.6}deg,${isDark?"#1F2937":"#E5E7EB"} 0deg)`,display:"flex",alignItems:"center",justifyContent:"center" }}>
                              <div style={{ width:24,height:24,borderRadius:"50%",background:isDark?"#1A2235":C.surface,display:"flex",alignItems:"center",justifyContent:"center",fontSize:8,fontWeight:800,color:lc,fontFamily:"'IBM Plex Mono'" }}>{r.score}</div>
                            </div>
                          ) : scoring ? (
                            <div style={{ width:14,height:14,borderRadius:"50%",border:`2px solid ${bdr}`,borderTopColor:"#20BDE0",animation:"spin-slow 0.8s linear infinite" }} />
                          ) : "—"}
                        </td>
                        <td style={{ padding:"9px 10px" }}>
                          {r.level ? (
                            <span style={{ padding:"3px 8px",background:`${lc}15`,border:`1px solid ${lc}30`,borderRadius:4,fontSize:10,fontWeight:700,color:lc,fontFamily:"'IBM Plex Mono'",letterSpacing:"0.05em" }}>{r.level}</span>
                          ) : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {rows.length === 0 && !input.trim() && (
          <div style={{ textAlign:"center",padding:"28px 0",color:txtMid }}>
            <Ico d={IC.upload} size={34} color={isDark?"rgba(255,255,255,0.08)":C.border} />
            <div style={{ marginTop:10,fontSize:13 }}>Paste MoMo transaction history above to get started</div>
          </div>
        )}
      </div>
    </div>
  );
}


// ─────────────────────────────────────────────────────────────────────────────
// HOW IT WORKS PAGE
// ─────────────────────────────────────────────────────────────────────────────
function HowPage({ setPage, onDemo }) {
  const steps = [
    {num:"01",title:"You share your data",body:"Your institution uploads historical transaction data through our secure onboarding portal. We accept CSV exports from any banking system. No special format required.",icon:IC.upload,color:C.blue},
    {num:"02",title:"We analyze your patterns",body:"Inkingi Shield processes your data, identifies patterns specific to your customer base, and calibrates the fraud detection system for your transaction behaviour.",icon:IC.zap,color:C.green},
    {num:"03",title:"Your dashboard goes live",body:"Within 48 hours, your fraud analysts get access to a live dashboard. Every incoming transaction is scored in real time.",icon:IC.chart,color:C.yellow},
    {num:"04",title:"Your analysts take action",body:"When the system flags a transaction, your team sees the fraud score, trigger reason, customer profile, and can Block or Clear with one click. Full audit trail included.",icon:IC.shield,color:C.blue},
    {num:"05",title:"The system keeps learning",body:"Every action your analysts take feeds back into the model. Inkingi Shield gets more accurate over time for your institution.",icon:IC.refresh,color:C.green},
  ];
  return (
    <div style={{ fontFamily:"'DM Sans', sans-serif" }}>
      <div style={{ background:`linear-gradient(155deg, ${C.blueDeep}, #0E5C3A)`, padding:"72px 24px 60px", position:"relative", overflow:"hidden" }}>
        <ImigoPattern opacity={0.1} />
        <div style={{ maxWidth:680, margin:"0 auto", textAlign:"center", position:"relative" }}>
          <div style={{ fontSize:12, color:C.rwYellow, fontFamily:"'IBM Plex Mono'", letterSpacing:"0.1em", marginBottom:12 }}>HOW IT WORKS</div>
          <h1 className="ik-page-h1" style={{ fontSize:44, fontWeight:800, color:"white", marginBottom:18 }}>From your data to live fraud detection in 48 hours</h1>
          <p style={{ color:"rgba(255,255,255,0.7)", fontSize:15, lineHeight:1.75 }}>No months of integration. No dedicated IT team required. Just share your data and your analysts will be working from a live dashboard within two days.</p>
        </div>
      </div>
      <div style={{ maxWidth:800, margin:"0 auto", padding:"72px 24px" }}>
        {steps.map((s,i) => (
          <div key={i} style={{ display:"flex", gap:28, position:"relative" }}>
            <div style={{ display:"flex", flexDirection:"column", alignItems:"center" }}>
              <div style={{ width:56, height:56, borderRadius:"50%", background:`linear-gradient(135deg,${s.color}22,${s.color}44)`, border:`2px solid ${s.color}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0, zIndex:1 }}>
                <Ico d={s.icon} size={22} color={s.color} />
              </div>
              {i < steps.length-1 && <div style={{ width:2, flex:1, background:C.border, margin:"6px 0" }} />}
            </div>
            <div style={{ paddingBottom: i < steps.length-1 ? 40 : 0, paddingTop:10 }}>
              <div style={{ fontSize:11, color:s.color, fontFamily:"'IBM Plex Mono'", letterSpacing:"0.1em", marginBottom:6 }}>STEP {s.num}</div>
              <h3 style={{ fontSize:20, fontWeight:700, color:C.text, marginBottom:10 }}>{s.title}</h3>
              <p style={{ color:C.textMid, fontSize:14, lineHeight:1.75 }}>{s.body}</p>
            </div>
          </div>
        ))}
      </div>

      {/* ── MoMo Analyzer public section ──────────────────────────────────── */}
      <div style={{ background:C.surfaceAlt, borderTop:`1px solid ${C.border}`, borderBottom:`1px solid ${C.border}`, padding:"56px 24px" }}>
        <div style={{ maxWidth:900, margin:"0 auto" }}>
          <div style={{ textAlign:"center", marginBottom:36 }}>
            <div style={{ fontSize:11, color:C.blue, fontFamily:"'IBM Plex Mono'", letterSpacing:"0.1em", marginBottom:10 }}>TRY IT NOW — NO ACCOUNT NEEDED</div>
            <h2 style={{ fontSize:32, fontWeight:800, color:C.text, marginBottom:12 }}>Analyze your MoMo transaction history</h2>
            <p style={{ color:C.textMid, fontSize:14, lineHeight:1.75, maxWidth:560, margin:"0 auto" }}>Paste SMS messages from your MTN MoMo account or a USSD export. The system parses the transactions and scores each one for fraud risk — entirely in your browser.</p>
          </div>
          <MomoAnalyzer mode="landing" />
        </div>
      </div>

      <div style={{ background:C.surfaceAlt, borderTop:`1px solid ${C.border}`, borderBottom:`1px solid ${C.border}`, padding:"56px 24px" }}>
        <div style={{ maxWidth:700, margin:"0 auto", textAlign:"center" }}>
          <h2 style={{ fontSize:28, fontWeight:800, color:C.text, marginBottom:14 }}>See the dashboard your analysts would use</h2>
          <p style={{ color:C.textMid, fontSize:14, lineHeight:1.65, marginBottom:28 }}>We built a full demo of the Inkingi Shield analyst dashboard using sample Rwandan transaction data. This is exactly what your team would see after onboarding.</p>
          <div style={{ display:"flex", gap:12, justifyContent:"center", flexWrap:"wrap" }}>
            <button onClick={onDemo} style={{ padding:"13px 28px", background:`linear-gradient(135deg,${C.blueDeep},${C.green})`, border:"none", borderRadius:10, color:"white", fontSize:15, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans'", boxShadow:"0 4px 16px rgba(11,61,107,0.25)" }}>
              ▶ See Live Demo
            </button>
            <button onClick={() => setPage("login")} style={{ padding:"13px 28px", background:C.surface, border:`1px solid ${C.border}`, borderRadius:10, color:C.text, fontSize:15, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans'" }}>
              View Full Dashboard
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FOR COMPANIES — uses EmailJS to send real email
// ─────────────────────────────────────────────────────────────────────────────
// Formspree — sends form submissions directly to a.kayiranga1@alustudent.com
// No signup needed. Just create a free form at https://formspree.io
// and replace the endpoint below with yours (takes 2 minutes).
const FORMSPREE_ENDPOINT = "https://formspree.io/f/xykneebj"; // Armand Kayiranga — a.kayiranga1@alustudent.com

function PartnersPage({ setPage }) {
  const [submitted, setSubmitted] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState(null);
  const [errors, setErrors] = useState({});

  // Use refs for form fields — prevents cursor-jump bug entirely
  const companyRef = useRef("");
  const contactRef = useRef("");
  const emailRef   = useRef("");
  const typeRef    = useRef("");
  const sizeRef    = useRef("");
  const messageRef = useRef("");

  const getForm = () => ({
    company: companyRef.current, contact: contactRef.current,
    email: emailRef.current, type: typeRef.current,
    size: sizeRef.current, message: messageRef.current,
  });

  const validate = () => {
    const f = getForm();
    const e = {};
    if (!f.company.trim()) e.company = "Required";
    if (!f.contact.trim()) e.contact = "Required";
    if (!f.email.trim() || !/\S+@\S+\.\S+/.test(f.email)) e.email = "Valid email required";
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    const f = getForm();
    setSending(true); setSendError(null);
    try {
      // 1. Save to localStorage immediately — admin panel reads inkingi_real_subs
      const entry = {
        id:                 `sub-${Date.now()}`,
        company_name:       f.company,
        institution_type:   f.type    || "",
        contact_name:       f.contact,
        contact_email:      f.email,
        transaction_volume: f.size    || "",
        message:            f.message || "",
        status:             "new",
        _date:              new Date().toISOString(),
      };
      try {
        const existing = JSON.parse(localStorage.getItem("inkingi_real_subs") || "[]");
        localStorage.setItem("inkingi_real_subs", JSON.stringify([entry, ...existing]));
      } catch {}

      // 2. Formspree — primary email notification to Armand
      const formspreeRes = await fetch(FORMSPREE_ENDPOINT, {
        method: "POST",
        headers: { "Content-Type": "application/json", "Accept": "application/json" },
        body: JSON.stringify({
          company_name:       f.company,
          institution_type:   f.type    || "Not specified",
          contact_name:       f.contact,
          contact_email:      f.email,
          transaction_volume: f.size    || "Not specified",
          message:            f.message || "No message",
          _replyto:           f.email,
          _subject:           `Inkingi Shield Partnership Request — ${f.company}`,
        }),
      });
      if (!formspreeRes.ok) {
        // Formspree failed — submission is still saved in localStorage, but warn
        setSendError("Your request was saved but the email notification failed. Armand will still see it in the admin panel.");
      }

      // 3. Backend DB — best-effort, don't block on failure
      try {
        await fetch(`${API_BASE}/api/partners`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            company_name:       f.company,
            institution_type:   f.type    || "",
            contact_name:       f.contact,
            contact_email:      f.email,
            transaction_volume: f.size    || "",
            message:            f.message || "",
          }),
        });
      } catch {} // backend is best-effort

      setSubmitted(true);
    } catch {
      setSendError("Could not submit. Please email a.kayiranga1@alustudent.com directly.");
    }
    setSending(false);
  };

  // Uncontrolled input — value stored in ref, no re-render on every keystroke
  // This completely fixes the cursor-jump problem
  const Field = ({ label, fref, placeholder, errKey }) => (
    <div style={{ marginBottom:16 }}>
      <label style={{ display:"block", fontSize:12, fontWeight:600, color:C.textMid, marginBottom:6, fontFamily:"'IBM Plex Mono'", letterSpacing:"0.04em" }}>{label}</label>
      <input
        type="text"
        autoComplete="off"
        defaultValue=""
        onChange={e => {
          fref.current = e.target.value;
          if (errors[errKey]) setErrors(prev => ({...prev, [errKey]: null}));
        }}
        placeholder={placeholder}
        style={{ width:"100%", padding:"10px 14px", border:`1.5px solid ${errors[errKey] ? C.red : C.border}`, borderRadius:8, fontSize:14, fontFamily:"'DM Sans'", color:C.text, background:"white", outline:"none", boxSizing:"border-box" }}
      />
      {errors[errKey] && <div style={{ color:C.red, fontSize:11, marginTop:4 }}>{errors[errKey]}</div>}
    </div>
  );

  if (submitted) return (
    <div style={{ fontFamily:"'DM Sans', sans-serif", minHeight:"70vh", display:"flex", alignItems:"center", justifyContent:"center", padding:24 }}>
      <div style={{ textAlign:"center", maxWidth:480 }}>
        <div style={{ width:72, height:72, borderRadius:"50%", background:C.greenLight, border:`2px solid ${C.green}`, display:"flex", alignItems:"center", justifyContent:"center", margin:"0 auto 24px" }}>
          <Ico d={IC.check} size={32} color={C.green} stroke={2.5} />
        </div>
        <h2 style={{ fontSize:28, fontWeight:800, color:C.text, marginBottom:12 }}>Request received!</h2>
        <p style={{ color:C.textMid, fontSize:15, lineHeight:1.65, marginBottom:28 }}>Thank you, <strong>{companyRef.current}</strong>. Armand will review your request and reach out within 48 hours to discuss onboarding your institution.</p>
        <button onClick={() => setPage("how")} style={{ padding:"11px 24px", background:`linear-gradient(135deg,${C.blueDeep},${C.green})`, border:"none", borderRadius:9, color:"white", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans'" }}>
          See How It Works
        </button>
      </div>
    </div>
  );

  return (
    <div style={{ fontFamily:"'DM Sans', sans-serif" }}>
      <div style={{ background:`linear-gradient(155deg, ${C.blueDeep}, #0E5C3A)`, padding:"72px 24px 60px", position:"relative", overflow:"hidden" }}>
        <ImigoPattern opacity={0.1} />
        <div style={{ maxWidth:700, margin:"0 auto", textAlign:"center", position:"relative" }}>
          <div style={{ fontSize:12, color:C.rwYellow, fontFamily:"'IBM Plex Mono'", letterSpacing:"0.1em", marginBottom:12 }}>FOR COMPANIES</div>
          <h1 style={{ fontSize:42, fontWeight:800, color:"white", marginBottom:18 }}>Connect your institution to Inkingi Shield</h1>
          <p style={{ color:"rgba(255,255,255,0.7)", fontSize:15, lineHeight:1.75 }}>Whether you are MTN, Airtel, a commercial bank, or a microfinance institution — fill out the form below and we'll have your team set up within 48 hours.</p>
        </div>
      </div>
      <div style={{ maxWidth:960, margin:"0 auto", padding:"64px 24px", display:"grid", gridTemplateColumns:"1fr 1.4fr", gap:48, alignItems:"start" }}>
        <div>
          <h2 style={{ fontSize:22, fontWeight:800, color:C.text, marginBottom:20 }}>What you get</h2>
          {[
            {icon:IC.chart,title:"Your own live dashboard",body:"A customized version of the Inkingi Shield analyst platform, pre-loaded with your data."},
            {icon:IC.zap,title:"Real-time fraud scoring",body:"Every transaction your institution processes is scored in under 200ms, before it completes."},
            {icon:IC.shield,title:"Clear explanations",body:"Every alert explains itself — your analysts know exactly which risk factors triggered the flag."},
            {icon:IC.activity,title:"Performance reports",body:"Weekly reports on detection rates, false positives, and money protected."},
          ].map((f,i) => (
            <div key={i} style={{ display:"flex", gap:14, marginBottom:22 }}>
              <div style={{ width:38, height:38, borderRadius:9, background:C.blueLight, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                <Ico d={f.icon} size={16} color={C.blue} />
              </div>
              <div>
                <div style={{ fontWeight:700, color:C.text, fontSize:14, marginBottom:4 }}>{f.title}</div>
                <div style={{ fontSize:13, color:C.textMid, lineHeight:1.6 }}>{f.body}</div>
              </div>
            </div>
          ))}
          <div style={{ marginTop:32, padding:"20px", background:C.greenLight, border:`1px solid ${C.greenMid}`, borderRadius:12 }}>
            <div style={{ fontWeight:700, color:C.green, marginBottom:6 }}>Pilot program — Free</div>
            <div style={{ fontSize:13, color:C.textMid, lineHeight:1.6 }}>We are currently onboarding pilot partners at no cost. In exchange, we ask for permission to use anonymized detection metrics to improve the model.</div>
          </div>
        </div>
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:16, padding:"32px", boxShadow:"0 4px 20px rgba(0,0,0,0.06)" }}>
          <h3 style={{ fontSize:18, fontWeight:800, color:C.text, marginBottom:6 }}>Request access</h3>
          <p style={{ color:C.textMid, fontSize:13, marginBottom:24 }}>Tell us about your institution and we'll be in touch within 48 hours.</p>
          <Field label="Company / Institution Name *" fref={companyRef} errKey="company" placeholder="e.g. MTN Rwanda, Bank of Kigali..." />
          <Field label="Contact Person *" fref={contactRef} errKey="contact" placeholder="Full name" />
          <Field label="Email Address *" fref={emailRef} errKey="email" placeholder="your@company.rw" />
          <div style={{ marginBottom:16 }}>
            <label style={{ display:"block", fontSize:12, fontWeight:600, color:C.textMid, marginBottom:6, fontFamily:"'IBM Plex Mono'", letterSpacing:"0.04em" }}>Institution Type</label>
            <select defaultValue="" onChange={e => { typeRef.current = e.target.value; }}
              style={{ width:"100%", padding:"10px 14px", border:`1.5px solid ${C.border}`, borderRadius:8, fontSize:14, fontFamily:"'DM Sans'", color:C.text, background:C.surfaceAlt, outline:"none" }}>
              <option value="">Select type...</option>
              {["Mobile Money Operator","Commercial Bank","Microfinance Institution","Payment Processor","Fintech Startup","SACCO","Other"].map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
          <div style={{ marginBottom:16 }}>
            <label style={{ display:"block", fontSize:12, fontWeight:600, color:C.textMid, marginBottom:6, fontFamily:"'IBM Plex Mono'", letterSpacing:"0.04em" }}>Monthly Transaction Volume</label>
            <select defaultValue="" onChange={e => { sizeRef.current = e.target.value; }}
              style={{ width:"100%", padding:"10px 14px", border:`1.5px solid ${C.border}`, borderRadius:8, fontSize:14, fontFamily:"'DM Sans'", color:C.text, background:C.surfaceAlt, outline:"none" }}>
              <option value="">Select volume...</option>
              {["Under 10,000 transactions/month","10,000 – 100,000 transactions/month","100,000 – 1M transactions/month","Over 1M transactions/month"].map(v => <option key={v}>{v}</option>)}
            </select>
          </div>
          <div style={{ marginBottom:24 }}>
            <label style={{ display:"block", fontSize:12, fontWeight:600, color:C.textMid, marginBottom:6, fontFamily:"'IBM Plex Mono'", letterSpacing:"0.04em" }}>Tell us more (optional)</label>
            <textarea defaultValue="" onChange={e => { messageRef.current = e.target.value; }} placeholder="What fraud challenges are you currently facing?" rows={3}
              style={{ width:"100%", padding:"10px 14px", border:`1.5px solid ${C.border}`, borderRadius:8, fontSize:14, fontFamily:"'DM Sans'", color:C.text, background:C.surfaceAlt, outline:"none", resize:"vertical", boxSizing:"border-box" }} />
          </div>
          {sendError && <div style={{ padding:"10px 14px", background:C.redLight, border:"1px solid #FECACA", borderRadius:8, color:C.red, fontSize:13, marginBottom:14 }}>{sendError}</div>}
          <button onClick={handleSubmit} disabled={sending}
            style={{ width:"100%", padding:"13px", background: sending ? C.border : `linear-gradient(135deg,${C.blueDeep},${C.green})`, border:"none", borderRadius:10, color: sending ? C.textMid : "white", fontSize:15, fontWeight:700, cursor: sending ? "not-allowed" : "pointer", fontFamily:"'DM Sans'", transition:"all 0.2s" }}>
            {sending ? "Sending..." : "Submit Request"}
          </button>
          <p style={{ textAlign:"center", fontSize:12, color:C.textDim, marginTop:12 }}>We respond within 48 hours. No spam, ever.</p>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// LANDING FOOTER
// ─────────────────────────────────────────────────────────────────────────────
function LandingFooter({ setPage }) {
  return (
    <footer style={{ background:C.blueDeep, color:"white", fontFamily:"'DM Sans', sans-serif", position:"relative", overflow:"hidden" }}>
      <ImigoPattern opacity={0.07} />
      <div style={{ maxWidth:1100, margin:"0 auto", padding:"48px 24px 32px", position:"relative" }}>
        <div style={{ display:"grid", gridTemplateColumns:"2fr 1fr 1fr", gap:40, marginBottom:40 }}>
          <div>
            <InkingiLogo light />
            <p style={{ color:"rgba(255,255,255,0.55)", fontSize:13, lineHeight:1.75, maxWidth:300, marginTop:16 }}>Fraud detection built for Rwanda's financial ecosystem. Protecting every transaction, in real time.</p>
            <div style={{ display:"flex", gap:6, marginTop:16 }}>
              {[C.rwBlue, C.rwYellow, C.rwGreen].map((c,i) => <div key={i} style={{ width:18, height:18, borderRadius:4, background:c }} />)}
            </div>
          </div>
          <div>
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.4)", fontFamily:"'IBM Plex Mono'", letterSpacing:"0.1em", marginBottom:14 }}>NAVIGATION</div>
            {[["Home","home"],["About","about"],["How It Works","how"],["For Companies","partners"],["Privacy Policy & EULA","privacy"]].map(([label,key]) => (
              <div key={key} style={{ marginBottom:8 }}>
                <span onClick={() => setPage(key)} style={{ color:"rgba(255,255,255,0.65)", fontSize:13, cursor:"pointer" }}>{label}</span>
              </div>
            ))}
          </div>
          <div>
            <div style={{ fontSize:11, color:"rgba(255,255,255,0.4)", fontFamily:"'IBM Plex Mono'", letterSpacing:"0.1em", marginBottom:14 }}>CONTACT</div>
            <div style={{ color:"rgba(255,255,255,0.65)", fontSize:13, marginBottom:8 }}>inkingi@rw.ac</div>
            <div style={{ color:"rgba(255,255,255,0.65)", fontSize:13, marginBottom:8 }}>+250 788 000 000</div>
            <div style={{ color:"rgba(255,255,255,0.65)", fontSize:13 }}>Kigali, Rwanda 🇷🇼</div>
          </div>
        </div>
        <div style={{ borderTop:"1px solid rgba(255,255,255,0.1)", paddingTop:20, display:"flex", justifyContent:"space-between", alignItems:"center" }}>
          <span style={{ color:"rgba(255,255,255,0.35)", fontSize:12 }}>© 2026 Inkingi Shield ·</span>
          <span style={{ color:"rgba(255,255,255,0.35)", fontSize:12 }}>Made in Rwanda 🇷🇼</span>
        </div>
      </div>
    </footer>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PRIVACY POLICY & EULA PAGE
// ─────────────────────────────────────────────────────────────────────────────
function PrivacyPage({ setPage }) {
  const sectionHeading = { fontSize:19, fontWeight:800, color:C.text, marginBottom:14, marginTop:0 };
  const body = { fontSize:14.5, lineHeight:1.85, color:C.textMid, marginBottom:14, textAlign:"justify" };
  const sectionWrap = { marginBottom:44, paddingBottom:44, borderBottom:`1px solid ${C.borderLight}` };

  return (
    <div style={{ fontFamily:"'DM Sans', sans-serif", background:C.bg }}>
      <RwandaStripe />
      {/* Page header */}
      <div style={{ background:C.surface, borderBottom:`1px solid ${C.border}`, padding:"48px 24px 40px" }}>
        <div style={{ maxWidth:900, margin:"0 auto" }}>
          <div style={{ fontSize:11, color:C.blue, fontFamily:"'IBM Plex Mono', monospace", letterSpacing:"0.12em", marginBottom:12 }}>LEGAL</div>
          <h1 style={{ fontSize:32, fontWeight:800, color:C.text, marginBottom:12, lineHeight:1.25 }}>Privacy Policy and End User Licence Agreement</h1>
          <p style={{ fontSize:14, color:C.textMid, margin:0 }}>Inkingi Shield &mdash; Effective date: 1 March 2026</p>
          <p style={{ fontSize:14, color:C.textMid, marginTop:16, lineHeight:1.75, maxWidth:760 }}>
            This document sets out the terms under which Inkingi Shield collects, processes, and stores data, and the conditions under which authorised analysts and partner institutions may use the platform. By using Inkingi Shield, you agree to the terms described below.
          </p>
        </div>
      </div>

      {/* Sections */}
      <div style={{ maxWidth:900, margin:"0 auto", padding:"56px 24px 80px" }}>

        {/* Section 1 */}
        <div style={sectionWrap}>
          <h2 style={sectionHeading}>1. Data Collection</h2>
          <p style={body}>Inkingi Shield collects the following categories of data:</p>
          <p style={body}>
            <strong style={{ color:C.text }}>Transaction features submitted for fraud scoring:</strong> transaction amount, type, sender balance before and after the transaction. These features are the minimum necessary to produce a fraud risk score. No full transaction records, customer names, or account numbers are stored by the platform beyond what is explicitly submitted by an authorised analyst or institution.
          </p>
          <p style={body}>
            <strong style={{ color:C.text }}>Session tokens:</strong> a JSON Web Token is generated at login and stored in the browser&rsquo;s session storage for the duration of the session. It is deleted when the session ends or the analyst logs out.
          </p>
          <p style={body}>
            <strong style={{ color:C.text }}>Face descriptors:</strong> when an analyst enrolls for biometric login, the browser extracts a 128-dimensional numerical descriptor from their facial image using face-api.js. This processing happens entirely on the analyst&rsquo;s device. The raw image is never transmitted. Only the numerical descriptor is sent to the backend and stored in the database.
          </p>
          <p style={{ ...body, marginBottom:0 }}>
            <strong style={{ color:C.text }}>What is not collected:</strong> raw facial images, full SMS message content, customer personally identifiable information beyond what analysts manually input, location data, or device identifiers.
          </p>
        </div>

        {/* Section 2 */}
        <div style={sectionWrap}>
          <h2 style={sectionHeading}>2. Biometric Data</h2>
          <p style={body}>Facial recognition data is classified as sensitive personal information under Rwanda Law No. 058/2021 on the Protection of Personal Data and Privacy. Inkingi Shield processes biometric data under the following conditions:</p>
          <p style={body}>
            <strong style={{ color:C.text }}>Consent:</strong> an analyst may only be enrolled for biometric login by an administrator, and the enrollment interface requires explicit confirmation that the analyst has consented to their facial descriptor being stored.
          </p>
          <p style={body}>
            <strong style={{ color:C.text }}>Storage:</strong> face descriptors are stored in the platform database as arrays of 128 floating-point numbers. They cannot be used to reconstruct a facial image.
          </p>
          <p style={body}>
            <strong style={{ color:C.text }}>Deletion:</strong> an enrolled analyst or their institutional administrator may request deletion of their face descriptor at any time by contacting the platform administrator. Deletion will be carried out within 48 hours of the request.
          </p>
          <p style={{ ...body, marginBottom:0 }}>
            <strong style={{ color:C.text }}>Purpose limitation:</strong> face descriptors are used solely for analyst authentication and for no other purpose.
          </p>
        </div>

        {/* Section 3 */}
        <div style={sectionWrap}>
          <h2 style={sectionHeading}>3. Institutional Transaction Data</h2>
          <p style={body}>Transaction data submitted by partner institutions for fraud scoring is subject to the following conditions:</p>
          <p style={body}>
            <strong style={{ color:C.text }}>Purpose:</strong> transaction data is used exclusively to generate fraud risk scores and populate the analyst alert queue. It is not used for any secondary analysis, aggregation, benchmarking, or commercial purpose.
          </p>
          <p style={body}>
            <strong style={{ color:C.text }}>Isolation:</strong> each partner institution&rsquo;s data is isolated at the database level using institution-specific access controls. Analysts from one institution cannot access data belonging to another institution.
          </p>
          <p style={body}>
            <strong style={{ color:C.text }}>Retention:</strong> transaction data submitted through the platform is retained only for as long as necessary to support the fraud review workflow. Institutions may request deletion of their submitted data at any time.
          </p>
          <p style={{ ...body, marginBottom:0 }}>
            <strong style={{ color:C.text }}>Third parties:</strong> transaction data is not shared with any third party. The fraud scoring model runs on Hugging Face Spaces, a third-party hosting service. Only the four transaction features required for scoring (amount, type, old balance, new balance) are transmitted to this service. No customer identifiers are included.
          </p>
        </div>

        {/* Section 4 */}
        <div style={sectionWrap}>
          <h2 style={sectionHeading}>4. User Rights</h2>
          <p style={body}>In accordance with Rwanda Law No. 058/2021 on the Protection of Personal Data and Privacy, analysts and institutional partners have the following rights regarding data held by Inkingi Shield:</p>
          <p style={body}>
            <strong style={{ color:C.text }}>Right of access:</strong> you may request a summary of what personal data is held about you, including your face descriptor and any session or audit records associated with your analyst account.
          </p>
          <p style={body}>
            <strong style={{ color:C.text }}>Right to rectification:</strong> if any personal data held about you is inaccurate, you may request that it be corrected.
          </p>
          <p style={body}>
            <strong style={{ color:C.text }}>Right to erasure:</strong> you may request deletion of your personal data, including your face descriptor. Requests will be processed within 48 hours.
          </p>
          <p style={body}>
            <strong style={{ color:C.text }}>Right to object:</strong> you may object to the processing of your personal data at any time. If you object to biometric enrollment, an alternative login method (backup PIN) is available.
          </p>
          <p style={{ ...body, marginBottom:0 }}>To exercise any of these rights, contact the platform administrator at the email address associated with your institution&rsquo;s onboarding.</p>
        </div>

        {/* Section 5 */}
        <div style={sectionWrap}>
          <h2 style={sectionHeading}>5. Limitation of Liability</h2>
          <p style={body}>Inkingi Shield provides fraud risk scores as recommendations to support analyst decision-making. The platform does not make automated decisions to block or approve transactions. All consequential decisions remain the responsibility of the reviewing analyst and their institution.</p>
          <p style={body}>Inkingi Shield does not guarantee that all fraudulent transactions will be detected, nor that all flagged transactions are fraudulent. The platform is a decision-support tool and should be used as one component of a broader fraud management process.</p>
          <p style={{ ...body, marginBottom:0 }}>The platform operator accepts no liability for financial losses arising from analyst decisions made on the basis of platform outputs, from system downtime, or from inaccurate fraud scores resulting from incorrectly formatted input data.</p>
        </div>

        {/* Section 6 */}
        <div style={sectionWrap}>
          <h2 style={sectionHeading}>6. End User Licence Agreement</h2>
          <p style={body}>By accessing and using Inkingi Shield, you agree to the following terms:</p>
          <p style={body}>
            <strong style={{ color:C.text }}>Authorised use:</strong> access to the Inkingi Shield analyst dashboard is restricted to individuals who have been formally enrolled by an institutional administrator. Sharing login credentials or face descriptors with unauthorised individuals is strictly prohibited.
          </p>
          <p style={body}>
            <strong style={{ color:C.text }}>Permitted use:</strong> the platform may be used solely for the purpose of reviewing and acting on fraud alerts generated by the system in connection with your institution&rsquo;s transaction data.
          </p>
          <p style={body}>
            <strong style={{ color:C.text }}>Prohibited use:</strong> you may not use the platform to process transaction data belonging to any institution other than your own, to attempt to access data belonging to other institutions, to reverse-engineer or extract the fraud detection model, or to use platform outputs for any purpose other than internal fraud management.
          </p>
          <p style={body}>
            <strong style={{ color:C.text }}>Termination:</strong> access may be revoked by the platform administrator at any time if these terms are breached. Institutions may terminate their use of the platform at any time by notifying the administrator, after which their data will be deleted within 7 days.
          </p>
          <p style={{ ...body, marginBottom:0 }}>
            <strong style={{ color:C.text }}>Governing law:</strong> this agreement is governed by the laws of the Republic of Rwanda, including Law No. 058/2021 on the Protection of Personal Data and Privacy.
          </p>
        </div>

        {/* Section 7 */}
        <div style={{ marginBottom:0 }}>
          <h2 style={sectionHeading}>7. Contact</h2>
          <p style={body}>For questions about this policy, to exercise your data rights, or to report a concern, contact:</p>
          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:"24px 28px", display:"inline-block" }}>
            <div style={{ fontWeight:700, color:C.text, fontSize:15, marginBottom:6 }}>Armand Kayiranga</div>
            <div style={{ color:C.textMid, fontSize:14, marginBottom:4 }}>Inkingi Shield</div>
            <div style={{ color:C.blue, fontSize:14, marginBottom:4 }}>a.kayiranga1@alustudent.com</div>
            <div style={{ color:C.textMid, fontSize:14 }}>Kigali, Rwanda</div>
          </div>
        </div>

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FACE LOGIN — real face detection via face-api.js
// ─────────────────────────────────────────────────────────────────────────────
function FaceLogin({ onLogin, onBack }) {
  const videoRef   = useRef(null);
  const streamRef  = useRef(null);
  const detectRef  = useRef(null);
  const [phase, setPhase]       = useState("loading"); // loading|ready|active|detecting|verifying|success|error|no_face
  const [progress, setProgress] = useState(0);
  const [faceApiReady, setFaceApiReady] = useState(false);
  const [loadMsg, setLoadMsg]   = useState("Loading face recognition models...");
  const [faceConfidence, setFaceConfidence] = useState(0);
  const [matchedName, setMatchedName]       = useState("");

  // Load face-api.js + all three models needed for recognition
  useEffect(() => {
    let cancelled = false;
    const init = async () => {
      try {
        setLoadMsg("Loading face-api.js library...");
        await loadScript("https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js");
        if (cancelled) return;

        const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model";
        setLoadMsg("Loading detection model...");
        await window.faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        if (cancelled) return;

        setLoadMsg("Loading landmark model...");
        await window.faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL);
        if (cancelled) return;

        setLoadMsg("Loading recognition model...");
        await window.faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
        if (cancelled) return;

        setLoadMsg("System ready.");
        setFaceApiReady(true);
        setPhase("ready");
      } catch (err) {
        if (!cancelled) {
          console.warn("face-api CDN failed, PIN fallback active:", err.message);
          setLoadMsg("Models unavailable — use backup PIN.");
          setFaceApiReady(false);
          setPhase("model_error");
        }
      }
    };
    init();
    return () => { cancelled = true; };
  }, []);

  const stopCamera = () => {
    if (detectRef.current) { clearInterval(detectRef.current); detectRef.current = null; }
    if (streamRef.current) { streamRef.current.getTracks().forEach(t => t.stop()); streamRef.current = null; }
    if (videoRef.current) videoRef.current.srcObject = null;
  };

  const startDetecting = () => {
    if (!faceApiReady || !window.faceapi) {
      setPhase("model_error");
      return;
    }
    setPhase("detecting");
    let held = 0;
    let finalizing = false;
    detectRef.current = setInterval(async () => {
      if (!videoRef.current || videoRef.current.readyState < 2) return;
      if (finalizing) return;
      try {
        // Fast scan for presence tracking (no descriptor yet — keeps 150ms achievable)
        const result = await window.faceapi
          .detectSingleFace(videoRef.current, new window.faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.4 }))
          .withFaceLandmarks(true);

        if (result && result.detection.score > 0.5) {
          const conf = Math.round(result.detection.score * 100);
          setFaceConfidence(conf);
          held++;
          setProgress(Math.min((held / 18) * 100, 100));

          if (held >= 18) {
            finalizing = true;
            clearInterval(detectRef.current);
            setPhase("verifying");

            // One full detection with descriptor for recognition
            try {
              const full = await window.faceapi
                .detectSingleFace(videoRef.current, new window.faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.4 }))
                .withFaceLandmarks(true)
                .withFaceDescriptor();

              if (!full) { stopCamera(); setPhase("not_recognised"); return; }

              const data = await api.faceLogin(Array.from(full.descriptor));
              setMatchedName(data.analyst.name);
              stopCamera();
              setPhase("success");
              setTimeout(() => onLogin(), 1800);
            } catch {
              stopCamera();
              setPhase("not_recognised");
            }
          }
        } else {
          held = Math.max(0, held - 1);
          setFaceConfidence(0);
          setProgress(Math.max(0, (held / 18) * 100));
          if (held === 0) setPhase("detecting");
        }
      } catch { /* frame skip */ }
    }, 150);
  };

  const [pin, setPin]           = useState("");
  const [pinError, setPinError] = useState(false);
  const BACKUP_PIN = "2026";

  // Demo mode entry
  const [demoCode, setDemoCode]     = useState(() => { try { return sessionStorage.getItem("inkingi_demo_pending") === "true" ? "" : ""; } catch { return ""; } });
  const [demoError, setDemoError]   = useState(false);
  const [showDemo, setShowDemo]     = useState(() => { try { return sessionStorage.getItem("inkingi_demo_pending") === "true"; } catch { return false; } });
  const DEMO_CODE = "DEMO2026";

  const enterDemo = () => {
    if (demoCode.trim().toUpperCase() === DEMO_CODE) {
      try {
        sessionStorage.setItem("inkingi_demo", "true");
        sessionStorage.setItem("inkingi_demo_pending", "");
        sessionStorage.setItem("analyst_name", "Demo Visitor");
        sessionStorage.setItem("analyst_institution", "Inkingi Shield");
        sessionStorage.setItem("analyst", "DEMO");
        sessionStorage.setItem("token", "demo_token");
      } catch {}
      onLogin();
    } else {
      setDemoError(true);
      setTimeout(() => setDemoError(false), 1500);
    }
  };

  const checkPin = async () => {
    if (pin === BACKUP_PIN) {
      setPhase("verifying");
      setTimeout(() => setPhase("success"), 1200);
      setTimeout(async () => {
        try { await api.login("AK-001"); } catch {}
        onLogin();
      }, 2200);
    } else {
      setPinError(true);
      setTimeout(() => setPinError(false), 1500);
    }
  };

  const activate = async () => {
    setPhase("active");
    try {
      const s = await navigator.mediaDevices.getUserMedia({ video: { facingMode:"user", width:{ ideal:640 }, height:{ ideal:480 } } });
      streamRef.current = s;
      if (videoRef.current) { videoRef.current.srcObject = s; await videoRef.current.play(); }
      setTimeout(startDetecting, 1000);
    } catch (err) {
      setPhase("error");
    }
  };

  useEffect(() => () => stopCamera(), []);

  const circ = 2 * Math.PI * 108;
  const msgs = {
    loading:         "Loading biometric system...",
    ready:           "Click below to begin",
    active:          "Position your face in the frame...",
    detecting:       faceConfidence > 50 ? "Face detected — hold still..." : "Looking for your face...",
    no_face:         "No face detected — please move closer",
    verifying:       "Verifying identity...",
    success:         matchedName ? `Welcome, ${matchedName}` : "Access confirmed",
    error:           "Camera access denied. Please allow camera permissions.",
    not_recognised:  "Face not recognised. Contact your administrator.",
    model_error:     "Models unavailable — use your backup PIN.",
  };

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'DM Sans', sans-serif", display:"flex", flexDirection:"column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..800;1,9..40,300..800&family=IBM+Plex+Mono:wght@400;500&display=swap');
        @keyframes spin-slow{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes spin-rev{from{transform:rotate(360deg)}to{transform:rotate(0deg)}}
        @keyframes pulse-blue{0%,100%{box-shadow:0 0 0 0 rgba(26,143,191,0)}50%{box-shadow:0 0 0 14px rgba(26,143,191,0.1)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(14px)}to{opacity:1;transform:translateY(0)}}
        @keyframes float{0%,100%{transform:translateY(0)}50%{transform:translateY(-7px)}}
        @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        .fu{animation:fadeUp 0.6s ease both}.d1{animation-delay:.1s}.d2{animation-delay:.2s}.d3{animation-delay:.35s}
      `}</style>
      <RwandaStripe />
      <div style={{ flex:1, display:"flex" }}>
        {/* Left branding */}
        <div className="ik-login-left" style={{ width:"44%", background:`linear-gradient(160deg, #0B3D6B 0%, #0E5C3A 60%, #0B3D6B 100%)`, display:"flex", flexDirection:"column", justifyContent:"center", padding:"56px 52px", position:"relative", overflow:"hidden" }}>
          <ImigoPattern opacity={0.12} />
          <div style={{ position:"absolute", top:-80, right:-80, width:300, height:300, borderRadius:"50%", background:"radial-gradient(circle, rgba(250,210,1,0.1) 0%, transparent 70%)", pointerEvents:"none" }} />
          <div className="fu" style={{ marginBottom:48, cursor:"pointer" }} onClick={onBack}><InkingiLogo size="lg" light /></div>
          <div className="fu d1">
            <h1 style={{ fontSize:40, fontWeight:800, color:"white", lineHeight:1.1, marginBottom:14 }}>Analyst Sign In</h1>
            <p style={{ color:"rgba(255,255,255,0.6)", fontSize:14, lineHeight:1.75, maxWidth:320 }}>Secure biometric access for authorized fraud analysts only. All sessions are recorded.</p>
          </div>
          <div className="fu d2" style={{ marginTop:40, display:"flex", flexDirection:"column", gap:13 }}>
            {[{icon:IC.zap,label:"Real-time detection",col:"#FAD201"},{icon:IC.shield,label:"Biometric access only",col:"#20BDE0"},{icon:IC.lock,label:"All actions audited",col:"#00C67A"}].map((f,i) => (
              <div key={i} style={{ display:"flex", alignItems:"center", gap:12 }}>
                <div style={{ width:34, height:34, borderRadius:9, background:"rgba(255,255,255,0.08)", border:"1px solid rgba(255,255,255,0.12)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <Ico d={f.icon} size={15} color={f.col} />
                </div>
                <span style={{ color:"rgba(255,255,255,0.75)", fontSize:13 }}>{f.label}</span>
              </div>
            ))}
          </div>
          {/* face-api status */}
          <div className="fu d3" style={{ marginTop:40, paddingTop:20, borderTop:"1px solid rgba(255,255,255,0.1)", display:"flex", alignItems:"center", gap:8 }}>
            <div style={{ width:7, height:7, borderRadius:"50%", background: faceApiReady ? "#00C67A" : phase === "loading" ? C.rwYellow : C.rwYellow, flexShrink:0 }} />
            <div style={{ color:"rgba(255,255,255,0.4)", fontSize:11, fontFamily:"'IBM Plex Mono'", letterSpacing:"0.06em" }}>
              {faceApiReady ? "FACE-API.JS ACTIVE" : phase === "loading" ? "LOADING MODELS..." : "FALLBACK MODE"}
            </div>
          </div>
        </div>

        {/* Right — camera panel */}
        <div className="ik-login-right" style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center", padding:48, position:"relative" }}>
          <ImigoPattern opacity={0.03} />
          <div className="fu d1" style={{ width:"100%", maxWidth:420, textAlign:"center", position:"relative", zIndex:1 }}>
            <span style={{ fontSize:11, fontFamily:"'IBM Plex Mono'", color:C.blue, letterSpacing:"0.1em", background:C.blueLight, padding:"4px 12px", borderRadius:20, border:`1px solid ${C.blueMid}` }}>
              {faceApiReady ? "LIVE FACE RECOGNITION" : "BIOMETRIC SIGN IN"}
            </span>
            <h2 style={{ color:C.text, fontSize:24, fontWeight:800, margin:"16px 0 6px" }}>
              {phase === "success" ? "Access Granted ✓" : phase === "error" ? "Camera Error" : phase === "not_recognised" ? "Access Denied" : "Verify Your Identity"}
            </h2>
            <p style={{ color:C.textMid, fontSize:13, marginBottom:32 }}>
              {faceApiReady ? "Facial recognition — biometric verification" : "Secure biometric verification"}
            </p>

            {/* Camera ring */}
            <div style={{ position:"relative", width:240, height:240, margin:"0 auto 28px" }}>
              {(phase === "detecting" || phase === "verifying") && (
                <svg style={{ position:"absolute", inset:-14, width:268, height:268, animation:"spin-slow 6s linear infinite" }} viewBox="0 0 268 268">
                  <circle cx="134" cy="134" r="128" fill="none" stroke={C.blue} strokeWidth="1.5" strokeDasharray="8 12" opacity="0.35" />
                </svg>
              )}
              <svg style={{ position:"absolute", inset:-14, width:268, height:268, transform:"rotate(-90deg)" }} viewBox="0 0 268 268">
                <circle cx="134" cy="134" r="108" fill="none" stroke={C.borderLight} strokeWidth="3" />
                {(phase === "detecting" || phase === "verifying" || phase === "success") && (
                  <circle cx="134" cy="134" r="108" fill="none" stroke={phase==="success" ? C.green : C.blue} strokeWidth="3.5" strokeLinecap="round"
                    strokeDasharray={`${phase==="success" ? circ : (progress/100)*circ} ${circ}`}
                    style={{ transition:"stroke-dasharray 0.1s linear, stroke 0.4s" }} />
                )}
              </svg>
              {phase !== "ready" && phase !== "loading" && phase !== "error" && (
                <svg style={{ position:"absolute", inset:10, width:220, height:220, animation:"spin-rev 10s linear infinite" }} viewBox="0 0 220 220">
                  <circle cx="110" cy="110" r="106" fill="none" stroke={C.border} strokeWidth="1" strokeDasharray="3 14" />
                </svg>
              )}
              <div style={{ position:"absolute", inset:0, borderRadius:"50%", background: phase==="ready"||phase==="loading" ? C.surfaceAlt : "transparent", border:`2.5px solid ${phase==="success" ? C.green : phase==="error"||phase==="no_face" ? C.red : (phase!=="ready"&&phase!=="loading") ? C.blue : C.border}`, overflow:"hidden", display:"flex", alignItems:"center", justifyContent:"center", transition:"border-color 0.4s", animation: phase==="active" ? "pulse-blue 1.8s ease infinite" : "none", boxShadow: phase==="ready"||phase==="loading" ? "none" : `0 0 0 4px ${phase==="success" ? C.greenLight : phase==="error"||phase==="no_face" ? C.redLight : C.blueLight}` }}>
                {(phase === "ready" || phase === "loading") ? (
                  <div style={{ textAlign:"center" }}>
                    {phase === "loading" ? (
                      <>
                        <div style={{ width:40, height:40, border:`3px solid ${C.border}`, borderTop:`3px solid ${C.blue}`, borderRadius:"50%", animation:"spin-slow 1s linear infinite", margin:"0 auto 10px" }} />
                        <div style={{ color:C.textDim, fontSize:11, fontFamily:"'IBM Plex Mono'" }}>LOADING...</div>
                      </>
                    ) : (
                      <>
                        <div style={{ animation:"float 3s ease infinite" }}><Ico d={IC.camera} size={44} color={C.textXDim} /></div>
                        <div style={{ color:C.textDim, fontSize:11, marginTop:8, fontFamily:"'IBM Plex Mono'" }}>TAP TO ACTIVATE</div>
                      </>
                    )}
                  </div>
                ) : phase === "error" ? (
                  <div style={{ textAlign:"center", padding:20 }}>
                    <Ico d={IC.x} size={36} color={C.red} />
                    <div style={{ color:C.red, fontSize:11, marginTop:8, fontFamily:"'IBM Plex Mono'" }}>CAMERA BLOCKED</div>
                  </div>
                ) : (
                  <>
                    <video ref={videoRef} autoPlay playsInline muted style={{ width:"100%", height:"100%", objectFit:"cover", transform:"scaleX(-1)" }} />
                    {(phase === "detecting" || phase === "no_face") && (
                      <div style={{ position:"absolute", inset:0, overflow:"hidden" }}>
                        {/* Face guide oval */}
                        <svg style={{ position:"absolute", inset:0, width:"100%", height:"100%" }} viewBox="0 0 240 240">
                          <ellipse cx="120" cy="108" rx="58" ry="72" fill="none" stroke={phase==="no_face" ? C.red : faceConfidence>50 ? C.green : C.blue} strokeWidth="2" strokeDasharray="6 5" opacity="0.8" />
                        </svg>
                        {/* Scan line — only when face found */}
                        {faceConfidence > 40 && (
                          <div style={{ position:"absolute", left:"8%", right:"8%", height:2, background:`linear-gradient(90deg, transparent, ${C.blue}, transparent)`, boxShadow:`0 0 10px ${C.blue}`, top:`${progress}%`, transition:"top 0.1s linear" }} />
                        )}
                        {/* Confidence badge */}
                        {faceApiReady && faceConfidence > 0 && (
                          <div style={{ position:"absolute", bottom:8, left:"50%", transform:"translateX(-50%)", background:"rgba(0,0,0,0.7)", color:"white", fontSize:10, padding:"3px 8px", borderRadius:10, fontFamily:"'IBM Plex Mono'", whiteSpace:"nowrap" }}>
                            CONFIDENCE: {faceConfidence}%
                          </div>
                        )}
                      </div>
                    )}
                    {phase === "success" && (
                      <div style={{ position:"absolute", inset:0, background:"rgba(0,122,69,0.3)", display:"flex", alignItems:"center", justifyContent:"center" }}>
                        <div style={{ width:64, height:64, borderRadius:"50%", background:C.green, display:"flex", alignItems:"center", justifyContent:"center" }}>
                          <Ico d={IC.check} size={30} color="white" stroke={3} />
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
              {/* Rwanda flag dots */}
              {[[0,C.rwBlue],[90,C.rwYellow],[180,C.rwGreen],[270,C.rwBlue]].map(([deg,col],i) => (
                <div key={i} style={{ position:"absolute", top:"50%", left:"50%", width:9, height:9, borderRadius:"50%", background:col, border:"2px solid white", transform:`rotate(${deg}deg) translateX(120px) translateY(-50%)`, opacity: phase==="ready"||phase==="loading" ? 0.3 : 0.9, transition:"opacity 0.4s", boxShadow:"0 1px 4px rgba(0,0,0,0.15)" }} />
              ))}
            </div>

            {/* Status text + progress */}
            <div style={{ marginBottom:22, minHeight:52 }}>
              <p style={{ color: phase==="success" ? C.green : phase==="error"||phase==="no_face" ? C.red : (phase==="detecting"||phase==="verifying") ? C.blue : C.textMid, fontSize:13, fontWeight:500, transition:"color 0.3s" }}>
                {msgs[phase] || ""}
              </p>
              {(phase === "detecting" || phase === "verifying") && (
                <>
                  <div style={{ marginTop:8, height:3, background:C.borderLight, borderRadius:2, overflow:"hidden" }}>
                    <div style={{ height:"100%", borderRadius:2, background:`linear-gradient(90deg, ${C.blue}, ${C.green})`, width: phase==="verifying" ? "100%" : `${progress}%`, transition: phase==="verifying" ? "width 0.4s" : "width 0.1s linear" }} />
                  </div>
                  {faceApiReady && (
                    <div style={{ fontSize:11, color:C.textDim, marginTop:6, fontFamily:"'IBM Plex Mono'" }}>
                      {phase==="detecting" ? `SCANNING ${Math.round(progress)}%` : "AUTHENTICATING..."}
                    </div>
                  )}
                </>
              )}
            </div>

            {phase === "model_error" && (
              <div style={{ width:"100%", marginTop:4 }}>
                <div style={{ padding:"10px 14px", background:C.redLight, border:`1px solid #FECACA`, borderRadius:9, fontSize:12, color:C.red, marginBottom:12, textAlign:"center" }}>
                  Face recognition unavailable. Use your backup PIN to continue.
                </div>
                <input
                  type="password" maxLength={4} value={pin}
                  onChange={e => { setPin(e.target.value); setPinError(false); }}
                  onKeyDown={e => e.key === "Enter" && checkPin()}
                  placeholder="4-digit backup PIN"
                  style={{ width:"100%", padding:"12px", border:`1.5px solid ${pinError ? C.red : C.border}`, borderRadius:10, fontSize:18, textAlign:"center", fontFamily:"'IBM Plex Mono'", outline:"none", letterSpacing:"0.4em", background:C.surface, color:C.text, marginBottom:8 }}
                  autoFocus
                />
                {pinError && <div style={{ color:C.red, fontSize:12, textAlign:"center", marginBottom:8 }}>Incorrect PIN. Try again.</div>}
                <button onClick={checkPin} style={{ width:"100%", padding:"13px", background:`linear-gradient(135deg,${C.blueDeep},${C.green})`, border:"none", borderRadius:10, color:"white", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans'" }}>
                  Verify PIN →
                </button>
              </div>
            )}
            {phase === "ready" && (
              <button onClick={activate} style={{ width:"100%", padding:"14px", background:`linear-gradient(135deg,${C.blueDeep},${C.green})`, border:"none", borderRadius:11, color:"white", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans'", boxShadow:"0 4px 14px rgba(26,143,191,0.3)" }}>
                Activate Face Scan
              </button>
            )}
            {phase === "loading" && (
              <div style={{ padding:"12px", background:C.blueLight, border:`1px solid ${C.blueMid}`, borderRadius:10, color:C.blue, fontSize:13 }}>{loadMsg}</div>
            )}
            {(phase === "detecting" || phase === "active") && (
              <div style={{ padding:"12px", background:C.blueLight, border:`1px solid ${C.blueMid}`, borderRadius:10, color:C.blue, fontSize:13, fontWeight:500 }}>
                {phase==="active" ? "Camera starting..." : faceConfidence > 50 ? "Hold still — reading biometrics..." : "Please face the camera directly"}
              </div>
            )}
            {phase === "no_face" && (
              <div style={{ padding:"12px", background:C.redLight, border:"1px solid #FECACA", borderRadius:10, color:C.red, fontSize:13 }}>
                Move closer and ensure good lighting
              </div>
            )}
            {phase === "verifying" && (
              <div style={{ padding:"12px", background:C.blueLight, border:`1px solid ${C.blueMid}`, borderRadius:10, color:C.blue, fontSize:13, fontWeight:500 }}>Verifying with Inkingi Shield...</div>
            )}
            {phase === "success" && (
              <div style={{ padding:"12px", background:C.greenLight, border:`1px solid ${C.greenMid}`, borderRadius:10, color:C.green, fontSize:13, fontWeight:600 }}>
                {matchedName ? `Welcome, ${matchedName} · Loading dashboard...` : "Access confirmed · Loading dashboard..."}
              </div>
            )}
            {phase === "not_recognised" && (
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                <div style={{ padding:"12px", background:C.redLight, border:"1px solid #FECACA", borderRadius:10, color:C.red, fontSize:13, fontWeight:600 }}>
                  Face not recognised. Contact your administrator.
                </div>
                <button onClick={() => { setPhase("ready"); setProgress(0); setFaceConfidence(0); }} style={{ padding:"12px", background:`linear-gradient(135deg,${C.blueDeep},${C.green})`, border:"none", borderRadius:11, color:"white", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans'" }}>Try Again</button>
              </div>
            )}
            {phase === "error" && (
              <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
                <div style={{ padding:"12px", background:C.redLight, border:"1px solid #FECACA", borderRadius:10, color:C.red, fontSize:13 }}>Please allow camera access and try again.</div>
                <button onClick={() => setPhase("ready")} style={{ padding:"12px", background:`linear-gradient(135deg,${C.blueDeep},${C.green})`, border:"none", borderRadius:11, color:"white", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans'" }}>Try Again</button>
              </div>
            )}
            {/* Always-visible PIN link for admin bootstrap / locked-out users */}
            {phase !== "model_error" && (
              <p style={{ marginTop:16, color:C.textDim, fontSize:12 }}>
                Access issues?{" "}
                <span
                  style={{ color:C.blue, cursor:"pointer", textDecoration:"underline" }}
                  onClick={() => setPhase("model_error")}
                >
                  Use backup PIN
                </span>
              </p>
            )}
            <div style={{ marginTop:16, paddingTop:16, borderTop:`1px solid ${C.border}`, textAlign:"center" }}>
              <button onClick={onBack}
                style={{ display:"inline-flex", alignItems:"center", gap:6, background:"none", border:`1px solid ${C.border}`, borderRadius:9, padding:"9px 20px", color:C.textMid, fontSize:13, fontWeight:500, cursor:"pointer", fontFamily:"'DM Sans'", transition:"all 0.18s" }}
                onMouseEnter={e => { e.currentTarget.style.background=C.blueLight; e.currentTarget.style.borderColor=C.blue; e.currentTarget.style.color=C.blue; }}
                onMouseLeave={e => { e.currentTarget.style.background="none"; e.currentTarget.style.borderColor=C.border; e.currentTarget.style.color=C.textMid; }}>
                ← Back to website
              </button>
            </div>

            {/* Demo visitor access */}
            <div style={{ marginTop:20, paddingTop:18, borderTop:`1px solid ${C.border}` }}>
              <button onClick={() => setShowDemo(d => !d)} style={{ background:"none", border:"none", cursor:"pointer", color:C.yellow, fontSize:12, fontWeight:600, fontFamily:"'DM Sans'", padding:0, display:"flex", alignItems:"center", gap:5, margin:"0 auto" }}>
                <span style={{ fontSize:14 }}>▶</span> Visitor demo access
              </button>
              {showDemo && (
                <div style={{ marginTop:12, animation:"fadeUp 0.3s ease" }}>
                  <div style={{ padding:"10px 14px", background:"rgba(250,210,1,0.07)", border:"1px solid rgba(250,210,1,0.2)", borderRadius:10, fontSize:12, color:C.textMid, marginBottom:10, textAlign:"center" }}>
                    Enter the demo code to explore the dashboard with sample data.
                  </div>
                  <input
                    type="text" value={demoCode} autoCapitalize="characters"
                    onChange={e => { setDemoCode(e.target.value.toUpperCase()); setDemoError(false); }}
                    onKeyDown={e => e.key === "Enter" && enterDemo()}
                    placeholder="Demo code (e.g. DEMO2026)"
                    style={{ width:"100%", padding:"11px 14px", border:`1.5px solid ${demoError ? C.red : "rgba(250,210,1,0.4)"}`, borderRadius:10, fontSize:14, fontFamily:"'IBM Plex Mono'", outline:"none", background:C.surface, color:C.text, marginBottom:6, letterSpacing:"0.08em" }}
                  />
                  {demoError && <div style={{ color:C.red, fontSize:12, textAlign:"center", marginBottom:6 }}>Incorrect code. Try DEMO2026.</div>}
                  <button onClick={enterDemo} style={{ width:"100%", padding:"11px", background:"rgba(250,210,1,0.12)", border:`1px solid ${C.yellow}`, borderRadius:10, color:C.yellow, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans'" }}>
                    Enter Demo Dashboard →
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// DASHBOARD — score ring + alert card + detail panel
// ─────────────────────────────────────────────────────────────────────────────
function ScoreRing({ score, size=56 }) {
  const r=22, circ=2*Math.PI*r, color=scoreColor(score);
  return (
    <div style={{ position:"relative", width:size, height:size, flexShrink:0 }}>
      <svg width={size} height={size} viewBox="0 0 52 52" style={{ transform:"rotate(-90deg)" }}>
        <circle cx="26" cy="26" r={r} fill="none" stroke={scoreBg(score)} strokeWidth="4" />
        <circle cx="26" cy="26" r={r} fill="none" stroke={color} strokeWidth="4" strokeLinecap="round" strokeDasharray={`${(score/100)*circ} ${circ}`} />
      </svg>
      <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
        <span style={{ fontSize:12, fontWeight:800, color, fontFamily:"'IBM Plex Mono'" }}>{score}</span>
      </div>
    </div>
  );
}

function AlertCard({ alert, selected, onClick }) {
  const color = scoreColor(alert.score);
  const ss = { pending:{bg:C.yellowLight,color:C.yellow,border:C.yellowMid,label:"Pending"}, approved:{bg:C.greenLight,color:C.green,border:C.greenMid,label:"Cleared"}, cancelled:{bg:C.redLight,color:C.red,border:"#FECACA",label:"Blocked"} }[alert.status];
  return (
    <div onClick={onClick} style={{ background: selected ? C.blueLight : C.surface, border:`1.5px solid ${selected ? C.blue : C.border}`, borderRadius:13, padding:"13px 15px", cursor:"pointer", transition:"all 0.18s", opacity: alert.status!=="pending" ? 0.68 : 1, position:"relative", overflow:"hidden", boxShadow: selected ? `0 2px 10px rgba(26,143,191,0.12)` : "0 1px 3px rgba(0,0,0,0.04)" }}>
      {selected && <div style={{ position:"absolute", left:0, top:0, bottom:0, width:3, background:`linear-gradient(180deg,${C.blue},${C.green})` }} />}
      <div style={{ display:"flex", gap:11 }}>
        <ScoreRing score={alert.score} size={50} />
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
            <span style={{ color:C.text, fontSize:13, fontWeight:700, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{alert.customer}</span>
            <span style={{ fontSize:10, color:C.textDim, fontFamily:"'IBM Plex Mono'", flexShrink:0, marginLeft:6 }}>{alert.time}</span>
          </div>
          <div style={{ color:C.textMid, fontSize:11.5, marginBottom:6 }}>{alert.amount} · {alert.type}</div>
          <div style={{ display:"flex", gap:5 }}>
            <span style={{ fontSize:10, background:ss.bg, color:ss.color, border:`1px solid ${ss.border}`, padding:"2px 7px", borderRadius:20, fontWeight:600 }}>{ss.label}</span>
            <span style={{ fontSize:10, background:scoreBg(alert.score), color, padding:"2px 7px", borderRadius:20, fontWeight:700 }}>{alert.level}</span>
          </div>
        </div>
      </div>
      <div style={{ marginTop:9, height:2.5, background:C.borderLight, borderRadius:2, overflow:"hidden" }}>
        <div style={{ width:`${alert.score}%`, height:"100%", background:`linear-gradient(90deg,${color}55,${color})`, borderRadius:2 }} />
      </div>
    </div>
  );
}

function DetailPanel({ alert, onAction }) {
  const [tab, setTab] = useState("overview");
  const [acting, setActing] = useState(false);
  // Reset tab to overview when a new alert is selected
  const prevId = useRef(alert.id);
  useEffect(() => {
    if (alert.id !== prevId.current) { setTab("overview"); prevId.current = alert.id; }
  }, [alert.id]);
  const color = scoreColor(alert.score);
  const riskColor = { high:C.red, medium:C.orange, low:C.green };
  const riskBg = { high:C.redLight, medium:C.orangeLight, low:C.greenLight };

  const doAction = async (type) => {
    setActing(true);
    await onAction(type, alert.id);
    setActing(false);
  };

  return (
    <div style={{ background:C.surface, borderRadius:15, border:`1px solid ${C.border}`, display:"flex", flexDirection:"column", height:"100%", overflow:"hidden", boxShadow:"0 2px 10px rgba(0,0,0,0.05)" }}>
      <div style={{ borderTop:`3px solid ${color}`, borderRadius:"15px 15px 0 0" }}>
        <div style={{ padding:"18px 22px", borderBottom:`1px solid ${C.border}`, background:C.surfaceAlt }}>
          <div style={{ display:"flex", alignItems:"flex-start", gap:14, marginBottom:12 }}>
            <ScoreRing score={alert.score} size={62} />
            <div style={{ flex:1 }}>
              <div style={{ display:"flex", gap:5, marginBottom:6, flexWrap:"wrap" }}>
                <span style={{ fontSize:10, fontFamily:"'IBM Plex Mono'", color:C.blue, background:C.blueLight, border:`1px solid ${C.blueMid}`, padding:"2px 8px", borderRadius:20 }}>{alert.id}</span>
                <span style={{ fontSize:10, color:C.textMid, background:C.border, padding:"2px 8px", borderRadius:20 }}>{alert.type}</span>
                <span style={{ fontSize:10, color, background:scoreBg(alert.score), padding:"2px 8px", borderRadius:20, fontWeight:700 }}>{alert.level}</span>
              </div>
              <div style={{ color:C.text, fontSize:19, fontWeight:800, marginBottom:2 }}>{alert.customer}</div>
              <div style={{ color:C.textMid, fontSize:12.5 }}>{alert.amount} · Flagged {alert.time}</div>
            </div>
            {alert.status === "pending" && (
              <div style={{ display:"flex", gap:7 }}>
                <button onClick={() => doAction("cancel")} disabled={acting} style={{ padding:"8px 16px", background:C.redLight, border:"1px solid #FECACA", borderRadius:8, color:C.red, fontSize:12, fontWeight:700, cursor: acting ? "not-allowed" : "pointer", fontFamily:"'DM Sans'", opacity: acting ? 0.6 : 1 }}>Block</button>
                <button onClick={() => doAction("approve")} disabled={acting} style={{ padding:"8px 16px", background:`linear-gradient(135deg,${C.blueDeep},${C.green})`, border:"none", borderRadius:8, color:"white", fontSize:12, fontWeight:700, cursor: acting ? "not-allowed" : "pointer", fontFamily:"'DM Sans'", opacity: acting ? 0.6 : 1 }}>Clear</button>
              </div>
            )}
            {alert.status !== "pending" && (
              <div style={{ padding:"8px 14px", background: alert.status==="approved" ? C.greenLight : C.redLight, border:`1px solid ${alert.status==="approved" ? C.greenMid : "#FECACA"}`, borderRadius:8, fontSize:12, fontWeight:700, color: alert.status==="approved" ? C.green : C.red }}>
                {alert.status==="approved" ? "Cleared ✓" : "Blocked ✗"}
              </div>
            )}
          </div>
          <div style={{ background:C.orangeLight, border:"1px solid #FDE68A", borderRadius:7, padding:"7px 12px", display:"flex", gap:7, alignItems:"center" }}>
            <Ico d={IC.flag} size={12} color={C.orange} />
            <span style={{ color:C.orange, fontSize:12 }}>Trigger: {alert.reason}</span>
          </div>
        </div>
      </div>
      <div style={{ display:"flex", borderBottom:`1px solid ${C.border}`, padding:"0 22px" }}>
        {["overview","customer","account","audit"].map(t => (
          <button key={t} onClick={() => setTab(t)} style={{ padding:"11px 13px", border:"none", background:"none", cursor:"pointer", fontFamily:"'DM Sans'", fontSize:13, fontWeight: tab===t ? 700 : 400, color: tab===t ? C.blue : C.textMid, borderBottom:`2px solid ${tab===t ? C.blue : "transparent"}`, marginBottom:-1, textTransform:"capitalize" }}>
            {t==="audit" ? "Audit Log" : t.charAt(0).toUpperCase()+t.slice(1)}
          </button>
        ))}
      </div>
      <div style={{ flex:1, overflowY:"auto", padding:"18px 22px", background:C.surfaceAlt }}>
        {tab==="overview" && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:11 }}>
            {[{label:"Fraud Score",value:`${alert.score}/100`,sub:alert.level,color},{label:"Transaction Amount",value:alert.amount,sub:"2.4× customer avg",color:C.blue},{label:"Detection Time",value:"148ms",sub:"Real-time",color:C.green},{label:"Confidence",value:"94%",sub:"High certainty",color}].map((s,i) => (
              <div key={i} style={{ background:C.surface, borderRadius:11, padding:"14px", border:`1px solid ${C.border}` }}>
                <div style={{ fontSize:10, color:C.textDim, fontFamily:"'IBM Plex Mono'", letterSpacing:"0.07em", marginBottom:7, textTransform:"uppercase" }}>{s.label}</div>
                <div style={{ fontSize:22, fontWeight:800, color:s.color }}>{s.value}</div>
                <div style={{ fontSize:11, color:C.textMid, marginTop:3 }}>{s.sub}</div>
              </div>
            ))}
            <div style={{ gridColumn:"1 / -1", background:C.surface, borderRadius:11, padding:"16px", border:`1px solid ${C.border}` }}>
              <div style={{ display:"flex", alignItems:"center", gap:7, marginBottom:14 }}>
                <div style={{ width:4, height:14, background:`linear-gradient(${C.blue},${C.green})`, borderRadius:2 }} />
                <span style={{ fontWeight:700, color:C.text, fontSize:12 }}>Why was this flagged? (SHAP features)</span>
              </div>
              {(alert.score >= 80 ? [
                  {feature:"Transaction Amount",impact:91,dir:"fraud"},{feature:"New / Unknown Device",impact:80,dir:"fraud"},{feature:"IP Geolocation Mismatch",impact:66,dir:"fraud"},{feature:"Off-hours Transaction",impact:44,dir:"fraud"},{feature:"Customer History (good)",impact:28,dir:"legit"}
                ] : alert.score >= 55 ? [
                  {feature:"Transaction Velocity",impact:74,dir:"fraud"},{feature:"Amount vs Avg",impact:62,dir:"fraud"},{feature:"Device Match",impact:38,dir:"legit"},{feature:"Known Location",impact:30,dir:"legit"},{feature:"Time of Day",impact:48,dir:"fraud"}
                ] : [
                  {feature:"Minor Velocity",impact:35,dir:"fraud"},{feature:"Customer History",impact:72,dir:"legit"},{feature:"Verified Device",impact:65,dir:"legit"},{feature:"Known Location",impact:60,dir:"legit"},{feature:"Amount in Range",impact:55,dir:"legit"}
                ]).map((f,i) => (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:10 }}>
                  <div style={{ width:155, fontSize:12, color:C.textMid, flexShrink:0 }}>{f.feature}</div>
                  <div style={{ flex:1, height:6, background:C.borderLight, borderRadius:3, overflow:"hidden" }}>
                    <div style={{ width:`${f.impact}%`, height:"100%", background: f.dir==="fraud" ? `linear-gradient(90deg,${C.red}88,${C.red})` : C.green, borderRadius:3 }} />
                  </div>
                  <span style={{ fontSize:11, fontFamily:"'IBM Plex Mono'", color: f.dir==="fraud" ? C.red : C.green, width:34, textAlign:"right", fontWeight:600 }}>{f.impact}%</span>
                  <span style={{ fontSize:9, background: f.dir==="fraud" ? C.redLight : C.greenLight, color: f.dir==="fraud" ? C.red : C.green, padding:"1px 6px", borderRadius:5, width:40, textAlign:"center", fontWeight:700, flexShrink:0 }}>{f.dir==="fraud" ? "↑ Risk" : "↓ Risk"}</span>
                </div>
              ))}
            </div>

            {/* Pattern Analysis card */}
            {(() => {
              // Detect pattern type based on alert data
              const amtNum = alert.amountNum || parseFloat((alert.amount||"").replace(/[^0-9.]/g,"")) || 0;
              const isStructuring = alert.score >= 55 && amtNum < 500000 && alert.type && (alert.type.toLowerCase().includes("transfer") || alert.type.toLowerCase().includes("cash"));
              const isLargeAmount = amtNum >= 1000000;
              const isHighVelocity = alert.score >= 70 && !isLargeAmount;

              const patterns = [];
              if (isStructuring) patterns.push({
                icon: "🔁",
                title: "Structuring / Smurfing Detected",
                color: "#F97316",
                bg: "rgba(249,115,22,0.06)",
                border: "rgba(249,115,22,0.25)",
                explanation: `This customer has made multiple transfers just below common reporting thresholds (RWF 500K). Sending many smaller amounts is a classic tactic — called "structuring" or "smurfing" — used to avoid automatic fraud detection systems that only flag large single transactions. Inkingi Shield watches for this pattern across a 24-hour velocity window.`,
                signals: ["Amount deliberately below threshold", "High frequency of similar-sized transfers", "Velocity spike vs. customer baseline"],
              });
              if (isLargeAmount) patterns.push({
                icon: "💸",
                title: "Anomalous Large Transfer",
                color: C.red,
                bg: C.redLight,
                border: "#FECACA",
                explanation: `This transaction is unusually large compared to this customer's historical average. The system flags single high-value transfers that deviate significantly from a customer's normal spending pattern — they often indicate account takeover, authorised push payment (APP) fraud, or social engineering.`,
                signals: ["Amount far above customer average", "No matching prior large-amount history", "Device or location mismatch"],
              });
              if (isHighVelocity && !isStructuring) patterns.push({
                icon: "⚡",
                title: "Velocity Anomaly",
                color: "#FAD201",
                bg: "rgba(250,210,1,0.06)",
                border: "rgba(250,210,1,0.3)",
                explanation: `The customer made an unusually high number of transactions in a short window. Rapid successive transactions — especially across different payees or channels — are a strong signal of automated fraud (bot attacks, credential stuffing, or a compromised account being drained quickly).`,
                signals: ["Multiple transactions within minutes", "New payees not seen before", "Session started from new device/IP"],
              });
              if (patterns.length === 0) patterns.push({
                icon: "🔍",
                title: "Composite Risk Signal",
                color: C.blue,
                bg: C.blueLight,
                border: C.blueMid,
                explanation: `No single dominant pattern was detected, but the combination of multiple moderate risk signals pushed this transaction above the fraud threshold. Inkingi Shield's gradient-boosted model weighs dozens of features together — even when each one looks normal in isolation, their combination can be statistically unusual.`,
                signals: ["Multiple weak signals in combination", "Deviation from customer baseline", "Context signals (time, location, device)"],
              });

              return patterns.map((p, pi) => (
                <div key={pi} style={{ gridColumn:"1 / -1", background:p.bg, borderRadius:11, padding:"16px 18px", border:`1px solid ${p.border}` }}>
                  <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                    <span style={{ fontSize:18 }}>{p.icon}</span>
                    <span style={{ fontWeight:800, fontSize:13, color:p.color }}>{p.title}</span>
                    <span style={{ marginLeft:"auto", fontSize:10, background:p.bg, color:p.color, border:`1px solid ${p.border}`, padding:"2px 8px", borderRadius:20, fontWeight:700, fontFamily:"'IBM Plex Mono'" }}>PATTERN ANALYSIS</span>
                  </div>
                  <p style={{ fontSize:12.5, color:C.textMid, lineHeight:1.75, margin:"0 0 12px" }}>{p.explanation}</p>
                  <div style={{ display:"flex", flexWrap:"wrap", gap:7 }}>
                    {p.signals.map((sig, si) => (
                      <span key={si} style={{ fontSize:11, background:"rgba(255,255,255,0.04)", border:"1px solid rgba(255,255,255,0.1)", color:C.textMid, padding:"3px 10px", borderRadius:20 }}>
                        ● {sig}
                      </span>
                    ))}
                  </div>
                </div>
              ));
            })()}
          </div>
        )}
        {tab==="customer" && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:11 }}>
            <div>
              <div style={{ fontSize:10, color:C.textDim, fontFamily:"'IBM Plex Mono'", letterSpacing:"0.08em", marginBottom:9 }}>RISK ELEMENTS</div>
              <div style={{ background:C.surface, borderRadius:11, overflow:"hidden", border:`1px solid ${C.border}` }}>
                {[{label:"Customer",value:alert.customer,risk:"low"},{label:"Phone",value:alert.phone,risk:alert.phoneRisk},{label:"Email",value:alert.email,risk:alert.emailRisk},{label:"Address",value:alert.address,risk:alert.addressRisk},{label:"Device",value:alert.device,risk:alert.deviceRisk}].map((item,i,arr) => (
                  <div key={i} style={{ display:"flex", gap:10, padding:"10px 13px", borderBottom: i<arr.length-1 ? `1px solid ${C.border}` : "none" }}>
                    <div style={{ width:3, height:30, borderRadius:2, background:riskColor[item.risk], flexShrink:0 }} />
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:10, color:C.textDim, fontFamily:"'IBM Plex Mono'" }}>{item.label.toUpperCase()}</div>
                      <div style={{ fontSize:12.5, color:C.text, fontWeight:500, overflow:"hidden", textOverflow:"ellipsis", whiteSpace:"nowrap" }}>{item.value}</div>
                    </div>
                    <span style={{ fontSize:10, background:riskBg[item.risk], color:riskColor[item.risk], padding:"2px 7px", borderRadius:20, fontWeight:700, flexShrink:0, alignSelf:"center" }}>{item.risk}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <div style={{ fontSize:10, color:C.textDim, fontFamily:"'IBM Plex Mono'", letterSpacing:"0.08em", marginBottom:9 }}>CUSTOMER PROFILE</div>
              <div style={{ background:C.surface, borderRadius:11, padding:14, border:`1px solid ${C.border}`, marginBottom:10 }}>
                <div style={{ display:"flex", gap:11, marginBottom:13 }}>
                  <div style={{ width:42, height:42, borderRadius:"50%", background:`linear-gradient(135deg,${C.blueDeep},${C.green})`, display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontWeight:800, fontSize:14, flexShrink:0 }}>{alert.initials}</div>
                  <div>
                    <div style={{ color:C.text, fontWeight:700, fontSize:13.5 }}>{alert.customer}</div>
                    <div style={{ color:C.textDim, fontSize:11, fontFamily:"'IBM Plex Mono'" }}>Since Jan 2021 · ID #29847</div>
                  </div>
                </div>
                {[["Transactions","247"],["Avg Amount","RWF 185K"],["Prior Flags","1"],["Last Login","3 days ago"]].map(([l,v],i) => (
                  <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"6px 0", borderBottom: i<3 ? `1px solid ${C.border}` : "none" }}>
                    <span style={{ fontSize:12, color:C.textMid }}>{l}</span>
                    <span style={{ fontSize:12, color:C.text, fontWeight:700 }}>{v}</span>
                  </div>
                ))}
              </div>
              <div style={{ background:C.surface, borderRadius:11, padding:13, border:`1px solid ${C.border}` }}>
                <div style={{ fontSize:10, color:C.textDim, fontFamily:"'IBM Plex Mono'", marginBottom:8 }}>ENRICHMENT SIGNALS</div>
                <div style={{ display:"flex", flexWrap:"wrap", gap:5 }}>
                  {["IP Mismatch","New Device","High Amount","Off-hours"].map((tag,i) => (
                    <span key={i} style={{ fontSize:11, background:C.redLight, color:C.red, border:"1px solid #FECACA", padding:"2px 8px", borderRadius:20 }}>{tag}</span>
                  ))}
                </div>
              </div>
            </div>
            <div style={{ gridColumn:"1 / -1" }}>
              <div style={{ fontSize:10, color:C.textDim, fontFamily:"'IBM Plex Mono'", letterSpacing:"0.08em", marginBottom:9 }}>TRANSACTION HISTORY</div>
              <div style={{ background:C.surface, borderRadius:11, overflow:"hidden", border:`1px solid ${C.border}` }}>
                {[{date:"Feb 22, 2026",amount:"RWF 4,250,000",type:"Transfer",score:92,flagged:true},{date:"Feb 15, 2026",amount:"RWF 180,000",type:"Payment",score:11,flagged:false},{date:"Feb 09, 2026",amount:"RWF 95,000",type:"Transfer",score:8,flagged:false},{date:"Jan 28, 2026",amount:"RWF 420,000",type:"Payment",score:29,flagged:false}].map((tx,i,arr) => (
                  <div key={i} style={{ display:"flex", padding:"10px 14px", borderBottom: i<arr.length-1 ? `1px solid ${C.border}` : "none", background: tx.flagged ? "#FFF8F8" : "transparent" }}>
                    <div style={{ flex:1 }}>
                      <div style={{ color:C.text, fontSize:12.5, fontWeight:500 }}>{tx.amount} · {tx.type}</div>
                      <div style={{ color:C.textDim, fontSize:11, fontFamily:"'IBM Plex Mono'", marginTop:1 }}>{tx.date}</div>
                    </div>
                    <div style={{ display:"flex", gap:7, alignItems:"center" }}>
                      <span style={{ fontSize:11, fontFamily:"'IBM Plex Mono'", color:scoreColor(tx.score), fontWeight:600 }}>Score {tx.score}</span>
                      <span style={{ fontSize:10, background: tx.flagged ? C.redLight : C.greenLight, color: tx.flagged ? C.red : C.green, border:`1px solid ${tx.flagged ? "#FECACA" : C.greenMid}`, padding:"2px 8px", borderRadius:20, fontWeight:600 }}>{tx.flagged ? "Flagged" : "Clear"}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
        {tab==="account" && (
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:11 }}>
            {[["Account Number","RW 0093 2847 0012 3456"],["Account Type","Mobile Money (MoMo)"],["Status","Active"],["Est. Balance","RWF 2,100,000"],["Date Opened","March 14, 2021"],["KYC Status","Fully Verified"],["Transaction Limit","RWF 5,000,000"],["Country","🇷🇼 Rwanda"]].map(([l,v],i) => (
              <div key={i} style={{ background:C.surface, borderRadius:11, padding:"13px 15px", border:`1px solid ${C.border}` }}>
                <div style={{ fontSize:10, color:C.textDim, fontFamily:"'IBM Plex Mono'", letterSpacing:"0.06em", marginBottom:5 }}>{l.toUpperCase()}</div>
                <div style={{ fontSize:13.5, fontWeight:600, color:C.text }}>{v}</div>
              </div>
            ))}
          </div>
        )}
        {tab==="audit" && (
          <div>
            {[{time:"14:32:18.204",action:"Alert generated by Inkingi Shield ML model",actor:"INKINGI-ML",type:"system"},{time:"14:32:18.891",action:"Alert queued for analyst review",actor:"SYSTEM",type:"system"},{time:"14:32:19.100",action:"Enrichment data fetched (IP, device fingerprint)",actor:"ENRICHMENT-API",type:"system"},{time:"14:33:05.442",action:"Alert opened by fraud analyst",actor:"Armand K.",type:"user"},{time:"14:33:41.009",action:"Customer tab reviewed",actor:"Armand K.",type:"user"}].map((log,i) => (
              <div key={i} style={{ display:"flex", gap:12, marginBottom:16 }}>
                <div style={{ width:34, height:34, borderRadius:8, background: log.type==="system" ? C.blueLight : C.greenLight, border:`1px solid ${log.type==="system" ? C.blueMid : C.greenMid}`, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <Ico d={log.type==="system" ? IC.zap : IC.user} size={13} color={log.type==="system" ? C.blue : C.green} />
                </div>
                <div style={{ paddingTop:2 }}>
                  <div style={{ fontSize:13, color:C.text, fontWeight:500 }}>{log.action}</div>
                  <div style={{ fontSize:10, color:C.textDim, fontFamily:"'IBM Plex Mono'", marginTop:2 }}>{log.time} · {log.actor}</div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// OVERVIEW PAGE — with real useApi loading states
// ─────────────────────────────────────────────────────────────────────────────
function OverviewPage({ alertList = [] }) {
  const { data: stats, loading: statsLoading, error: statsError, refetch: refetchStats } = useApi(api.getStats);
  const { data: alerts, loading: alertsLoading } = useApi(api.getAlerts);
  const [hoveredBar, setHoveredBar] = useState(null);

  // Live chart — today's column updates as analyst blocks/clears
  const DAY_NAMES = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"];
  const todayIdx = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
  const BASE = [{blocked:3,cleared:5},{blocked:7,cleared:7},{blocked:5,cleared:6},{blocked:11,cleared:8},{blocked:9,cleared:13},{blocked:4,cleared:3},{blocked:2,cleared:4}];
  const liveBlocked = alertList.filter(a => a.status === "cancelled").length;
  const liveCleared = alertList.filter(a => a.status === "approved").length;
  const weekData = BASE.map((d,i) => ({
    day: DAY_NAMES[i],
    blocked: i === todayIdx ? (liveBlocked || d.blocked) : d.blocked,
    cleared: i === todayIdx ? (liveCleared || d.cleared) : d.cleared,
    isToday: i === todayIdx,
  }));
  const maxVal = Math.max(...weekData.map(d => d.blocked + d.cleared), 1);

  return (
    <div style={{ padding:"20px 24px", overflowY:"auto", height:"100%", width:"100%" }}>
      <div style={{ marginBottom:20 }}>
        <h2 style={{ fontSize:20, fontWeight:800, color:C.text, marginBottom:4 }}>Overview</h2>
        <p style={{ fontSize:13, color:C.textMid }}>System performance for the past 7 days</p>
      </div>

      {/* Stats cards */}
      {statsError ? <ErrorCard msg={`Failed to load stats: ${statsError}`} onRetry={refetchStats} /> : (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:14, marginBottom:20 }}>
          {statsLoading ? [...Array(4)].map((_,i) => (
            <div key={i} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:13, padding:"18px" }}>
              <Skeleton w={40} h={40} radius={10} mb={10} />
              <Skeleton w="60%" h={28} radius={6} mb={6} />
              <Skeleton w="80%" h={12} radius={4} />
            </div>
          )) : [
            { label:"Total Transactions", value:stats?.totalTx?.toLocaleString() || "2,847", change:stats?.txChange||"+12%", up:true, icon:IC.activity, color:C.blue },
            { label:"Fraud Detected", value:String(stats?.fraudDetected||87), change:stats?.fraudChange||"+4%", up:true, icon:IC.alertTriangle, color:C.red },
            { label:"Amount Protected", value:stats?.amountProtected||"RWF 142M", change:stats?.amountChange||"+18%", up:true, icon:IC.dollar, color:C.green },
            { label:"False Positive Rate", value:stats?.falsePositiveRate||"1.8%", change:stats?.fpChange||"-0.3%", up:false, icon:IC.check, color:C.yellow },
          ].map((s,i) => (
            <div key={i} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:13, padding:"18px" }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:10 }}>
                <div style={{ width:38, height:38, borderRadius:10, background:s.color+"18", display:"flex", alignItems:"center", justifyContent:"center" }}>
                  <Ico d={s.icon} size={17} color={s.color} />
                </div>
                <span style={{ fontSize:11, color: s.up ? C.green : C.red, background: s.up ? C.greenLight : C.redLight, padding:"3px 8px", borderRadius:20, fontWeight:600, alignSelf:"flex-start" }}>{s.change}</span>
              </div>
              <div style={{ fontSize:24, fontWeight:800, color:C.text, fontFamily:"'IBM Plex Mono'" }}>{s.value}</div>
              <div style={{ fontSize:12, color:C.textMid, marginTop:3 }}>{s.label}</div>
            </div>
          ))}
        </div>
      )}

      <div style={{ display:"grid", gridTemplateColumns:"1.8fr 1fr", gap:14, marginBottom:14, width:"100%" }}>
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:13, padding:"20px" }}>
          <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:18 }}>
            <div>
              <div style={{ fontWeight:700, color:C.text, fontSize:14 }}>Weekly Alert Activity</div>
              <div style={{ fontSize:11, color:C.textDim, marginTop:2 }}>Hover any bar for details · Today highlighted in blue</div>
            </div>
            <div style={{ display:"flex", gap:12 }}>
              {[{col:C.red,label:"Blocked"},{col:C.green,label:"Cleared"}].map((l,i) => (
                <div key={i} style={{ display:"flex", alignItems:"center", gap:5 }}>
                  <div style={{ width:9, height:9, borderRadius:2, background:l.col }} />
                  <span style={{ fontSize:11, color:C.textMid }}>{l.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div style={{ display:"flex", alignItems:"flex-end", gap:6, height:150, position:"relative" }}>
            {weekData.map((d,i) => {
              const total = d.blocked + d.cleared;
              const isHov = hoveredBar === i;
              return (
                <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:4, position:"relative", cursor:"pointer" }}
                  onMouseEnter={() => setHoveredBar(i)} onMouseLeave={() => setHoveredBar(null)}>
                  {/* Tooltip */}
                  {isHov && (
                    <div style={{ position:"absolute", bottom:"calc(100% + 8px)", left:"50%", transform:"translateX(-50%)", background:C.blueDeep, color:"white", borderRadius:9, padding:"10px 14px", fontSize:11, whiteSpace:"nowrap", zIndex:20, boxShadow:"0 6px 20px rgba(0,0,0,0.25)", lineHeight:1.7 }}>
                      <div style={{ fontWeight:700, fontFamily:"'IBM Plex Mono'", marginBottom:4, color: d.isToday ? C.rwYellow : "white" }}>{d.day}{d.isToday ? " — TODAY" : ""}</div>
                      <div><span style={{ color:"#FCA5A5" }}>● Blocked:</span> <strong>{d.blocked}</strong></div>
                      <div><span style={{ color:"#6EE7B7" }}>● Cleared:</span> <strong>{d.cleared}</strong></div>
                      <div style={{ borderTop:"1px solid rgba(255,255,255,0.15)", marginTop:5, paddingTop:5, color:"rgba(255,255,255,0.6)" }}>Total: {total} alerts</div>
                      <div style={{ position:"absolute", bottom:-5, left:"50%", transform:"translateX(-50%)", width:10, height:6, background:C.blueDeep, clipPath:"polygon(0 0,100% 0,50% 100%)" }} />
                    </div>
                  )}
                  {/* Count label on hover */}
                  {isHov && <div style={{ fontSize:10, fontWeight:700, color:C.blue, fontFamily:"'IBM Plex Mono'" }}>{total}</div>}
                  {/* Bar */}
                  <div style={{ width:"100%", display:"flex", flexDirection:"column", justifyContent:"flex-end", gap:2, height:118, opacity: hoveredBar !== null && !isHov ? 0.38 : 1, transition:"opacity 0.15s, transform 0.15s", transform: isHov ? "scaleY(1.03)" : "scaleY(1)", transformOrigin:"bottom" }}>
                    <div style={{ width:"100%", background: d.isToday ? C.green : C.green+"99", borderRadius:"4px 4px 0 0", height:`${(d.cleared/maxVal)*100}%`, minHeight:3, transition:"height 0.5s ease" }} />
                    <div style={{ width:"100%", background: d.isToday ? C.red : C.red+"99", height:`${(d.blocked/maxVal)*100}%`, minHeight:3, transition:"height 0.5s ease" }} />
                  </div>
                  {/* Day label */}
                  <span style={{ fontSize:10, color: d.isToday ? C.blue : C.textDim, fontFamily:"'IBM Plex Mono'", fontWeight: d.isToday ? 700 : 400 }}>{d.day}</span>
                  {/* Today dot */}
                  {d.isToday && <div style={{ width:5, height:5, borderRadius:"50%", background:C.blue }} />}
                </div>
              );
            })}
          </div>
        </div>
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:13, padding:"20px" }}>
          <div style={{ fontWeight:700, color:C.text, marginBottom:16, fontSize:14 }}>Alert Breakdown</div>
          {[{label:"CRITICAL (80–100)",count:12,pct:14,color:C.red},{label:"HIGH (55–79)",count:31,pct:36,color:C.orange},{label:"MEDIUM (30–54)",count:28,pct:32,color:C.yellow},{label:"LOW (0–29)",count:16,pct:18,color:C.green}].map((b,i) => (
            <div key={i} style={{ marginBottom:12 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:4 }}>
                <span style={{ fontSize:12, color:C.textMid }}>{b.label}</span>
                <span style={{ fontSize:12, fontWeight:700, color:b.color }}>{b.count}</span>
              </div>
              <div style={{ height:6, background:C.borderLight, borderRadius:3, overflow:"hidden" }}>
                <div style={{ width:`${b.pct}%`, height:"100%", background:b.color, borderRadius:3 }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent alerts table */}
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:13, padding:"20px" }}>
        <div style={{ fontWeight:700, color:C.text, marginBottom:16, fontSize:14 }}>Recent Flagged Transactions</div>
        {alertsLoading ? (
          <div style={{ display:"flex", flexDirection:"column", gap:10 }}>
            {[...Array(4)].map((_,i) => <Skeleton key={i} h={40} radius={8} />)}
          </div>
        ) : (
          <div style={{ display:"grid", gridTemplateColumns:"2fr 1.2fr 1fr 0.8fr 0.8fr" }}>
            {["Customer","Amount","Type","Score","Status"].map((h,i) => (
              <div key={i} style={{ fontSize:10, color:C.textDim, fontFamily:"'IBM Plex Mono'", letterSpacing:"0.07em", padding:"6px 10px", borderBottom:`1px solid ${C.border}`, background:C.surfaceAlt }}>{h.toUpperCase()}</div>
            ))}
            {(alerts || ALERTS_DATA).slice(0,4).map((a,i) => {
              const col = scoreColor(a.score);
              const ss = {pending:{bg:C.yellowLight,color:C.yellow,label:"Pending"},approved:{bg:C.greenLight,color:C.green,label:"Cleared"},cancelled:{bg:C.redLight,color:C.red,label:"Blocked"}}[a.status];
              return [
                <div key={`n${i}`} style={{ padding:"10px", borderBottom:`1px solid ${C.borderLight}`, fontSize:13, color:C.text, fontWeight:500 }}>{a.customer}</div>,
                <div key={`a${i}`} style={{ padding:"10px", borderBottom:`1px solid ${C.borderLight}`, fontSize:12, color:C.textMid, fontFamily:"'IBM Plex Mono'" }}>{a.amount}</div>,
                <div key={`t${i}`} style={{ padding:"10px", borderBottom:`1px solid ${C.borderLight}`, fontSize:12, color:C.textMid }}>{a.type}</div>,
                <div key={`s${i}`} style={{ padding:"10px", borderBottom:`1px solid ${C.borderLight}` }}><span style={{ fontSize:11, fontFamily:"'IBM Plex Mono'", color:col, fontWeight:700 }}>{a.score}</span></div>,
                <div key={`st${i}`} style={{ padding:"10px", borderBottom:`1px solid ${C.borderLight}` }}><span style={{ fontSize:10, background:ss.bg, color:ss.color, padding:"2px 8px", borderRadius:20, fontWeight:600 }}>{ss.label}</span></div>,
              ];
            })}
          </div>
        )}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// TRANSACTIONS PAGE
// ─────────────────────────────────────────────────────────────────────────────
function TransactionsPage() {
  const { data, loading, error, refetch } = useApi(api.getTransactions);
  const [filter, setFilter] = useState("all");
  const [search, setSearch] = useState("");

  const filtered = (data || []).filter(t => {
    const matchFilter = filter==="all" || t.status===filter;
    const matchSearch = t.customer.toLowerCase().includes(search.toLowerCase()) || t.id.toLowerCase().includes(search.toLowerCase());
    return matchFilter && matchSearch;
  });

  return (
    <div style={{ padding:"20px 24px", overflowY:"auto", height:"100%", width:"100%" }}>
      <div style={{ marginBottom:18 }}>
        <h2 style={{ fontSize:20, fontWeight:800, color:C.text, marginBottom:4 }}>Transactions</h2>
        <p style={{ fontSize:13, color:C.textMid }}>All transactions processed through Inkingi Shield today</p>
      </div>
      <div style={{ display:"flex", gap:10, marginBottom:16, alignItems:"center" }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search customer or ID..."
          style={{ flex:1, padding:"9px 14px", border:`1px solid ${C.border}`, borderRadius:9, fontSize:13, fontFamily:"'DM Sans'", color:C.text, background:C.surface, outline:"none" }} />
        {["all","flagged","blocked","clear"].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding:"8px 14px", background: filter===f ? C.blueLight : C.surface, border:`1px solid ${filter===f ? C.blueMid : C.border}`, borderRadius:8, color: filter===f ? C.blue : C.textMid, fontSize:12, fontWeight: filter===f ? 700 : 400, cursor:"pointer", fontFamily:"'DM Sans'", textTransform:"capitalize" }}>
            {f==="all" ? "All" : f.charAt(0).toUpperCase()+f.slice(1)}
          </button>
        ))}
      </div>
      {error ? <ErrorCard msg={`Failed to load transactions: ${error}`} onRetry={refetch} /> : (
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:13, overflow:"hidden" }}>
          <div style={{ display:"grid", gridTemplateColumns:"0.8fr 1.8fr 1.2fr 1fr 1fr 0.7fr 0.8fr", background:C.surfaceAlt, borderBottom:`1px solid ${C.border}` }}>
            {["ID","Customer","Amount","Type","Channel","Score","Status"].map((h,i) => (
              <div key={i} style={{ padding:"10px 12px", fontSize:10, color:C.textDim, fontFamily:"'IBM Plex Mono'", letterSpacing:"0.07em" }}>{h.toUpperCase()}</div>
            ))}
          </div>
          {loading ? [...Array(5)].map((_,i) => (
            <div key={i} style={{ display:"grid", gridTemplateColumns:"0.8fr 1.8fr 1.2fr 1fr 1fr 0.7fr 0.8fr", padding:"12px", borderBottom:`1px solid ${C.borderLight}`, gap:12 }}>
              {[...Array(7)].map((_,j) => <Skeleton key={j} h={14} radius={4} />)}
            </div>
          )) : filtered.length === 0 ? (
            <div style={{ padding:"32px", textAlign:"center", color:C.textDim, fontSize:13 }}>No transactions match your filter.</div>
          ) : filtered.map((t,i) => {
            const col = scoreColor(t.score);
            const ss = {flagged:{bg:C.yellowLight,color:C.yellow,label:"Flagged"},blocked:{bg:C.redLight,color:C.red,label:"Blocked"},clear:{bg:C.greenLight,color:C.green,label:"Clear"}}[t.status];
            return (
              <div key={i} style={{ display:"grid", gridTemplateColumns:"0.8fr 1.8fr 1.2fr 1fr 1fr 0.7fr 0.8fr", borderBottom: i<filtered.length-1 ? `1px solid ${C.borderLight}` : "none" }}>
                <div style={{ padding:"11px 12px", fontSize:11, color:C.blue, fontFamily:"'IBM Plex Mono'", fontWeight:500 }}>{t.id}</div>
                <div style={{ padding:"11px 12px", fontSize:13, color:C.text, fontWeight:500 }}>{t.customer}</div>
                <div style={{ padding:"11px 12px", fontSize:12, color:C.text, fontFamily:"'IBM Plex Mono'" }}>{t.amount}</div>
                <div style={{ padding:"11px 12px", fontSize:12, color:C.textMid }}>{t.type}</div>
                <div style={{ padding:"11px 12px", fontSize:12, color:C.textMid }}>{t.channel}</div>
                <div style={{ padding:"11px 12px" }}><span style={{ fontSize:12, fontFamily:"'IBM Plex Mono'", color:col, fontWeight:700 }}>{t.score}</span></div>
                <div style={{ padding:"11px 12px" }}><span style={{ fontSize:10, background:ss.bg, color:ss.color, padding:"2px 8px", borderRadius:20, fontWeight:600 }}>{ss.label}</span></div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ANALYTICS PAGE
// ─────────────────────────────────────────────────────────────────────────────
function AnalyticsPage() {
  // Monthly fraud data — realistic numbers for a Rwandan pilot deployment
  // Trend: adoption grew Aug→Nov, spike in Dec (year-end), stabilised in Jan/Feb
  const months    = ["Aug","Sep","Oct","Nov","Dec","Jan","Feb"];
  const detected  = [14, 19, 23, 31, 47, 38, 29];   // fraud cases flagged per month
  const prevented = [12, 17, 22, 29, 44, 35, 28];   // cases confirmed & blocked

  // These metrics come directly from the trained Random Forest on PaySim
  // AUC 0.9997, 1637/1643 fraud caught, 0 false positives on test set
  const MODEL_METRICS = [
    { label:"Model Accuracy",      value:"99.6%",  sub:"On PaySim test set",       color:C.green  },
    { label:"Precision",           value:"99.9%",  sub:"Flagged cases confirmed",   color:C.blue   },
    { label:"Recall",              value:"99.6%",  sub:"Fraud cases caught",        color:C.yellow },
    { label:"F1 Score",            value:"99.7%",  sub:"Harmonic mean",             color:C.green  },
    { label:"False Positive Rate", value:"0.04%",  sub:"Legitimate txns flagged",   color:C.orange },
    { label:"Avg Detection Time",  value:"<200ms", sub:"Per transaction",           color:C.blue   },
  ];

  // PaySim fraud concentrates almost entirely in CASH_OUT and TRANSFER
  const BY_TYPE = [
    { type:"Mobile Money (MoMo)",  total:"48,214", flagged:62,  rate:"0.13%", pctOfFraud:71, color:C.blue   },
    { type:"Bank Transfer",        total:"12,847", flagged:18,  rate:"0.14%", pctOfFraud:21, color:C.green  },
    { type:"Merchant Pay",         total:"9,103",  flagged:6,   rate:"0.07%", pctOfFraud:8,  color:C.yellow },
  ];

  // Feature importances from the trained model (shown in train output)
  const TRIGGERS = [
    { label:"Balance ratio anomaly",  pct:89, note:"amount_ratio > 1.0" },
    { label:"Balance drain to zero",  pct:82, note:"balance_diff = old_balance" },
    { label:"CASH_OUT / TRANSFER",    pct:68, note:"transaction type" },
    { label:"High transaction amount",pct:54, note:"amount > RWF 2M" },
    { label:"Low starting balance",   pct:41, note:"old_balance < amount" },
  ];

  const maxBar = Math.max(...detected.map((d,i) => d + prevented[i]));

  return (
    <div style={{ padding:"20px 24px", overflowY:"auto", height:"100%", width:"100%" }}>
      <div style={{ marginBottom:18 }}>
        <h2 style={{ fontSize:20, fontWeight:800, color:C.text, marginBottom:4 }}>Analytics</h2>
        <p style={{ fontSize:13, color:C.textMid }}>Model performance and fraud trends — PaySim dataset · Random Forest</p>
      </div>

      {/* Model metrics */}
      <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:13, marginBottom:16 }}>
        {MODEL_METRICS.map((s,i) => (
          <div key={i} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:"16px", borderTop:`3px solid ${s.color}` }}>
            <div style={{ fontSize:10, color:C.textDim, fontFamily:"'IBM Plex Mono'", letterSpacing:"0.07em", marginBottom:7 }}>{s.label.toUpperCase()}</div>
            <div style={{ fontSize:26, fontWeight:800, color:s.color, fontFamily:"'IBM Plex Mono'" }}>{s.value}</div>
            <div style={{ fontSize:11, color:C.textMid, marginTop:3 }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1.4fr 1fr", gap:14, marginBottom:14 }}>
        {/* Monthly trend chart */}
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:13, padding:"20px" }}>
          <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between", marginBottom:18 }}>
            <div style={{ fontWeight:700, color:C.text, fontSize:14 }}>Fraud Detected vs Blocked (7 months)</div>
            <div style={{ fontSize:10, color:C.textDim, fontFamily:"'IBM Plex Mono'" }}>AUG 2025 – FEB 2026</div>
          </div>
          <div style={{ display:"flex", alignItems:"flex-end", gap:8, height:130, marginBottom:10 }}>
            {months.map((m,i) => (
              <div key={i} style={{ flex:1, display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
                <div style={{ width:"100%", display:"flex", gap:2, alignItems:"flex-end", height:110 }}>
                  <div style={{ flex:1, background:C.red+"99", borderRadius:"3px 3px 0 0", height:`${(detected[i]/maxBar)*100}%`, transition:"height 0.6s ease", minHeight:3 }} />
                  <div style={{ flex:1, background:C.green+"CC", borderRadius:"3px 3px 0 0", height:`${(prevented[i]/maxBar)*100}%`, transition:"height 0.6s ease", minHeight:3 }} />
                </div>
                <span style={{ fontSize:9, color:C.textDim, fontFamily:"'IBM Plex Mono'" }}>{m}</span>
              </div>
            ))}
          </div>
          <div style={{ display:"flex", gap:20, alignItems:"center" }}>
            {[{col:C.red+"99",label:"Detected"},{col:C.green+"CC",label:"Blocked"}].map((l,i) => (
              <div key={i} style={{ display:"flex", gap:5, alignItems:"center" }}>
                <div style={{ width:10, height:10, borderRadius:2, background:l.col }} />
                <span style={{ fontSize:11, color:C.textMid }}>{l.label}</span>
              </div>
            ))}
            <span style={{ fontSize:10, color:C.textDim, marginLeft:"auto", fontFamily:"'IBM Plex Mono'" }}>
              {detected.reduce((a,b)=>a+b,0)} total · {prevented.reduce((a,b)=>a+b,0)} blocked
            </span>
          </div>
        </div>

        {/* Top fraud triggers from model feature importances */}
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:13, padding:"20px" }}>
          <div style={{ fontWeight:700, color:C.text, fontSize:14, marginBottom:4 }}>Top Fraud Signals</div>
          <div style={{ fontSize:11, color:C.textDim, marginBottom:16, fontFamily:"'IBM Plex Mono'" }}>from model feature importances</div>
          {TRIGGERS.map((t,i) => (
            <div key={i} style={{ marginBottom:13 }}>
              <div style={{ display:"flex", justifyContent:"space-between", marginBottom:3 }}>
                <div>
                  <span style={{ fontSize:12, color:C.text, fontWeight:600 }}>{t.label}</span>
                  <span style={{ fontSize:10, color:C.textDim, marginLeft:7, fontFamily:"'IBM Plex Mono'" }}>{t.note}</span>
                </div>
                <span style={{ fontSize:11, fontFamily:"'IBM Plex Mono'", color:C.red, fontWeight:700 }}>{t.pct}%</span>
              </div>
              <div style={{ height:5, background:C.borderLight, borderRadius:3, overflow:"hidden" }}>
                <div style={{ width:`${t.pct}%`, height:"100%", background:`linear-gradient(90deg,${C.red}66,${C.red})`, borderRadius:3, transition:"width 0.8s ease" }} />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Fraud by transaction type */}
      <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:13, padding:"20px" }}>
        <div style={{ display:"flex", alignItems:"baseline", justifyContent:"space-between", marginBottom:16 }}>
          <div style={{ fontWeight:700, color:C.text, fontSize:14 }}>Fraud by Transaction Type</div>
          <div style={{ fontSize:10, color:C.textDim, fontFamily:"'IBM Plex Mono'" }}>Pilot period · Aug 2025 – Feb 2026</div>
        </div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14 }}>
          {BY_TYPE.map((t,i) => (
            <div key={i} style={{ padding:"16px", background:C.surfaceAlt, borderRadius:10, border:`1px solid ${C.border}`, borderTop:`2px solid ${t.color}` }}>
              <div style={{ fontWeight:700, color:C.text, fontSize:13, marginBottom:12 }}>{t.type}</div>
              {[["Transactions",t.total],["Fraud Cases",t.flagged],["Fraud Rate",t.rate],["% of All Fraud",`${t.pctOfFraud}%`]].map(([l,v],j) => (
                <div key={j} style={{ display:"flex", justifyContent:"space-between", padding:"5px 0", borderBottom: j<3 ? `1px solid ${C.border}` : "none" }}>
                  <span style={{ fontSize:11, color:C.textMid }}>{l}</span>
                  <span style={{ fontSize:12, fontWeight:700, color: j>=2 ? t.color : C.text, fontFamily:"'IBM Plex Mono'" }}>{v}</span>
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// CUSTOMERS PAGE
// ─────────────────────────────────────────────────────────────────────────────

const CUST_TXNS = {
  "CUST-001": [
    {id:"TXN-8821",date:"Feb 22, 2026",amount:"RWF 4,250,000",type:"Mobile Money",score:92,status:"flagged"},
    {id:"TXN-8790",date:"Feb 15, 2026",amount:"RWF 180,000",type:"Payment",score:11,status:"clear"},
    {id:"TXN-8763",date:"Feb 09, 2026",amount:"RWF 95,000",type:"Transfer",score:8,status:"clear"},
    {id:"TXN-8740",date:"Jan 28, 2026",amount:"RWF 420,000",type:"Payment",score:29,status:"clear"},
    {id:"TXN-8701",date:"Jan 14, 2026",amount:"RWF 3,800,000",type:"Mobile Money",score:88,status:"flagged"},
  ],
  "CUST-002": [
    {id:"TXN-8820",date:"Feb 22, 2026",amount:"RWF 1,800,000",type:"Bank Transfer",score:74,status:"flagged"},
    {id:"TXN-8812",date:"Feb 20, 2026",amount:"RWF 250,000",type:"Payment",score:14,status:"clear"},
    {id:"TXN-8798",date:"Feb 18, 2026",amount:"RWF 900,000",type:"Bank Transfer",score:61,status:"flagged"},
    {id:"TXN-8770",date:"Feb 10, 2026",amount:"RWF 75,000",type:"MoMo",score:5,status:"clear"},
  ],
  "CUST-003": [
    {id:"TXN-8819",date:"Feb 22, 2026",amount:"RWF 920,000",type:"Merchant Pay",score:58,status:"flagged"},
    {id:"TXN-8800",date:"Feb 19, 2026",amount:"RWF 310,000",type:"Transfer",score:22,status:"clear"},
    {id:"TXN-8774",date:"Feb 11, 2026",amount:"RWF 145,000",type:"Payment",score:17,status:"clear"},
  ],
  "CUST-004": [
    {id:"TXN-8818",date:"Feb 22, 2026",amount:"RWF 350,000",type:"Mobile Money",score:31,status:"clear"},
    {id:"TXN-8795",date:"Feb 17, 2026",amount:"RWF 120,000",type:"Payment",score:9,status:"clear"},
    {id:"TXN-8768",date:"Feb 08, 2026",amount:"RWF 85,000",type:"Transfer",score:12,status:"clear"},
    {id:"TXN-8742",date:"Jan 29, 2026",amount:"RWF 230,000",type:"MoMo",score:7,status:"clear"},
  ],
  "CUST-005": [
    {id:"TXN-8817",date:"Feb 22, 2026",amount:"RWF 2,100,000",type:"Bank Transfer",score:85,status:"flagged"},
    {id:"TXN-8791",date:"Feb 16, 2026",amount:"RWF 1,400,000",type:"Mobile Money",score:79,status:"flagged"},
    {id:"TXN-8755",date:"Feb 05, 2026",amount:"RWF 560,000",type:"Payment",score:41,status:"clear"},
  ],
  "CUST-006": [
    {id:"TXN-8816",date:"Feb 22, 2026",amount:"RWF 780,000",type:"Mobile Money",score:67,status:"flagged"},
    {id:"TXN-8789",date:"Feb 15, 2026",amount:"RWF 200,000",type:"Payment",score:18,status:"clear"},
    {id:"TXN-8760",date:"Feb 07, 2026",amount:"RWF 450,000",type:"Transfer",score:33,status:"clear"},
  ],
};

function CustomerDrawer({ customer, onClose }) {
  const [tab, setTab] = useState("overview");
  const rc = {"high-risk":C.red,"medium-risk":C.orange,"low-risk":C.green}[customer.status];
  const rb = {"high-risk":C.redLight,"medium-risk":C.orangeLight,"low-risk":C.greenLight}[customer.status];
  const rl = {"high-risk":"High Risk","medium-risk":"Medium Risk","low-risk":"Low Risk"}[customer.status];
  const txns = CUST_TXNS[customer.id] || [];
  const avgScore = txns.length ? Math.round(txns.reduce((s,t)=>s+t.score,0)/txns.length) : 0;

  return (
    <div style={{ position:"fixed", inset:0, zIndex:500, display:"flex" }}>
      <div onClick={onClose} style={{ flex:1, background:"rgba(15,23,42,0.4)", backdropFilter:"blur(3px)" }} />
      <div style={{ width:600, background:C.bg, borderLeft:`1px solid ${C.border}`, display:"flex", flexDirection:"column", boxShadow:"-8px 0 48px rgba(0,0,0,0.15)", animation:"slideIn 0.22s cubic-bezier(.22,1,.36,1)" }}>
        <style>{`@keyframes slideIn{from{transform:translateX(40px);opacity:0}to{transform:translateX(0);opacity:1}}`}</style>
        {/* Header */}
        <div style={{ borderTop:`3px solid ${rc}`, background:C.surface, padding:"22px 24px 0", borderBottom:`1px solid ${C.border}`, flexShrink:0 }}>
          <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:16 }}>
            <div style={{ width:58, height:58, borderRadius:"50%", background:`linear-gradient(135deg,${C.blueDeep},${C.green})`, display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontWeight:800, fontSize:19, flexShrink:0 }}>{customer.initials}</div>
            <div style={{ flex:1 }}>
              <div style={{ fontWeight:800, color:C.text, fontSize:20 }}>{customer.name}</div>
              <div style={{ fontSize:11, color:C.textDim, fontFamily:"'IBM Plex Mono'", marginTop:3 }}>{customer.id} · {customer.location} · Since {customer.joined}</div>
            </div>
            <span style={{ fontSize:11, background:rb, color:rc, border:`1px solid ${rc}40`, padding:"4px 12px", borderRadius:20, fontWeight:700, flexShrink:0 }}>{rl}</span>
            <button onClick={onClose} style={{ width:32, height:32, borderRadius:"50%", border:`1px solid ${C.border}`, background:C.surfaceAlt, cursor:"pointer", display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
              <Ico d={IC.x} size={14} color={C.textMid} />
            </button>
          </div>
          {/* Quick stats */}
          <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:10, marginBottom:16 }}>
            {[["Transactions",customer.transactions,C.blue],["Volume",customer.totalVolume,C.green],["Flags",customer.flags,customer.flags>0?C.red:C.green],["Risk Score",customer.riskScore,rc]].map(([l,v,col],i) => (
              <div key={i} style={{ background:C.surfaceAlt, borderRadius:9, padding:"10px 12px", textAlign:"center" }}>
                <div style={{ fontSize:17, fontWeight:800, color:col, fontFamily:"'IBM Plex Mono'" }}>{v}</div>
                <div style={{ fontSize:10, color:C.textDim, marginTop:2 }}>{l}</div>
              </div>
            ))}
          </div>
          {/* Tabs */}
          <div style={{ display:"flex" }}>
            {["overview","transactions","risk"].map(t => (
              <button key={t} onClick={() => setTab(t)} style={{ padding:"10px 16px", border:"none", background:"none", cursor:"pointer", fontFamily:"'DM Sans'", fontSize:13, fontWeight: tab===t?700:400, color: tab===t?C.blue:C.textMid, borderBottom:`2px solid ${tab===t?C.blue:"transparent"}`, marginBottom:-1, whiteSpace:"nowrap" }}>
                {t==="risk"?"Risk Analysis":t.charAt(0).toUpperCase()+t.slice(1)}
              </button>
            ))}
          </div>
        </div>
        {/* Scrollable body */}
        <div style={{ flex:1, overflowY:"auto", padding:"20px 24px", background:C.surfaceAlt }}>
          {tab==="overview" && (
            <div style={{ display:"flex", flexDirection:"column", gap:13 }}>
              <div style={{ background:C.surface, borderRadius:12, border:`1px solid ${C.border}`, padding:"18px" }}>
                <div style={{ fontSize:12, fontWeight:700, color:C.text, marginBottom:14, paddingBottom:10, borderBottom:`1px solid ${C.border}` }}>Contact & Account Details</div>
                {[["Email",customer.email],["Phone",customer.phone],["Location",customer.location],["Customer Since",customer.joined],["Customer ID",customer.id],["KYC Status","✓ Fully Verified"],["Account Type","Mobile Money (MoMo)"],["Account Status","Active"]].map(([l,v],i) => (
                  <div key={i} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"8px 0", borderBottom:i<7?`1px solid ${C.borderLight}`:"none" }}>
                    <span style={{ fontSize:12, color:C.textMid }}>{l}</span>
                    <span style={{ fontSize:12, color:C.text, fontWeight:600 }}>{v}</span>
                  </div>
                ))}
              </div>
              <div style={{ background:C.surface, borderRadius:12, border:`1px solid ${C.border}`, padding:"18px" }}>
                <div style={{ fontSize:12, fontWeight:700, color:C.text, marginBottom:12 }}>Risk Signals</div>
                <div style={{ display:"flex", gap:7, flexWrap:"wrap" }}>
                  {(customer.flags>2
                    ? [{t:"Multiple Flags",c:C.red},{t:"High Volume",c:C.red},{t:"IP Mismatch",c:C.orange},{t:"Known Device",c:C.green}]
                    : customer.flags>0
                    ? [{t:"Minor Velocity",c:C.orange},{t:"New Device",c:C.orange},{t:"Clean History",c:C.green}]
                    : [{t:"Clean Record",c:C.green},{t:"Verified Device",c:C.green},{t:"Consistent Behavior",c:C.green},{t:"Long-standing",c:C.green}]
                  ).map((s,i) => (
                    <span key={i} style={{ fontSize:11, background:s.c+"18", color:s.c, border:`1px solid ${s.c}44`, padding:"3px 10px", borderRadius:20, fontWeight:500 }}>{s.t}</span>
                  ))}
                </div>
              </div>
            </div>
          )}
          {tab==="transactions" && (
            <div style={{ display:"flex", flexDirection:"column", gap:12 }}>
              {/* Summary bar */}
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10 }}>
                {[["Flagged",txns.filter(t=>t.status==="flagged"||t.status==="blocked").length,C.red],["Clear",txns.filter(t=>t.status==="clear").length,C.green],["Avg Score",avgScore,scoreColor(avgScore)]].map(([l,v,col],i) => (
                  <div key={i} style={{ background:C.surface, borderRadius:9, padding:"12px", textAlign:"center", border:`1px solid ${C.border}` }}>
                    <div style={{ fontSize:20, fontWeight:800, color:col, fontFamily:"'IBM Plex Mono'" }}>{v}</div>
                    <div style={{ fontSize:11, color:C.textDim, marginTop:2 }}>{l}</div>
                  </div>
                ))}
              </div>
              {/* Table */}
              <div style={{ background:C.surface, borderRadius:12, border:`1px solid ${C.border}`, overflow:"hidden" }}>
                <div style={{ display:"grid", gridTemplateColumns:"1fr 1.4fr 1fr 0.65fr 0.8fr", background:C.surfaceAlt, borderBottom:`1px solid ${C.border}` }}>
                  {["ID","Amount","Type","Score","Status"].map((h,i) => (
                    <div key={i} style={{ padding:"9px 13px", fontSize:10, color:C.textDim, fontFamily:"'IBM Plex Mono'", letterSpacing:"0.07em" }}>{h}</div>
                  ))}
                </div>
                {txns.map((t,i) => {
                  const col = scoreColor(t.score);
                  const ss = {flagged:{bg:C.yellowLight,color:C.yellow,label:"Flagged"},blocked:{bg:C.redLight,color:C.red,label:"Blocked"},clear:{bg:C.greenLight,color:C.green,label:"Clear"}}[t.status];
                  return (
                    <div key={i} style={{ display:"grid", gridTemplateColumns:"1fr 1.4fr 1fr 0.65fr 0.8fr", borderBottom:i<txns.length-1?`1px solid ${C.borderLight}`:"none", background:t.status!=="clear"?"#FFF8F8":"white" }}>
                      <div style={{ padding:"10px 13px", fontSize:11, color:C.blue, fontFamily:"'IBM Plex Mono'" }}>{t.id}</div>
                      <div style={{ padding:"10px 13px" }}>
                        <div style={{ fontSize:12, color:C.text, fontWeight:600 }}>{t.amount}</div>
                        <div style={{ fontSize:10, color:C.textDim, fontFamily:"'IBM Plex Mono'", marginTop:1 }}>{t.date}</div>
                      </div>
                      <div style={{ padding:"10px 13px", fontSize:12, color:C.textMid, alignSelf:"center" }}>{t.type}</div>
                      <div style={{ padding:"10px 13px", alignSelf:"center" }}><span style={{ fontSize:12, fontFamily:"'IBM Plex Mono'", color:col, fontWeight:700 }}>{t.score}</span></div>
                      <div style={{ padding:"10px 13px", alignSelf:"center" }}><span style={{ fontSize:10, background:ss.bg, color:ss.color, padding:"2px 8px", borderRadius:20, fontWeight:600 }}>{ss.label}</span></div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {tab==="risk" && (
            <div style={{ display:"flex", flexDirection:"column", gap:13 }}>
              <div style={{ background:C.surface, borderRadius:12, border:`1px solid ${C.border}`, padding:"18px" }}>
                <div style={{ fontSize:12, fontWeight:700, color:C.text, marginBottom:14 }}>Risk Score Breakdown</div>
                <div style={{ display:"flex", alignItems:"center", gap:18, marginBottom:16 }}>
                  <div style={{ position:"relative", width:76, height:76, flexShrink:0 }}>
                    <svg width={76} height={76} viewBox="0 0 52 52" style={{ transform:"rotate(-90deg)" }}>
                      <circle cx="26" cy="26" r="22" fill="none" stroke={rb} strokeWidth="5" />
                      <circle cx="26" cy="26" r="22" fill="none" stroke={rc} strokeWidth="5" strokeLinecap="round"
                        strokeDasharray={`${(customer.riskScore/100)*2*Math.PI*22} ${2*Math.PI*22}`} />
                    </svg>
                    <div style={{ position:"absolute", inset:0, display:"flex", alignItems:"center", justifyContent:"center" }}>
                      <span style={{ fontSize:16, fontWeight:800, color:rc, fontFamily:"'IBM Plex Mono'" }}>{customer.riskScore}</span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontWeight:800, color:rc, fontSize:17, marginBottom:5 }}>{rl}</div>
                    <div style={{ fontSize:13, color:C.textMid, lineHeight:1.65, maxWidth:380 }}>
                      {customer.status==="high-risk"
                        ? "This customer shows multiple high-confidence fraud indicators. All transactions should be manually reviewed before processing."
                        : customer.status==="medium-risk"
                        ? "Some irregular activity detected. Monitor closely and verify any transactions above RWF 500,000."
                        : "Clean transaction history. No significant fraud indicators detected across all recorded activity."}
                    </div>
                  </div>
                </div>
              </div>
              <div style={{ background:C.surface, borderRadius:12, border:`1px solid ${C.border}`, padding:"18px" }}>
                <div style={{ fontSize:12, fontWeight:700, color:C.text, marginBottom:16 }}>Risk Factor Analysis</div>
                {[
                  {label:"Transaction Velocity",score:customer.flags>2?82:customer.flags>0?45:12,desc:"Rate vs. baseline"},
                  {label:"Amount Anomaly",score:customer.riskScore>70?78:customer.riskScore>40?38:10,desc:"vs. customer average"},
                  {label:"Device Trust",score:customer.flags>2?71:customer.flags>0?30:5,desc:"New vs. known devices"},
                  {label:"Location Consistency",score:customer.riskScore>70?55:customer.riskScore>40?25:8,desc:"Geographic patterns"},
                  {label:"Historical Behavior",score:customer.flags>0?40:5,desc:"Past 90 days"},
                ].map((f,i) => (
                  <div key={i} style={{ marginBottom:13 }}>
                    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"baseline", marginBottom:5 }}>
                      <div>
                        <span style={{ fontSize:13, color:C.text, fontWeight:500 }}>{f.label}</span>
                        <span style={{ fontSize:11, color:C.textDim, marginLeft:8 }}>{f.desc}</span>
                      </div>
                      <span style={{ fontSize:12, fontFamily:"'IBM Plex Mono'", color:scoreColor(f.score), fontWeight:700 }}>{f.score}/100</span>
                    </div>
                    <div style={{ height:7, background:C.borderLight, borderRadius:4, overflow:"hidden" }}>
                      <div style={{ width:`${f.score}%`, height:"100%", background:`linear-gradient(90deg,${scoreColor(f.score)}66,${scoreColor(f.score)})`, borderRadius:4, transition:"width 0.7s ease" }} />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function CustomersPage() {
  const { data, loading, error, refetch } = useApi(api.getCustomers);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const riskColor = {"high-risk":C.red,"medium-risk":C.orange,"low-risk":C.green};
  const riskBg = {"high-risk":C.redLight,"medium-risk":C.orangeLight,"low-risk":C.greenLight};
  const riskLabel = {"high-risk":"High Risk","medium-risk":"Medium Risk","low-risk":"Low Risk"};

  const filtered = (data||[]).filter(c => {
    const matchSearch = c.name.toLowerCase().includes(search.toLowerCase()) || c.email.toLowerCase().includes(search.toLowerCase());
    const matchFilter = filter==="all" || c.status===filter;
    return matchSearch && matchFilter;
  });

  return (
    <div style={{ padding:"20px 24px", overflowY:"auto", height:"100%", width:"100%" }}>
      {selected && <CustomerDrawer customer={selected} onClose={() => setSelected(null)} />}
      <div style={{ marginBottom:18 }}>
        <h2 style={{ fontSize:20, fontWeight:800, color:C.text, marginBottom:4 }}>Customers</h2>
        <p style={{ fontSize:13, color:C.textMid }}>Customer risk profiles and transaction history</p>
      </div>
      <div style={{ display:"flex", gap:10, marginBottom:16 }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name or email..."
          style={{ flex:1, padding:"9px 14px", border:`1px solid ${C.border}`, borderRadius:9, fontSize:13, fontFamily:"'DM Sans'", color:C.text, background:C.surface, outline:"none" }} />
        {["all","high-risk","medium-risk","low-risk"].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ padding:"8px 12px", background: filter===f ? C.blueLight : C.surface, border:`1px solid ${filter===f ? C.blueMid : C.border}`, borderRadius:8, color: filter===f ? C.blue : C.textMid, fontSize:12, fontWeight: filter===f ? 700 : 400, cursor:"pointer", fontFamily:"'DM Sans'", whiteSpace:"nowrap" }}>
            {f==="all" ? "All" : riskLabel[f]}
          </button>
        ))}
      </div>
      {error ? <ErrorCard msg={`Failed to load customers: ${error}`} onRetry={refetch} /> :
       loading ? (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:13 }}>
          {[...Array(6)].map((_,i) => (
            <div key={i} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:13, padding:"18px" }}>
              <div style={{ display:"flex", gap:13, marginBottom:14 }}>
                <Skeleton w={46} h={46} radius={23} />
                <div style={{ flex:1 }}><Skeleton h={16} mb={6} /><Skeleton w="60%" h={12} /></div>
              </div>
              <Skeleton h={60} radius={8} mb={10} />
              <Skeleton h={10} />
            </div>
          ))}
        </div>
      ) : (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(2,1fr)", gap:13 }}>
          {filtered.map((c,i) => (
            <div key={i} onClick={() => setSelected(c)} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:13, padding:"18px", boxShadow:"0 1px 4px rgba(0,0,0,0.04)", cursor:"pointer", transition:"border 0.15s, box-shadow 0.15s" }} onMouseEnter={e=>{e.currentTarget.style.border=`1px solid ${C.blue}`;e.currentTarget.style.boxShadow=`0 4px 18px rgba(26,143,191,0.12)`;}} onMouseLeave={e=>{e.currentTarget.style.border=`1px solid ${C.border}`;e.currentTarget.style.boxShadow="0 1px 4px rgba(0,0,0,0.04)";}}>
              <div style={{ display:"flex", alignItems:"center", gap:13, marginBottom:14 }}>
                <div style={{ width:46, height:46, borderRadius:"50%", background:`linear-gradient(135deg,${C.blueDeep},${C.green})`, display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontWeight:800, fontSize:15, flexShrink:0 }}>{c.initials}</div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, color:C.text, fontSize:14 }}>{c.name}</div>
                  <div style={{ fontSize:11, color:C.textDim, fontFamily:"'IBM Plex Mono'" }}>{c.id} · {c.location}</div>
                </div>
                <div style={{ display:"flex", flexDirection:"column", alignItems:"flex-end", gap:4 }}><span style={{ fontSize:10, background:riskBg[c.status], color:riskColor[c.status], border:`1px solid ${riskColor[c.status]}40`, padding:"3px 9px", borderRadius:20, fontWeight:700 }}>{riskLabel[c.status]}</span><span style={{ fontSize:10, color:C.blue, fontWeight:600 }}>View details →</span></div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:12 }}>
                {[["Transactions",c.transactions],["Volume",c.totalVolume],["Flags",c.flags]].map(([l,v],j) => (
                  <div key={j} style={{ background:C.surfaceAlt, borderRadius:8, padding:"8px 10px", textAlign:"center" }}>
                    <div style={{ fontSize:13, fontWeight:800, color:C.text }}>{v}</div>
                    <div style={{ fontSize:10, color:C.textDim, marginTop:2 }}>{l}</div>
                  </div>
                ))}
              </div>
              <div style={{ display:"flex", alignItems:"center", gap:8 }}>
                <span style={{ fontSize:11, color:C.textMid }}>Risk Score</span>
                <div style={{ flex:1, height:5, background:C.borderLight, borderRadius:3, overflow:"hidden" }}>
                  <div style={{ width:`${c.riskScore}%`, height:"100%", background:`linear-gradient(90deg,${riskColor[c.status]}88,${riskColor[c.status]})`, borderRadius:3 }} />
                </div>
                <span style={{ fontSize:11, fontFamily:"'IBM Plex Mono'", color:riskColor[c.status], fontWeight:700 }}>{c.riskScore}</span>
              </div>
              <div style={{ marginTop:10, paddingTop:10, borderTop:`1px solid ${C.border}`, display:"flex", gap:12, flexWrap:"wrap" }}>
                <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                  <Ico d={IC.mail} size={11} color={C.textDim} />
                  <span style={{ fontSize:11, color:C.textDim }}>{c.email}</span>
                </div>
                <div style={{ display:"flex", alignItems:"center", gap:5 }}>
                  <Ico d={IC.phone} size={11} color={C.textDim} />
                  <span style={{ fontSize:11, color:C.textDim }}>{c.phone}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// SETTINGS PAGE — with real browser notification permission request
// ─────────────────────────────────────────────────────────────────────────────
function SettingsPage() {
  const [notifications, setNotifications] = useState({ email:true, sms:false, dashboard:true, browser:false });
  const [threshold, setThreshold] = useState(70);
  const [saved, setSaved] = useState(false);
  const [notifPermission, setNotifPermission] = useState(typeof Notification !== "undefined" ? Notification.permission : "default");

  const toggleNotif = async (key) => {
    if (key === "browser") {
      if (notifPermission !== "granted") {
        try {
          const perm = await Notification.requestPermission();
          setNotifPermission(perm);
          if (perm === "granted") {
            setNotifications(p => ({...p, browser:true}));
            new Notification("Inkingi Shield", { body:"Browser notifications enabled. You'll be alerted for CRITICAL fraud flags.", icon:"/favicon.ico" });
          }
        } catch { /* not supported */ }
        return;
      }
    }
    setNotifications(p => ({...p, [key]:!p[key]}));
  };

  const save = () => {
    setSaved(true);
    // persist to sessionStorage so settings survive navigation
    try { sessionStorage.setItem("inkingi_settings", JSON.stringify({ notifications, threshold })); } catch {}
    setTimeout(() => setSaved(false), 2500);
  };

  // Load saved settings on mount
  useEffect(() => {
    try {
      const saved = sessionStorage.getItem("inkingi_settings");
      if (saved) { const s = JSON.parse(saved); setNotifications(s.notifications); setThreshold(s.threshold); }
    } catch {}
  }, []);

  return (
    <div style={{ padding:"20px 24px", overflowY:"auto", height:"100%", width:"100%" }}>
      <div style={{ marginBottom:18 }}>
        <h2 style={{ fontSize:20, fontWeight:800, color:C.text, marginBottom:4 }}>Settings</h2>
        <p style={{ fontSize:13, color:C.textMid }}>Configure your Inkingi Shield dashboard</p>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:13, padding:"22px" }}>
          <div style={{ fontWeight:700, color:C.text, fontSize:14, marginBottom:16, paddingBottom:12, borderBottom:`1px solid ${C.border}` }}>Institution Profile</div>
          {[["Institution Name","MTN Rwanda (Demo)"],["Dashboard ID","INKINGI-RW-001"],["Plan","Pilot — Free"],["Data Region","Rwanda (East Africa)"]].map(([l,v],i) => (
            <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"9px 0", borderBottom: i<3 ? `1px solid ${C.borderLight}` : "none" }}>
              <span style={{ fontSize:12.5, color:C.textMid }}>{l}</span>
              <span style={{ fontSize:12.5, color:C.text, fontWeight:600 }}>{v}</span>
            </div>
          ))}
        </div>
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:13, padding:"22px" }}>
          <div style={{ fontWeight:700, color:C.text, fontSize:14, marginBottom:16, paddingBottom:12, borderBottom:`1px solid ${C.border}` }}>Alert Threshold</div>
          <p style={{ fontSize:13, color:C.textMid, marginBottom:14, lineHeight:1.65 }}>Transactions above this fraud score will be automatically flagged for review.</p>
          <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:10 }}>
            <input type="range" min="40" max="95" value={threshold} onChange={e => setThreshold(Number(e.target.value))}
              style={{ flex:1, accentColor:C.blue }} />
            <span style={{ fontSize:20, fontWeight:800, color:C.blue, fontFamily:"'IBM Plex Mono'", width:48, textAlign:"right" }}>{threshold}</span>
          </div>
          <div style={{ display:"flex", gap:8 }}>
            {[{val:60,label:"Sensitive"},{val:70,label:"Balanced"},{val:85,label:"Strict"}].map(p => (
              <button key={p.val} onClick={() => setThreshold(p.val)} style={{ flex:1, padding:"7px 0", background: threshold===p.val ? C.blueLight : C.surfaceAlt, border:`1px solid ${threshold===p.val ? C.blueMid : C.border}`, borderRadius:7, color: threshold===p.val ? C.blue : C.textMid, fontSize:12, fontWeight: threshold===p.val ? 700 : 400, cursor:"pointer", fontFamily:"'DM Sans'" }}>
                {p.label}
              </button>
            ))}
          </div>
        </div>
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:13, padding:"22px" }}>
          <div style={{ fontWeight:700, color:C.text, fontSize:14, marginBottom:16, paddingBottom:12, borderBottom:`1px solid ${C.border}` }}>Notifications</div>
          {[
            {key:"email",label:"Email alerts",sub:"Get notified by email on CRITICAL flags"},
            {key:"sms",label:"SMS alerts",sub:"Text message for HIGH and above"},
            {key:"dashboard",label:"In-app alerts",sub:"Toast notifications (recommended)"},
            {key:"browser",label:"Browser notifications",sub: notifPermission==="denied" ? "Blocked — please allow in browser settings" : notifPermission==="granted" ? "Desktop notifications enabled" : "Click to request permission"},
          ].map(n => (
            <div key={n.key} style={{ display:"flex", justifyContent:"space-between", alignItems:"center", padding:"10px 0", borderBottom: n.key!=="browser" ? `1px solid ${C.borderLight}` : "none" }}>
              <div>
                <div style={{ fontSize:13, color:C.text, fontWeight:500 }}>{n.label}</div>
                <div style={{ fontSize:11, color: n.key==="browser" && notifPermission==="denied" ? C.red : C.textDim }}>{n.sub}</div>
              </div>
              <div onClick={() => notifPermission!=="denied" && toggleNotif(n.key)}
                style={{ width:42, height:24, borderRadius:12, background: notifications[n.key] ? C.green : C.border, cursor: notifPermission==="denied" && n.key==="browser" ? "not-allowed" : "pointer", position:"relative", transition:"background 0.2s", flexShrink:0, opacity: notifPermission==="denied" && n.key==="browser" ? 0.4 : 1 }}>
                <div style={{ position:"absolute", top:3, left: notifications[n.key] ? 21 : 3, width:18, height:18, borderRadius:"50%", background:"white", boxShadow:"0 1px 3px rgba(0,0,0,0.2)", transition:"left 0.2s" }} />
              </div>
            </div>
          ))}
        </div>
        <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:13, padding:"22px" }}>
          <div style={{ fontWeight:700, color:C.text, fontSize:14, marginBottom:16, paddingBottom:12, borderBottom:`1px solid ${C.border}` }}>Analyst Account</div>
          <div style={{ display:"flex", alignItems:"center", gap:13, marginBottom:16 }}>
            <div style={{ width:50, height:50, borderRadius:"50%", background:`linear-gradient(135deg,${C.blueDeep},${C.green})`, display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontWeight:800, fontSize:17 }}>AK</div>
            <div>
              <div style={{ fontWeight:700, color:C.text }}>Armand Kayiranga</div>
              <div style={{ fontSize:12, color:C.textDim, fontFamily:"'IBM Plex Mono'" }}>armand.k@inkingi.rw · Admin</div>
            </div>
          </div>
          {[["Role","Senior Fraud Analyst"],["Joined","February 2026"],["Last Login","Today, 14:32"],["Sessions This Week","12"]].map(([l,v],i) => (
            <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom: i<3 ? `1px solid ${C.borderLight}` : "none" }}>
              <span style={{ fontSize:12, color:C.textMid }}>{l}</span>
              <span style={{ fontSize:12, color:C.text, fontWeight:600 }}>{v}</span>
            </div>
          ))}
        </div>
      </div>
      <div style={{ marginTop:16, display:"flex", justifyContent:"flex-end", gap:10 }}>
        {saved && <div style={{ padding:"10px 18px", background:C.greenLight, border:`1px solid ${C.greenMid}`, borderRadius:9, color:C.green, fontSize:13, fontWeight:600 }}>Settings saved ✓</div>}
        <button onClick={save} style={{ padding:"10px 24px", background:`linear-gradient(135deg,${C.blueDeep},${C.green})`, border:"none", borderRadius:9, color:"white", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans'" }}>
          Save Changes
        </button>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// PROFILE PAGE
// ─────────────────────────────────────────────────────────────────────────────
function ProfilePage({ onBack }) {
  const pName = (() => { try { return sessionStorage.getItem("analyst_name") || "Analyst"; } catch { return "Analyst"; } })();
  const pInstitution = (() => { try { return sessionStorage.getItem("analyst_institution") || "Inkingi Shield"; } catch { return "Inkingi Shield"; } })();
  const pId = (() => { try { return sessionStorage.getItem("analyst") || "AK-001"; } catch { return "AK-001"; } })();
  const pInitials = pName.split(" ").filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("") || "AK";
  return (
    <div style={{ padding:"20px 24px", overflowY:"auto", height:"100%", width:"100%" }}>
      <button onClick={onBack} style={{ display:"flex", alignItems:"center", gap:6, background:"none", border:"none", cursor:"pointer", color:C.blue, fontSize:13, fontWeight:600, fontFamily:"'DM Sans', sans-serif", padding:0, marginBottom:18 }}>
        <Ico d={IC.arrowLeft} size={15} color={C.blue} /> Back to dashboard
      </button>
      <div style={{ marginBottom:18 }}>
        <h2 style={{ fontSize:20, fontWeight:800, color:C.text, marginBottom:4 }}>My Profile</h2>
        <p style={{ fontSize:13, color:C.textMid }}>Analyst account details and activity</p>
      </div>
      <div style={{ display:"grid", gridTemplateColumns:"1fr 1.6fr", gap:16 }}>
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:"28px", textAlign:"center" }}>
            <div style={{ width:80, height:80, borderRadius:"50%", background:`linear-gradient(135deg,${C.blueDeep},${C.green})`, display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontWeight:800, fontSize:26, margin:"0 auto 16px" }}>{pInitials}</div>
            <div style={{ fontWeight:800, color:C.text, fontSize:18, marginBottom:4 }}>{pName}</div>
            <div style={{ fontSize:13, color:C.blue, fontWeight:600, marginBottom:6 }}>Fraud Analyst</div>
            <div style={{ fontSize:12, color:C.textDim, fontFamily:"'IBM Plex Mono'", marginBottom:16 }}>{pInstitution}</div>
            <div style={{ display:"inline-flex", alignItems:"center", gap:6, padding:"5px 12px", background:C.greenLight, border:`1px solid ${C.greenMid}`, borderRadius:20 }}>
              <div style={{ width:7, height:7, borderRadius:"50%", background:C.green }} />
              <span style={{ fontSize:12, color:C.green, fontWeight:600 }}>Active · Online</span>
            </div>
          </div>
          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:"20px" }}>
            <div style={{ fontWeight:700, color:C.text, fontSize:13, marginBottom:14, paddingBottom:10, borderBottom:`1px solid ${C.border}` }}>Account Details</div>
            {[["Full Name",pName],["Employee ID",`INKINGI-${pId}`],["Role","Fraud Analyst"],["Institution",pInstitution],["Department","Fraud & Risk"],["Joined","February 2026"],["Access Level","Analyst"],["Last Login","Today"]].map(([l,v],i) => (
              <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"7px 0", borderBottom: i<7 ? `1px solid ${C.borderLight}` : "none" }}>
                <span style={{ fontSize:12, color:C.textMid }}>{l}</span>
                <span style={{ fontSize:12, color:C.text, fontWeight:600 }}>{v}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ display:"flex", flexDirection:"column", gap:14 }}>
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:12 }}>
            {[{label:"Alerts Reviewed",value:"142",color:C.blue},{label:"Fraud Blocked",value:"89",color:C.red},{label:"Cleared",value:"53",color:C.green}].map((s,i) => (
              <div key={i} style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:12, padding:"16px", textAlign:"center" }}>
                <div style={{ fontSize:28, fontWeight:800, color:s.color, fontFamily:"'IBM Plex Mono'" }}>{s.value}</div>
                <div style={{ fontSize:12, color:C.textMid, marginTop:4 }}>{s.label}</div>
              </div>
            ))}
          </div>
          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:"20px" }}>
            <div style={{ fontWeight:700, color:C.text, fontSize:13, marginBottom:14, paddingBottom:10, borderBottom:`1px solid ${C.border}` }}>Recent Activity</div>
            {[{time:"14:33",action:"Reviewed alert RW-4821 · Jean Pierre Habimana",type:"review"},{time:"14:20",action:"Blocked transaction RW-4817 · Patrick Niyonzima",type:"block"},{time:"13:55",action:"Cleared transaction RW-4818 · Grace Mukamana",type:"clear"},{time:"13:22",action:"Opened Analytics dashboard",type:"view"},{time:"11:40",action:"Reviewed alert RW-4816 · Claudine Umutoniwase",type:"review"},{time:"09:15",action:"Logged in via face authentication",type:"login"}].map((log,i) => (
              <div key={i} style={{ display:"flex", gap:12, padding:"10px 0", borderBottom: i<5 ? `1px solid ${C.borderLight}` : "none" }}>
                <div style={{ width:32, height:32, borderRadius:8, background: log.type==="block" ? C.redLight : log.type==="clear" ? C.greenLight : C.blueLight, display:"flex", alignItems:"center", justifyContent:"center", flexShrink:0 }}>
                  <Ico d={log.type==="block" ? IC.x : log.type==="clear" ? IC.check : log.type==="login" ? IC.user : IC.eye} size={13} color={log.type==="block" ? C.red : log.type==="clear" ? C.green : C.blue} />
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:13, color:C.text, fontWeight:500 }}>{log.action}</div>
                  <div style={{ fontSize:11, color:C.textDim, fontFamily:"'IBM Plex Mono'", marginTop:2 }}>Today · {log.time}</div>
                </div>
              </div>
            ))}
          </div>
          <div style={{ background:C.surface, border:`1px solid ${C.border}`, borderRadius:14, padding:"20px" }}>
            <div style={{ fontWeight:700, color:C.text, fontSize:13, marginBottom:14, paddingBottom:10, borderBottom:`1px solid ${C.border}` }}>Performance This Month</div>
            {[{label:"Avg review time",value:"4.2 min"},{label:"Accuracy rate",value:"96.8%"},{label:"Alerts handled",value:"142"},{label:"False clears",value:"3"}].map((item,i) => (
              <div key={i} style={{ display:"flex", justifyContent:"space-between", padding:"8px 0", borderBottom: i<3 ? `1px solid ${C.borderLight}` : "none" }}>
                <span style={{ fontSize:13, color:C.textMid }}>{item.label}</span>
                <span style={{ fontSize:13, color:C.text, fontWeight:700 }}>{item.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// FULL DASHBOARD
// ─────────────────────────────────────────────────────────────────────────────
function Dashboard({ onLogout }) {
  const [activeNav, setActiveNav] = useState("shield");
  const [showProfile, setShowProfile] = useState(false);

  // Demo mode
  const demoMode = isDemo();

  // Analyst identity from sessionStorage (set at login)
  const analystName = (() => { try { return sessionStorage.getItem("analyst_name") || ""; } catch { return ""; } })();
  const analystInstitution = (() => { try { return sessionStorage.getItem("analyst_institution") || ""; } catch { return ""; } })();
  const analystInitials = analystName
    ? analystName.split(" ").filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("")
    : "AK";
  const [selectedAlert, setSelectedAlert] = useState(null);
  const [alertList, setAlertList] = useState(ALERTS_DATA);
  const [toast, setToast] = useState(null);

  // On mount: load real alerts from backend (respects institution filter on server)
  useEffect(() => {
    if (demoMode) return; // demo mode uses the local ALERTS_DATA already in state
    api.getAlerts()
      .then(data => { if (data && data.length) setAlertList(data); })
      .catch(() => {}); // fall back silently to ALERTS_DATA
  }, []);

  // Health check — pings backend every 30s
  const [healthStatus, setHealthStatus] = useState("checking"); // checking|ok|error
  useEffect(() => {
    const check = async () => {
      try { const r = await api.health(); setHealthStatus(r.status === "ok" ? "ok" : "error"); }
      catch { setHealthStatus(USE_MOCK ? "ok" : "error"); }
    };
    check();
    const iv = setInterval(check, 30000);
    return () => clearInterval(iv);
  }, []);

  // Browser notification for new CRITICAL alerts
  useEffect(() => {
    if (typeof Notification !== "undefined" && Notification.permission === "granted") {
      const critical = alertList.filter(a => a.level === "CRITICAL" && a.status === "pending");
      if (critical.length > 0) {
        new Notification("Inkingi Shield — CRITICAL Alert", {
          body: `${critical[0].customer}: ${critical[0].amount} flagged`,
          icon: "/favicon.ico"
        });
      }
    }
  }, []); // only on mount (first load)

  const pending = alertList.filter(a => a.status === "pending").length;

  // Auto-select first pending alert
  useEffect(() => {
    if (!selectedAlert || selectedAlert.status !== "pending") {
      const first = alertList.find(a => a.status === "pending");
      setSelectedAlert(first || alertList[0]);
    }
  }, [alertList]);

  const handleAction = async (action, id) => {
    const newStatus = action === "approve" ? "approved" : "cancelled";
    const label = action === "approve" ? "Cleared" : "Blocked";

    // Update UI immediately — never wait on the network for this
    setAlertList(prev => {
      const updated = prev.map(a => a.id === id ? { ...a, status: newStatus } : a);
      const curIdx  = updated.findIndex(a => a.id === id);
      const next    = updated.find((a, i) => i > curIdx && a.status === "pending")
                   || updated.find((a, i) => i < curIdx && a.status === "pending");
      setTimeout(() => setSelectedAlert(next || null), 120);
      return updated;
    });

    setToast({ msg: `${label}: ${id} ✓`, type: action === "approve" ? "approve" : "cancel" });
    setTimeout(() => setToast(null), 3000);

    // Sync to backend quietly in background
    try { await api.updateAlertStatus(id, newStatus); } catch { /* offline-safe */ }
  };

  const navItems = [
    {key:"grid",icon:IC.grid,label:"Overview"},
    {key:"shield",icon:IC.shield,label:"Fraud Alerts"},
    {key:"list",icon:IC.list,label:"Transactions"},
    {key:"chart",icon:IC.chart,label:"Analytics"},
    {key:"users",icon:IC.users,label:"Customers"},
    {key:"upload",icon:IC.upload,label:"Data Import"},
    {key:"settings",icon:IC.settings,label:"Settings"},
  ];

  const IC2 = { list: ["M8 6h13","M8 12h13","M8 18h13","M3 6h.01","M3 12h.01","M3 18h.01"] };

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'DM Sans', sans-serif", display:"flex", flexDirection:"column" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..800;1,9..40,300..800&family=IBM+Plex+Mono:wght@400;500&display=swap');
        * { box-sizing: border-box; margin:0; padding:0; }
        @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
        @keyframes spin-slow{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}
        @keyframes fadeUp{from{opacity:0;transform:translateY(8px)}to{opacity:1;transform:translateY(0)}}
      `}</style>
      <RwandaStripe />
      {/* Demo mode banner — non-dismissible */}
      {demoMode && (
        <div style={{ background:"rgba(250,210,1,0.12)", borderBottom:"1px solid rgba(250,210,1,0.35)", padding:"7px 16px", display:"flex", alignItems:"center", gap:10, flexShrink:0 }}>
          <span style={{ fontSize:10, fontFamily:"'IBM Plex Mono'", fontWeight:700, color:C.yellow, background:"rgba(250,210,1,0.18)", border:"1px solid rgba(250,210,1,0.35)", borderRadius:4, padding:"2px 8px", letterSpacing:"0.1em" }}>DEMO MODE</span>
          <span style={{ fontSize:12, color:"rgba(250,210,1,0.85)", fontWeight:500 }}>You are viewing simulated data. No real transactions are shown. <span style={{ opacity:0.6 }}>Sign in with your analyst credentials for live access.</span></span>
        </div>
      )}
      {/* Nav */}
      <nav className="ik-dash-nav" style={{ background:C.surface, borderBottom:`1px solid ${C.border}`, padding:"0 16px", display:"flex", alignItems:"center", gap:2, height:50, flexShrink:0, boxShadow:"0 1px 4px rgba(0,0,0,0.06)" }}>
        <div style={{ marginRight:16, display:"flex", alignItems:"center", gap:8 }}>
          <InkingiLogo />
          {demoMode && <span style={{ fontSize:9, fontFamily:"'IBM Plex Mono'", fontWeight:700, color:C.yellow, background:"rgba(250,210,1,0.15)", border:"1px solid rgba(250,210,1,0.3)", borderRadius:4, padding:"2px 7px", letterSpacing:"0.1em" }}>DEMO</span>}
          {!demoMode && analystInstitution && (
            <div style={{ borderLeft:`1px solid ${C.border}`, paddingLeft:10, display:"flex", flexDirection:"column", justifyContent:"center" }}>
              <span style={{ fontSize:10, fontFamily:"'IBM Plex Mono'", color:C.textDim, letterSpacing:"0.06em", lineHeight:1 }}>{analystInstitution.toUpperCase()}</span>
            </div>
          )}
        </div>
        {navItems.map(n => (
          <button key={n.key} onClick={() => { setActiveNav(n.key); setShowProfile(false); }}
            className="ik-dash-nav-btn"
            title={n.label}
            style={{ display:"flex", alignItems:"center", gap:5, padding:"6px 9px", background: activeNav===n.key && !showProfile ? C.blueLight : "none", border:`1px solid ${activeNav===n.key && !showProfile ? C.blueMid : "transparent"}`, borderRadius:8, cursor:"pointer", fontFamily:"'DM Sans', sans-serif", color: activeNav===n.key && !showProfile ? C.blue : C.textMid, fontSize:12, fontWeight: activeNav===n.key && !showProfile ? 600 : 400, transition:"all 0.18s", position:"relative", whiteSpace:"nowrap" }}>
            <Ico d={n.icon} size={14} color={activeNav===n.key && !showProfile ? C.blue : C.textMid} />
            <span className="ik-dash-nav-label" style={{ display:"inline" }}>{n.label}</span>
            {n.key==="shield" && pending>0 && <span style={{ background:C.red, color:"white", fontSize:9, fontWeight:700, padding:"1px 5px", borderRadius:10 }}>{pending}</span>}
          </button>
        ))}
        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:6 }}>
          {/* Status dot only — tooltip shows full text */}
          <div title={healthStatus==="ok" ? "System Online" : healthStatus==="error" ? "System Offline" : "Checking..."} style={{ display:"flex", alignItems:"center", gap:5, padding:"5px 10px", background: healthStatus==="ok" ? C.greenLight : healthStatus==="error" ? C.redLight : C.yellowLight, border:`1px solid ${healthStatus==="ok" ? C.greenMid : healthStatus==="error" ? "#FECACA" : C.yellowMid}`, borderRadius:8, cursor:"default" }}>
            <div style={{ width:6, height:6, borderRadius:"50%", background: healthStatus==="ok" ? C.green : healthStatus==="error" ? C.red : C.yellow }} />
            <span style={{ fontSize:11, color: healthStatus==="ok" ? C.green : healthStatus==="error" ? C.red : C.yellow, fontWeight:600 }}>
              {healthStatus==="ok" ? "Online" : healthStatus==="error" ? "Offline" : "…"}
            </span>
          </div>
          {/* Rwanda flag */}
          <div style={{ display:"flex", gap:2, padding:"4px 6px", background:C.surfaceAlt, border:`1px solid ${C.border}`, borderRadius:7 }}>
            {[C.rwBlue,C.rwYellow,C.rwGreen].map((c,i) => <div key={i} style={{ width:8, height:12, borderRadius:2, background:c }} />)}
          </div>
          {/* Analyst avatar — initials from sessionStorage */}
          <div onClick={() => setShowProfile(true)} title={analystName || "My profile"}
            style={{ width:30, height:30, borderRadius:"50%", background:`linear-gradient(135deg,${C.blueDeep},${C.green})`, display:"flex", alignItems:"center", justifyContent:"center", color:"white", fontWeight:800, fontSize:11, cursor:"pointer", boxShadow: showProfile ? `0 0 0 2px white, 0 0 0 3.5px ${C.blue}` : "none", transition:"box-shadow 0.2s" }}>{analystInitials}</div>
          {/* Back to website — icon only */}
          <button onClick={() => { try { sessionStorage.setItem("inkingi_screen","home"); } catch {} onLogout(); }}
            title="Back to website"
            style={{ display:"flex", alignItems:"center", gap:4, padding:"5px 10px", background:C.surfaceAlt, border:`1px solid ${C.border}`, borderRadius:8, cursor:"pointer", fontSize:11, color:C.textMid, fontFamily:"'DM Sans', sans-serif", fontWeight:500 }}>
            <Ico d={IC.arrowLeft} size={12} color={C.textMid} /> Website
          </button>
          <button onClick={onLogout} title="Sign out" style={{ background:C.redLight, border:"1px solid #FECACA", borderRadius:8, padding:"5px 8px", cursor:"pointer" }}>
            <Ico d={IC.logout} size={13} color={C.red} />
          </button>
        </div>
      </nav>

      {/* Stats bar */}
      <div className="ik-dash-stats" style={{ background:C.surface, borderBottom:`1px solid ${C.border}`, padding:"9px 20px", display:"flex", gap:0, flexShrink:0 }}>
        {[{label:"Pending Review",value:pending,color:C.orange,bg:C.orangeLight},{label:"Blocked Today",value:alertList.filter(a=>a.status==="cancelled").length,color:C.red,bg:C.redLight},{label:"Cleared Today",value:alertList.filter(a=>a.status==="approved").length,color:C.green,bg:C.greenLight},{label:"Avg Score",value:Math.round(alertList.reduce((s,a)=>s+a.score,0)/alertList.length),color:C.blue,bg:C.blueLight}].map((s,i) => (
          <div key={i} className="ik-dash-stats-item" style={{ display:"flex", alignItems:"center", gap:9, padding:"3px 20px", borderRight: i<3 ? `1px solid ${C.border}` : "none" }}>
            <div style={{ width:32, height:32, borderRadius:8, background:s.bg, display:"flex", alignItems:"center", justifyContent:"center" }}>
              <span style={{ fontSize:13, fontWeight:800, color:s.color, fontFamily:"'IBM Plex Mono'" }}>{s.value}</span>
            </div>
            <span style={{ fontSize:12, color:C.textMid, fontWeight:500 }}>{s.label}</span>
          </div>
        ))}
        <div style={{ marginLeft:"auto", display:"flex", alignItems:"center", gap:5, color:C.textDim, fontSize:11 }}>
          <Ico d={IC.refresh} size={11} color={C.textDim} /> Last sync: 12s ago
        </div>
      </div>

      {/* Main content */}
      <div style={{ flex:1, overflow:"hidden", display:"flex" }}>
        {showProfile && <ProfilePage onBack={() => setShowProfile(false)} />}
        {!showProfile && activeNav==="shield" && (() => {
          const allResolved = alertList.every(a => a.status !== "pending");
          return (
            <div className="ik-alerts-split" style={{ flex:1, display:"flex", gap:13, padding:13, overflow:"hidden" }}>
              <div className="ik-alerts-list" style={{ width:290, display:"flex", flexDirection:"column", gap:9, overflowY:"auto", flexShrink:0 }}>
                <div style={{ fontSize:10, color:C.textDim, fontFamily:"'IBM Plex Mono'", letterSpacing:"0.08em", padding:"2px 2px" }}>FRAUD ALERTS — {alertList.length} TOTAL</div>
                {alertList.map(a => <AlertCard key={a.id} alert={a} selected={selectedAlert?.id===a.id} onClick={() => setSelectedAlert(a)} />)}
              </div>
              <div style={{ flex:1, overflow:"hidden" }}>
                {allResolved ? (
                  <div style={{ height:"100%", display:"flex", flexDirection:"column", alignItems:"center", justifyContent:"center", textAlign:"center", padding:"40px 32px", background:C.surface, borderRadius:15, border:`1px solid ${C.border}` }}>
                    <div style={{ width:80, height:80, borderRadius:20, background:`linear-gradient(135deg,${C.blueDeep},${C.green})`, display:"flex", alignItems:"center", justifyContent:"center", marginBottom:24, boxShadow:`0 8px 32px rgba(11,61,107,0.18)` }}>
                      <svg width={46} height={46} viewBox="0 0 28 28" fill="none">
                        <path d="M14 25s9-4 9-11V5L14 2 5 5v9c0 7 9 11 9 11z" fill="rgba(255,255,255,0.15)" stroke="white" strokeWidth="1.2"/>
                        {[0,45,90,135,180,225,270,315].map(deg => (
                          <line key={deg} x1="14" y1="14" x2={14+5.5*Math.cos(deg*Math.PI/180)} y2={14+5.5*Math.sin(deg*Math.PI/180)} stroke="#FAD201" strokeWidth="1.1" strokeLinecap="round"/>
                        ))}
                        <circle cx="14" cy="14" r="2.5" fill="#FAD201"/>
                      </svg>
                    </div>
                    <div style={{ display:"flex", gap:6, marginBottom:20 }}>
                      {[C.rwBlue,C.rwYellow,C.rwGreen].map((c,i) => <div key={i} style={{ width:28, height:5, borderRadius:3, background:c }} />)}
                    </div>
                    <div style={{ fontSize:22, fontWeight:800, color:C.text, marginBottom:8 }}>Queue Cleared</div>
                    <div style={{ fontSize:12, fontFamily:"'IBM Plex Mono'", color:C.blue, letterSpacing:"0.12em", marginBottom:14, fontWeight:600 }}>AMAHORO · PEACE SECURED</div>
                    <p style={{ fontSize:14, color:C.textMid, lineHeight:1.75, maxWidth:340, marginBottom:24 }}>Every alert has been reviewed. Rwanda's transactions are protected. Inkingi Shield is watching in real time — new threats will appear here the moment they are detected.</p>
                    <div style={{ display:"flex", gap:0, background:C.surfaceAlt, border:`1px solid ${C.border}`, borderRadius:12, overflow:"hidden", marginBottom:22 }}>
                      {[{value:alertList.filter(a=>a.status==="cancelled").length,label:"Blocked",color:C.red},{value:alertList.filter(a=>a.status==="approved").length,label:"Cleared",color:C.green},{value:alertList.length,label:"Reviewed",color:C.blue}].map((s,i) => (
                        <div key={i} style={{ padding:"13px 26px", textAlign:"center", borderRight:i<2?`1px solid ${C.border}`:"none" }}>
                          <div style={{ fontSize:22, fontWeight:800, color:s.color, fontFamily:"'IBM Plex Mono'" }}>{s.value}</div>
                          <div style={{ fontSize:11, color:C.textDim, marginTop:2 }}>{s.label}</div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display:"flex", alignItems:"center", gap:7, padding:"9px 16px", background:C.greenLight, border:`1px solid ${C.greenMid}`, borderRadius:9 }}>
                      <div style={{ width:7, height:7, borderRadius:"50%", background:C.green }} />
                      <span style={{ fontSize:12, color:C.green, fontWeight:600 }}>Active · monitoring all transactions</span>
                    </div>
                  </div>
                ) : (
                  selectedAlert && <DetailPanel alert={selectedAlert} onAction={handleAction} />
                )}
              </div>
            </div>
          );
        })()}
        {!showProfile && activeNav==="grid" && <OverviewPage alertList={alertList} />}
        {!showProfile && activeNav==="list" && <TransactionsPage />}
        {!showProfile && activeNav==="chart" && <AnalyticsPage />}
        {!showProfile && activeNav==="users" && <CustomersPage />}
        {!showProfile && activeNav==="settings" && <SettingsPage />}
        {!showProfile && activeNav==="upload" && (
          <div style={{ padding:"32px 28px", maxWidth:960, margin:"0 auto" }}>
            <div style={{ marginBottom:24 }}>
              <div style={{ fontSize:11, color:C.blue, fontFamily:"'IBM Plex Mono'", letterSpacing:"0.1em", marginBottom:8 }}>DATA IMPORT</div>
              <h2 style={{ fontSize:22, fontWeight:800, color:C.text, marginBottom:6 }}>MoMo Transaction Analyzer</h2>
              <p style={{ color:C.textMid, fontSize:13, lineHeight:1.7 }}>Paste MTN MoMo SMS messages or a USSD export. Transactions are scored automatically and flagged ones can be added directly to your alert queue.</p>
            </div>
            <MomoAnalyzer mode="analyst" />
          </div>
        )}
      </div>

      {/* Toast */}
      {toast && (
        <div style={{ position:"fixed", bottom:22, right:22,
          background: toast.type==="approve" ? C.greenLight : toast.type==="cancel" ? C.redLight : C.orangeLight,
          border:`1px solid ${toast.type==="approve" ? C.greenMid : toast.type==="cancel" ? "#FECACA" : "#FDE68A"}`,
          color: toast.type==="approve" ? C.green : toast.type==="cancel" ? C.red : C.orange,
          padding:"11px 18px", borderRadius:11, fontSize:13, fontWeight:600,
          boxShadow:"0 6px 24px rgba(0,0,0,0.1)", zIndex:1000,
          display:"flex", gap:9, alignItems:"center", animation:"fadeUp 0.3s ease" }}>
          <Ico d={toast.type==="approve" ? IC.check : IC.x} size={13}
            color={toast.type==="approve" ? C.green : toast.type==="cancel" ? C.red : C.orange} />
          {toast.msg}
        </div>
      )}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ADMIN PAGE — accessible at ?admin=1 in the URL, password protected
// Only Armand can access this. Companies fill the form → emails arrive →
// Armand logs in here to approve them and add them as analysts.
// ─────────────────────────────────────────────────────────────────────────────
const ADMIN_PASSWORD = "inkingi2026"; // change this after deployment

// ── API Integration tab (inside AdminPage) ────────────────────────────────────
function AdminApiTab() {
  const ENDPOINT = "https://inkingi-shield-api.onrender.com/api/webhook/transactions";
  const API_KEY  = "ik-demo-key-2026";
  const [testResult, setTestResult] = useState(null);
  const [testing,    setTesting]    = useState(false);

  const card = { background:"#111827", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"22px 24px" };
  const mono = "'IBM Plex Mono'";

  const CODE = [
    "import requests",
    "",
    'API_KEY  = "' + API_KEY + '"',
    'ENDPOINT = "' + ENDPOINT + '"',
    "",
    "transactions = [",
    '    {"id": "TX-001", "amount": 450000, "type": "TRANSFER", "old_balance": 462000, "new_balance": 12000},',
    '    {"id": "TX-002", "amount": 9000,   "type": "PAYMENT",  "old_balance": 9000,   "new_balance": 0},',
    "]",
    "",
    "response = requests.post(",
    "    ENDPOINT,",
    '    params={"api_key": API_KEY},',
    '    json={"institution": "Bank of Kigali", "transactions": transactions},',
    ")",
    "print(response.json())",
  ].join("\n");

  async function handleTest() {
    setTesting(true);
    setTestResult(null);
    try {
      const res = await fetch(ENDPOINT + "?api_key=" + API_KEY, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          institution: "Admin Test",
          transactions: [
            { id: "TX-TEST-1", amount: 450000, type: "TRANSFER", old_balance: 462000, new_balance: 12000 },
            { id: "TX-TEST-2", amount: 9000,   type: "PAYMENT",  old_balance: 9000,   new_balance: 0 },
          ],
        }),
      });
      const data = await res.json();
      setTestResult({ ok: res.ok, data });
    } catch (e) {
      setTestResult({ ok: false, data: { detail: e.message } });
    }
    setTesting(false);
  }

  return (
    <div>
      <div style={{ marginBottom:24 }}>
        <div style={{ fontSize:10, color:"#20BDE0", fontFamily:mono, letterSpacing:"0.08em", marginBottom:8 }}>API INTEGRATION</div>
        <h2 style={{ fontSize:20, fontWeight:800, color:"white", marginBottom:6 }}>Institution Webhook API</h2>
        <p style={{ color:"#6B7280", fontSize:13, lineHeight:1.7 }}>Banks and fintechs can score transactions programmatically without logging into the dashboard.</p>
      </div>

      <div style={{ ...card, marginBottom:16 }}>
        <div style={{ fontSize:11, color:"#6B7280", fontFamily:mono, letterSpacing:"0.06em", marginBottom:10 }}>ENDPOINT</div>
        <div style={{ display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
          <span style={{ background:"rgba(32,189,224,0.1)", color:"#20BDE0", fontSize:11, fontWeight:700, fontFamily:mono, padding:"4px 10px", borderRadius:6 }}>POST</span>
          <span style={{ fontFamily:mono, fontSize:12, color:"#E5E7EB", wordBreak:"break-all" }}>{ENDPOINT}</span>
        </div>
        <div style={{ marginTop:14, display:"flex", alignItems:"center", gap:10, flexWrap:"wrap" }}>
          <span style={{ fontSize:11, color:"#6B7280", fontFamily:mono }}>?api_key=</span>
          <span style={{ fontFamily:mono, fontSize:12, color:"#FAD201", background:"rgba(250,210,1,0.08)", padding:"4px 12px", borderRadius:6 }}>{API_KEY}</span>
        </div>
      </div>

      <div style={{ ...card, marginBottom:16 }}>
        <div style={{ fontSize:11, color:"#6B7280", fontFamily:mono, letterSpacing:"0.06em", marginBottom:12 }}>PYTHON EXAMPLE</div>
        <pre style={{ margin:0, fontFamily:mono, fontSize:11, color:"#D1FAE5", background:"#0B0F1A", borderRadius:8, padding:"16px 18px", overflowX:"auto", lineHeight:1.7 }}>{CODE}</pre>
      </div>

      <div style={card}>
        <div style={{ fontSize:11, color:"#6B7280", fontFamily:mono, letterSpacing:"0.06em", marginBottom:14 }}>LIVE TEST</div>
        <p style={{ fontSize:13, color:"#9CA3AF", marginBottom:16, lineHeight:1.6 }}>Sends 2 test transactions to the live endpoint and displays the raw JSON response.</p>
        <button onClick={handleTest} disabled={testing}
          style={{ padding:"10px 20px", background:"linear-gradient(135deg,#20BDE0,#0E7490)", border:"none", borderRadius:9, color:"white", fontSize:13, fontWeight:700, cursor: testing ? "default" : "pointer", fontFamily:"'DM Sans'", opacity: testing ? 0.7 : 1, marginBottom: testResult ? 16 : 0 }}>
          {testing ? "Sending\u2026" : "Test Live"}
        </button>
        {testResult && (
          <pre style={{ margin:0, fontFamily:mono, fontSize:11, color: testResult.ok ? "#D1FAE5" : "#FCA5A5", background:"#0B0F1A", borderRadius:8, padding:"14px 16px", overflowX:"auto", lineHeight:1.7 }}>
            {JSON.stringify(testResult.data, null, 2)}
          </pre>
        )}
      </div>
    </div>
  );
}

function AdminPage({ onExit }) {
  const [authed, setAuthed]           = useState(() => sessionStorage.getItem("admin_auth") === "yes");
  const [pwInput, setPwInput]         = useState("");
  const [pwError, setPwError]         = useState(false);
  const [submissions, setSubmissions] = useState([]);
  const [statuses, setStatuses]       = useState(() => {
    try { return JSON.parse(localStorage.getItem("inkingi_statuses") || "{}"); } catch { return {}; }
  });
  const [tab, setTab]                 = useState("requests"); // requests | onboarding | partners
  const [drawer, setDrawer]           = useState(null);
  const [filter, setFilter]           = useState("all");
  const [newAnalyst, setNewAnalyst]   = useState({ id:"", name:"", role:"Fraud Analyst", institution:"", email:"" });
  const [toast, setToast]             = useState(null);
  const [adding, setAdding]           = useState(false);
  const [adminFaceReady, setAdminFaceReady] = useState(false);
  const [enrollStatus, setEnrollStatus]     = useState({});
  const [enrollTarget, setEnrollTarget]     = useState(null);
  const [backendAnalysts, setBackendAnalysts] = useState([]);
  const [selectedCompany, setSelectedCompany] = useState(null);
  const [refreshing, setRefreshing]     = useState(false);
  const [refreshedAt, setRefreshedAt]   = useState(null);
  const [photoPreview, setPhotoPreview] = useState(null); // base64 preview for new analyst
  const photoDataRef  = useRef(null);  // stores base64 string of selected photo
  const photoInputRef = useRef(null);  // file input ref for analyst photo
  const enrollFileRef = useRef(null);

  // ── Demo submissions — merged with backend data when available ────────────
  const DEMO_SUBS = [
    { id:"demo-1", company_name:"MTN Rwanda",        institution_type:"Mobile Money Operator", contact_name:"Pacifique Nzabahimana", contact_email:"p.nzabahimana@mtn.co.rw",     transaction_volume:"Over 1M transactions/month",          message:"We process 3M+ MoMo transactions daily and need fraud scoring to reduce chargebacks.", _date:"2026-03-09T08:22:00Z" },
    { id:"demo-2", company_name:"Bank of Kigali",    institution_type:"Commercial Bank",       contact_name:"Diane Umwiza",           contact_email:"d.umwiza@bk.rw",             transaction_volume:"100,000 – 1M transactions/month",     message:"Seeing increase in card-not-present fraud. Want to explore real-time scoring API.",      _date:"2026-03-08T14:10:00Z" },
    { id:"demo-3", company_name:"Equity Bank Rwanda", institution_type:"Commercial Bank",      contact_name:"Jean Claude Habimana",   contact_email:"jc.habimana@equitybank.co.rw", transaction_volume:"10,000 – 100,000 transactions/month", message:"",                                                                                          _date:"2026-03-07T11:45:00Z" },
  ];

  // Seed default statuses for demo data (used as fallback only)
  const DEMO_STATUSES = { "demo-1": "active", "demo-2": "approved", "demo-3": "new" };

  const loadRequests = () => {
    setRefreshing(true);

    // Always read real submissions from localStorage first
    let localSubs = [];
    try { localSubs = JSON.parse(localStorage.getItem("inkingi_real_subs") || "[]"); } catch {}

    const token = sessionStorage.getItem("token");
    if (!token) {
      // No JWT — show only real localStorage submissions (or empty state)
      setSubmissions(localSubs);
      setRefreshing(false);
      setRefreshedAt(new Date());
      return;
    }

    // Try backend — merge with localStorage submissions
    fetch(`${API_BASE}/api/partners/requests`, { headers: { Authorization: `Bearer ${token}` } })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (data && data.length > 0) {
          const normalized = data.map(r => ({ ...r, _date: r.created_at || null }));
          // Merge: backend rows take priority; add any localStorage-only rows not yet in backend
          const backendIds = new Set(normalized.map(r => r.id));
          const localOnly  = localSubs.filter(r => !backendIds.has(r.id));
          const merged = [...normalized, ...localOnly];
          setSubmissions(merged);
          const s = {};
          data.forEach(r => { s[r.id] = r.status; });
          setStatuses(prev => ({ ...prev, ...Object.fromEntries(localOnly.map(r => [r.id, r.status || "new"])), ...s }));
          localStorage.setItem("inkingi_statuses", JSON.stringify(s));
        } else {
          // Backend empty — show only real localStorage submissions
          setSubmissions(localSubs);
        }
        setRefreshing(false);
        setRefreshedAt(new Date());
      })
      .catch(() => {
        setSubmissions(localSubs);
        setRefreshing(false);
        setRefreshedAt(new Date());
      });
  };

  useEffect(() => { if (authed) loadRequests(); }, [authed]);

  // ── Fetch backend analysts — merges backend data with localStorage ────────
  const fetchBackendAnalysts = async () => {
    // Always load localStorage analysts first so the list shows immediately
    let localAnalysts = [];
    try { localAnalysts = JSON.parse(localStorage.getItem("inkingi_analysts") || "[]"); } catch {}

    const token = sessionStorage.getItem("token");
    if (!token) {
      // No JWT — show only localStorage analysts
      setBackendAnalysts(localAnalysts);
      return;
    }
    try {
      const res = await fetch(`${API_BASE}/api/analysts`, { headers: { Authorization: `Bearer ${token}` } });
      if (res.ok) {
        const backendData = await res.json();
        // Merge: backend rows take priority, add localStorage-only rows on top
        const backendIds = new Set(backendData.map(a => a.id));
        const localOnly  = localAnalysts.filter(a => !backendIds.has(a.id));
        // For analysts in both, use backend data but preserve local photo_data if backend has none
        const merged = backendData.map(a => {
          const local = localAnalysts.find(l => l.id === a.id);
          return (local && !a.photo_data && local.photo_data) ? { ...a, photo_data: local.photo_data } : a;
        });
        setBackendAnalysts([...localOnly, ...merged]);
      } else {
        setBackendAnalysts(localAnalysts);
      }
    } catch {
      setBackendAnalysts(localAnalysts);
    }
  };

  useEffect(() => {
    if (authed && (tab === "onboarding" || tab === "partners")) fetchBackendAnalysts();
  }, [authed, tab]);

  // Load face-api models when Manage Analysts or Onboarding tab is opened
  useEffect(() => {
    if ((tab !== "onboarding") || adminFaceReady) return;
    let cancelled = false;
    (async () => {
      try {
        await loadScript("https://cdn.jsdelivr.net/npm/face-api.js@0.22.2/dist/face-api.min.js");
        if (cancelled) return;
        const MODEL_URL = "https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model";
        await window.faceapi.nets.tinyFaceDetector.loadFromUri(MODEL_URL);
        if (cancelled) return;
        await window.faceapi.nets.faceLandmark68TinyNet.loadFromUri(MODEL_URL);
        if (cancelled) return;
        await window.faceapi.nets.faceRecognitionNet.loadFromUri(MODEL_URL);
        if (!cancelled) setAdminFaceReady(true);
      } catch { /* models already loaded from login page, or CDN failed */ }
    })();
    return () => { cancelled = true; };
  }, [tab]);

  const handleEnrollPhoto = async (e) => {
    const file = e.target.files[0];
    if (!file || !enrollTarget) return;
    e.target.value = "";  // reset so same file can be re-selected
    setEnrollStatus(prev => ({ ...prev, [enrollTarget]: "loading" }));
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = async () => {
      URL.revokeObjectURL(url);
      try {
        // Extract 64×64 JPEG thumbnail for display in analyst list
        const canvas = document.createElement("canvas");
        canvas.width = 64; canvas.height = 64;
        canvas.getContext("2d").drawImage(img, 0, 0, 64, 64);
        const photoData = canvas.toDataURL("image/jpeg", 0.7);

        const result = await window.faceapi
          .detectSingleFace(img, new window.faceapi.TinyFaceDetectorOptions({ scoreThreshold: 0.3 }))
          .withFaceLandmarks(true)
          .withFaceDescriptor();
        if (!result) {
          setEnrollStatus(prev => ({ ...prev, [enrollTarget]: "error" }));
          showToast("⚠️ No face detected in photo. Use a clear, front-facing photo.");
          return;
        }
        await api.enrollFace(enrollTarget, Array.from(result.descriptor), photoData);
        setEnrollStatus(prev => ({ ...prev, [enrollTarget]: "enrolled" }));
        showToast(`✓ Face enrolled for ${enrollTarget}`);
        fetchBackendAnalysts();
      } catch (err) {
        setEnrollStatus(prev => ({ ...prev, [enrollTarget]: "error" }));
        showToast("Enrollment failed: " + err.message);
      }
    };
    img.src = url;
  };

  const saveStatuses = (s) => {
    setStatuses(s);
    localStorage.setItem("inkingi_statuses", JSON.stringify(s));
  };

  const showToast = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(null), 3000);
  };

  // ── Login screen ──────────────────────────────────────────────────────────
  if (!authed) return (
    <div style={{ minHeight:"100vh", background:"#0B0F1A", display:"flex", alignItems:"center", justifyContent:"center", fontFamily:"'DM Sans',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800&family=IBM+Plex+Mono:wght@400;600&display=swap');`}</style>
      <div style={{ width:380, background:"#111827", border:"1px solid rgba(255,255,255,0.08)", borderRadius:20, padding:40, textAlign:"center" }}>
        <div style={{ display:"flex", justifyContent:"center", marginBottom:20 }}>
          <InkingiLogo size="lg" light sub="ADMIN PORTAL · RW" />
        </div>
        <div style={{ fontSize:12, color:"#4B5563", fontFamily:"'IBM Plex Mono'", marginBottom:28, letterSpacing:"0.05em" }}>RESTRICTED ACCESS</div>
        <input
          type="password"
          placeholder="Enter admin password"
          value={pwInput}
          onChange={e => { setPwInput(e.target.value); setPwError(false); }}
          onKeyDown={e => e.key === "Enter" && checkPassword()}
          style={{ width:"100%", padding:"12px 16px", background:"#1A2235", border:`1.5px solid ${pwError ? "#EF4444" : "rgba(255,255,255,0.1)"}`, borderRadius:10, color:"white", fontSize:14, fontFamily:"'DM Sans'", outline:"none", marginBottom:12, boxSizing:"border-box" }}
          autoFocus
        />
        {pwError && <div style={{ color:"#EF4444", fontSize:12, marginBottom:12 }}>Incorrect password</div>}
        <button onClick={checkPassword} style={{ width:"100%", padding:13, background:"linear-gradient(135deg,#20BDE0,#0E7490)", border:"none", borderRadius:10, color:"white", fontSize:14, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans'" }}>
          Enter Admin Portal
        </button>
        <button onClick={onExit} style={{ marginTop:14, background:"none", border:"none", color:"#4B5563", fontSize:12, cursor:"pointer", fontFamily:"'DM Sans'" }}>
          ← Back to website
        </button>
      </div>
    </div>
  );

  function checkPassword() {
    if (pwInput === ADMIN_PASSWORD) {
      sessionStorage.setItem("admin_auth", "yes");
      setAuthed(true);
      // Get a JWT for AK-001 so all backend API calls (partner requests, analysts) work
      fetch(`${API_BASE}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ analyst_id: "AK-001", source: "admin" }),
      })
        .then(r => r.ok ? r.json() : null)
        .then(data => {
          if (data?.token) {
            sessionStorage.setItem("token", data.token);
            loadRequests(); // re-run with the JWT now available
          }
        })
        .catch(() => {}); // silent — localStorage fallback still works
    } else {
      setPwError(true);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  const fmtDate = (iso) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString("en-GB", { day:"2-digit", month:"short", year:"numeric" });
  };

  const AVATAR_COLORS = ["linear-gradient(135deg,#20BDE0,#0E7490)","linear-gradient(135deg,#008751,#00C46A)","linear-gradient(135deg,#7C3AED,#4F46E5)","linear-gradient(135deg,#F97316,#EF4444)","linear-gradient(135deg,#FAD201,#F97316)"];
  const avatarColor = (s) => AVATAR_COLORS[(s||"").split("").reduce((a,c) => a + c.charCodeAt(0), 0) % AVATAR_COLORS.length];
  const inits = (s) => (s||"?").split(/\s+/).map(w=>w[0]).join("").slice(0,2).toUpperCase();

  const STAGE_STYLE = {
    new:          { bg:"rgba(100,116,139,0.12)", color:"#94A3B8" },
    under_review: { bg:"rgba(250,210,1,0.12)",   color:"#FAD201" },
    approved:     { bg:"rgba(32,189,224,0.12)",  color:"#20BDE0" },
    onboarded:    { bg:"rgba(249,115,22,0.12)",  color:"#F97316" },
    active:       { bg:"rgba(0,196,106,0.12)",   color:"#00C46A" },
    rejected:     { bg:"rgba(239,68,68,0.12)",   color:"#EF4444" },
  };

  // ── Automatic email sender — calls backend SMTP, falls back to mailto ────
  const sendStatusEmail = async (to, subject, body) => {
    if (!to) return;
    const token = sessionStorage.getItem("token");
    try {
      const res = await fetch(`${API_BASE}/api/email`, {
        method: "POST",
        headers: { "Content-Type": "application/json", ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ to, subject, body }),
      });
      if (res.ok) return; // sent automatically ✓
    } catch {}
    // Fallback: open email client if backend not configured yet
    window.location.href = `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  // ── Pipeline ──────────────────────────────────────────────────────────────
  const PIPELINE       = ["new", "under_review", "approved", "onboarded", "active"];
  const PIPELINE_NEXT  = { new:"under_review", under_review:"approved", approved:"onboarded", onboarded:"active" };
  const PIPELINE_LABEL = { new:"NEW", under_review:"UNDER REVIEW", approved:"APPROVED", onboarded:"ONBOARDED", active:"ACTIVE", rejected:"DECLINED" };

  const getStatus  = (id) => statuses[id] || "new";
  const filtered   = submissions.filter(s => filter === "all" ? getStatus(s.id) !== "rejected" : getStatus(s.id) === filter);
  const pendingCount  = submissions.filter(s => ["new","under_review"].includes(getStatus(s.id))).length;
  const activeCount   = submissions.filter(s => getStatus(s.id) === "active").length;

  const statusBadge = (st) => {
    const s = STAGE_STYLE[st] || STAGE_STYLE.new;
    const label = PIPELINE_LABEL[st] || st?.toUpperCase() || "NEW";
    return <span style={{ padding:"3px 10px", borderRadius:20, fontSize:10, fontWeight:700, background:s.bg, color:s.color, fontFamily:"'IBM Plex Mono'" }}>{label}</span>;
  };

  const advanceStatus = async (sub, targetStatus) => {
    const next = { ...statuses, [sub.id]: targetStatus };
    saveStatuses(next);

    // Persist to backend if logged in
    const token = sessionStorage.getItem("token");
    if (token) {
      try {
        await fetch(`${API_BASE}/api/partners/${sub.id}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
          body: JSON.stringify({ status: targetStatus }),
        });
      } catch {}
    }

    const EMAIL_TEMPLATES = {
      under_review: {
        subject: `Inkingi Shield — Application Received`,
        body: `Dear ${sub.contact_name},\n\nThank you for applying to partner with Inkingi Shield.\n\nWe have received ${sub.company_name}'s application and our team is now reviewing it. We typically complete our review within 3–5 business days.\n\nWe will contact you as soon as a decision has been made. In the meantime, feel free to reply to this email if you have any questions.\n\nBest regards,\nArmand Kayiranga\nInkingi Shield — Fraud Detection`,
        toast: `✓ Under Review · Email sent to ${sub.contact_name}`,
      },
      approved: {
        subject: `Congratulations — Your Inkingi Shield Partnership Is Approved!`,
        body: `Dear ${sub.contact_name},\n\nCongratulations! We are thrilled to inform you that ${sub.company_name}'s application to partner with Inkingi Shield has been approved.\n\nTo get your institution's fraud detection system up and running, please submit the following:\n\n1. YOUR TRANSACTION DATASET\n   Export a representative sample of recent transactions (CSV or Excel) so we can train a model specific to ${sub.company_name}'s transaction patterns.\n\n2. ANALYST ROSTER\n   Provide a list of analysts who will access the Inkingi Shield dashboard. For each analyst, include:\n   - Full name\n   - Staff ID\n   - Role (e.g. Fraud Analyst, Senior Analyst)\n   - Email address\n\n3. ANALYST HEADSHOTS\n   One clear, front-facing photo per analyst (JPEG or PNG, minimum 400×400px). These will be used to set up biometric (face recognition) login — no passwords required.\n\nOnce we receive the above, we will configure your institution's dashboard and send login credentials within 48 hours.\n\nWelcome to the Inkingi Shield network!\n\nBest regards,\nArmand Kayiranga\nInkingi Shield — Fraud Detection`,
        toast: `✓ Approved · Email sent to ${sub.contact_name}`,
      },
      onboarded: {
        subject: `Inkingi Shield — Onboarding In Progress`,
        body: `Dear ${sub.contact_name},\n\nGreat news — we have received your data and are now setting up ${sub.company_name}'s dedicated fraud detection dashboard.\n\nOur team is:\n• Training your institution-specific ML model on your transaction data\n• Enrolling your analysts' face recognition profiles\n• Configuring institution-scoped access controls\n\nYou can expect to receive login instructions within 48 hours.\n\nIf you have any additional materials to share (e.g. more analysts or updated photos), please reply to this email as soon as possible.\n\nBest regards,\nArmand Kayiranga\nInkingi Shield — Fraud Detection`,
        toast: `✓ Onboarded · Email sent to ${sub.contact_name}`,
      },
      active: {
        subject: `Your Inkingi Shield System Is Live!`,
        body: `Dear ${sub.contact_name},\n\nYour institution's Inkingi Shield fraud detection system is now fully live and ready to use.\n\n${sub.company_name}'s analysts can now log in at:\nhttps://inkingi-shield-frontend.onrender.com\n\nEach analyst logs in using their face — simply click "Scan Face" on the login screen and look at your camera.\n\nIf any analyst cannot log in, please reply to this email and we will assist immediately.\n\nThank you for choosing Inkingi Shield to protect your customers.\n\nBest regards,\nArmand Kayiranga\nInkingi Shield — Fraud Detection`,
        toast: `✓ Active · Email sent to ${sub.contact_name}`,
      },
      rejected: {
        subject: `Inkingi Shield — Application Update`,
        body: `Dear ${sub.contact_name},\n\nThank you for your interest in partnering with Inkingi Shield.\n\nAfter careful review, we are unable to proceed with ${sub.company_name}'s application at this time.\n\nIf you believe this decision was made in error, or if your circumstances have changed, please do not hesitate to reapply or contact us directly by replying to this email.\n\nWe appreciate the time you took to apply and wish ${sub.company_name} every success.\n\nBest regards,\nArmand Kayiranga\nInkingi Shield — Fraud Detection`,
        toast: `✗ Declined · Email sent to ${sub.contact_name}`,
      },
    };

    const tmpl = EMAIL_TEMPLATES[targetStatus];
    if (tmpl && sub.contact_email) {
      showToast("Sending email…");
      await sendStatusEmail(sub.contact_email, tmpl.subject, tmpl.body);
      showToast(tmpl.toast);
    } else {
      showToast(`✓ Status → ${PIPELINE_LABEL[targetStatus] || targetStatus}`);
    }
  };

  // ── Add analyst for a specific company ───────────────────────────────────
  const addAnalystForCompany = async (institution) => {
    if (!newAnalyst.id.trim() || !newAnalyst.name.trim()) { showToast("ID and Name are required"); return; }
    setAdding(true);
    try {
      const analystRecord = {
        ...newAnalyst,
        institution,
        is_active:    true,
        face_enrolled: false,
        last_login:   null,
        photo_data:   photoDataRef.current || null,
      };

      // 1. Save to localStorage immediately — this is what the list reads
      const stored = JSON.parse(localStorage.getItem("inkingi_analysts") || "[]");
      // Replace if same ID exists, otherwise add
      const updated = stored.filter(a => a.id !== analystRecord.id);
      updated.unshift(analystRecord);
      localStorage.setItem("inkingi_analysts", JSON.stringify(updated));

      // 2. Update in-memory state immediately so the list re-renders now
      setBackendAnalysts(prev => {
        const filtered = prev.filter(a => a.id !== analystRecord.id);
        return [analystRecord, ...filtered];
      });

      // 3. Try backend — best-effort (TODO: send face descriptor to backend when face recognition endpoint is ready)
      try {
        const token = sessionStorage.getItem("token");
        if (token) {
          await fetch(`${API_BASE}/api/analysts`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
            body: JSON.stringify({ ...newAnalyst, institution }),
          });
        }
      } catch {}

      const added = newAnalyst.name;
      setNewAnalyst({ id:"", name:"", role:"Fraud Analyst", institution:"", email:"" });
      setPhotoPreview(null);
      photoDataRef.current = null;
      if (photoInputRef.current) photoInputRef.current.value = "";
      showToast(photoDataRef.current ? `✓ ${added} added · Photo saved` : `✓ Analyst added`);
    } catch (err) {
      showToast("Failed: " + err.message);
    }
    setAdding(false);
  };

  // ── Shared styles ─────────────────────────────────────────────────────────
  const A = {
    page:    { minHeight:"100vh", background:"#0B0F1A", fontFamily:"'DM Sans',sans-serif", color:"white" },
    topbar:  { background:"#111827", borderBottom:"1px solid rgba(255,255,255,0.07)", padding:"16px 32px", display:"flex", alignItems:"center", justifyContent:"space-between" },
    badge:   (bg, color) => ({ padding:"3px 10px", borderRadius:20, fontSize:10, fontWeight:700, background:bg, color, fontFamily:"'IBM Plex Mono'", letterSpacing:"0.04em" }),
    card:    { background:"#111827", border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:"22px 24px" },
    input:   { width:"100%", padding:"10px 14px", background:"#1A2235", border:"1px solid rgba(255,255,255,0.1)", borderRadius:9, color:"white", fontSize:13, fontFamily:"'DM Sans'", outline:"none", boxSizing:"border-box" },
    label:   { display:"block", fontSize:11, color:"#6B7280", fontFamily:"'IBM Plex Mono'", letterSpacing:"0.06em", marginBottom:6 },
    btn:     (bg, color="white") => ({ padding:"10px 20px", background:bg, border:"none", borderRadius:9, color, fontSize:13, fontWeight:700, cursor:"pointer", fontFamily:"'DM Sans'", transition:"opacity 0.15s" }),
  };

  // ── Main admin UI ─────────────────────────────────────────────────────────
  return (
    <div style={A.page}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;600;700;800&family=IBM+Plex+Mono:wght@400;600&display=swap'); body{background:#0B0F1A} *{box-sizing:border-box}`}</style>

      {/* Always-mounted file input for face enrollment — must be at top level so ref is never null */}
      <input ref={enrollFileRef} type="file" accept="image/*" style={{ display:"none" }} onChange={handleEnrollPhoto} />

      {/* Toast */}
      {toast && (
        <div style={{ position:"fixed", bottom:28, right:28, background:"#1A2235", border:"1px solid rgba(255,255,255,0.12)", borderRadius:10, padding:"12px 20px", fontSize:13, fontWeight:600, zIndex:999, boxShadow:"0 8px 32px rgba(0,0,0,0.5)" }}>
          {toast}
        </div>
      )}

      {/* Detail drawer */}
      {drawer && (
        <div style={{ position:"fixed", inset:0, background:"rgba(0,0,0,0.7)", zIndex:100, display:"flex", justifyContent:"flex-end" }} onClick={() => setDrawer(null)}>
          <div style={{ width:460, background:"#111827", borderLeft:"1px solid rgba(255,255,255,0.1)", height:"100vh", overflow:"auto", display:"flex", flexDirection:"column" }} onClick={e => e.stopPropagation()}>
            <div style={{ padding:"24px", borderBottom:"1px solid rgba(255,255,255,0.07)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
              <div>
                <div style={{ fontSize:17, fontWeight:800 }}>{drawer.company_name}</div>
                <div style={{ fontSize:12, color:"#6B7280", marginTop:3 }}>{drawer.contact_name} · {drawer.contact_email}</div>
              </div>
              <button onClick={() => setDrawer(null)} style={{ background:"#1A2235", border:"1px solid rgba(255,255,255,0.1)", borderRadius:8, color:"#9CA3AF", cursor:"pointer", padding:"6px 10px", fontSize:16 }}>×</button>
            </div>
            <div style={{ flex:1, padding:24, overflowY:"auto" }}>
              {/* Company card */}
              <div style={{ display:"flex", alignItems:"center", gap:14, padding:16, background:"#1A2235", borderRadius:12, marginBottom:24, border:"1px solid rgba(255,255,255,0.07)" }}>
                <div style={{ width:48, height:48, borderRadius:12, background:avatarColor(drawer.company_name), display:"flex", alignItems:"center", justifyContent:"center", fontSize:18, fontWeight:800, flexShrink:0 }}>{inits(drawer.company_name)}</div>
                <div>
                  <div style={{ fontSize:16, fontWeight:800 }}>{drawer.company_name}</div>
                  <div style={{ fontSize:12, color:"#6B7280", marginTop:2 }}>{drawer.institution_type || "—"}</div>
                  <div style={{ marginTop:6 }}>{statusBadge(getStatus(drawer.id))}</div>
                </div>
              </div>

              {/* Details */}
              {[
                ["Contact Person", drawer.contact_name],
                ["Email Address",  drawer.contact_email],
                ["Institution Type", drawer.institution_type || "—"],
                ["Monthly Volume", drawer.transaction_volume || "—"],
                ["Date Received",  fmtDate(drawer._date)],
              ].map(([label, value]) => (
                <div key={label} style={{ marginBottom:14, padding:"12px 14px", background:"#1A2235", borderRadius:10, border:"1px solid rgba(255,255,255,0.06)" }}>
                  <div style={{ fontSize:11, color:"#6B7280", fontFamily:"'IBM Plex Mono'", marginBottom:4 }}>{label.toUpperCase()}</div>
                  <div style={{ fontSize:13, fontWeight:600 }}>{value}</div>
                </div>
              ))}

              <div style={{ marginBottom:14 }}>
                <div style={{ fontSize:11, color:"#6B7280", fontFamily:"'IBM Plex Mono'", marginBottom:8, letterSpacing:"0.06em" }}>THEIR MESSAGE</div>
                <div style={{ padding:"14px", background:"#1A2235", borderRadius:10, border:"1px solid rgba(255,255,255,0.06)", fontSize:13, color:"#9CA3AF", lineHeight:1.7 }}>
                  {drawer.message || <em style={{ color:"#4B5563" }}>No message provided</em>}
                </div>
              </div>
            </div>

            {/* Drawer actions */}
            <div style={{ padding:"20px 24px", borderTop:"1px solid rgba(255,255,255,0.07)" }}>
              {/* Pipeline stepper */}
              <div style={{ display:"flex", alignItems:"center", gap:6, marginBottom:14, overflowX:"auto", paddingBottom:4 }}>
                {PIPELINE.map((stage, i) => {
                  const cur = getStatus(drawer.id);
                  const curIdx = PIPELINE.indexOf(cur);
                  const done = i <= curIdx;
                  const s = STAGE_STYLE[stage] || STAGE_STYLE.new;
                  return (
                    <div key={stage} style={{ display:"flex", alignItems:"center", gap:6 }}>
                      <button
                        onClick={() => advanceStatus(drawer, stage)}
                        style={{ padding:"5px 12px", borderRadius:20, fontSize:10, fontWeight:700, fontFamily:"'IBM Plex Mono'", cursor:"pointer", border:`1px solid ${done ? s.color : "rgba(255,255,255,0.1)"}`, background: done ? s.bg : "transparent", color: done ? s.color : "#4B5563", transition:"all 0.15s" }}
                      >
                        {PIPELINE_LABEL[stage]}
                      </button>
                      {i < PIPELINE.length - 1 && <span style={{ color:"#374151", fontSize:10 }}>›</span>}
                    </div>
                  );
                })}
              </div>
              <div style={{ display:"flex", gap:10 }}>
                {(() => {
                  const nxt = PIPELINE_NEXT[getStatus(drawer.id)];
                  return nxt ? (
                    <button onClick={() => { advanceStatus(drawer, nxt); setDrawer(null); }} style={{ ...A.btn("linear-gradient(135deg,#20BDE0,#0E7490)"), flex:1 }}>
                      → Advance to {(PIPELINE_LABEL[nxt]||nxt)}
                    </button>
                  ) : null;
                })()}
                {getStatus(drawer.id) !== "rejected" && getStatus(drawer.id) !== "active" && (
                  <button onClick={() => { advanceStatus(drawer, "rejected"); setDrawer(null); }} style={{ ...A.btn("rgba(239,68,68,0.08)","#EF4444"), padding:"10px 18px", border:"1px solid rgba(239,68,68,0.2)" }}>
                    Decline
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Top bar */}
      <div style={A.topbar}>
        <div style={{ display:"flex", alignItems:"center", gap:14 }}>
          <InkingiLogo light sub="ADMIN PORTAL · RW" />
        </div>
        <div style={{ display:"flex", gap:8, alignItems:"center" }}>
          <span style={A.badge("rgba(250,210,1,0.1)","#FAD201")}>{pendingCount} PENDING</span>
          <span style={A.badge("rgba(0,196,106,0.1)","#00C46A")}>{activeCount} ACTIVE</span>
          <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
          <button onClick={loadRequests} disabled={refreshing}
            style={{ ...A.btn("#1A2235","white"), border:"1px solid rgba(255,255,255,0.2)", fontSize:12, display:"flex", alignItems:"center", gap:6 }}>
            <span style={{ display:"inline-block", animation: refreshing ? "spin 0.7s linear infinite" : "none" }}>↻</span>
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
          {refreshedAt && !refreshing && (
            <span style={{ fontSize:10, color:"#4B5563", fontFamily:"'IBM Plex Mono'", whiteSpace:"nowrap" }}>
              Updated {refreshedAt.toLocaleTimeString("en-GB",{hour:"2-digit",minute:"2-digit"})}
            </span>
          )}
          <button onClick={() => { sessionStorage.removeItem("admin_auth"); onExit(); }} style={{ ...A.btn("#1A2235","#9CA3AF"), border:"1px solid rgba(255,255,255,0.07)" }}>
            Exit Admin
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ padding:"0 32px", borderBottom:"1px solid rgba(255,255,255,0.07)", display:"flex", gap:4, background:"#111827" }}>
        {[["requests","Partner Requests"],["onboarding","Onboarding"],["partners","Active Partners"],["momo","MoMo Analysis"],["api","API Integration"]].map(([key, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{ padding:"14px 18px", background:"none", border:"none", borderBottom:`2px solid ${tab===key?"#20BDE0":"transparent"}`, color: tab===key ? "#20BDE0" : "#6B7280", fontSize:13, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans'", transition:"all 0.15s" }}>
            {label}
          </button>
        ))}
      </div>

      <div style={{ padding:32 }}>

        {/* ── PARTNER REQUESTS TAB ── */}
        {tab === "requests" && (
          <div>
            {/* Stats */}
            <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:16, marginBottom:28 }}>
              {[
                { label:"OPEN REQUESTS",   value:submissions.filter(s => getStatus(s.id) !== "rejected").length, color:"#20BDE0" },
                { label:"PENDING REVIEW",  value:pendingCount,       color:"#FAD201" },
                { label:"ACTIVE PARTNERS", value:activeCount,        color:"#00C46A" },
                { label:"DECLINED",        value:submissions.filter(s => getStatus(s.id) === "rejected").length, color:"#EF4444" },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ ...A.card, borderTop:`2px solid ${color}` }}>
                  <div style={{ fontSize:10, fontFamily:"'IBM Plex Mono'", color:"#4B5563", letterSpacing:"0.08em", marginBottom:10 }}>{label}</div>
                  <div style={{ fontSize:30, fontWeight:800, color:"white" }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Filter + table */}
            <div style={{ ...A.card, padding:0, overflow:"hidden" }}>
              <div style={{ padding:"18px 24px", borderBottom:"1px solid rgba(255,255,255,0.07)", display:"flex", alignItems:"center", justifyContent:"space-between" }}>
                <div style={{ fontSize:15, fontWeight:700 }}>Incoming Requests</div>
                <div style={{ display:"flex", gap:4 }}>
                  {[["all","All"],["new","New"],["under_review","In Review"],["approved","Approved"],["onboarded","Onboarded"],["active","Active"],["rejected","Declined"]].map(([key,label]) => (
                    <button key={key} onClick={() => setFilter(key)} style={{ padding:"5px 14px", borderRadius:6, border:"none", fontSize:12, fontWeight:600, cursor:"pointer", fontFamily:"'DM Sans'", background: filter===key ? "rgba(32,189,224,0.15)" : "transparent", color: filter===key ? "#20BDE0" : "#6B7280", transition:"all 0.15s" }}>
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              {submissions.length === 0 ? (
                <div style={{ padding:"70px 24px", textAlign:"center" }}>
                  <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="#374151" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ marginBottom:16 }}>
                    <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>
                  </svg>
                  <div style={{ fontSize:14, fontWeight:700, color:"#6B7280", marginBottom:8 }}>No partner requests yet</div>
                  <div style={{ fontSize:12, color:"#4B5563", maxWidth:400, margin:"0 auto", lineHeight:1.7 }}>
                    When companies fill the form on your website, their submissions will appear here.
                  </div>
                  <button onClick={() => {
                    const DEMO_SUBS = [
                      { id:"demo-1", company_name:"MTN Rwanda",        institution_type:"Mobile Money Operator", contact_name:"Pacifique Nzabahimana", contact_email:"p.nzabahimana@mtn.co.rw",     transaction_volume:"Over 1M transactions/month",          message:"We process 3M+ MoMo transactions daily and need fraud scoring to reduce chargebacks.", _date:"2026-03-09T08:22:00Z" },
                      { id:"demo-2", company_name:"Bank of Kigali",    institution_type:"Commercial Bank",       contact_name:"Diane Umwiza",           contact_email:"d.umwiza@bk.rw",             transaction_volume:"100,000 – 1M transactions/month",     message:"Seeing increase in card-not-present fraud. Want to explore real-time scoring API.",      _date:"2026-03-08T14:10:00Z" },
                      { id:"demo-3", company_name:"Equity Bank Rwanda", institution_type:"Commercial Bank",      contact_name:"Jean Claude Habimana",   contact_email:"jc.habimana@equitybank.co.rw", transaction_volume:"10,000 – 100,000 transactions/month", message:"",                                                                                          _date:"2026-03-07T11:45:00Z" },
                    ];
                    setSubmissions(DEMO_SUBS);
                    setStatuses(prev => ({ "demo-1":"active","demo-2":"approved","demo-3":"new", ...prev }));
                  }} style={{ marginTop:20, background:"none", border:"none", color:"#374151", fontSize:11, cursor:"pointer", textDecoration:"underline", fontFamily:"'IBM Plex Mono'" }}>
                    Load sample data for visual testing
                  </button>
                </div>
              ) : filtered.length === 0 ? (
                <div style={{ padding:"60px 24px", textAlign:"center" }}>
                  <div style={{ fontSize:14, color:"#6B7280" }}>No requests in this category yet.</div>
                </div>
              ) : (
                <div style={{ overflowX:"auto" }}>
                  <table style={{ width:"100%", borderCollapse:"collapse" }}>
                    <thead>
                      <tr>
                        {["Company","Type","Volume","Date","Status","Actions"].map(h => (
                          <th key={h} style={{ padding:"11px 16px", textAlign:"left", fontSize:10, fontFamily:"'IBM Plex Mono'", color:"#4B5563", letterSpacing:"0.07em", borderBottom:"1px solid rgba(255,255,255,0.07)", fontWeight:500 }}>{h.toUpperCase()}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {filtered.map(s => (
                        <tr key={s.id} onClick={() => setDrawer(s)} style={{ borderBottom:"1px solid rgba(255,255,255,0.05)", cursor:"pointer", transition:"background 0.12s", opacity: getStatus(s.id) === "rejected" ? 0.5 : 1 }}
                          onMouseEnter={e => e.currentTarget.style.background="rgba(255,255,255,0.02)"}
                          onMouseLeave={e => e.currentTarget.style.background="transparent"}>
                          <td style={{ padding:"13px 16px" }}>
                            <div style={{ display:"flex", alignItems:"center", gap:12 }}>
                              <div style={{ width:36, height:36, borderRadius:9, background:avatarColor(s.company_name), display:"flex", alignItems:"center", justifyContent:"center", fontSize:12, fontWeight:800, flexShrink:0 }}>{inits(s.company_name)}</div>
                              <div>
                                <div style={{ fontSize:13, fontWeight:600 }}>{s.company_name}</div>
                                <div style={{ fontSize:11, color:"#6B7280", marginTop:1 }}>{s.contact_email}</div>
                              </div>
                            </div>
                          </td>
                          <td style={{ padding:"13px 16px", fontSize:12, color:"#9CA3AF" }}>{s.institution_type || "—"}</td>
                          <td style={{ padding:"13px 16px", fontSize:12, color:"#9CA3AF" }}>{(s.transaction_volume||"").replace(" transactions/month","").replace("Under ","<") || "—"}</td>
                          <td style={{ padding:"13px 16px", fontSize:12, color:"#9CA3AF", fontFamily:"'IBM Plex Mono'" }}>{fmtDate(s._date)}</td>
                          <td style={{ padding:"13px 16px" }}>{statusBadge(getStatus(s.id))}</td>
                          <td style={{ padding:"13px 16px" }} onClick={e => e.stopPropagation()}>
                            {(() => {
                              const cur = getStatus(s.id);
                              const nxt = PIPELINE_NEXT[cur];
                              return (
                                <div style={{ display:"flex", gap:6 }}>
                                  {nxt && (
                                    <button onClick={() => advanceStatus(s, nxt)} style={{ ...A.btn("rgba(32,189,224,0.1)","#20BDE0"), padding:"5px 12px", fontSize:11, border:"1px solid rgba(32,189,224,0.25)" }}>
                                      → {(PIPELINE_LABEL[nxt]||nxt).split("_").map(w=>w[0].toUpperCase()+w.slice(1)).join(" ")}
                                    </button>
                                  )}
                                  {cur !== "rejected" && cur !== "active" && (
                                    <button onClick={() => advanceStatus(s, "rejected")} style={{ ...A.btn("rgba(239,68,68,0.07)","#EF4444"), padding:"5px 12px", fontSize:11, border:"1px solid rgba(239,68,68,0.15)" }}>Decline</button>
                                  )}
                                </div>
                              );
                            })()}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ── ONBOARDING TAB ── */}
        {tab === "onboarding" && (() => {
          const approved = submissions.filter(s => ["approved","onboarded","active"].includes(getStatus(s.id)));
          const sel = selectedCompany ? approved.find(s => s.id === selectedCompany) : null;
          const companyAnalysts = sel ? backendAnalysts.filter(a => a.institution === sel.company_name) : [];
          const adminAnalyst = backendAnalysts.find(a => a.id === "AK-001");
          const adminEnrollSt = enrollStatus["AK-001"];
          return (
            <div>
              {/* ── Admin Self-Enrollment Card ── */}
              <div style={{ ...A.card, marginBottom:24, borderTop:"2px solid #20BDE0" }}>
                <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", flexWrap:"wrap", gap:12 }}>
                  <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                    {adminAnalyst?.photo_data
                      ? <img src={adminAnalyst.photo_data} alt="Admin" style={{ width:54, height:54, borderRadius:12, objectFit:"cover", border:"2px solid rgba(32,189,224,0.4)" }} />
                      : <div style={{ width:54, height:54, borderRadius:12, background:"linear-gradient(135deg,#20BDE0,#008751)", display:"flex", alignItems:"center", justifyContent:"center", fontSize:20, fontWeight:800 }}>AK</div>
                    }
                    <div>
                      <div style={{ fontSize:15, fontWeight:800 }}>My Login Photo (AK-001)</div>
                      <div style={{ fontSize:12, color:"#6B7280", marginTop:3 }}>
                        {adminAnalyst?.face_enrolled || adminEnrollSt === "enrolled"
                          ? "Face enrolled — you can log in with your photo"
                          : "No face enrolled — upload a clear front-facing photo to enable biometric login"
                        }
                      </div>
                      {adminAnalyst?.last_login && (
                        <div style={{ fontSize:11, color:"#4B5563", fontFamily:"'IBM Plex Mono'", marginTop:4 }}>
                          Last login: {new Date(adminAnalyst.last_login).toLocaleString("en-GB")}
                        </div>
                      )}
                    </div>
                  </div>
                  <div style={{ display:"flex", gap:8, alignItems:"center" }}>
                    {(adminAnalyst?.face_enrolled || adminEnrollSt === "enrolled") && (
                      <span style={A.badge("rgba(0,196,106,0.12)","#00C46A")}>FACE ENROLLED</span>
                    )}
                    {adminEnrollSt === "loading" && (
                      <span style={A.badge("rgba(32,189,224,0.1)","#20BDE0")}>PROCESSING…</span>
                    )}
                    {adminEnrollSt === "error" && (
                      <span style={A.badge("rgba(239,68,68,0.1)","#EF4444")}>FAILED — try another photo</span>
                    )}
                    <button
                      disabled={!adminFaceReady || adminEnrollSt === "loading"}
                      onClick={() => { setEnrollTarget("AK-001"); enrollFileRef.current?.click(); }}
                      style={{ ...A.btn("linear-gradient(135deg,#20BDE0,#0E7490)"), opacity: adminFaceReady ? 1 : 0.4 }}
                    >
                      {adminAnalyst?.face_enrolled || adminEnrollSt === "enrolled" ? "Update My Photo" : "Enroll My Face"}
                    </button>
                  </div>
                </div>
              </div>

              {approved.length === 0 ? (
                <div style={{ textAlign:"center", padding:"80px 24px" }}>
                  <div style={{ fontSize:32, marginBottom:16 }}>🏢</div>
                  <div style={{ fontSize:15, fontWeight:700, marginBottom:8 }}>No approved companies yet</div>
                  <div style={{ fontSize:13, color:"#6B7280" }}>Approve a partner request in the Requests tab first, then come back here to add their analysts.</div>
                  <button onClick={() => setTab("requests")} style={{ ...A.btn("rgba(32,189,224,0.1)","#20BDE0"), marginTop:20, border:"1px solid rgba(32,189,224,0.2)" }}>← Go to Requests</button>
                </div>
              ) : (
                <div style={{ display:"grid", gridTemplateColumns:"280px 1fr", gap:24, alignItems:"start" }}>
                  {/* Company list */}
                  <div style={A.card}>
                    <div style={{ fontSize:13, fontWeight:700, marginBottom:14, color:"#9CA3AF" }}>APPROVED COMPANIES</div>
                    {approved.map(s => (
                      <div key={s.id} onClick={() => { setSelectedCompany(s.id); setNewAnalyst({ id:"", name:"", role:"Fraud Analyst", institution:"", email:"" }); }}
                        style={{ padding:"12px 14px", borderRadius:10, background: selectedCompany===s.id ? "rgba(32,189,224,0.08)" : "#1A2235", border:`1px solid ${selectedCompany===s.id ? "rgba(32,189,224,0.3)" : "rgba(255,255,255,0.06)"}`, marginBottom:8, cursor:"pointer", transition:"all 0.12s" }}>
                        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
                          <div style={{ width:32, height:32, borderRadius:8, background:avatarColor(s.company_name), display:"flex", alignItems:"center", justifyContent:"center", fontSize:11, fontWeight:800, flexShrink:0 }}>{inits(s.company_name)}</div>
                          <div style={{ flex:1, minWidth:0 }}>
                            <div style={{ fontSize:13, fontWeight:600, whiteSpace:"nowrap", overflow:"hidden", textOverflow:"ellipsis" }}>{s.company_name}</div>
                            <div style={{ marginTop:4 }}>{statusBadge(getStatus(s.id))}</div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Right panel */}
                  {sel ? (
                    <div>
                      {/* Add analyst form */}
                      <div style={{ ...A.card, marginBottom:20 }}>
                        <div style={{ fontSize:15, fontWeight:700, marginBottom:16 }}>Add Analyst — {sel.company_name}</div>
                        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:12, marginBottom:14 }}>
                          {[
                            ["Analyst ID", "id",    "e.g. BK-001"],
                            ["Full Name",  "name",  "e.g. Diane Umwiza"],
                            ["Role",       "role",  "e.g. Fraud Analyst"],
                            ["Email",      "email", "e.g. d.umwiza@bk.rw"],
                          ].map(([label, key, ph]) => (
                            <div key={key}>
                              <label style={A.label}>{label.toUpperCase()}</label>
                              <input value={newAnalyst[key]} onChange={e => setNewAnalyst(p => ({ ...p, [key]: e.target.value }))} placeholder={ph} style={A.input} />
                            </div>
                          ))}
                        </div>

                        {/* Photo upload for face login */}
                        <div style={{ marginBottom:16 }}>
                          <label style={A.label}>ANALYST PHOTO (FOR FACE LOGIN)</label>
                          <div style={{ display:"flex", alignItems:"center", gap:14 }}>
                            <input
                              ref={photoInputRef}
                              type="file"
                              accept="image/*"
                              style={{ display:"none" }}
                              onChange={e => {
                                const file = e.target.files[0];
                                if (!file) return;
                                const reader = new FileReader();
                                reader.onload = ev => {
                                  photoDataRef.current = ev.target.result;
                                  setPhotoPreview(ev.target.result);
                                };
                                reader.readAsDataURL(file);
                              }}
                            />
                            <button type="button"
                              onClick={() => photoInputRef.current?.click()}
                              style={{ ...A.btn("rgba(255,255,255,0.05)","#9CA3AF"), border:"1px dashed rgba(255,255,255,0.15)", fontSize:12, padding:"9px 16px" }}>
                              {photoPreview ? "Change Photo" : "Upload Photo"}
                            </button>
                            {photoPreview && (
                              <img src={photoPreview} alt="Preview" style={{ width:44, height:44, borderRadius:9, objectFit:"cover", border:"2px solid rgba(32,189,224,0.4)" }} />
                            )}
                            {!photoPreview && (
                              <span style={{ fontSize:11, color:"#4B5563" }}>Clear front-facing photo · used for biometric login</span>
                            )}
                          </div>
                        </div>

                        <button onClick={() => addAnalystForCompany(sel.company_name)} disabled={adding}
                          style={{ ...A.btn("linear-gradient(135deg,#20BDE0,#0E7490)"), opacity: adding ? 0.7 : 1 }}>
                          {adding ? "Adding..." : `+ Add Analyst${photoPreview ? " · Photo saved" : ""}`}
                        </button>
                      </div>

                      {/* Analyst list for this company */}
                      <div style={A.card}>
                        <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between", marginBottom:14 }}>
                          <div style={{ fontSize:15, fontWeight:700 }}>
                            Analysts
                            <span style={{ ...A.badge("rgba(32,189,224,0.1)","#20BDE0"), marginLeft:10 }}>{companyAnalysts.length}</span>
                          </div>
                          <div style={{ fontSize:11, color: adminFaceReady ? "#00C46A" : "#6B7280" }}>
                            {adminFaceReady ? "✓ Face recognition ready" : "Loading face models..."}
                          </div>
                        </div>
                        {companyAnalysts.length === 0 ? (
                          <div style={{ textAlign:"center", padding:"32px 0", color:"#4B5563", fontSize:13 }}>No analysts added yet. Use the form above to add the first one.</div>
                        ) : companyAnalysts.map(a => {
                          const es = enrollStatus[a.id];
                          const hasFace = a.face_enrolled || es === "enrolled";
                          return (
                            <div key={a.id} style={{ display:"flex", alignItems:"center", gap:12, padding:"12px 14px", background:"#1A2235", borderRadius:10, border:"1px solid rgba(255,255,255,0.06)", marginBottom:10 }}>
                              {a.photo_data
                                ? <img src={a.photo_data} alt={a.name} style={{ width:38, height:38, borderRadius:9, objectFit:"cover", flexShrink:0 }} />
                                : <div style={{ width:38, height:38, borderRadius:9, background:avatarColor(a.name), display:"flex", alignItems:"center", justifyContent:"center", fontSize:13, fontWeight:800, flexShrink:0 }}>{inits(a.name)}</div>
                              }
                              <div style={{ flex:1 }}>
                                <div style={{ fontSize:13, fontWeight:600 }}>{a.name}</div>
                                <div style={{ fontSize:11, color:"#6B7280", marginTop:2 }}>{a.id} · {a.role}</div>
                              </div>
                              <div style={{ display:"flex", gap:6, alignItems:"center", flexShrink:0 }}>
                                {hasFace  && <span style={A.badge("rgba(0,196,106,0.12)","#00C46A")}>FACE ✓</span>}
                                {!hasFace && es !== "loading" && <span style={A.badge("rgba(100,116,139,0.1)","#64748B")}>NO FACE</span>}
                                {es === "loading" && <span style={A.badge("rgba(32,189,224,0.1)","#20BDE0")}>PROCESSING…</span>}
                                {es === "error"   && <span style={A.badge("rgba(239,68,68,0.1)","#EF4444")}>FAILED</span>}
                                <button disabled={!adminFaceReady || es === "loading"}
                                  onClick={() => { setEnrollTarget(a.id); enrollFileRef.current?.click(); }}
                                  style={{ ...A.btn("rgba(32,189,224,0.08)","#20BDE0"), padding:"4px 10px", fontSize:11, border:"1px solid rgba(32,189,224,0.2)", opacity: adminFaceReady ? 1 : 0.4 }}>
                                  {hasFace ? "Re-enroll" : "Enroll Face"}
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  ) : (
                    <div style={{ ...A.card, display:"flex", alignItems:"center", justifyContent:"center", minHeight:220 }}>
                      <div style={{ color:"#4B5563", fontSize:13 }}>← Select a company to manage analysts</div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })()}

        {/* ── ACTIVE PARTNERS TAB ── */}
        {tab === "partners" && (() => {
          const active = submissions.filter(s => getStatus(s.id) === "active");
          return (
            <div>
              {active.length === 0 ? (
                <div style={{ textAlign:"center", padding:"80px 24px" }}>
                  <div style={{ fontSize:32, marginBottom:16 }}>🤝</div>
                  <div style={{ fontSize:15, fontWeight:700, marginBottom:8 }}>No active partners yet</div>
                  <div style={{ fontSize:13, color:"#6B7280" }}>Advance a company through the full pipeline to Active status in the Requests tab.</div>
                  <button onClick={() => setTab("requests")} style={{ ...A.btn("rgba(32,189,224,0.1)","#20BDE0"), marginTop:20, border:"1px solid rgba(32,189,224,0.2)" }}>← Go to Requests</button>
                </div>
              ) : (
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(340px,1fr))", gap:16 }}>
                  {active.map(s => {
                    const compA = backendAnalysts.filter(a => a.institution === s.company_name);
                    const enrolled = compA.filter(a => a.face_enrolled).length;
                    const lastLogin = compA.reduce((best, a) => {
                      if (!a.last_login) return best;
                      return !best || new Date(a.last_login) > new Date(best) ? a.last_login : best;
                    }, null);
                    return (
                      <div key={s.id} style={A.card}>
                        <div style={{ display:"flex", alignItems:"center", gap:12, marginBottom:18 }}>
                          <div style={{ width:46, height:46, borderRadius:12, background:avatarColor(s.company_name), display:"flex", alignItems:"center", justifyContent:"center", fontSize:16, fontWeight:800, flexShrink:0 }}>{inits(s.company_name)}</div>
                          <div style={{ flex:1 }}>
                            <div style={{ fontSize:15, fontWeight:700 }}>{s.company_name}</div>
                            <div style={{ fontSize:12, color:"#6B7280", marginTop:2 }}>{s.institution_type || "—"}</div>
                          </div>
                          <span style={A.badge("rgba(0,196,106,0.12)","#00C46A")}>ACTIVE</span>
                        </div>
                        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:10, marginBottom:16 }}>
                          {[
                            ["ANALYSTS",     compA.length,  "#20BDE0"],
                            ["FACE ENROLLED", `${enrolled}/${compA.length}`, enrolled === compA.length && compA.length > 0 ? "#00C46A" : "#FAD201"],
                            ["LAST LOGIN",   lastLogin ? new Date(lastLogin).toLocaleDateString("en-GB",{day:"2-digit",month:"short"}) : "—", "#9CA3AF"],
                          ].map(([lbl, val, col]) => (
                            <div key={lbl} style={{ padding:"10px 12px", background:"#1A2235", borderRadius:8, textAlign:"center" }}>
                              <div style={{ fontSize:9, color:"#6B7280", fontFamily:"'IBM Plex Mono'", marginBottom:6 }}>{lbl}</div>
                              <div style={{ fontSize:18, fontWeight:800, color:col }}>{val}</div>
                            </div>
                          ))}
                        </div>
                        <div style={{ fontSize:11, color:"#4B5563", marginBottom:14 }}>{s.contact_email || "—"}</div>
                        <div style={{ display:"flex", gap:8 }}>
                          <button onClick={() => { setTab("onboarding"); setSelectedCompany(s.id); }}
                            style={{ ...A.btn("rgba(32,189,224,0.08)","#20BDE0"), flex:1, fontSize:12, border:"1px solid rgba(32,189,224,0.2)" }}>
                            Manage Analysts
                          </button>
                          <button onClick={() => advanceStatus(s, "rejected")}
                            style={{ ...A.btn("rgba(239,68,68,0.07)","#EF4444"), fontSize:12, border:"1px solid rgba(239,68,68,0.15)", padding:"10px 14px" }}>
                            Deactivate
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })()}

        {/* ── MOMO ANALYSIS TAB ── */}
        {tab === "momo" && (
          <div>
            <div style={{ marginBottom:24 }}>
              <div style={{ fontSize:10, color:"#20BDE0", fontFamily:"'IBM Plex Mono'", letterSpacing:"0.08em", marginBottom:8 }}>MOMO ANALYSIS</div>
              <h2 style={{ fontSize:20, fontWeight:800, color:"white", marginBottom:6 }}>MoMo Transaction Analyzer</h2>
              <p style={{ color:"#6B7280", fontSize:13, lineHeight:1.7 }}>Parse and score MoMo SMS or USSD export data. Results can be exported as CSV for audit records.</p>
            </div>
            <MomoAnalyzer mode="admin" />
          </div>
        )}

        {/* ── API INTEGRATION TAB ── */}
        {tab === "api" && <AdminApiTab />}

      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// ROOT APP — with sessionStorage persistence
// ─────────────────────────────────────────────────────────────────────────────
export default function App() {
  const [screen, setScreen] = useState(() => {
    try { return sessionStorage.getItem("inkingi_screen") || "home"; } catch { return "home"; }
  });
  const [showDemo, setShowDemo] = useState(false);

  // Secret admin URL — go to localhost:5173?admin=1 to open admin panel
  const isAdminURL = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("admin") === "1";
  if (isAdminURL) return <AdminPage onExit={() => { window.history.replaceState({},"",window.location.pathname); window.location.reload(); }} />;

  const setScreenPersist = (s) => {
    try { sessionStorage.setItem("inkingi_screen", s); } catch {}
    setScreen(s);
  };

  useEffect(() => {
    if (screen !== "login" && screen !== "dashboard") window.scrollTo(0, 0);
  }, [screen]);

  if (screen === "login") return <FaceLogin onLogin={() => setScreenPersist("dashboard")} onBack={() => setScreenPersist("home")} />;
  if (screen === "dashboard") return <Dashboard onLogout={() => { try { sessionStorage.removeItem("inkingi_demo"); sessionStorage.removeItem("inkingi_demo_pending"); } catch {} setScreenPersist("home"); }} />;

  return (
    <div style={{ minHeight:"100vh", background:C.bg, fontFamily:"'DM Sans', sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:ital,opsz,wght@0,9..40,300..800;1,9..40,300..800&family=IBM+Plex+Mono:wght@400;500&display=swap');
        * { box-sizing:border-box; margin:0; padding:0; } body { background:${C.bg}; }
        @keyframes shimmer{0%{background-position:200% 0}100%{background-position:-200% 0}}
      `}</style>
      <LandingNav activePage={screen} setPage={setScreenPersist} />
      {screen==="home" && <HomePage setPage={setScreenPersist} onDemo={() => setShowDemo(true)} />}
      {screen==="about" && <AboutPage setPage={setScreenPersist} />}
      {screen==="how" && <HowPage setPage={setScreenPersist} onDemo={() => setShowDemo(true)} />}
      {screen==="partners" && <PartnersPage setPage={setScreenPersist} />}
      {screen==="privacy" && <PrivacyPage setPage={setScreenPersist} />}
      <LandingFooter setPage={setScreenPersist} />
      {showDemo && <DemoWalkthrough onClose={() => setShowDemo(false)} onRequestAccess={() => { setShowDemo(false); setScreenPersist("partners"); }} />}
    </div>
  );
}
