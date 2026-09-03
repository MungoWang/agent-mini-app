/**
 * @group forms
 * @title Phone / Password / Currency / Copyable
 * @scenario Format-aware text fields that validate while typing: PhoneInput, PasswordField (mask toggle), CurrencyInput, plus Copyable for read-only tokens/ids.
 */
import * as React from "react";

import { Copyable, CurrencyInput, PasswordField, PhoneInput } from "@monkey-mini-app/ui";

export default function MiscForms04Example() {
  const [phone, setPhone] = React.useState("");
  const [pwd, setPwd] = React.useState("secret");
  const [money, setMoney] = React.useState("12.50");

  return (
    <>
      <div className="flex max-w-sm flex-col gap-2">
        <PhoneInput value={phone} onChange={setPhone} />
        <PasswordField value={pwd} onChange={setPwd} />
        <CurrencyInput value={money} onChange={setMoney} />
        <Copyable value="TMS-55357" />
      </div>
    </>
  );
}
