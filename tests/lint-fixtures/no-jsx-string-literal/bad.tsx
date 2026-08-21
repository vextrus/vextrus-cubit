// R-SPINE-060 fixture: prose typed straight into JSX.
export function PaymentBanner(): JSX.Element {
  return (
    <section>
      <h2>Payment received</h2>
      <p>{'The client has cleared this invoice.'}</p>
      <input placeholder="Amount in taka" />
    </section>
  );
}
