"use client";

import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useOwnerData } from "../context";

export default function OwnerPaymentsPage() {
  const { data } = useOwnerData();
  const [paymentInfo, setPaymentInfo] = useState<{ site_name: string | null; bank_name: string | null; iban: string | null; swift_code: string | null; vat_account: string | null; manager_name: string | null; manager_email: string | null; manager_phone: string | null; payment_methods: string[] } | null>(null);

  useEffect(() => {
    fetch("/api/payment-info", { cache: "no-store" })
      .then(r => r.ok ? r.json() : Promise.resolve(null))
      .then((json: Parameters<typeof setPaymentInfo>[0]) => setPaymentInfo(json));
  }, []);

  return (
    <div className="space-y-4 mt-2">
      <Card>
        <CardHeader><CardTitle>Bank Account & Payment Methods</CardTitle><p className="text-sm text-muted-foreground mt-1">Payment details for your property manager.</p></CardHeader>
        <CardContent className="space-y-4">
          {paymentInfo ? (
            <>
              {paymentInfo.site_name && <p className="font-medium">{paymentInfo.site_name}</p>}
              {(paymentInfo.bank_name || paymentInfo.iban || paymentInfo.swift_code) && (
                <div className="space-y-2">
                  {paymentInfo.bank_name && <div><p className="text-sm font-medium text-muted-foreground">Bank name</p><p className="text-sm mt-0.5">{paymentInfo.bank_name}</p></div>}
                  {paymentInfo.iban && <div><p className="text-sm font-medium text-muted-foreground">IBAN</p><p className="text-sm mt-0.5 break-words">{paymentInfo.iban}</p></div>}
                  {paymentInfo.swift_code && <div><p className="text-sm font-medium text-muted-foreground">SWIFT code</p><p className="text-sm mt-0.5">{paymentInfo.swift_code}</p></div>}
                </div>
              )}
              {paymentInfo.vat_account && (
                <div>
                  <p className="text-sm font-medium text-muted-foreground">VAT</p>
                  <p className="text-sm mt-0.5">{paymentInfo.vat_account}</p>
                </div>
              )}
              <div>
                <p className="text-sm font-medium text-muted-foreground">Manager contact</p>
                <div className="text-sm mt-0.5 space-y-1">
                  {paymentInfo.manager_name && <p>{paymentInfo.manager_name}</p>}
                  {paymentInfo.manager_email && <p><a href={`mailto:${paymentInfo.manager_email}`} className="text-primary hover:underline">{paymentInfo.manager_email}</a></p>}
                  {paymentInfo.manager_phone && <p>{paymentInfo.manager_phone}</p>}
                  {!paymentInfo.manager_name && !paymentInfo.manager_email && !paymentInfo.manager_phone && <p className="text-muted-foreground">—</p>}
                </div>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Payment methods</p>
                <ul className="text-sm mt-0.5 list-disc list-inside space-y-1">
                  {paymentInfo.payment_methods?.map((m, i) => <li key={i}>{m}</li>) ?? <li>Contact your property manager for payment instructions.</li>}
                </ul>
              </div>
            </>
          ) : (
            <p className="text-sm text-muted-foreground">Loading payment info...</p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
