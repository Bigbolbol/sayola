"use client";

import { useCallback, useState } from "react";
import { QrScanner } from "@/components/QrScanner";
import { Button, Card, Header, Loading, Stat, StatusBadge, TxNotice, usd } from "@/components/ui";
import { useSayola } from "@/components/useSayola";
import { AGENTS, SYP_PER_USD, person, syp, type RoleKey } from "@/lib/people";

export default function AgentPage() {
  const { state, loadError, busy, last, act } = useSayola();
  const [agentKey, setAgentKey] = useState<RoleKey>("agent-idlib");
  const [code, setCode] = useState("");
  const [paymentId, setPaymentId] = useState<number | null>(null);
  const [secret, setSecret] = useState("");
  const [method, setMethod] = useState<"sms" | "pin">("sms");
  const [scanning, setScanning] = useState(false);
  const [floatAmount, setFloatAmount] = useState(500);

  const onScan = useCallback((text: string) => {
    const match = text.match(/sayola:pay:(\d+)/);
    if (match) {
      setCode(match[1]);
      setPaymentId(Number(match[1]));
    }
    setScanning(false);
  }, []);
  const closeScanner = useCallback(() => setScanning(false), []);

  if (!state) {
    return (
      <>
        <Header />
        <Loading error={loadError} />
      </>
    );
  }

  const agent = state.agents.find((a) => a.key === agentKey)!;
  const me = person(agentKey)!;
  const queue = state.payments.filter(
    (p) =>
      (p.status === "Booked" && p.agentKey === agentKey) ||
      (p.status === "Funded" && person(p.recipientKey)?.area === me.area),
  );
  const selected = paymentId !== null ? state.payments.find((p) => p.id === paymentId) : undefined;
  const selectedOk = selected && (selected.status === "Funded" || selected.status === "Booked");

  async function confirm() {
    if (!selected) return;
    const result = await act(
      {
        action: "confirm",
        id: selected.id,
        agent: agentKey,
        ...(method === "sms" ? { code: secret } : { pin: secret }),
      },
      "confirm cash-out",
    );
    if (result.hash) {
      setSecret("");
      setPaymentId(null);
      setCode("");
    }
  }

  return (
    <>
      <Header contractId={state.contractId} />
      <main dir="rtl" className="mx-auto w-full max-w-3xl flex-1 space-y-5 px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">{me.nameAr}</h1>
            <p className="text-sm text-stone-600">وكيل صرف نقدي · {me.area === "Idlib" ? "إدلب" : "حلب"}</p>
          </div>
          <div className="flex gap-1 rounded-xl bg-stone-100 p-1 text-sm">
            {AGENTS.map((k) => (
              <button
                key={k}
                onClick={() => setAgentKey(k)}
                className={`rounded-lg px-3 py-1.5 ${k === agentKey ? "bg-white shadow-sm" : "text-stone-600"}`}
              >
                {person(k)?.nameAr}
              </button>
            ))}
          </div>
        </div>

        <TxNotice busy={busy} last={last} arabic />

        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label="السيولة من الصندوق" value={usd(agent.floatOut)} hint={`الحد ${usd(agent.limit, 0)}`} />
          <Stat label="الضمان المودع" value={usd(agent.collateral)} />
          <Stat label="عمليات الصرف" value={agent.cashouts} hint={`اعتراضات مقبولة: ${agent.disputesUpheld}`} />
          <Stat label="رصيدي (عمولات)" value={usd(agent.balance)} />
        </div>

        <Card title="صرف نقدي">
          {scanning ? (
            <QrScanner onScan={onScan} onClose={closeScanner} />
          ) : (
            <div className="space-y-4">
              <div className="flex flex-wrap items-end gap-2">
                <label className="text-sm">
                  <div className="mb-1 text-stone-500">رقم الدفعة أو امسح بطاقة المستفيد</div>
                  <input
                    inputMode="numeric"
                    className="w-40 rounded-xl border border-stone-300 px-3 py-2"
                    value={code}
                    onChange={(e) => {
                      setCode(e.target.value);
                      setPaymentId(/^\d+$/.test(e.target.value) ? Number(e.target.value) : null);
                    }}
                  />
                </label>
                <Button variant="secondary" onClick={() => setScanning(true)}>
                  مسح QR
                </Button>
              </div>

              {selected && !selectedOk && (
                <p className="text-sm text-rose-700">هذه الدفعة ليست متاحة للصرف.</p>
              )}

              {selected && selectedOk && (
                <div className="space-y-3 rounded-xl bg-stone-50 p-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-semibold">{person(selected.recipientKey)?.nameAr}</div>
                      <div className="text-sm text-stone-600">
                        سلّم نقداً: <span className="font-semibold">{syp(selected.amount)}</span> ({usd(selected.amount)})
                      </div>
                      <div className="text-xs text-stone-500">
                        بسعر الشريك المرخّص المعلن اليوم: {SYP_PER_USD} ل.س للدولار (مثال)
                      </div>
                    </div>
                    <StatusBadge status={selected.status} arabic />
                  </div>
                  <div className="flex gap-2 text-sm">
                    <button
                      className={`rounded-lg px-3 py-1 ${method === "sms" ? "bg-emerald-700 text-white" : "bg-white"}`}
                      onClick={() => setMethod("sms")}
                    >
                      رمز SMS
                    </button>
                    <button
                      className={`rounded-lg px-3 py-1 ${method === "pin" ? "bg-emerald-700 text-white" : "bg-white"}`}
                      onClick={() => setMethod("pin")}
                    >
                      بطاقة + رقم سري
                    </button>
                  </div>
                  <p className="text-xs text-stone-500">
                    {method === "sms"
                      ? `أُرسل رمز إلى هاتف المستفيد ${person(selected.recipientKey)?.phone}. اطلب منه قراءته.`
                      : "اطلب من المستفيد إدخال رقمه السري المكوّن من 4 أرقام."}
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      inputMode="numeric"
                      type={method === "pin" ? "password" : "text"}
                      placeholder={method === "sms" ? "الرمز من 6 أرقام" : "الرقم السري"}
                      className="w-40 rounded-xl border border-stone-300 px-3 py-2"
                      value={secret}
                      onChange={(e) => setSecret(e.target.value)}
                    />
                    <Button disabled={!!busy || secret.length < 4} onClick={confirm}>
                      تأكيد تسليم {syp(selected.amount)}
                    </Button>
                  </div>
                </div>
              )}
            </div>
          )}
        </Card>

        <Card title="الحجوزات والدفعات في منطقتي">
          {queue.length === 0 ? (
            <p className="text-sm text-stone-500">لا توجد دفعات بانتظار الصرف.</p>
          ) : (
            <ul className="divide-y divide-stone-100">
              {queue.map((p) => (
                <li key={p.id} className="flex items-center justify-between py-2 text-sm">
                  <button
                    className="text-start"
                    onClick={() => {
                      setCode(String(p.id));
                      setPaymentId(p.id);
                    }}
                  >
                    <span className="font-medium">#{p.id} · {person(p.recipientKey)?.nameAr}</span>
                    <span className="mx-2 text-stone-500">{syp(p.amount)}</span>
                  </button>
                  <StatusBadge status={p.status} arabic />
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="سحب سيولة من صندوق الشراكة">
          <p className="mb-3 text-sm text-stone-600">
            رأس مال شراكة لتجهيز النقد، وليس قرضاً: تعيده عند كل عملية صرف، وتقتسم العمولة مع الصندوق (40% لك).
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              type="number"
              min={1}
              className="w-32 rounded-xl border border-stone-300 px-3 py-2"
              value={floatAmount}
              onChange={(e) => setFloatAmount(Number(e.target.value))}
            />
            <Button
              disabled={!!busy || floatAmount <= 0}
              onClick={() => act({ action: "takeFloat", agent: agentKey, amount: floatAmount }, "take float")}
            >
              سحب {usd(floatAmount, 0)}
            </Button>
            <Button
              variant="secondary"
              disabled={!!busy || floatAmount <= 0 || floatAmount > agent.floatOut}
              onClick={() => act({ action: "returnFloat", agent: agentKey, amount: floatAmount }, "return float")}
            >
              إعادة
            </Button>
          </div>
        </Card>
      </main>
    </>
  );
}
