"use client";

import { QRCodeSVG } from "qrcode.react";
import { useEffect, useState } from "react";
import { Button, Card, Header, Loading, StatusBadge, TxNotice, usd } from "@/components/ui";
import { useSayola } from "@/components/useSayola";
import { AGENTS, RECIPIENTS, SYP_PER_USD, person, type RoleKey } from "@/lib/people";
import type { PaymentView } from "@/lib/types";

function syp(n: number): string {
  return `${Math.round(n * SYP_PER_USD).toLocaleString("ar-SY")} ل.س`;
}

function PhoneInbox({ payment }: { payment: PaymentView }) {
  const [code, setCode] = useState<string | null>(null);
  useEffect(() => {
    let alive = true;
    fetch(`/api/sms?payment=${payment.id}`)
      .then((r) => r.json())
      .then((d) => alive && setCode(d.code));
    return () => {
      alive = false;
    };
  }, [payment.id]);
  return (
    <div className="rounded-2xl border-4 border-stone-800 bg-stone-900 p-3 text-white">
      <div className="mb-2 text-center text-[10px] uppercase tracking-widest text-stone-400">هاتف المستفيد (محاكاة)</div>
      <div className="rounded-xl bg-stone-700 p-3 text-sm">
        <div className="text-xs text-stone-300">سيولة · SMS</div>
        رمز استلام الدفعة #{payment.id}: <span className="font-mono text-lg font-bold">{code ?? "……"}</span>
        <div className="text-xs text-stone-300">لا تشاركه إلا مع الوكيل عند استلام النقد.</div>
      </div>
    </div>
  );
}

export default function RecipientPage() {
  const { state, loadError, busy, last, act } = useSayola();
  const [who, setWho] = useState<RoleKey>("recipient-1");
  const [disputeAmount, setDisputeAmount] = useState(50);

  if (!state) {
    return (
      <>
        <Header />
        <Loading error={loadError} />
      </>
    );
  }

  const me = person(who)!;
  const mine = state.payments.filter((p) => p.recipientKey === who).reverse();
  const nearby = AGENTS.slice().sort((a) => (person(a)?.area === me.area ? -1 : 1));
  const waiting = mine.filter((p) => p.status === "Funded" || p.status === "Booked");

  return (
    <>
      <Header contractId={state.contractId} />
      <main dir="rtl" className="mx-auto w-full max-w-2xl flex-1 space-y-5 px-4 py-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">مرحباً {me.nameAr}</h1>
            <p className="text-sm text-stone-600">{me.area === "Idlib" ? "إدلب" : "حلب"}</p>
          </div>
          <div className="flex gap-1 rounded-xl bg-stone-100 p-1 text-sm">
            {RECIPIENTS.map((k) => (
              <button
                key={k}
                onClick={() => setWho(k)}
                className={`rounded-lg px-3 py-1.5 ${k === who ? "bg-white shadow-sm" : "text-stone-600"}`}
              >
                {person(k)?.nameAr}
              </button>
            ))}
          </div>
        </div>

        <TxNotice busy={busy} last={last} arabic />

        <Card>
          <div className="text-sm text-stone-500">بانتظار الاستلام</div>
          <div className="mt-1 text-3xl font-bold">{syp(waiting.reduce((s, p) => s + p.amount, 0))}</div>
          <div className="text-sm text-stone-500">
            {usd(waiting.reduce((s, p) => s + p.amount, 0))} · السعر الرسمي {SYP_PER_USD} ل.س للدولار · بدون أي رسوم عليك
          </div>
        </Card>

        {mine.length === 0 && <p className="text-sm text-stone-500">لا توجد دفعات.</p>}

        {mine.map((p) => (
          <Card key={p.id}>
            <div className="flex items-center justify-between">
              <div>
                <div className="font-semibold">مساعدة نقدية #{p.id}</div>
                <div className="text-sm text-stone-600">
                  {syp(p.amount)} ({usd(p.amount)})
                </div>
              </div>
              <StatusBadge status={p.status} arabic />
            </div>

            {(p.status === "Funded" || p.status === "Booked") && (
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                <div className="space-y-3">
                  {p.status === "Booked" ? (
                    <p className="text-sm">
                      حجزت عند <span className="font-semibold">{person(p.agentKey ?? "")?.nameAr}</span> حتى{" "}
                      {new Date(p.windowEnd * 1000).toLocaleTimeString("ar-SY", { hour: "2-digit", minute: "2-digit" })}.
                      النقد محجوز لك.
                    </p>
                  ) : (
                    <>
                      <p className="text-sm text-stone-600">احجز موعداً ليكون النقد جاهزاً عند الوكيل:</p>
                      <div className="flex flex-wrap gap-2">
                        {nearby.map((a) => (
                          <Button
                            key={a}
                            variant={person(a)?.area === me.area ? "primary" : "secondary"}
                            disabled={!!busy}
                            onClick={() => act({ action: "book", id: p.id, agent: a }, "book cash-out")}
                          >
                            {person(a)?.nameAr}
                          </Button>
                        ))}
                      </div>
                    </>
                  )}
                  <div className="flex items-center gap-3 rounded-xl bg-stone-50 p-3">
                    <QRCodeSVG value={`sayola:pay:${p.id}`} size={88} />
                    <p className="text-xs text-stone-600">اعرض هذا الرمز على الوكيل، أو استخدم بطاقتك المطبوعة ورقمك السري.</p>
                  </div>
                </div>
                <PhoneInbox payment={p} />
              </div>
            )}

            {p.status === "CashedOut" && state.now <= p.cashedOutAt + state.config.disputeWindow && (
              <div className="mt-4 space-y-2 rounded-xl bg-rose-50 p-3 text-sm">
                <p>استلمت مبلغاً أقل؟ أبلغنا بسرية خلال 24 ساعة. لن يرى الوكيل هويتك في البلاغ.</p>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    min={1}
                    max={p.amount}
                    className="w-28 rounded-xl border border-stone-300 px-3 py-2"
                    value={disputeAmount}
                    onChange={(e) => setDisputeAmount(Number(e.target.value))}
                  />
                  <span>دولار ناقص</span>
                  <Button
                    variant="danger"
                    disabled={!!busy || disputeAmount <= 0 || disputeAmount > p.amount}
                    onClick={() => act({ action: "dispute", id: p.id, missing: disputeAmount }, "raise dispute")}
                  >
                    تقديم اعتراض
                  </Button>
                </div>
              </div>
            )}
          </Card>
        ))}
      </main>
    </>
  );
}
