// R-SPINE-060 fixture: every string comes from the module string table; test
// ids and codes are the two exceptions the rule allows.
import { strings } from '@/ui/strings';

export function PaymentBanner(): JSX.Element {
  return (
    <section data-testid="payment-banner">
      <h2>{strings.paymentReceivedTitle}</h2>
      <p>{strings.paymentReceivedBody}</p>
      <span data-testid="currency-code">BDT</span>
      <input placeholder={strings.amountPlaceholder} />
    </section>
  );
}
